/* Quick-fire numbers (Games): numbers, prices, clock times, dates and phone numbers said the way people say them, with four look-alike
 * answers to pick from. Pure functions, so tools/test-numbers.js can check them in Node.
 *   ShanluNumbers.card(step, lv, rnd) -> { zh, py, label, key, opts: [4 labels, the right one included], why, en }
 *   ShanluNumbers.read(step, typed) -> the typed answer in the same form as `key` (null when it cannot be read), so the learner types what they heard
 *   ShanluNumbers.zh(n) -> 二十八, 一百零五, 两万三千 ...   ShanluNumbers.py('二十八块五') -> 'èrshíbā kuài wǔ'
 * step: 'n99' (0 to 99), 'big' (100 and up), 'price', 'time', 'date', 'phone'. lv: the highest HSK level of the view (刻, 差 and 毛 are HSK 3, 万 is HSK 2). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShanluNumbers = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const D = '零一二三四五六七八九';
  const STEPS = [
    { id:'n99', title:'Numbers to 99', sub:'十四 or 四十?' },
    { id:'big', title:'Bigger numbers', sub:'百, 千, 万, and 一百二 = 120' },
    { id:'price', title:'Prices', sub:'块, 毛 and 二十八块五' },
    { id:'time', title:'Clock times', sub:'点, 半, 一刻 and 差五分' },
    { id:'date', title:'Dates', sub:'月 and 号' },
    { id:'phone', title:'Phone numbers', sub:'幺 for 1, three-four-four' }
  ];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

  // a whole number as it is read: 十四, 二十, 一百零五, 一千零五十, 两千, 一万零一十, 两万三千 (two before 千 and 万 is 两; before 百 either)
  function under10k(n, lead, two100) {
    const units = ['千', '百', '十', ''];
    const ds = String(n).padStart(4, '0').split('').map(Number);
    let out = '', zero = false, started = false;
    ds.forEach((d, i) => {
      if (d === 0) { if (started) zero = true; return; }
      if (zero) { out += '零'; zero = false; }
      let c = D[d];
      if (d === 2 && i === 0) c = '两';
      if (d === 2 && i === 1 && two100) c = '两';
      if (d === 1 && i === 2 && lead && !started) c = '';   // 十四, not 一十四, at the start
      out += c + units[i]; started = true;
    });
    return out;
  }
  function zh(n, opt) {
    opt = opt || {};
    if (n === 0) return '零';
    if (n < 10000) return under10k(n, true, opt.two100);
    const w = Math.floor(n / 10000), r = n % 10000;
    return (w === 2 ? '两' : under10k(w, true, opt.two100)) + '万' + (r ? (r < 1000 ? '零' : '') + under10k(r, false, opt.two100) : '');
  }
  // the short spoken form: 一百二 (120), 一千五 (1,500), 两万三 (23,000); null when the number has no such form
  function shortZh(n) {
    for (const [u, c] of [[10000, '万'], [1000, '千'], [100, '百']]) {
      const x = Math.floor(n / u), y = (n % u) / (u / 10);
      if (x >= 1 && x <= 9 && Number.isInteger(y) && y >= 1 && y <= 9) return (x === 2 && u >= 1000 ? '两' : D[x]) + c + D[y];
    }
    return null;
  }

  // pinyin: a number up to the next 百, 千 or 万 is one word; 块, 点, 月 ... stand apart.
  const PY = { '零':'líng', '一':'yī', '二':'èr', '两':'liǎng', '三':'sān', '四':'sì', '五':'wǔ', '六':'liù', '七':'qī', '八':'bā', '九':'jiǔ', '十':'shí', '百':'bǎi', '千':'qiān', '万':'wàn', '幺':'yāo',
    '块':'kuài', '毛':'máo', '分':'fēn', '点':'diǎn', '半':'bàn', '刻':'kè', '差':'chà', '月':'yuè', '号':'hào', '日':'rì' };
  const NUMC = '零一二两三四五六七八九十百千万';
  function py(s) {
    const words = []; let cur = '';
    const chars = s.split('');
    chars.forEach((c, i) => {
      if (c === ' ' || c === '，' || c === ',') { if (cur) words.push(cur); cur = ''; if (c !== ' ') words.push(','); return; }
      let p = PY[c] || c;
      if (c === '一') {
        // 一 changes tone before a following syllable when it counts something: yìbǎi, yíwàn, yí kè, and on its own before a unit (yí kuài, yì máo,
        // yì fēn, yì diǎn for one o'clock). Inside a number (十一, 零一) and in dates (一月, 一号) it stays yī.
        const nx = chars[i + 1], pv = chars[i - 1];
        const alone = !pv || NUMC.indexOf(pv) < 0;
        p = nx === '百' || nx === '千' ? 'yì' : nx === '万' || nx === '刻' ? 'yí' : alone && nx === '块' ? 'yí' : alone && (nx === '毛' || nx === '分' || nx === '点') ? 'yì' : 'yī';
      }
      if (NUMC.indexOf(c) >= 0) {
        cur += (cur && /^[aeoāáǎàēéěèōóǒò]/.test(p) ? "'" : '') + p;
        if ('百千万'.indexOf(c) >= 0 && NUMC.indexOf(chars[i + 1] || '') >= 0) { words.push(cur); cur = ''; }   // big numbers are written in parts: yìbǎi língwǔ, liǎngwàn sānqiān
        return;
      }
      if (cur) words.push(cur); cur = '';
      words.push(p);
    });
    if (cur) words.push(cur);
    return words.join(' ').replace(/ ,/g, ',');
  }

  const uniq4 = (right, cands, rnd, fallback) => {
    const out = [right];
    cands.forEach(c => { if (out.length < 4 && c != null && out.indexOf(c) < 0) out.push(c); });
    let guard = 0; while (out.length < 4 && guard++ < 50) { const c = fallback(); if (out.indexOf(c) < 0) out.push(c); }
    // shuffle
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  };
  const shuffleArr = (rnd, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const fmt = (n) => n.toLocaleString('en-US');

  // what the learner types, made comparable: numbers as digits, prices as yuan.cents, times as h:mm (13:15 counts as 1:15), dates as m/d, phones as 11 digits
  const HINT = { n99:'Type the number, e.g. 14', big:'Type the number, e.g. 1200', price:'Type the price in yuan, e.g. 28.5', time:'Type the time, e.g. 3:15 or 3.15', date:'Type month and day, e.g. 5/20', phone:'Type the 11 digits' };
  function read(step, typed) {
    const t = String(typed || '').trim().replace(/[，,\s]/g, (c) => (step === 'phone' || step === 'big' || step === 'n99' ? '' : ' ')).replace(/[¥￥元]/g, '');
    if (!t) return null;
    if (step === 'n99' || step === 'big') { return /^\d+$/.test(t) ? String(Number(t)) : null; }
    if (step === 'price') { const m = /^(\d*)(?:[.。](\d{1,2}))?$/.exec(t.replace(/\s/g, '')); if (!m || (!m[1] && !m[2])) return null; const cents = Number(m[1] || 0) * 100 + Number(((m[2] || '') + '00').slice(0, 2)); return (cents / 100).toFixed(2); }
    if (step === 'time') {
      let h, mi; const m = /^(\d{1,2})\s*[:.。点\s]\s*(\d{1,2})$/.exec(t) || /^(\d{1,2})(\d{2})$/.exec(t.replace(/\s/g, ''));
      if (m) { h = Number(m[1]); mi = Number(m[2]); } else if (/^\d{1,2}$/.test(t)) { h = Number(t); mi = 0; } else return null;
      if (h > 23 || mi > 59) return null; if (h > 12) h -= 12; if (h === 0) h = 12;
      return h + ':' + String(mi).padStart(2, '0');
    }
    if (step === 'date') {
      const m = /^(\d{1,2})\s*[/.\-。月\s]\s*(\d{1,2})\s*[号日]?$/.exec(t); if (!m) return null;
      const mo = Number(m[1]), d = Number(m[2]); return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? mo + '/' + d : null;
    }
    const dg = t.replace(/\D/g, ''); return dg.length ? dg : null;
  }
  function card(step, lv, rnd) {
    const c = card0(step, lv, rnd);
    c.key = read(step, step === 'date' ? (MONTHS.indexOf(c.label.split(' ')[0]) + 1) + '/' + c.label.split(' ')[1] : c.label);
    c.hint = HINT[step];
    return c;
  }
  function card0(step, lv, rnd) {
    rnd = rnd || Math.random;
    if (step === 'n99') {
      // the easy-to-mix ones come up more: 11-19, the tens, and numbers with a 4 or 10 in them
      const n = rnd() < 0.5 ? pick(rnd, [11, 12, 13, 14, 15, 16, 17, 18, 19, 40, 41, 44, 14, 47, 70, 17, 74, 10, 4, 24, 42, 90, 19]) : int(rnd, 0, 99);
      const a = Math.floor(n / 10), b = n % 10;
      const c = shuffleArr(rnd, [b * 10 + a, a * 10 + a, b * 10 + b, a * 10, b, 10 + b, a * 10 + (b + 1) % 10]).filter(x => x >= 0 && x <= 99 && x !== n);
      const opts = uniq4(String(n), c.map(String), rnd, () => String(int(rnd, 0, 99)));
      const why = n >= 11 && n <= 19 ? '十' + D[b] + ' is ten plus ' + b + ': ' + n + '.' + (b > 1 ? ' ' + D[b] + '十 would be ' + (b * 10) + '.' : '')
        : n >= 20 && b ? D[a] + '十' + D[b] + ': ' + a + ' tens and ' + b + '.'
        : n >= 20 ? D[a] + '十 is ' + a + ' tens: ' + n + '. 十' + D[a] + ' would be ' + (10 + a) + '.' : '';
      return { zh:zh(n), py:py(zh(n)), label:String(n), opts, why, en:'a number' };
    }
    if (step === 'big') {
      const maxN = lv >= 2 ? 99999 : 9999;
      let n, z, why = '';
      if (rnd() < 0.4) {   // the short spoken form
        const u = pick(rnd, lv >= 2 ? [100, 1000, 10000] : [100, 1000]);
        n = int(rnd, 1, 9) * u + int(rnd, 1, 9) * (u / 10);
        z = shortZh(n);
        why = z + ' is short for ' + zh(n) + ': ' + fmt(n) + '. The last unit is left out when it is the next one down.';
      } else {
        n = rnd() < 0.5 ? pick(rnd, [101, 105, 110, 1005, 1050, 1500, 2008, 2020, 3600, 10010, 20500, 12000, 120]) : int(rnd, 100, maxN);
        if (n > maxN) n = int(rnd, 100, maxN);
        z = zh(n, { two100:rnd() < 0.5 });
        why = /零/.test(z) ? '零 stands for the empty places: ' + fmt(n) + '.' : '';
      }
      const s = String(n), cands = [];
      cands.push(n * 10, Math.round(n / 10));
      const ds = s.split('');
      const nz = ds.map((d, i) => (d !== '0' ? i : -1)).filter(i => i >= 0);
      if (nz.length >= 2) { const x = ds.slice(); const i = nz[nz.length - 1]; if (i < x.length - 1) { x[i + 1] = x[i]; x[i] = '0'; cands.push(Number(x.join(''))); } }
      if (shortZh(n)) { const y = Math.floor(n / Math.pow(10, Math.floor(Math.log10(n)))) * Math.pow(10, Math.floor(Math.log10(n))) + Number(ds[1]); cands.push(y); }
      cands.push(n + Math.pow(10, Math.floor(Math.log10(n)) - 1));
      const opts = uniq4(fmt(n), shuffleArr(rnd, cands).filter(x => x >= 1 && x !== n).map(fmt), rnd, () => fmt(int(rnd, 100, maxN)));
      return { zh:z, py:py(z), label:fmt(n), opts, why, en:'a number' };
    }
    if (step === 'price') {
      let y = rnd() < 0.3 ? int(rnd, 1, 9) : rnd() < 0.8 ? int(rnd, 10, 99) : int(rnd, 101, 199);   // not 100 itself: 一百块六 is not how ¥100.60 is said
      let j = rnd() < 0.6 ? int(rnd, 1, 9) : 0, f = 0, yy = y, z, why = '';
      const zy = (v) => (v === 2 ? '两' : zh(v));
      const kind = rnd();
      if (lv >= 3 && kind < 0.15) { yy = 0; j = j || int(rnd, 1, 9); z = (j === 2 ? '两' : D[j]) + '毛'; why = '毛 is a tenth of a yuan (in writing 角): ¥0.' + j + '0.'; }
      else if (kind < 0.25) { f = int(rnd, 1, 9); j = 0; z = zy(y) + '块零' + D[f] + '分'; why = '零' + D[f] + '分 is ' + f + ' fen: ¥' + y + '.0' + f + '.'; }
      else if (j && lv >= 3 && kind < 0.45) { z = zy(y) + '块' + D[j] + '毛'; why = '块 is the yuan, 毛 the tenths.'; }
      else if (j) { z = zy(y) + '块' + D[j]; why = 'A number after 块 is the tenths (毛), so ' + zy(y) + '块' + D[j] + ' is ¥' + y + '.' + j + '0.'; }
      else z = zy(y) + '块';
      const lab = (a, b, c) => '¥' + a + '.' + b + c;
      const right = lab(yy, j, f);
      const cands = [lab(yy, 0, j || f), lab(j || f, 0, 0), lab(yy * 10 + j, 0, 0), lab(yy, f, j), lab(yy + 1, j, f), lab(Math.max(1, yy - 10), j, f), lab(yy, (j + 5) % 10, f)];
      const opts = uniq4(right, shuffleArr(rnd, cands).filter(x => x !== right && x !== '¥0.00'), rnd, () => lab(int(rnd, 1, 99), int(rnd, 0, 9), 0));
      return { zh:z, py:py(z), label:right, opts, why, en:'a price' };
    }
    if (step === 'time') {
      const h = int(rnd, 1, 12); let m = pick(rnd, [0, 30, 15, 45, 5, 10, 20, 50, 55, int(rnd, 1, 59)]);
      const zh2 = (v) => (v === 2 ? '两' : zh(v));
      let z, why = '';
      if (m === 0) z = zh2(h) + '点';
      else if (m === 30) { z = zh2(h) + '点半'; why = '半 is half past.'; }
      else if (m === 15 && lv >= 3 && rnd() < 0.6) { z = zh2(h) + '点一刻'; why = '一刻 is a quarter of an hour: 15 minutes.'; }
      else if (m === 45 && lv >= 3 && rnd() < 0.6) { z = zh2(h) + '点三刻'; why = '三刻 is three quarters: 45 minutes.'; }
      else if (m >= 50 && lv >= 3 && rnd() < 0.6) { const h2 = h % 12 + 1; z = '差' + zh(60 - m) + '分' + zh2(h2) + '点'; why = '差' + zh(60 - m) + '分' + zh2(h2) + '点 is ' + (60 - m) + ' to ' + h2 + ': ' + h + ':' + String(m).padStart(2, '0') + '.'; }
      else if (m < 10) { z = zh2(h) + '点零' + D[m] + (rnd() < 0.5 ? '分' : ''); why = '零 shows the minutes are under ten: :0' + m + '.'; }
      else z = zh2(h) + '点' + zh(m) + (rnd() < 0.5 ? '分' : '');
      const lab = (a, b) => a + ':' + String(b).padStart(2, '0');
      const right = lab(h, m);
      const cands = [lab(h, (m + 30) % 60), lab(h % 12 + 1, m), lab(h, m === 15 ? 45 : m === 45 ? 15 : (m + 10) % 60), lab(h === 1 ? 12 : h - 1, m), lab(h, m % 10 * 10 + Math.floor(m / 10) <= 59 ? m % 10 * 10 + Math.floor(m / 10) : m + 1), lab(h, 60 - m === 60 ? 5 : 60 - m)];
      const opts = uniq4(right, shuffleArr(rnd, cands).filter(x => x !== right), rnd, () => lab(int(rnd, 1, 12), int(rnd, 0, 11) * 5));
      return { zh:z, py:py(z), label:right, opts, why, en:'a clock time' };
    }
    if (step === 'date') {
      const mo = int(rnd, 1, 12), dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
      const d = rnd() < 0.5 ? pick(rnd, [2, 10, 12, 14, 20, 21, 24, 4, 11, 1].filter(x => x <= dim)) : int(rnd, 1, dim);
      const z = zh(mo) + '月' + zh(d) + (rnd() < 0.7 ? '号' : '日');
      const lab = (a, b) => MONTHS[a - 1] + ' ' + b;
      const right = lab(mo, d);
      const ok = (a, b) => a >= 1 && a <= 12 && b >= 1 && b <= 31;
      const cands = [[d, mo], [mo, d % 10 * 10 + Math.floor(d / 10)], [mo % 12 + 1, d], [mo, d + 10], [mo, d - 10], [mo === 1 ? 12 : mo - 1, d]].filter(p => ok(p[0], p[1])).map(p => lab(p[0], p[1]));
      const opts = uniq4(right, shuffleArr(rnd, cands).filter(x => x !== right), rnd, () => lab(int(rnd, 1, 12), int(rnd, 1, 28)));
      return { zh:z, py:py(z), label:right, opts, why:'The month comes first: ' + zh(mo) + '月 is ' + MONTHS[mo - 1] + ', then the day.', en:'a date' };
    }
    // phone: 1 + 10 digits, read digit by digit in groups of 3-4-4, with 幺 for 1
    const digits = '1' + pick(rnd, ['3', '5', '8', '9']) + Array.from({ length:9 }, () => int(rnd, 0, 9)).join('');
    const say = (s) => s.split('').map(c => (c === '1' ? '幺' : D[Number(c)])).join('');
    const z = say(digits.slice(0, 3)) + '，' + say(digits.slice(3, 7)) + '，' + say(digits.slice(7));
    const lab = (s) => s.slice(0, 3) + ' ' + s.slice(3, 7) + ' ' + s.slice(7);
    const swap = (s, i, c) => s.slice(0, i) + c + s.slice(i + 1);
    const cands = [];
    for (let k = 0; k < 8; k++) {
      const i = int(rnd, 3, 10), c = digits[i];
      const alt = c === '1' ? '7' : c === '7' ? '1' : c === '6' ? '9' : c === '9' ? '6' : c === '4' ? '0' : String((Number(c) + int(rnd, 1, 9)) % 10);
      cands.push(lab(swap(digits, i, alt)));
    }
    const right = lab(digits);
    const opts = uniq4(right, cands.filter(x => x !== right), rnd, () => lab(swap(digits, int(rnd, 3, 10), String(int(rnd, 0, 9)))));
    return { zh:z, py:z.split('，').map(g => g.split('').map(c => (c === '幺' ? 'yāo' : PY[c])).join(' ')).join(', '), label:right, opts,
      why:/幺/.test(z.slice(3)) ? '幺 (yāo) is how 1 is read in phone numbers, so it does not sound like 七 (qī).' : 'Phone numbers are read digit by digit, in groups of 3, 4 and 4.', en:'a phone number' };
  }

  return { STEPS, card, read, zh, shortZh, py, HINT };
}));
