// Uses it in Chromium through the real page:  node test/e2e.mjs  (needs Playwright)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', e => problems.push(e.message));
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('requestfailed', r => problems.push('failed: ' + r.url()));
page.on('request', r => { if (!r.url().startsWith(base)) problems.push('left the site: ' + r.url()); });

await page.goto(base);
await page.evaluate(() => document.fonts.ready);

const tap = async id => {
  await page.waitForFunction(() => !rowsAndRails.view.busy); // let a zoom finish first
  const [x, y] = await page.evaluate(id => rowsAndRails.where(id), id);
  await page.mouse.click(x, y);
};
const go = async id => { await page.evaluate(id => { location.hash = id; }, id); await page.waitForFunction(id => location.hash === '#' + id, id); };
const text = sel => page.locator(sel).innerText();
// The words on the board that run past the edges of its box.
const offBoard = sel => page.evaluate(sel => {
  const b = document.querySelector('#board').getBoundingClientRect();
  return [...document.querySelectorAll(sel)].filter(t => {
    const r = t.getBoundingClientRect();
    return r.left < b.left || r.right > b.right || r.top < b.top || r.bottom > b.bottom;
  }).map(t => t.textContent);
}, sel);

// First step, and tapping a hole shows what it's joined to.
assert.equal(await text('#title'), 'Meet the breadboard');
assert.equal(await page.evaluate(() => rowsAndRails.view.orient), 'v', 'the board stands up on a phone');
await tap('c12');
assert.match(await text('#info'), /c12 is joined to a12, b12, d12, e12/);
assert.equal(await page.locator('.hl .ring').count(), 5);
await tap('T-8');
assert.match(await text('#info'), /all 25 holes on the right − rail/);
assert.notEqual(await page.evaluate(() => document.activeElement.id), 'board', 'a tap leaves the arrow keys to the steps');

