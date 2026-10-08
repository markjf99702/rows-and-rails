import { HOLES, hole, netOf, netHoles, describeNet, describeHole, cap, setSides, sided, partHoles, whatsIn, EXTENT } from './board.js';
import { sensorStatus, screenStatus, analyze } from './circuit.js';
import { BoardView, WIRE_CYCLE } from './render.js';
import { STEPS, MISTAKES, LED_CIRCUIT, MISTAKES2, XIAO_CIRCUIT, xiao, bme, HOT, MISTAKES3, SCREEN_CIRCUIT, oled, EXTENT3, TROUBLE, antenna, IP } from './lessons.js';

const $ = s => document.querySelector(s);
const svg = $('#board');
const view = new BoardView(svg);
const KEY = 'rows-and-rails.v1';
const KEY2 = 'rows-and-rails.xiao.v1';
const KEY3 = 'rows-and-rails.screen.v1';

const state = {
  step: 0,
  xray: null,      // the reader's own choice for this step, or null for the step's default
  inspect: null,   // hole id tapped in look mode
  tab: 0, fixed: false,
  quiz: null,
  sb: { parts: load(), tool: 'look', pending: null },
  ch: { parts: loadCh(KEY2, [xiao, bme]), tool: 'look', pending: null },
  ch3: { parts: loadCh(KEY3, [xiao, bme, oled]), tool: 'look', pending: null },
  hum: 45,        // and the humidity, in level 3
  wifi: 'on',     // level 4: 'off', 'joining' or 'on'
  alerts: [],     // level 4: pushes that reached the phone, newest first
  warned: false,  // the sketch's own flag: one buzz per warm spell
  high: true,     // D10, in the "LED on a pin" step
  temp: 22,       // what the sensor reads in "Run the code"
  serial: [],
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved?.parts)) return [{ type: 'battery' }, ...saved.parts.filter(p => p.type !== 'battery' && validParts(p))];
  } catch {}
  return [{ type: 'battery' }];
}
function loadCh(key, fixed) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved?.parts)) return [...fixed, ...saved.parts.filter(validParts)];
  } catch {}
  return [...fixed];
}
function validParts(p) {
  try { hole(p.a); hole(p.b); return ['wire', 'resistor', 'led'].includes(p.type); } catch { return false; }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ parts: state.sb.parts.filter(p => p.type !== 'battery') }));
    localStorage.setItem(KEY2, JSON.stringify({ parts: state.ch.parts.filter(p => !p.fixed) }));
    localStorage.setItem(KEY3, JSON.stringify({ parts: state.ch3.parts.filter(p => !p.fixed) }));
  } catch {}
}

// The board you're building on: level 1's free build, or level 2's challenge.
const box = () => (step().mode !== 'challenge' ? state.sb : level() === 3 ? state.ch3 : state.ch);
const level = (i = state.step) => STEPS[i].level || 1;
const inLevel = l => STEPS.map((s, i) => i).filter(i => level(i) === l);
const mistakes = () => [MISTAKES, MISTAKES2, MISTAKES3][level() - 1];
const sensorOK = () => sensorStatus(XIAO_CIRCUIT).ok;

const step = () => STEPS[state.step];

// ----- What the board shows -----

function scene() {
  const s = step();
  const sc = { parts: s.parts || [], highlights: [...(s.highlights || [])], notes: (s.notes || []).map(n => ({ ...n, text: sided(n.text) })), marks: [], xray: state.xray ?? s.xray, bus: !!s.bus, high: level() >= 2 };
  if (s.mode === 'pin') sc.high = state.high;
  if (level() === 4) {
    const t = s.mode === 'trouble' && !state.fixed ? TROUBLE[state.tab] : null;
    sc.wifi = t ? t.wifi : s.mode === 'join' ? state.wifi : s.mode === 'wifi' ? undefined : 'on';
    sc.waves = sc.wifi === 'on';
    if (t?.noAntenna) sc.parts = sc.parts.filter(p => p !== antenna);
    if (s.mode === 'trouble') sc.parts = t?.noAntenna ? SCREEN_CIRCUIT : [...SCREEN_CIRCUIT, antenna];
  }
  if (s.mode === 'run') sc.high = sensorOK() && state.temp > HOT;
  if (s.mode === 'mistakes') {
    const m = mistakes()[state.tab];
    sc.parts = state.fixed ? m.fix : m.parts;
    if (!state.fixed && m.address) sc.address = m.address;
    sc.highlights = state.fixed ? [] : [...(m.highlights || [])];
  } else if (s.mode === 'quiz') {
    const q = state.quiz;
    sc.notes = [];
    if (q.answer) {
      const right = q.right;
      sc.highlights = [{ net: netOf(q.target), tone: 'ok' }];
      if (!right) sc.highlights.push({ net: netOf(q.answer), tone: 'muted' });
      sc.marks.push({ hole: q.answer, kind: right ? 'right' : 'wrong' });
    }
    if (!q.done) sc.marks.push({ hole: q.target, kind: 'target' });
  } else if (s.mode === 'sandbox' || s.mode === 'challenge') {
    sc.parts = box().parts;
    if (box().pending) sc.marks.push({ hole: box().pending, kind: 'pending' });
  }
  if (state.inspect && lookMode()) {
    sc.highlights = [{ net: netOf(state.inspect), tone: 'sel' }];
    sc.notes = [];
    sc.marks.push({ hole: state.inspect, kind: 'sel' });
  }
  return sc;
}

