/* The Mantle Library — single-page app: hash router, library view, work index
   view, section reader view, settings view, and an album-tile grid whose
   tiles open a recording detail sheet with the player. All data is fetched
   from the bundled content/works.json (works offline via sw.js). */
(function () {
  'use strict';

  var appEl = document.getElementById('app');
  var mainEl = document.getElementById('main');

  var state = {
    works: null,        // array of work objects once loaded
    loadError: null     // error message string if fetch failed
  };

  /* ---------------------------------------------------------------- helpers */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'text') {
          node.textContent = attrs[key];
        } else if (key === 'html') {
          node.innerHTML = attrs[key];
        } else {
          node.setAttribute(key, attrs[key]);
        }
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  function toArabicNum(n) {
    return String(n).split('').map(function (d) {
      return /[0-9]/.test(d) ? AR_DIGITS[+d] : d;
    }).join('');
  }

  function clearView() {
    while (appEl.firstChild) appEl.removeChild(appEl.firstChild);
  }

  function setNavCurrent(name) {
    var links = document.querySelectorAll('.nav-link[data-nav]');
    links.forEach(function (link) {
      if (link.getAttribute('data-nav') === name) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function hasAudio(work) {
    return Array.isArray(work.audio) && work.audio.length > 0;
  }

  function findWork(works, id) {
    for (var i = 0; i < works.length; i++) {
      if (works[i].id === id) return works[i];
    }
    return null;
  }

  function showError(message) {
    clearView();
    appEl.appendChild(el('div', { class: 'error-box', role: 'alert' }, [
      el('p', { html: '<strong>The library could not be loaded.</strong>' }),
      el('p', { text: message }),
      el('p', { text: 'If you opened this file directly (file://), please serve the folder over HTTP — e.g. deploy it to Netlify — so the bundled content file can be fetched.' })
    ]));
  }

  function showNotFound(what) {
    appEl.appendChild(el('div', { class: 'error-box' }, [
      el('p', { html: '<strong>' + what + ' not found.</strong>' }),
      el('p', {}, [el('a', { href: '#/', text: 'Back to the library' })])
    ]));
  }

  /* ------------------------------------------------------------ data loading */

  function loadWorks() {
    if (state.works) return Promise.resolve(state.works);
    return fetch('content/works.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' while fetching content/works.json');
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.works)) {
          throw new Error('content/works.json has an unexpected shape (missing "works" array).');
        }
        state.works = data.works;
        return state.works;
      })
      .catch(function (err) {
        state.loadError = err.message || String(err);
        showError(state.loadError);
        return null;
      });
  }

  /* --------------------------------------------------------------- home view */

  /* App-style menu rows: circular icon left, bold title + subtitle, chevron
     right — the same pattern the sibling apps (JustQuran, Munajaat Maqbool)
     use on their home screens. */
  var ROW_ICONS = {
    'dalail-al-khayrat': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    'banat-suad': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8L2 22"/><path d="M17.5 15H9"/></svg>',
    'tala-al-badru': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="11" r="7.5"/><path d="M9.5 8.5h.01"/><path d="M14.5 10h.01"/><path d="M10 13.5h.01"/><path d="M4 21h16"/></svg>',
    'hassan-poems': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
    'qasidat-al-burdah': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4c-2.8 0-4.6 1.2-5.8 3L3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2l-3.2-12C16.6 5.2 14.8 4 12 4z"/><path d="M9.2 6.5c.8 1 1.7 1.5 2.8 1.5s2-.5 2.8-1.5"/><path d="M12 8v13"/></svg>',
    'about': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    'settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  };

  function rowIcon(id) {
    return ROW_ICONS[id] || ROW_ICONS['dalail-al-khayrat'];
  }

  /* In-column page header — the pattern used on the sibling apps' home
     screens (Munajaat Maqbool, JustQuran): round logo + large serif title
     with circular icon buttons at the right of the row, a small italic
     gold subtitle, and a thin accent rule beneath (rule drawn in CSS). */
  function buildHomeHeader() {
    return el('header', { class: 'view-header' }, [
      el('div', { class: 'view-header-row' }, [
        el('img', {
          class: 'view-header-logo',
          src: 'icons/icon-192.png',
          alt: '',
          width: '44',
          height: '44'
        }),
        el('h1', { class: 'view-header-title', text: 'The Mantle Library' }),
        el('div', { class: 'view-header-actions' }, [
          el('a', {
            class: 'icon-btn',
            href: 'support.html',
            'aria-label': 'About and support',
            title: 'About & support',
            html: ROW_ICONS.about
          }),
          el('a', {
            class: 'icon-btn',
            href: '#/settings',
            'aria-label': 'Settings',
            title: 'Settings',
            html: ROW_ICONS.settings
          })
        ])
      ]),
      el('p', { class: 'view-header-sub', text: 'Qasidas · historic recordings' })
    ]);
  }

  /* Works are presented as full-width menu rows — circular accent-ringed icon
     left, English title with the Arabic title beneath, gold chevron right —
     the same list language as the About/Settings rows in the sibling apps. */
  /* Split a title like "Name (Gloss)" so the bracketed translation is
     always rendered on its own line beneath the main title. */
  function splitTitleGloss(titleEn) {
    var paren = titleEn.indexOf(' (');
    if (paren > 0) return { main: titleEn.slice(0, paren), gloss: titleEn.slice(paren + 1) };
    return { main: titleEn, gloss: null };
  }

  function buildWorkRow(work) {
    var t = splitTitleGloss(work.title_en);
    var title = t.main, gloss = t.gloss;
    var textKids = [el('span', { class: 'menu-row-title', text: title })];
    if (gloss) textKids.push(el('span', { class: 'menu-row-gloss', text: gloss }));
    textKids.push(el('span', { class: 'menu-row-sub', lang: 'ar', dir: 'rtl', text: work.title_ar }));
    return el('li', { class: 'menu-row' }, [
      el('a', {
        class: 'menu-row-link',
        href: '#/work/' + encodeURIComponent(work.id)
      }, [
        el('span', { class: 'menu-row-icon', html: rowIcon(work.id) }),
        el('span', { class: 'menu-row-text' }, textKids),
        el('span', { class: 'menu-row-chevron', 'aria-hidden': 'true', text: '›' })
      ])
    ]);
  }

  /* --------------------------------------------- recording tiles & detail sheet */

  function buildRecordingTile(rec) {
    var btn = el('button', {
      class: 'tile-button',
      type: 'button',
      'aria-label': 'About this recording: ' + rec.artist + ' — ' + rec.title
    }, [
      el('img', {
        class: 'tile-art',
        src: rec.art,
        alt: '',
        loading: 'lazy'
      }),
      el('span', { class: 'tile-artist', text: rec.artist }),
      el('span', { class: 'tile-title', text: rec.title })
    ]);
    btn.addEventListener('click', function () {
      openRecordingOverlay(rec, btn);
    });
    return el('li', { class: 'tile' }, [btn]);
  }

  var recOverlay = null;            // open recording sheet (null when closed)
  var recOverlayReturnFocus = null; // element to refocus on close

  function closeRecOverlay() {
    if (!recOverlay) return;
    document.removeEventListener('keydown', onRecOverlayKeydown);
    // Stop any playing audio before removing the sheet.
    var player = recOverlay.querySelector('audio');
    if (player) player.pause();
    if (recOverlay.parentNode) recOverlay.parentNode.removeChild(recOverlay);
    recOverlay = null;
    if (recOverlayReturnFocus && recOverlayReturnFocus.focus) {
      recOverlayReturnFocus.focus();
    }
    recOverlayReturnFocus = null;
  }

  function onRecOverlayKeydown(event) {
    // Let an open label-zoom overlay handle Escape first.
    if ((event.key === 'Escape' || event.key === 'Esc') && !artOverlay) {
      event.preventDefault();
      closeRecOverlay();
    }
  }

  function openRecordingOverlay(rec, trigger) {
    closeRecOverlay();
    recOverlayReturnFocus = trigger || null;

    var closeBtn = el('button', {
      class: 'rec-dialog-close',
      type: 'button',
      'aria-label': 'Close recording details',
      text: '×'
    });

    var children = [closeBtn];

    if (rec.art) {
      var artBtn = el('button', {
        class: 'rec-dialog-art',
        type: 'button',
        'aria-label': 'View full disc label: ' + rec.title
      }, [
        el('img', { src: rec.art, alt: 'Disc label: ' + rec.title })
      ]);
      artBtn.addEventListener('click', function () {
        openArtOverlay(rec.art, rec.title, artBtn);
      });
      children.push(artBtn);
    }

    children.push(el('h2', { class: 'rec-dialog-artist', text: rec.artist }));
    children.push(el('p', { class: 'rec-dialog-title', text: rec.title }));
    children.push(el('p', {
      class: 'rec-dialog-meta',
      text: (rec.date || '') + (rec.date && rec.label ? ' · ' : '') + (rec.label || '')
    }));
    if (rec.description) {
      children.push(el('p', { class: 'rec-dialog-desc', text: rec.description }));
    }
    if (rec.note) {
      children.push(el('p', { class: 'rec-dialog-note', text: rec.note }));
    }

    var player = el('audio', { controls: '', preload: 'none', src: rec.file });
    player.appendChild(document.createTextNode(
      'Your browser does not support the audio element. The recording "' + rec.title + '" cannot be played.'
    ));
    children.push(player);

    // Identified text and translation (verse cards, like the reader view).
    if (rec.text && Array.isArray(rec.text.sections) && rec.text.sections.length) {
      var textBody = [];
      if (rec.text.source) {
        textBody.push(el('p', { class: 'rec-text-source', text: rec.text.source }));
      }
      rec.text.sections.forEach(function (grp) {
        if (grp.heading) {
          textBody.push(el('h3', { class: 'rec-text-heading', text: grp.heading }));
        }
        buildUnitNodes(grp).forEach(function (node) { textBody.push(node); });
      });
      if (rec.text.translation_credit) {
        textBody.push(el('p', { class: 'rec-text-credit', text: rec.text.translation_credit }));
      }
      children.push(el('details', { class: 'rec-text' }, [
        el('summary', { class: 'rec-text-summary', text: rec.text.title || 'Text and translation' }),
        el('div', { class: 'rec-text-body' }, textBody)
      ]));
    }

    if (rec.credit) {
      children.push(el('p', { class: 'rec-dialog-credit', text: rec.credit }));
    }

    var dialog = el('div', {
      class: 'rec-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': rec.artist + ' — ' + rec.title
    }, children);

    recOverlay = el('div', { class: 'art-overlay' }, [dialog]);
    // Backdrop click (or the close button) dismisses the sheet.
    recOverlay.addEventListener('click', function (event) {
      if (event.target === recOverlay || event.target === closeBtn) {
        closeRecOverlay();
      }
    });
    document.addEventListener('keydown', onRecOverlayKeydown);
    document.body.appendChild(recOverlay);
    closeBtn.focus();
  }

  function renderHome() {
    setNavCurrent('home');
    document.title = 'The Mantle Library';
    clearView();

    // In-column page header (logo + title + actions + subtitle + rule).
    appEl.appendChild(buildHomeHeader());

    // Main works as full-width menu rows.
    var workRows = el('ul', { class: 'menu-rows', id: 'work-rows' });
    appEl.appendChild(workRows);

    // Media section: recordings grouped by genre, as tile grids.
    var GENRES = [
      { key: 'quran',   label: "Qur'anic recitation & prayer chant" },
      { key: 'qasida',  label: 'Qasidas & madih' },
      { key: 'tawshih', label: 'Tawshīḥ & Sufi chant' }
    ];

    var mediaSection = el('section', { class: 'audio-block home-media', 'aria-labelledby': 'home-media-heading' }, [
      el('h2', { id: 'home-media-heading', text: 'Historic Recordings' }),
      el('p', { class: 'media-sub',
        text: 'Public-domain 78rpm discs from 1901–1921 — tap a disc to read about it and play it.' })
    ]);
    var genreLists = {};
    GENRES.forEach(function (genre) {
      var list = el('ul', { class: 'tile-grid' });
      var group = el('div', { class: 'genre-group', hidden: '' }, [
        el('h3', { class: 'genre-heading', text: genre.label }),
        list
      ]);
      genreLists[genre.key] = { group: group, list: list };
      mediaSection.appendChild(group);
    });
    appEl.appendChild(mediaSection);

    loadWorks().then(function (works) {
      if (!works) return;
      works.forEach(function (work) {
        if (hasAudio(work)) {
          // audio collections are listed as media tiles, grouped by genre
          work.audio.forEach(function (rec) {
            var bucket = genreLists[rec.genre] || genreLists.qasida;
            bucket.list.appendChild(buildRecordingTile(rec));
          });
        } else {
          workRows.appendChild(buildWorkRow(work));
        }
      });
      GENRES.forEach(function (genre) {
        var bucket = genreLists[genre.key];
        if (bucket.list.firstChild) { bucket.group.removeAttribute('hidden'); }
      });
      if (!mediaSection.querySelector('.genre-group:not([hidden])')) {
        mediaSection.setAttribute('hidden', '');
      }
    });
  }

  /* --------------------------------------------------- disc label overlay */

  var artOverlay = null;            // open overlay element (null when closed)
  var artOverlayReturnFocus = null; // element to refocus on close

  function closeArtOverlay() {
    if (!artOverlay) return;
    document.removeEventListener('keydown', onArtOverlayKeydown);
    if (artOverlay.parentNode) artOverlay.parentNode.removeChild(artOverlay);
    artOverlay = null;
    if (artOverlayReturnFocus && artOverlayReturnFocus.focus) {
      artOverlayReturnFocus.focus();
    }
    artOverlayReturnFocus = null;
  }

  function onArtOverlayKeydown(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeArtOverlay();
    }
  }

  function openArtOverlay(src, title, trigger) {
    closeArtOverlay();
    artOverlayReturnFocus = trigger || null;
    var label = 'Disc label: ' + title;
    var closeBtn = el('button', {
      class: 'art-overlay-close',
      type: 'button',
      'aria-label': 'Close disc label viewer',
      text: '×'
    });
    artOverlay = el('div', {
      class: 'art-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': label
    }, [
      el('img', { class: 'art-overlay-img', src: src, alt: label }),
      closeBtn
    ]);
    // Backdrop click (or the close button) dismisses the overlay.
    artOverlay.addEventListener('click', function (event) {
      if (event.target === artOverlay || event.target === closeBtn) {
        closeArtOverlay();
      }
    });
    document.addEventListener('keydown', onArtOverlayKeydown);
    document.body.appendChild(artOverlay);
    closeBtn.focus();
  }

  /* -------------------------------------------------- shared content builders */

  /* Render one section's units as individual verse cards — each card holds
     its number medallion, a copy button, the Arabic, and the translation
     (or a pending note), like the Munajaat Maqbool reader. */
  function copyText(text, done) {
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* unsupported */ }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
    } else {
      legacy();
    }
  }

  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6L9 17l-5-5"/></svg>';

  function buildUnitNodes(section) {
    var nodes = [];
    var units = Array.isArray(section.units) ? section.units : [];
    units.forEach(function (unit, idx) {
      var num = unit.n != null ? unit.n : idx + 1;

      var copyBtn = el('button', {
        class: 'verse-copy icon-btn',
        type: 'button',
        'aria-label': 'Copy verse ' + num + ' (Arabic and English)',
        title: 'Copy verse',
        html: ICON_COPY
      });
      copyBtn.addEventListener('click', function () {
        var text = unit.ar + (unit.en ? '\n\n' + unit.en : '') + (unit.en2 ? '\n\n' + unit.en2 : '');
        copyText(text, function (ok) {
          if (!ok) return;
          copyBtn.classList.add('is-copied');
          copyBtn.innerHTML = ICON_CHECK;
          copyBtn.setAttribute('aria-label', 'Verse ' + num + ' copied');
          setTimeout(function () {
            copyBtn.classList.remove('is-copied');
            copyBtn.innerHTML = ICON_COPY;
            copyBtn.setAttribute('aria-label', 'Copy verse ' + num + ' (Arabic and English)');
          }, 1400);
        });
      });

      var arChildren = [document.createTextNode(unit.ar)];
      if (unit.n != null) {
        arChildren.push(el('span', { class: 'verse-num', text: ' ' + toArabicNum(unit.n) }));
      }

      var cardChildren = [
        el('div', { class: 'verse-card-head' }, [
          el('span', { class: 'verse-badge', text: String(num) }),
          copyBtn
        ]),
        el('p', { class: 'arabic-text', lang: 'ar', dir: 'rtl' }, arChildren)
      ];
      if (unit.en) {
        cardChildren.push(el('p', { class: 'translation', text: unit.en }));
        if (unit.en2) {
          cardChildren.push(el('p', { class: 'translation translation-modern' }, [
            el('span', { class: 'translation-modern-label', text: 'Modern rendering' }),
            document.createTextNode(unit.en2)
          ]));
        }
      } else {
        cardChildren.push(el('p', {
          class: 'translation-pending',
          text: 'English translation coming in a future update.'
        }));
      }
      nodes.push(el('section', { class: 'verse-card' }, cardChildren));
    });
    return nodes;
  }

  function unitCountLabel(section) {
    var units = Array.isArray(section.units) ? section.units : [];
    var numbered = units.some(function (u) { return u.n != null; });
    var noun = numbered ? 'verse' : 'passage';
    if (units.length !== 1) noun += 's';
    return units.length + ' ' + noun;
  }

  function workHeaderNodes(work) {
    var wt = splitTitleGloss(work.title_en);
    var titleKids = [document.createTextNode(wt.main)];
    if (wt.gloss) titleKids.push(el('span', { class: 'page-title-gloss', text: wt.gloss }));
    var nodes = [
      el('h1', { class: 'page-title' }, titleKids),
      el('p', { class: 'work-title-ar', lang: 'ar', dir: 'rtl', text: work.title_ar }),
      el('p', {
        class: 'work-author',
        text: work.author + (work.author_dates ? ' — ' + work.author_dates : '')
      })
    ];
    if (work.description_en) {
      nodes.push(el('p', { class: 'work-description', text: work.description_en }));
    }
    if (work.source_en) {
      nodes.push(el('p', { class: 'work-source' }, [
        el('strong', { text: 'Text source: ' }),
        document.createTextNode(work.source_en)
      ]));
    }
    return nodes;
  }

  /* ------------------------------------------- work index view (section list) */

  function renderWork(id) {
    setNavCurrent('home');
    clearView();

    loadWorks().then(function (works) {
      if (!works) return;
      var work = findWork(works, id);
      if (!work) {
        document.title = 'Not found — The Mantle Library';
        showNotFound('Work');
        return;
      }

      document.title = work.title_en + ' — The Mantle Library';

      appEl.appendChild(el('a', { class: 'back-link', href: '#/', text: '← Back to the library' }));
      appEl.appendChild(el('header', { class: 'work-header' }, workHeaderNodes(work)));

      var sections = Array.isArray(work.sections) ? work.sections : [];
      if (sections.length === 0) {
        appEl.appendChild(el('p', {
          class: 'notice',
          text: 'This collection lives on the home page — its recordings are listed there as tiles.'
        }));
        return;
      }

      // Munajaat-style index: one card per section.
      var list = el('ul', { class: 'section-index' });
      sections.forEach(function (section, i) {
        list.appendChild(el('li', {}, [
          el('a', {
            class: 'section-item-link',
            href: '#/work/' + encodeURIComponent(work.id) + '/section/' + i
          }, [
            el('span', { class: 'section-item-text' }, [
              el('span', { class: 'section-item-heading', text: section.heading }),
              el('span', { class: 'section-item-count', text: unitCountLabel(section) })
            ]),
            el('span', { class: 'section-item-chevron', 'aria-hidden': 'true', text: '›' })
          ])
        ]));
      });
      appEl.appendChild(list);
    });
  }

  /* ---------------------------------------------------------- section reader */

  function renderSection(workId, sectionIndex) {
    setNavCurrent('home');
    clearView();

    loadWorks().then(function (works) {
      if (!works) return;
      var work = findWork(works, workId);
      if (!work) {
        document.title = 'Not found — The Mantle Library';
        showNotFound('Work');
        return;
      }
      var sections = Array.isArray(work.sections) ? work.sections : [];
      var i = parseInt(sectionIndex, 10);
      if (String(i) !== String(sectionIndex) || i < 0 || i >= sections.length) {
        document.title = 'Not found — The Mantle Library';
        showNotFound('Section');
        return;
      }
      var section = sections[i];

      document.title = section.heading + ' — ' + work.title_en + ' — The Mantle Library';

      appEl.appendChild(el('a', {
        class: 'back-link',
        href: '#/work/' + encodeURIComponent(work.id),
        text: '← ' + work.title_en
      }));

      var st = splitTitleGloss(work.title_en);
      var secTitleKids = [document.createTextNode(st.main)];
      if (st.gloss) secTitleKids.push(el('span', { class: 'block-gloss', text: st.gloss }));
      var headerChildren = [
        el('h1', { class: 'page-title', text: section.heading }),
        el('p', { class: 'work-author' }, secTitleKids)
      ];
      if (section.note) {
        headerChildren.push(el('p', { class: 'work-description', text: section.note }));
      }
      appEl.appendChild(el('header', { class: 'work-header' }, headerChildren));

      appEl.appendChild(el('div', { class: 'verse-stack' }, buildUnitNodes(section)));

      // Previous / next navigation between sections.
      var workUrl = '#/work/' + encodeURIComponent(work.id) + '/section/';
      var prevNode, nextNode;
      if (i > 0) {
        prevNode = el('a', { class: 'section-nav-link', href: workUrl + (i - 1), rel: 'prev' }, [
          el('span', { class: 'section-nav-arrow', 'aria-hidden': 'true', text: '←' }),
          el('span', { class: 'section-nav-name', text: sections[i - 1].heading })
        ]);
      } else {
        prevNode = el('span', { class: 'section-nav-link is-disabled', 'aria-hidden': 'true' });
      }
      if (i < sections.length - 1) {
        nextNode = el('a', { class: 'section-nav-link next', href: workUrl + (i + 1), rel: 'next' }, [
          el('span', { class: 'section-nav-name', text: sections[i + 1].heading }),
          el('span', { class: 'section-nav-arrow', 'aria-hidden': 'true', text: '→' })
        ]);
      } else {
        nextNode = el('span', { class: 'section-nav-link is-disabled', 'aria-hidden': 'true' });
      }
      appEl.appendChild(el('nav', { class: 'section-nav', 'aria-label': 'Sections' }, [
        prevNode,
        el('span', { class: 'section-nav-pos', text: 'Section ' + (i + 1) + ' of ' + sections.length }),
        nextNode
      ]));
    });
  }

  /* ----------------------------------------------------------- settings view */

  function renderSettings() {
    setNavCurrent('settings');
    document.title = 'Settings — The Mantle Library';
    clearView();

    var settings = window.MantleSettings;

    appEl.appendChild(el('a', { class: 'back-link', href: '#/', text: '← Back to the library' }));
    appEl.appendChild(el('h1', { class: 'page-title', text: 'Settings' }));

    if (!settings) {
      appEl.appendChild(el('p', { class: 'notice', text: 'Settings are unavailable in this browser.' }));
      return;
    }

    // --- Text size sliders (persisted by settings.js) ---
    var sizeCard = el('section', { class: 'settings-card', 'aria-labelledby': 'settings-size-heading' }, [
      el('h2', { class: 'settings-heading', id: 'settings-size-heading', text: 'Text size' })
    ]);

    [{ key: 'ar', label: 'Arabic' }, { key: 'en', label: 'English' }].forEach(function (script) {
      var value = el('span', { class: 'fs-value', text: settings.getScale(script.key) + '%' });
      var slider = el('input', {
        type: 'range',
        min: String(settings.SCALE_MIN),
        max: String(settings.SCALE_MAX),
        step: '5',
        value: String(settings.getScale(script.key)),
        'aria-label': script.label + ' text size (percent)'
      });
      slider.addEventListener('input', function () {
        var v = parseInt(slider.value, 10);
        if (isNaN(v)) return;
        settings.setScale(script.key, v);
        value.textContent = v + '%';
      });
      sizeCard.appendChild(el('label', { class: 'fs-row' }, [
        el('span', { text: script.label }),
        slider,
        value
      ]));
    });
    appEl.appendChild(sizeCard);

    // --- Theme switch ---
    var darkBtn = el('button', { class: 'theme-choice', type: 'button', text: 'Dark' });
    var lightBtn = el('button', { class: 'theme-choice', type: 'button', text: 'Light' });

    function syncThemeButtons() {
      var isLight = settings.getTheme() === 'light';
      darkBtn.setAttribute('aria-pressed', String(!isLight));
      lightBtn.setAttribute('aria-pressed', String(isLight));
    }
    darkBtn.addEventListener('click', function () { settings.setTheme('dark'); syncThemeButtons(); });
    lightBtn.addEventListener('click', function () { settings.setTheme('light'); syncThemeButtons(); });
    syncThemeButtons();

    appEl.appendChild(el('section', { class: 'settings-card', 'aria-labelledby': 'settings-theme-heading' }, [
      el('h2', { class: 'settings-heading', id: 'settings-theme-heading', text: 'Theme' }),
      el('div', { class: 'theme-choices', role: 'group', 'aria-label': 'Theme' }, [darkBtn, lightBtn])
    ]));

    appEl.appendChild(el('p', {
      class: 'settings-note',
      text: 'Settings are stored on this device only.'
    }));
  }

  /* ------------------------------------------------------------------ router */

  function route() {
    closeArtOverlay();
    closeRecOverlay();
    var hash = window.location.hash || '#/';
    var path = hash.replace(/^#/, '');

    if (path === '/' || path === '') {
      renderHome();
    } else if (path.indexOf('/work/') === 0) {
      var rest = path.slice('/work/'.length);
      var slash = rest.indexOf('/section/');
      if (slash !== -1) {
        var workId = decodeURIComponent(rest.slice(0, slash));
        var sectionIndex = rest.slice(slash + '/section/'.length);
        renderSection(workId, sectionIndex);
      } else {
        renderWork(decodeURIComponent(rest));
      }
    } else if (path === '/settings') {
      renderSettings();
    } else {
      renderHome();
    }

    // Move focus to main for keyboard / screen-reader users on navigation.
    if (mainEl) mainEl.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  route();

  /* --------------------------------------------------------- service worker */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        // Registration failure is non-fatal: the app still works online.
        if (window.console && console.warn) {
          console.warn('Service worker registration failed:', err);
        }
      });
    });
  }
})();
