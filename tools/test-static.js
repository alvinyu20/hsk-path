/* The little web server the browser tests use to serve the site from this folder.
 * Differences from the real site, on purpose:
 *   - config.js is blank (tests never talk to the real friends server; they set window.SHANLU_FRIENDS_URL themselves);
 *   - the content-security tag is taken out of index.html, because tests talk to fake servers on other addresses
 *     (tools/smoke-test-pwa.js runs the real tag with the real addresses);
 *   - data/audio-manifest.js is empty (no recorded audio), so tests do not depend on which texts have been recorded; a test that wants recordings
 *     sets its own manifest (tools/smoke-test-audio.js), or server(root, { realAudio: true }) keeps the real one (without its R2 bucket address,
 *     so the recordings come from this server; add audioBase: true to keep the bucket);
 *   - sw.js is an empty one (the real offline copy would cache files between test runs), unless the test asks: server(root, { sw: true }).
 *   - server(root, { level3: true }) would open HSK 3 while it is still closed on the real site (level.js gets MAX_LEVEL = 3 and index.html
 *     gets the HSK 3 data scripts). HSK 3 has been released, so both are in the real files and this option does nothing; it is kept for the
 *     next level, which can be copied from it.
 *   - server(root, { level4: true }) does the same for HSK 4 (MAX_LEVEL = 4 and the HSK 4 data scripts). Once HSK 4 is released it does nothing.
 *   - server(root, { level5: true }) does the same for HSK 5 (MAX_LEVEL = 5 and the HSK 5 data scripts). Once HSK 5 is released it does nothing.
 *     The options only ever RAISE MAX_LEVEL (a test written for an older level keeps running on the real, higher value). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

function server(root, opts) {
  const o = opts || {};
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (p === '/config.js' && !o.realConfig) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end("window.SHANLU_FRIENDS_URL = window.SHANLU_FRIENDS_URL || '';"); return; }
    if (p === '/sw.js' && !o.sw) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end('/* tests: a service worker that does nothing, so no files are cached between test runs */'); return; }
    if (p === '/data/audio-manifest.js' && !o.realAudio) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end('window.SHANLU_AUDIO_IDS = ""; window.SHANLU_AUDIO = {};'); return; }
    // with the real manifest, the recordings still come from this server's audio/ (not the R2 bucket, B4): tests stay offline and don't depend on the bucket's CORS rule
    if (p === '/data/audio-manifest.js' && o.realAudio && !o.audioBase) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(fs.readFileSync(path.join(root, p), 'utf8').replace(/^window\.SHANLU_AUDIO_BASE = .*$/m, '')); return; }
    const f = path.join(root, p);
    // once the recordings live only in the R2 bucket (audio/r2.json "only"), a real recording this checkout lacks is fetched from the bucket here (no CORS between servers)
    if (o.realAudio && /^\/audio\/[^/]+\.mp3$/.test(p) && f.startsWith(root) && !fs.existsSync(f)) {
      let r2 = null; try { r2 = JSON.parse(fs.readFileSync(path.join(root, 'audio', 'r2.json'), 'utf8')); } catch (e) { r2 = null; }
      if (r2 && r2.only && /^https:\/\//.test(r2.base || '')) {
        fetch(r2.base.replace(/\/?$/, '/') + p.slice(1)).then(async (up) => { if (!up.ok) throw new Error('bucket ' + up.status); const b = Buffer.from(await up.arrayBuffer()); res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); res.end(b); })
          .catch(() => { res.writeHead(404); res.end('nope'); });
        return;
      }
    }
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
    const headers = { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' };
    if (o.noCache) headers['Cache-Control'] = 'no-cache';
    if (p === '/level.js' && (o.level3 || o.level4 || o.level5)) {
      res.writeHead(200, headers);
      res.end(fs.readFileSync(f, 'utf8').replace(/var MAX_LEVEL = (\d);/, (m, cur) => 'var MAX_LEVEL = ' + Math.max(Number(cur), o.level5 ? 5 : o.level4 ? 4 : 3) + ';'));   // never lowers the real value
      return;
    }
    if (p === '/index.html' && (!o.csp || o.level3 || o.level4 || o.level5)) {
      let html = fs.readFileSync(f, 'utf8');
      if (!o.csp) html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '');
      if (o.level3 && html.indexOf('data/hsk3-words.js') < 0) {
        const tags = ['words', 'grammar', 'webs', 'speak', 'listen', 'exam'].filter((n) => fs.existsSync(path.join(root, 'data/hsk3-' + n + '.js'))).map((n) => '<script defer src="data/hsk3-' + n + '.js"></script>').join('\n');
        html = html.replace(/(<script defer src="ascent\.js)/, tags + '\n$1');
      }
      if (o.level4 && html.indexOf('data/hsk4-words.js') < 0) {
        const tags = ['words', 'grammar', 'webs', 'speak', 'listen', 'exam'].filter((n) => fs.existsSync(path.join(root, 'data/hsk4-' + n + '.js'))).map((n) => '<script defer src="data/hsk4-' + n + '.js"></script>').join('\n');
        html = html.replace(/(<script defer src="ascent\.js)/, tags + '\n$1');
      }
      if (o.level5 && html.indexOf('data/hsk5-words.js') < 0) {
        const tags = ['words', 'grammar', 'webs', 'speak', 'listen', 'exam'].filter((n) => fs.existsSync(path.join(root, 'data/hsk5-' + n + '.js'))).map((n) => '<script defer src="data/hsk5-' + n + '.js"></script>').join('\n');
        html = html.replace(/(<script defer src="ascent\.js)/, tags + '\n$1');
      }
      res.writeHead(200, headers);
      res.end(html);
      return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(f).pipe(res);
  });
}
module.exports = { server, types };
