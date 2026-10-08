import { HOLES, hole, netOf, netHoles, describeNet, describeHole, cap } from './board.js';
import { BoardView, WIRE_CYCLE } from './render.js';
import { STEPS, MISTAKES, LED_CIRCUIT } from './lessons.js';

const $ = s => document.querySelector(s);
const svg = $('#board');
const view = new BoardView(svg);
const KEY = 'rows-and-rails.v1';

const state = {
  step: 0,
  xray: null,      // the reader's own choice for this step, or null for the step's default
  inspect: null,   // hole id tapped in look mode
  tab: 0, fixed: false,
  quiz: null,
  sb: { parts: load(), tool: 'look', pending: null },
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved?.parts)) return [{ type: 'battery' }, ...saved.parts.filter(p => p.type !== 'battery' && validParts(p))];
  } catch {}
  return [{ type: 'battery' }];
}
function validParts(p) {
  try { hole(p.a); hole(p.b); return ['wire', 'resistor', 'led'].includes(p.type); } catch { return false; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ parts: state.sb.parts.filter(p => p.type !== 'battery') })); } catch {}
}

const step = () => STEPS[state.step];

// ----- What the board shows -----

function scene() {
  const s = step();
  const sc = { parts: s.parts || [], highlights: [...(s.highlights || [])], notes: s.notes || [], marks: [], xray: state.xray ?? s.xray };
  if (s.mode === 'mistakes') {
    const m = MISTAKES[state.tab];
    sc.parts = state.fixed ? m.fix : m.parts;
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
  } else if (s.mode === 'sandbox') {
    sc.parts = state.sb.parts;
    if (state.sb.pending) sc.marks.push({ hole: state.sb.pending, kind: 'pending' });
  }
  if (state.inspect && lookMode()) {
    sc.highlights = [{ net: netOf(state.inspect), tone: 'sel' }];
    sc.notes = [];
    sc.marks.push({ hole: state.inspect, kind: 'sel' });
  }
  return sc;
}

const lookMode = () => { const m = step().mode; return !m || m === 'mistakes' || (m === 'sandbox' && state.sb.tool === 'look'); };

function draw() {
  const sc = scene();
  const r = view.draw(sc);
  const xr = sc.xray === 'on';
  $('#xray').setAttribute('aria-pressed', String(xr));
  return r;
}

// ----- The panel -----

function render() {
  const s = step();
  document.body.dataset.mode = s.mode || 'look';
  $('#kicker').textContent = `Step ${state.step + 1} of ${STEPS.length}`;
  $('#title').textContent = s.title;
  $('#body').innerHTML = s.body;
  $('#back').disabled = state.step === 0;
  $('#next').textContent = state.step === STEPS.length - 1 ? 'Restart' : 'Next';
  [...$('#dots').children].forEach((li, i) => li.firstChild.setAttribute('aria-current', i === state.step ? 'step' : 'false'));
  $('#tools').hidden = s.mode !== 'sandbox';
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
  const m = MISTAKES[state.tab];
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Mistakes' });
  MISTAKES.forEach((mm, i) => tabs.append(h('button', {
    role: 'tab', 'aria-selected': String(i === state.tab), class: 'tab',
    onclick: () => { state.tab = i; state.fixed = false; state.inspect = null; render(); },
  }, mm.label)));
  const [tone, say] = verdict(r);
  ex.append(tabs,
    h('p', { class: 'verdict ' + tone }, say),
    h('p', {}, state.fixed ? (m.fixText || 'Fixed. Compare it with the broken one to spot the difference.') : m.text),
    h('button', { class: 'btn', onclick: () => { state.fixed = !state.fixed; render(); } }, state.fixed ? 'Show the mistake again' : 'Show the fix'));
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
      h('button', { class: 'btn', onclick: () => { newQuiz(); render(); } }, 'Play again'));
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

function used(id) {
  if (id === 'T+2' || id === 'T-4') return true; // the battery leads
  return state.sb.parts.some(p => p.a === id || p.b === id);
}

