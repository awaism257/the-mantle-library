/* The Mantle Library — trilingual (Arabic / English / Urdu) search normalization.
   Exposes window.MantleNormalize.normalize(text) for diacritic-insensitive,
   spelling-variant-tolerant matching across all three scripts. */
(function (global) {
  'use strict';

  // Arabic diacritics: tanween (064B-0650), harakat (064E-0652 range covered),
  // shadda (0651), tatweel/kashida (0640), plus Quranic annotation marks.
  var ARABIC_MARKS = /[ً-ْٰـۡ-ۭ]/g;

  // Arabic presentation-form / contextual letter unification:
  //   أ إ آ ٱ → ا      ة → ه      ى → ي      ی (Farsi yeh) → ي
  //   ے (bari ye) → ي  ک (keheh) → ك    ہ ھ (Urdu heh variants) → ه
  //   ؤ → و            ئ → ي
  var LETTER_MAP = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
    'ة': 'ه',
    'ى': 'ي', 'ی': 'ي', 'ے': 'ي',
    'ک': 'ك',
    'ہ': 'ه', 'ھ': 'ه',
    'ؤ': 'و',
    'ئ': 'ي'
  };

  // Latin punctuation, Arabic punctuation, and symbol characters.
  var PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~؟،؛«»“”‘’"''•…—–¬\u00B7\u200C\u200D]/g;

  function normalize(text) {
    if (text === null || text === undefined) return '';
    var s = String(text).toLowerCase();

    // Strip Arabic diacritics / tatweel.
    s = s.replace(ARABIC_MARKS, '');

    // Unify letter variants one code point at a time.
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      out += Object.prototype.hasOwnProperty.call(LETTER_MAP, ch) ? LETTER_MAP[ch] : ch;
    }
    s = out;

    // Strip punctuation and collapse whitespace.
    s = s.replace(PUNCTUATION, ' ');
    s = s.replace(/\s+/g, ' ').trim();

    return s;
  }

  global.MantleNormalize = { normalize: normalize };
})(typeof window !== 'undefined' ? window : this);
