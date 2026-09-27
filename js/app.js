/* The Mantle Library — single-page app: hash router, library view, work index
   view, section reader view, about view, live bilingual (Arabic/English)
   search, and an album-tile grid whose tiles open a recording detail sheet
   with the player. All data is fetched from the bundled content/works.json
   (works offline via sw.js). */
(function () {
  'use strict';

  var normalize = (window.MantleNormalize && window.MantleNormalize.normalize) ||
    function (s) { return String(s == null ? '' : s).toLowerCase(); };

  var appEl = document.getElementById('app');
  var mainEl = document.getElementById('main');

  var state = {
    works: null,        // array of work objects once loaded
    loadError: null,    // error message string if fetch failed
    query: ''           // current search query (persists across hash changes)
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
    return String(n).split('').map(function (d) { return AR_DIGITS[+d]; }).join('');
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

  function workMatches(work, query) {
    var haystack = [
      work.title_ar, work.title_en,
      work.author, work.description_en
    ].map(normalize).join(' ');
    return haystack.indexOf(query) !== -1;
  }

  function buildCard(work) {
    var children = [
      el('p', { class: 'card-title-ar', lang: 'ar', dir: 'rtl', text: work.title_ar }),
      el('h3', { class: 'card-title-en', text: work.title_en }),
      el('p', {
        class: 'card-meta',
        text: work.author + (work.author_dates ? ' (' + work.author_dates + ')' : '')
      })
    ];
    return el('li', { class: 'card' }, [
      el('a', { class: 'card-link', href: '#/work/' + encodeURIComponent(work.id) }, children)
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
    var item = el('li', { class: 'tile' }, [btn]);
    // stash normalized haystack for home-page search
    item.dataset.haystack = normalize(
      [rec.title, rec.artist, rec.date, rec.label, rec.description].filter(Boolean).join(' ')
    );
    return item;
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

    appEl.appendChild(el('img', {
      class: 'app-logo',
      src: 'icons/icon-192.png',
      alt: 'The Mantle Library logo — a golden mantle in a red medallion',
      width: '92',
      height: '92'
    }));
    appEl.appendChild(el('h1', { class: 'app-title', text: 'The Mantle Library' }));
    appEl.appendChild(el('p', {
      class: 'notice',
      style: 'padding-top:0;padding-bottom:1.25rem;',
      text: 'Classical devotional qasidas with historic public-domain recordings — free, ad-free, and fully offline.'
    }));

    var searchWrap = el('div', { class: 'search-wrap' });
    var input = el('input', {
      class: 'search-input',
      id: 'search-input',
      type: 'search',
      placeholder: 'Search Arabic or English…',
      autocomplete: 'off',
      'aria-describedby': 'search-help'
    });
    input.value = state.query;
    searchWrap.appendChild(el('label', { class: 'search-label', for: 'search-input', text: 'Search the library' }));
    searchWrap.appendChild(input);
    searchWrap.appendChild(el('p', {
      class: 'visually-hidden',
      id: 'search-help',
      text: 'Results filter as you type. Arabic diacritics and spelling variants are ignored.'
    }));
    appEl.appendChild(searchWrap);

    var grid = el('ul', { class: 'card-grid', id: 'work-grid' });
    appEl.appendChild(grid);
    var noResults = el('p', { class: 'no-results', text: 'No works match your search.', hidden: '' });
    appEl.appendChild(noResults);

    // Media section: recordings from audio-only collections, as a tile grid
    var mediaSection = el('section', { class: 'audio-block home-media', 'aria-labelledby': 'home-media-heading' }, [
      el('h2', { id: 'home-media-heading', text: 'Historic Recordings' }),
      el('p', { class: 'media-sub',
        text: 'Public-domain 78rpm discs from 1901–1921 — tap a disc to read about it and play it.' })
    ]);
    var mediaList = el('ul', { class: 'tile-grid' });
    mediaSection.appendChild(mediaList);
    appEl.appendChild(mediaSection);
    var mediaEmpty = el('p', { class: 'no-results', text: 'No recordings match your search.', hidden: '' });
    appEl.appendChild(mediaEmpty);

    function applyFilter() {
      if (!state.works) return;
      var q = normalize(state.query);
      grid.textContent = '';
      mediaList.textContent = '';
      var count = 0;
      var mediaCount = 0;
      state.works.forEach(function (work) {
        if (hasAudio(work)) {
          // audio collections are listed as media tiles, not as cards
          work.audio.forEach(function (rec) {
            var item = buildRecordingTile(rec);
            if (!q || item.dataset.haystack.indexOf(q) !== -1) {
              mediaList.appendChild(item);
              mediaCount++;
            }
          });
        } else if (!q || workMatches(work, q)) {
          grid.appendChild(buildCard(work));
          count++;
        }
      });
      if (count === 0) {
        noResults.removeAttribute('hidden');
      } else {
        noResults.setAttribute('hidden', '');
      }
      if (mediaCount === 0) {
        mediaSection.setAttribute('hidden', '');
        if (q) { mediaEmpty.removeAttribute('hidden'); } else { mediaEmpty.setAttribute('hidden', ''); }
      } else {
        mediaSection.removeAttribute('hidden');
        mediaEmpty.setAttribute('hidden', '');
      }
    }

    input.addEventListener('input', function () {
      state.query = input.value;
      applyFilter();
    });

    loadWorks().then(function (works) {
      if (works) applyFilter();
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

  // Render one section's units (Arabic + translation/pending line, verse numbers).
  function buildUnitNodes(section) {
    var nodes = [];
    var units = Array.isArray(section.units) ? section.units : [];
    units.forEach(function (unit) {
      var arChildren = [document.createTextNode(unit.ar)];
      if (unit.n != null) {
        arChildren.push(el('span', { class: 'verse-num', text: ' ' + toArabicNum(unit.n) }));
      }
      nodes.push(el('p', { class: 'arabic-text', lang: 'ar', dir: 'rtl' }, arChildren));
      if (unit.en) {
        nodes.push(el('p', { class: 'translation', text: unit.en }));
      } else {
        nodes.push(el('p', {
          class: 'translation-pending',
          text: 'English translation coming in a future update.'
        }));
      }
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
    var nodes = [
      el('h1', { class: 'page-title', text: work.title_en }),
      el('p', { class: 'work-title-ar', lang: 'ar', dir: 'rtl', text: work.title_ar }),
      el('p', {
        class: 'work-author',
        text: work.author + (work.author_dates ? ' — ' + work.author_dates : '')
      })
    ];
    if (work.description_en) {
      nodes.push(el('p', { class: 'work-description', text: work.description_en }));
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

      var headerChildren = [
        el('h1', { class: 'page-title', text: section.heading }),
        el('p', { class: 'work-author', text: work.title_en })
      ];
      if (section.note) {
        headerChildren.push(el('p', { class: 'work-description', text: section.note }));
      }
      appEl.appendChild(el('header', { class: 'work-header' }, headerChildren));

      appEl.appendChild(el('section', { class: 'section-card' }, buildUnitNodes(section)));

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

  /* -------------------------------------------------------------- about view */

  function renderAbout() {
    setNavCurrent('about');
    document.title = 'About — The Mantle Library';
    clearView();

    appEl.appendChild(el('img', {
      class: 'app-logo',
      src: 'icons/icon-192.png',
      alt: 'The Mantle Library logo — a golden mantle in a red medallion',
      width: '92',
      height: '92'
    }));
    appEl.appendChild(el('h1', { class: 'page-title', text: 'About' }));
    appEl.appendChild(el('div', { class: 'prose' }, [
      el('p', { text: 'The Mantle Library is a free, ad-free, offline-first library of classical Islamic devotional poetry (qasidas and madih), paired with historic public-domain recordings from the earliest decades of the gramophone era.' }),
      el('ul', {}, [
        el('li', { text: 'Free — no cost, ever, and no paywalls.' }),
        el('li', { text: 'Ad-free and tracking-free — no analytics, no accounts, no third-party requests of any kind.' }),
        el('li', { text: 'Offline-first — once loaded, the entire app and its content work without a network connection.' }),
        el('li', { text: 'Copyright-safe — texts are classical works in the public domain, and all audio consists of pre-1923 commercial 78rpm recordings in the public domain.' })
      ]),
      el('p', { text: 'The Arabic texts are classical public-domain works; every English translation here is an original rendering made for this project. The library grows carefully: every addition is checked for copyright status before inclusion.' }),
      el('p', { class: 'credit-line', text: 'Historic recordings courtesy of the Harvard Loeb Music Library (Arabic 78 Collection), the Bibliothèque nationale de France (Gallica), and Excavated Shellac.' }),
      el('p', {}, [el('a', { href: 'privacy.html', text: 'Read the privacy policy' })])
    ]));
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
    } else if (path === '/about') {
      renderAbout();
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
