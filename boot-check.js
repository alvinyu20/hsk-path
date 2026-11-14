/* Shanlu boot check. Loaded first. Watches the page start: if the app has not started (or has stopped drawing) it shows a plain screen with what went
 * wrong, and buttons to retry. It records script errors from the very start so that screen can say what failed.
 * 1) the stored offline copy (service worker + its files) is cleared once automatically, in case a half-updated copy is the problem;
 * 2) after that, or at once when a script error is already known, it shows the screen below. "Start fresh" wipes this device's saved Shanlu data
 *    (progress that was synced or exported can be brought back; nothing on any server is touched). */
(function () {
  var errs = [];
  var note = function (s) { try { s = String(s).slice(0, 300); if (errs.length < 6 && errs.indexOf(s) < 0) errs.push(s); } catch (e) {} };
  window.__shanluErrors = errs;
  window.addEventListener('error', function (ev) {
    try {
      var t = ev.target;
      if (t && t !== window && (t.src || t.href)) { note('file did not load: ' + (t.src || t.href).split('/').slice(-2).join('/')); return; }
      note((ev.message || 'error') + ' @ ' + String(ev.filename || '').split('/').pop().split('?')[0] + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0));
    } catch (e) {}
  }, true);
  window.addEventListener('unhandledrejection', function (ev) { try { note('promise: ' + ((ev.reason && (ev.reason.message || ev.reason)) || 'rejected')); } catch (e) {} });
  var t0 = Date.now();
  var healthy = function () { return !!(window.shanlu && document.querySelector('.app')); };
  var box = null;
  var clear = function (everything) {
    var jobs = [];
    try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })); } catch (e) {}
    try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('shanlu-') === 0; }).map(function (k) { return caches.delete(k); })); })); } catch (e) {}
    if (everything) { try { var del = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('shanlu') === 0) del.push(k); } del.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }
    return Promise.all(jobs).catch(function () {});
  };
  var show = function () {
    if (box) return;
    box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;overflow:auto;padding:28px 22px;background:#0F1A20;color:#F4EFE3;font:16px/1.4 system-ui,sans-serif;text-align:center');
    var btn = 'font:inherit;padding:12px 22px;border-radius:999px;border:0;color:#fff;margin:6px';
    var secs = Math.round((Date.now() - t0) / 1000);
    box.innerHTML = '<div style="max-width:420px;margin:12vh auto 0">' +
      '<p style="font-size:20px;margin:0 0 10px">Shanlu did not start</p>' +
      '<p style="margin:0 0 14px;opacity:.8">It has not drawn anything after ' + secs + ' seconds. Please send a screenshot of this screen.</p>' +
      '<pre id="sl-diag" style="text-align:left;white-space:pre-wrap;word-break:break-word;font:12px/1.35 ui-monospace,Menlo,monospace;background:#1a2a33;border-radius:10px;padding:10px;margin:0 0 16px"></pre>' +
      '<button type="button" id="sl-wait" style="' + btn + ';background:#3a4a53">Keep waiting</button>' +
      '<button type="button" id="sl-clear" style="' + btn + ';background:#C0352B">Clear the stored site and retry</button>' +
      '<button type="button" id="sl-fresh" style="' + btn + ';background:#7a2a24">Start fresh on this device</button>' +
      '<p style="margin:14px 0 0;font-size:13px;opacity:.7">Start fresh removes the progress saved on this phone only. Anything synced to your GitHub gist or the friends group stays where it is.</p></div>';
    (document.body || document.documentElement).appendChild(box);
    var d = box.querySelector('#sl-diag');
    d.textContent = 'script errors: ' + (errs.length ? '\n- ' + errs.join('\n- ') : 'none') + '\nshanlu started: ' + (window.shanlu ? 'yes' : 'no') + '   screen drawn: ' + (document.querySelector('.app') ? 'yes' : 'no') + '\nscripts run: ' + document.readyState + '\n' + (navigator.userAgent || '').slice(0, 90);
    box.querySelector('#sl-wait').onclick = function () { box.parentNode.removeChild(box); box = null; waited = true; };
    box.querySelector('#sl-clear').onclick = function () { clear(false).then(function () { location.reload(); }); };
    box.querySelector('#sl-fresh').onclick = function () { if (window.confirm('Remove the progress saved on this phone? (Synced progress stays on its server.)')) clear(true).then(function () { try { sessionStorage.removeItem('shanlu-heal'); } catch (e) {} location.reload(); }); };
  };
  var waited = false, healed = false;
  var tick = function () {
    if (healthy()) { if (box) { box.parentNode.removeChild(box); box = null; } return; }   // started (maybe slowly): nothing to show
    var age = Date.now() - t0;
    if (age > 3000 && errs.length && !box && !waited) show();                              // a script error is already known: say so now
    else if (age > 9000 && !box && !waited) {
      var tried = false; try { tried = sessionStorage.getItem('shanlu-heal') === '1'; } catch (e) {}
      if (!tried && !errs.length && !healed) { healed = true; try { sessionStorage.setItem('shanlu-heal', '1'); } catch (e) {} clear(false).then(function () { location.reload(); }); return; }
      show();
    }
    if (age < 120000) setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
  // after it started: if it stops drawing later (a screen that throws when drawn), the same screen appears
  var gone = 0;
  setInterval(function () { if (!window.shanlu) return; if (!document.querySelector('.app')) { gone++; if (gone >= 4 && !box) { t0 = Date.now() - 10000; waited = false; show(); } } else gone = 0; }, 1000);
})();
