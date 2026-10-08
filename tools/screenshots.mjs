// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
await mkdir(join(root, 'docs'), { recursive: true });

async function open(viewport, deviceScaleFactor, hash, colorScheme = 'light') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true, serviceWorkers: 'block', colorScheme, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(base + '#' + hash);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200); // let the parts settle
  return page;
}
const tap = async (page, id) => { const [x, y] = await page.evaluate(id => rowsAndRails.where(id), id); await page.mouse.click(x, y); await page.waitForTimeout(700); };

// Phone screenshots for the README.
for (const [name, hash, act] of [
  ['inside', 'rows', async p => { await p.click('#xray'); await tap(p, 'c17'); }],
  ['loop', 'loop'],
  ['xiao', 'xled'],
  ['wifi', 'ping', async p => { await p.evaluate(() => { const s = document.querySelector('#temp'); s.value = '27.1'; s.dispatchEvent(new Event('input')); }); }],
  ['screen', 'show', async p => { await p.evaluate(() => { const s = document.querySelector('#temp'); s.value = '27.4'; s.dispatchEvent(new Event('input')); }); }],
]) {
  const page = await open({ width: 390, height: 844 }, 2, hash);
  if (act) { await act(page); await page.waitForTimeout(900); }
  await page.screenshot({ path: join(root, `docs/phone-${name}.png`) });
  await page.context().close();
}

// Link preview, 1200 x 630: the name on the left, the lit-up board from the app on the right.
{
  const page = await open({ width: 1500, height: 1100 }, 2, 'show');
  await page.evaluate(() => { const s = document.querySelector('#temp'); s.value = '27.4'; s.dispatchEvent(new Event('input')); });
  await page.addStyleTag({ content: '.zoom { display: none !important; }' });
  await page.waitForTimeout(600);
  const box = await page.evaluate(() => { const r = document.querySelector('#board').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const shot = await page.screenshot({ clip: box, omitBackground: true });
  await page.context().close();
  const font = (await readFile(join(root, 'fonts/figtree.woff2'))).toString('base64');
  const card = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  await card.setContent(`<style>
    @font-face { font-family: F; src: url(data:font/woff2;base64,${font}); font-weight: 400 700; }
    body { margin: 0; width: 1200px; height: 630px; background: #1f3a3a; font-family: F; color: #f6f4ee; overflow: hidden; position: relative; }
    .t { position: absolute; left: 70px; top: 190px; width: 420px; }
    h1 { font-size: 78px; line-height: .98; margin: 0 0 26px; font-weight: 700; letter-spacing: -.01em; }
    p { font-size: 31px; line-height: 1.3; margin: 0; color: #c9d8d4; }
    img { position: absolute; left: 500px; top: 50%; transform: translateY(-50%) rotate(-3deg); width: 690px; filter: drop-shadow(0 18px 30px rgba(0,0,0,.45)); }
  </style><div class="t"><h1>Rows and Rails</h1><p>How a breadboard works, from a first LED to a XIAO weather station.</p></div><img src="data:image/png;base64,${shot.toString('base64')}">`);
  await card.evaluate(() => document.fonts.ready);
  await card.waitForTimeout(200);
  await card.screenshot({ path: join(root, 'og.png') });
}

await browser.close();
server.close();

// A 256-colour palette makes the PNGs about a third the size (needs Python with Pillow; skipped without it).
try {
  execSync(`python3 -c "from PIL import Image; import sys; [Image.open(f).convert('RGB').quantize(256, dither=0).save(f, optimize=True) for f in sys.argv[1:]]" og.png docs/phone-*.png`, { cwd: root, shell: '/bin/bash' });
} catch { console.log('(PNGs left full size: no Pillow)'); }
console.log('screenshots written');