const lookMode = () => { const m = step().mode; return !['quiz', 'sandbox', 'challenge'].includes(m) || box().tool === 'look'; };

function draw() {
  const sc = scene();
  view.screen = level() >= 3 ? screenFrame(sc.parts, sc.address, sc.wifi) : null;
  const r = view.draw(sc);
  const xr = sc.xray === 'on';
  $('#xray').setAttribute('aria-pressed', String(xr));
  return r;
}

// ----- The panel -----

function render() {
  const s = step();
  document.body.dataset.mode = s.mode || 'look';
  document.body.classList.toggle('phone-first', !!s.phone);
  const steps = inLevel(level());
  $('#kicker').textContent = `Level ${level()} · Step ${steps.indexOf(state.step) + 1} of ${steps.length}`;
  [...document.querySelectorAll('.levels button')].forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.level === level())));
  $('#title').textContent = s.title;
  $('#body').innerHTML = sided(s.body);
  $('#back').disabled = state.step === 0;
  $('#next').textContent = state.step === STEPS.length - 1 ? 'Restart' : level(state.step + 1) !== level() ? `Level ${level(state.step + 1)}` : 'Next';
  $('#dots').replaceChildren(...steps.map(i => h('li', {}, h('button', {
    title: STEPS[i].title, 'aria-label': `Step ${steps.indexOf(i) + 1}: ${STEPS[i].title}`, 'aria-current': i === state.step ? 'step' : 'false', onclick: () => go(i),
  }))));
  $('#tools').hidden = s.mode !== 'sandbox' && s.mode !== 'challenge';
  [...$('#tools').querySelectorAll('button')].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === box().tool)));
  const copy = $('#body .copy');
  if (copy) copy.addEventListener('click', () => copyCode(copy));
  const r = draw();
  renderExtra(r);
  setInfo();
}

function renderExtra(r) {
  const s = step(), ex = $('#extra');
  ex.replaceChildren();
  if (s.mode === 'mistakes') mistakesUI(ex, r);
  else if (s.mode === 'quiz') quizUI(ex);
  else if (s.mode === 'sandbox') sandboxUI(ex, r);
  else if (s.mode === 'pin') pinUI(ex);
  else if (s.mode === 'run') runUI(ex);
  else if (s.mode === 'challenge') challengeUI(ex, r);
  else if (s.mode === 'join') joinUI(ex);
  else if (s.mode === 'trouble') troubleUI(ex);
  else if (s.build) {
    const done = s.build === 4 && r.leds.some(l => l.state === 'lit');
    ex.append(h('p', { class: 'progress' }, ...[1, 2, 3, 4].map(n => h('span', { class: n <= s.build ? 'on' : '' }, ''))),
      h('p', { class: 'verdict ' + (done ? 'good' : '') }, done ? 'It lights.' : `Part ${s.build} of 4`));
  }
}

function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}

function verdict(r) {
  if (r.short) return ['bad', 'Short circuit: the LED stays dark and the battery heats up.'];
  const l = r.leds[0];
  if (!l) return ['', ''];
  if (l.state === 'lit') return ['good', 'It lights.'];
  if (l.state === 'burned') return ['bad', 'A bright flash, then nothing: the LED burns out.'];
  return ['bad', 'The LED stays dark.'];
}

function mistakesUI(ex, r) {
  const m = mistakes()[state.tab];
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Mistakes' });
  mistakes().forEach((mm, i) => tabs.append(h('button', {
    role: 'tab', 'aria-selected': String(i === state.tab), class: 'tab',
    onclick: () => { state.tab = i; state.fixed = false; state.inspect = null; render(); applyFocus(); },
  }, mm.label)));
  ex.append(tabs, ...(level() === 3 ? verdict3(view.scene, r) : level() === 2 ? verdict2(view.scene.parts, r) : [verdict(r)]).map(([tone, say]) => h('p', { class: 'verdict ' + tone }, say)),
    h('p', {}, sided(state.fixed ? (m.fixText || 'Fixed. Compare it with the broken one to spot the difference.') : m.text)),
    h('button', { class: 'btn', onclick: () => { state.fixed = !state.fixed; render(); } }, state.fixed ? 'Show the mistake again' : 'Show the fix'));
}

// Level 2: does the sensor answer, and does D10 light the LED?
function verdict2(parts, r) {
  if (r.short) return [['bad', 'Short circuit: 3V3 is wired straight to GND. The XIAO shuts down or gets hot.']];
  const st = sensorStatus(parts);
  const out = [];
  if (st.ok) out.push([st.items.some(i => i.warn) ? 'warn' : 'good', st.items.some(i => i.warn) ? 'The sensor answers, but on 5 V.' : 'The sensor answers.']);
  else out.push(['bad', 'The sensor doesn’t answer.']);
  const l = r.leds[0];
  if (l) out.push(l.state === 'lit' && l.by.includes('D10') ? ['good', 'D10 lights the LED.']
    : l.state === 'burned' ? ['bad', 'D10 goes HIGH and the LED burns out.']
    : ['bad', 'The LED stays dark when D10 goes HIGH.']);
  return out;
}