// Every colour used for words reads at 4.5:1 or better, in both palettes: on the panel, the grey on the page
// around the board too, and the words on the orange buttons.
for (const colorScheme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme });
  assert.deepEqual(await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('i'));
    const rgb = name => { probe.style.color = `var(--${name})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number); };
    const lum = c => c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const pairs = [...['ink', 'muted', 'accent', 'good', 'bad', 'warn', 'sda', 'scl', 'plus', 'minus'].map(n => [n, 'panel']), ['muted', 'bg'], ['accent-ink', 'accent']];
    const faint = pairs.filter(([a, b]) => ratio(a, b) < 4.5).map(([a, b]) => `--${a} on --${b}: ${ratio(a, b).toFixed(2)}:1`);
    probe.remove();
    return faint;
  }), [], `words too faint in the ${colorScheme} palette`);
}
await page.emulateMedia({ colorScheme: 'light' });

// Standing up on a phone (a quarter-turn clockwise), the top rails are on the right.
await go('rails');
assert.match(await text('#body'), /The right pair and the left pair aren't joined/);
assert.equal(await page.locator('.note text', { hasText: 'right and left rails are separate' }).count(), 1);
await tap('T-8');
assert.match(await text('#info'), /right − rail/);
await go('meet');

// The building steps zoom in on a phone, and the buttons zoom out to the whole board and back.
await go('loop');
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => rowsAndRails.view.zoomed()), true, 'zoomed in on the circuit');
assert.equal(await page.locator('.leg-tag.plus').count(), 1, 'the LED shows which leg is +');
assert.equal(await page.locator('.leg-tag.minus').count(), 1);
await page.click('#zfit');
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => rowsAndRails.view.zoomed()), false);
assert.equal(await page.locator('#zfit').isHidden(), true);
await page.click('#zin');
assert.equal(await page.evaluate(() => rowsAndRails.view.zoomed()), true);
await go('meet');
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => rowsAndRails.view.zoomed()), false, 'the first step shows the whole board');

// The note in the middle gap shows whole on a phone.
await go('led');
await page.waitForTimeout(500);
assert.deepEqual(await offBoard('.note'), [], 'the note runs off the edge of the board');
// Tapping a hole with an LED leg in it says which leg.
await tap('c12');
assert.match(await text('#info'), /long leg \(\+\)/);
await go('meet');

// See inside.
await page.click('#xray');
assert.equal(await page.locator('#board.xray-on').count(), 1);

// Next walks through the steps; the finished circuit lights, with current flowing.
for (let i = 0; i < 8; i++) await page.click('#next');
assert.equal(await text('#title'), 'Build it: close the loop');
assert.equal(await page.locator('.part-led.led-lit').count(), 1);
assert.equal(await page.locator('.flow-dots').count(), 1);
await page.click('#back');
assert.equal(await page.locator('.part-led.led-off').count(), 1, 'before the last wire it is dark');

// The browser's or phone's Back button steps back through the lesson, and opening it again with no step in the
// address (from the home screen) carries on where you left off.
const titled = (t, why) => page.waitForFunction(t => document.querySelector('#title').textContent === t, t, { timeout: 3000 })
  .catch(async () => assert.equal(await text('#title'), t, why));
await go('rows');
await page.click('#next');
await page.click('#next');
await titled('The power rails');
await page.goBack();
await titled('The gap in the middle', 'Back goes to the step before');
await page.goBack();
await titled('Rows of five', 'and the one before that');
await page.goForward();
await titled('The gap in the middle', 'Forward comes back');
await page.goto(base);
await page.evaluate(() => document.fonts.ready);
assert.equal(await text('#title'), 'The gap in the middle', 'opens at the step you left off on');
assert.equal(new URL(page.url()).hash, '#gap');

// Every mistake leaves the LED dark (or burns it), and every fix lights it.
await go('mistakes');
const tabs = page.locator('.tab');
for (let i = 0; i < await tabs.count(); i++) {
  await tabs.nth(i).click();
  assert.match(await text('.verdict'), /dark|burns out|Short circuit/, 'mistake ' + i);
  await page.click('button:has-text("Show the fix")');
  assert.equal(await text('.verdict'), 'It lights.', 'fix ' + i);
}
// With the keyboard, what you pressed keeps the focus when the panel is drawn again.
const focused = () => page.evaluate(() => document.activeElement.textContent);
await page.locator('.tab').first().focus();
await page.keyboard.press('Enter');
assert.equal(await focused(), 'Backwards LED', 'a tab keeps the focus');
await page.locator('button:has-text("Show the fix")').focus();
await page.keyboard.press('Enter');
assert.equal(await focused(), 'Show the mistake again', 'so does the button under it');
await page.locator('.tab').first().focus();
await page.keyboard.press('ArrowRight');
assert.equal(await text('#title'), 'Why won’t it light?', 'an arrow key on a tab stays on the step');
assert.equal(await focused(), 'Both legs in one row', 'and moves to the next tab');
assert.equal(await page.locator('.tab[aria-selected="true"]').innerText(), 'Both legs in one row');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('ArrowLeft');
assert.equal(await focused(), 'Short circuit', 'all the way round');
await page.locator('#dots button').nth(2).focus();
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-current')), 'step', 'and a step dot');

// The quiz: one right answer, one wrong one.
await go('quiz');
const target = await page.evaluate(() => rowsAndRails.state.quiz.target);
const partner = await page.evaluate(async t => {
  const { netHoles, netOf, hole } = await import('./js/board.js');
  const T = hole(t); // the nearest one, so it's on screen when the board is zoomed in
  return netHoles(netOf(t)).filter(h => h.id !== t).sort((p, q) => Math.hypot(p.x - T.x, p.y - T.y) - Math.hypot(q.x - T.x, q.y - T.y))[0].id;
}, target);
await tap(target);
assert.match(await text('#info'), /glowing hole itself/);
assert.equal(await page.evaluate(() => rowsAndRails.state.quiz.answer), null, 'tapping the glowing hole itself doesn’t use up the round');
await tap(partner);
assert.equal(await text('.verdict'), 'Yes, connected.');
await page.click('button:has-text("Next round")');
const stranger = () => page.evaluate(async () => {
  const { HOLES, netOf, hole } = await import('./js/board.js');
  const t = rowsAndRails.state.quiz.target, T = hole(t);
  return HOLES.filter(h => netOf(h.id) !== netOf(t)).sort((p, q) => Math.hypot(p.x - T.x, p.y - T.y) - Math.hypot(q.x - T.x, q.y - T.y))[0].id;
});
await tap(await stranger());
assert.equal(await text('.verdict'), 'Not connected.');
for (let i = 0; i < 4; i++) { await page.click('#extra .btn'); await tap(await stranger()); }
await page.click('button:has-text("See your score")');
assert.match(await text('.verdict'), /^1 of 6 right/);

// Build your own: place an LED, a resistor and a wire by tapping holes.
await go('build');
await page.click('[data-tool="led"]');
await tap('c12'); await tap('c13');
assert.match(await text('.verdict'), /loop isn’t closed/);
await page.click('[data-tool="wire"]');
await tap('a13'); await tap('T-14');
assert.match(await text('.verdict'), /loop isn’t closed/);
await tap('T+12'); await tap('a12');
assert.match(await text('.verdict'), /burn out/);
await page.click('[data-tool="remove"]');
await tap('a12');
await page.click('[data-tool="resistor"]');
await tap('T+12'); await tap('a12');
await page.click('[data-tool="wire"]');
assert.equal(await text('.verdict'), 'It lights. Current runs from + through your parts and back to −.');
await tap('b13'); await tap('T+15');
assert.match(await text('.verdict'), /^Short circuit/, 'a wire from row 13 to + joins + to −');
await page.click('[data-tool="remove"]');
await tap('b13');
// It's still there after a reload.
await page.reload();
await page.evaluate(() => document.fonts.ready);
assert.equal(await text('#title'), 'Build your own');
assert.equal(await page.locator('.part-led.led-lit').count(), 1, 'the build is saved');
// Turn it around.
await page.click('[data-tool="remove"]'); await tap('c12');
await page.click('[data-tool="led"]'); await tap('c13'); await tap('c12');
await page.click('button:has-text("Turn it around")');
assert.equal(await page.locator('.part-led.led-lit').count(), 1);

// The board works from the keyboard too. Tab reaches it, the arrow keys move a ring from hole to hole, the line
// above the board names each one (a screen reader reads it out), and Enter or Space taps it.
// Chromium lets Tab reach an SVG that has focus listeners even without a tabindex, but Safari and Firefox don't,
// so check the board asks for it.
assert.equal(await page.getAttribute('#board', 'tabindex'), '0', 'the board can take the keyboard in every browser');
const focusBoard = async () => {
  await page.focus('#xray');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'board', 'Tab reaches the board');
};
await go('quiz');
await focusBoard();
const glowing = await page.evaluate(() => rowsAndRails.state.quiz.target);
assert.equal(await text('#info'), `${glowing}. It’s the glowing hole.`, 'the ring starts on the glowing hole');
assert.equal(await page.locator('.bb-cursor circle').count(), 2, 'and shows');
// Standing up, a to e run right to left on the screen: one hole toward the middle gap is on the same clip.
await page.keyboard.press('abcd'.includes(glowing[0]) ? 'ArrowLeft' : 'ArrowRight');
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => rowsAndRails.state.quiz.right), true, 'Enter answers with the hole under the ring');
assert.match(await text('#info'), /^Yes, connected\. Both are on row \d+/, 'and the line above the board says so');
await go('rows');
await focusBoard();
const from = await page.evaluate(() => rowsAndRails.state.cursor);
await page.keyboard.press('ArrowDown');
const down = await page.evaluate(async from => (await import('./js/board.js')).holeToward(from, 1, 0), from);
assert.equal(await text('#info'), `${down}.`, 'down the upright board is along the rows');
await page.keyboard.press(' ');
assert.match(await text('#info'), new RegExp(`^${down} is joined to`), 'Space taps it');
await go('build');
await page.click('button:has-text("Clear the board")');
await page.focus('[data-tool="led"]');
await page.keyboard.press('Enter');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
assert.equal(await page.evaluate(() => document.activeElement.id), 'board', 'the board comes after the parts');
await page.keyboard.press('Enter');
await page.keyboard.press('ArrowDown');
await page.keyboard.press(' ');
assert.equal(await page.locator('.part-led').count(), 1, 'an LED placed from the keyboard');
await page.keyboard.press('Tab');
assert.equal(await page.locator('.bb-cursor circle').count(), 0, 'the ring goes when the keyboard leaves the board');

// ----- Level 2: the XIAO and the sensor -----
await go('build');
assert.equal(await text('#next'), 'Level 2', 'the last step of level 1 leads on to level 2');
await page.click('#next');
assert.match(await text('#kicker'), /Level 2 · Step 1 of 8/i);
assert.equal(await page.locator('.levels button[data-level="2"][aria-pressed="true"]').count(), 1);
assert.equal(await page.locator('.part-xiao').count(), 1);
await tap('d4');
assert.match(await text('#info'), /XIAO’s 3V3 pin/);

await go('xled');
assert.equal(await page.locator('.part-led.led-lit').count(), 1, 'D10 HIGH lights the LED');
await page.click('button:has-text("Set D10 LOW")');
assert.equal(await page.locator('.part-led.led-off').count(), 1);
assert.equal(await page.locator('.bus-dots').count(), 2, 'messages on SDA and SCL');

await go('run');
assert.match(await text('#extra .verdict'), /LED is off/);
await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '30'; s.dispatchEvent(new Event('input')); });
assert.equal(await page.locator('.part-led.led-lit').count(), 1, 'warm enough to switch the LED on');
await page.waitForTimeout(1200);
assert.match(await text('#serial'), /Temperature: 30\.\d C/);

await go('xmistakes');
const tabs2 = page.locator('.tab');
for (let i = 0; i < await tabs2.count(); i++) {
  await tabs2.nth(i).click();
  const said = (await page.locator('#extra .verdict').allInnerTexts()).join(' ');
  assert.match(said, /doesn’t answer|stays dark|burns out|on 5 V/, 'level 2 mistake ' + i);
  await page.click('button:has-text("Show the fix")');
  assert.deepEqual(await page.locator('#extra .verdict').allInnerTexts(), ['The sensor answers.', 'D10 lights the LED.'], 'level 2 fix ' + i);
}

// Wire it yourself, one tap at a time.
await go('challenge');
assert.equal(await page.locator('.checklist li.ok').count(), 1, 'only "no short circuits" to begin with');
await page.click('[data-tool="wire"]');
for (const [a, b] of [['a4', 'T+4'], ['a3', 'T-3'], ['f17', 'T+17'], ['f18', 'T-18'], ['g19', 'i6'], ['f20', 'j7']]) { await tap(a); await tap(b); }
assert.match(await text('.checklist'), /SDA and SCL are swapped/);
await page.click('[data-tool="remove"]');
await tap('i6'); await tap('j7');
await page.click('[data-tool="wire"]');
await tap('g19'); await tap('j7'); await tap('f20'); await tap('i6');
assert.equal(await page.locator('.checklist li.ok').count(), 5, 'the sensor is wired');
await tap('e5');
assert.equal(await text('#info'), 'e5 is under the XIAO. Pick a free hole.', 'a hole under the XIAO is taken');
await page.click('[data-tool="resistor"]'); await tap('b5'); await tap('b10');
await page.click('[data-tool="led"]'); await tap('d10'); await tap('d11');
await page.click('[data-tool="wire"]'); await tap('a11'); await tap('T-12');
assert.equal(await page.locator('.checklist li.ok').count(), 6);
assert.match(await text('#extra'), /All wired/);
await page.reload();
await page.evaluate(() => document.fonts.ready);
assert.match(await text('#extra'), /All wired/, 'the challenge is saved');
// An LED fed from the + rail instead of D10 lights, and the list says so.
await page.click('button:has-text("Start again")');
await page.click('[data-tool="wire"]'); await tap('a4'); await tap('T+4'); await tap('a3'); await tap('T-3');
await page.click('[data-tool="resistor"]'); await tap('T+10'); await tap('a10');
await page.click('[data-tool="led"]'); await tap('c10'); await tap('c11');
await page.click('[data-tool="wire"]'); await tap('a11'); await tap('T-12');
assert.equal(await page.locator('.part-led.led-lit').count(), 1);
assert.match(await text('.checklist'), /It lights, but from 3V3/);

// ----- Level 3: a screen on the same two wires -----
await go('challenge');
assert.equal(await text('#next'), 'Level 3');
await page.click('#next');
assert.match(await text('#kicker'), /Level 3 · Step 1 of 5/i);
assert.equal(await page.locator('.part-oled').count(), 1);
await go('bus');
await page.waitForTimeout(300);
assert.deepEqual(await page.locator('.note.address text').allTextContents(), ['0x76', '0x3C'], 'each device has its address');
await go('show');
const before = await page.getAttribute('#oled', 'src');
assert.match(before, /^data:image\/png/);
await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '31'; s.dispatchEvent(new Event('input')); });
assert.notEqual(await page.getAttribute('#oled', 'src'), before, 'the screen shows the new reading');
assert.equal(await page.locator('.part-led.led-lit').count(), 1);
assert.match(await page.getAttribute('.oled-pixels', 'href'), /^data:image\/png/, 'and so does the screen on the board');
await page.click('button:has-text("Breathe on it")');
await page.waitForFunction(() => rowsAndRails.state.hum > 45);
await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '24'; s.dispatchEvent(new Event('input')); });
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => rowsAndRails.state.hum), 45, 'taking the slider mid-breath ends the damp air too');

await go('blank');
const tabs3 = page.locator('.tab');
for (let i = 0; i < await tabs3.count(); i++) {
  await tabs3.nth(i).click();
  assert.match((await page.locator('#extra .verdict').allInnerTexts())[0], /dark/, 'level 3 mistake ' + i);
  assert.equal(await page.locator('.oled-pixels[href]').count(), 0, 'nothing on the screen ' + i);
  await page.click('button:has-text("Show the fix")');
  assert.deepEqual(await page.locator('#extra .verdict').allInnerTexts(), ['The screen shows the reading.'], 'level 3 fix ' + i);
}

await go('final');
await page.click('[data-tool="wire"]');
await tap('a4');
await go('blank'); await go('final');
assert.equal(await page.locator('.mark-pending').count(), 0, 'a half-placed wire doesn’t outlast leaving the step');
for (const [a, b] of [['a4', 'T+4'], ['a3', 'T-3'], ['f17', 'T+17'], ['f18', 'T-18'], ['g19', 'j7'], ['f20', 'i6'], ['e22', 'f19'], ['e23', 'g20']]) { await tap(a); await tap(b); }
await page.click('[data-tool="resistor"]'); await tap('b5'); await tap('b10');
await page.click('[data-tool="led"]'); await tap('d10'); await tap('d11');
await page.click('[data-tool="wire"]'); await tap('a11'); await tap('T-12');
assert.equal(await page.locator('.checklist li.ok').count(), 10);
assert.match(await text('#extra'), /weather station/);
await tap('T-20');
assert.match(await text('#info'), /screen’s GND lead/, 'the screen’s lead is in that hole');

// ----- Level 4: Wi-Fi -----
await go('final');
assert.equal(await text('#next'), 'Level 4');
await page.click('#next');
assert.match(await text('#kicker'), /Level 4 · Step 1 of 6/i);
assert.equal(await page.locator('.part-antenna').count(), 1);
await page.click('#next');
assert.equal(await text('#title'), 'Join your Wi-Fi');
assert.equal(await page.locator('.wave').count(), 0, 'no radio waves before joining');
assert.equal(await page.locator('.part-led.led-lit').count(), 0, 'the LED stays dark while the XIAO is off');
await page.click('button:has-text("Connect")');
assert.match(await text('#extra .verdict'), /Joining/);
assert.equal(await page.locator('.part-led.led-lit').count(), 0, 'and while it joins: the sketch hasn’t set D10 yet');
await page.waitForFunction(() => document.querySelector('#extra .verdict')?.textContent.includes('192.168.1.42'), null, { timeout: 4000 });
assert.equal(await page.locator('.wave').count(), 3, 'radio waves once it’s on Wi-Fi');
assert.equal(await page.locator('.part-led.led-lit').count(), 1, 'and the sketch is running');

await go('page');
assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.route rect.d-box')].flatMap(r => {
  const b = r.getBBox();
  return [...r.parentNode.querySelectorAll('text')].filter(t => { const tb = t.getBBox(); return tb.x < b.x + 1 || tb.x + tb.width > b.x + b.width - 1; }).map(t => t.textContent);
})), [], 'words spill out of their boxes in the route diagram');
await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '22'; s.dispatchEvent(new Event('input')); });
assert.equal(await text('#pp-t'), '22.0 °C', 'the phone shows the reading');
await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '24.5'; s.dispatchEvent(new Event('input')); });
assert.equal(await text('#pp-t'), '24.5 °C', 'and follows it');

await go('ping');
assert.match(await text('#alerts'), /No alerts yet/);
await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '27'; s.dispatchEvent(new Event('input')); });
assert.match(await text('#alerts'), /Weather station[\s\S]*It's 27\.0 C/, 'one buzz when it passes 26');
await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '27.5'; s.dispatchEvent(new Event('input')); });
assert.equal(await page.locator('#alerts .note-card').count(), 1, 'no second buzz while it stays warm');
await page.evaluate(() => { const s = document.querySelector('#temp'); for (const v of ['24', '27.2']) { s.value = v; s.dispatchEvent(new Event('input')); } });
assert.equal(await page.locator('#alerts .note-card').count(), 2, 'it cooled off, so it can buzz again');

await go('nowifi');
const tabs4 = page.locator('.tab');
const stuck = await page.evaluate(async () => (await import('./js/lessons.js')).TROUBLE.map(t => t.wifi === 'joining'));
for (let i = 0; i < await tabs4.count(); i++) {
  await tabs4.nth(i).click();
  assert.equal(await page.locator('#extra .verdict.bad').count(), 1, 'symptom ' + i);
  assert.equal(await page.locator('.part-led.led-lit').count(), stuck[i] ? 0 : 1, 'the LED is dark while it’s stuck joining ' + i);
  await page.click('button:has-text("Show the fix")');
  assert.equal(await page.locator('#pp-t').count(), 1, 'the page opens after the fix ' + i);
  assert.equal(await page.locator('.part-led.led-lit').count(), 1, 'and the sketch runs ' + i);
}


// ----- Level 5: the soil sensor -----
await go('nowifi');
assert.equal(await text('#next'), 'Level 5');
await page.click('#next');
assert.match(await text('#kicker'), /Level 5 · Step 1 of 6/i);
assert.equal(await page.locator('.part-soil').count(), 1);
// On the upright board the blade runs off the edge of the view, but its labels stay in sight.
await page.waitForFunction(() => !rowsAndRails.view.busy);
assert.deepEqual(await offBoard('.soil-note'), [], 'the soil sensor’s labels run off the edge of the board');
// The diagram of the sensor: no two labels on the same line run into each other.
assert.deepEqual(await page.evaluate(() => {
  const ts = [...document.querySelectorAll('#body svg.art text')].map(t => ({ t, b: t.getBBox() }));
  return ts.flatMap((p, i) => ts.slice(i + 1).filter(q => q.t.getAttribute('y') === p.t.getAttribute('y') && p.b.x < q.b.x + q.b.width && q.b.x < p.b.x + p.b.width)
    .map(q => `${p.t.textContent} / ${q.t.textContent}`));
}), [], 'labels print on top of each other');
// In the dark palette the black sensor in the drawings keeps an edge you can see.
await page.emulateMedia({ colorScheme: 'dark' });
const edge = await page.evaluate(() => {
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const rgb = s => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const stroke = getComputedStyle(document.querySelector('#body .art .a-pcb')).stroke;
  if (!stroke.startsWith('rgb')) return 0;
  const [a, b] = [lum(rgb(stroke)), lum(rgb(getComputedStyle(document.querySelector('.panel')).backgroundColor))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
});
await page.emulateMedia({ colorScheme: 'light' });
assert.ok(edge >= 3, `the soil sensor's edge is only ${edge.toFixed(2)}:1 on the dark panel`);
await go('soil-aout');
await page.waitForTimeout(400);
assert.equal(await page.locator('.signal-dots').count(), 1, 'the voltage travels down AOUT');
await tap('j3');
assert.match(await text('#info'), /soil sensor’s AOUT lead/);
await tap('h3');
assert.match(await text('#info'), /XIAO’s D1 pin \(A1\)/);

await go('soil-cal');
for (let i = 0; i < 3; i++) { // the reading changes every second; the button saves the one you see
  await page.waitForTimeout(1100);
  const [shown, saved] = await page.evaluate(() => { // in one go, so a new reading can't come in between
    const shown = document.querySelector('#cal-mv').textContent;
    [...document.querySelectorAll('#extra button')].find(b => b.textContent === 'Use this as DRY').click();
    return [shown, /int DRY = (\d+)/.exec(document.querySelector('#extra pre').textContent)[1] + ' mV'];
  });
  assert.equal(saved, shown, 'DRY is the reading on screen');
}
await page.click('button:has-text("Dip it in water")');
await page.click('button:has-text("Use this as WET")');
assert.match(await text('#extra pre'), /int DRY = 23\d\d;[\s\S]*int WET = 11\d\d;/, 'your numbers go into the code');
assert.match(await text('#extra'), /Calibrated/);

await go('soil-run');
await page.click('button:has-text("Let a few days pass")');
await page.waitForTimeout(900);
await page.click('button:has-text("Let a few days pass")');
await page.waitForTimeout(900);
await page.click('button:has-text("Let a few days pass")');
await page.waitForTimeout(900);
assert.match(await text('#soil-say'), /below 30%/, 'dry enough to ask for water');
assert.equal(await page.locator('.part-led.led-lit').count(), 1, 'and the LED is on');
await page.click('button:has-text("Water it")');
await page.waitForFunction(() => [...document.querySelectorAll('#drops circle')].some(c => +getComputedStyle(c).opacity > 0.5), null, { timeout: 3000 })
  .catch(() => assert.fail('no water drops fall'));
await page.waitForTimeout(1200);
assert.match(await text('#soil-say'), /the LED is off/);
assert.match(await text('#serial'), /\d+ mV {2}-> {2}\d+% wet/);

await go('soil-wrong');
const tabs5 = page.locator('.tab');
for (let i = 0; i < await tabs5.count(); i++) {
  await tabs5.nth(i).click();
  assert.equal(await page.locator('#extra .verdict.bad').count(), 1, 'soil symptom ' + i);
  await page.click('button:has-text("Show the fix")');
  assert.equal(await text('#extra .verdict'), 'Steady, believable readings.', 'soil fix ' + i);
}
await page.click('.tab >> nth=0');
assert.match(await text('#extra pre'), /0 mV {2}-> {2}100% wet/, 'no power reads as soaking wet');
await go('build');

// Fits a phone: nothing scrolls sideways or runs off the edge on any step, even with the code open.
const ids = await page.evaluate(async () => (await import('./js/lessons.js')).STEPS.map(s => s.id));
for (const id of ids) {
  await go(id);
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('.panel, #next, #zin')].map(e => e.getBoundingClientRect().right)) - innerWidth);
  assert.ok(over <= 0.5, `${id} is ${Math.round(over)}px wider than the phone`);
}
await go('build');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// Installable.
const cdp = await ctx.newCDPSession(page);
assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors, []);

