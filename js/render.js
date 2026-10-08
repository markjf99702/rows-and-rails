// Draws the breadboard and everything on it as SVG.
// The board lies across a wide screen ('h') and stands up on a tall one ('v'); everything is drawn
// in board coordinates and mapped through pt(), so the same scene works either way.

import { HOLES, hole, netHoles, RAILS, RAIL_X, COLS, LETTERS, ROW_Y, EXTENT, holeNear, xiaoPins, sensorPins, XIAO_ALSO } from './board.js';
import { analyze, sensorStatus, wireRoute } from './circuit.js';

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
    this.vb = null;      // what part of the board is showing, in SVG units
    this.focus = null;   // the board rectangle [x0, y0, x1, y1] to show, or null for all of it
  }

  pt(x, y) { return this.orient === 'h' ? [x * P, y * P] : [y * P, x * P]; }

  setOrient(o) {
    if (o === this.orient) return false;
    this.orient = o;
    this.build();
    this.shown = new Set(); // let parts drop in again, it's a fresh drawing
    this.draw(this.scene);
    return true;
  }

  // ----- Zoom -----
  // The view box always matches the shape of the box the board sits in, so panning and the
  // limits work on what's actually on screen.

  box() { const r = this.svg.getBoundingClientRect(); return { w: r.width || 1, h: r.height || 1 }; }

  svgRect([x0, y0, x1, y1]) {
    const [a, b] = this.pt(x0, y0), [c, d] = this.pt(x1, y1);
    return { x: Math.min(a, c), y: Math.min(b, d), w: Math.abs(c - a), h: Math.abs(d - b) };
  }

  shape(r) {
    const { w, h } = this.box(), ar = w / h;
    const out = { ...r };
    if (out.w / out.h < ar) { const nw = out.h * ar; out.x -= (nw - out.w) / 2; out.w = nw; }
    else { const nh = out.w / ar; out.y -= (nh - out.h) / 2; out.h = nh; }
    return this.clamp(out);
  }

  clamp(r) {
    const full = this.svgRect([EXTENT.x0, EXTENT.y0, EXTENT.x1, EXTENT.y1]);
    const ar = r.w / r.h;
    const maxW = Math.max(full.w, full.h * ar), minW = maxW / 6;
    let w = Math.min(maxW, Math.max(minW, r.w)), h = w / ar;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    let x = cx - w / 2, y = cy - h / 2;
    x = w >= full.w ? full.x + (full.w - w) / 2 : Math.min(Math.max(x, full.x), full.x + full.w - w);
    y = h >= full.h ? full.y + (full.h - h) / 2 : Math.min(Math.max(y, full.y), full.y + full.h - h);
    return { x, y, w, h };
  }

  // Screen pixels per hole spacing when the whole board shows.
  fullPitch() {
    const full = this.svgRect([EXTENT.x0, EXTENT.y0, EXTENT.x1, EXTENT.y1]), { w, h } = this.box();
    return Math.min(w / full.w, h / full.h) * P;
  }

  zoomed() {
    if (!this.vb) return false;
    const all = this.shape(this.svgRect([EXTENT.x0, EXTENT.y0, EXTENT.x1, EXTENT.y1]));
    return this.vb.w < all.w * 0.98;
  }

  setFocus(rect, animate = true) {
    this.focus = rect;
    this.show(this.shape(this.svgRect(rect || [EXTENT.x0, EXTENT.y0, EXTENT.x1, EXTENT.y1])), animate);
  }

  // After a resize: keep the same middle and the same zoom, in the new shape.
  refit() {
    if (!this.vb) return this.setFocus(this.focus, false);
    this.show(this.shape(this.target || this.vb), false); // aim for where a zoom was heading
  }

  show(vb, animate) {
    cancelAnimationFrame(this.anim);
    const from = this.vb;
    this.target = vb;
    const set = r => { this.vb = r; this.svg.setAttribute('viewBox', `${r.x} ${r.y} ${r.w} ${r.h}`); this.onview?.(); };
    this.busy = false;
    if (!animate || !from || matchMedia('(prefers-reduced-motion: reduce)').matches) return set(vb);
    this.busy = true;
    const t0 = performance.now(), D = 380;
    const tick = now => {
      const t = Math.min(1, (now - t0) / D), e = 1 - (1 - t) ** 3;
      set({ x: from.x + (vb.x - from.x) * e, y: from.y + (vb.y - from.y) * e, w: from.w + (vb.w - from.w) * e, h: from.h + (vb.h - from.h) * e });
      if (t < 1) this.anim = requestAnimationFrame(tick);
      else this.busy = false;
    };
    this.anim = requestAnimationFrame(tick);
  }

  // Zoom by f (above 1 is closer) around a point on screen.
  zoomAt(f, clientX, clientY) {
    if (!this.vb) return;
    const r = this.svg.getBoundingClientRect();
    const fx = clientX == null ? 0.5 : (clientX - r.left) / r.width, fy = clientY == null ? 0.5 : (clientY - r.top) / r.height;
    const w = this.vb.w / f, h = this.vb.h / f;
    const x = this.vb.x + (this.vb.w - w) * fx, y = this.vb.y + (this.vb.h - h) * fy;
    cancelAnimationFrame(this.anim);
    this.show(this.clamp({ x, y, w, h }), false);
  }

  // Move the view by a distance in screen pixels.
  panBy(dx, dy) {
    if (!this.vb) return;
    const r = this.svg.getBoundingClientRect();
    const k = this.vb.w / r.width;
    cancelAnimationFrame(this.anim);
    this.show(this.clamp({ ...this.vb, x: this.vb.x - dx * k, y: this.vb.y - dy * k }), false);
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
    this.vb = null;
    this.setFocus(this.focus, false);
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
    const r = analyze(scene.parts || [], { high: !!scene.high });
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
      const pts = this.flowPath(r.flow, r.flowFrom, r.flowTo).map(p => p.join(',')).join(' ');
      el('polyline', { points: pts, class: 'flow-path' }, this.gFlow);
      el('polyline', { points: pts, class: 'flow-dots' }, this.gFlow);
    }
    // The XIAO and the sensor talking: messages along SDA and SCL, when both are wired right.
    const sensor = (scene.parts || []).find(p => p.type === 'sensor'), xiao = (scene.parts || []).find(p => p.type === 'xiao');
    if (scene.bus && sensor && xiao && sensorStatus(scene.parts).ok) {
      const xp = Object.fromEntries(xiaoPins(xiao.col).map(q => [q.name, q.hole]));
      const sp = Object.fromEntries(sensorPins(sensor.col, sensor.row).map(q => [q.name, q.hole]));
      for (const [name, pin] of [['SDA', 'D4'], ['SCL', 'D5']]) {
        const route = wireRoute(scene.parts, xp[pin], sp[name]);
        if (!route) continue;
        const pts = this.flowPath(route, xp[pin], sp[name]).map(p => p.join(',')).join(' ');
        el('polyline', { points: pts, class: 'bus-path bus-' + name.toLowerCase() }, this.gFlow);
        el('polyline', { points: pts, class: 'bus-dots bus-' + name.toLowerCase() }, this.gFlow);
      }
    }

    this.gMarks.replaceChildren();
    for (const m of scene.marks || []) this.mark(m.hole, m.kind);
    for (const n of scene.notes || []) this.note(n.at[0], n.at[1], n.text, n.tone);
    return r;
  }

  // Where current runs for one loop, on screen: along the clips between parts, and up through each LED's dome.
  flowPath(flow, from = 'BAT+', to = 'BAT-') {
    const pts = [];
    const at = id => { const h = hole(id); pts.push(this.pt(h.x, h.y)); };
    at(from);
    for (const s of flow) {
      at(s.from);
      if (s.edge.kind === 'led') pts.push(this.domeAt(s.edge.a, s.edge.b).d);
      at(s.to);
    }
    at(to);
    return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  }

  // An LED leans to one side so both of its holes stay in sight.
  domeAt(aId, bId) {
    const A = hole(aId), B = hole(bId);
    const a = this.pt(A.x, A.y), b = this.pt(B.x, B.y);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], n = [u[1], -u[0]];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return { a, b, u, n, len, d: [m[0] + n[0] * P * 0.95, m[1] + n[1] * P * 0.95] };
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
    if (p.type === 'xiao') return this.drawXiao(p, g);
    if (p.type === 'sensor') return this.drawSensor(p, g);
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
      const { a, b, u, n, d } = this.domeAt(p.a, p.b);
      if (state === 'lit') el('circle', { cx: d[0], cy: d[1], r: P * 2.4, fill: 'url(#glow)', class: 'led-glow' }, g);
      for (const q of [a, b]) el('line', { x1: q[0], y1: q[1], x2: d[0], y2: d[1], class: 'leg' }, g);
      el('circle', { cx: a[0], cy: a[1], r: P * 0.17, class: 'pin leg-plus' }, g);
      el('circle', { cx: b[0], cy: b[1], r: P * 0.17, class: 'pin leg-minus' }, g);
      const R = P * 0.62, fx = R * 0.8, hy = Math.sqrt(R * R - fx * fx);
      const ang = Math.atan2(u[1], u[0]) * 180 / Math.PI;
      const dome = el('g', { transform: `translate(${d[0]} ${d[1]}) rotate(${ang})` }, g);
      el('path', { d: `M${fx} ${-hy}A${R} ${R} 0 1 0 ${fx} ${hy}Z`, class: 'led-dome' }, dome);
      el('circle', { cx: -R * 0.3, cy: -R * 0.3, r: R * 0.28, class: 'led-shine' }, dome);
      // + and − tags on the far side of each leg's hole, so you can see which leg is where.
      for (const [q, sign, cls] of [[a, '+', 'plus'], [b, '−', 'minus']]) {
        const cx = q[0] - n[0] * P * 0.68, cy = q[1] - n[1] * P * 0.68;
        el('circle', { cx, cy, r: P * 0.3, class: 'leg-tag ' + cls }, g);
        const t = el('text', { x: cx, y: cy, class: 'leg-sign' }, g);
        t.textContent = sign;
      }
      if (state === 'burned') {
        for (let i = 0; i < 3; i++) el('circle', { cx: d[0] + (i - 1) * P * 0.35, cy: d[1], r: P * 0.32, class: 'smoke', style: `animation-delay:${i * 0.45}s` }, g);
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

  // The XIAO from above: USB-C toward row 1, the metal can in the middle, every pin labelled.
  drawXiao(p, g) {
    const x0 = p.col - 1;
    // the cable to your computer, off the end of the board
    this.line(-6, 9, x0 - 1.2, 9, { class: 'usb-cable' }, g);
    this.rect(x0 - 1.25, 8.1, x0 - 0.35, 9.9, { rx: P * 0.2, class: 'usb-plug' }, g);
    this.rect(x0 - 0.5, 5.55, x0 + 6.5, 12.45, { rx: P * 0.35, class: 'xiao-pcb' }, g);
    this.rect(x0 - 0.75, 7.95, x0 + 0.35, 10.05, { rx: P * 0.25, class: 'usb-port' }, g);
    this.rect(x0 + 1.15, 7.55, x0 + 5.3, 9.95, { rx: P * 0.12, class: 'xiao-can' }, g);
    // The name reads across the can either way up: stacked along the board when it stands upright.
    const [n1, n2] = this.orient === 'h' ? [[x0 + 3.22, 8.4], [x0 + 3.22, 9.25]] : [[x0 + 2.75, 8.75], [x0 + 3.75, 8.75]];
    this.text(...n1, 'XIAO', { class: 'xiao-name' }, g);
    this.text(...n2, 'ESP32C3', { class: 'xiao-sub' }, g);
    for (const q of xiaoPins(p.col)) {
      const h = hole(q.hole);
      const [cx, cy] = this.pt(h.x, h.y);
      el('circle', { cx, cy, r: P * 0.26, class: 'xiao-pad' + (q.name === '3V3' || q.name === '5V' ? ' pwr' : q.name === 'GND' ? ' gnd' : '') }, g);
      const inward = h.y < 9 ? 0.85 : -0.85;
      this.text(h.x, h.y + inward, q.name, { class: 'xiao-pin' }, g);
      if (q.name === 'D4' || q.name === 'D5') this.text(h.x, h.y + inward * 1.68, XIAO_ALSO[q.name], { class: 'xiao-pin also' }, g);
    }
  }

  // A BME280 breakout lying flat, its four pins in one row and the board over the holes beside them.
  drawSensor(p, g) {
    const x0 = p.col - 1, y = ROW_Y[p.row];
    this.rect(x0 - 0.6, y - 0.45, x0 + 3.6, y + 3.6, { rx: P * 0.3, class: 'sensor-pcb' }, g);
    this.rect(x0 + 1.05, y + 1.35, x0 + 1.95, y + 2.25, { rx: P * 0.06, class: 'sensor-chip' }, g);
    const [hx, hy] = this.pt(x0 + 1.5, y + 1.8);
    el('circle', { cx: hx, cy: hy, r: P * 0.12, class: 'sensor-vent' }, g);
    this.text(x0 + 1.5, y + 3.0, 'BME280', { class: 'sensor-name' }, g);
    for (const q of sensorPins(p.col, p.row)) {
      const h = hole(q.hole);
      const [cx, cy] = this.pt(h.x, h.y);
      el('circle', { cx, cy, r: P * 0.24, class: 'xiao-pad' }, g);
      this.text(h.x, h.y + 0.78, q.name, { class: 'xiao-pin' }, g);
    }
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