// Level 3: does the screen show the reading?
function verdict3(sc, r) {
  if (r.short) return [['bad', 'Short circuit: 3V3 is wired straight to GND.']];
  const st = screenStatus(sc.parts);
  if (st.items.some(i => i.danger)) return [['bad', 'The screen stays dark, and power backwards can kill it.']];
  if (!st.ok) return [['bad', 'The screen stays dark.'], ...(sensorStatus(sc.parts).ok ? [['good', 'The sensor still answers.']] : [])];
  if (sc.address && sc.address !== 0x3C) return [['bad', 'The screen stays dark: nobody answers at 0x' + sc.address.toString(16).toUpperCase() + '.']];
  return [['good', 'The screen shows the reading.']];
}

// What's on the screen: the sketch's own layout, drawn into 128 x 64 pixels that are either on or off.
const pixels = document.createElement('canvas');
pixels.width = 128; pixels.height = 64;
function screenFrame(parts, address = 0x3C, wifi) {
  const st = screenStatus(parts);
  if (!st || !st.ok || address !== 0x3C) return null;
  if (wifi === 'off') return null; // not switched on yet
  const ctx = pixels.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
  const small = (text, y) => { ctx.font = '500 9px "Plex Mono", monospace'; ctx.fillText(text, 0, y); };
  if (!sensorStatus(parts).ok) small('No BME280 found', 0);
  else if (wifi === 'joining') small('Joining Wi-Fi...', 0);
  else {
    small('Temperature', 0);
    ctx.font = '500 27px "Plex Mono", monospace';
    ctx.fillText(state.temp.toFixed(1), 0, 17);
    small(wifi === 'on' ? IP : `Humidity ${Math.round(state.hum)}%`, 54);
  }
  const img = ctx.getImageData(0, 0, 128, 64), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i] > 110;
    d[i] = on ? 214 : 0; d[i + 1] = on ? 240 : 0; d[i + 2] = on ? 255 : 0; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return pixels.toDataURL();
}

// A screen with nothing on it: every pixel off.
let dark = null;
function darkScreen() {
  if (!dark) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 64);
    dark = c.toDataURL();
  }
  return dark;
}

// New pixels for the screen on the board and the big copy in the panel, without redrawing anything else.
function refreshScreen() {
  if (level() < 3) return;
  const url = screenFrame(view.scene.parts, view.scene.address, view.scene.wifi);
  view.setScreen(url);
  const big = $('#oled');
  if (big) big.src = url || darkScreen();
}

// ----- Level 4: Wi-Fi and your phone -----

let joining = null;
function joinUI(ex) {
  const say = { off: 'Not on Wi-Fi yet.', joining: 'Joining Wi-Fi...', on: `On Wi-Fi. The router gave the XIAO the address ${IP}.` }[state.wifi];
  ex.append(h('div', { class: 'wifi-state' },
    h('button', {
      class: 'btn', disabled: state.wifi === 'joining' ? '' : false,
      onclick: () => {
        if (state.wifi === 'on') { state.wifi = 'off'; render(); return; }
        state.wifi = 'joining'; render();
        clearTimeout(joining);
        joining = setTimeout(() => { state.wifi = 'on'; if (step().mode === 'join') render(); }, 1800);
      },
    }, state.wifi === 'on' ? 'Disconnect' : 'Connect')),
  h('p', { class: 'verdict ' + (state.wifi === 'on' ? 'good' : '') }, say));
}

// One buzz each time it warms past the line, like the sketch's "warned" flag.
function checkAlert() {
  if (level() !== 4 || step().mode !== 'run' || !sensorOK()) return;
  if (state.temp > HOT && !state.warned) {
    state.warned = true;
    state.alerts.unshift({ text: `It's ${state.temp.toFixed(1)} C`, at: Date.now(), fresh: true });
    state.alerts = state.alerts.slice(0, 4);
    showBanner();
  }
  if (state.temp < HOT - 1) state.warned = false;
}

let bannerTimer = null;
function showBanner() {
  if (step().phone === 'ping') return refreshPhone(true); // on the lock screen it joins the list instead
  const b = $('.phone-banner');
  if (!b) return;
  b.replaceChildren(noteCard(state.alerts[0]));
  b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.hidden = true; }, 3500);
}

const ago = at => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'now' : `${m}m ago`; };
function noteCard(a) {
  return h('div', { class: 'note-card' }, h('div', { class: 'nc-app' }, h('span', {}, 'ntfy'), h('span', {}, ago(a.at))),
    h('b', {}, 'Weather station'), a.text);
}

