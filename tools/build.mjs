// Builds one self-contained file for the playable Artifact copy:  node tools/build.mjs  ->  dist/artifact.html
// The site itself needs no build; this only bundles it.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFile(join(root, f), 'utf8');
const b64 = async f => (await readFile(join(root, f))).toString('base64');

let css = (await read('css/app.css')).replace('height: 100dvh', 'height: 100%'); // the viewer pads the page for the phone's bars
for (const f of ['figtree', 'plex-mono-500']) css = css.replace(`url(../fonts/${f}.woff2)`, `url(data:font/woff2;base64,${await b64(`fonts/${f}.woff2`)})`);

// The modules in dependency order, with their imports and exports taken off so they share one scope.
let js = '';
for (const f of ['board', 'circuit', 'render', 'lessons', 'app']) {
  js += `// ---- ${f}.js\n` + (await read(`js/${f}.js`))
    .replace(/^import [^;]+;\n/gm, '')
    .replace(/^export (const|function|class)/gm, '$1');
}
js = js.replace(/\nif \('serviceWorker' in navigator[^\n]*\n/, '\n');

const html = await read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace('<script type="module" src="js/app.js"></script>', '')
  .replace('src="icon.svg"', `src="data:image/svg+xml;base64,${await b64('icon.svg')}"`);

const out = `<title>Rows and Rails</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>${css}</style>
${body.trim()}
<script type="module">${js}</script>
`;
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/artifact.html'), out);
console.log(`dist/artifact.html, ${Math.round(out.length / 1024)} KB`);
