    document.addEventListener('DOMContentLoaded', () => {
      /* Fade-in */
      const observer = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); } }),
        { threshold: 0.1 }
      );
      document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));

      /* Formulario */
      const form = document.getElementById('contact-form');
      const btn  = document.getElementById('submit-button');
      const KEY  = 'TU_SITE_KEY_V3';

      if (form) {
        form.addEventListener('submit', e => {
          e.preventDefault();
          grecaptcha.ready(() => {
            grecaptcha.execute(KEY, { action: 'submit_diagnostico' }).then(async token => {
              btn.disabled = true; btn.textContent = 'Enviando…';
              const data = Object.fromEntries(new FormData(form).entries());
              data.recaptchaToken = token;
              try {
                const res = await fetch('/api/submit-lead.php', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error(res.statusText);
                document.body.innerHTML = `
                  <div style="min-height:100vh;display:flex;justify-content:center;align-items:center;">
                    <div style="max-width:40rem;padding:3rem;text-align:center;">
                      <h1 class="font-primary" style="font-size:2.5rem;font-weight:700;color:var(--gray-800);">¡Excelente decisión!</h1>
                      <p style="font-size:1.125rem;color:var(--gray-500);margin-top:1rem;">
                        Hemos recibido tu solicitud. Un estratega revisará tu información y te contactará en menos de 24 h hábiles para coordinar tu sesión.
                      </p>
                      <a href="/" class="btn-primary" style="margin-top:2rem;">Volver al inicio</a>
                    </div>
                  </div>`;
              } catch (err) {
                alert('Hubo un error al enviar tu solicitud. Intenta nuevamente.');
                btn.disabled = false; btn.textContent = 'Solicitar mi Diagnóstico Gratuito';
              }
            });
          });
        });
      }
    });