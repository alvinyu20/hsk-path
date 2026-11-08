/* Pinyin typing helper: turns tone numbers into tone marks, for the live preview in the typing tutorial and the pinyin course.
 *   ShanluPinyin.toMarks('ni3 hao3')   -> 'nǐ hǎo'
 *   ShanluPinyin.toMarks('nv3 lv4')    -> 'nǚ lǜ'      (v and u: stand for ü)
 *   ShanluPinyin.toMarks('ma5 ma')     -> 'ma ma'      (5 or 0 = neutral tone, no mark)
 * Only letters followed by a tone number are changed; everything else (spaces, punctuation, hanzi) is left as typed.
 * Where the mark goes: on a if there is one, else on o or e, else on the last vowel (so iu -> iú, ui -> uí); i loses its dot. */
(function () {
  const MARKS = {
    a: ['ā', 'á', 'ǎ', 'à'], e: ['ē', 'é', 'ě', 'è'], i: ['ī', 'í', 'ǐ', 'ì'], o: ['ō', 'ó', 'ǒ', 'ò'], u: ['ū', 'ú', 'ǔ', 'ù'], 'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
    A: ['Ā', 'Á', 'Ǎ', 'À'], E: ['Ē', 'É', 'Ě', 'È'], I: ['Ī', 'Í', 'Ǐ', 'Ì'], O: ['Ō', 'Ó', 'Ǒ', 'Ò'], U: ['Ū', 'Ú', 'Ǔ', 'Ù'], 'Ü': ['Ǖ', 'Ǘ', 'Ǚ', 'Ǜ']
  };
  const VOWELS = 'aeiouüAEIOUÜ';
  function markSyllable(letters, tone) {
    // v and u: are the usual ways to type ü
    let s = letters.replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü').replace(/V/g, 'Ü');
    if (tone < 1 || tone > 4) return s;
    let at = -1;
    const low = s.toLowerCase();
    if ((at = low.indexOf('a')) < 0) {
      if ((at = low.indexOf('o')) < 0 && (at = low.indexOf('e')) < 0) {
        for (let i = s.length - 1; i >= 0; i--) { if (VOWELS.indexOf(s[i]) >= 0) { at = i; break; } }
      }
    }
    if (at < 0) return s;
    const m = MARKS[s[at]];
    return m ? s.slice(0, at) + m[tone - 1] + s.slice(at + 1) : s;
  }
  function toMarks(text) {
    // a run of letters (with v / u: for ü) directly followed by a digit is one syllable
    return String(text == null ? '' : text).replace(/([A-Za-zü]+(?::[A-Za-z]*)?)([0-5])/g, function (m, letters, digit) {
      // "u:" inside the run: "nu:3" is one syllable; a colon that is not after u is left alone
      return markSyllable(letters, Number(digit));
    });
  }
  window.ShanluPinyin = { toMarks: toMarks };
})();
