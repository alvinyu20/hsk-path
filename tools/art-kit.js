/* Drawing helpers shared by the picture tools: 64 x 64 pictures, one dark outline, flat fills (see tools/souvenir-art.js, which has its own copy). */
const C = { ink:'#2b3a42', red:'#c8372d', dred:'#8f2220', gold:'#e2a93b', pale:'#f3dd9a', jade:'#4aa085', blue:'#3d6fa5', sky:'#a9cbe8', cream:'#f7efd9',
  brown:'#8d5b3a', tan:'#d2a773', pink:'#eaa5a5', lime:'#8fc47a', green:'#3f8a56', grey:'#aab4ba', dgrey:'#66737b', white:'#ffffff', black:'#33383d',
  purple:'#7b5ea7', orange:'#e8873a', yellow:'#f2d04e', skin:'#f1c9a0', bronze:'#b8a266', teal:'#2f8f95', navy:'#2c4a73' };
const A = (o) => Object.keys(o).map((k) => k + '="' + o[k] + '"').join(' ');
const sty = (f, w) => A({ fill:f, stroke:C.ink, 'stroke-width':w || 2, 'stroke-linejoin':'round', 'stroke-linecap':'round' });
const rot = (r, x, y) => (r ? ' transform="rotate(' + r + ' ' + x + ' ' + y + ')"' : '');
const rect = (x, y, w, h, f, rx, r) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx == null ? 3 : rx) + '" ' + sty(f) + rot(r, x + w / 2, y + h / 2) + '/>';
const circ = (x, y, r, f) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" ' + sty(f) + '/>';
const ell = (x, y, rx, ry, f, r) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" ' + sty(f) + rot(r, x, y) + '/>';
const path_ = (d, f) => '<path d="' + d + '" ' + sty(f) + '/>';
const poly = (p, f) => '<polygon points="' + p + '" ' + sty(f) + '/>';
const line = (d, col, w) => '<path d="' + d + '" fill="none" stroke="' + (col || C.ink) + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
const dot = (x, y, r, f) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 1.6) + '" fill="' + (f || C.ink) + '"/>';
const blob = (d, f) => '<path d="' + d + '" fill="' + f + '"/>';                // fill only, no outline
const txt = (x, y, s, size, f) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="700" text-anchor="middle" fill="' + (f || C.ink) + '" font-family="\'Noto Serif SC\',\'Songti SC\',\'SimSun\',serif">' + s + '</text>';

const ring = (x, y, r, col, w) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + (col || C.white) + '" stroke-width="' + (w || 1.8) + '"/>';
const grp = (r, parts) => '<g transform="rotate(' + r + ' 32 32)">' + parts.join('') + '</g>';
const tr = (x, y, parts) => '<g transform="translate(' + x + ' ' + y + ')">' + parts.join('') + '</g>';
module.exports = { C, A, sty, rot, rect, circ, ell, path_, poly, line, dot, blob, txt, ring, grp, tr };
