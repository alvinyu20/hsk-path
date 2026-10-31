/* Shanlu: which level this page shows (1 or 2). Chosen in the header or in Settings, saved in this browser, and applied by reloading.
 * Runs before the data files and app.js. A ?level=2 address works too (used by the tests); it is saved like a click on the switch. */
(function () {
  var KEY = 'shanlu-level';
  var level = 1;
  try {
    var q = /[?&]level=(\d)/.exec(location.search);
    if (q && (q[1] === '1' || q[1] === '2')) {
      localStorage.setItem(KEY, q[1]);
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}   // so a later reload does not reapply it
    }
    var saved = parseInt(localStorage.getItem(KEY), 10);
    if (saved === 1 || saved === 2) level = saved;
  } catch (e) {}
  window.SHANLU_LEVEL = level;
  if (document.title) document.title = 'Shanlu · HSK ' + level + ' study path';
})();
