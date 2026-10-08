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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
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
  const [x, y] = await page.evaluate(id => rowsAndRails.where(id), id);
  await page.mouse.click(x, y);
};
const go = async id => { await page.evaluate(id => { location.hash = id; }, id); await page.waitForFunction(id => location.hash === '#' + id, id); };
const text = sel => page.locator(sel).innerText();

// First step, and tapping a hole shows what it's joined to.
assert.equal(await text('#title'), 'Meet the breadboard');
assert.equal(await page.evaluate(() => rowsAndRails.view.orient), 'v', 'the board stands up on a phone');
await tap('c12');
assert.match(await text('#info'), /c12 is joined to a12, b12, d12, e12/);
assert.equal(await page.locator('.hl .ring').count(), 5);
await tap('T-8');
assert.match(await text('#info'), /all 25 holes on the top − rail/);

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

// Every mistake leaves the LED dark (or burns it), and every fix lights it.
await go('mistakes');
const tabs = page.locator('.tab');
for (let i = 0; i < await tabs.count(); i++) {
  await tabs.nth(i).click();
  assert.match(await text('.verdict'), /dark|burns out|Short circuit/, 'mistake ' + i);
  await page.click('button:has-text("Show the fix")');
  assert.equal(await text('.verdict'), 'It lights.', 'fix ' + i);
}

// The quiz: one right answer, one wrong one.
await go('quiz');
const target = await page.evaluate(() => rowsAndRails.state.quiz.target);
const partner = await page.evaluate(async t => {
  const { netHoles, netOf } = await import('./js/board.js');
  return netHoles(netOf(t)).find(h => h.id !== t).id;
}, target);
await tap(partner);
assert.equal(await text('.verdict'), 'Yes, connected.');
await page.click('button:has-text("Next round")');
const t2 = await page.evaluate(() => rowsAndRails.state.quiz.target);
const stranger = await page.evaluate(async t => {
  const { HOLES, netOf } = await import('./js/board.js');
  return HOLES.find(h => netOf(h.id) !== netOf(t)).id;
}, t2);
await tap(stranger);
assert.equal(await text('.verdict'), 'Not connected.');
for (let i = 0; i < 4; i++) { await page.click('#extra .btn'); await tap(await page.evaluate(() => rowsAndRails.state.quiz.target)); }
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

// Fits a phone: nothing scrolls sideways.
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// Installable.
const cdp = await ctx.newCDPSession(page);
assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors, []);

// Wide screens lay the board on its side.
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForFunction(() => rowsAndRails.view.orient === 'h');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload();
assert.equal(await text('#title'), 'Build your own', 'did not load offline');
await ctx.setOffline(false);

assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');
await browser.close();
server.close();
console.log('all good');
