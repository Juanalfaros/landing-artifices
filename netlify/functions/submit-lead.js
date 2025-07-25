// netlify/functions/submit-lead.js
/*
 *  Env vars (Site → Build & deploy → Environment):
 *  ────────────────────────────────────────────────────────────
 *  RECAPTCHA_SECRET_KEY   ←  Clave secreta de reCAPTCHA v3
 *  BREVO_API_KEY          ←  xkeysib-…
 *  BREVO_LIST_ID          ←  6
 */

export default async (req, context) => {
  /* ── 1. Solo aceptamos POST ─────────────────────────────── */
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  /* ── 2. Leemos el body JSON ─────────────────────────────── */
  let data;
  try {
    data = await req.json();
  } catch {
    return json({ error: 'Bad JSON' }, 400);
  }

  const {
    name    = '',   // <input name="name">
    email   = '',   // <input name="email">
    company = '',   // <input name="company">
    website = '',   // <input name="website">
    token          // generado por reCAPTCHA v3
  } = data;

  if (!name || !email || !company || !website || !token) {
    return json({ error: 'Missing fields' }, 422);
  }

  /* ── 3. Verificamos reCAPTCHA v3 ────────────────────────── */
  const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      secret   : context.env.RECAPTCHA_SECRET_KEY,
      response : token,
      remoteip : req.headers.get('x-nf-client-connection-ip') || ''
    })
  }).then(r => r.json());

  if (!verify.success || verify.score < 0.5) {
    return json({ error: 'reCAPTCHA failed' }, 403);
  }

  /* ── 4. Crea / actualiza contacto en Brevo ──────────────── */
  const brevoHeaders = {
    'api-key'     : context.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  };

  // Atributos exactos según tu cuenta Brevo (pantallazo)
  const attributes = {
    NOMBRE       : name,
    COMPANY_NAME : company,
    WEBSITE      : website
  };

  const listIds = [Number(context.env.BREVO_LIST_ID || 0)];

  // Intentamos crear el contacto
  let brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
    method : 'POST',
    headers: brevoHeaders,
    body   : JSON.stringify({
      email,
      attributes,
      listIds,
      updateEnabled: false   // si existe, devolverá error 400
    })
  });

  // Si ya existe, lo actualizamos
  if (!brevoRes.ok) {
    const err = await brevoRes.json().catch(() => ({}));
    if (brevoRes.status === 400 && err.code === 'duplicate_parameter') {
      brevoRes = await fetch(
        `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
        {
          method : 'PUT',
          headers: brevoHeaders,
          body   : JSON.stringify({ attributes, listIds })
        }
      );
    }
  }

  if (!brevoRes.ok) {
    return json({ error: 'Brevo error', details: await brevoRes.text() }, 502);
  }

  /* ── 5. Listo ───────────────────────────────────────────── */
  return json({ ok: true }, 200);
};

/* ───────────── Helper para respuestas JSON ───────────── */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // CORS simple para dev local (ajusta si lo necesitas)
      'Access-Control-Allow-Origin': '*'
    }
  });
}
