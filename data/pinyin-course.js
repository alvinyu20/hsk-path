/* The pinyin and tones mini course ("Pinyin" screen, Learn). HAND WRITTEN; checked by tools/check-pinyin-course.py (every pinyin spelling is compared
 * with pypinyin, and every example that is an HSK 1-3 word is compared with the word lists).
 * Status: written by AI, NOT yet read by a human Chinese teacher. The English comparisons for sounds ("like the p in spin") are the usual textbook
 * approximations, not exact; the tap-to-hear audio is the browser voice, which differs from device to device.
 *
 * Block types:  p (text)   tip (highlighted note)   parts (three cards)   say (tap-to-hear list: zh, py, en, split?)
 *               groups (cards of sounds: each cell has s = the sound, zh/py/en = an example word)   tones (the tone panel)   table (head + rows)
 *               typing (the typing practice box)   check (self-check questions)   pair (two contrasted words) */
window.SHANLU_PYCOURSE = {
  lessons: [
    {
      id: 'syllable', glyph: '拼', title: 'How a syllable is built', blurb: 'Initial, final and tone: the three parts of every sound.', mins: 3,
      blocks: [
        { t: 'p', x: 'Pinyin is the Latin-letter spelling of Mandarin. It is not English spelling: letters such as q, x, zh and c stand for Chinese sounds, so some of them are not what you would guess. Treat it as a map of sounds.' },
        { t: 'p', x: 'Each character is one syllable (the main exception is the 儿 ending, which joins the syllable before it). A syllable has up to three parts:' },
        { t: 'parts', items: [
          { h: 'Initial', x: 'The opening consonant. Some syllables have none.' },
          { h: 'Final', x: 'The vowel part, sometimes ending in n or ng.' },
          { h: 'Tone', x: 'The pitch shape. It is written as a mark over the vowel.' }
        ] },
        { t: 'say', title: 'Tap to hear, and see the parts', items: [
          { zh: '妈', py: 'mā', en: 'mom', split: 'm + a + tone 1' },
          { zh: '你', py: 'nǐ', en: 'you', split: 'n + i + tone 3' },
          { zh: '好', py: 'hǎo', en: 'good', split: 'h + ao + tone 3' },
          { zh: '爱', py: 'ài', en: 'to love', split: 'no initial + ai + tone 4' },
          { zh: '中国', py: 'Zhōngguó', en: 'China', split: 'zh + ong + tone 1, then g + uo + tone 2' }
        ] },
        { t: 'tip', x: 'The tone belongs to the word. In English, pitch changes the mood of a sentence. In Mandarin it changes the word: mā (妈, mom) and mǎ (马, horse) are different words.' },
        { t: 'check', qs: [
          { q: 'In 好 hǎo, which part is the final?', o: ['h', 'ao', 'the third tone mark'], a: 1, why: 'h is the initial, ao is the final, and the mark ˇ is the tone.' },
          { q: 'In 爱 ài, what is the initial?', o: ['a', 'i', 'There is none'], a: 2, why: 'ài starts straight with the final ai. A syllable with no initial is normal.' },
          { q: 'mā and mǎ differ only in their tone. What does that mean for meaning?', o: ['Nothing, it is the same word', 'They are different words', 'One is just louder'], a: 1, why: 'In Mandarin the tone is part of the word, so mā (mom) and mǎ (horse) are different words.' }
        ] }
      ]
    },
    {
      id: 'initials', glyph: '声', title: 'The 21 initials', blurb: 'Six families of consonants, and the puff-of-air rule.', mins: 5,
      blocks: [
        { t: 'p', x: 'Mandarin has 21 initials. They sort into families by where the sound is made. Tap a sound to hear a word that starts with it.' },
        { t: 'groups', items: [
          { h: 'Lips: b p m f', cells: [
            { s: 'b', zh: '爸爸', py: 'bàba', en: 'dad' }, { s: 'p', zh: '朋友', py: 'péngyou', en: 'friend' },
            { s: 'm', zh: '妈妈', py: 'māma', en: 'mom' }, { s: 'f', zh: '饭', py: 'fàn', en: 'meal' } ] },
          { h: 'Tongue tip: d t n l', cells: [
            { s: 'd', zh: '弟弟', py: 'dìdi', en: 'younger brother' }, { s: 't', zh: '他', py: 'tā', en: 'he' },
            { s: 'n', zh: '你', py: 'nǐ', en: 'you' }, { s: 'l', zh: '来', py: 'lái', en: 'to come' } ] },
          { h: 'Back of the tongue: g k h', cells: [
            { s: 'g', zh: '哥哥', py: 'gēge', en: 'older brother' }, { s: 'k', zh: '看', py: 'kàn', en: 'to look' },
            { s: 'h', zh: '喝', py: 'hē', en: 'to drink' } ] },
          { h: 'Smile sounds: j q x', note: 'Spread your lips as if smiling and keep the tongue flat, with its tip behind the lower front teeth. j, q and x are only ever followed by i or ü sounds.', cells: [
            { s: 'j', zh: '九', py: 'jiǔ', en: 'nine' }, { s: 'q', zh: '七', py: 'qī', en: 'seven' },
            { s: 'x', zh: '谢谢', py: 'xièxie', en: 'thanks' } ] },
          { h: 'Curled tongue: zh ch sh r', note: 'Curl the tip of the tongue up and back. r is a buzzing sound, a little like a voiced sh.', cells: [
            { s: 'zh', zh: '这', py: 'zhè', en: 'this' }, { s: 'ch', zh: '吃', py: 'chī', en: 'to eat' },
            { s: 'sh', zh: '十', py: 'shí', en: 'ten' }, { s: 'r', zh: '人', py: 'rén', en: 'person' } ] },
          { h: 'Tongue tip forward: z c s', note: 'The tip of the tongue stays just behind the upper front teeth.', cells: [
            { s: 'z', zh: '在', py: 'zài', en: 'at' }, { s: 'c', zh: '菜', py: 'cài', en: 'dish' },
            { s: 's', zh: '三', py: 'sān', en: 'three' } ] }
        ] },
        { t: 'tip', x: 'The rule that helps most: six pairs differ by a puff of air. b/p, d/t, g/k, j/q, zh/ch and z/c. The second one of each pair is said with a strong puff (aspirated), the first with almost none. Hold a strip of paper in front of your mouth: it should flutter for p, t, k, q, ch, c and hardly move for b, d, g, j, zh, z.' },
        { t: 'pair', title: 'Hear the puff', a: { zh: '爸', py: 'bà', en: 'dad (almost no puff)' }, b: { zh: '怕', py: 'pà', en: 'to fear (strong puff)' } },
        { t: 'p', x: 'Rough English comparisons (only a first approximation): b is like the p in spin, p like the p in pin; d like the t in stop, t like the t in top; g like the k in sky, k like the k in key. z is like the ds in kids, c like the ts in cats.' },
        { t: 'check', qs: [
          { q: 'Which pair differs by a puff of air?', o: ['b and p', 'm and n', 'x and s'], a: 0, why: 'b has almost no puff of air, p has a strong one. The same goes for d/t, g/k, j/q, zh/ch and z/c.' },
          { q: 'What is the initial of 中 zhōng?', o: ['z', 'zh', 'h'], a: 1, why: 'zh is one sound written with two letters, not z followed by h.' },
          { q: 'Which initials can only be followed by i or ü sounds?', o: ['j, q, x', 'b, p, m', 'zh, ch, sh'], a: 0, why: 'j, q and x only come before i and ü sounds (ü is written u after them: jù, qù, xué).' }
        ] }
      ]
    },
    {
      id: 'finals', glyph: '韵', title: 'The finals', blurb: 'Simple vowels, vowel pairs, the n and ng endings, and the tricky i and ü.', mins: 6,
      blocks: [
        { t: 'p', x: 'The final is everything after the initial. There are a few dozen of them. Learn them in families.' },
        { t: 'groups', items: [
          { h: 'Single vowels', cells: [
            { s: 'a', zh: '八', py: 'bā', en: 'eight' }, { s: 'o', zh: '破', py: 'pò', en: 'broken' },
            { s: 'e', zh: '喝', py: 'hē', en: 'to drink' }, { s: 'i', zh: '七', py: 'qī', en: 'seven' },
            { s: 'u', zh: '五', py: 'wǔ', en: 'five' }, { s: 'ü', zh: '女', py: 'nǚ', en: 'female' },
            { s: 'er', zh: '二', py: 'èr', en: 'two' } ] },
          { h: 'Vowel pairs', cells: [
            { s: 'ai', zh: '百', py: 'bǎi', en: 'hundred' }, { s: 'ei', zh: '给', py: 'gěi', en: 'to give' },
            { s: 'ao', zh: '好', py: 'hǎo', en: 'good' }, { s: 'ou', zh: '有', py: 'yǒu', en: 'to have' } ] },
          { h: 'Ending in n or ng', cells: [
            { s: 'an', zh: '看', py: 'kàn', en: 'to look' }, { s: 'en', zh: '很', py: 'hěn', en: 'very' },
            { s: 'ang', zh: '上', py: 'shàng', en: 'on, up' }, { s: 'eng', zh: '冷', py: 'lěng', en: 'cold' },
            { s: 'ong', zh: '中国', py: 'Zhōngguó', en: 'China' } ] },
          { h: 'Starting with i', cells: [
            { s: 'ia', zh: '家', py: 'jiā', en: 'home' }, { s: 'ie', zh: '写', py: 'xiě', en: 'to write' },
            { s: 'iao', zh: '小', py: 'xiǎo', en: 'small' }, { s: 'iu', zh: '六', py: 'liù', en: 'six' },
            { s: 'ian', zh: '天', py: 'tiān', en: 'day' }, { s: 'in', zh: '新', py: 'xīn', en: 'new' },
            { s: 'iang', zh: '两', py: 'liǎng', en: 'two' }, { s: 'ing', zh: '请', py: 'qǐng', en: 'please' },
            { s: 'iong', zh: '用', py: 'yòng', en: 'to use' } ] },
          { h: 'Starting with u', cells: [
            { s: 'ua', zh: '花', py: 'huā', en: 'flower' }, { s: 'uo', zh: '说', py: 'shuō', en: 'to speak' },
            { s: 'uai', zh: '块', py: 'kuài', en: 'yuan' }, { s: 'ui', zh: '对', py: 'duì', en: 'right' },
            { s: 'uan', zh: '穿', py: 'chuān', en: 'to wear' }, { s: 'un', zh: '春天', py: 'chūntiān', en: 'spring' },
            { s: 'uang', zh: '床', py: 'chuáng', en: 'bed' } ] },
          { h: 'Starting with ü', note: 'After j, q, x and y the two dots are left off: the spelling is ue, uan, un, but the sound is üe, üan, ün.', cells: [
            { s: 'üe', zh: '月', py: 'yuè', en: 'month' }, { s: 'üan', zh: '元', py: 'yuán', en: 'yuan' },
            { s: 'ün', zh: '云', py: 'yún', en: 'cloud' } ] }
        ] },
        { t: 'p', x: 'Four things to watch:' },
        { t: 'table', head: ['Watch for', 'What to know'], rows: [
          ['ü', 'Say ee (as in see), then round your lips without moving the tongue.'],
          ['i after z c s zh ch sh r', 'Not ee. It is a buzzed sound with the tongue where it was for the initial: sì 四, shí 十, chī 吃, rì 日.'],
          ['e', 'Usually a relaxed uh with the lips spread (hē 喝). In ie and üe it is more like the e in yes (xiě 写).'],
          ['an / ang, en / eng, in / ing', 'The difference is the ending. n: the tongue tip touches the ridge behind the upper teeth. ng: the back of the tongue lifts, and the tip stays down.']
        ] },
        { t: 'pair', title: 'n or ng?', a: { zh: '新', py: 'xīn', en: 'new' }, b: { zh: '星', py: 'xīng', en: 'star' } },
        { t: 'check', qs: [
          { q: 'How do you make the ü sound?', o: ['Say ee, then round the lips', 'Say oo, then spread the lips', 'Say u as in up'], a: 0, why: 'ü is the ee sound with rounded lips. Keep the tongue still and change only the lips.' },
          { q: 'Is the i in 四 sì the ee sound?', o: ['Yes', 'No, it is a buzzed sound'], a: 1, why: 'After z, c, s, zh, ch, sh and r the letter i stands for a buzzed sound, not for ee.' },
          { q: 'Which pair differs by n and ng?', o: ['xīn and xīng', 'xīn and xìn'], a: 0, why: 'xīn (新) ends in n and xīng (星) ends in ng. xīn and xìn differ in tone, not in the ending.' }
        ] }
      ]
    },
    {
      id: 'tones', glyph: '调', title: 'The four tones and the neutral tone', blurb: 'The shapes of the tones, the marks, and where the mark goes.', mins: 5,
      blocks: [
        { t: 'p', x: 'Mandarin has four tones and a neutral one. Picture your voice on a five-step ladder, 1 low and 5 high.' },
        { t: 'tones' },
        { t: 'tip', x: 'Tone 3 is only a full dip when it stands alone or ends a phrase. Before another syllable it is usually only the low part: low and short, without the rise. That is normal.' },
        { t: 'p', x: 'The neutral tone has no mark: it is short and light, and its pitch follows the tone before it. It is common in the second syllable of many words.' },
        { t: 'say', title: 'Neutral tone in words', items: [
          { zh: '妈妈', py: 'māma', en: 'mom' },
          { zh: '谢谢', py: 'xièxie', en: 'thanks' },
          { zh: '朋友', py: 'péngyou', en: 'friend' },
          { zh: '名字', py: 'míngzi', en: 'name' }
        ] },
        { t: 'p', x: 'Where does the tone mark go? Look for the vowel in this order:' },
        { t: 'table', head: ['Rule', 'Examples'], rows: [
          ['a gets it if there is one', 'hǎo 好, kàn 看, xiǎo 小'],
          ['otherwise o or e', 'dōu 都, shuō 说, gěi 给, xiě 写'],
          ['in iu and ui, the second vowel', 'liù 六, duì 对'],
          ['i loses its dot when it takes a mark', 'yī 一, nǐ 你']
        ] },
        { t: 'p', x: 'To practice hearing the tones, open the Tone trainer in the Listening lab.' },
        { t: 'check', qs: [
          { q: 'Which tone rises, like a question?', o: ['Tone 1', 'Tone 2', 'Tone 4'], a: 1, why: 'Tone 2 rises, from the middle to high, like saying "Really?".' },
          { q: 'Where does the tone mark go in liù (六)?', o: ['On the i', 'On the u'], a: 1, why: 'In iu and ui the mark goes on the second vowel, so liù and duì.' },
          { q: 'How is the second syllable of 妈妈 māma said?', o: ['Rising', 'Short and light', 'Falling'], a: 1, why: 'It is the neutral tone: short and light, with no mark.' }
        ] }
      ]
    },
    {
      id: 'changes', glyph: '变', title: 'Tone changes', blurb: 'Third tones in a row, and the words 不 and 一.', mins: 4,
      blocks: [
        { t: 'p', x: 'A few tones change in connected speech. Three rules cover most of what you meet in HSK 1 to 3.' },
        { t: 'p', x: '1. Two third tones in a row: the first one is said as a second tone. You say ní hǎo, and you still write nǐ hǎo. This site accepts both when you type.' },
        { t: 'say', items: [
          { zh: '你好', py: 'nǐ hǎo', en: 'hello (said ní hǎo)' },
          { zh: '很好', py: 'hěn hǎo', en: 'very good (said hén hǎo)' },
          { zh: '可以', py: 'kěyǐ', en: 'can (said kéyǐ)' }
        ] },
        { t: 'p', x: '2. 不 bù becomes bú before a fourth tone.' },
        { t: 'say', items: [
          { zh: '不好', py: 'bù hǎo', en: 'not good', split: 'before tone 3: stays bù' },
          { zh: '不是', py: 'bú shì', en: 'is not', split: 'before tone 4: bú' },
          { zh: '不对', py: 'bú duì', en: 'not right', split: 'before tone 4: bú' },
          { zh: '不去', py: 'bú qù', en: 'will not go', split: 'before tone 4: bú' }
        ] },
        { t: 'p', x: '3. 一 is yī on its own, in counting, dates and ordinals. In front of another syllable it changes: yí before a fourth tone, yì before tones 1, 2 and 3.' },
        { t: 'say', items: [
          { zh: '一个', py: 'yí ge', en: 'one (item)', split: 'before tone 4: yí' },
          { zh: '一天', py: 'yì tiān', en: 'one day', split: 'before tone 1: yì' },
          { zh: '一年', py: 'yì nián', en: 'one year', split: 'before tone 2: yì' },
          { zh: '一点', py: 'yì diǎn', en: 'a little', split: 'before tone 3: yì' },
          { zh: '第一', py: 'dì yī', en: 'first', split: 'ordinal: stays yī' },
          { zh: '星期一', py: 'xīngqī yī', en: 'Monday', split: 'counting: stays yī' }
        ] },
        { t: 'tip', x: 'The sentences on this site write the changed tone for 不 and 一 (bú shì, yí ge), because that is how they are said. A word you learn on its own keeps its own tone: 不 bù, 一 yī.' },
        { t: 'check', qs: [
          { q: 'You say ní hǎo. How is it written in pinyin?', o: ['ní hǎo', 'nǐ hǎo'], a: 1, why: 'The change is not written. You write nǐ hǎo and say ní hǎo.' },
          { q: 'How is 不对 said?', o: ['bù duì', 'bú duì'], a: 1, why: 'duì is a fourth tone, so 不 becomes bú.' },
          { q: 'Which is right for 一年 (one year)?', o: ['yī nián', 'yí nián', 'yì nián'], a: 2, why: 'nián is a second tone, so 一 is said yì.' }
        ] }
      ]
    },
    {
      id: 'spelling', glyph: '写', title: 'Spelling rules', blurb: 'y, w, the dots on ü, apostrophes and short forms.', mins: 4,
      blocks: [
        { t: 'p', x: 'Pinyin has a few spelling conventions. They look odd at first, and then they are easy to spot.' },
        { t: 'table', head: ['Rule', 'Example'], rows: [
          ['A syllable that would start with i is written with y.', 'i → yi 一 · ia → ya · ie → ye 也 · in → yin · ing → ying'],
          ['A syllable that would start with u is written with w.', 'u → wu 五 · uo → wo 我 · uai → wai 外 · ui → wei 喂'],
          ['A syllable that would start with ü is written with yu.', 'ü → yu 雨 · üe → yue 月 · üan → yuan 元'],
          ['ü loses its dots after j, q, x and y.', 'jù 句 · qù 去 · xué 学 · yuè 月'],
          ['ü keeps its dots after n and l, where u is a different sound.', 'nǚ 女 (ü) and nǔ 努 (u) · lǜ 绿 (ü)'],
          ['Three finals are written short: iu, ui, un.', 'liù 六 (really liou) · duì 对 (duei) · chūn 春 (chuen)'],
          ['An apostrophe separates a syllable that starts with a, o or e.', 'Xī’ān 西安 is not xiān 先 · shí’èr 十二']
        ] },
        { t: 'say', title: 'Tap to hear the pairs', items: [
          { zh: '先', py: 'xiān', en: 'first (one syllable)' },
          { zh: '西安', py: 'Xī’ān', en: 'Xi’an (two syllables)' }
        ] },
        { t: 'tip', x: 'Names and words are written together as words, not syllable by syllable: Zhōngguó, not Zhōng Guó. Names start with a capital letter. The 儿 ending is written r (yìdiǎnr). You can show it or hide it in Settings.' },
        { t: 'check', qs: [
          { q: 'How is a syllable that would start with u written, for example the word 五?', o: ['u', 'wu', 'yu'], a: 1, why: 'u at the start of a syllable is written w: wǔ.' },
          { q: 'Why is it xué (学) and not xüé?', o: ['The dots drop after j, q, x and y', 'It is a typing mistake'], a: 0, why: 'After j, q, x and y only the ü sound is possible, so the dots are left off.' },
          { q: 'What does the apostrophe do in Xī’ān?', o: ['Nothing', 'It shows where one syllable ends and the next starts'], a: 1, why: 'Without it, xian could be read as the single syllable xiān (先).' }
        ] }
      ]
    },
    {
      id: 'typing', glyph: '键', title: 'Typing pinyin here', blurb: 'How to enter tones on any keyboard, and what the answer box accepts.', mins: 3,
      blocks: [
        { t: 'typing' },
        { t: 'check', qs: [
          { q: 'How do you type 你好 with tone numbers?', o: ['ni3 hao3', 'ni hao 3', 'ni1 hao1'], a: 0, why: 'The number goes right after the syllable it belongs to: ni3 hao3.' },
          { q: 'How do you type the ü in 女 nǚ without a special keyboard?', o: ['nv3', 'nu3 (the number does the work)', 'n:3'], a: 0, why: 'v stands for ü: nv3 gives nǚ. Typing u: also works.' }
        ] }
      ]
    }
  ]
};
