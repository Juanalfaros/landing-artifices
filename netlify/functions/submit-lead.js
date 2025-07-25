// netlify/functions/submit-lead.js
/*
 * Env vars (en Netlify › Site settings › Environment):
 *  ───────────────────────────────────────────────────
 *  RECAPTCHA_SECRET_KEY   ←  Clave secreta de reCAPTCHA v3
 *  BREVO_API_KEY          ←  xkeysib-…  (clave SMTP & API v3)
 *  BREVO_LIST_ID          ←  6          (id numérico de tu lista)
 */

export default async (req, context) => {
  /* ─── 1. Permite solo POST ───────────────────────── */
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  /* ─── 2. Extrae el body JSON ─────────────────────── */
  let data;
  try {
    data = await req.json();
  } catch {
    return json({ error: 'Bad JSON' }, 400);
  }

  const { name = '', email = '', phone = '', message = '', token } = data;
  if (!email || !token) {
    return json({ error: 'Missing fields' }, 422);
  }

  /* ─── 3. Valida reCAPTCHA v3 ─────────────────────── */
  const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      secret   : context.env.6Lc_544rAAAAAP7EA29MGszBjreysMbw3x6WSNl6,
      response : token,
      remoteip : req.headers.get('x-nf-client-connection-ip') || ''
    })
  }).then(r => r.json());

  if (!verify.success || verify.score < 0.5) {
    return json({ error: 'reCAPTCHA failed' }, 403);
  }

  /* ─── 4. Crea / actualiza el contacto en Brevo ───── */
  const brevoHeaders = {
    'api-key'      : context.env.BREVO_API_KEY,
    'Content-Type' : 'application/json'
  };

  // Intentamos crear el contacto
  const createBody = {
    email,
    attributes: {
      FIRSTNAME : name,
      WHATSAPP  : phone,
      MESSAGE   : message
    },
    listIds       : [Number(context.env.BREVO_LIST_ID || 6)],
    updateEnabled : false     // si existe devuelve 400
  };

  let brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify(createBody)
  });

  // Si ya existe (error 400, code "duplicate_parameter"), lo actualizamos:
  if (!brevoRes.ok) {
    const err = await brevoRes.json().catch(() => ({}));
    if (brevoRes.status === 400 && err.code === 'duplicate_parameter') {
      brevoRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method : 'PUT',
        headers: brevoHeaders,
        body   : JSON.stringify({
          attributes: createBody.attributes,
          listIds   : createBody.listIds
        })
      });
    }
  }

  if (!brevoRes.ok) {
    return json({ error: 'Brevo error' }, 502);
  }

  /* ─── 5. ¡Todo OK! ───────────────────────────────── */
  return json({ ok: true }, 200);
};

/* ───────────── Helpers ───────────── */
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type' : 'application/json',
      // CORS simple para dev local; ajusta si lo necesitas
      'Access-Control-Allow-Origin'  : '*',
      'Access-Control-Allow-Methods' : 'POST, OPTIONS'
    }
  });
}
