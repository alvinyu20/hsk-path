/* Shanlu boot check. If the app has not started 9 seconds after the page opened (for example a half-updated offline copy on a phone),
 * it clears the offline copy (service worker and its stored files) and reloads once; if that does not help it shows a plain
 * message with a button. Progress is kept: it lives in the browser's saved data, which this never touches. */
(function () {
  setTimeout(function () {
    if (window.shanlu) return;
    var tried = false; try { tried = sessionStorage.getItem('shanlu-heal') === '1'; } catch (e) {}
    var clear = function () {
      var jobs = [];
      try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })); } catch (e) {}
      try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('shanlu-') === 0; }).map(function (k) { return caches.delete(k); })); })); } catch (e) {}
      return Promise.all(jobs).catch(function () {});
    };
    if (!tried) {
      try { sessionStorage.setItem('shanlu-heal', '1'); } catch (e) {}
      clear().then(function () { location.reload(); });
      return;
    }
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:#0F1A20;color:#F4EFE3;font:16px/1.4 system-ui,sans-serif;text-align:center';
    box.innerHTML = '<div><p style="font-size:20px;margin:0 0 10px">Shanlu did not start</p><p style="margin:0 0 18px;opacity:.8">Your progress is safe. Tap the button to clear the stored copy of the site and try again.</p><button type="button" style="font:inherit;padding:12px 22px;border-radius:999px;border:0;background:#C0352B;color:#fff">Clear and try again</button></div>';
    box.querySelector('button').onclick = function () { clear().then(function () { try { sessionStorage.removeItem('shanlu-heal'); } catch (e) {} location.reload(); }); };
    document.body.appendChild(box);
  }, 9000);
})();
