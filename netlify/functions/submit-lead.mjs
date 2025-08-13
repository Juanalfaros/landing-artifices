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

  // ⬅️ AÑADIMOS phone
  const { name = '', email = '', company = '', website = '', phone = '', token } = data;
  if (!email || !token) return json({ error: 'Missing fields' }, 422);

  // Normalizaciones mínimas (por si desde el front llega sucio)
  const phoneNormalized   = normalizePhone(phone);
  const websiteNormalized = normalizeWebsite(website);

  /* 3 · Validar reCAPTCHA v3 */
  const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      secret  : process.env.RECAPTCHA_SECRET_KEY,
      response: token
    })
  }).then(r => r.json());

  if (!verify.success || Number(verify.score ?? 0) < 0.5)
    return json({ error: 'reCAPTCHA failed' }, 403);

  /* 4 · Round-robin en Upstash */
  const agente = await nextAgent();

  /* 5 · Crear / actualizar contacto en Brevo */
  const brevoHeaders = {
    'api-key'     : process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  };

  // ⬅️ AÑADIMOS TELEFONO a atributos y usamos website normalizado
  const attrs   = {
    NOMBRE      : name,
    COMPANY_NAME: company,
    WEBSITE     : websiteNormalized,
    AGENTE      : agente,
    TELEFONO    : phoneNormalized // atributo personalizado en Brevo (tipo Text)
  };
  const listIds = [ Number(process.env.BREVO_LIST_ID || 6) ];

  let res = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify({
      email,
      attributes   : attrs,
      listIds,
      updateEnabled: false,
      // ⬅️ Campo estándar “sms” de Brevo
      sms: phoneNormalized || undefined
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 400 && err.code === 'duplicate_parameter') {
      res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method : 'PUT',
        headers: brevoHeaders,
        body   : JSON.stringify({
          attributes: attrs,
          listIds,
          sms: phoneNormalized || undefined
        })
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

// Normaliza a un formato compatible (E.164 simplificado). Si es inválido => ''
function normalizePhone(raw) {
  if (!raw) return '';
  let v = String(raw).trim().replace(/[^\d+]/g, '');
  if (v.indexOf('+') > 0) v = '+' + v.replace(/\+/g, '');
  if (!/^\+?\d{8,15}$/.test(v)) return '';
  return v.startsWith('+') ? v : `+${v}`;
}

// Asegura esquema en website si lo omitieron
function normalizeWebsite(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (/^https?:\/\//i.test(val)) return val;
  return `https://${val}`;
}

/* Rotación circular con RPOPLPUSH mejorada */
async function nextAgent() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, AGENT_LIST } = process.env;
  const agents = (AGENT_LIST || '').split(',').map(a => a.trim()).filter(Boolean);
  const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN || agents.length === 0) {
    return agents[0] || 'sin-agente';
  }

  try {
    const listLength = await fetch(`${UPSTASH_REDIS_REST_URL}/llen/agents`, { headers }).then(r => r.json());
    if (listLength?.error || listLength?.result === 0) {
      await fetch(`${UPSTASH_REDIS_REST_URL}/del/agents`, { headers });
      for (const a of agents) await fetch(`${UPSTASH_REDIS_REST_URL}/lpush/agents/${encodeURIComponent(a)}`, { headers });
      return agents[0];
    }
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/rpoplpush/agents/agents`, { headers }).then(r => r.json());
    if (res?.error || !res?.result || !agents.includes(res.result)) {
      await fetch(`${UPSTASH_REDIS_REST_URL}/del/agents`, { headers });
      for (const a of agents) await fetch(`${UPSTASH_REDIS_REST_URL}/lpush/agents/${encodeURIComponent(a)}`, { headers });
      return agents[0];
    }
    return res.result;
  } catch {
    return agents[0] || 'sin-agente';
  }
}