// The phone: a browser on weather.local ('page'), its lock screen with alerts ('ping'), or what goes wrong.
function phone(kind, opts = {}) {
  const clock = new Date().toTimeString().slice(0, 5);
  const screen = h('div', { class: 'phone-screen' }, h('div', { class: 'phone-bar' }, h('span', {}, clock), h('span', {}, 'Wi-Fi')));
  if (kind === 'ping') {
    screen.classList.add('lock');
    screen.querySelector('.phone-bar').style.color = '#fff';
    screen.style.background = '#13324a';
    screen.append(h('div', { class: 'phone-lock' }, h('div', { class: 'pl-time' }, clock), h('div', { class: 'pl-list', id: 'alerts', 'data-quiet': opts.quiet ? '' : false })));
  } else if (kind === 'error' || kind === 'nolocal') {
    screen.append(h('div', { class: 'phone-url' }, 'weather.local'),
      h('div', { class: 'phone-error' }, h('b', {}, kind === 'nolocal' ? 'Can’t find weather.local' : 'This site can’t be reached'),
        kind === 'nolocal' ? 'The phone doesn’t know which device weather.local is.' : 'weather.local took too long to respond.'));
  } else {
    screen.append(h('div', { class: 'phone-url' }, opts.url || 'weather.local'),
      h('div', { class: 'phone-page' }, h('div', { class: 'pp-t', id: 'pp-t' }), h('div', { class: 'pp-h', id: 'pp-h' })));
  }
  const banner = h('div', { class: 'phone-banner', hidden: '' });
  const el = h('div', { class: 'phone', role: 'img', 'aria-label': 'Your phone' }, screen, banner);
  queueMicrotask(() => refreshPhone(true));
  return el;
}

function refreshPhone(all = false) {
  const t = $('#pp-t'), hum = $('#pp-h');
  if (t) t.textContent = sensorOK() ? `${state.temp.toFixed(1)} °C` : '--';
  if (hum) hum.textContent = `Humidity ${Math.round(state.hum)}%`;
  const list = $('#alerts');
  if (list && list.hasAttribute('data-quiet')) list.replaceChildren(h('p', { class: 'pl-empty' }, 'Nothing. The alerts are going to a topic nobody’s listening to.'));
  else if (list && all) list.replaceChildren(...(state.alerts.length ? state.alerts.map(noteCard) : [h('p', { class: 'pl-empty' }, `No alerts yet. Breathe on the sensor to go past ${HOT} °C.`)]));
}

function troubleUI(ex) {
  const t = TROUBLE[state.tab];
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Symptoms' });
  TROUBLE.forEach((tt, i) => tabs.append(h('button', {
    role: 'tab', 'aria-selected': String(i === state.tab), class: 'tab',
    onclick: () => { state.tab = i; state.fixed = false; render(); },
  }, tt.label)));
  ex.append(tabs,
    h('p', { class: 'verdict ' + (state.fixed ? 'good' : 'bad') }, state.fixed ? (t.fixUrl ? `http://${t.fixUrl} opens the page.` : 'Connected: the page opens and alerts arrive.') : t.say),
    h('p', {}, t.text),
    h('button', { class: 'btn', onclick: () => { state.fixed = !state.fixed; render(); } }, state.fixed ? 'Show the problem again' : 'Show the fix'),
    h('p', { class: 'serial-label' }, 'Your phone'),
    state.fixed ? phone('page', { url: t.fixUrl || 'weather.local' }) : t.phone === 'quiet' ? phone('ping', { quiet: true }) : phone(t.phone));
}

// ----- Level 2: the pin, the code, the challenge -----

function pinUI(ex) {
  ex.append(h('div', { class: 'row' },
    h('button', { class: 'btn', 'aria-pressed': String(state.high), onclick: () => { state.high = !state.high; render(); } },
      state.high ? 'Set D10 LOW' : 'Set D10 HIGH')),
    h('p', { class: 'verdict ' + (state.high ? 'good' : '') }, state.high ? 'D10 is HIGH (3.3 V): the LED is on.' : 'D10 is LOW (0 V): the LED is off.'));
}

let ticker = null, breath = null;
function runUI(ex) {
  const ok = sensorOK();
  const slider = h('input', { type: 'range', id: 'temp', min: '15', max: '35', step: '0.1', value: String(state.temp), 'aria-label': 'Temperature' });
  const readout = h('span', { class: 'temp' }, `${state.temp.toFixed(1)} °C`);
  slider.addEventListener('input', () => { state.temp = +slider.value; clearInterval(breath); readout.textContent = `${state.temp.toFixed(1)} °C`; draw(); refreshScreen(); checkAlert(); refreshPhone(); });
  if (level() === 4) ex.append(phone(step().phone));
  ex.append(
    h('label', { class: 'slider', for: 'temp' }, h('span', {}, 'Temperature'), readout),
    slider,
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: breathe }, 'Breathe on it')),
    h('p', { class: 'verdict ' + (state.temp > HOT ? 'good' : '') }, state.temp > HOT ? `Above ${HOT} °C: D10 is HIGH and the LED is on.` : `Below ${HOT} °C: D10 is LOW and the LED is off.`),
    ...(level() === 4
      ? []
      : level() === 3
      ? [h('p', { class: 'serial-label' }, 'The screen'), h('div', { class: 'oled-preview' }, h('img', { id: 'oled', alt: 'What the screen shows: the temperature in large digits, with the humidity underneath' }))]
      : [h('p', { class: 'serial-label' }, 'Serial Monitor'), h('pre', { class: 'serial', id: 'serial', 'aria-live': 'off' }, ok ? state.serial.join('\n') : 'Could not find a BME280 sensor')]));
  refreshScreen();
  const pre = $('#serial');
  if (pre) pre.scrollTop = pre.scrollHeight;
}

