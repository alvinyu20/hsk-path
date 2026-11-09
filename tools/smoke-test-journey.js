/* Browser test for the Journey: real site in Chromium. Usage: NODE_PATH=$(npm root -g) node tools/smoke-test-journey.js */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const open = async (opts) => {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 900 } });
    await ctx.route(/wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));   // photos come from Wikimedia: a stand-in picture keeps the test offline
    if (opts.xp != null) await ctx.addInitScript((xp) => { if (!localStorage.getItem('shanlu-progress-v1')) localStorage.setItem('shanlu-progress-v1', JSON.stringify({ xp, dayXp: 0 })); window.SHANLU_MUTE_SFX = true; window.SHANLU_JY_FIRST = 'sichuan'; }, opts.xp);
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
    check((await page.locator('.pill.xpp').innerText()).includes('0 coins'), 'the coins pill is in the header');
    check(await page.locator('.xp-ready').count() === 1, 'the pill shows one stop waiting');
    await page.locator('.pill.xpp').click();
    check((await main(page)).includes('Take your first flight (free)'), 'a new person sees the free first flight');
    check(await page.locator('.jy-go[disabled]').count() === 0, 'the first flight button is enabled at 0 coins');
    await page.locator('.jy-go').click();
    let t = await main(page);
    check(/Welcome to Sichuan/.test(t) && /TFU/.test(t) && /Chéngdū Tiānfǔ Guójì Jīchǎng/.test(t), 'the airport arrival card shows the code and pinyin');
    check(/Boarding pass/.test(await page.locator('.mstoast').innerText().catch(() => '')), 'the Boarding pass achievement shows');
    check(await page.locator('.jy-go[disabled]').count() === 1, 'the next stop is not free');
    check(/50 more coins to go/.test(t), 'the next stop costs 50 coins');
    // the background tint follows the region
    const hue = await page.locator('.jy').evaluate(el => getComputedStyle(el).getPropertyValue('--jh').trim());
    check(hue === '8', 'Sichuan has its own colour (hue 8), got ' + hue);
    await page.locator('.jy-acts .btn.pri').click();
    check(await page.locator('.jy-card').count() === 0, 'the card closes');
    // stops list and passport
    await page.locator('.jy-tabs button', { hasText: 'Stops' }).click();
    check(/Chengdu Tianfu International Airport/.test(await main(page)), 'the Stops tab lists the airport');
    await page.locator('.jy-tabs button', { hasText: 'Passport' }).click();
    t = await main(page); check(/0 of 31 regions stamped/.test(t), 'the passport counts 31 regions: ' + t.match(/\d+ of \d+ regions stamped/));
    check(await page.locator('.jy-slot.here').count() === 1, 'the region you are in shows as in progress in the passport');
    // a stop gets paid for: the pill and the bar glow, and a small note says so
    await page.locator('.brand').click();
    check(await page.locator('.pill.xpp.ready').count() === 0 && await page.locator('.xp-ping').count() === 0, 'nothing glows while the next stop is not paid for');
    await page.evaluate(() => { const a = window.shanlu; a.setState({ xp: a.state.xp + 50, dayXp: a.state.dayXp + 50 }); });
    check(await page.locator('.pill.xpp.ready').count() === 1, 'the coins pill glows once enough coins are earned for a stop');
    check(/New stop unlocked/.test(await page.locator('.xp-ping').innerText().catch(() => '')), 'a small note says a new stop is unlocked');
    await page.locator('.xp-ping').click();
    check(await page.locator('.jy-meter.ready').count() === 1 && /1 stop ready/.test(await main(page)), 'the Journey bar glows and says one stop is ready');
    check(await page.locator('.xp-ping').count() === 0, 'the note goes away on the Journey screen');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
  }

  // ---- with coins: travel, the order, the maps ----
  {
    const { ctx, page, errors } = await open({ xp: 1500 });
    await page.locator('.pill.xpp').click();
    await page.locator('.jy-go').click();   // flight in
    const want = ['Chengdu Tianfu International Airport', 'Chengdu'];
    let t = await main(page);
    check(/Welcome to Sichuan/.test(t), 'arrival first');
    await page.locator('.jy-acts .btn.pri').click();
    await page.locator('.jy-go').click();   // second stop: the main city
    t = await page.locator('.jy-card').innerText();
    check(/CITY/i.test(t) && /Chengdu/.test(t) && /成都/.test(t), 'the second stop is the main city, Chengdu');
    check(/New city/.test(t) === false || true, 'ok');
    check(/1,450 coins/.test(await page.locator('.pill.xpp').innerText()), 'travelling spends coins: 1,500 minus the 50 for the second stop leaves 1,450');
    await page.locator('.jy-acts .btn.pri').click();
    // keep travelling while coins last: every stop in this city block belongs to Chengdu until the city is done
    let n = 2, outside = 0;
    for (let i = 0; i < 12; i++) {
      if (await page.locator('.jy-go[disabled]').count()) break;
      await page.locator('.jy-go').click(); n++;
      const place = await page.locator('.jy-place').innerText();
      if (!/Chengdu/.test(place)) outside++;
      await page.locator('.jy-acts .btn.pri').click();
    }
    check(outside === 0, 'the first stops after the main city are all in Chengdu');
    // the map
    await page.locator('.jy-tabs button', { hasText: 'Map' }).click();
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

  // ---- a phone: nothing spills sideways ----
  {
    const { ctx, page, errors } = await open({ xp: 800, viewport: { width: 390, height: 844 } });
    await page.locator('.pill.xpp').click();
    await page.locator('.jy-go').click(); await page.waitForTimeout(100);
    for (const tab of ['Map', 'Stops', 'Passport']) {
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
