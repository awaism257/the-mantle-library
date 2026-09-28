# v12 build notes — Dalā'il al-Khayrāt Hizbs 2–8 (Pearson 1907 translation)

Saved for the next build (v12). Do NOT treat as app content yet.

## Source

- PDF (bilingual Urdu/English reprint): 
  https://data.nur.nu/Kutub/English/Dalail-al-Khayrat-collection/Dalail-al-Khayrat-urdu-eng.pdf
  (mirror: https://kutub.nur.nu/English/Dalail-al-Khayrat-collection/Dalail-al-Khayrat-urdu-eng.pdf)
  ~38 MB. Confirmed reachable (HTTP 200, application/pdf).
- The English column is the historical translation: **"Guide to Happiness: A
  Manual of Prayer", translated from the Arabic of al-Jazūlī by the Rev.
  John B. Pearson, with a Life of al-Jazūlī by A. G. Ellis, Oxford, printed
  for private circulation, 1907** (HathiTrust record 009031629; a photostat
  of the 1907 title page is included in the PDF's front matter).
- The PDF's table of contents lists all eight parts (First Part p. 97 …
  Eighth Part p. 263), so the English covers Hizbs 1–8.

## Public-domain status (verified reasoning)

- Published 1907 (Oxford) → public domain in the US (pre-1930) and the UK
  (author died 1911; 70 years pma long expired).
- The reprint's "Paak Company ® 2000" notice covers only their modern
  typographical layout, the Urdu translation, and their new notes —
  NOT Pearson's underlying 1907 English text. Reprinting cannot
  re-copyright a public-domain text.

## Extraction rules (what to use / what to avoid)

- USE: Pearson's 1907 English wording only, for Hizbs 2–8.
- AVOID: the Urdu translation, any Paak Company footnotes/commentary,
  headings added by the 2000 editor, and all graphic layout/borders.
- Strip everything but the plain English text; re-structure it ourselves.

## Integration plan

- Map Pearson's English onto the EXISTING works.json unit structure for
  dalail-al-khayrat sections Hizb 2 … Hizb 8 (fill the current
  `en: null` / translation-pending units). Keep Arabic untouched.
- KEEP the existing original project translations (Opening Supplication,
  Intention, Hizb 1) — do not replace them with Pearson.
- Editorial review pass: Pearson's register is Victorian; check devotional
  tone and terminology against our Hizb 1 (e.g. how the salawat formula is
  rendered). Light modernisation of spelling/phrasing is legally fine for
  a public-domain text, but keep changes minimal and faithful.
- If any passage turns out to be missing from Pearson, leave that unit's
  translation pending rather than inventing text.

## Credits to add when this ships (not before)

- About → Text sources, Dalā'il entry: append
  "Hizbs 2–8 English: historical translation by Rev. John B. Pearson
  (Guide to Happiness, Oxford, 1907), in the public domain."
- Work source line for dalail-al-khayrat (source_en): same note.
- README legal note (per user request):
  "The English text of Hizbs 2–8 of Dala'il al-Khayrat used in this
  application is the historical translation by Rev. John B. Pearson,
  originally published at Oxford in 1907, which is in the public domain
  globally."
- Note the split authorship: Opening + Intention + Hizb 1 = original
  project translation; Hizbs 2–8 = Pearson (1907, public domain).

## Also remember

- Bump CACHE_VERSION in sw.js (LAST edit, own commit) — content change.
- Re-run tools/validate_content.py after editing works.json.
