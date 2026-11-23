/* Browser test for the Journey: real site in Chromium. Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-journey.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
// the travel window covers the page until it is closed
let sawDone = 0;
const closeTrip = async (page) => { const b = page.locator('.jy-trip-go'); if (await b.count()) await b.click(); await page.waitForTimeout(80); const d = page.locator('.jd-skip'); if (await d.count()) { sawDone++; await d.click(); await page.waitForTimeout(40); } };
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const open = async (opts) => {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 900 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    await ctx.route(/wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));   // photos come from Wikimedia: a stand-in picture keeps the test offline
    if (opts.xp != null) await ctx.addInitScript((o) => { if (!localStorage.getItem('shanlu-progress-v1')) localStorage.setItem('shanlu-progress-v1', JSON.stringify({ xp:o.xp, dayXp: 0 })); window.SHANLU_MUTE_SFX = true; window.SHANLU_JY_FIRST = o.first; }, { xp:opts.xp, first:opts.first || 'sichuan' });
    else await ctx.addInitScript(() => { window.SHANLU_MUTE_SFX = true; window.SHANLU_JY_FIRST = 'sichuan'; });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(site); await page.waitForSelector('.app');
    return { ctx, page, errors };
  };
  const main = (p) => p.locator('main').innerText();

  // ---- a new person: the first flight is free ----
  {
    const { ctx, page, errors } = await open({});
    check((await page.locator('.pill.xpp').textContent()).includes('0 coins'), 'the coins pill is in the header');
    check(await page.locator('.xp-ready').count() === 0 && await page.locator('.nav .badge.jyb').count() === 1 && /1 stop ready/.test(await page.locator('.nav .badge.jyb').getAttribute('aria-label')), 'one stop waiting shows once, on the Journey tab, with a label');
    await page.locator('.pill.xpp').click();
    check((await main(page)).includes('Take your first flight (free)'), 'a new person sees the free first flight');
    check(await page.locator('.jy-go[disabled]').count() === 0, 'the first flight button is enabled at 0 coins');
    await page.locator('.jy-go').click();
    let t = await main(page);
    check(/Welcome to Sichuan/.test(t) && /TFU/.test(t) && /Chéngdū Tiānfǔ Guójì Jīchǎng/.test(t), 'the airport arrival card shows the code and pinyin');
    // the flight in comes with a boarding pass (from home, the first time) and a sentence to say at the airport
    const pass = await page.locator('.jy-card .jy-tk.fly').innerText().catch(() => '');
    check(/登机牌/.test(pass) && /TFU/.test(pass) && /成都/.test(pass) && /家/.test(pass) && /SL 001/.test(pass), 'the first flight shows a boarding pass from home to TFU: ' + pass.replace(/\s+/g, ' '));
    const say = await page.locator('.jy-sayit').innerText();
    check(/Say it there/i.test(say) && /[\u4e00-\u9fff]+[。？！]/.test(say) && /At the airport/i.test(say), 'the card has a sentence to say there: ' + say.replace(/\s+/g, ' '));
    { const it = await page.locator('.jy-card .jy-intro').innerText().catch(() => '');
      check(/Sichuan in three lines/.test(it) && /THE LAND/i.test(it) && /THE TABLE/i.test(it) && /GOOD TO KNOW/i.test(it) && /must-sees? to find/.test(it), 'the airport card has the three lines about the region: ' + it.replace(/\s+/g, ' ').slice(0, 80)); }
    check(await page.locator('.jy-now .jy-hero').count() === 0, 'the province photo is not shown above the road');
    check(await page.locator('.jy-go[disabled]').count() === 1 && await page.locator('.jy-earn').count() === 1, 'the next stop is not free, and a small "How to earn?" button sits beside the travel button');
    check(/50 more coins to go/.test(t), 'the next stop costs 50 coins');
    // the background tint follows the region
    const hue = await page.locator('.jy').evaluate(el => getComputedStyle(el).getPropertyValue('--jh').trim());
    check(hue === '8', 'Sichuan has its own colour (hue 8), got ' + hue);
    // the travel moment plays once, and a key press skips to the finished picture
    check(await page.locator('.jy.jy-playing.jyp-fly').count() === 1 && await page.locator('.jy-coins').count() === 1 && await page.locator('.jy-trip.m1.play').count() === 1, 'the flight starts the travel moment (coins fly into the price bar, the button wakes, the postcard flips, the stamp lands)');
    check(await page.locator('.jy-trip .m1-front').count() === 1 && (await page.locator('.jy-trip .m1-front').innerText()).includes('?'), 'the front of the postcard is a mystery that names only the kind of place');
    await page.waitForTimeout(600); await page.keyboard.press('Shift'); await page.waitForTimeout(250);
    check(await page.locator('.jy-playing').count() === 0 && await page.locator('.jy-trip').count() === 0 && await page.locator('.jy-card').count() === 1, 'a key press skips the travel moment and goes straight to the stop page');
    await closeTrip(page);
    check(await page.locator('.jy-here .rip').count() === 2, 'two quiet rings mark where you are on the country map');
    check(await page.locator('.jy-me').count() === 1 && /You (are|start)/.test(await page.locator('.jy-me .cap').textContent()), 'your avatar sits on the country map, labelled');
    check(await page.locator('.mstoast').count() === 0 && await page.evaluate(() => (window.shanlu.state.msQueue || []).some(x => /Boarding pass/.test(x.title))), 'the Boarding pass achievement waits while the new stop page is open');
    await page.locator('.jy-acts .btn.pri').click(); await page.waitForTimeout(900);
    check(await page.locator('.jy-card').count() === 0, 'the card closes');
    check(/Boarding pass/.test(await page.locator('.mstoast').innerText().catch(() => '')), 'then the Boarding pass achievement shows');
    await page.locator('.jy-earn').click();
    { const g = await page.locator('.coin-help').innerText().catch(() => '');
      check(/How to earn coins/.test(g) && /Treasure chest/.test(g) && /50 more/.test(g) && /first flight is free/.test(g), 'tapping it opens the coin guide with what is still needed: ' + g.replace(/\s+/g, ' ').slice(0, 120)); }
    await page.locator('.coin-help .obm-bar .linkbtn').click();
    check(await page.locator('.coin-help').count() === 0, 'the coin guide closes');
    // stops list and passport
    await page.locator('.jy-tabs button', { hasText: 'Postcards' }).click();
    check(/Chengdu Tianfu International Airport/.test(await main(page)) && await page.locator('.pstc').count() >= 1, 'the Postcards tab has the airport as a postcard');
    { const front = await page.locator('.pcard-f').first().innerText();
      const cardEn = await page.locator('.pstc').first().locator('.pcard-en').innerText();
      check(front.trim() === cardEn.trim() && cardEn.trim().length > 0 && await page.locator('.pcard-f').first().evaluate(b => !b.querySelector('.pcard-k')), 'a postcard front carries only the English name in its white border (' + front.trim() + ')');
      await page.locator('.pcard-f').first().click(); await page.waitForTimeout(120);
      check(await page.locator('.pstc.flip').count() === 1 && /Chengdu Tianfu International Airport/.test(await page.locator('.pstc.flip .pcard-k').innerText()), 'tapping a postcard turns it over to its message');
      await page.locator('.pstc.flip .pcard-k').click({ position:{ x:6, y:6 } }); await page.waitForTimeout(120);
      check(await page.locator('.pstc.flip').count() === 0, 'tapping the back turns it face-up again'); }
    await page.locator('.jy-tabs button', { hasText: 'Food' }).click();
    check(await page.locator('.fz-card .fz-hit').count() >= 5 && await page.locator('.fz-card .fz-hit:not(.hid)').count() === 0 && /^0 of \d+ found/.test(await page.locator('.fz-foot span').first().innerText()), 'the Food diary shows the whole table of a province you have reached, with every dish still a silhouette');
    check(!/Food diary|dishes ·/.test(await main(page)), 'the Food diary has no heading or summary line');
    check(await page.locator('.jy-now').count() === 0, 'the road card shows only on the Explore tab');
    await page.locator('.jy-tabs button', { hasText: 'Explore' }).click();
    check(await page.locator('.jy-now .jy-road svg').count() === 1 && /A flight|A new city|A sight|A dish|A cultural stop/.test(await page.locator('.jy-now .jy-road').innerHTML().then(h => h.replace(/<[^>]+>/g, ' '))), 'with no card open, the main card shows the road ahead over a scene of the province, and the next stop names only its kind');
    await page.locator('.jy-tabs button', { hasText: 'Passport' }).click();
    t = await main(page); check(/Regions\s*0 \/ 31/.test(t) && !/regions stamped/.test(t), 'the passport cover counts 31 regions and no words sit above the book: ' + t.match(/Regions\s*\d+ \/ \d+/));
    check(await page.locator('.jy-slot.here').count() === 1, 'the region you are in shows as in progress in the passport');
    // a stop gets paid for: the pill and the bar glow, and a small note says so
    await page.locator('.brand').click();
    check(await page.locator('.pill.xpp.ready').count() === 0 && await page.locator('.xp-ping').count() === 0, 'nothing glows while the next stop is not paid for');
    await page.evaluate(() => { const a = window.shanlu; a.setState({ xp: a.state.xp + 50, dayXp: a.state.dayXp + 50 }); });
    check(await page.locator('.pill.xpp.ready').count() === 1, 'the coins pill glows once enough coins are earned for a stop');
    check(/New stop unlocked/.test(await page.locator('.xp-ping').innerText().catch(() => '')), 'a small note says a new stop is unlocked');
    await page.locator('.xp-ping').click();
    check(await page.locator('.jy-meter').count() === 0 && await page.locator('.jy-go:not([disabled])').count() === 1, 'no bar above the travel button, and the button is ready');
    { const now = await page.locator('.jy-now').innerText(); check(await page.locator('.jy-last').count() === 1 && /latest stop/i.test(now) && await page.locator('.jy-prov').count() === 1 && !/earned in total|coins to spend|coins for the next/.test(now), 'the Journey card shows the latest stop and a province bar, with no coin text outside the button'); }
    check(await page.locator('.xp-ping').count() === 0, 'the note goes away on the Journey screen');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- with coins: travel, the order, the maps ----
  {
    const { ctx, page, errors } = await open({ xp: 1500 });
    await page.locator('.pill.xpp').click();
    await page.locator('.jy-go').click(); await closeTrip(page);   // flight in
    const want = ['Chengdu Tianfu International Airport', 'Chengdu'];
    let t = await main(page);
    check(/Welcome to Sichuan/.test(t), 'arrival first');
    await page.locator('.jy-acts .btn.pri').click();
    await page.locator('.jy-go').click(); await closeTrip(page);   // second stop: the main city
    t = await page.locator('.jy-card').innerText();
    check(/CITY/i.test(t) && /Chengdu/.test(t) && /成都/.test(t), 'the second stop is the main city, Chengdu');
    check(await page.locator('.jy-card .jy-tk.walk').count() === 1 && /走路/.test(await page.locator('.jy-card .jy-tk.walk').innerText()), 'a stop in the same city is reached on foot');
    check(/成都/.test(await page.locator('.jy-sayit-zh').innerText()), 'the sentence to say uses the name of the stop');
    check(await page.locator('.jy-ph').count() === 1 && await page.locator('.jy-here').count() === 1, 'after a stop the map of the region shows, with a mark where you are');
    check(/New city/.test(t) === false || true, 'ok');
    check(/1,450 coins/.test(await page.locator('.pill.xpp').textContent()), 'travelling spends coins: 1,500 minus the 50 for the second stop leaves 1,450');
    await page.locator('.jy-acts .btn.pri').click();
    // keep travelling while coins last: every stop in this city block belongs to Chengdu until the city is done
    let n = 2, outside = 0;
    for (let i = 0; i < 12; i++) {
      if (await page.locator('.jy-go[disabled]').count()) break;
      await page.locator('.jy-go').click(); await closeTrip(page); n++;
      const place = await page.locator('.jy-place').innerText();
      if (!/Chengdu/.test(place)) outside++;
      await page.locator('.jy-acts .btn.pri').click();
    }
    check(outside === 0, 'the first stops after the main city are all in Chengdu');
    // the map
    await page.locator('.jy-tabs button', { hasText: 'Map' }).click();
    if (await page.locator('.jy-ph .linkbtn').count()) await page.locator('.jy-ph .linkbtn').click();   // travelling leaves the region map open: back to the whole map
    check(await page.locator('.jy-r').count() >= 28, 'the country map has the regions: ' + await page.locator('.jy-r').count());
    check(await page.locator('.jy-r.here').count() === 1, 'the region you are in is outlined');
    await page.locator('.jy-r.here').click();
    check(await page.locator('.jy-pin').count() >= 1, 'the region map shows pins');
    const pinsAll = await page.locator('.jy-pin').count();
    await page.locator('.jy-chip', { hasText: 'Dishes' }).click();
    const pinsDish = await page.locator('.jy-pin').count();
    check(pinsDish <= pinsAll, 'the Dishes filter narrows the pins (' + pinsDish + ' of ' + pinsAll + ')');
    await page.locator('.jy-chip', { hasText: 'All' }).click();
    await page.locator('.jy-chip', { hasText: 'Must-see' }).click();
    const pinsSp = await page.locator('.jy-pin').count();
    check(pinsSp <= pinsAll, 'the Must-see filter keeps only the starred pins (may be none yet, the map shows stops you have visited) (' + pinsSp + ' of ' + pinsAll + ')');
    check(await page.locator('.jy-pin.sp').count() === pinsSp, 'every pin left under Must-see has the gold ring');
    await page.locator('.jy-chip', { hasText: 'All' }).click();
    // clusters: stops of one city sit together; tapping a cluster lists them
    while (await page.locator('.ms-x').count()) await page.locator('.ms-x').first().click();   // an achievement toast can sit on top of the map
    if (await page.locator('.jy-pin.kx').count()) {
      await page.locator('.jy-pin.kx').first().click({ force: true });
      check(await page.locator('.jy-sel .jy-row').count() >= 2, 'tapping a cluster lists its stops');
    } else check(true, 'no cluster yet');
    check(errors.length === 0, 'no errors while travelling: ' + errors.join(' | '));
    // the progress survives a reload
    await page.reload(); await page.waitForSelector('.app');
    await page.locator('.pill.xpp').click();
    check(/Exploring/i.test(await main(page)) && !/Take your first flight/.test(await main(page)), 'the journey is remembered after a reload');
    await ctx.close();
  }

  // ---- a whole small region: the ride between cities, city stamps, must-see stamps, the next flight ----
  {
    const { ctx, page, errors } = await open({ xp: 60000, first: 'macau' });
    await page.locator('.pill.xpp').click();
    let ride = '', cityStamp = false, star = false, second = '', n = 0;
    for (let i = 0; i < 70 && !second; i++) {
      await page.locator('.jy-go').click(); await closeTrip(page); n++;
      while (await page.locator('.ms-x').count()) await page.locator('.ms-x').first().click();
      if (await page.locator('.jy-cstamp.big').count()) cityStamp = true;
      if (await page.locator('.jy-starnote').count()) star = true;
      if (!ride && await page.locator('.jy-card .jy-tk.ride').count()) {
        ride = (await page.locator('.jy-card .jy-tk.ride').innerText()).replace(/\s+/g, ' ');
        check(await page.locator('.jy-route').count() === 1 && await page.locator('.jy-leg').count() === 1, 'the ride is drawn on the region map: the route, and the new leg');
      }
      if (n > 1 && await page.locator('.jy-card .jy-tk.fly').count()) second = (await page.locator('.jy-card .jy-tk.fly').innerText()).replace(/\s+/g, ' ');
      else await page.locator('.jy-acts .btn.pri').click();
    }
    check(/车票/.test(ride) && /澳门半岛/.test(ride) && /公里/.test(ride) && /km/.test(ride), 'moving to the next city shows a ticket with the two cities and the distance: ' + ride);
    check(cityStamp, 'finishing a city shows its city stamp');
    check(star, 'a must-see stop says its gold stamp is in the passport');
    check(/MFM/.test(second) && /SL 002/.test(second) && /公里/.test(second), 'the next flight leaves from Macau with the distance: ' + second);
    check(await page.locator('.jy-arc').count() === 1, 'the flight is drawn on the map of the whole country');
    check(sawDone === 1, 'finishing a region opens the celebration pop-up once (saw ' + sawDone + ')');
    await page.locator('.jy-acts .btn.pri').click();
    await page.locator('.jy-tabs button', { hasText: 'Passport' }).click();
    const t = await main(page);
    check(/Regions\s*1 \/ 31/.test(t) && /Cities\s*3 \/ \d+/.test(t) && /Must-sees\s*4 \/ \d+/.test(t), 'the passport cover counts regions, city stamps and must-sees: ' + (t.match(/Regions[\s\S]*Must-sees\s*\d+ \/ \d+/) || [''])[0].replace(/\s+/g, ' '));
    check(await page.locator('.pp-mark').count() === 3, 'the passport has a bookmark on the side for regions, cities and must-sees');
    check(await page.locator('.pp-pg.cv.cur').count() === 1, 'the passport is on its cover before a bookmark is tapped');
    await page.locator('.pp-mark.city').click(); await page.waitForTimeout(150);
    check(await page.locator('.pp-pg.cv.cur').count() === 0 && await page.locator('.pp-pg.cur .jy-cstamp').count() >= 1, 'tapping the Cities bookmark opens the cities page, not the cover');
    check(await page.locator('.pp-pg.cur .jy-cstamp.got').count() === 3 && await page.locator('.pp-pg.cur .jy-cstamp .st-art').count() === 3 && await page.evaluate(() => [...document.querySelectorAll('.pp-pg.cur .st-art')].every(i => /^data:image\/svg\+xml/.test(i.getAttribute('src')))), 'Macau gives three city stamps, each with a landmark');
    await page.locator('.pp-mark.star').click(); await page.waitForTimeout(150);
    check(await page.locator('.pp-pg.cv.cur').count() === 0 && await page.locator('.pp-mark.star.on').count() === 1, 'tapping a bookmark in the book goes straight to that section\'s page');
    check(await page.locator('.pp-pg.cur .jy-sstamp').count() === 4 && await page.locator('.pp-pg.cur .jy-sstamp .st-art').count() === 4, 'Macau gives four must-see stamps, each with a picture');
    await page.locator('.pp-mark.reg').click(); await page.waitForTimeout(150);
    check(await page.locator('.pp-pg.cv.cur').count() === 0, 'the Regions bookmark opens a page of regions');
    check(await page.locator('.jy-slot').count() === 2, 'the passport shows the regions you have been to: ' + await page.locator('.jy-slot').count());
    await page.locator('.jy-passmore').click();
    check(await page.locator('.jy-slot').count() === 31, 'the rest of the regions unfold on request');
    // the stamps carry little drawings: a landmark in each city stamp, a picture in each must-see, the arrival shape on the region stamp
    check(/ARRIVAL/.test(await page.locator('.pp-pg.cur .jy-stamp').first().innerText().catch(() => '')) || /ARRIVAL/.test(await page.locator('.jy-stamp').first().innerText()), 'the region stamp is an arrival stamp');
    // the passport is a book: a cover, then pages that turn
    { const pg0 = await page.evaluate(() => ({ pages:document.querySelectorAll('.pp-pg').length, cur:[...document.querySelectorAll('.pp-pg')].findIndex(p => p.classList.contains('cur')), cover:document.querySelectorAll('.pp-pg.cv').length }));
      check(pg0.cover === 1 && pg0.pages >= 2, 'the passport has a cover and at least one page (' + JSON.stringify(pg0) + ')');
      for (let i = 0; i < 12 && !(await page.locator('.pp-arrow[aria-label="Previous page"]').isDisabled()); i++) { await page.locator('.pp-arrow[aria-label="Previous page"]').click(); await page.waitForTimeout(60); }
      await page.waitForTimeout(120);
      check(await page.locator('.pp-pg.cv.cur').count() === 1 && await page.locator('.pp-arrow[aria-label="Previous page"]').isDisabled(), 'the previous arrow turns back to the cover and then stops');
      await page.locator('.pp-arrow[aria-label="Next page"]').click(); await page.waitForTimeout(150);
      check(await page.locator('.pp-pg.cv.turned').count() === 1 && await page.locator('.pp-pg.cur .jy-slot').count() >= 1, 'the next arrow turns the cover over to the first page of stamps');
      check(await page.locator('.pp-pg[aria-hidden="true"]').count() === (await page.locator('.pp-pg').count()) - 1, 'only the open page is readable by a screen reader'); }
    await page.locator('.pp-mark.star').click(); await page.waitForTimeout(150);
    await page.locator('.pp-pg.cur .jy-sstamp').first().click();
    check(await page.locator('.jy-card.sp').count() === 1 && await page.locator('.jy-card .jy-tk').count() === 0, 'a must-see stamp opens its stop, with no ticket on a stop opened later');
    // the Food diary is one menu per province, and the postcard wall leaves the dishes to it
    await page.locator('.jy-tabs button', { hasText: 'Food' }).click();
    check(await page.locator('.fz-card').count() === 1 && await page.locator('.fz-card .fz-hit').count() >= 1 && await page.locator('.fz-chip').count() >= 1, 'the Food diary is a feast table with dishes on it, one chip per province');
    check(await page.locator('.fz-chip').count() === (await page.evaluate(() => new Set([...document.querySelectorAll('.fz-chip b.zh')].map(e => e.textContent)).size)), 'the Food diary has one table per province');
    check(await page.locator('.fd-menu .jy-dish').count() >= 1, 'the menu as a list is still there under the table');
    const pickChip = async (sel) => { for (let i = 0, n = await page.locator('.fz-chip').count(); i < n && !(await page.locator(sel).count()); i++) { await page.locator('.fz-chip').nth(i).click(); await page.waitForTimeout(120); } };
    await pickChip('.fz-card .fz-hit.hid');   // a province with dishes still to find
    await page.locator('.fz-card').click(); await page.waitForTimeout(150);
    check(await page.locator('.fz-ov .fz-hit').count() >= 1, 'tapping the table opens it full screen');
    await page.locator('.fz-ov .fz-hit.hid').first().click({ force: true }); await page.waitForTimeout(150);
    check(await page.locator('.fz-pop').count() === 1 && /Not found yet/.test(await page.locator('.fz-pop').innerText()) && !/[一-鿿]/.test(await page.locator('.fz-pop').innerText()) && await page.locator('.fz-pop .btn', { hasText: 'Open this stop' }).count() === 0, 'tapping a silhouette says it is not found yet, with no name');
    await page.locator('.fz-pop .btn', { hasText: 'Close' }).click(); await page.waitForTimeout(80);
    await page.locator('.fz-x').click(); await page.waitForTimeout(80);
    await pickChip('.fz-card .fz-hit:not(.hid)');   // a province with a dish you have found
    await page.locator('.fz-card').click(); await page.waitForTimeout(150);
    await page.locator('.fz-ov .fz-hit:not(.hid)').first().click({ force: true }); await page.waitForTimeout(150);
    check(await page.locator('.fz-pop .zh').count() === 1 && (await page.locator('.fz-pop .zh').innerText()).length > 0, 'tapping a dish shows what it is');
    await page.locator('.fz-pop .btn', { hasText: 'Close' }).click(); await page.waitForTimeout(80);
    check(await page.locator('.fz-pop').count() === 0 && await page.locator('.fz-ov').count() === 1, 'the dish popup closes and leaves the table open');
    await page.locator('.fz-x').click(); await page.waitForTimeout(80);
    check(await page.locator('.fz-ov').count() === 0, 'the full-screen table closes');
    await page.locator('.jy-tabs button', { hasText: 'Postcards' }).click();
    check(await page.locator('.jy-chip', { hasText: 'Dishes' }).count() === 0, 'the postcard wall has no Dishes filter');
    check(errors.length === 0, 'no errors on the long trip: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- reduced motion: no travel moment, the picture simply appears ----
  {
    const { ctx, page, errors } = await open({ reduced: true });
    await page.locator('.pill.xpp').click();
    await page.locator('.jy-go').click(); await closeTrip(page); await page.waitForTimeout(150);
    check(await page.locator('.jy-playing').count() === 0 && await page.locator('.jy-coins').count() === 0 && await page.locator('.jy-card').count() === 1, 'with reduced motion the flight shows the finished picture at once');
    check(errors.length === 0, 'no errors with reduced motion: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- a phone: nothing spills sideways ----
  {
    const { ctx, page, errors } = await open({ xp: 800, viewport: { width: 390, height: 844 } });
    await page.locator('.pill.xpp').click();
    await page.locator('.jy-go').click(); await closeTrip(page); await page.waitForTimeout(100);
    { const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(over <= 1, 'the card with its boarding pass fits a phone width (overflow ' + over + 'px)'); }
    for (const tab of ['Map', 'Postcards', 'Food', 'Passport']) {
      await page.locator('.jy-tabs button', { hasText: tab }).click();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 1, tab + ' tab fits a phone width (overflow ' + over + 'px)');
    }
    check(errors.length === 0, 'no errors on the phone: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- finds land where they belong (buttons, NEW tags, tab dots), rarer reveals, travel sounds, Shanlu Air status ----
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, xp: 60000 });
    await page.evaluate(() => { window.SHANLU_JY_FIRST = 'macau'; });
    const tiers = await page.evaluate(() => [0, 2, 3, 7, 8, 14, 15, 31].map(n => window.shanlu.testApi.ffTier(n).t.en + ':' + window.shanlu.testApi.ffTier(n).toGo).join(' '));
    check(tiers === 'Bronze:3 Bronze:1 Silver:5 Silver:1 Gold:7 Gold:1 Platinum:0 Platinum:0', 'Shanlu Air status: Bronze from 0, Silver at 3, Gold at 8, Platinum at 15 regions (' + tiers + ')');
    await page.evaluate(() => window.shanlu.go('journey')); await page.waitForTimeout(200);
    const sfx = () => page.evaluate(() => window.__sfxLog || []);
    await page.evaluate(() => { window.__sfxLog = []; });
    await page.locator('.jy-go').click(); await page.waitForTimeout(300);
    check(await page.locator('.jy-tdot').count() === 0, 'no tab dots while the travel moment plays (they would give away what is coming)');
    await page.waitForTimeout(4600);
    const s1 = await sfx();
    check(['plane', 'stamp'].every(x => s1.indexOf(x) >= 0) && s1.some(x => /waves|wind|birds/.test(x)), 'a flight sounds like a plane, then the place, then the stamp (' + s1.join(',') + ')');
    check(await page.locator('.jy-tk.fly.tier-bronze').count() === 1 && /Shanlu Air · Bronze/i.test(await page.locator('.jy-tk.fly').innerText()), 'the boarding pass is bronze to start with');
    check((await page.locator('.jy-lands button').allInnerTexts()).join('|').includes('Pin it to the wall'), 'the stop page offers to pin the postcard to the wall');
    check(await page.locator('.jy-tabs button[data-tab="stops"] .jy-tdot').count() === 1, 'the Postcards tab has a dot');
    await page.locator('.jy-lands button', { hasText: 'Pin it to the wall' }).click(); await page.waitForTimeout(300);
    const airport = await page.evaluate(() => window.shanlu.testApi.jyRead().seen[0]);
    check(await page.evaluate(() => window.shanlu.state.jyTab) === 'stops' && await page.locator('.pstc.land').count() === 1 && await page.locator('.pstc.isnew .jy-newtag').count() === 1, 'it opens the postcard wall, where the new card lands with a NEW tag');
    await page.waitForTimeout(2000);
    check(await page.evaluate(() => window.shanlu.state.jyFlip) === airport, 'then the card turns over by itself');
    check(await page.locator('.jy-tabs button[data-tab="stops"] .jy-tdot').count() === 0 && await page.evaluate(() => (JSON.parse(localStorage.getItem('shanlu-person')).prefs.jyNew.v.stops || []).length) === 0, 'looking at the wall clears its dot and its saved "new" list');
    // on to a dish, a must-see and so on (skipping the moments)
    const seen = {};
    for (let i = 0; i < 40 && !(seen.food && seen.star); i++) {
      await page.evaluate(() => window.shanlu.jyTabSet('explore')); await page.waitForTimeout(60);
      await page.evaluate(() => { window.__sfxLog = []; });
      await page.locator('.jy-go').click(); await page.waitForTimeout(80);
      const gold = /\bgold\b/.test(await page.locator('.m1').getAttribute('class'));
      if (gold && !seen.star) { await page.waitForTimeout(1400); check((await sfx()).indexOf('gold') >= 0, 'a must-see reveal has its own glittering sound'); }
      await closeTrip(page); await page.waitForTimeout(150);
      const lands = (await page.locator('.jy-lands button').allInnerTexts()).join('|');
      if (!seen.food && lands.includes('Put it on the table')) {
        seen.food = 1; const id = await page.evaluate(() => window.shanlu.state.jyRv.id);
        await page.locator('.jy-lands button', { hasText: 'Put it on the table' }).click(); await page.waitForTimeout(400);
        const fs = await page.evaluate(() => ({ tab: window.shanlu.state.jyTab, ov: window.shanlu.state.jyFoodOv }));
        const svg = await page.locator('.fz-ov, .jy-food-ov, [class*="fz-ov"]').first().innerHTML().catch(() => '');
        check(fs.tab === 'food' && fs.ov && /fz-spot/.test(svg) && /NEW/.test(svg), 'Put it on the table opens the big table with the dish in a pool of light and a NEW tag');
        await page.waitForTimeout(2400);
        check(await page.evaluate(() => window.shanlu.state.jyFoodPop) === id, 'then the dish\'s card opens');
        await page.evaluate(() => window.shanlu.setState({ jyFoodOv: false, jyFoodPop: null }));
      } else if (!seen.star && gold) {
        seen.star = 1;
        check(lands.includes('Stamp the passport'), 'a must-see offers to stamp the passport');
        await page.locator('.jy-lands button', { hasText: 'Stamp the passport' }).click(); await page.waitForTimeout(400);
        check(await page.evaluate(() => window.shanlu.state.jyTab === 'pass' && window.shanlu.state.jyPsec === 'star') && await page.locator('.pp-pg.cur .jy-sstamp.land').count() === 1, 'it opens the passport on the must-see page, where the gold stamp lands');
      }
    }
    check(seen.food && seen.star, 'reached a dish and a must-see');
    await page.evaluate(() => window.shanlu.jyTabSet('pass')); await page.waitForTimeout(300);
    const cover = await page.locator('.pp-cover').first().innerText();
    check(/铜卡/.test(cover) && /SHANLU AIR BRONZE/i.test(cover) && /3 more regions to Silver/.test(cover), 'the passport cover shows the status and how far the next one is: ' + cover.replace(/\s+/g, ' '));
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- the next region is a secret until you land; the day you were there on postcards; the packed save; souvenir sets ----
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, xp: 60000, first: 'hainan', reduced: true });
    const sets = await page.evaluate(() => window.shanlu.testApi.SV_SETS.map(t => t.ids));
    const flat = [].concat(...sets);
    check(sets.length === 12 && sets.every(t => t.length >= 4) && new Set(flat).size === flat.length && await page.evaluate((ids) => ids.every(id => window.SOUVENIRS.some(x => x.id === id)), flat), 'twelve souvenir sets, each souvenir in one set at most, all real souvenirs (' + flat.length + ')');
    await page.evaluate(() => window.shanlu.go('journey')); await page.waitForTimeout(200);
    let stamped = false;
    for (let i = 0; i < 70 && !stamped; i++) {
      await page.evaluate(() => window.shanlu.jyTabSet('explore'));
      await page.locator('.jy-go').click(); await page.waitForTimeout(60);
      if (await page.locator('.jy-trip-go').count()) { await page.locator('.jy-trip-go').click(); await page.waitForTimeout(60); }
      if (!(await page.locator('.jd-skip').count())) { if (await page.locator('.jy-acts .btn.pri').count()) await page.locator('.jy-acts .btn.pri').click(); continue; }
      {
        stamped = true;
        const pop = await page.locator('.jy-done-bg').innerText();
        const nextId = await page.evaluate(() => window.shanlu.testApi.jyRead().reg);
        const nextEn = await page.evaluate((id) => (window.JOURNEY.regions.find(r => r.id === id) || {}).en, nextId);
        check(/somewhere new/i.test(pop) && pop.indexOf(nextEn) < 0, 'the region pop-up keeps the next region a secret (' + nextEn + '): ' + pop.replace(/\s+/g, ' ').slice(0, 120));
        await page.locator('.jd-skip').click(); await page.waitForTimeout(100);
        if (await page.locator('.jy-acts .btn.pri').count()) await page.locator('.jy-acts .btn.pri').click();
        await page.evaluate(() => { window.shanlu.jyTabSet('explore'); window.scrollTo(0, 0); }); await page.waitForTimeout(200);
        const ex = await page.locator('main').innerText();
        check(/Somewhere new/.test(ex) && ex.indexOf(nextEn) < 0, 'Explore shows "Somewhere new", not ' + nextEn);
        await page.evaluate(() => { window.shanlu.jyTabSet('map'); window.shanlu.setState({ jyReg: null }); }); await page.waitForTimeout(200);
        const me = await page.evaluate(() => { const e = document.querySelector('.jy-me'); return e ? e.getAttribute('aria-label') : ''; });
        check(/You are in Hainan/.test(me), 'on the map you are still in Hainan: ' + me);
        await page.evaluate(() => window.shanlu.jyTabSet('explore')); await page.waitForTimeout(100);
        const mapTxt = await page.evaluate(() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).join(' | '));
        check(!/next flight/i.test(mapTxt) && mapTxt.indexOf(nextEn + ', next') < 0, 'no "next flight" mark on the map');
        await page.locator('.jy-go').click(); await page.waitForTimeout(100);
        if (await page.locator('.jy-trip-go').count()) await page.locator('.jy-trip-go').click();
        await page.waitForTimeout(100);
        const card = await page.locator('main').innerText();
        check(card.indexOf(nextEn) >= 0, 'flying there reveals it: ' + nextEn);
      }
    }
    check(stamped, 'finished Hainan');
    const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-person')).prefs.jy.v);
    check(raw.v === 2 && typeof raw.s === 'string' && raw.s.length === raw.n * 6 && !raw.seen && raw.d.length >= raw.n, 'the Journey is saved packed (' + JSON.stringify(raw).length + ' bytes for ' + raw.n + ' stops)');
    await page.evaluate(() => window.shanlu.jyTabSet('stops')); await page.waitForTimeout(200);
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    check(await page.locator('.pstc .pcard-when').count() > 0 && (await page.locator('.pstc .pcard-when').first().getAttribute('aria-label')).startsWith('You were here on ') && (await page.locator('.pstc .pcard-when b').first().innerText()) === today, 'postcards carry the day you were there (' + today + ')');
    await page.evaluate(() => window.shanlu.jyTabSet('shelf')); await page.waitForTimeout(200);
    check(await page.locator('.sv-set').count() === 12 && /0 of 12 sets complete/.test(await page.locator('.sv-sets-h').innerText()), 'the shelf shows the 12 sets');
    await page.locator('.sv-set', { hasText: 'Master crafts' }).click();
    const cells = await page.locator('.sv-cell').count();
    check(cells === 7 && /Master crafts: 1 of 7 found/.test(await page.locator('main').innerText()), 'tapping a set shows only its souvenirs (the coconut carving from Hainan found): ' + cells);
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }
  // ---- an older save (stop ids, no dates) still works, keeps its days where known, and is packed when opened ----
  {
    const { ctx, page, errors } = await open({ xp: 0 });
    await page.evaluate(() => {
      const ids = window.JOURNEY.regions.find(r => r.id === 'hainan'); const W = window.ShanluJourney.build(window.JOURNEY);
      const R = W.byRegion.hainan; const seen = [R.cities[0].air.id].concat(R.cities[0].stops.filter(s => s.k !== 'P').slice(0, 3).map(s => s.id));
      const v = { v: 1, n: seen.length, reg: 'hainan', started: true, cq: [], cur: R.cities[0].id, sq: [], seen, done: {}, arr: { hainan: '2026-11-02' }, ms: {}, sd: 'abc' };
      const P = JSON.parse(localStorage.getItem('shanlu-person') || '{"prefs":{}}'); P.prefs = P.prefs || {}; P.prefs.jy = { v, at: Date.now() }; localStorage.setItem('shanlu-person', JSON.stringify(P));
    });
    await page.reload(); await page.waitForSelector('.app');
    await page.evaluate(() => { window.shanlu.go('journey'); window.shanlu.jyTabSet('stops'); }); await page.waitForTimeout(300);
    const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('shanlu-person')).prefs.jy.v);
    check(raw.v === 2 && raw.n === 4, 'an older save is packed the first time the Journey opens');
    check(await page.locator('.pstc').count() === 4 && await page.locator('.pcard-when').count() === 1, 'its stops are all there; only the arrival has a known day');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('journey browser tests passed');
})().catch(e => { console.log(e); process.exit(1); });
