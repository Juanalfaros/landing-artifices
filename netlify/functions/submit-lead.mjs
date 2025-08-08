// netlify/functions/submit-lead.mjs
export async function handler (event) {
  /* 1 · Solo POST */
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  /* 2 · Body esperado */
  let data;
  try { data = JSON.parse(event.body); }
  catch { return json({ error: 'Bad JSON' }, 400); }

  const { name = '', email = '', company = '', website = '', token } = data;
  if (!email || !token) return json({ error: 'Missing fields' }, 422);

  /* 3 · Validar reCAPTCHA v3 */
  const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      secret  : process.env.RECAPTCHA_SECRET_KEY,
      response: token
    })
  }).then(r => r.json());

  if (!verify.success || verify.score < 0.5)
    return json({ error: 'reCAPTCHA failed' }, 403);

  /* 4 · Round-robin en Upstash */
  const agente = await nextAgent();        // ← aquí se decide quién sigue

  /* 5 · Crear / actualizar contacto en Brevo */
  const brevoHeaders = {
    'api-key'     : process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  };

  const attrs   = { NOMBRE: name, COMPANY_NAME: company, WEBSITE: website, AGENTE: agente };
  const listIds = [ Number(process.env.BREVO_LIST_ID || 6) ];

  let res = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify({ email, attributes: attrs, listIds, updateEnabled: false })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 400 && err.code === 'duplicate_parameter') {
      res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method : 'PUT',
        headers: brevoHeaders,
        body   : JSON.stringify({ attributes: attrs, listIds })
      });
    }
  }

  if (!res.ok) return json({ error: 'Brevo error' }, 502);

  /* 6 · OK */
  return json({ ok: true, agente });
}

/* ----------------- helpers ----------------- */
function json (obj, status = 200) {
  return {
    statusCode: status,
    headers   : {
      'Content-Type'               : 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(obj)
  };
}

/* Rotación circular con RPOPLPUSH */
/* Rotación circular con RPOPLPUSH mejorada */
async function nextAgent() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, AGENT_LIST } = process.env;
  const agents = AGENT_LIST.split(',').map(a => a.trim()).filter(Boolean);
  const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

  console.log('Agentes disponibles:', agents); // Debug

  try {
    // Primero verificamos si la lista existe y tiene elementos
    const listLength = await fetch(
      `${UPSTASH_REDIS_REST_URL}/llen/agents`,
      { headers }
    ).then(r => r.json());

    console.log('Longitud de la lista:', listLength.result); // Debug

    // Si la lista no existe o está vacía, la inicializamos
    if (listLength.error || listLength.result === 0) {
      console.log('Inicializando lista de agentes...'); // Debug
      
      // Borramos cualquier clave existente por si acaso
      await fetch(`${UPSTASH_REDIS_REST_URL}/del/agents`, { headers });
      
      // Agregamos todos los agentes usando LPUSH (uno por uno para mayor control)
      for (const agent of agents) {
        await fetch(`${UPSTASH_REDIS_REST_URL}/lpush/agents/${agent}`, { headers });
      }
      
      // Retornamos el primer agente
      console.log('Lista inicializada, retornando:', agents[0]); // Debug
      return agents[0];
    }

    // Hacemos el RPOPLPUSH (saca del final y pone al principio)
    const res = await fetch(
      `${UPSTASH_REDIS_REST_URL}/rpoplpush/agents/agents`,
      { headers }
    ).then(r => r.json());

    console.log('Resultado RPOPLPUSH:', res); // Debug

    if (res.error || !res.result || !agents.includes(res.result)) {
      console.log('Error en RPOPLPUSH o agente inválido, reinicializando...'); // Debug
      
      // Reinicializar la lista
      await fetch(`${UPSTASH_REDIS_REST_URL}/del/agents`, { headers });
      
      for (const agent of agents) {
        await fetch(`${UPSTASH_REDIS_REST_URL}/lpush/agents/${agent}`, { headers });
      }
      
      return agents[0];
    }

    console.log('Agente seleccionado:', res.result); // Debug
    return res.result;

  } catch (error) {
    console.error('Error en nextAgent:', error);
    // En caso de error, devolver el primer agente como fallback
    return agents[0];
  }
}