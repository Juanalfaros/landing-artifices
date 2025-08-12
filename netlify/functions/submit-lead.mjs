// netlify/functions/submit-lead.mjs

// === Handler principal ===
export async function handler (event) {
  /* 0 · CORS / Preflight */
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  /* 1 · Solo POST */
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  /* 2 · Body esperado */
  let data;
  try { data = JSON.parse(event.body); }
  catch { return json({ error: 'Bad JSON' }, 400); }

  const {
    name    = '',
    email   = '',
    company = '',
    website = '',
    phone   = '',
    token
  } = data;

  if (!email || !token) return json({ error: 'Missing fields' }, 422);

  // Normalizaciones mínimas en backend
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
  }).then(r => r.json()).catch(() => null);

  if (!verify || !verify.success || Number(verify.score ?? 0) < 0.5) {
    return json({ error: 'reCAPTCHA failed' }, 403);
  }

  /* 4 · Round-robin en Upstash */
  const agente = await nextAgent();        // ← aquí se decide quién sigue

  /* 5 · Crear / actualizar contacto en Brevo */
  const brevoHeaders = {
    'api-key'     : process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  };

  // Atributos personalizados (asegúrate de crear TELEFONO en Brevo si no existe)
  const attrs = {
    NOMBRE       : String(name).trim(),
    COMPANY_NAME : String(company).trim(),
    WEBSITE      : websiteNormalized,
    AGENTE       : agente,
    TELEFONO     : phoneNormalized
  };
  const listIds = [ Number(process.env.BREVO_LIST_ID || 6) ];

  // Intento de creación
  let res = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify({
      email,
      attributes   : attrs,
      listIds,
      updateEnabled: false,
      // Campo estándar “SMS” de Brevo (opcional, pero útil si luego envías SMS)
      sms: phoneNormalized || undefined
    })
  });

  // Si el contacto ya existe, lo actualizamos
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 400 && err?.code === 'duplicate_parameter') {
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

// Respuesta JSON con CORS
function json (obj, status = 200) {
  return {
    statusCode: status,
    headers   : corsHeaders({ 'Content-Type': 'application/json' }),
    body      : JSON.stringify(obj)
  };
}

// Encabezados CORS
function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extra
  };
}

// Normalizar teléfono a formato compatible (E.164 simplificado)
function normalizePhone(raw) {
  if (!raw) return '';
  let v = String(raw).trim().replace(/[^\d+]/g, '');
  // si hay '+' en medio, dejamos solo el inicial
  if (v.indexOf('+') > 0) v = '+' + v.replace(/\+/g, '');
  // validación mínima: 8–15 dígitos con/ sin '+'
  if (!/^\+?\d{8,15}$/.test(v)) return '';
  return v;
}

// Asegurar esquema en website si lo omitieron
function normalizeWebsite(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (/^https?:\/\//i.test(val)) return val;
  return `https://${val}`;
}

/* Rotación circular con RPOPLPUSH mejorada (Upstash REST) */
async function nextAgent() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, AGENT_LIST } = process.env;
  const agents = String(AGENT_LIST || '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN || agents.length === 0) {
    // Fallback seguro si falta configuración
    return agents[0] || 'sin-agente';
  }

  try {
    // 1) ¿Existe y tiene elementos?
    const listLength = await fetch(
      `${UPSTASH_REDIS_REST_URL}/llen/agents`,
      { headers }
    ).then(r => r.json());

    // 2) Si no existe o está vacía, inicializa
    if (listLength?.error || listLength?.result === 0) {
      await fetch(`${UPSTASH_REDIS_REST_URL}/del/agents`, { headers });
      // LPUSH para cargar la lista (quedan en orden inverso; usamos rpoplpush luego)
      for (const agent of agents) {
        await fetch(`${UPSTASH_REDIS_REST_URL}/lpush/agents/${encodeURIComponent(agent)}`, { headers });
      }
      return agents[0];
    }

    // 3) Rotar
    const res = await fetch(
      `${UPSTASH_REDIS_REST_URL}/rpoplpush/agents/agents`,
      { headers }
    ).then(r => r.json());

    if (res?.error || !res?.result || !agents.includes(res.result)) {
      // Reinicializar si algo vino raro
      await fetch(`${UPSTASH_REDIS_REST_URL}/del/agents`, { headers });
      for (const agent of agents) {
        await fetch(`${UPSTASH_REDIS_REST_URL}/lpush/agents/${encodeURIComponent(agent)}`, { headers });
      }
      return agents[0];
    }

    return res.result;
  } catch (error) {
    // Fallback ante cualquier problema
    return agents[0] || 'sin-agente';
  }
}