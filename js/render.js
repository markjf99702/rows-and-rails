// Draws the breadboard and everything on it as SVG.
// The board lies across a wide screen ('h') and stands up on a tall one ('v'); everything is drawn
// in board coordinates and mapped through pt(), so the same scene works either way.

import { HOLES, hole, netHoles, RAILS, RAIL_X, COLS, LETTERS, ROW_Y, EXTENT, holeNear } from './board.js';
import { analyze, flowPoints } from './circuit.js';

const NS = 'http://www.w3.org/2000/svg';
const P = 10; // SVG units per hole spacing

export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

const WIRE_COLORS = { red: '#d8343a', black: '#2a2a2c', blue: '#2f6fd6', green: '#2f9e57', yellow: '#e8b923', orange: '#e57a24', white: '#ecebe6', purple: '#8a4fc7' };
export const WIRE_CYCLE = ['green', 'yellow', 'blue', 'orange', 'purple', 'white'];

export class BoardView {
  constructor(svg) {
    this.svg = svg;
    this.orient = null;
    this.scene = { parts: [] };
    this.shown = new Set();
  }

  pt(x, y) { return this.orient === 'h' ? [x * P, y * P] : [y * P, x * P]; }

  setOrient(o) {
    if (o === this.orient) return;
    this.orient = o;
    this.build();
    this.shown = new Set(); // let parts drop in again, it's a fresh drawing
    this.draw(this.scene);
  }

  // Which way gives bigger holes in a box this size?
  static fit(w, h) {
    const bw = EXTENT.x1 - EXTENT.x0, bh = EXTENT.y1 - EXTENT.y0;
    return Math.min(w / bw, h / bh) >= Math.min(w / bh, h / bw) ? 'h' : 'v';
  }

  rect(x0, y0, x1, y1, attrs, parent) {
    const [a, b] = this.pt(x0, y0), [c, d] = this.pt(x1, y1);
    return el('rect', { x: Math.min(a, c), y: Math.min(b, d), width: Math.abs(c - a), height: Math.abs(d - b), ...attrs }, parent);
  }

  text(x, y, s, attrs, parent) {
    const [a, b] = this.pt(x, y);
    const t = el('text', { x: a, y: b, ...attrs }, parent);
    t.textContent = s;
    return t;
  }

  line(x0, y0, x1, y1, attrs, parent) {
    const [a, b] = this.pt(x0, y0), [c, d] = this.pt(x1, y1);
    return el('line', { x1: a, y1: b, x2: c, y2: d, ...attrs }, parent);
  }

