// netlify/functions/submit-lead.js
/*
 *  Variables que debes tener en Netlify › Site settings › Environment:
 *  ──────────────────────────────────────────────────────────────────
 *  RECAPTCHA_SECRET_KEY   →  6Lc…   (v3 secret)
 *  BREVO_API_KEY          →  xkeysib-…
 *  BREVO_LIST_ID          →  6
 */
export default async (req) => {
  /* 1 · Método POST únicamente */
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  /* 2 · Body esperado */
  let data;
  try {
    data = await req.json();
  } catch {
    return json({ error: 'Bad JSON' }, 400);
  }

  const { name = '', email = '', company = '', website = '', token } = data;
  if (!email || !token) return json({ error: 'Missing fields' }, 422);

  /* 3 · Validar reCAPTCHA v3 */
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

  /* 4 · Crear/actualizar contacto en Brevo */
  const brevoHeaders = {
    'api-key'     : process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  };

  const attrs = {
    NOMBRE       : name,
    COMPANY_NAME : company,
    WEBSITE      : website
  };

  const listIds = [ Number(process.env.BREVO_LIST_ID || 6) ];

  // Crear
  let brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify({ email, attributes: attrs, listIds, updateEnabled: false })
  });

  // Si ya existe → actualizar
  if (!brevoRes.ok) {
    const err = await brevoRes.json().catch(() => ({}));
    if (brevoRes.status === 400 && err.code === 'duplicate_parameter') {
      brevoRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method : 'PUT',
        headers: brevoHeaders,
        body   : JSON.stringify({ attributes: attrs, listIds })
      });
    }
  }

  if (!brevoRes.ok) return json({ error: 'Brevo error' }, 502);

  /* 5 · Éxito */
  return json({ ok: true });
};

/* Helper */
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
// netlify/functions/submit-lead.js
import { Redis } from '@upstash/redis';

const redis  = Redis.fromEnv();                                // usa las env-vars
const agents = (process.env.AGENT_LIST || '').split(',')
                  .map(a => a.trim()).filter(Boolean);

export default async (req) => {
  /* 1 · POST only ---------------------------------------------------------- */
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  /* 2 · Parse body --------------------------------------------------------- */
  let data;
  try { data = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const { name = '', email = '', company = '', website = '', token } = data;
  if (!email || !token) return json({ error: 'Missing fields' }, 422);

  /* 3 · Verify reCAPTCHA v3 ----------------------------------------------- */
  const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      secret  : process.env.RECAPTCHA_SECRET_KEY,
      response: token
    })
  }).then(r => r.json());

  if (!verify.success || verify.score < 0.5) return json({ error: 'reCAPTCHA failed' }, 403);

  /* 4 · Round-robin → agente ---------------------------------------------- */
  let agente = 'unassigned';
  try {
    const counter = await redis.incr('lead_counter');          // 1,2,3,4…
    agente = agents.length ? agents[(counter - 1) % agents.length] : 'default';
  } catch (err) {
    console.error('Upstash error', err);
  }

  /* 5 · Brevo -------------------------------------------------------------- */
  const brevoHeaders = {
    'api-key'     : process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  };

  const attrs  = {
    NOMBRE       : name,
    COMPANY_NAME : company,
    WEBSITE      : website,
    AGENTE       : agente                        // ← nuevo campo
  };

  const listIds = [ Number(process.env.BREVO_LIST_ID || 6) ];

  // crear
  let brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify({ email, attributes: attrs, listIds, updateEnabled: false })
  });

  // si ya existe → actualizar
  if (!brevoRes.ok) {
    const err = await brevoRes.json().catch(() => ({}));
    if (brevoRes.status === 400 && err.code === 'duplicate_parameter') {
      brevoRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method : 'PUT',
        headers: brevoHeaders,
        body   : JSON.stringify({ attributes: attrs, listIds })
      });
    }
  }
  if (!brevoRes.ok) return json({ error: 'Brevo error' }, 502);

  /* 6 · Done --------------------------------------------------------------- */
  return json({ ok: true, agente });
};

/* Helper */
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
