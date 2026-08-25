(() => {
  const KEY = 'ai-revenue-lang';
  const supported = ['ja','en'];
  const detect = () => {
    const saved = localStorage.getItem(KEY);
    if (supported.includes(saved)) return saved;
    return (navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
  };
  const apply = (lang) => {
    if (!supported.includes(lang)) lang = 'ja';
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.querySelectorAll('[data-ja][data-en]').forEach(el => {
      const val = el.getAttribute(`data-${lang}`);
      if (val != null) el.textContent = val;
    });
    document.querySelectorAll('[data-lang-block]').forEach(el => {
      el.hidden = el.getAttribute('data-lang-block') !== lang;
    });
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
      const active = btn.getAttribute('data-lang-btn') === lang;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('active', active);
    });
    localStorage.setItem(KEY, lang);
    window.dispatchEvent(new CustomEvent('airevenue:language', { detail: { lang } }));
  };
  window.AIRevenueI18n = { apply, get: () => document.documentElement.dataset.lang || detect() };
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
      btn.addEventListener('click', () => apply(btn.getAttribute('data-lang-btn')));
    });
    apply(detect());
  });
})();
