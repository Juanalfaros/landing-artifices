// src/scripts/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.querySelector('#lead-form');
  const status = document.querySelector('#form-status');

  const siteKey = window.RECAPTCHA_SITE_KEY;

  function normalizePhone(raw) {
    if (!raw) return '';
    let v = String(raw).trim();
    // permitir solo dígitos y un + inicial
    v = v.replace(/[^\d+]/g, '');
    // si tiene múltiples +, quédate con el primero
    if (v.indexOf('+') > 0) v = '+' + v.replace(/\+/g, '');
    return v;
  }

  function isValidPhone(p) {
    // E.164 simplificado: + y 8–15 dígitos
    return /^\+?\d{8,15}$/.test(p);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Enviando…';

    // Validación suave del website (tu lógica actual)
    const webInput = form.website;
    if (!webInput.checkValidity()) {
      if (!/^https?:\/\//i.test(webInput.value)) {
        webInput.value = `https://${webInput.value}`;
      }
    }
    if (!webInput.checkValidity()) {
      webInput.reportValidity();
      return;
    }

    // Normaliza y valida teléfono si viene
    const phoneRaw = form.phone?.value || '';
    const phone    = normalizePhone(phoneRaw);
    if (phoneRaw && !isValidPhone(phone)) {
      status.textContent = 'Ingresa un teléfono válido (ej: +56912345678).';
      form.phone.focus();
      return;
    }

    try {
      await grecaptcha.ready(async () => {
        const token = await grecaptcha.execute(siteKey, { action: 'submit' });

        const payload = Object.fromEntries(new FormData(form));
        payload.phone = phone; // normalizado
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