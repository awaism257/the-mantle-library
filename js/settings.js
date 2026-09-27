/* The Mantle Library — theme toggle & display (per-script font scaling).
   Vanilla, no dependencies. Works on index.html and privacy.html:
   it injects its controls into the shared .site-nav header.

   Theme: dark (default) / light, persisted in localStorage, honouring
   prefers-color-scheme on first visit. Light mode = html.light class.

   Font scaling: --fs-ar / --fs-en (70–160%, default 100%),
   persisted in localStorage and applied to the root element. */
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
    var nav = document.querySelector('.site-nav');
    if (!nav) return;

    var tools = el('span', { class: 'header-tools' });

    // Display (font scaling) toggle + panel
    var displayButton = el('button', {
      type: 'button',
      class: 'tool-button',
      id: 'display-toggle',
      'aria-expanded': 'false',
      'aria-controls': 'display-panel',
      'aria-label': 'Display settings: text size for Arabic and English',
      title: 'Display settings'
    }, '<span aria-hidden="true" style="font-weight:bold;">Aa</span>' +
       '<span class="tool-text" aria-hidden="true">Display</span>');

    // Theme toggle
    themeButton = el('button', { type: 'button', class: 'tool-button', id: 'theme-toggle' });
    themeButton.addEventListener('click', function () {
      var next = root.classList.contains('light') ? 'dark' : 'light';
      safeSet(LS_THEME, next);
      applyTheme(next);
    });

    tools.appendChild(displayButton);
    tools.appendChild(themeButton);
    nav.appendChild(tools);
    applyTheme(currentTheme()); // refresh the button label/icon

    // Display panel with the two sliders
    var panel = el('div', {
      class: 'display-panel',
      id: 'display-panel',
      role: 'group',
      'aria-label': 'Text size settings',
      hidden: ''
    });
    panel.appendChild(el('p', { class: 'display-panel-title' }, 'Text size'));

    SCRIPTS.forEach(function (s) {
      var row = el('label', { class: 'fs-row' });
      row.appendChild(el('span', {}, s.label));
      var slider = el('input', {
        type: 'range',
        min: String(SCALE_MIN),
        max: String(SCALE_MAX),
        step: '5',
        value: String(scale[s.key]),
        'data-script': s.key,
        'aria-label': s.label + ' text size (percent)'
      });
      var value = el('span', { class: 'fs-value' }, scale[s.key] + '%');
      slider.addEventListener('input', function () {
        var v = parseInt(slider.value, 10);
        if (isNaN(v)) return;
        scale[s.key] = v;
        value.textContent = v + '%';
        applyScale();
        saveScale();
      });
      row.appendChild(slider);
      row.appendChild(value);
      panel.appendChild(row);
    });

    var header = document.querySelector('.site-header') || nav.parentNode;
    header.appendChild(panel);

    function closePanel() {
      panel.setAttribute('hidden', '');
      displayButton.setAttribute('aria-expanded', 'false');
    }
    function openPanel() {
      panel.removeAttribute('hidden');
      displayButton.setAttribute('aria-expanded', 'true');
    }

    displayButton.addEventListener('click', function () {
      if (panel.hasAttribute('hidden')) openPanel(); else closePanel();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hasAttribute('hidden')) {
        closePanel();
        displayButton.focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (panel.hasAttribute('hidden')) return;
      if (!panel.contains(event.target) && !displayButton.contains(event.target)) {
        closePanel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildTools);
  } else {
    buildTools();
  }
})();
