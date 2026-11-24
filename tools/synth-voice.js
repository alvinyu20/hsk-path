/* Made-up voices for the pitch tests: each syllable is a list of pitch points (Hz) over its length, said as a buzz of harmonics with a little
 * breath noise, rising and falling in loudness like a syllable, with a short gap between syllables.  synth([[220, 220], [180, 300]], 16000) */
module.exports = function synth(sylls, rate, opts) {
  const o = Object.assign({ dur:0.38, gap:0.07, lead:0.25, noise:0.01, seed:7 }, opts || {});
  let seed = o.seed; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  const n = Math.round(rate * (o.lead * 2 + sylls.length * o.dur + (sylls.length - 1) * o.gap)), x = new Float32Array(n);
  let phase = 0, at = Math.round(o.lead * rate);
  sylls.forEach((pts, si) => {
    const len = Math.round(o.dur * rate);
    for (let i = 0; i < len; i++) {
      const u = i / (len - 1), seg = u * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(seg)), f0 = pts.length > 1 ? pts[k] + (pts[k + 1] - pts[k]) * (seg - k) : pts[0];
      phase += 2 * Math.PI * f0 / rate;
      let v = 0; for (let h = 1; h <= 10; h++) v += Math.sin(h * phase) / h;
      const env = Math.min(1, u / 0.12, (1 - u) / 0.12);
      x[at + i] = 0.25 * env * v + o.noise * rnd();
    }
    at += len + Math.round(o.gap * rate);
  });
  for (let i = 0; i < n; i++) if (!x[i]) x[i] = o.noise * 0.3 * rnd();
  return x;
};