// Your breath is warm and damp: the reading climbs a few degrees, then drifts back.
function breathe() {
  clearInterval(breath);
  const start = state.temp, peak = Math.min(35, Math.max(start, 22) + 7), hum0 = 45;
  let t = 0;
  breath = setInterval(() => {
    t += 0.1;
    state.temp = t < 1.5 ? start + (peak - start) * (t / 1.5) : Math.max(start, peak - (peak - start) * ((t - 1.5) / 6));
    state.hum = hum0 + 38 * (state.temp - start) / Math.max(0.1, peak - start); // breath is damp too
    if (t > 7.5) { state.temp = start; state.hum = hum0; clearInterval(breath); }
    if (step().mode !== 'run') { clearInterval(breath); state.temp = start; state.hum = hum0; return; } // left the step mid-breath
    const s = $('#temp'), out = $('.temp');
    if (s) s.value = String(state.temp);
    if (out) out.textContent = `${state.temp.toFixed(1)} °C`;
    const v = $('#extra .verdict');
    if (v) {
      v.className = 'verdict ' + (state.temp > HOT ? 'good' : '');
      v.textContent = state.temp > HOT ? `Above ${HOT} °C: D10 is HIGH and the LED is on.` : `Below ${HOT} °C: D10 is LOW and the LED is off.`;
    }
    draw();
    refreshScreen();
    checkAlert();
    refreshPhone();
  }, 100);
}

// The sketch prints once a second, like the real thing.
function tick() {
  if (step().mode !== 'run' || !sensorOK()) return;
  if (level() >= 3) { refreshScreen(); refreshPhone(); return; }
  const t = state.temp + (Math.random() - 0.5) * 0.08;
  state.serial.push(`Temperature: ${t.toFixed(1)} C`);
  if (state.serial.length > 40) state.serial.shift();
  const pre = $('#serial');
  if (pre) { pre.textContent = state.serial.join('\n'); pre.scrollTop = pre.scrollHeight; }
}

function copyCode(btn) {
  const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy the code'; }, 1500); };
  const fallback = () => {
    const code = btn.parentElement.querySelector('code');
    const range = document.createRange();
    range.selectNodeContents(code);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    btn.textContent = 'Selected: copy it from here';
  };
  const code = btn.parentElement.querySelector('code').textContent;
  try { navigator.clipboard.writeText(code).then(done, fallback); } catch { fallback(); }
}

function challengeUI(ex, r) {
  const parts = box().parts, l3 = level() === 3;
  const st = sensorStatus(parts);
  const sc = l3 ? screenStatus(parts) : null;
  const led = r.leds.find(l => l.by.includes('D10') && l.state === 'lit');
  const burned = r.leds.find(l => l.state === 'burned');
  const items = [
    ...st.items.map(i => ({ ok: i.ok && !i.warn, warn: i.warn, label: { VIN: 'Sensor VIN gets 3.3 V', GND: 'Sensor GND shares the XIAO’s ground', SDA: 'SDA goes to D4', SCL: 'SCL goes to D5' }[i.pin], say: i.ok && !i.warn ? '' : i.say })),
    ...(sc ? sc.items.map(i => ({ ok: i.ok && !i.warn, warn: i.warn, label: { VCC: 'Screen VCC gets 3.3 V', GND: 'Screen GND shares the ground', SDA: 'Screen SDA reaches D4', SCL: 'Screen SCL reaches D5' }[i.pin], say: i.ok && !i.warn ? '' : i.say })) : []),
    { ok: !!led, label: 'D10 lights an LED through a resistor', say: led ? '' : burned ? 'The LED has no resistor in its loop: it would burn out.' : !r.leds.length ? 'Add a resistor from D10’s row, then an LED, then a wire to −.' : ledHint(r.leds[0]) },
    { ok: !r.short, label: 'No short circuits', say: r.short ? '3V3 or 5V is wired straight to GND. Remove that wire.' : '' },
  ];
  const done = items.every(i => i.ok);
  ex.append(h('ul', { class: 'checklist' }, ...items.map(i => h('li', { class: i.ok ? 'ok' : i.warn ? 'warn' : '' },
    h('span', { class: 'tick', 'aria-hidden': 'true' }, i.ok ? '✓' : i.warn ? '!' : ''), h('span', {}, h('b', {}, i.label), i.say ? h('br') : '', i.say)))));
  if (done) ex.append(h('p', { class: 'verdict good' }, l3
    ? 'All wired. The screen shows the temperature, the sensor answers and D10 lights the LED: a little weather station.'
    : 'All wired. The sensor answers and D10 lights the LED. That’s a real circuit you could build tonight.'));
  const answer = l3 ? SCREEN_CIRCUIT : XIAO_CIRCUIT, fixed = l3 ? [xiao, bme, oled] : [xiao, bme];
  ex.append(h('div', { class: 'row' },
    h('button', { class: 'btn quiet', onclick: () => { box().parts = answer.map(p => (p.fixed ? p : { ...p })); box().pending = null; save(); render(); } }, 'Show me the answer'),
    h('button', { class: 'btn quiet', onclick: () => { box().parts = [...fixed]; box().pending = null; save(); render(); } }, 'Start again')));
}

