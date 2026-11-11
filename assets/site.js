/* Quiet interactions: theme, nav, copy email. No scroll-driven animation. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');

  /* ---- light / dark theme ---- */
  var themeBtn = document.querySelector('.theme-toggle');
  var meta = document.querySelector('meta[name="theme-color"]');
  var applyTheme = function (t, save) {
    doc.setAttribute('data-theme', t);
    if (save) { try { localStorage.setItem('theme', t); } catch (e) {} }
    if (meta) meta.setAttribute('content', t === 'dark' ? '#161D23' : '#F4F3EF');
    if (themeBtn) {
      var next = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      themeBtn.setAttribute('aria-label', next);
      themeBtn.setAttribute('title', next);
      themeBtn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    }
  };
  applyTheme(doc.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
  if (themeBtn) themeBtn.addEventListener('click', function () {
    applyTheme(doc.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  });
  /* follow the system setting until the visitor picks a theme themselves */
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var follow = function (e) {
      var stored = null; try { stored = localStorage.getItem('theme'); } catch (x) {}
      if (!stored) applyTheme(e.matches ? 'dark' : 'light', false);
    };
    if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow);
  } catch (e) {}

  /* ---- navigation ---- */
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav__toggle');
  if (nav && toggle) {
    var setOpen = function (open) {
      nav.setAttribute('data-open', open ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Close' : 'Menu';
    };
    toggle.addEventListener('click', function () { setOpen(nav.getAttribute('data-open') !== 'true'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    nav.querySelectorAll('.nav__links a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  }

  /* ---- copy email ---- */
  var copyBtn = document.getElementById('copy-email-btn');
  var copyText = document.getElementById('copy-email-text');
  if (copyBtn && copyText) {
    var email = copyBtn.getAttribute('data-email');
    var done = function () {
      var original = copyText.textContent;
      copyText.textContent = 'Copied to clipboard';
      copyText.classList.add('copied');
      setTimeout(function () { copyText.textContent = original; copyText.classList.remove('copied'); }, 2400);
    };
    var fallback = function () {
      var t = document.createElement('textarea');
      t.value = email; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(t);
    };
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, fallback);
      } else { fallback(); }
    });
  }
})();
