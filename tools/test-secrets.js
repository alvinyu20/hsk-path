#!/usr/bin/env node
/* Unit tests for secrets.js (passphrase encryption of synced API keys). Usage: node tools/test-secrets.js */
const X = require('../secrets.js');
let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  check(X.available(), 'WebCrypto is available here');
  const keys = { key: 'sk-ant-test-123', aliKey: 'sk-ali-test-456', aliWs: 'ws1' };
  const FAST = 2000;   // fewer rounds so the test is quick; the app uses X.ROUNDS
  const s1 = await X.seal(keys, 'correct horse battery', FAST);
  check(X.isSealed(s1) && s1.enc === 1 && s1.it === FAST, 'a sealed value is a small object of text fields');
  const flat = JSON.stringify(s1);
  check(flat.indexOf('sk-ant') < 0 && flat.indexOf('sk-ali') < 0 && flat.indexOf('ws1') < 0, 'the keys do not appear anywhere in the sealed text');
  const back = await X.open(s1, 'correct horse battery');
  check(JSON.stringify(back) === JSON.stringify(keys), 'the right passphrase gives the keys back exactly');
  let err = null; try { await X.open(s1, 'wrong passphrase!'); } catch (e) { err = e; }
  check(err && err.code === 'wrong', 'a wrong passphrase is refused');
  const bad = Object.assign({}, s1, { ct: s1.ct.slice(0, -4) + (s1.ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA') });
  err = null; try { await X.open(bad, 'correct horse battery'); } catch (e) { err = e; }
  check(err && err.code === 'wrong', 'a damaged blob is refused instead of giving garbage');
  const s2 = await X.seal(keys, 'correct horse battery', FAST);
  check(s2.ct !== s1.ct && s2.salt !== s1.salt && s2.iv !== s1.iv, 'sealing the same keys twice gives different text (fresh salt and IV)');
  err = null; try { await X.seal(keys, 'short', FAST); } catch (e) { err = e; }
  check(err && err.code === 'short', 'a passphrase under 8 characters is refused');
  err = null; try { await X.open({ key: 'plain', aliKey: null }, 'x'); } catch (e) { err = e; }
  check(err && err.code === 'format' && !X.isSealed({ key: 'plain' }) && !X.isSealed(null), 'old plain-text key data is not mistaken for a sealed value');
  err = null; try { await X.open(Object.assign({}, s1, { it: 5 }), 'correct horse battery'); } catch (e) { err = e; }
  check(err && err.code === 'format', 'a made-up round count is refused (no way to make the browser spin for minutes)');
  const t0 = Date.now(); const full = await X.seal({ a: 1 }, 'correct horse battery'); const ms = Date.now() - t0;
  check(full.it === X.ROUNDS && (await X.open(full, 'correct horse battery')).a === 1, 'the real setting (' + X.ROUNDS + ' rounds) round-trips (' + ms + ' ms here)');
  console.log(failures ? failures + ' check(s) failed' : 'all secrets checks passed');
  process.exit(failures ? 1 : 0);
})();
