// Click-through navigation for the browser tests, using the real tabs: five tabs (Today, Learn, Review, Talk, Journey), the pages of a tab under it
// (the sidebar on a wide window, a strip under the header on a phone), the Library tiles, and the quiet "You" links.
// nav('Archive') and the other old page names still work: each one is turned into the clicks a person would make.
const TAB = { Home: 'Today', Today: 'Today', Path: 'Learn', Library: 'Learn', Archive: 'Learn', Grammar: 'Learn', Pinyin: 'Learn', 'My words': 'Learn', 'Level exam': 'Learn', 'Review words': 'Review', 'Grammar review': 'Review', Tests: 'Review', 'Listening lab': 'Talk', Speak: 'Talk', Journey: 'Journey' };
const SUB = { Path: 'Path', Library: 'Library', Archive: 'Library', Grammar: 'Library', Pinyin: 'Library', 'My words': 'Library', 'Level exam': 'Path', 'Review words': 'Words', 'Grammar review': 'Grammar', Tests: 'Test', 'Listening lab': 'Listening', Speak: 'Speaking' };
const TILE = { Archive: 'Topics', Grammar: 'Grammar lessons', Pinyin: 'Pinyin and tones', 'My words': 'Words' };
const ACCT_ROW = { Friends: 'Friends', Settings: 'Settings and sync', Achievements: 'Achievements', 'How Shanlu works': 'How Shanlu works' };   // on a phone: from the Account page
const YOU = { Friends: 'Friends', Settings: 'Settings', Achievements: 'Achievements', 'How Shanlu works': 'How Shanlu works' };   // on a wide window: the "You" links in the sidebar
exports.makeNav = (page) => async (label) => {
  const wide = page.viewportSize().width > 900;
  if (ACCT_ROW[label]) {
    if (wide) await page.locator('.navyou .ylink', { hasText: YOU[label] }).first().click();
    else { await page.locator('.acct-mini').click(); await page.waitForTimeout(80); await page.locator('.acct-row', { hasText: ACCT_ROW[label] }).first().click(); }
    await page.waitForTimeout(120); return;
  }
  const tab = TAB[label] || label;
  await page.locator('.navg button.nav', { hasText: new RegExp('^\\s*' + tab) }).first().click();
  const sub = SUB[label];
  if (sub) {
    await page.waitForTimeout(60);
    await page.locator(wide ? '.navsub .subl' : '.subnav button', { hasText: new RegExp('^\\s*' + sub + '\\s*\\d*\\s*$') }).first().click();
  }
  if (TILE[label]) { await page.waitForTimeout(60); await page.locator('.lib-tile', { hasText: TILE[label] }).first().click(); }
  if (label === 'Level exam') { await page.waitForTimeout(60); await page.locator('.summit .btn, .summit .linkbtn').first().click(); }
  await page.waitForTimeout(120);
};
