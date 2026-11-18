#!/usr/bin/env node
/* The site starts light, whatever the device's dark setting; dark only when chosen with the switch.
 * Until 17 Nov a dark device's setting was saved as if chosen: that saved dark goes back to light once; a dark chosen since is kept.
 * Run: node tools/smoke-test-theme.js (needs playwright) */
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = require('./test-static').server(root);
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const site = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const dark = () => document.querySelector('.app').classList.contains('t-dark');
  // 1. a new visitor on a dark device
  let ctx = await browser.newContext({ colorScheme: 'dark' });
  let page = await ctx.newPage();
  await page.goto(site); await page.waitForSelector('.app');
  check(!(await page.evaluate(dark)), 'a new visitor on a dark device starts with the light theme');
  // 2. an old save with the device's dark in it, never chosen
  await page.evaluate(() => { const k = 'shanlu-progress-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.theme = 'dark'; localStorage.setItem(k, JSON.stringify(s)); Object.keys(localStorage).filter((x) => x.indexOf('shanlu-theme-v2') === 0).forEach((x) => localStorage.removeItem(x)); });
  await page.reload(); await page.waitForSelector('.app');
  check(!(await page.evaluate(dark)), 'a dark theme that only came from the device goes back to light once');
  // 3. dark chosen with the switch stays dark after a reload
  await page.evaluate(() => window.shanlu.toggleTheme()); await page.waitForTimeout(400);
  check(await page.evaluate(dark), 'the switch turns dark on');
  await page.reload(); await page.waitForSelector('.app');
  check(await page.evaluate(dark), 'a dark theme chosen with the switch is kept after a reload');
  await page.evaluate(() => { const k = 'shanlu-progress-v1'; Object.keys(localStorage).filter((x) => x.indexOf('shanlu-theme-v2') === 0).forEach((x) => localStorage.removeItem(x)); });
  await page.reload(); await page.waitForSelector('.app');
  check(await page.evaluate(dark), '...and is not undone by the one-time switch back (it is marked as chosen)');
  await ctx.close();
  await browser.close(); server.close();
  console.log(fails ? fails + ' theme check(s) failed' : 'theme tests passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
