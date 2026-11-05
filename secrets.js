/* Passphrase encryption for the one thing that must not sit on the server in plain text: API keys that a person chooses to share
 * between their own devices ("API keys on all my devices"). The keys are encrypted in the browser with a passphrase that never leaves
 * the person's devices; the server (and whoever runs it) only ever holds the encrypted blob.
 *
 * AES-256-GCM, key from the passphrase with PBKDF2-SHA-256 (250,000 rounds, random 16-byte salt, random 12-byte IV per save).
 * GCM also detects a wrong passphrase or a damaged blob, so opening one never returns garbage.
 * Runs in the page and in tools/test-secrets.js (Node 18+). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShanluSecrets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ROUNDS = 250000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null);
  const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const fromB64 = (s) => { const bin = atob(s); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
  const MIN_LENGTH = 8;

  const available = () => !!subtle() && typeof btoa === 'function';
  const isSealed = (v) => !!v && typeof v === 'object' && v.enc === 1 && typeof v.ct === 'string' && typeof v.salt === 'string' && typeof v.iv === 'string';

  async function keyFrom(pass, salt, rounds) {
    const base = await subtle().importKey('raw', enc.encode(String(pass)), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  // any JSON value -> { enc:1, it, salt, iv, ct } (all text, safe to store with the progress)
  async function seal(value, pass, rounds) {
    if (!available()) throw new Error('This browser cannot encrypt (it needs a secure page).');
    if (String(pass || '').length < MIN_LENGTH) throw Object.assign(new Error('The passphrase needs at least ' + MIN_LENGTH + ' characters.'), { code: 'short' });
    const it = rounds || ROUNDS;
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFrom(pass, salt, it);
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))));
    return { enc: 1, it, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
  }

  // the value back, or an error with code 'wrong' (wrong passphrase or damaged data)
  async function open(sealed, pass) {
    if (!isSealed(sealed)) throw Object.assign(new Error('Nothing to open.'), { code: 'format' });
    if (!available()) throw new Error('This browser cannot decrypt (it needs a secure page).');
    const rounds = Number(sealed.it);
    if (!(rounds >= 1000 && rounds <= 2000000)) throw Object.assign(new Error('Unreadable settings.'), { code: 'format' });
    try {
      const key = await keyFrom(pass, fromB64(sealed.salt), rounds);
      const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.ct));
      return JSON.parse(dec.decode(plain));
    } catch (e) { throw Object.assign(new Error('That passphrase does not open the saved keys.'), { code: 'wrong' }); }
  }

  return { seal, open, isSealed, available, MIN_LENGTH, ROUNDS };
});
