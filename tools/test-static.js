/* The little web server the browser tests use to serve the site from this folder.
 * Differences from the real site, on purpose:
 *   - config.js is blank (tests never talk to the real friends server; they set window.SHANLU_FRIENDS_URL themselves);
 *   - the content-security tag is taken out of index.html, because tests talk to fake servers on other addresses
 *     (tools/smoke-test-pwa.js runs the real tag with the real addresses);
 *   - sw.js is an empty one (the real offline copy would cache files between test runs), unless the test asks: server(root, { sw: true }). */
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
    if (p === '/index.html' && !o.csp) {
      res.writeHead(200, headers);
      res.end(fs.readFileSync(f, 'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, ''));
      return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(f).pipe(res);
  });
}
module.exports = { server, types };
