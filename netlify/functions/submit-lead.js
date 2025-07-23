// netlify/functions/submit-lead.js
import fetch from 'node-fetch';

export default async (req, context) => {
  // 1) Solo POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  /** 2) Body esperado
   * { name, email, phone, message, token }
   */
  const data = await req.json();

  // 3) Verifica reCAPTCHA v3
  const secret = context.env.RECAPTCHA_SECRET;
  const verify = await fetch(
    'https://www.google.com/recaptcha/api/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: data.token,
        remoteip: req.headers.get('x-nf-client-connection-ip') || ''
      })
    }
  ).then(r => r.json());

  if (!verify.success || verify.score < 0.5) {
    return new Response('reCAPTCHA failed', { status: 403 });
  }

  // 4) Aquí envías el lead…
  // Ejemplo: Email con SendGrid (o guarda en Airtable, etc.)
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.env.SENDGRID_API_KEY}`
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: context.env.TO_EMAIL }] }],
      from: { email: context.env.FROM_EMAIL },
      subject: 'Nuevo lead landing‑artifices',
      content: [
        {
          type: 'text/plain',
          value: `
Nombre:  ${data.name}
Email:   ${data.email}
Teléfono:${data.phone}
Mensaje: ${data.message}`
        }
      ]
    })
  });

  if (!resp.ok) {
    return new Response('Mail provider error', { status: 502 });
  }

  // 5) Respuesta OK
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