// A phone on its side puts the board beside the panel, with holes big enough to tap and room to read.
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(400);
assert.ok(await page.evaluate(() => rowsAndRails.view.fullPitch()) >= 8, 'holes too small with the phone on its side');
assert.ok(await page.evaluate(() => document.querySelector('.panel-scroll').getBoundingClientRect().height) >= 200, 'no room to read with the phone on its side');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
// A short window too narrow for both side by side (a phone's half of a split screen) keeps the board across the top.
await page.setViewportSize({ width: 412, height: 360 });
await page.waitForTimeout(400);
assert.ok(await page.evaluate(() => document.querySelector('.board-wrap').getBoundingClientRect().width) > 300, 'the board is squeezed to a sliver in a short, narrow window');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

// Wide screens lay the board on its side.
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForFunction(() => rowsAndRails.view.orient === 'h');
await go('rails');
assert.match(await text('#body'), /The top pair and the bottom pair aren't joined/);
await go('build');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload();
assert.equal(await text('#title'), 'Build your own', 'did not load offline');
await ctx.setOffline(false);

assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');

// The one-file copy for the Artifact viewer (node tools/build.mjs) opens and works, with nothing loaded from elsewhere.
execSync('node tools/build.mjs', { cwd: root, stdio: 'ignore' });
const actx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
const art = await actx.newPage();
const artProblems = [];
art.on('pageerror', e => artProblems.push(e.message));
art.on('console', m => { if (m.type() === 'error') artProblems.push(m.text()); });
art.on('request', r => { if (!r.url().startsWith('data:') && !/dist\/artifact\.html|favicon\.ico/.test(r.url())) artProblems.push('asked for ' + r.url()); });
await art.goto(base + 'dist/artifact.html');
await art.waitForFunction(() => document.querySelector('#title')?.textContent, null, { timeout: 5000 }).catch(() => {});
assert.equal(await art.locator('#title').innerText(), 'Meet the breadboard', 'the Artifact copy opens');
assert.equal(await art.locator('#board .hole').count(), 400, 'and draws the board');
await art.evaluate(() => { location.hash = 'station'; });
await art.waitForFunction(() => document.querySelector('#title').textContent === 'The whole sketch');
assert.match(await art.locator('details.code code').textContent(), /<\/script>\)page";/, 'the sketch keeps its web page whole');
assert.deepEqual(artProblems, [], 'problems in the Artifact copy');
await actx.close();

await browser.close();
server.close();
console.log('all good');
