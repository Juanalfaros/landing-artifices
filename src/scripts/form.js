// src/scripts/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.querySelector('#lead-form');
  const status = document.querySelector('#form-status');

  // ya viene del snippet que pusimos en index.html
  const siteKey = window.RECAPTCHA_SITE_KEY;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Enviando…';

    try {
      await grecaptcha.ready(async () => {
        const token = await grecaptcha.execute(siteKey, { action: 'submit' });

        const payload = Object.fromEntries(new FormData(form));
        payload.token = token;

        const res = await fetch('/api/submit-lead', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload)
        });

        if (res.ok) {
          status.textContent = '¡Gracias! Te contactaremos pronto.';
          form.reset();
          window.dataLayer?.push({ event: 'lead_submitted' });
        } else {
          const { error } = await res.json().catch(() => ({}));
          status.textContent = error || 'Error al enviar. Intenta más tarde.';
        }
      });
    } catch (err) {
      console.error(err);
      status.textContent = 'Error inesperado.';
    }
  });
});