function ledHint(l) {
  return {
    'same-strip': 'Both LED legs are on the same clip. Move one to another row.',
    backwards: 'The LED is in backwards: the long leg (+) goes on the resistor’s side.',
    open: 'The loop isn’t closed: D10, resistor, LED, then a wire to the − rail.',
    low: 'Wired to a pin, but not D10.',
  }[l.why] || 'The LED stays dark when D10 goes HIGH.';
}

// ----- Quiz -----

const PICKS = ['main', 'rail', 'gap', 'main', 'rail', 'main'];
function newQuiz() { state.quiz = { round: 0, score: 0, target: pick(0), answer: null, done: false }; }
function pick(round) {
  const kind = PICKS[round % PICKS.length];
  const pool = HOLES.filter(hh => kind === 'rail' ? hh.kind === 'rail'
    : kind === 'gap' ? (hh.y === 7 || hh.y === 10) : hh.kind === 'main' && hh.y !== 7 && hh.y !== 10);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function quizUI(ex) {
  const q = state.quiz;
  const dots = h('p', { class: 'progress', 'aria-label': `Round ${Math.min(q.round + 1, 6)} of 6` },
    ...PICKS.map((_, i) => h('span', { class: i < q.round || (i === q.round && q.answer) ? 'on' : '' }, '')));
  ex.append(dots);
  if (q.done) {
    ex.append(h('p', { class: 'verdict good' }, `${q.score} of 6 right.`),
      h('p', {}, q.score >= 5 ? 'You can read a breadboard.' : 'Try the "Rows of five" and "Power rails" steps again, then have another go.'),
      h('button', { class: 'btn', onclick: () => { newQuiz(); render(); applyFocus(); } }, 'Play again'));
    return;
  }
  if (!q.answer) {
    ex.append(h('p', { class: 'verdict' }, `Round ${q.round + 1}: ${describeHole(q.target)} is glowing.`));
    return;
  }
  const t = netOf(q.target), a = netOf(q.answer);
  ex.append(h('p', { class: 'verdict ' + (q.right ? 'good' : 'bad') }, q.right ? 'Yes, connected.' : 'Not connected.'),
    h('p', {}, q.right
      ? `Both are on ${describeNet(t)}. The whole strip is lit up.`
      : q.answer === q.target ? `That's the glowing hole itself. Pick another hole on the same strip.`
      : `${cap(describeHole(q.answer))} is on ${describeNet(a)}. The glowing hole is on ${describeNet(t)}, lit up in green.`),
    h('button', { class: 'btn', onclick: nextRound }, q.round === 5 ? 'See your score' : 'Next round'));
}

function nextRound() {
  const q = state.quiz;
  q.round++;
  q.answer = null;
  if (q.round >= 6) q.done = true;
  else q.target = pick(q.round);
  render();
  applyFocus();
}

function answer(id) {
  const q = state.quiz;
  if (q.answer || q.done) return;
  q.answer = id;
  q.right = id !== q.target && netOf(id) === netOf(q.target);
  if (q.right) q.score++;
  render();
}

// ----- Sandbox -----

const TOOLS = { look: 'Look', wire: 'Wire', resistor: 'Resistor', led: 'LED', remove: 'Remove' };

function sandboxUI(ex, r) {
  const sb = state.sb;
  const lines = [];
  const leds = r.leds;
  if (r.short) lines.push(['bad', 'Short circuit. A wire joins + straight to − with nothing in between. Use Remove on it.']);
  else if (!leds.length) lines.push(['', 'No LED yet. Choose LED, tap the hole for its long leg (+), then the hole for its short leg.']);
  else leds.forEach((l, i) => {
    const who = leds.length > 1 ? `LED ${i + 1}: ` : '';
    const say = {
      lit: ['good', 'It lights. Current runs from + through your parts and back to −.'],
      burned: ['bad', 'No resistor in its loop. A real LED would flash and burn out. Put a resistor between + and the LED.'],
      'same-strip': ['bad', 'Both legs are on the same clip, so current goes around the LED. Move one leg to another row.'],
      backwards: ['bad', 'It’s in backwards. Current can only go in at the long leg (+).'],
      open: ['bad', 'The loop isn’t closed. Follow the path from the + rail, through each part, to the − rail, and find the gap.'],
    }[l.state === 'off' ? l.why : l.state] || ['bad', 'Dark.'];
    lines.push([say[0], who + say[1], l]);
  });
  for (const [tone, text, l] of lines) {
    const p = h('p', { class: 'verdict ' + tone }, text);
    ex.append(p);
    if (l?.why === 'backwards') ex.append(h('button', { class: 'btn', onclick: () => flip(l.part) }, 'Turn it around'));
  }
  ex.append(h('div', { class: 'row' },
    h('button', { class: 'btn quiet', onclick: () => { sb.parts = LED_CIRCUIT.map(p => ({ ...p })); sb.pending = null; save(); render(); } }, 'Start from the LED circuit'),
    h('button', { class: 'btn quiet', onclick: () => { sb.parts = [{ type: 'battery' }]; sb.pending = null; save(); render(); } }, 'Clear the board')));
}

function flip(i) {
  const p = state.sb.parts[i];
  state.sb.parts[i] = { ...p, a: p.b, b: p.a };
  save(); render();
}

const used = id => box().parts.some(p => partHoles(p).includes(id));
function taken(parts, id) {
  const what = whatsIn(parts, id) || 'something';
  return what.startsWith('nothing') ? `${describeHole(id)} is ${what.slice(14)}. Pick a free hole.` : `${describeHole(id)} already holds ${what}. Each hole takes one leg.`;
}

function sandboxTap(id) {
  const sb = box();
  if (sb.tool === 'look') { inspect(id); return; }
  if (sb.tool === 'remove') {
    const i = sb.parts.findIndex(p => (p.a === id || p.b === id) && p.type !== 'battery' && !p.fixed);
    if (i < 0) return info(used(id) ? 'That stays put. Tap a wire, resistor or LED to take it out.' : 'Nothing in that hole. Tap a hole with a wire or a leg in it.');
    sb.parts.splice(i, 1);
    save(); render();
    return info('Removed.');
  }
  if (!sb.pending) {
    if (used(id)) return info(taken(sb.parts, id));
    sb.pending = id;
    draw();
    return info(sb.tool === 'led' ? `Long leg (+) in ${describeHole(id)}. Now tap the hole for the short leg (−).` : `One end in ${describeHole(id)}. Now tap where the other end goes.`);
  }
  if (id === sb.pending) { sb.pending = null; draw(); return info('Cancelled.'); }
  if (used(id)) return info(taken(sb.parts, id));
  const a = hole(sb.pending), b = hole(id);
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (sb.tool === 'led' && d > 3.2) return info('LED legs only reach about three holes apart. Pick a hole closer to the first one.');
  if (sb.tool === 'resistor' && d > 8.5) return info('That’s further than a resistor’s legs reach. Pick a closer hole, and use a wire for the rest.');
  const part = { type: sb.tool, a: sb.pending, b: id };
  if (sb.tool === 'wire') part.color = WIRE_CYCLE[sb.parts.filter(p => p.type === 'wire').length % WIRE_CYCLE.length];
  sb.parts.push(part);
  sb.pending = null;
  save(); render();
  info(netOf(part.a) === netOf(part.b) ? 'Both ends are on the same clip, so this part is bypassed.' : 'Placed.');
}

function setTool(t) {
  box().tool = t;
  box().pending = null;
  state.inspect = null;
  [...$('#tools').querySelectorAll('button')].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  draw();
  setInfo();
}

// ----- Info line and tapping holes -----

function info(text) { $('#info').textContent = text; }

function setInfo() {
  const s = step();
  if (state.inspect && lookMode()) {
    const id = state.inspect, net = netOf(id), others = netHoles(net).filter(x => x.id !== id);
    info((others.length > 6
      ? `${cap(describeHole(id))}: joined to all ${others.length + 1} holes on ${describeNet(net)}.`
      : `${id} is joined to ${others.map(x => x.id).join(', ')}: ${describeNet(net)}.`) + legIn(id));
  } else if (s.mode === 'quiz') info('Tap a hole connected to the glowing one.');
  else if (s.mode === 'sandbox' || s.mode === 'challenge') info({ look: 'Tap any hole to see what it’s joined to.', wire: 'Wire: tap two holes.', resistor: 'Resistor: tap two holes.', led: 'LED: tap the long leg’s hole (+), then the short leg’s.', remove: 'Tap a hole to take out what’s in it.' }[box().tool]);
  else info('Tap any hole to see what it’s joined to.');
}

// What's plugged into a hole, if anything: " It holds the LED's long leg (+)."
function legIn(id) {
  const what = whatsIn(view.scene.parts, id);
  return !what ? '' : what.startsWith('nothing') ? ` It’s under a board.` : ` It holds ${what}.`;
}

function inspect(id) {
  state.inspect = state.inspect === id ? null : id;
  draw();
  setInfo();
}

// One finger taps a hole, or drags the board around when it's zoomed in. Two fingers pinch to zoom.
const touches = new Map();
let moved = false;
svg.addEventListener('pointerdown', e => {
  svg.setPointerCapture?.(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (touches.size === 1) moved = false;
  else moved = true; // a pinch is never a tap
});
svg.addEventListener('pointermove', e => {
  const t = touches.get(e.pointerId);
  if (!t) {
    if (e.pointerType !== 'mouse') return;
    const hh = view.holeAt(e, 0.6);
    view.hover(hh?.id);
    svg.style.cursor = hh ? 'pointer' : '';
    return;
  }
  if (touches.size >= 2) {
    const [a, b] = [...touches.values()];
    const d0 = Math.hypot(a.x - b.x, a.y - b.y), m0 = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    t.x = e.clientX; t.y = e.clientY;
    const d1 = Math.hypot(a.x - b.x, a.y - b.y), m1 = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    if (d0 > 0) view.zoomAt(d1 / d0, m1[0], m1[1]);
    view.panBy(m1[0] - m0[0], m1[1] - m0[1]);
    return;
  }
  const dx = e.clientX - t.x, dy = e.clientY - t.y;
  t.x = e.clientX; t.y = e.clientY;
  if (!moved && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 10) moved = true;
  if (moved && view.zoomed()) view.panBy(dx, dy);
});
const lift = e => {
  if (!touches.delete(e.pointerId)) return;
  if (e.type === 'pointercancel') moved = true;
  if (!touches.size && !moved) tap(e);
};
svg.addEventListener('pointerup', lift);
svg.addEventListener('pointercancel', lift);
svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') view.hover(null); });
svg.addEventListener('wheel', e => { e.preventDefault(); view.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });

function tap(e) {
  const hh = view.holeAt(e, 0.8);
  const m = step().mode;
  if (!hh) {
    if (state.inspect) { state.inspect = null; draw(); setInfo(); }
    return;
  }
  if (m === 'quiz') answer(hh.id);
  else if (m === 'sandbox' || m === 'challenge') sandboxTap(hh.id);
  else inspect(hh.id);
}

// ----- Zoom -----

// Small screens open each step zoomed in on the part that matters; big ones show the whole board.
const SMALL = 22; // screen pixels between holes, below which tapping gets fiddly
function focusFor() {
  if (view.fullPitch() >= SMALL) return null;
  const s = step();
  if (s.mode === 'mistakes') return mistakes()[state.tab].focus || s.focus || null;
  if (s.mode === 'quiz' && !state.quiz.done) {
    const t = hole(state.quiz.target);
    return [t.x - 7, t.y < 8.5 ? -1.6 : 7.8, t.x + 7, t.y < 8.5 ? 9.2 : 18.6];
  }
  return s.focus || null;
}
function applyFocus(animate = true) { view.setFocus(focusFor(), animate); }

view.onview = () => { $('#zfit').hidden = !view.zoomed(); };
$('#zin').addEventListener('click', () => view.zoomAt(1.5));
$('#zout').addEventListener('click', () => view.zoomAt(1 / 1.5));
$('#zfit').addEventListener('click', () => view.setFocus(null));

// ----- Steps -----

function go(i, push = true) {
  state.step = (i + STEPS.length) % STEPS.length;
  state.xray = null;
  state.inspect = null;
  state.fixed = false;
  state.tab = 0;
  state.sb.pending = null;
  state.ch.pending = null;
  if (step().mode === 'quiz') newQuiz();
  if (step().mode === 'pin') state.high = true;
  if (step().mode === 'join') { clearTimeout(joining); state.wifi = 'off'; }
  if (push) history.replaceState(null, '', '#' + step().id);
  view.setExtent(level() >= 3 ? EXTENT3 : EXTENT);
  if (fitBoard()) applyFocus(false);
  render();
  applyFocus();
  $('.panel-scroll').scrollTop = 0;
}

$('#back').addEventListener('click', () => go(state.step - 1));
$('#next').addEventListener('click', () => go(state.step + 1));
$('#xray').addEventListener('click', () => {
  state.xray = $('#xray').getAttribute('aria-pressed') === 'true' ? 'off' : 'on';
  draw();
});
document.querySelectorAll('.levels button').forEach(b => b.addEventListener('click', () => go(inLevel(+b.dataset.level)[0])));
ticker = setInterval(tick, 1000);
for (const [t, label] of Object.entries(TOOLS)) {
  $('#tools').append(h('button', { 'data-tool': t, 'aria-pressed': String(t === 'look'), onclick: () => setTool(t) }, label));
}
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') go(state.step + 1);
  if (e.key === 'ArrowLeft' && state.step > 0) go(state.step - 1);
});
window.addEventListener('hashchange', () => {
  const i = STEPS.findIndex(s => '#' + s.id === location.hash);
  if (i >= 0 && i !== state.step) go(i, false);
});

const wrap = $('.board-wrap');
function fitBoard() {
  const { width, height } = wrap.getBoundingClientRect();
  const o = BoardView.fit(width || 800, height || 500, view.ext);
  setSides(o);
  return view.setOrient(o);
}
new ResizeObserver(() => {
  const { width, height } = wrap.getBoundingClientRect();
  if (!width || !height) return;
  if (fitBoard()) { render(); applyFocus(false); } // the words "top" and "bottom" change too
  else view.refit();
}).observe(wrap);

{
  fitBoard();
  const i = STEPS.findIndex(s => '#' + s.id === location.hash);
  go(i >= 0 ? i : 0, false);
}

// For the tests and screenshot tools: where a hole is on screen.
function where(id) {
  const hh = hole(id), [x, y] = view.pt(hh.x, hh.y);
  const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
  return [p.x, p.y];
}
window.rowsAndRails = { go, view, state, where };

if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
