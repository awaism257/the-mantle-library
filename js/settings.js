/* Mantle Library — theme & display (per-script font scaling) settings.
   Vanilla, no dependencies. Works on index.html, privacy.html and
   support.html.

   Theme: dark (default) / light, persisted in localStorage, honouring
   prefers-color-scheme on first visit. Light mode = html.light class.

   Font scaling: --fs-ar / --fs-en (70–160%, default 100%),
   persisted in localStorage and applied to the root element.

   The Settings PAGE (#/settings, rendered by app.js) drives everything
   through the window.MantleSettings API below — the app bar carries no
   theme button; the saved theme simply applies on every page. */
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

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  /* ------------------------------------------------------------------ theme */

  function currentTheme() {
    var saved = safeGet(LS_THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  function notifyNativeTheme(isDark) {
    if (window.AndroidBridge && typeof window.AndroidBridge.onThemeChanged === 'function') {
      try { window.AndroidBridge.onThemeChanged(isDark); } catch (e) { /* ignore */ }
    }
  }

  function applyTheme(theme) {
    var isLight = theme === 'light';
    root.classList.toggle('light', isLight);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isLight ? '#f6f0e0' : '#101613');
    notifyNativeTheme(!isLight);
  }

  function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    safeSet(LS_THEME, theme);
    applyTheme(theme);
  }

  // Apply immediately so the first paint already uses the right theme.
  applyTheme(currentTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      notifyNativeTheme(currentTheme() !== 'light');
    });
  } else {
    notifyNativeTheme(currentTheme() !== 'light');
  }

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

  /* ------------------------------------------------ translation layers */

  var LS_TRANSLATION = 'mantle-translation-layers';
  var DEFAULT_TRANSLATION = {
    modern: 'direct',
    victorian: 'dropdown'
  };
  var translationDisplay = {
    modern: DEFAULT_TRANSLATION.modern,
    victorian: DEFAULT_TRANSLATION.victorian
  };
  try {
    var savedT = JSON.parse(safeGet(LS_TRANSLATION) || '{}');
    if (savedT.modern) translationDisplay.modern = savedT.modern;
    if (savedT.victorian) translationDisplay.victorian = savedT.victorian;
  } catch (e) {}

  function saveTranslationDisplay() {
    safeSet(LS_TRANSLATION, JSON.stringify(translationDisplay));
  }

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
    setTheme: setTheme,
    getTranslationDisplay: function () {
      return { modern: translationDisplay.modern, victorian: translationDisplay.victorian };
    },
    setTranslationLayer: function (layer, mode) {
      if (layer === 'modern' || layer === 'victorian') {
        translationDisplay[layer] = mode;
        saveTranslationDisplay();
      }
    }
  };
})();
