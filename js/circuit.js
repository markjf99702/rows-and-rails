// Does the LED light? A small, honest check of a breadboard circuit.
//
// Every strip of holes is a node. Wires and battery leads join two nodes with nothing in between,
// resistors join them both ways, and an LED only lets current through from its long leg (+) to its
// short leg (−). We look for every loop that leaves the battery's + and comes back to its −.

import { hole, netOf, BATTERY } from './board.js';

const MAX_PATHS = 400;

// parts: [{ type: 'battery' } | { type: 'wire' | 'resistor' | 'led', a, b }]
// For an LED, a is the long leg (+) and b the short leg (−).
export function edgesOf(parts) {
  const edges = [];
  parts.forEach((p, i) => {
    if (p.type === 'battery') {
      edges.push({ part: i, kind: 'lead', a: 'BAT+', b: BATTERY.plus });
      edges.push({ part: i, kind: 'lead', a: 'BAT-', b: BATTERY.minus });
    } else if (p.type === 'wire' || p.type === 'resistor' || p.type === 'led') {
      edges.push({ part: i, kind: p.type, a: p.a, b: p.b });
    }
  });
  for (const e of edges) { e.na = netOf(e.a); e.nb = netOf(e.b); }
  return edges;
}

// Every simple path from the battery's + to its −, as a list of steps { edge, from, to } (hole ids).
export function loops(edges, flip = -1) {
  const adj = new Map();
  const add = (n, step) => { if (!adj.has(n)) adj.set(n, []); adj.get(n).push(step); };
  edges.forEach((e, k) => {
    if (e.na === e.nb) return; // both ends on the same strip: current goes around it
    const forward = e.kind === 'led' ? k !== flip : true;
    const backward = e.kind === 'led' ? k === flip : true;
    if (forward) add(e.na, { edge: e, from: e.a, to: e.b, next: e.nb });
    if (backward) add(e.nb, { edge: e, from: e.b, to: e.a, next: e.na });
  });
  const out = [];
  const seen = new Set(['bat+']);
  const path = [];
  (function walk(net) {
    if (out.length >= MAX_PATHS) return;
    if (net === 'bat-') { out.push(path.slice()); return; }
    for (const step of adj.get(net) || []) {
      if (seen.has(step.next)) continue;
      seen.add(step.next); path.push(step);
      walk(step.next);
      path.pop(); seen.delete(step.next);
    }
  })('bat+');
  return out;
}

const isWire = e => e.kind === 'wire' || e.kind === 'lead';

// What happens when you switch it on.
//   short:   + is joined straight to − with wires only; the battery gets hot and nothing lights.
//   leds:    one entry per LED: { part, state: 'lit' | 'burned' | 'off', why }
//            why for an LED that's off: 'same-strip', 'backwards', 'open', 'shorted'
//   flow:    the steps of one loop to draw current along (through a lit LED when there is one)
export function analyze(parts) {
  const hasBattery = parts.some(p => p.type === 'battery');
  const edges = edgesOf(parts);
  const paths = hasBattery ? loops(edges) : [];
  const short = paths.some(p => p.every(s => isWire(s.edge)));
  const leds = [];
  edges.forEach((e, k) => {
    if (e.kind !== 'led') return;
    const through = paths.filter(p => p.some(s => s.edge === e));
    let state = 'off', why = null;
    if (!hasBattery) why = 'open';
    else if (e.na === e.nb) why = 'same-strip';
    else if (short) why = 'shorted';
    else if (through.length) {
      state = through.some(p => !p.some(s => s.edge.kind === 'resistor')) ? 'burned' : 'lit';
    } else if (loops(edges, k).some(p => p.some(s => s.edge === e))) why = 'backwards';
    else why = 'open';
    leds.push({ part: e.part, state, why });
  });
  let flow = null;
  if (!short) {
    flow = paths.find(p => p.some(s => s.edge.kind === 'led' && leds.find(l => l.part === s.edge.part)?.state === 'lit'))
      || paths.find(p => p.some(s => s.edge.kind === 'resistor')) || null;
  }
  return { short, leds, flow, paths: paths.length };
}

// The points current passes through for one loop, in board coordinates.
// Between parts it runs along the strip they share, which is always a straight line.
export function flowPoints(flow) {
  if (!flow) return [];
  const pts = [];
  const push = id => { const h = hole(id); pts.push([h.x, h.y]); };
  push('BAT+');
  for (const s of flow) { push(s.from); push(s.to); }
  push('BAT-');
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}