  build() {
    const svg = this.svg;
    svg.replaceChildren();
    const [vx0, vy0] = this.pt(EXTENT.x0, EXTENT.y0), [vx1, vy1] = this.pt(EXTENT.x1, EXTENT.y1);
    svg.setAttribute('viewBox', `${vx0} ${vy0} ${vx1 - vx0} ${vy1 - vy0}`);
    svg.dataset.orient = this.orient;

    const defs = el('defs', {}, svg);
    const metal = el('linearGradient', { id: 'metal', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    [['0', '#f4f6f8'], ['.45', '#b9c1c9'], ['.55', '#9aa4ae'], ['1', '#dfe4e8']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, metal));
    const glow = el('radialGradient', { id: 'glow' }, defs);
    [['0', '#ff6a55', '.95'], ['.35', '#ff4836', '.55'], ['1', '#ff2a1a', '0']].forEach(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, glow));
    const blur = el('filter', { id: 'soft', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    el('feGaussianBlur', { stdDeviation: P * 0.35 }, blur);

    const B = { x0: -1.9, x1: 30.9, y0: -1.55, y1: 18.55 };
    this.rect(B.x0 + 0.25, B.y0 + 0.35, B.x1 + 0.25, B.y1 + 0.35, { rx: P * 0.8, class: 'bb-shadow', filter: 'url(#soft)' }, svg);
    this.rect(B.x0, B.y0, B.x1, B.y1, { rx: P * 0.8, class: 'bb-base' }, svg);

    // The metal clips, hidden under the plastic until you look inside.
    const gm = el('g', { class: 'bb-metal' }, svg);
    for (let x = 0; x < COLS; x++) {
      this.rect(x - 0.3, 2.55, x + 0.3, 7.45, { rx: P * 0.22, class: 'clip' }, gm);
      this.rect(x - 0.3, 9.55, x + 0.3, 14.45, { rx: P * 0.22, class: 'clip' }, gm);
    }
    for (const y of Object.values(RAILS)) this.rect(0.55, y - 0.3, 29.45, y + 0.3, { rx: P * 0.22, class: 'clip' }, gm);

    const gp = el('g', { class: 'bb-plastic' }, svg);
    this.rect(B.x0, B.y0, B.x1, B.y1, { rx: P * 0.8, class: 'plastic' }, gp);
    this.rect(B.x0, 7.85, B.x1, 9.15, { class: 'channel' }, gp);

    const gh = el('g', { class: 'bb-holes' }, svg);
    for (const h of HOLES) {
      const [a, b] = this.pt(h.x, h.y);
      el('rect', { x: a - P * 0.25, y: b - P * 0.25, width: P * 0.5, height: P * 0.5, rx: P * 0.1, class: 'hole' }, gh);
    }

    const gt = el('g', { class: 'bb-print' }, svg);
    for (const [y, cls] of [[-0.72, 'plus'], [1.72, 'minus'], [15.28, 'minus'], [17.72, 'plus']]) {
      this.line(0.4, y, 29.6, y, { class: 'rail-line ' + cls }, gt);
    }
    for (const [rail, y] of Object.entries(RAILS)) {
      for (const x of [-0.95, 30.05]) this.text(x, y, rail[1] === '+' ? '+' : '−', { class: 'rail-sign ' + (rail[1] === '+' ? 'plus' : 'minus') }, gt);
    }
    for (let x = 0; x < COLS; x++) {
      const n = x + 1;
      if (n === 1 || n % 5 === 0) for (const y of [2.05, 14.95]) this.text(x, y, String(n), { class: 'num' }, gt);
    }
    for (const l of LETTERS) for (const x of [-0.95, 30.05]) this.text(x, ROW_Y[l], l, { class: 'num' }, gt);

    this.gHl = el('g', { class: 'bb-hl' }, svg);
    this.gParts = el('g', { class: 'bb-parts' }, svg);
    this.gFlow = el('g', { class: 'bb-flow' }, svg);
    this.gMarks = el('g', { class: 'bb-marks' }, svg);
    this.gHover = el('g', { class: 'bb-hover' }, svg);
  }

  // scene: { parts, highlights: [{ net, tone }], notes: [{ at: [x, y], text }], marks: [{ hole, kind }], flow, xray }
  draw(scene) {
    this.scene = scene;
    const r = analyze(scene.parts || []);
    this.result = r;
    this.svg.classList.toggle('xray-on', scene.xray === 'on');
    this.svg.classList.toggle('xray-peek', scene.xray === 'peek');

    this.gHl.replaceChildren();
    for (const h of scene.highlights || []) this.highlight(h.net, h.tone);

    this.gParts.replaceChildren();
    const keys = new Set();
    (scene.parts || []).forEach((p, i) => {
      const key = JSON.stringify(p);
      keys.add(key);
      const led = r.leds.find(l => l.part === i);
      const g = el('g', { class: 'part part-' + p.type + (this.shown.has(key) ? '' : ' enter'), 'data-part': i }, this.gParts);
      this.drawPart(p, g, led?.state, r.short);
    });
    this.shown = keys;

    this.gFlow.replaceChildren();
    if (scene.flow !== false && r.flow && r.leds.some(l => l.state === 'lit')) {
      const pts = flowPoints(r.flow).map(([x, y]) => this.pt(x, y).join(',')).join(' ');
      el('polyline', { points: pts, class: 'flow-path' }, this.gFlow);
      el('polyline', { points: pts, class: 'flow-dots' }, this.gFlow);
    }

    this.gMarks.replaceChildren();
    for (const m of scene.marks || []) this.mark(m.hole, m.kind);
    for (const n of scene.notes || []) this.note(n.at[0], n.at[1], n.text, n.tone);
    return r;
  }

  highlight(net, tone = 'a') {
    const hs = netHoles(net);
    if (!hs.length) return;
    const g = el('g', { class: 'hl tone-' + tone }, this.gHl);
    const xs = hs.map(h => h.x), ys = hs.map(h => h.y);
    this.rect(Math.min(...xs) - 0.44, Math.min(...ys) - 0.44, Math.max(...xs) + 0.44, Math.max(...ys) + 0.44, { rx: P * 0.44, class: 'band' }, g);
    hs.forEach((h, i) => {
      const [a, b] = this.pt(h.x, h.y);
      el('circle', { cx: a, cy: b, r: P * 0.4, class: 'ring', style: `animation-delay:${Math.min(i, 30) * 22}ms` }, g);
    });
  }

  mark(id, kind) {
    const h = hole(id);
    const [a, b] = this.pt(h.x, h.y);
    const g = el('g', { class: 'mark mark-' + kind }, this.gMarks);
    el('circle', { cx: a, cy: b, r: P * 0.62, class: 'halo' }, g);
    el('circle', { cx: a, cy: b, r: P * 0.36, class: 'dot' }, g);
  }

  note(x, y, s, tone = '') {
    const g = el('g', { class: 'note ' + tone }, this.gMarks);
    const bg = el('rect', {}, g);
    const t = this.text(x, y, s, {}, g);
    const bb = t.getBBox();
    const px = P * 0.45, py = P * 0.2;
    Object.entries({ x: bb.x - px, y: bb.y - py, width: bb.width + px * 2, height: bb.height + py * 2, rx: (bb.height + py * 2) / 2 })
      .forEach(([k, v]) => bg.setAttribute(k, v));
  }

  hover(id) {
    this.gHover.replaceChildren();
    if (!id) return;
    const h = hole(id);
    const [a, b] = this.pt(h.x, h.y);
    el('circle', { cx: a, cy: b, r: P * 0.45, class: 'hover-ring' }, this.gHover);
  }

  // The hole under a pointer event, if any.
  holeAt(ev, reach) {
    const m = this.svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    const [x, y] = this.orient === 'h' ? [p.x / P, p.y / P] : [p.y / P, p.x / P];
    return holeNear(x, y, reach);
  }

  drawPart(p, g, ledState, short) {
    if (p.type === 'battery') return this.drawBattery(g, short);
    if (p.type === 'chip') return this.drawChip(p, g);
    const A = hole(p.a), Bh = hole(p.b);
    const [ax, ay] = this.pt(A.x, A.y), [bx, by] = this.pt(Bh.x, Bh.y);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const len = Math.hypot(bx - ax, by - ay);
    const ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    if (p.type === 'wire') {
      const color = WIRE_COLORS[p.color] || WIRE_COLORS.green;
      for (const [x, y] of [[ax, ay], [bx, by]]) el('circle', { cx: x, cy: y, r: P * 0.15, class: 'pin' }, g);
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: color, class: 'wire' }, g);
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'wire-shine' }, g);
      for (const [x, y] of [[ax, ay], [bx, by]]) el('circle', { cx: x, cy: y, r: P * 0.12, class: 'pin' }, g);
    } else if (p.type === 'resistor') {
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'leg' }, g);
      for (const [x, y] of [[ax, ay], [bx, by]]) el('circle', { cx: x, cy: y, r: P * 0.12, class: 'pin' }, g);
      const L = Math.max(P * 1.1, Math.min(P * 2.3, len - P * 0.7));
      const body = el('g', { transform: `translate(${mx} ${my}) rotate(${ang})` }, g);
      el('rect', { x: -L / 2, y: -P * 0.36, width: L, height: P * 0.72, rx: P * 0.32, class: 'res-body' }, body);
      // 330 ohms: orange, orange, brown, then gold for 5%.
      [[-0.3, '#e8771e'], [-0.14, '#e8771e'], [0.02, '#7a4a21'], [0.3, '#c9a13b']].forEach(([f, c]) =>
        el('rect', { x: f * L - P * 0.07, y: -P * 0.36, width: P * 0.14, height: P * 0.72, fill: c }, body));
    } else if (p.type === 'led') {
      const state = ledState || 'off';
      g.classList.add('led-' + state);
      if (state === 'lit') el('circle', { cx: mx, cy: my, r: P * 2.4, fill: 'url(#glow)', class: 'led-glow' }, g);
      el('line', { x1: ax, y1: ay, x2: mx, y2: my, class: 'leg' }, g);
      el('line', { x1: bx, y1: by, x2: mx, y2: my, class: 'leg' }, g);
      for (const [x, y] of [[ax, ay], [bx, by]]) el('circle', { cx: x, cy: y, r: P * 0.12, class: 'pin' }, g);
      const R = P * 0.66, fx = R * 0.8, hy = Math.sqrt(R * R - fx * fx);
      const dome = el('g', { transform: `translate(${mx} ${my}) rotate(${ang})` }, g);
      el('path', { d: `M${fx} ${-hy}A${R} ${R} 0 1 0 ${fx} ${hy}Z`, class: 'led-dome' }, dome);
      el('circle', { cx: -R * 0.3, cy: -R * 0.3, r: R * 0.28, class: 'led-shine' }, dome);
      // A small + beside the long leg.
      const ux = len ? (ax - bx) / len : 0, uy = len ? (ay - by) / len : 0;
      const t = el('text', { x: ax + ux * P * 0.62 - uy * P * 0.55, y: ay + uy * P * 0.62 + ux * P * 0.55, class: 'led-plus' }, g);
      t.textContent = '+';
      if (state === 'burned') {
        for (let i = 0; i < 3; i++) el('circle', { cx: mx + (i - 1) * P * 0.35, cy: my, r: P * 0.32, class: 'smoke', style: `animation-delay:${i * 0.45}s` }, g);
      }
    }
  }

  drawBattery(g, short) {
    g.classList.toggle('hot', !!short);
    this.rect(-0.75, -4.55, 4.75, -2.25, { rx: P * 0.35, class: 'bat-body' }, g);
    this.text(2, -3.35, '4.5 V', { class: 'bat-label' }, g);
    for (const [term, color] of [['BAT+', 'red'], ['BAT-', 'black']]) {
      const T = hole(term);
      const R = hole(term === 'BAT+' ? 'T+2' : 'T-4');
      const [ax, ay] = this.pt(T.x, T.y), [bx, by] = this.pt(R.x, R.y);
      this.rect(T.x - 0.3, -2.4, T.x + 0.3, -2.05, { class: 'bat-term ' + color }, g);
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: WIRE_COLORS[color], class: 'wire' }, g);
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'wire-shine' }, g);
      el('circle', { cx: bx, cy: by, r: P * 0.12, class: 'pin' }, g);
    }
    this.text(0.35, -1.55, '+', { class: 'bat-sign plus' }, g);
    this.text(3.65, -1.55, '−', { class: 'bat-sign minus' }, g);
  }

  drawChip(p, g) {
    const x0 = p.col - 1, n = p.pins / 2;
    for (let i = 0; i < n; i++) {
      for (const [y0, y1] of [[7, 7.4], [9.6, 10]]) this.rect(x0 + i - 0.17, y0, x0 + i + 0.17, y1, { class: 'chip-pin' }, g);
    }
    this.rect(x0 - 0.5, 7.3, x0 + n - 0.5, 9.7, { rx: P * 0.15, class: 'chip-body' }, g);
    const [nx, ny] = this.pt(x0 - 0.5, 8.5);
    el('circle', { cx: nx, cy: ny, r: P * 0.32, class: 'chip-notch' }, g);
    this.text(x0 + (n - 1) / 2 + 0.2, 8.5, 'chip', { class: 'chip-label' }, g);
  }
}
