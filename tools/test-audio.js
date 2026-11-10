/* The audio list and the manifest: every word and every spoken exam line is in the list to record (with the man's voice for 男 lines),
 * every listed recording exists in audio/, and the manifest is current.   node tools/test-audio.js */
const path = require('path'), fs = require('fs'), cp = require('child_process');
const root = path.join(__dirname, '..');
global.window = {};
[1, 2, 3].forEach((n) => require(path.join(root, 'data', 'hsk' + n + '-words.js')));
let bad = 0;
const fail = (m) => { bad++; console.log('FAIL', m); };
const list = JSON.parse(cp.execSync('node ' + path.join(__dirname, 'audio-texts.js'), { maxBuffer: 1e8 }).toString());
const has = new Set(list.map((e) => e.voice + '|' + e.text));
[1, 2, 3].forEach((n) => window['HSK' + n + '_WORDS'].forEach((w) => {
  if (!has.has('f|' + w.zh)) fail('the word ' + w.zh + ' is not in the list to record');
  if (!has.has('f|' + w.ex.zh)) fail('the example of ' + w.zh + ' is not in the list to record');
}));
global.window = {};
[1, 2, 3].forEach((n) => require(path.join(root, 'data', 'hsk' + n + '-exam.js')));
let male = 0;
[1, 2, 3].forEach((n) => { const E = window['HSK' + n + '_EXAM']; Object.keys(E).filter((k) => /^L\d/.test(k)).forEach((k) => JSON.stringify(E[k], (key, v) => { if (v && Array.isArray(v.say)) v.say.forEach((l) => { if (!has.has((l.s === '男' ? 'm' : 'f') + '|' + l.zh)) fail('exam line ' + l.zh + ' (' + l.s + ') is not in the list'); if (l.s === '男') male++; }); return v; })); });
if (!male) fail('no man\'s lines were found in the exams');
// the manifest: every file it names exists
global.window = {};
require(path.join(root, 'data', 'audio-manifest.js'));
const M = window.SHANLU_AUDIO || {};
Object.keys(M).forEach((k) => {
  const v = M[k], text = k.replace(/^m\|/, '');
  const f = path.join(root, 'audio', v.indexOf('.') >= 0 ? v : text + '.' + v);
  if (!fs.existsSync(f)) fail('the manifest names ' + path.basename(f) + ' for "' + k + '" but the file is missing');
});
// the manifest is what build-audio.py would write
const before = fs.readFileSync(path.join(root, 'data', 'audio-manifest.js'), 'utf8');
cp.execSync('python3 ' + path.join(__dirname, 'build-audio.py'), { stdio: 'pipe' });
if (fs.readFileSync(path.join(root, 'data', 'audio-manifest.js'), 'utf8') !== before) { fs.writeFileSync(path.join(root, 'data', 'audio-manifest.js'), before); fail('data/audio-manifest.js is out of date (run python3 tools/build-audio.py)'); }
if (bad) process.exit(1);
console.log('audio tests passed (' + list.length + ' lines to record, ' + male + ' by the man, ' + Object.keys(M).length + ' recorded)');
