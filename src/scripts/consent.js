// src/scripts/consent.js
(function () {
  const KEY = 'artifices_consent_v1';

  function dl() {
    window.dataLayer = window.dataLayer || [];
    return window.dataLayer;
  }

  function save(state) {
    try { localStorage.setItem(KEY, state); } catch {}
  }

  function read() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }

  function pushState(state) {
    if (state === 'granted') {
      dl().push({ event: 'consent_granted' });
    } else if (state === 'denied') {
      dl().push({ event: 'consent_denied' });
    }
  }

  function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('is-visible');
  }

  function showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.add('is-visible');
  }

  function setConsent(state) {
    save(state);
    pushState(state);
    hideBanner();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const stored = read();

    // Si ya hay decisión, la reenviamos a GTM y ocultamos
    if (stored === 'granted' || stored === 'denied') {
      pushState(stored);
      hideBanner();
    } else {
      showBanner();
    }

    // Botones
    const acceptBtn = document.getElementById('btn-consent-accept');
    const rejectBtn = document.getElementById('btn-consent-reject');

    acceptBtn?.addEventListener('click', () => setConsent('granted'));
    rejectBtn?.addEventListener('click', () => setConsent('denied'));
  });
})();
