# the-mantle-library
The Mantle Library — a free, ad-free app of classical qasidas and devotional works in praise of the Prophet ﷺ, with historic public-domain recordings. Web (PWA) + Android.

## Legal note

The English text of Hizbs 2–8 of Dala'il al-Khayrat used in this application is the historical translation by Rev. John B. Pearson, originally published at Oxford in 1907, which is in the public domain globally. The opening devotions, the intention and Hizb 1 are an original translation made for this project.

## Theme palette (for the future Android app — map 1:1)

Dark (default) — "Family Green": bg `#101613`, card `#1E2922`, border `#36443A`,
text/cream `#F0EBDC`, gold `#D6AE5E`, accent (logo green) `#245A3E`,
accent-strong `#2E704E`, accent-text (family light green) `#A7C989`.
Status-bar / theme-color: `#101613`.

Light — "Illuminated": bg/paper `#F6F0E0`, card `#FFFCF3`, border `#D6C8A8`,
text/ink `#282218`, gold `#92702C`, accent (logo green) `#245A3E`,
accent-strong `#1C4832`, accent-text `#245A3E`.
Status-bar / theme-color: `#F6F0E0`.

The single source of truth is the `:root` / `html.light` token block in
`css/styles.css` — copy those values verbatim into the app's theme.
