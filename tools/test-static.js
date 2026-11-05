/* The little web server the browser tests use to serve the site from this folder.
 * Differences from the real site, on purpose:
 *   - config.js is blank (tests never talk to the real friends server; they set window.SHANLU_FRIENDS_URL themselves);
 *   - the content-security tag is taken out of index.html, because tests talk to fake servers on other addresses
 *     (tools/smoke-test-pwa.js runs the real tag with the real addresses);
 *   - sw.js is an empty one (the real offline copy would cache files between test runs), unless the test asks: server(root, { sw: true }).
 *   - server(root, { level3: true }) would open HSK 3 while it is still closed on the real site (level.js gets MAX_LEVEL = 3 and index.html
 *     gets the HSK 3 data scripts). HSK 3 has been released, so both are in the real files and this option does nothing; it is kept for the
 *     next level, which can be copied from it. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

function server(root, opts) {
  const o = opts || {};
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (p === '/config.js' && !o.realConfig) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end("window.SHANLU_FRIENDS_URL = window.SHANLU_FRIENDS_URL || '';"); return; }
    if (p === '/sw.js' && !o.sw) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end('/* tests: a service worker that does nothing, so no files are cached between test runs */'); return; }
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
    const headers = { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' };
    if (o.noCache) headers['Cache-Control'] = 'no-cache';
    if (p === '/level.js' && o.level3) {
      res.writeHead(200, headers);
      res.end(fs.readFileSync(f, 'utf8').replace(/var MAX_LEVEL = \d;/, 'var MAX_LEVEL = 3;'));
      return;
    }
    if (p === '/index.html' && (!o.csp || o.level3)) {
      let html = fs.readFileSync(f, 'utf8');
      if (!o.csp) html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '');
      if (o.level3 && html.indexOf('data/hsk3-words.js') < 0) {
        const tags = ['words', 'grammar', 'webs', 'speak', 'listen', 'exam'].filter((n) => fs.existsSync(path.join(root, 'data/hsk3-' + n + '.js'))).map((n) => '<script defer src="data/hsk3-' + n + '.js"></script>').join('\n');
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
