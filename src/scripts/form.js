// src/scripts/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.querySelector('#lead-form');
  const status = document.querySelector('#form-status');

  // Site Key expuesta por Vite (la pones en .env.local y en Netlify env vars)
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Enviando…';

    try {
      /* 1 · Token de reCAPTCHA v3 */
      const token = await grecaptcha.execute(siteKey, { action: 'submit' });

      /* 2 · Construye el payload */
      const payload = Object.fromEntries(new FormData(form));
      payload.token = token;

      /* 3 · Envía al serverless function */
      const res = await fetch('/.netlify/functions/submit-lead', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload)
      });

      if (res.ok) {
        status.textContent = '¡Gracias! Te contactaremos pronto.';
        form.reset();

        /* 4 · Dispara el evento Lead en Google Tag Manager */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'lead_submitted' });
      } else {
        const { msg = 'Error al enviar. Intenta más tarde.' } = await res.json().catch(() => ({}));
        status.textContent = msg;
      }
    } catch (err) {
      console.error(err);
      status.textContent = 'Error inesperado. Intenta de nuevo.';
    }
  });
});
