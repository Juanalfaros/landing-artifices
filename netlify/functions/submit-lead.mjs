// netlify/functions/submit-lead.mjs
/**
 *  Variables de entorno necesarias (Settings › Environment):
 *  ──────────────────────────────────────────────────────────
 *  RECAPTCHA_SECRET_KEY   – 6Lc…     (v3 secret)
 *  BREVO_API_KEY          – xkeysib-…
 *  BREVO_LIST_ID          – 6         (num. de tu lista)
 *  UPSTASH_REDIS_REST_URL – https://… (deploy URL)
 *  UPSTASH_REDIS_REST_TOKEN
 *  AGENT_LIST             – "juan,ana,rodrigo" (orden inicial del round-robin)
 *  SKIP_RECAPTCHA         – 1 (opcional, sólo dev)
 */

export async function handler(event) {
  /* 0 · Pre-flight CORS -------------------------------------------------- */
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  /* 1 · Método POST únicamente ------------------------------------------- */
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  /* 2 · Body esperado ---------------------------------------------------- */
  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return json({ error: 'Bad JSON' }, 400);
  }

  const { name = '', email = '', company = '', website = '', token } = data;
  if (!email || !token) return json({ error: 'Missing fields' }, 422);

  /* 3 · Validar reCAPTCHA v3 (o saltarlo en dev) ------------------------- */
  if (!process.env.SKIP_RECAPTCHA) {
    const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : new URLSearchParams({
        secret  : process.env.RECAPTCHA_SECRET_KEY,
        response: token
      })
    }).then(r => r.json());

    if (!verify.success || verify.score < 0.5) {
      return json({ error: 'reCAPTCHA failed' }, 403);
    }
  }

  /* 4 · Round-robin en Upstash ------------------------------------------ */
  const agente = await nextAgent();

  /* 5 · Crear / actualizar contacto en Brevo ---------------------------- */
  const brevoHeaders = {
    'api-key'     : process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  };

  const attrs   = { NOMBRE: name, COMPANY_NAME: company, WEBSITE: website, AGENTE: agente };
  const listIds = [ Number(process.env.BREVO_LIST_ID || 6) ];

  // Intento de creación
  let brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify({ email, attributes: attrs, listIds, updateEnabled: false })
  });

  // Si ya existía, hacemos PUT
  if (!brevoRes.ok) {
    const err = await brevoRes.json().catch(() => ({}));
    if (brevoRes.status === 400 && err.code === 'duplicate_parameter') {
      brevoRes = await fetch(
        `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
        { method: 'PUT', headers: brevoHeaders, body: JSON.stringify({ attributes: attrs, listIds }) }
      );
    }
  }

  if (!brevoRes.ok) return json({ error: 'Brevo error' }, 502);

  /* 6 · Éxito ------------------------------------------------------------ */
  return json({ ok: true, agente });
}

/* ---------- Helpers ---------------------------------------------------- */
function json(obj, status = 200) {
  return {
    statusCode: status,
    headers   : {
      'Content-Type'               : 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(obj)
  };
}

/**
 * Devuelve el siguiente agente con RPOPLPUSH.
 * Si el key no existe (primera vez) lo inicializa con AGENT_LIST.
 */
async function nextAgent() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, AGENT_LIST } = process.env;
  const agents = AGENT_LIST.split(',').map(a => a.trim()).filter(Boolean);
  const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

  // rpoplpush agents agents  →  rota lista y devuelve el que sacó al frente
  const rotateURL = `${UPSTASH_REDIS_REST_URL}/rpoplpush/agents/agents`;
  const res = await fetch(rotateURL, { headers }).then(r => r.json());

  // Si aún no existe la lista en Redis
  if (res.error) {
    const initURL = `${UPSTASH_REDIS_REST_URL}/rpush/agents/${agents.join('%20')}`;
    await fetch(initURL, { headers });
    return agents[0];
  }

  // rpoplpush devuelve string ✓
  return res.result || agents[0];
}
