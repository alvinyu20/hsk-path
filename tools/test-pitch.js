/* Unit test for pitch.js (D2): made-up voices (a low and a high voice) with known tones. Right tones are accepted, clearly wrong ones rejected,
 * and the pitch found is the pitch made.   node tools/test-pitch.js   (accuracy on the site's real recordings: node tools/eval-pitch.js) */
const path = require('path');
const P = require(path.join(__dirname, '..', 'pitch.js'));
const synth = require('./synth-voice');
let bad = 0, n = 0;
const check = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const R = 16000;
// tone shapes as multiples of the voice's middle pitch (1 high level, 2 rise, 3 dip, 4 fall)
const SHAPE = { 1:[1.25, 1.25], 2:[0.95, 1.05, 1.35], 3:[0.85, 0.72, 0.9], 4:[1.35, 0.8], low3:[0.8, 0.72] };
for (const base of [115, 220]) {
  const hz = (s) => s.map(k => k * base);
  // the pitch found is the pitch made
  const flat = P.track(synth([[base, base]], R), R).filter(f => f.f0);
  const med = flat.map(f => f.f0).sort((a, b) => a - b)[flat.length >> 1];
  check(flat.length > 20 && Math.abs(med - base) / base < 0.03, 'a steady ' + base + ' Hz voice is tracked at ' + Math.round(med) + ' Hz');
  // one syllable: each tone accepted for itself; level and falling never mixed up, rising and falling never mixed up
  for (const t of [1, 2, 3, 4]) {
    const r = P.analyse(synth([hz(SHAPE[t])], R), R, 1);
    check(r.ok && P.judge(r.syl[0], t, { last:true, n:1 }).ok, base + ' Hz, tone ' + t + ' alone is accepted (' + (r.syl[0] || {}).shape + ')');
    const never = { 1:[2, 4], 2:[1, 4], 4:[1, 2] }[t] || [];
    never.forEach(w => check(!P.judge(r.syl[0], w, { last:true, n:1 }).ok, base + ' Hz, tone ' + t + ' alone is not accepted as tone ' + w));
  }
  // two syllables: right tones accepted; a level tone where a 4 is wanted, and a fall where a 2 is wanted, are marked
  const words = [[[3, 1], ['low3', 1]], [[4, 1], [4, 1]], [[1, 2], [1, 2]], [[2, 4], [2, 4]], [[1, 4], [1, 4]]];
  for (const [t, sh] of words) {
    const r = P.analyse(synth(sh.map(k => hz(SHAPE[k])), R), R, 2);
    const ok = t.every((w, i) => P.judge(r.syl[i], w, { last:i === 1, next:t[i + 1], n:2 }).ok);
    check(r.ok && ok, base + ' Hz, the word ' + t.join('+') + ' is accepted (' + r.syl.map(s => s.shape).join(', ') + ')');
  }
  const flat4 = P.analyse(synth([hz(SHAPE[1]), hz(SHAPE[1])], R), R, 2);
  check(!P.judge(flat4.syl[0], 4, { last:false, next:1, n:2 }).ok, base + ' Hz, a level 1st syllable is not accepted as a 4');
  const fall2 = P.analyse(synth([hz(SHAPE[1]), hz(SHAPE[4])], R), R, 2);
  check(!P.judge(fall2.syl[1], 2, { last:true, n:2 }).ok, base + ' Hz, a falling 2nd syllable is not accepted as a 2');
}
// silence and noise: no pitch
check(!P.analyse(new Float32Array(R), R, 1).ok, 'silence has no pitch');
const noise = new Float32Array(R); let s = 3; for (let i = 0; i < R; i++) { s = (s * 16807) % 2147483647; noise[i] = (s / 2147483647 - 0.5) * 0.3; }
check(!P.analyse(noise, R, 1).ok, 'noise has no pitch');
if (bad) { console.log(bad + ' of ' + n + ' pitch checks failed'); process.exit(1); }
console.log('pitch tests passed (' + n + ' checks)');
