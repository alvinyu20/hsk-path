/* Which texts have a recording in audio/, and the file of each.
 * A recording made by tools/make-audio.py is named by the text it speaks: audio/<first 14 hex digits of sha1(key)>.mp3, where the key is the
 * exact text ("m|" + text for the man's voice). data/audio-manifest.js (written by tools/build-audio.py) only says WHICH keys have one: the
 * first W hex digits of each key's SHA-1, sorted and joined into one string (about 150 KB instead of a 1 MB text -> file list). A text whose
 * digits are there plays its file; if a file ever fails to load (two texts sharing the first W digits, about 1 in 12,000), the browser voice reads it.
 * window.SHANLU_AUDIO (text -> file name, or just the extension for audio/<text>.<ext>) is kept for files named any other way, and for tests.
 * Node: require('./audiolist.js') returns the same object (tools/test-audio.js checks it against audio/index.json). */
(function (root) {
  var W = 7;
  // SHA-1 of the UTF-8 bytes of a string, as 40 hex digits (synchronous, unlike crypto.subtle)
  function sha1hex(str) {
    var b = new TextEncoder().encode(String(str));
    var n = b.length, blocks = ((n + 8) >> 6) + 1, w = new Int32Array(blocks * 16), i, t;
    for (i = 0; i < n; i++) w[i >> 2] |= b[i] << (24 - (i & 3) * 8);
    w[n >> 2] |= 0x80 << (24 - (n & 3) * 8);
    w[blocks * 16 - 1] = n * 8;
    var h0 = 0x67452301, h1 = 0xEFCDAB89 | 0, h2 = 0x98BADCFE | 0, h3 = 0x10325476, h4 = 0xC3D2E1F0 | 0, X = new Int32Array(80);
    for (var j = 0; j < w.length; j += 16) {
      for (t = 0; t < 16; t++) X[t] = w[j + t];
      for (t = 16; t < 80; t++) { var x = X[t - 3] ^ X[t - 8] ^ X[t - 14] ^ X[t - 16]; X[t] = (x << 1) | (x >>> 31); }
      var a = h0, bb = h1, c = h2, d = h3, e = h4;
      for (t = 0; t < 80; t++) {
        var f = t < 20 ? (bb & c) | (~bb & d) : t < 40 ? bb ^ c ^ d : t < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d;
        var k = t < 20 ? 0x5A827999 : t < 40 ? 0x6ED9EBA1 : t < 60 ? 0x8F1BBCDC | 0 : 0xCA62C1D6 | 0;
        var tmp = (((a << 5) | (a >>> 27)) + f + e + k + X[t]) | 0;
        e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = tmp;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    return [h0, h1, h2, h3, h4].map(function (h) { return ('0000000' + (h >>> 0).toString(16)).slice(-8); }).join('');
  }
  var cache = new Map();
  // is this prefix in the sorted list? (binary search over fixed-width entries)
  function listed(ids, p) {
    var lo = 0, hi = ids.length / W - 1;
    while (lo <= hi) { var mid = (lo + hi) >> 1, s = ids.substr(mid * W, W); if (s === p) return true; if (s < p) lo = mid + 1; else hi = mid - 1; }
    return false;
  }
  // the address of the recording of text (tag 'm': the man's voice), or null when there is none
  function file(text, tag) {
    if (!text) return null;
    var key = (tag === 'm' ? 'm|' : '') + text, m = root.SHANLU_AUDIO;
    if (m && Object.prototype.hasOwnProperty.call(m, key)) return 'audio/' + (String(m[key]).indexOf('.') >= 0 ? m[key] : encodeURIComponent(text) + '.' + m[key]);
    var ids = root.SHANLU_AUDIO_IDS; if (!ids) return null;
    var h = cache.get(key); if (h === undefined) { h = sha1hex(key).slice(0, 14); cache.set(key, h); }
    return listed(ids, h.slice(0, W)) ? 'audio/' + h + '.mp3' : null;
  }
  var api = { file: file, sha1hex: sha1hex, W: W };
  root.ShanluAudio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
