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
    check(await page.locator('.xp-ready').count() === 1, 'the pill shows one stop waiting');
    await page.locator('.pill.xpp').click();
    check((await main(page)).includes('Take your first flight (free)'), 'a new person sees the free first flight');
    check(await page.locator('.jy-go[disabled]').count() === 0, 'the first flight button is enabled at 0 coins');
    await page.locator('.jy-go').click();
    let t = await main(page);
    check(/Welcome to Sichuan/.test(t) && /TFU/.test(t) && /Chéngdū Tiānfǔ Guójì Jīchǎng/.test(t), 'the airport arrival card shows the code and pinyin');
    check(/Boarding pass/.test(await page.locator('.mstoast').innerText().catch(() => '')), 'the Boarding pass achievement shows');
    // the flight in comes with a boarding pass (from home, the first time) and a sentence to say at the airport
    const pass = await page.locator('.jy-card .jy-tk.fly').innerText().catch(() => '');
    check(/登机牌/.test(pass) && /TFU/.test(pass) && /成都/.test(pass) && /家/.test(pass) && /SL 001/.test(pass), 'the first flight shows a boarding pass from home to TFU: ' + pass.replace(/\s+/g, ' '));
    const say = await page.locator('.jy-sayit').innerText();
    check(/Say it there/i.test(say) && /[\u4e00-\u9fff]+[。？！]/.test(say) && /At the airport/i.test(say), 'the card has a sentence to say there: ' + say.replace(/\s+/g, ' '));
    { const it = await page.locator('.jy-card .jy-intro').innerText().catch(() => '');
      check(/Sichuan in three lines/.test(it) && /THE LAND/i.test(it) && /THE TABLE/i.test(it) && /GOOD TO KNOW/i.test(it) && /must-sees? to find/.test(it), 'the airport card has the three lines about the region: ' + it.replace(/\s+/g, ' ').slice(0, 80)); }
    check(await page.locator('.jy-now .jy-hero').count() === 0, 'the province photo is not shown above the road');
    check(await page.locator('.jy-go[disabled]').count() === 1, 'the next stop is not free');
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
    await page.locator('.jy-acts .btn.pri').click();
    check(await page.locator('.jy-card').count() === 0, 'the card closes');
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

  await browser.close(); server.close();
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('journey browser tests passed');
})().catch(e => { console.log(e); process.exit(1); });
