The Mantle Library — font drop-in folder
=========================================

The stylesheet (css/styles.css) already contains @font-face declarations
pointing at this folder. The app looks fine with system serif fallbacks
until the files below are added; once they are dropped in, they take
effect automatically (no other change needed).

Drop in EXACTLY these files (names must match):

  digitalkhatt-indopak-v2.otf   Arabic primary    -> 'DigitalKhatt IndoPak'
  AmiriQuran.ttf                Arabic fallback   -> 'Amiri Quran'
  NotoNaskh.ttf                 Arabic fallback   -> 'Noto Naskh'

Notes
- Only use fonts with licences that permit web redistribution
  (e.g. OFL). Keep licence files alongside if the licence requires it.
- The font-family names used in CSS are stable and must NOT be renamed:
  'DigitalKhatt IndoPak', 'Amiri Quran', 'Noto Naskh'.
- After adding font files, bump CACHE_VERSION in sw.js and (optionally)
  add the font files to the sw.js precache list so they work offline
  on first install.
