#!/usr/bin/env node
/* The "stamp" step. Run it after changing any script, style, data file, font or icon:   node tools/build-site.js
 * (`node tools/build-site.js --check` only checks and exits 1 if something is out of date; the tests and CI use that.)
 *
 * It does four things, all in place and safe to repeat:
 *   1. Computes one VERSION: a short hash of every file the page loads (and index.html itself).
 *   2. Writes ?v=VERSION on every script and the stylesheet in index.html, adds `defer` to the scripts, and sets the
 *      <meta name="shanlu-version"> tag the Settings screen shows. A returning visitor can then never mix a new app.js with old data.
 *   3. Writes the Content-Security-Policy tag: scripts only from this site; network calls only to the addresses the app uses
 *      (Anthropic, Alibaba Model Studio, GitHub, and the friends-board address found in config.js).
 *   4. Writes sw.js (the offline copy) from tools/sw-template.js, listing exactly the files of this version.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
const check = process.argv.includes('--check');

let html = read('index.html');

// ---- which files does the page load? ----
const scripts = [];
html.replace(/<script\b[^>]*\bsrc="([^"?]+)(?:\?v=[0-9a-f]+)?"[^>]*><\/script>/g, (m, src) => { scripts.push(src); return m; });
const styles = [];
html.replace(/<link\b[^>]*rel="stylesheet"[^>]*\bhref="([^"?]+)(?:\?v=[0-9a-f]+)?"[^>]*>/g, (m, href) => { styles.push(href); return m; });
const fonts = fs.readdirSync(path.join(root, 'fonts')).filter((f) => /\.woff2$/.test(f)).sort().map((f) => 'fonts/' + f);
const icons = fs.readdirSync(path.join(root, 'icons')).filter((f) => /\.png$/.test(f)).sort().map((f) => 'icons/' + f);
const extra = ['manifest.webmanifest'];
const files = Array.from(new Set(scripts.concat(styles, fonts, icons, extra)));
files.forEach((f) => { if (!exists(f)) { console.error('Missing file named by index.html or fonts/icons: ' + f); process.exit(2); } });

// ---- the version: a hash of the files, and of index.html with its generated parts blanked ----
const plainHtml = (h) => h
  .replace(/(<script\b[^>]*\bsrc="[^"?]+)\?v=[0-9a-f]+/g, '$1')
  .replace(/(<link\b[^>]*\bhref="[^"?]+)\?v=[0-9a-f]+/g, '$1')
  .replace(/<script defer src=/g, '<script src=')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<meta http-equiv="Content-Security-Policy" content="">')
  .replace(/<meta name="shanlu-version"[^>]*>/, '<meta name="shanlu-version" content="">');
const hash = crypto.createHash('sha1');
hash.update('index.html\0' + plainHtml(html) + '\0');
files.slice().sort().forEach((f) => { hash.update(f + '\0'); hash.update(fs.readFileSync(path.join(root, f))); hash.update('\0'); });
hash.update('csp-v1');
const VERSION = hash.digest('hex').slice(0, 10);

// ---- the content-security policy ----
const cfg = exists('config.js') ? read('config.js') : '';
const friends = (/SHANLU_FRIENDS_URL\s*=\s*window\.SHANLU_FRIENDS_URL\s*\|\|\s*'(https:\/\/[^']+)'/.exec(cfg) || [])[1];
const friendsOrigin = friends ? new URL(friends).origin : '';
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",   // the page sets style attributes while it draws; scripts stay locked to this site
  "img-src 'self' data: blob: https://upload.wikimedia.org https://thumb.wikimedia.org https://api.openverse.org",   // Journey photos come from Wikimedia Commons and Openverse
  "font-src 'self'",
  'media-src \'self\' blob: data: https://*.aliyuncs.com',   // Qwen voice clips are links to files on Alibaba's storage
  ["connect-src 'self'", 'https://api.anthropic.com', 'https://dashscope-intl.aliyuncs.com', 'https://*.ap-southeast-1.maas.aliyuncs.com', 'https://api.github.com', friendsOrigin].filter(Boolean).join(' '),
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// ---- rewrite index.html ----
let out = html
  .replace(/<script\b([^>]*?)\bsrc="([^"?]+)(?:\?v=[0-9a-f]+)?"([^>]*)><\/script>/g, (m, a, src, b) => '<script defer src="' + src + '?v=' + VERSION + '"></script>')
  .replace(/(<link\b[^>]*rel="stylesheet"[^>]*\bhref=")([^"?]+)(?:\?v=[0-9a-f]+)?(")/g, '$1$2?v=' + VERSION + '$3')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
  .replace(/<meta name="shanlu-version"[^>]*>/, '<meta name="shanlu-version" content="' + VERSION + '">');
if (!/shanlu-version/.test(out) || !/Content-Security-Policy/.test(out)) { console.error('index.html needs the <meta http-equiv="Content-Security-Policy"> and <meta name="shanlu-version"> tags once (their content is filled in here).'); process.exit(2); }

// ---- sw.js ----
const assets = ['index.html'].concat(files.map((f) => (scripts.concat(styles).indexOf(f) >= 0 ? f + '?v=' + VERSION : f)));
const sw = read('tools/sw-template.js').replace('__VERSION__', VERSION).replace('__ASSETS__', JSON.stringify(assets, null, 2));

const stale = [];
if (out !== html) stale.push('index.html');
if (!exists('sw.js') || read('sw.js') !== sw) stale.push('sw.js');
if (check) {
  if (stale.length) { console.error('Out of date: ' + stale.join(', ') + '. Run: node tools/build-site.js'); process.exit(1); }
  console.log('site stamp is current (version ' + VERSION + ', ' + assets.length + ' files)');
  process.exit(0);
}
if (out !== html) fs.writeFileSync(path.join(root, 'index.html'), out);
if (!exists('sw.js') || read('sw.js') !== sw) fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log((stale.length ? 'updated ' + stale.join(', ') : 'nothing to change') + ' (version ' + VERSION + ', ' + assets.length + ' files)');