function sandboxTap(id) {
  const sb = state.sb;
  if (sb.tool === 'look') { inspect(id); return; }
  if (sb.tool === 'remove') {
    const i = sb.parts.findIndex(p => p.a === id || p.b === id);
    if (i < 0) return info(id === 'T+2' || id === 'T-4' ? 'The battery stays put.' : 'Nothing in that hole. Tap a hole with a wire or a leg in it.');
    sb.parts.splice(i, 1);
    save(); render();
    return info('Removed.');
  }
  if (!sb.pending) {
    if (used(id)) return info(`${describeHole(id)} already has something in it. Each hole takes one leg.`);
    sb.pending = id;
    draw();
    return info(sb.tool === 'led' ? `Long leg (+) in ${describeHole(id)}. Now tap the hole for the short leg (−).` : `One end in ${describeHole(id)}. Now tap where the other end goes.`);
  }
  if (id === sb.pending) { sb.pending = null; draw(); return info('Cancelled.'); }
  if (used(id)) return info(`${describeHole(id)} already has something in it. Pick an empty hole.`);
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
  state.sb.tool = t;
  state.sb.pending = null;
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
    info(others.length > 6
      ? `${cap(describeHole(id))}: joined to all ${others.length + 1} holes on ${describeNet(net)}.`
      : `${id} is joined to ${others.map(x => x.id).join(', ')}: ${describeNet(net)}.`);
  } else if (s.mode === 'quiz') info('Tap a hole connected to the glowing one.');
  else if (s.mode === 'sandbox') info({ look: 'Tap any hole to see what it’s joined to.', wire: 'Wire: tap two holes.', resistor: 'Resistor: tap two holes.', led: 'LED: tap the long leg’s hole (+), then the short leg’s.', remove: 'Tap a hole to take out what’s in it.' }[state.sb.tool]);
  else info('Tap any hole to see what it’s joined to.');
}

function inspect(id) {
  state.inspect = state.inspect === id ? null : id;
  draw();
  setInfo();
}

let down = null;
svg.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
svg.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { down = null; return; }
  down = null;
  const hh = view.holeAt(e, 0.8);
  const m = step().mode;
  if (!hh) {
    if (state.inspect) { state.inspect = null; draw(); setInfo(); }
    return;
  }
  if (m === 'quiz') answer(hh.id);
  else if (m === 'sandbox') sandboxTap(hh.id);
  else inspect(hh.id);
});
svg.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const hh = view.holeAt(e, 0.6);
  view.hover(hh?.id);
  svg.style.cursor = hh ? 'pointer' : '';
});
svg.addEventListener('pointerleave', () => view.hover(null));

// ----- Steps -----

function go(i, push = true) {
  state.step = (i + STEPS.length) % STEPS.length;
  state.xray = null;
  state.inspect = null;
  state.fixed = false;
  state.sb.pending = null;
  if (step().mode === 'quiz') newQuiz();
  if (push) history.replaceState(null, '', '#' + step().id);
  render();
  $('.panel-scroll').scrollTop = 0;
}

$('#back').addEventListener('click', () => go(state.step - 1));
$('#next').addEventListener('click', () => go(state.step + 1));
$('#xray').addEventListener('click', () => {
  state.xray = $('#xray').getAttribute('aria-pressed') === 'true' ? 'off' : 'on';
  draw();
});
STEPS.forEach((s, i) => $('#dots').append(h('li', {}, h('button', { title: s.title, 'aria-label': `Step ${i + 1}: ${s.title}`, onclick: () => go(i) }))));
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
new ResizeObserver(() => {
  const { width, height } = wrap.getBoundingClientRect();
  if (width && height) view.setOrient(BoardView.fit(width, height));
}).observe(wrap);

{
  const { width, height } = wrap.getBoundingClientRect();
  view.setOrient(BoardView.fit(width || 800, height || 500));
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
