/* The Mantle Library — theme & display (per-script font scaling) settings.
   Vanilla, no dependencies. Works on index.html and privacy.html.

   Theme: dark (default) / light, persisted in localStorage, honouring
   prefers-color-scheme on first visit. Light mode = html.light class.

   Font scaling: --fs-ar / --fs-en (70–160%, default 100%),
   persisted in localStorage and applied to the root element.

   The Settings PAGE (#/settings, rendered by app.js) drives everything
   through the window.MantleSettings API below; the app bar carries only
   a compact theme toggle button. */
(function () {
  'use strict';

  var LS_THEME = 'mantle-theme';
  var LS_SCALE = 'mantle-font-scale';

  var SCALE_MIN = 70;
  var SCALE_MAX = 160;
  var SCALE_DEFAULT = 100;
  var SCRIPTS = [
    { key: 'ar', label: 'Arabic' },
    { key: 'en', label: 'English' }
  ];

  var root = document.documentElement;

  var ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="4.2" fill="currentColor"/>' +
    '<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
    '<path d="M12 2.6v2.6"/><path d="M12 18.8v2.6"/>' +
    '<path d="M2.6 12h2.6"/><path d="M18.8 12h2.6"/>' +
    '<path d="M5.3 5.3l1.8 1.8"/><path d="M16.9 16.9l1.8 1.8"/>' +
    '<path d="M18.7 5.3l-1.8 1.8"/><path d="M7.1 16.9l-1.8 1.8"/>' +
    '</g></svg>';

  var ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M20.2 13.4A8.3 8.3 0 0 1 10.6 3.8 8.4 8.4 0 1 0 20.2 13.4Z"/>' +
    '</svg>';

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  /* ------------------------------------------------------------------ theme */

  var themeButton = null;

  function currentTheme() {
    var saved = safeGet(LS_THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  function applyTheme(theme) {
    root.classList.toggle('light', theme === 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f3ecd8' : '#101613');
    if (themeButton) {
      var toLight = theme !== 'light';
      themeButton.setAttribute('aria-label', toLight ? 'Switch to light theme' : 'Switch to dark theme');
      themeButton.setAttribute('title', toLight ? 'Switch to light theme' : 'Switch to dark theme');
      themeButton.innerHTML = (toLight ? ICON_SUN : ICON_MOON) +
        '<span class="tool-text" aria-hidden="true">' + (toLight ? 'Light' : 'Dark') + '</span>';
    }
  }

  function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    safeSet(LS_THEME, theme);
    applyTheme(theme);
  }

  // Apply immediately so the first paint already uses the right theme.
  applyTheme(currentTheme());

  /* ------------------------------------------------------------ font scaling */

  var scale = { ar: SCALE_DEFAULT, en: SCALE_DEFAULT };
  try {
    var savedScale = JSON.parse(safeGet(LS_SCALE) || '{}');
    SCRIPTS.forEach(function (s) {
      var v = parseInt(savedScale[s.key], 10);
      if (!isNaN(v)) {
        scale[s.key] = Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
      }
    });
    // Clean legacy entries (e.g. the removed Urdu slider) from storage.
    if (Object.keys(savedScale).some(function (k) {
      return !SCRIPTS.some(function (s) { return s.key === k; });
    })) {
      safeSet(LS_SCALE, JSON.stringify(scale));
    }
  } catch (e) { /* corrupted value — fall back to defaults */ }

  function applyScale() {
    root.style.setProperty('--fs-ar', String(scale.ar / 100));
    root.style.setProperty('--fs-en', String(scale.en / 100));
  }

  function saveScale() {
    safeSet(LS_SCALE, JSON.stringify(scale));
  }

  // Apply immediately so content renders at the saved size on first paint.
  applyScale();

  /* ------------------------------------------------ public API (Settings page) */

  window.MantleSettings = {
    SCALE_MIN: SCALE_MIN,
    SCALE_MAX: SCALE_MAX,
    getScale: function (script) { return scale[script] != null ? scale[script] : SCALE_DEFAULT; },
    setScale: function (script, value) {
      var v = parseInt(value, 10);
      if (isNaN(v)) return;
      scale[script] = Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
      applyScale();
      saveScale();
    },
    getTheme: function () { return root.classList.contains('light') ? 'light' : 'dark'; },
    setTheme: setTheme
  };

  /* ------------------------------------------------------------ header tools */

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function buildTools() {
    var nav = document.querySelector('.app-bar-actions') || document.querySelector('.site-nav');
    if (!nav) return;

    var tools = el('span', { class: 'header-tools' });

    // Theme toggle (text size lives on the Settings page now)
    themeButton = el('button', { type: 'button', class: 'tool-button', id: 'theme-toggle' });
    themeButton.addEventListener('click', function () {
      var next = root.classList.contains('light') ? 'dark' : 'light';
      safeSet(LS_THEME, next);
      applyTheme(next);
    });

    tools.appendChild(themeButton);
    nav.appendChild(tools);
    applyTheme(currentTheme()); // refresh the button label/icon
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildTools);
  } else {
    buildTools();
  }
})();
