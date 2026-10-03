/* Mantle Library — single-page app: hash router, library view, work index
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

  var currentReaderAudio = null;
  var currentReaderCleanup = null;
  var currentBookCleanup = null;

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function clearView() {
    if (currentReaderAudio) {
      currentReaderAudio.pause();
      currentReaderAudio = null;
    }
    if (typeof currentReaderCleanup === 'function') {
      currentReaderCleanup();
      currentReaderCleanup = null;
    }
    window.MantleReaderPlayer = null;
    if (typeof currentBookCleanup === 'function') {
      currentBookCleanup();
      currentBookCleanup = null;
    }
    window.MantleBook = null;
    appEl.classList.remove('is-book');
    // Tell the native shell the paged reader is closed and nothing is playing.
    nativeCall('onReaderState', false);
    nativeCall('onAudioState', false);
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
        buildDesktopSidebar(state.works);
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
    'al-sirah-al-nabawiyyah': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2v3"/><path d="M12 5c-3.5 0-6 3-6 6.5V20h12v-8.5C18 8 15.5 5 12 5z"/><path d="M3 20h18"/><path d="M10 20v-5a2 2 0 0 1 4 0v5"/><circle cx="12" cy="2" r="0.5" fill="currentColor"/></svg>',
    'banat-suad': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8L2 22"/><path d="M17.5 15H9"/></svg>',
    'tala-al-badru': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="11" r="7.5"/><path d="M9.5 8.5h.01"/><path d="M14.5 10h.01"/><path d="M10 13.5h.01"/><path d="M4 21h16"/></svg>',
    'hassan-poems': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
    'qasidat-al-burdah': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4c-2.8 0-4.6 1.2-5.8 3L3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2l-3.2-12C16.6 5.2 14.8 4 12 4z"/><path d="M9.2 6.5c.8 1 1.7 1.5 2.8 1.5s2-.5 2.8-1.5"/><path d="M12 8v13"/></svg>',
    'mishkat-matthews-vol1': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'historic-recordings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M19 4l-4 4-2-1"/></svg>',
    'about': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    'settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    'home': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'back': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>'
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
        el('h1', { class: 'view-header-title', text: 'Mantle Library' }),
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

  /* Sub-view navigation bar: clean icon buttons (Home / Back on left,
     title in center, Settings on right) matching Munajaat Maqbool's sticky topbar. */
  function buildSubNavBar(backHref, backLabel, title, showHome, showSettings) {
    if (typeof title === 'boolean') {
      showSettings = showHome;
      showHome = title;
      title = null;
    }
    var leftKids = [];
    if (backHref) {
      leftKids.push(el('a', {
        class: 'icon-btn nav-back-btn',
        href: backHref,
        'aria-label': backLabel || 'Back',
        title: backLabel || 'Back',
        html: ROW_ICONS.back
      }));
    }
    if (showHome !== false) {
      leftKids.push(el('a', {
        class: 'icon-btn nav-home-btn',
        href: '#/',
        'aria-label': 'Home — Back to Library',
        title: 'Home',
        html: ROW_ICONS.home
      }));
    }
    var midKids = [];
    if (title) {
      midKids.push(el('div', { class: 'sub-nav-title', text: title }));
    }
    var rightKids = [];
    if (showSettings !== false) {
      rightKids.push(el('a', {
        class: 'icon-btn nav-settings-btn',
        href: '#/settings',
        'aria-label': 'Settings',
        title: 'Settings',
        html: ROW_ICONS.settings
      }));
    }
    return el('nav', { class: 'sub-nav-bar', 'aria-label': 'View navigation' }, [
      el('div', { class: 'sub-nav-left' }, leftKids),
      el('div', { class: 'sub-nav-center' }, midKids),
      el('div', { class: 'sub-nav-actions' }, rightKids)
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
    var colon = titleEn.indexOf(': ');
    if (colon > 0) return { main: titleEn.slice(0, colon), gloss: titleEn.slice(colon + 2) };
    return { main: titleEn, gloss: null };
  }

  function buildWorkRow(work) {
    var t = splitTitleGloss(work.title_en);
    var title = t.main, gloss = t.gloss;
    var textKids = [el('span', { class: 'menu-row-title', text: title })];
    if (gloss) textKids.push(el('span', { class: 'menu-row-gloss', text: gloss }));
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
    player.addEventListener('play', function () {
      if (artBtn) {
        artBtn.classList.remove('is-paused');
        artBtn.classList.add('is-playing');
      }
      updateMediaSession(player, {
        title: rec.title || 'Historic Recording',
        artist: (rec.artist || 'Acoustic 78rpm Collection') + (rec.year ? ' (' + rec.year + ')' : ''),
        album: rec.source || 'Historic Gramophone Archive (1901–1921)',
        artwork: [
          { src: rec.art || 'icons/icon-512.png', sizes: '512x512', type: 'image/jpeg' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    });
    player.addEventListener('pause', function () {
      if (artBtn) {
        artBtn.classList.remove('is-playing');
        artBtn.classList.add('is-paused');
      }
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
    player.addEventListener('ended', function () {
      if (artBtn) {
        artBtn.classList.remove('is-playing');
        artBtn.classList.remove('is-paused');
      }
    });
    player.addEventListener('timeupdate', function () {
      syncMediaSessionPosition(player);
    });
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
    document.title = 'Mantle Library';
    clearView();

    // In-column page header (logo + title + actions + subtitle + rule).
    appEl.appendChild(buildHomeHeader());

    // Sīrah landscape card (the narrated audiobook) at the very top under header
    var featuredCardContainer = el('div', { id: 'featured-card-container' });
    appEl.appendChild(featuredCardContainer);

    // Main works as full-width menu rows (2-column grid).
    var workRows = el('ul', { class: 'menu-rows', id: 'work-rows' });
    appEl.appendChild(workRows);

    // Landscape card container for the Historic Gramophone Archive
    var archiveCardContainer = el('div', { id: 'archive-card-container' });
    appEl.appendChild(archiveCardContainer);

    loadWorks().then(function (works) {
      if (!works) return;
      var archiveWork = null;
      var featuredWork = null;
      works.forEach(function (work) {
        if (work.id === 'historic-recordings' || hasAudio(work)) {
          archiveWork = work;
        } else if (work.featured) {
          featuredWork = work;
        } else {
          workRows.appendChild(buildWorkRow(work));
        }
      });
      if (featuredWork) {
        featuredCardContainer.appendChild(buildFeaturedCard(featuredWork));
      }
      if (archiveWork) {
        archiveCardContainer.appendChild(buildArchiveCard(archiveWork));
      }
    });
  }

  function buildFeaturedCard(work) {
    var t = splitTitleGloss(work.title_en);
    var href = '#/work/' + encodeURIComponent(work.id);
    return el('div', { class: 'archive-card featured-card' }, [
      el('a', {
        class: 'archive-card-link',
        href: href,
        'aria-label': work.title_en + ' — narrated audiobook in 12 chapters'
      }, [
        el('span', { class: 'archive-card-icon', html: rowIcon(work.id) }),
        el('span', { class: 'archive-card-text' }, [
          el('span', { class: 'featured-badge', text: 'Narrated Audiobook · 12 Chapters' }),
          el('span', { class: 'archive-card-title', text: t.main }),
          t.gloss ? el('span', { class: 'archive-card-gloss', text: t.gloss }) : null
        ]),
        el('span', { class: 'archive-card-chevron', 'aria-hidden': 'true', text: '›' })
      ])
    ]);
  }

  function buildArchiveCard(archiveWork) {
    var titleEn = (archiveWork && archiveWork.title_en) || 'Historic Gramophone Archive';
    var gloss = 'Rare 78rpm shellac collection (1901–1921) · Harvard Loeb';

    return el('div', { class: 'archive-card' }, [
      el('a', {
        class: 'archive-card-link',
        href: '#/archive',
        'aria-label': titleEn + ' — ' + gloss
      }, [
        el('span', { class: 'archive-card-icon', html: rowIcon('historic-recordings') }),
        el('span', { class: 'archive-card-text' }, [
          el('span', { class: 'archive-card-title', text: titleEn }),
          el('span', { class: 'archive-card-gloss', text: gloss })
        ]),
        el('span', { class: 'archive-card-chevron', 'aria-hidden': 'true', text: '›' })
      ])
    ]);
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

  /* ------------------------------------------- historic gramophone archive view */

  function renderArchive() {
    setNavCurrent('archive');
    document.title = 'Historic Gramophone Archive — Mantle Library';
    clearView();

    appEl.appendChild(buildSubNavBar('#/', 'Back to Library', 'Historic Recordings', true, true));

    loadWorks().then(function (works) {
      if (!works) return;
      var archiveWork = findWork(works, 'historic-recordings') || (works.filter(hasAudio)[0]);
      if (!archiveWork || !archiveWork.audio || archiveWork.audio.length === 0) {
        showNotFound('Archive');
        return;
      }

      var titleEn = archiveWork.title_en || 'Historic Gramophone Archive';
      var titleAr = archiveWork.title_ar || 'أَرْشِيفُ الغَرَامَفُون التَّارِيخِيُّ';

      // Page Header
      var header = el('header', { class: 'work-header archive-page-header' }, [
        el('h1', { class: 'page-title', text: titleEn }),
        el('p', { class: 'work-title-ar', lang: 'ar', dir: 'rtl', text: titleAr }),
        el('p', { class: 'work-author', text: 'Acoustic 78rpm Shellac Collection · 1901–1921' }),
        el('p', {
          class: 'work-description archive-page-intro',
          text: 'A curated treasury of the earliest surviving acoustic recordings of Islamic devotional arts, captured on 78rpm shellac discs in Kazan, Cairo, Beirut, and Paris. Restored and transferred from original discs courtesy of the Harvard Loeb Music Library Arabic 78 Collection and Excavated Shellac (Jonathan Ward).'
        })
      ]);
      appEl.appendChild(header);

      // Genre categories
      var GENRES = [
        { key: 'all',     label: 'All Recordings' },
        { key: 'quran',   label: "Qur'an & Prayer Chant" },
        { key: 'qasida',  label: 'Qasīdas & Madīḥ' },
        { key: 'tawshih', label: 'Tawshīḥ & Sufi Inshād' }
      ];

      var genreHeadingLabels = {
        quran: "Qur'anic Recitation & Prayer Chant (1901–1921)",
        qasida: "Classical Qasīdas & Madīḥ (1905–1920)",
        tawshih: "Tawshīḥ & Sufi Inshād (1905–1911)"
      };

      // Filter bar
      var filterBar = el('div', { class: 'archive-filter-bar', role: 'group', 'aria-label': 'Filter by genre' });

      // Groups container
      var groupsContainer = el('div', { class: 'archive-groups-container' });
      var genreGroupEls = {};

      ['quran', 'qasida', 'tawshih'].forEach(function (gKey) {
        var list = el('ul', { class: 'tile-grid' });
        var grp = el('section', { class: 'genre-group', 'data-genre': gKey }, [
          el('h2', { class: 'genre-heading', text: genreHeadingLabels[gKey] }),
          list
        ]);
        genreGroupEls[gKey] = { section: grp, list: list };
        groupsContainer.appendChild(grp);
      });

      // Populate tiles into genre buckets
      var counts = { all: archiveWork.audio.length, quran: 0, qasida: 0, tawshih: 0 };
      archiveWork.audio.forEach(function (rec) {
        var g = rec.genre || 'qasida';
        if (counts[g] != null) counts[g]++;
        var target = genreGroupEls[g] || genreGroupEls.qasida;
        target.list.appendChild(buildRecordingTile(rec));
      });

      function applyFilter(key) {
        var btns = filterBar.querySelectorAll('.archive-filter-btn');
        btns.forEach(function (b) {
          var isAct = b.getAttribute('data-genre') === key;
          b.classList.toggle('is-active', isAct);
          b.setAttribute('aria-pressed', String(isAct));
        });
        ['quran', 'qasida', 'tawshih'].forEach(function (gKey) {
          var sec = genreGroupEls[gKey].section;
          if (key === 'all' || key === gKey) {
            sec.removeAttribute('hidden');
          } else {
            sec.setAttribute('hidden', '');
          }
        });
      }

      GENRES.forEach(function (genre) {
        var count = counts[genre.key] || 0;
        var btn = el('button', {
          class: 'archive-filter-btn' + (genre.key === 'all' ? ' is-active' : ''),
          type: 'button',
          'data-genre': genre.key,
          'aria-pressed': String(genre.key === 'all'),
          text: genre.label + ' (' + count + ')'
        });
        btn.addEventListener('click', function () {
          applyFilter(genre.key);
        });
        filterBar.appendChild(btn);
      });

      appEl.appendChild(filterBar);
      appEl.appendChild(groupsContainer);

      // Provenance note
      var provenance = el('div', { class: 'archive-provenance-note' }, [
        el('p', {
          text: 'All recordings in this archive were published on commercial 78rpm shellac discs between 1901 and 1921 and reside in the public domain. Digital transfers are preserved for research, devotional contemplation, and educational preservation.'
        })
      ]);
      appEl.appendChild(provenance);
    });
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
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="15 18 9 12 15 6"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="9 18 15 12 9 6"/></svg>';
  var ICON_LOOP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';

  function updateMediaSession(audio, meta) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.title || 'Mantle Library',
        artist: meta.artist || 'Mantle Library',
        album: meta.album || 'The Mantle Library',
        artwork: meta.artwork || [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', function () {
        audio.play().catch(function () {});
      });
      navigator.mediaSession.setActionHandler('pause', function () {
        audio.pause();
      });
      if (meta.onPrev) {
        navigator.mediaSession.setActionHandler('previoustrack', meta.onPrev);
      } else {
        try { navigator.mediaSession.setActionHandler('previoustrack', null); } catch (e) {}
      }
      if (meta.onNext) {
        navigator.mediaSession.setActionHandler('nexttrack', meta.onNext);
      } else {
        try { navigator.mediaSession.setActionHandler('nexttrack', null); } catch (e) {}
      }
      try {
        navigator.mediaSession.setActionHandler('seekto', function (details) {
          if (details.seekTime !== undefined && details.seekTime !== null && !isNaN(details.seekTime)) {
            audio.currentTime = details.seekTime;
          }
        });
      } catch (e) {}
    } catch (e) {}
  }

  function syncMediaSessionPosition(audio) {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate || 1,
          position: Math.min(Math.max(0, audio.currentTime), audio.duration)
        });
      } catch (e) {}
    }
  }

  /* ---------- Native bridge helpers (silent no-ops on the web / PWA) ---------- */

  function nativeCall(name, arg) {
    try {
      var bridge = window.AndroidBridge;
      if (bridge && typeof bridge[name] === 'function') bridge[name](arg);
    } catch (e) {}
  }

  // Scroll-based readers use scrollIntoView; Book Mode pages by translating a
  // column strip, so it must be told to turn to the page instead.
  function revealCard(card, smooth, force) {
    if (!card) return;
    if (window.MantleBook && card.closest && card.closest('.book-viewport')) {
      window.MantleBook.reveal(card, 0, force !== false);
      return;
    }
    card.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }

  // Called by the native shell for Volume Down (+1 = next) / Volume Up (-1 = previous).
  window.mantleTurnPage = function (dir) {
    if (window.MantleBook && typeof window.MantleBook.turn === 'function') {
      return window.MantleBook.turn(dir > 0 ? 1 : -1);
    }
    return false;
  };

  /* ---------- Book Mode: paged reader (CSS multi-columns, one column per page) ----------
     Mirrors the JustQuran book reader: text flows into columns exactly one
     viewport wide; pages are turned by translating the strip, never by scrolling. */

  var BOOK_GAP = 32;

  function buildBookReader(section, sectionIndex, totalSections, work) {
    var workUrl = '#/work/' + encodeURIComponent(work.id) + '/section/';
    var story = Array.isArray(section.story) ? section.story : [];
    var arabic = Array.isArray(section.arabic) ? section.arabic : [];
    var victorian = Array.isArray(section.victorian) ? section.victorian : [];
    var hasAudioTrack = !!section.audio;

    // ---- English Story (JustQuran continuous flow with superscript markers) ----
    var storyPara = el('p', { class: 'book-en-flow' });
    story.forEach(function (text, idx) {
      var n = idx + 1;
      var span = el('span', { class: 'verse-run', id: 'verse-' + n });
      span.appendChild(document.createTextNode(text));

      var supBtn = el('button', {
        class: 'bkmark',
        type: 'button',
        'aria-label': 'Sentence ' + n,
        title: 'Play from sentence ' + n,
        text: String(n)
      });
      if (hasAudioTrack) {
        supBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.MantleReaderPlayer && window.MantleReaderPlayer.seekToVerse) {
            window.MantleReaderPlayer.seekToVerse(n);
          }
        });
        span.addEventListener('click', function () {
          if (window.MantleReaderPlayer && window.MantleReaderPlayer.seekToVerse) {
            window.MantleReaderPlayer.seekToVerse(n);
          }
        });
      }
      span.appendChild(document.createTextNode(' '));
      span.appendChild(supBtn);
      span.appendChild(document.createTextNode(' '));
      storyPara.appendChild(span);
    });

    var storyNodes = [storyPara];
    if (section.story_note) {
      storyNodes.push(el('p', { class: 'book-note', text: section.story_note }));
    } else if (section.note) {
      storyNodes.push(el('p', { class: 'book-note', text: section.note }));
    }
    storyNodes.push(el('p', {
      class: 'modern-layer-note book-note',
      text: 'Note: every “Modern simplification” simplifies the Victorian translation; it is not a new translation of the Arabic.'
    }));

    // ---- Classical Arabic (right-to-left pages) ----
    var arabicNodes = [];
    arabic.forEach(function (item) {
      var block = el('div', { class: 'book-passage' });
      block.appendChild(el('h3', { class: 'book-label', dir: 'ltr', text: item.label }));
      String(item.text).split(/\n\n+/).forEach(function (t) {
        block.appendChild(el('p', { class: 'book-ar', lang: 'ar', dir: 'rtl', text: t }));
      });
      if (item.ref) block.appendChild(el('p', { class: 'book-ref', dir: 'ltr', text: item.ref }));
      arabicNodes.push(block);
    });
    if (arabicNodes.length && section.arabic_note) {
      arabicNodes.push(el('p', { class: 'book-note', dir: 'ltr', text: section.arabic_note }));
    }

    // ---- Victorian Source (verbatim Rehatsek) ----
    var victorianNodes = [];
    if (victorian.length && section.victorian_note) {
      victorianNodes.push(el('p', { class: 'book-note', text: section.victorian_note }));
    }
    victorian.forEach(function (item) {
      var block = el('blockquote', { class: 'book-vic', lang: 'en' });
      String(item.text).split(/\n\n+/).forEach(function (t) {
        block.appendChild(el('p', { class: 'book-vic-text', text: t }));
      });
      if (item.ref) block.appendChild(el('p', { class: 'book-ref', text: '— Rehatsek, ' + item.ref }));
      victorianNodes.push(block);
    });

    var ICON_TAB_STORY = '<svg class="book-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
    var ICON_TAB_ARABIC = '<svg class="book-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="10" y1="8" x2="16" y2="8"/><line x1="9" y1="12" x2="16" y2="12"/></svg>';
    var ICON_TAB_VICTORIAN = '<svg class="book-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22h16"/><path d="M6 18v-9"/><path d="M10 18v-9"/><path d="M14 18v-9"/><path d="M18 18v-9"/><path d="M4 9h16L12 3z"/></svg>';

    var defs = [
      { key: 'story', label: 'English Story', icon: ICON_TAB_STORY, nodes: storyNodes, rtl: false },
      { key: 'arabic', label: 'Classical Arabic', icon: ICON_TAB_ARABIC, nodes: arabicNodes, rtl: true },
      { key: 'victorian', label: 'Victorian Source', icon: ICON_TAB_VICTORIAN, nodes: victorianNodes, rtl: false }
    ].filter(function (d) { return d.nodes.length > 0; });

    var panes = {};
    var order = [];
    var panesWrap = el('div', { class: 'book-panes' });
    defs.forEach(function (d) {
      var strip = el('div', { class: 'book-strip' + (d.rtl ? ' is-rtl' : '') }, d.nodes);
      if (d.rtl) strip.setAttribute('dir', 'rtl');
      var viewport = el('div', { class: 'book-viewport' }, [strip]);
      viewport.addEventListener('scroll', function () {
        if (viewport.scrollLeft !== 0) viewport.scrollLeft = 0;
        if (viewport.scrollTop !== 0) viewport.scrollTop = 0;
      });
      var paneEl = el('div', {
        class: 'book-pane',
        role: 'tabpanel',
        id: 'book-pane-' + d.key,
        'aria-label': d.label
      }, [viewport]);
      paneEl.hidden = true;
      var pane = { key: d.key, rtl: d.rtl, el: paneEl, viewport: viewport, strip: strip, page: 0, count: 1, w: 0 };
      panes[d.key] = pane;
      order.push(pane);
      panesWrap.appendChild(paneEl);
    });

    var activeKey = order.length ? order[0].key : null;
    var hold = false; // user turned the page by hand: don't yank it back mid-paragraph

    // ---- tabs + pager ----
    var tabs = el('div', { class: 'book-tabs', role: 'tablist', 'aria-label': 'Reading modes' });
    var tabBtns = {};
    defs.forEach(function (d) {
      var b = el('button', {
        class: 'book-tab',
        type: 'button',
        role: 'tab',
        id: 'book-tab-' + d.key,
        'aria-controls': 'book-pane-' + d.key
      }, [
        el('span', { class: 'book-tab-icon-wrap', html: d.icon }),
        el('span', { class: 'book-tab-label', text: d.label })
      ]);
      b.addEventListener('click', function () { selectTab(d.key); });
      tabBtns[d.key] = b;
      tabs.appendChild(b);
    });

    var btnLeft = el('button', { class: 'book-page-btn', type: 'button', text: '‹' });
    var btnRight = el('button', { class: 'book-page-btn', type: 'button', text: '›' });
    var pageLabel = el('span', { class: 'book-page-label', 'aria-live': 'polite' });
    var pager = el('div', { class: 'book-pager' }, [btnLeft, pageLabel, btnRight]);

    var wrap = el('div', { class: 'book-reader' }, [tabs, panesWrap, pager]);

    function activePane() { return activeKey ? panes[activeKey] : null; }

    function viewportHeight(pane) {
      var top = pane.viewport.getBoundingClientRect().top + (window.pageYOffset || 0);
      var footer = document.querySelector('.reader-footer');
      var reserve = footer ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top) : 0;
      var pagerH = pager.offsetHeight || 44;
      return Math.max(220, Math.floor(window.innerHeight - top - reserve - pagerH - 16));
    }

    function updatePager() {
      var p = activePane();
      if (!p) return;
      pageLabel.textContent = 'Page ' + (p.page + 1) + ' of ' + p.count;
      var atStart = p.page <= 0;
      var atEnd = p.page >= p.count - 1;
      // In a right-to-left pane the left button is "next", as in a real Arabic book.
      btnLeft.disabled = p.rtl ? atEnd : atStart;
      btnRight.disabled = p.rtl ? atStart : atEnd;
      btnLeft.setAttribute('aria-label', p.rtl ? 'Next page' : 'Previous page');
      btnRight.setAttribute('aria-label', p.rtl ? 'Previous page' : 'Next page');
    }

    function applyPage(p) {
      if (p.viewport) {
        p.viewport.scrollLeft = 0;
        p.viewport.scrollTop = 0;
      }
      var shift = p.page * p.w;
      p.strip.style.transform = 'translateX(' + (p.rtl ? shift : -shift) + 'px)';
      updatePager();
    }

    function layoutPane(p) {
      var w = p.viewport.clientWidth;
      if (!w) return;
      var frac = p.count > 1 ? p.page / (p.count - 1) : 0;
      var h = viewportHeight(p);
      p.viewport.style.height = h + 'px';
      p.strip.style.height = h + 'px';
      // Strip is (w − GAP) wide so exactly one column fits: column pitch = w
      // and every page keeps GAP/2 of air on each side.
      p.strip.style.width = Math.max(120, w - BOOK_GAP) + 'px';
      p.strip.style.marginLeft = (BOOK_GAP / 2) + 'px';
      p.strip.style.columnWidth = Math.max(120, w - BOOK_GAP) + 'px';
      p.strip.style.columnGap = BOOK_GAP + 'px';
      p.w = w;
      p.count = Math.max(1, Math.round((p.strip.scrollWidth + BOOK_GAP) / w));
      p.page = Math.max(0, Math.min(p.count - 1, Math.round(frac * (p.count - 1))));
      applyPage(p);
    }

    function layoutActive() {
      var p = activePane();
      if (p && !p.el.hidden) layoutPane(p);
    }

    function selectTab(key) {
      if (!panes[key]) return;
      activeKey = key;
      order.forEach(function (p) {
        var on = p.key === key;
        p.el.hidden = !on;
        tabBtns[p.key].setAttribute('aria-selected', on ? 'true' : 'false');
        tabBtns[p.key].classList.toggle('is-active', on);
      });
      layoutActive();
    }

    // Move one page in reading direction (+1 next / -1 previous). Past either
    // end of the chapter it moves on to the neighbouring chapter, if any.
    function turn(dir) {
      var p = activePane();
      if (!p) return false;
      var np = p.page + dir;
      if (np < 0 || np >= p.count) {
        if (dir > 0 && sectionIndex < totalSections - 1) {
          window.location.hash = workUrl + (sectionIndex + 1);
          return true;
        }
        if (dir < 0 && sectionIndex > 0) {
          window.location.hash = workUrl + (sectionIndex - 1);
          return true;
        }
        return false;
      }
      p.page = np;
      hold = true;
      applyPage(p);
      return true;
    }

    function turnVisual(side) {
      var p = activePane();
      if (!p) return;
      var dir = side === 'right' ? 1 : -1;
      turn(p.rtl ? -dir : dir);
    }

    btnLeft.addEventListener('click', function () { turnVisual('left'); });
    btnRight.addEventListener('click', function () { turnVisual('right'); });

    // Swipe: a finger moving left turns to the page on the right (and vice versa).
    var touchStart = null;
    panesWrap.addEventListener('touchstart', function (e) {
      var t = e.touches && e.touches[0];
      touchStart = t ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
    }, { passive: true });
    panesWrap.addEventListener('touchend', function (e) {
      var s0 = touchStart;
      touchStart = null;
      var t = e.changedTouches && e.changedTouches[0];
      if (!s0 || !t) return;
      var dx = t.clientX - s0.x;
      var dy = t.clientY - s0.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.4 || Date.now() - s0.t > 900) return;
      turnVisual(dx < 0 ? 'right' : 'left');
    }, { passive: true });

    function onKey(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      var tgt = e.target;
      if (tgt && /^(input|textarea|select)$/i.test(tgt.tagName)) return;
      if (document.querySelector('.art-overlay')) return;
      if (e.key === 'PageDown') { e.preventDefault(); turn(1); }
      else if (e.key === 'PageUp') { e.preventDefault(); turn(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); turnVisual('right'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); turnVisual('left'); }
    }
    document.addEventListener('keydown', onKey);

    // Bring a narrated paragraph into view. A paragraph can span several
    // pages, so `fraction` (0–1, progress through its audio) picks the page.
    function reveal(card, fraction, force) {
      var p = panes.story;
      if (!p || p.el.hidden || !p.w || !card) return;
      if (force) hold = false;
      if (hold) return;
      var rects = card.getClientRects();
      if (!rects.length) return;
      var total = 0;
      var i;
      for (i = 0; i < rects.length; i++) total += rects[i].height;
      var target = rects[0];
      var acc = 0;
      var f = Math.max(0, Math.min(1, fraction || 0));
      for (i = 0; i < rects.length; i++) {
        acc += rects[i].height;
        target = rects[i];
        if (total <= 0 || f <= acc / total) break;
      }
      var left = target.left - p.strip.getBoundingClientRect().left;
      var page = Math.max(0, Math.min(p.count - 1, Math.floor((left + 2) / p.w)));
      if (page !== p.page) {
        p.page = page;
        applyPage(p);
      }
    }

    window.MantleBook = {
      turn: turn,
      reveal: reveal,
      follow: function (card, fraction) { reveal(card, fraction, false); }
    };

    var resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layoutActive, 120);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    currentBookCleanup = function () {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      clearTimeout(resizeTimer);
    };

    // The strip can only be measured once attached and fonts have settled.
    var tries = 0;
    function firstLayout() {
      if (!wrap.isConnected && tries++ < 60) {
        window.requestAnimationFrame(firstLayout);
        return;
      }
      selectTab(activeKey);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutActive);
      setTimeout(layoutActive, 250);
    }
    window.requestAnimationFrame(firstLayout);

    nativeCall('onReaderState', true);
    return wrap;
  }

  /* ---------- Sticky Reader Footer Dock (Media & Section Navigation) ---------- */
  function buildReaderFooterDock(section, sectionIndex, totalSections, work) {
    var audioData = section.audio;
    var footer = el('footer', { class: 'reader-footer', role: 'region', 'aria-label': 'Recitation and section controls' });

    var workUrl = '#/work/' + encodeURIComponent(work.id) + '/section/';
    var prevBtn;
    if (sectionIndex > 0) {
      prevBtn = el('a', {
        class: 'icon-btn nav-section-btn',
        href: workUrl + (sectionIndex - 1),
        'aria-label': 'Previous section: ' + (work.sections && work.sections[sectionIndex - 1] ? work.sections[sectionIndex - 1].heading : ''),
        title: 'Previous section',
        html: ICON_PREV
      });
    } else {
      prevBtn = el('button', {
        class: 'icon-btn nav-section-btn is-disabled',
        type: 'button',
        disabled: '',
        'aria-label': 'No previous section',
        html: ICON_PREV
      });
    }
    footer.appendChild(prevBtn);

    if (audioData) {
      var audio = el('audio', { preload: 'metadata', src: audioData.file });
      currentReaderAudio = audio;

      var progressBar = el('div', { class: 'reader-footer-progress-bar' });
      var progressContainer = el('div', { class: 'reader-footer-progress', 'aria-label': 'Audio timeline scrubber' }, [progressBar]);
      footer.appendChild(progressContainer);

      progressContainer.addEventListener('click', function (e) {
        var rect = progressContainer.getBoundingClientRect();
        var pos = (e.clientX - rect.left) / rect.width;
        if (audio.duration) {
          audio.currentTime = Math.max(0, Math.min(audio.duration, pos * audio.duration));
        }
      });

      var playBtn = el('button', {
        class: 'audio-play-btn',
        type: 'button',
        'aria-label': 'Play recitation',
        title: 'Play recitation',
        html: ICON_PLAY
      });

      var titleEl = el('span', { class: 'audio-title', text: section.heading });
      var timerEl = el('span', { class: 'audio-timer', text: '0:00 / ' + formatTime(audioData.duration || 0) });
      var infoEl = el('div', { class: 'audio-info' }, [titleEl, timerEl]);

      var autoScroll = true;
      var userInterrupted = false;
      var userInterruptTimer = null;
      var singleVerseNum = null;

      var autoScrollBtn = el('button', {
        class: 'audio-autoscroll-btn is-active',
        type: 'button',
        title: 'Toggle auto-scroll with audio',
        'aria-label': 'Toggle auto-scroll with audio',
        'aria-pressed': 'true',
        text: 'Auto'
      });

      autoScrollBtn.addEventListener('click', function () {
        autoScroll = !autoScroll;
        userInterrupted = false;
        if (autoScroll) {
          autoScrollBtn.classList.add('is-active');
          autoScrollBtn.setAttribute('aria-pressed', 'true');
          if (lastActiveCard) {
            revealCard(lastActiveCard, true, true);
          }
        } else {
          autoScrollBtn.classList.remove('is-active');
          autoScrollBtn.setAttribute('aria-pressed', 'false');
        }
      });

      var loopEnabled = false;
      try { loopEnabled = (window.localStorage.getItem('mantle_audio_loop') === 'true'); } catch (e) {}

      var loopBtn = el('button', {
        class: 'audio-loop-btn' + (loopEnabled ? ' is-active' : ''),
        type: 'button',
        title: 'Toggle audio loop',
        'aria-label': 'Toggle audio loop',
        'aria-pressed': loopEnabled ? 'true' : 'false',
        html: ICON_LOOP
      });

      loopBtn.addEventListener('click', function () {
        loopEnabled = !loopEnabled;
        try { window.localStorage.setItem('mantle_audio_loop', loopEnabled ? 'true' : 'false'); } catch (e) {}
        if (loopEnabled) {
          loopBtn.classList.add('is-active');
          loopBtn.setAttribute('aria-pressed', 'true');
        } else {
          loopBtn.classList.remove('is-active');
          loopBtn.setAttribute('aria-pressed', 'false');
        }
      });

      function initReaderMediaSession() {
        updateMediaSession(audio, {
          title: section.heading,
          artist: work.author || 'Mantle Library',
          album: work.title_en || 'The Mantle Library',
          artwork: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png' }
          ],
          onPrev: function () {
            var timestamps = audioData.timestamps || [];
            if (!timestamps.length) { audio.currentTime = 0; return; }
            if (lastActiveNum !== null) {
              var curIdx = -1;
              for (var k = 0; k < timestamps.length; k++) {
                if (timestamps[k].n === lastActiveNum) { curIdx = k; break; }
              }
              if (curIdx > 0 && audio.currentTime - timestamps[curIdx].start < 2.5) {
                window.MantleReaderPlayer.seekToVerse(timestamps[curIdx - 1].n);
              } else if (curIdx >= 0) {
                window.MantleReaderPlayer.seekToVerse(timestamps[curIdx].n);
              } else {
                audio.currentTime = 0;
              }
            } else {
              audio.currentTime = 0;
            }
          },
          onNext: function () {
            var timestamps = audioData.timestamps || [];
            if (!timestamps.length) return;
            if (lastActiveNum !== null) {
              var curIdx = -1;
              for (var k = 0; k < timestamps.length; k++) {
                if (timestamps[k].n === lastActiveNum) { curIdx = k; break; }
              }
              if (curIdx >= 0 && curIdx < timestamps.length - 1) {
                window.MantleReaderPlayer.seekToVerse(timestamps[curIdx + 1].n);
              } else if (sectionIndex < totalSections - 1) {
                try { window.sessionStorage.setItem('mantle_autoplay_next', '1'); } catch (e) {}
                window.location.hash = workUrl + (sectionIndex + 1);
              } else if (loopEnabled) {
                try { window.sessionStorage.setItem('mantle_autoplay_next', '1'); } catch (e) {}
                window.location.hash = workUrl + '0';
              }
            } else {
              window.MantleReaderPlayer.seekToVerse(timestamps[0].n);
            }
          }
        });
      }
      initReaderMediaSession();

      function updateVersePlayButtons() {
        var isPlaying = !audio.paused;
        var buttons = document.querySelectorAll('.verse-play');
        for (var b = 0; b < buttons.length; b++) {
          var btn = buttons[b];
          var vNum = parseInt(btn.getAttribute('data-verse-num'), 10);
          var isThisPlaying = (isPlaying && lastActiveNum === vNum);
          btn.innerHTML = isThisPlaying ? ICON_PAUSE : ICON_PLAY;
          btn.setAttribute('aria-label', (isThisPlaying ? 'Pause verse ' : 'Play verse ') + vNum);
          if (isThisPlaying) {
            btn.classList.add('is-playing');
          } else {
            btn.classList.remove('is-playing');
          }
        }
      }

      function scrollToActiveVerse(smooth) {
        if (!autoScroll) return;
        var card = lastActiveCard || document.getElementById('verse-1');
        if (card) {
          revealCard(card, smooth, true);
        }
      }

      function handleUserScroll(e) {
        if (!autoScroll) return;
        if (e && e.target && e.target.closest && e.target.closest('.reader-footer')) {
          return;
        }
        userInterrupted = true;
        clearTimeout(userInterruptTimer);
        userInterruptTimer = setTimeout(function () {
          userInterrupted = false;
        }, 5000);
      }
      window.addEventListener('wheel', handleUserScroll, { passive: true });
      window.addEventListener('touchmove', handleUserScroll, { passive: true });

      currentReaderCleanup = function () {
        window.removeEventListener('wheel', handleUserScroll);
        window.removeEventListener('touchmove', handleUserScroll);
        clearTimeout(userInterruptTimer);
      };

      playBtn.addEventListener('click', function () {
        if (audio.paused) {
          singleVerseNum = null; // Resume continuous chapter playback
          userInterrupted = false;
          clearTimeout(userInterruptTimer);
          audio.play().catch(function () {});
          scrollToActiveVerse(true);
        } else {
          audio.pause();
        }
      });

      audio.addEventListener('play', function () {
        nativeCall('onAudioState', true);
        playBtn.innerHTML = ICON_PAUSE;
        playBtn.setAttribute('aria-label', 'Pause recitation');
        updateVersePlayButtons();
        userInterrupted = false;
        clearTimeout(userInterruptTimer);
        scrollToActiveVerse(true);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      });

      audio.addEventListener('pause', function () {
        nativeCall('onAudioState', false);
        playBtn.innerHTML = ICON_PLAY;
        playBtn.setAttribute('aria-label', 'Play recitation');
        updateVersePlayButtons();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      });

      audio.addEventListener('loadedmetadata', function () {
        if (audio.duration && !isNaN(audio.duration)) {
          timerEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
        }
        syncMediaSessionPosition(audio);
      });

      var lastActiveNum = null;
      var lastActiveCard = null;

      audio.addEventListener('timeupdate', function () {
        var t = audio.currentTime;
        var dur = audio.duration || 1;
        var pct = Math.min(100, Math.max(0, (t / dur) * 100));
        progressBar.style.width = pct + '%';
        timerEl.textContent = formatTime(t) + ' / ' + formatTime(audio.duration || 0);
        syncMediaSessionPosition(audio);

        // Single-verse mode: auto-pause (or loop verse) when reaching end of current verse
        if (singleVerseNum !== null) {
          var timestamps = audioData.timestamps || [];
          var curSingleTs = null;
          for (var sIdx = 0; sIdx < timestamps.length; sIdx++) {
            if (timestamps[sIdx].n === singleVerseNum) {
              curSingleTs = timestamps[sIdx];
              break;
            }
          }
          if (curSingleTs && curSingleTs.end > 0 && t >= (curSingleTs.end - 0.15)) {
            if (loopEnabled) {
              audio.currentTime = curSingleTs.start;
              audio.play().catch(function () {});
              return;
            } else {
              audio.pause();
              singleVerseNum = null;
              updateVersePlayButtons();
              return;
            }
          }
        }

        var timestamps = audioData.timestamps || [];
        var activeNum = null;
        for (var k = 0; k < timestamps.length; k++) {
          if (t >= timestamps[k].start && t <= timestamps[k].end) {
            activeNum = timestamps[k].n;
            break;
          }
        }
        if (activeNum === null && lastActiveNum !== null && timestamps.length > 0) {
          if (t >= timestamps[0].start && t <= timestamps[timestamps.length - 1].end) {
            activeNum = lastActiveNum;
          }
        }

        if (activeNum !== lastActiveNum) {
          if (lastActiveCard) lastActiveCard.classList.remove('is-active-verse');
          if (activeNum != null) {
            var card = document.getElementById('verse-' + activeNum);
            if (card) {
              card.classList.add('is-active-verse');
              lastActiveCard = card;
              if (autoScroll && !userInterrupted) {
                revealCard(card, true, true);
              }
            }
          } else {
            lastActiveCard = null;
          }
          lastActiveNum = activeNum;
          updateVersePlayButtons();

          if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
            var vTitle = activeNum ? ('Verse ' + activeNum + ' · ' + section.heading) : section.heading;
            navigator.mediaSession.metadata.title = vTitle;
          }
        }

        // Book Mode: follow a long paragraph across page boundaries while it is narrated.
        if (lastActiveCard && autoScroll && !userInterrupted && window.MantleBook &&
            lastActiveCard.closest && lastActiveCard.closest('.book-viewport')) {
          for (var f = 0; f < timestamps.length; f++) {
            if (timestamps[f].n === lastActiveNum && timestamps[f].end > timestamps[f].start) {
              window.MantleBook.follow(lastActiveCard, (t - timestamps[f].start) / (timestamps[f].end - timestamps[f].start));
              break;
            }
          }
        }
      });

      audio.addEventListener('ended', function () {
        nativeCall('onAudioState', false);
        playBtn.innerHTML = ICON_PLAY;
        if (lastActiveCard) lastActiveCard.classList.remove('is-active-verse');
        lastActiveCard = null;
        lastActiveNum = null;
        singleVerseNum = null;
        progressBar.style.width = '100%';
        updateVersePlayButtons();

        if (autoScroll) {
          if (sectionIndex < totalSections - 1) {
            try { window.sessionStorage.setItem('mantle_autoplay_next', '1'); } catch (e) {}
            window.location.hash = workUrl + (sectionIndex + 1);
            return;
          } else if (loopEnabled) {
            if (sectionIndex === 0) {
              // Single-chapter work: the hash would not change, so restart in place.
              audio.currentTime = 0;
              audio.play().catch(function () {});
              return;
            }
            try { window.sessionStorage.setItem('mantle_autoplay_next', '1'); } catch (e) {}
            window.location.hash = workUrl + '0';
            return;
          }
        } else if (loopEnabled) {
          audio.currentTime = 0;
          audio.play().catch(function () {});
        }
      });

      window.MantleReaderPlayer = {
        seekToVerse: function (verseNum) {
          var timestamps = audioData.timestamps || [];
          for (var k = 0; k < timestamps.length; k++) {
            if (timestamps[k].n === verseNum) {
              singleVerseNum = null;
              userInterrupted = false;
              clearTimeout(userInterruptTimer);
              audio.currentTime = timestamps[k].start;
              audio.play().catch(function () {});
              break;
            }
          }
        },
        playOrPauseVerse: function (verseNum) {
          var timestamps = audioData.timestamps || [];
          var targetTs = null;
          for (var k = 0; k < timestamps.length; k++) {
            if (timestamps[k].n === verseNum) {
              targetTs = timestamps[k];
              break;
            }
          }
          if (!targetTs) return;

          // If this exact verse is already playing, pause it:
          if (!audio.paused && lastActiveNum === verseNum) {
            audio.pause();
            return;
          }

          userInterrupted = false;
          clearTimeout(userInterruptTimer);

          // If audio was paused on this verse, resume it in single-verse mode:
          if (lastActiveNum === verseNum && audio.currentTime >= targetTs.start && audio.currentTime < targetTs.end) {
            singleVerseNum = verseNum;
            audio.play().catch(function () {});
            return;
          }

          // Otherwise seek to this verse and play only this verse:
          singleVerseNum = verseNum;
          audio.currentTime = targetTs.start;
          audio.play().catch(function () {});
        }
      };

      try {
        if (window.sessionStorage.getItem('mantle_autoplay_next') === '1') {
          window.sessionStorage.removeItem('mantle_autoplay_next');
          setTimeout(function () {
            playBtn.click();
          }, 150);
        }
      } catch (e) {}

      var centerGroup = el('div', { class: 'reader-footer-center' }, [
        playBtn,
        infoEl,
        loopBtn,
        autoScrollBtn
      ]);
      footer.appendChild(centerGroup);
    } else {
      var centerGroup = el('div', { class: 'reader-footer-center non-audio' }, [
        el('span', { class: 'section-indicator', text: 'Section ' + (sectionIndex + 1) + ' of ' + totalSections })
      ]);
      footer.appendChild(centerGroup);
    }

    var nextBtn;
    if (sectionIndex < totalSections - 1) {
      nextBtn = el('a', {
        class: 'icon-btn nav-section-btn',
        href: workUrl + (sectionIndex + 1),
        'aria-label': 'Next section: ' + (work.sections && work.sections[sectionIndex + 1] ? work.sections[sectionIndex + 1].heading : ''),
        title: 'Next section',
        html: ICON_NEXT
      });
    } else {
      nextBtn = el('button', {
        class: 'icon-btn nav-section-btn is-disabled',
        type: 'button',
        disabled: '',
        'aria-label': 'No next section',
        html: ICON_NEXT
      });
    }
    footer.appendChild(nextBtn);

    return footer;
  }

  function buildUnitNodes(section, audioData) {
    var nodes = [];
    var units = Array.isArray(section.units) ? section.units : [];
    var tDisplay = window.MantleSettings && window.MantleSettings.getTranslationDisplay
      ? window.MantleSettings.getTranslationDisplay()
      : { modern: 'direct', victorian: 'dropdown' };

    units.forEach(function (unit, idx) {
      var num = unit.n != null ? unit.n : idx + 1;
      var badgeText = (unit.n === 0 || unit.badge) ? (unit.badge || '✦') : String(num);

      var copyBtn = el('button', {
        class: 'verse-copy icon-btn',
        type: 'button',
        'aria-label': 'Copy verse ' + num + ' (Arabic and English)',
        title: 'Copy verse',
        html: ICON_COPY
      });
      copyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
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
      if (unit.n != null && unit.n !== 0) {
        arChildren.push(el('span', { class: 'verse-num', text: ' ' + toArabicNum(unit.n) }));
      }

      var headKids = [el('span', { class: 'verse-badge', text: badgeText })];
      if (unit.label) {
        headKids.push(el('span', { class: 'verse-label-refrain', text: unit.label }));
      }

      var actionButtons = [];
      if (audioData) {
        var playBtn = el('button', {
          class: 'verse-play icon-btn',
          type: 'button',
          'data-verse-num': String(num),
          'aria-label': 'Play verse ' + num,
          title: 'Play verse',
          html: ICON_PLAY
        });
        playBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.MantleReaderPlayer && window.MantleReaderPlayer.playOrPauseVerse) {
            window.MantleReaderPlayer.playOrPauseVerse(num);
          }
        });
        actionButtons.push(playBtn);
      }
      actionButtons.push(copyBtn);
      headKids.push(el('div', { class: 'verse-actions' }, actionButtons));

      var cardChildren = [
        el('div', { class: 'verse-card-head' }, headKids),
        el('p', { class: 'arabic-text', lang: 'ar', dir: 'rtl' }, arChildren)
      ];

      if (unit.en || unit.en2) {
        // Modern Simplification
        if (unit.en2 && tDisplay.modern !== 'hide') {
          if (tDisplay.modern === 'dropdown') {
            cardChildren.push(el('details', { class: 'translation-dropdown modern-dropdown' }, [
              el('summary', { class: 'translation-dropdown-summary' }, [
                el('span', { class: 'dropdown-arrow', text: '▾' }),
                document.createTextNode(' Modern Simplification')
              ]),
              el('div', { class: 'translation-dropdown-content' }, [
                el('p', { class: 'translation translation-modern', text: unit.en2 })
              ])
            ]));
          } else {
            // direct
            cardChildren.push(el('p', { class: 'translation translation-modern' }, [
              document.createTextNode(unit.en2)
            ]));
          }
        }

        // Victorian Translation (Source)
        if (unit.en && tDisplay.victorian !== 'hide') {
          if (!unit.en2 || tDisplay.victorian === 'direct') {
            cardChildren.push(el('p', { class: 'translation translation-victorian', text: unit.en }));
          } else {
            // in dropdown
            cardChildren.push(el('details', { class: 'translation-dropdown victorian-dropdown' }, [
              el('summary', { class: 'translation-dropdown-summary' }, [
                el('span', { class: 'dropdown-arrow', text: '▾' }),
                document.createTextNode(' Victorian Translation (Source)')
              ]),
              el('div', { class: 'translation-dropdown-content' }, [
                el('p', { class: 'translation translation-victorian', text: unit.en })
              ])
            ]));
          }
        }
      } else {
        cardChildren.push(el('p', {
          class: 'translation-pending',
          text: 'English translation coming in a future update.'
        }));
      }

      var card = el('section', {
        id: 'verse-' + num,
        class: 'verse-card' + (audioData ? ' is-seekable' : '') + (unit.n === 0 ? ' is-refrain' : ''),
        'data-verse-num': String(num)
      }, cardChildren);

      if (audioData) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('.verse-copy') || e.target.closest('.verse-play') || e.target.closest('.translation-dropdown')) return;
          if (window.MantleReaderPlayer && window.MantleReaderPlayer.playOrPauseVerse) {
            window.MantleReaderPlayer.playOrPauseVerse(num);
          }
        });
      }

      nodes.push(card);
    });
    return nodes;
  }

  function unitCountLabel(section) {
    if (Array.isArray(section.story) && section.story.length > 0) {
      var pCount = section.story.length;
      return pCount + ' ' + (pCount === 1 ? 'paragraph' : 'paragraphs') + ' · 3-tab reader';
    }
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
      nodes.push(el('details', { class: 'work-source' }, [
        el('summary', { text: 'Text source' }),
        el('p', { text: work.source_en })
      ]));
    }
    var hasModern = (work.sections || []).some(function (sec) {
      return (sec.units || []).some(function (u) { return u.en2; }) || (sec.story && sec.story.length > 0);
    });
    if (hasModern) {
      nodes.push(el('p', {
        class: 'modern-layer-note',
        text: 'Note: every “Modern simplification” below simplifies the Victorian translation; it is not a new translation of the Arabic.'
      }));
    }
    return nodes;
  }

  /* ------------------------------------------- work index view (section list) */

  function renderWork(id) {
    if (id === 'historic-recordings') {
      renderArchive();
      return;
    }
    setNavCurrent('home');
    clearView();

    loadWorks().then(function (works) {
      if (!works) return;
      var work = findWork(works, id);
      if (!work) {
        document.title = 'Not found — Mantle Library';
        showNotFound('Work');
        return;
      }

      document.title = work.title_en + ' — Mantle Library';

      var wt = splitTitleGloss(work.title_en);
      appEl.appendChild(buildSubNavBar('#/', 'Back to Library', wt.main, true, true));
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
        document.title = 'Not found — Mantle Library';
        showNotFound('Work');
        return;
      }
      var sections = Array.isArray(work.sections) ? work.sections : [];
      var cleanSectionIndex = String(sectionIndex).split('?')[0];
      var i = parseInt(cleanSectionIndex, 10);
      if (String(i) !== cleanSectionIndex || i < 0 || i >= sections.length) {
        document.title = 'Not found — Mantle Library';
        showNotFound('Section');
        return;
      }
      var section = sections[i];

      document.title = section.heading + ' — ' + work.title_en + ' — Mantle Library';

      var isBook = section.layout === 'book';
      var navTitle = isBook ? section.heading : splitTitleGloss(section.heading).main;
      appEl.appendChild(buildSubNavBar('#/work/' + encodeURIComponent(work.id), 'Back to ' + work.title_en, navTitle, true, true));

      var st = splitTitleGloss(work.title_en);
      var secTitleKids = [document.createTextNode(st.main)];
      if (st.gloss) secTitleKids.push(el('span', { class: 'block-gloss', text: st.gloss }));

      // Book Mode: sticky header carries full title; body jumps straight into the paged reader tabs.
      if (isBook) {
        appEl.classList.add('reader-wrap', 'is-book');
        appEl.appendChild(buildBookReader(section, i, sections.length, work));
        appEl.appendChild(buildReaderFooterDock(section, i, sections.length, work));
        return;
      }
      var headerChildren = [
        el('h1', { class: 'page-title', text: section.heading }),
        el('p', { class: 'work-author' }, secTitleKids)
      ];
      if (section.note) {
        headerChildren.push(el('p', { class: 'work-description', text: section.note }));
      }
      var hasModern = (Array.isArray(section.units) ? section.units : []).some(function (unit) {
        return unit.en2;
      });
      if (hasModern) {
        headerChildren.push(el('p', {
          class: 'modern-layer-note',
          text: 'Note: every “Modern simplification” below simplifies the Victorian translation; it is not a new translation of the Arabic.'
        }));
      }
      appEl.appendChild(el('header', { class: 'work-header' }, headerChildren));
      appEl.classList.add('reader-wrap');
      appEl.appendChild(el('div', { class: 'verse-stack' }, buildUnitNodes(section, section.audio)));

      // Bottom Sticky Reader Footer Dock (Media & Section Navigation)
      appEl.appendChild(buildReaderFooterDock(section, i, sections.length, work));
    });
  }

  /* ----------------------------------------------------------- settings view */

  function renderSettings() {
    setNavCurrent('settings');
    document.title = 'Settings — Mantle Library';
    clearView();

    var settings = window.MantleSettings;

    appEl.appendChild(buildSubNavBar('#/', 'Back', 'Settings', true, false));
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

    // --- Translation layers selector ---
    var transCard = el('section', { class: 'settings-card', 'aria-labelledby': 'settings-trans-heading' }, [
      el('h2', { class: 'settings-heading', id: 'settings-trans-heading', text: 'Translation & Text Layers' }),
      el('p', { class: 'settings-desc', text: 'Configure how translations appear on reading cards. Collapsed text remains accessible anytime via dropdown.' })
    ]);

    var transSettings = settings.getTranslationDisplay ? settings.getTranslationDisplay() : { modern: 'direct', victorian: 'dropdown' };

    function buildLayerControl(key, title, subtitle, currentValue) {
      var group = el('div', { class: 'layer-group' });
      var titleRow = el('div', { class: 'layer-title-row' }, [
        el('span', { class: 'layer-title', text: title }),
        subtitle ? el('span', { class: 'layer-subtitle', text: subtitle }) : null
      ]);
      group.appendChild(titleRow);

      var choicesContainer = el('div', { class: 'layer-choices', role: 'group', 'aria-label': title });
      var options = [
        { value: 'direct', label: 'Direct' },
        { value: 'dropdown', label: 'Dropdown' },
        { value: 'hide', label: 'Hide' }
      ];

      var buttons = [];
      options.forEach(function (opt) {
        var btn = el('button', {
          class: 'layer-choice',
          type: 'button',
          'data-value': opt.value,
          text: opt.label,
          'aria-pressed': String(currentValue === opt.value)
        });
        btn.addEventListener('click', function () {
          buttons.forEach(function (b) {
            b.setAttribute('aria-pressed', String(b === btn));
          });
          settings.setTranslationLayer(key, opt.value);
        });
        buttons.push(btn);
        choicesContainer.appendChild(btn);
      });

      group.appendChild(choicesContainer);
      return group;
    }

    transCard.appendChild(buildLayerControl(
      'modern',
      'Modern Simplification',
      'Default: Direct',
      transSettings.modern
    ));
    transCard.appendChild(buildLayerControl(
      'victorian',
      'Victorian Translation (Source)',
      'Default: Dropdown',
      transSettings.victorian
    ));
    appEl.appendChild(transCard);

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

    // --- Volume-key page turning (only in the native Android app) ---
    if (window.AndroidBridge && settings.getVolumePaging) {
      var volBox = el('input', { type: 'checkbox', id: 'setting-volume-paging' });
      volBox.checked = settings.getVolumePaging();
      volBox.addEventListener('change', function () {
        settings.setVolumePaging(volBox.checked);
      });
      appEl.appendChild(el('section', { class: 'settings-card', 'aria-labelledby': 'settings-paging-heading' }, [
        el('h2', { class: 'settings-heading', id: 'settings-paging-heading', text: 'Page turning' }),
        el('label', { class: 'settings-toggle', for: 'setting-volume-paging' }, [
          volBox,
          el('span', { text: 'Turn pages with the volume keys' })
        ]),
        el('p', { class: 'settings-desc', text: 'In the paged Sīrah reader, Volume Down turns to the next page and Volume Up to the previous page. While audio is playing, the volume keys control the volume as usual.' })
      ]));
    }

    appEl.appendChild(el('p', {
      class: 'settings-note',
      text: 'Settings are stored on this device only.'
    }));
  }

  /* ------------------------------------------- responsive desktop sidebar */

  var sidebarBuilt = false;

  function buildDesktopSidebar(works) {
    var aside = document.getElementById('desktop-sidebar');
    if (!aside) return;

    while (aside.firstChild) aside.removeChild(aside.firstChild);

    var brand = el('a', { class: 'sidebar-brand', href: '#/' }, [
      el('img', { class: 'sidebar-logo', src: 'icons/icon-192.png', alt: 'Mantle Library Logo', width: '42', height: '42' }),
      el('div', { class: 'sidebar-titles' }, [
        el('div', { class: 'sidebar-title', text: 'Mantle Library' }),
        el('div', { class: 'sidebar-sub', text: 'Devotional Works & Archive' })
      ])
    ]);
    aside.appendChild(brand);

    var nav = el('nav', { class: 'sidebar-nav' });

    // Section 1: Main Navigation
    nav.appendChild(el('div', { class: 'nav-section-label', text: 'Library' }));

    var homeItem = el('a', { class: 'nav-item', href: '#/', 'data-nav': 'home' }, [
      el('span', { class: 'nav-icon', html: ROW_ICONS['dalail-al-khayrat'] }),
      el('span', { class: 'nav-text', text: 'All Works' })
    ]);
    nav.appendChild(homeItem);

    var archiveItem = el('a', { class: 'nav-item', href: '#/archive', 'data-nav': 'archive' }, [
      el('span', { class: 'nav-icon', html: ROW_ICONS['historic-recordings'] }),
      el('span', { class: 'nav-text', text: 'Historic Archive' })
    ]);
    nav.appendChild(archiveItem);

    // Section 2: Canonical Works
    nav.appendChild(el('div', { class: 'nav-section-label', text: 'Canonical Works' }));

    if (works && Array.isArray(works)) {
      works.forEach(function (w) {
        if (w.id === 'historic-recordings') return;
        var t = splitTitleGloss(w.title_en);
        var workNav = el('a', {
          class: 'nav-item',
          href: '#/work/' + encodeURIComponent(w.id),
          'data-nav': 'work-' + w.id,
          title: w.title_en
        }, [
          el('span', { class: 'nav-icon', html: rowIcon(w.id) }),
          el('span', { class: 'nav-text', text: t.main })
        ]);
        nav.appendChild(workNav);
      });
    }

    // Section 3: Preferences
    nav.appendChild(el('div', { class: 'nav-section-label', text: 'Options' }));

    var settingsItem = el('a', { class: 'nav-item', href: '#/settings', 'data-nav': 'settings' }, [
      el('span', { class: 'nav-icon', html: ROW_ICONS['settings'] }),
      el('span', { class: 'nav-text', text: 'Settings' })
    ]);
    nav.appendChild(settingsItem);

    var aboutItem = el('a', { class: 'nav-item', href: 'support.html', 'data-nav': 'support' }, [
      el('span', { class: 'nav-icon', html: ROW_ICONS['about'] }),
      el('span', { class: 'nav-text', text: 'About & Support' })
    ]);
    nav.appendChild(aboutItem);

    aside.appendChild(nav);

    // Footer utilities
    var foot = el('div', { class: 'sidebar-foot' });
    var themeBtn = el('button', { class: 'sidebar-btn', type: 'button', title: 'Toggle Dark / Light' }, [
      document.createTextNode('🌓 Theme')
    ]);
    themeBtn.addEventListener('click', function () {
      var current = window.MantleSettings ? window.MantleSettings.getTheme() : 'dark';
      var next = (current === 'light') ? 'dark' : 'light';
      if (window.MantleSettings) window.MantleSettings.setTheme(next);
    });
    foot.appendChild(themeBtn);

    var settingsBtn = el('a', { class: 'sidebar-btn', href: '#/settings', title: 'Settings' }, [
      document.createTextNode('⚙ Settings')
    ]);
    foot.appendChild(settingsBtn);

    aside.appendChild(foot);
    sidebarBuilt = true;

    var hash = window.location.hash || '#/';
    updateDesktopSidebarActive(hash.replace(/^#/, ''));
  }

  function updateDesktopSidebarActive(path) {
    var items = document.querySelectorAll('.desktop-sidebar .nav-item');
    items.forEach(function (it) { it.classList.remove('active'); });

    var activeKey = null;
    if (path === '/' || path === '') {
      activeKey = 'home';
    } else if (path === '/archive' || path === '/recordings' || path === '/historic-recordings') {
      activeKey = 'archive';
    } else if (path.indexOf('/work/') === 0) {
      var rest = path.slice('/work/'.length);
      var slash = rest.indexOf('/section/');
      var workId = slash !== -1 ? rest.slice(0, slash) : rest;
      activeKey = 'work-' + decodeURIComponent(workId);
    } else if (path === '/settings') {
      activeKey = 'settings';
    }

    if (activeKey) {
      var activeEl = document.querySelector('.desktop-sidebar [data-nav="' + activeKey + '"]');
      if (activeEl) activeEl.classList.add('active');
    }
  }

  /* ------------------------------------------------------------------ router */

  function route() {
    closeArtOverlay();
    closeRecOverlay();
    var strayOverlays = document.querySelectorAll('.art-overlay, .rec-overlay');
    for (var i = 0; i < strayOverlays.length; i++) {
      if (strayOverlays[i].parentNode) {
        strayOverlays[i].parentNode.removeChild(strayOverlays[i]);
      }
    }

    var hash = window.location.hash || '#/';
    var path = hash.replace(/^#/, '');

    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    var isHome = (path === '/' || path === '' || (path !== '/archive' && path !== '/recordings' && path !== '/historic-recordings' && path.indexOf('/work/') !== 0 && path !== '/settings'));
    document.documentElement.classList.toggle('is-home', isHome);
    document.body.classList.toggle('is-home', isHome);

    if (path === '/' || path === '') {
      renderHome();
    } else if (path === '/archive' || path === '/recordings' || path === '/historic-recordings') {
      renderArchive();
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

    updateDesktopSidebarActive(path);

    // Move focus to main for keyboard / screen-reader users on navigation.
    if (mainEl) {
      try {
        mainEl.focus({ preventScroll: true });
      } catch (e) {
        mainEl.focus();
      }
    }
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  buildDesktopSidebar(null);
  window.addEventListener('hashchange', route);
  route();

  /* --------------------------------------------------------- service worker */

  if ('serviceWorker' in navigator) {
    var swRefreshing = false;
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!swRefreshing && hadController) {
        swRefreshing = true;
        window.location.reload();
      }
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        // Proactively check for updates on load (bypasses HTTP cache of sw.js)
        reg.update().catch(function () {});
        // Re-check whenever the app returns to the foreground (helps Android TWAs and iOS PWAs)
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            reg.update().catch(function () {});
          }
        });
      }).catch(function (err) {
        // Registration failure is non-fatal: the app still works online.
        if (window.console && console.warn) {
          console.warn('Service worker registration failed:', err);
        }
      });
    });
  }

  /* ================= PWA Install Banner (iOS / iPhone Only) ================= */
  function maybeShowIOSBanner() {
    try {
      var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var standalone = window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      var dismissed = false;
      try { dismissed = !!window.localStorage.getItem('mantle_ios_banner_dismissed'); } catch (e) {}
      if (isIOS && !standalone && !dismissed) {
        var banner = document.getElementById('ios-banner');
        if (banner) {
          banner.hidden = false;
          var closeBtn = document.getElementById('ios-banner-close');
          if (closeBtn) {
            closeBtn.addEventListener('click', function () {
              banner.hidden = true;
              try { window.localStorage.setItem('mantle_ios_banner_dismissed', 'true'); } catch (e) {}
            });
          }
        }
      }
    } catch (e) {}
  }

  // Prevent default browser install mini-infobar on Android/Desktop
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
  });

  /* ================= Native Android App Detection ================= */
  function detectNativeEnvironment() {
    try {
      if (typeof window.AndroidBridge !== 'undefined') {
        document.documentElement.classList.add('is-native-android');
      }
    } catch (e) {}
  }
  detectNativeEnvironment();
  window.addEventListener('DOMContentLoaded', detectNativeEnvironment);

  maybeShowIOSBanner();
})();
