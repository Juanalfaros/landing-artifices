// src/scripts/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#lead-form');
  const status = document.querySelector('#form-status');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.textContent = 'Enviando…';

    // 1) token recaptcha v3
    const token = await grecaptcha.execute('RECAPTCHA_SITE_KEY', {
      action: 'submit'
    });

    // 2) datos del form
    const data = Object.fromEntries(new FormData(form));
    data.token = token;

    // 3) fetch a nuestro endpoint
    const res = await fetch('/api/submit-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      status.textContent = '¡Gracias! Te contactaremos pronto.';
      form.reset();
    } else {
      status.textContent = 'Error al enviar. Intenta más tarde.';
    }
  });
});
