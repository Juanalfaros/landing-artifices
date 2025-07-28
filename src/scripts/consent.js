// src/scripts/consent.js
(() => {
  const KEY = 'artifices_consent_v1';
  const REMOVAL_DELAY = 360;

  const dl = () => (window.dataLayer = window.dataLayer || []);
  const save = v => { try { localStorage.setItem(KEY, v); } catch {} };
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null } };

  function updateConsent(mode) {
    // Cookies necesarias siempre permitidas
    const base = {
      functionality_storage: 'granted',
      security_storage: 'granted'
    };

    if (mode === 'granted') {
      // ✅ Analytics + Ads permitidos
      window.gtag?.('consent', 'update', {
        ...base,
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
      dl().push({ event: 'consent_granted' });
    } else {
      // ❌ Solo necesarias
      window.gtag?.('consent', 'update', {
        ...base,
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      dl().push({ event: 'consent_denied' });
    }
  }

  function removeBanner() {
    const el = document.getElementById('cookie-banner');
    if (!el) return;
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), REMOVAL_DELAY);
  }

  function showBanner() {
    document.getElementById('cookie-banner')?.classList.add('is-visible');
  }

  function decide(mode) {
    save(mode);
    updateConsent(mode);
    removeBanner();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const stored = read();
    if (stored === 'granted' || stored === 'denied') {
      updateConsent(stored);
      removeBanner();
    } else {
      showBanner();
    }

    document.getElementById('btn-consent-accept')
      ?.addEventListener('click', () => decide('granted'));
    document.getElementById('btn-consent-reject')
      ?.addEventListener('click', () => decide('denied'));
  });
})();