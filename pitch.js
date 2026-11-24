/* Tone feedback from a pitch curve (D2). Everything runs in the browser: the recording is never uploaded.
 *   track(samples, rate)          -> frames every 10 ms: { t (s), f0 (Hz, 0 when unvoiced), rms }
 *   analyse(samples, rate, n)     -> { ok, why, ref (Hz), curve: [{ x 0..1, st }], syl: [{ from, to, tone, shape, st:[…] }] } for n syllables
 *   TONE_SHAPE[t]                 -> the ideal contour of tone t (Chao's numbers, in semitones around the speaker's middle), for drawing
 * The pitch is found with YIN (de Cheveigné & Kawahara 2002) on 40 ms windows. Tones are judged by shape in semitones around the speaker's own
 * middle pitch, so a high or a low voice is judged the same way: level and high (1), rising (2), low or dipping (3), falling (4).
 * The thresholds were tuned on the site's own recordings (tools/eval-pitch.js) and on made-up voices (tools/test-pitch.js).
 * Node: require('./pitch.js') returns the same object. */
(function (root) {
  var HOP = 0.01, WIN = 0.025, FMIN = 70, FMAX = 500, THRESH = 0.3, LOOSE = 0.5;

  // to 16 kHz (a plain average over each step is enough for voice pitch)
  function to16k(x, rate) {
    if (Math.abs(rate - 16000) < 1) return x;
    var r = rate / 16000, n = Math.floor(x.length / r), out = new Float32Array(n);
    for (var i = 0; i < n; i++) { var a = Math.floor(i * r), b = Math.max(a + 1, Math.floor((i + 1) * r)), s = 0; for (var j = a; j < b && j < x.length; j++) s += x[j]; out[i] = s / (b - a); }
    return out;
  }

  function track(samples, rate) {
    var x = to16k(samples, rate), sr = 16000;
    var hop = Math.round(HOP * sr), W = Math.round(WIN * sr), minLag = Math.floor(sr / FMAX), maxLag = Math.ceil(sr / FMIN);
    var frames = [], d = new Float64Array(maxLag + 1), peak = 0;
    for (var start = 0; start + W + maxLag < x.length; start += hop) {
      var e = 0; for (var i = 0; i < W; i++) e += x[start + i] * x[start + i];
      var rms = Math.sqrt(e / W); if (rms > peak) peak = rms;
      frames.push({ t:(start + W / 2) / sr, f0:0, rms:rms, ap:1, _s:start });
    }
    var gate = peak * 0.06, prevLag = 0;
    frames.forEach(function (fr) {
      if (fr.rms < gate) { prevLag = 0; return; }
      var s0 = fr._s, tau, j, sum = 0, best = -1;
      for (tau = 1; tau <= maxLag; tau++) {
        var acc = 0;
        for (j = 0; j < W; j++) { var q = x[s0 + j] - x[s0 + j + tau]; acc += q * q; }
        sum += acc; d[tau] = sum > 0 ? acc * tau / sum : 1;
      }
      for (tau = minLag; tau <= maxLag; tau++) {
        if (d[tau] < THRESH) { while (tau + 1 <= maxLag && d[tau + 1] < d[tau]) tau++; best = tau; break; }
      }
      if (best < 0) { var m = 1, mt = -1; for (tau = minLag; tau <= maxLag; tau++) if (d[tau] < m) { m = d[tau]; mt = tau; } if (m < LOOSE) best = mt; }
      // a voice gliding fast (a 4th tone) or going creaky at the end is less periodic: follow it while it stays near the frame before
      if (best < 0 && prevLag) {
        var lo = Math.max(minLag + 1, Math.floor(prevLag * 0.88)), hi = Math.min(maxLag - 1, Math.ceil(prevLag * 1.14)), m2 = 1, mt2 = -1;
        for (tau = lo; tau <= hi; tau++) if (d[tau] < m2 && d[tau] <= d[tau - 1] && d[tau] <= d[tau + 1]) { m2 = d[tau]; mt2 = tau; }
        if (m2 < 0.8) best = mt2;
      }
      if (best < 0) { prevLag = 0; return; }
      var a = d[best - 1], b = d[best], c = best + 1 <= maxLag ? d[best + 1] : b, den = a - 2 * b + c;
      var lag = best + (den ? 0.5 * (a - c) / den : 0);
      fr.f0 = sr / lag; fr.ap = b; prevLag = lag;
    });
    frames.forEach(function (fr) { delete fr._s; });
    return frames;
  }

  function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (p, q) { return p - q; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  var st = function (f, ref) { return 12 * Math.log(f / ref) / Math.LN2; };

  // clean the track: octave jumps folded back towards the middle, short voiced islands dropped, a 5-frame median filter
  function clean(frames) {
    var v = frames.map(function (f) { return f.f0; });
    var ref = median(v.filter(Boolean));
    if (!ref) return { v:v, ref:0 };
    // an octave jump from one frame to the next is an error (the voice glides): fold it back towards the frame before
    var prev = 0;
    v = v.map(function (f) {
      if (!f) { return 0; }
      var g = f;
      if (prev) { while (g > prev * 1.6) g /= 2; while (g < prev / 1.6) g *= 2; }
      else { while (g > ref * 2.2) g /= 2; while (g < ref / 2.2) g *= 2; }
      prev = g; return g;
    });
    for (var i = 0; i < v.length;) {   // voiced runs shorter than 50 ms are noise
      if (!v[i]) { i++; continue; }
      var j = i; while (j < v.length && v[j]) j++;
      if (j - i < 5) for (var k = i; k < j; k++) v[k] = 0;
      i = j;
    }
    var out = v.map(function (f, idx) {
      if (!f) return 0;
      var w = []; for (var k = Math.max(0, idx - 2); k <= Math.min(v.length - 1, idx + 2); k++) if (v[k]) w.push(v[k]);
      return median(w);
    });
    return { v:out, ref:median(out.filter(Boolean)) };
  }

  // the shape of one syllable from its pitch in semitones around the speaker's middle (first and last 10% dropped: onsets and endings wobble)
  function shapeOf(p, last, n) {
    // a syllable's start is pulled by the tone before it, its end is where it reaches its own tone (Xu's target approximation):
    // the start of a later syllable is cut more, the end barely
    var later = n > 1 && last, L = p.length, cutA = Math.floor(L * (later ? 0.3 : 0.1)), cutB = Math.floor(L * 0.05), q = p.slice(cutA, L - cutB);
    if (q.length < 4) q = p;
    var k = Math.max(2, Math.round(q.length * 0.25));
    var avg = function (a) { return a.reduce(function (s, y) { return s + y; }, 0) / a.length; };
    var s = avg(q.slice(0, k)), e = avg(q.slice(q.length - k)), mean = avg(q);
    var sm = q.map(function (y, i) { var a = q.slice(Math.max(0, i - 2), i + 3); return avg(a); });
    var mn = Infinity, mi = 0, mx = -Infinity; sm.forEach(function (y, i) { if (y < mn) { mn = y; mi = i; } if (y > mx) mx = y; });
    var pos = sm.length > 1 ? mi / (sm.length - 1) : 0;
    var fall = s - e, rise = e - s;
    var tone, shape;
    if (mn < s - 1.2 && mn < e - 1.2 && pos > 0.2 && pos < 0.8) { tone = 3; shape = 'dip'; }                 // down, then up: the full 3rd tone
    else if (rise >= 2) { tone = (pos > 0.45 && mn < s - 1) ? 3 : 2; shape = tone === 3 ? 'dip' : 'rise'; }
    else if (fall >= 2.5 && s > -1.5) { tone = 4; shape = 'fall'; }                                          // starts high, drops a lot
    else if (mean < -2 || (n > 1 && !last && mean < -1 && fall > 0.5)) { tone = 3; shape = 'low'; }        // low, maybe falling a little: the half 3rd tone before another syllable
    else if (fall >= 2.5) { tone = 4; shape = 'fall'; }
    else { tone = 1; shape = 'level'; }
    return { tone:tone, shape:shape, s:s, e:e, mean:mean, min:mn, pos:pos, q:q };
  }

  // n syllables: the voiced stretch from the first to the last voiced frame, cut where the sound is weakest (or a gap is) near each boundary
  function analyse(samples, rate, n) {
    var frames = track(samples, rate), c = clean(frames), v = c.v;
    var first = v.findIndex(function (f) { return f > 0; }), lastI = -1;
    for (var i = v.length - 1; i >= 0; i--) if (v[i]) { lastI = i; break; }
    var voiced = v.filter(Boolean).length;
    if (first < 0 || voiced < 8) return { ok:false, why:'nopitch', frames:frames, ref:0, curve:[], syl:[] };
    var span = lastI - first + 1, cuts = [first], peakRms = frames.reduce(function (m, f) { return Math.max(m, f.rms); }, 0) || 1;
    // the gaps in the voicing inside the word (a consonant such as sh, t or x between two syllables)
    var gaps = [];
    for (var g = first; g <= lastI;) { if (v[g]) { g++; continue; } var g2 = g; while (g2 <= lastI && !v[g2]) g2++; if (g2 - g >= 2) gaps.push((g + g2) / 2); g = g2; }
    for (var b = 1; b < n; b++) {
      var want = first + span * b / n, prevCut = cuts[cuts.length - 1], best = -1;
      var near = gaps.filter(function (c) { return c > prevCut + 4 && c > first + span * (b / n - 0.35) && c < first + span * (b / n + 0.35); });
      if (near.length) best = Math.round(near.sort(function (p, q) { return Math.abs(p - want) - Math.abs(q - want); })[0]);
      else {   // no gap: the weakest moment near the middle
        var lo = first + Math.round(span * (b / n - 0.25)), hi = first + Math.round(span * (b / n + 0.25)), bestScore = Infinity;
        for (var k = Math.max(prevCut + 4, lo); k <= hi; k++) { var sc = frames[k].rms / peakRms; if (sc < bestScore) { bestScore = sc; best = k; } }
      }
      cuts.push(best < 0 ? Math.round(want) : best);
    }
    cuts.push(lastI + 1);
    var ref = c.ref, syl = [];
    for (var s = 0; s < n; s++) {
      var p = []; for (var k2 = cuts[s]; k2 < cuts[s + 1]; k2++) if (v[k2]) p.push(st(v[k2], ref));
      if (p.length < 4) { syl.push({ from:cuts[s], to:cuts[s + 1], tone:0, shape:'none', st:p }); continue; }
      var sh = shapeOf(p, s === n - 1, n);
      syl.push({ from:cuts[s], to:cuts[s + 1], tone:sh.tone, shape:sh.shape, st:p, q:sh.q, s:sh.s, e:sh.e, mean:sh.mean });
    }
    var curve = [];
    for (var k3 = first; k3 <= lastI; k3++) curve.push({ x:(k3 - first) / Math.max(1, span - 1), st:v[k3] ? st(v[k3], ref) : null });
    return { ok:true, why:'', frames:frames, ref:ref, curve:curve, syl:syl, cuts:cuts.map(function (k4) { return (k4 - first) / Math.max(1, span - 1); }) };
  }

  // Is this syllable an acceptable version of tone `want`? Judged with the tolerance real speech needs (a learner should never be told a
  // good tone is wrong): ctx = { last: the last syllable of the word, next: the tone of the next syllable }. Returns { ok, heard }:
  // heard is what the curve did (level, rise, dip, low, fall), for the feedback.
  function judge(sy, want, ctx) {
    ctx = ctx || {};
    if (!sy || !sy.st || sy.st.length < 4) return { ok:false, heard:'none' };
    var s = sy.s, e = sy.e, rise = e - s, fall = s - e, mn = Math.min.apply(null, sy.q || sy.st), dip = Math.min(s, e) - mn;
    var heard = sy.shape;
    if (want === 5 || want === 0) return { ok:true, heard:heard };
    var ok;
    if (want === 1) ok = Math.abs(rise) <= 2.5 && dip < 2.5;
    else if (want === 2) ok = rise >= 1.5 || (e - mn >= 2.5 && e >= s - 0.5);
    else if (want === 4) ok = fall >= 2 || (!ctx.last && fall >= 1 && s >= 1);   // before another syllable a 4th tone only half falls (from high)
    else if (want === 3) {
      if (!ctx.last) ok = ctx.next === 3 ? true : !(rise >= 2.5 && sy.shape === 'rise') && !(Math.abs(rise) <= 1.5 && sy.mean > 1.5);   // the half 3rd: low or falling (a rise before another 3rd is the tone change)
      else ok = sy.shape === 'dip' || sy.shape === 'low' || sy.mean <= -1 || (dip >= 1.2) || (fall >= 1.5 && e < -1);
    }
    return { ok:!!ok, heard:heard };
  }

  // Chao's tone numbers (1 low … 5 high) as semitones around the middle: 55, 35, 214, 51 and a short light tone
  var TONE_SHAPE = { 1:[4, 4], 2:[0, 4], 3:[-2, -6, 1], 4:[5, -5], 5:[-1, -2] };

  var api = { track:track, analyse:analyse, judge:judge, clean:clean, shapeOf:shapeOf, TONE_SHAPE:TONE_SHAPE, to16k:to16k };
  root.ShanluPitch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
