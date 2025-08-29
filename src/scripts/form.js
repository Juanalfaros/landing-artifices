// src/scripts/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form       = document.querySelector('#lead-form');
  const statusEl   = document.querySelector('#form-status');
  const submitBtn  = document.querySelector('#submit-button');

  // Clave reCAPTCHA inyectada desde el HTML por Vite
  const siteKey = window.RECAPTCHA_SITE_KEY;

  if (!form) return;

  // Helpers
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const disableSubmit = (v) => { if (submitBtn) submitBtn.disabled = !!v; };

  // Extrae nombre y apellido "inteligentemente"
  function splitName(full = '') {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { fn: '', ln: '' };
    const fn = parts.shift();
    const ln = parts.join(' ');
    return { fn, ln };
  }

  // Toma teléfono en formato E.164 si hay hidden de intl‑tel‑input (#phone_e164),
  // si no, usa el campo visible #phone y lo normaliza best-effort.
  function getPhoneE164(formEl) {
    const hidden = formEl.querySelector('#phone_e164');
    if (hidden && hidden.value) return hidden.value.trim();

    const input = formEl.querySelector('#phone');
    if (!input) return '';
    let val = (input.value || '').replace(/\s+/g, '');
    // Si empieza con 0 y no tiene +, no podemos inferir país; lo devolvemos tal cual.
    // Si comienza con +, lo damos por bueno.
    if (/^\+/.test(val)) return val;
    // Si parece un celular CL (9 dígitos que empiezan con 9), anteponemos +56.
    if (/^9\d{8}$/.test(val)) return `+56${val}`;
    return val; // fallback
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Evitar envíos dobles
    if (submitBtn && submitBtn.disabled) return;
    disableSubmit(true);
    setStatus('Enviando…');

    // 1) Intento de corregir website
    const webInput = form.website;
    if (webInput && !webInput.checkValidity()) {
      if (!/^https?:\/\//i.test(webInput.value)) {
        webInput.value = `https://${webInput.value}`;
      }
    }
    if (webInput && !webInput.checkValidity()) {
      webInput.reportValidity();
      disableSubmit(false);
      return;
    }

    try {
      await grecaptcha.ready(async () => {
        const token = await grecaptcha.execute(siteKey, { action: 'submit' });

        // 2) Payload al backend
        const payload = Object.fromEntries(new FormData(form));
        payload.token = token;

        // 3) POST a la función
        const res = await fetch('/api/submit-lead', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload)
        });

        // 4) Manejo de respuesta
        if (res.ok) {
          setStatus('¡Gracias! Te contactaremos pronto.');

          // ——— Analítica: push a dataLayer con advanced matching para Meta/GTM ———
          const { fn, ln } = splitName(form.name?.value || '');
          const phoneE164  = getPhoneE164(form);

          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'lead_submitted',               // Trigger en GTM (Meta Lead, GA4 event, etc.)
            lead_source: 'landing',
            page_location: window.location.href,
            page_path: window.location.pathname,
            user_data: {
              email  : (form.email?.value || '').trim(),
              phone  : phoneE164,
              fn     : fn,
              ln     : ln,
              company: (form.company?.value || '').trim(),
              website: (form.website?.value || '').trim()
            }
          });

          form.reset();
        } else {
          const { error } = await res.json().catch(() => ({}));
          const msg = error || 'Error al enviar. Intenta más tarde.';
          setStatus(msg);

          // Evento de error opcional para depurar en GTM
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'lead_submit_error',
            error_message: msg,
            status_code: res.status
          });
        }
      });
    } catch (err) {
      console.error(err);
      setStatus('Error inesperado.');

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'lead_submit_exception',
        error_message: String(err && err.message || err)
      });
    } finally {
      disableSubmit(false);
    }
  });
});