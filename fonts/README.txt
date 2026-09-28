The Mantle Library — fonts
==========================

Bundled
-------

  DigitalKhattIndoPak.otf  -> CSS family 'DigitalKhatt IndoPak' (PRIMARY)
  DigitalKhattV2.ttf       -> CSS family 'DigitalKhatt V2' (fallback)

  "DigitalKhatt IndoPak" is based on the 13-line IndoPak mushaf; "Digital
  Khatt V2" (internal name "DigitalKhatt New Madina") is the face of the
  Madina Mushaf (1441 AH). Both: Copyright (c) 2020-2024 Amine Anane,
  Copyright (c) 2024 Tarteel Inc. Licensed under the SIL Open Font
  License, Version 1.1 (https://scripts.sil.org/OFL) — the licence text
  is declared inside each font's own metadata. Source:
  github.com/DigitalKhatt (official project repositories).

Optional drop-in fallbacks (not bundled — system serif is used instead)
-----------------------------------------------------------------------

Drop these into this folder with EXACTLY these names; the @font-face
slots in css/styles.css pick them up automatically:

  AmiriQuran.ttf   Arabic fallback   -> 'Amiri Quran'
  NotoNaskh.ttf    Arabic fallback   -> 'Noto Naskh'

Notes
-----
- Only use fonts with licences that permit web redistribution
  (e.g. OFL). Keep licence info alongside, as done above.
- The font-family names used in CSS are stable and must NOT be renamed:
  'DigitalKhatt IndoPak', 'DigitalKhatt V2', 'Amiri Quran', 'Noto Naskh'.
- After adding or replacing font files, bump CACHE_VERSION in sw.js so
  returning visitors pick up the new files.
