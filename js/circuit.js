// Does the LED light? A small, honest check of a breadboard circuit.
//
// Every strip of holes is a node. Wires and battery leads join two nodes with nothing in between,
// resistors join them both ways, and an LED only lets current through from its long leg (+) to its
// short leg (−). We look for every loop that leaves the battery's + and comes back to its −.
// In level 2 the XIAO is the power instead: its 3V3 and 5V pins are always on, and D10 is on
// when the code sets it HIGH. All three come back to its GND pin.

import { hole, netOf, BATTERY, xiaoPins, sensorPins, oledPins, soilPins } from './board.js';

const MAX_PATHS = 400;

// parts: [{ type: 'battery' } | { type: 'wire' | 'resistor' | 'led', a, b }]
// For an LED, a is the long leg (+) and b the short leg (−).
export function edgesOf(parts) {
  const edges = [];
  parts.forEach((p, i) => {
    if (p.type === 'battery') {
      edges.push({ part: i, kind: 'lead', a: 'BAT+', b: BATTERY.plus });
      edges.push({ part: i, kind: 'lead', a: 'BAT-', b: BATTERY.minus });
    } else if (p.type === 'oled') {
      for (const q of oledPins(p)) edges.push({ part: i, kind: 'lead', a: q.hole, b: q.lead });
    } else if (p.type === 'soil') {
      for (const q of soilPins(p)) edges.push({ part: i, kind: 'lead', a: q.hole, b: q.lead });
    } else if (p.type === 'wire' || p.type === 'resistor' || p.type === 'led') {
      edges.push({ part: i, kind: p.type, a: p.a, b: p.b });
    }
  });
  for (const e of edges) { e.na = netOf(e.a); e.nb = netOf(e.b); }
  return edges;
}

// Every simple path from one strip to another (the battery's + to its −, unless told otherwise),
// as a list of steps { edge, from, to } (hole ids).
export function loops(edges, flip = -1, start = 'bat+', end = 'bat-') {
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
  const seen = new Set([start]);
  const path = [];
  (function walk(net) {
    if (out.length >= MAX_PATHS) return;
    if (net === end) { out.push(path.slice()); return; }
    for (const step of adj.get(net) || []) {
      if (seen.has(step.next)) continue;
      seen.add(step.next); path.push(step);
      walk(step.next);
      path.pop(); seen.delete(step.next);
    }
  })(start);
  return out;
}

const isWire = e => e.kind === 'wire' || e.kind === 'lead';

// Where power comes from: { name, from, to } with from/to the holes at its + and − ends.
export function supplies(parts, { high = false } = {}) {
  const out = [];
  if (parts.some(p => p.type === 'battery')) out.push({ name: 'battery', from: 'BAT+', to: 'BAT-', on: true });
  const x = parts.find(p => p.type === 'xiao');
  if (x) {
    const pin = Object.fromEntries(xiaoPins(x.col).map(q => [q.name, q.hole]));
    out.push({ name: '3V3', from: pin['3V3'], to: pin.GND, on: true });
    out.push({ name: '5V', from: pin['5V'], to: pin.GND, on: true });
    out.push({ name: 'D10', from: pin.D10, to: pin.GND, on: high });
  }
  return out;
}

// What happens when you switch it on.
//   short:   + is joined straight to − with wires only; the supply gets hot and nothing lights.
//   leds:    one entry per LED: { part, state: 'lit' | 'burned' | 'off', why, by }
//            why for an LED that's off: 'same-strip', 'backwards', 'open', 'shorted', 'low' (its pin is LOW)
//            by: the supplies lighting it ('battery', '3V3', 'D10' ...)
//   flow:    the steps of one loop to draw current along, from the hole flowFrom to flowTo
// opts.high: whether the XIAO's D10 pin is HIGH.
export function analyze(parts, opts = {}) {
  const edges = edgesOf(parts);
  const all = supplies(parts, { high: true });
  const live = new Set(supplies(parts, opts).filter(q => q.on).map(q => q.name));
  const tagged = (flip = -1) => all.flatMap(q => loops(edges, flip, netOf(q.from), netOf(q.to)).map(path => Object.assign(path, { supply: q })));
  const every = tagged();
  const paths = every.filter(p => live.has(p.supply.name));
  const short = every.some(p => p.supply.name !== 'D10' && p.every(s => isWire(s.edge)));
  const leds = [];
  edges.forEach((e, k) => {
    if (e.kind !== 'led') return;
    const through = paths.filter(p => p.some(s => s.edge === e));
    let state = 'off', why = null;
    if (!all.length) why = 'open';
    else if (e.na === e.nb) why = 'same-strip';
    else if (short) why = 'shorted';
    else if (through.length) {
      state = through.some(p => !p.some(s => s.edge.kind === 'resistor')) ? 'burned' : 'lit';
    } else if (every.some(p => p.some(s => s.edge === e))) why = 'low';
    else if (tagged(k).some(p => p.some(s => s.edge === e))) why = 'backwards';
    else why = 'open';
    leds.push({ part: e.part, state, why, by: [...new Set(through.map(p => p.supply.name))] });
  });
  let flow = null;
  if (!short) {
    flow = paths.find(p => p.some(s => s.edge.kind === 'led' && leds.find(l => l.part === s.edge.part)?.state === 'lit'))
      || paths.find(p => p.some(s => s.edge.kind === 'resistor')) || null;
  }
  return { short, leds, flow, flowFrom: flow?.supply.from, flowTo: flow?.supply.to, paths: paths.length };
}

// Which of the XIAO's pins each of a device's pins is wired to: { VIN: ['3V3'], GND: ['GND'], SCL: ['D5'], SDA: ['D4'] }.
// Wires join strips; resistors and LEDs don't count, because a signal or power through them isn't a connection.
export function sensorWiring(parts, type = 'sensor') {
  const x = parts.find(p => p.type === 'xiao'), device = parts.find(p => p.type === type);
  if (!x || !device) return null;
  const up = new Map();
  const find = n => { while (up.has(n)) n = up.get(n); return n; };
  for (const e of edgesOf(parts)) if (isWire(e)) { const a = find(e.na), b = find(e.nb); if (a !== b) up.set(a, b); }
  const pinsOn = new Map();
  for (const q of xiaoPins(x.col)) {
    const n = find(netOf(q.hole));
    if (!pinsOn.has(n)) pinsOn.set(n, []);
    pinsOn.get(n).push(q.name);
  }
  const pins = type === 'oled' ? oledPins(device) : type === 'soil' ? [...soilPins(device), ...['GND', 'VCC', 'AOUT'].filter(n => !device.leads[n]).map(name => ({ name, hole: 'SOIL-' + name }))] : sensorPins(device.col, device.row);
  return Object.fromEntries(pins.map(q => [q.name, pinsOn.get(find(netOf(q.hole))) || []]));
}

// Does the sensor answer? Each of its four pins, checked: { ok, items: [{ pin, ok, warn, say }] }
export function sensorStatus(parts) {
  const w = sensorWiring(parts);
  if (!w) return null;
  const items = [];
  const has = (pin, name) => w[pin].includes(name);
  if (has('VIN', 'GND')) items.push({ pin: 'VIN', ok: false, say: 'VIN is joined to GND, so the sensor gets no power.' });
  else if (has('VIN', '3V3')) items.push({ pin: 'VIN', ok: true, say: 'VIN gets 3.3 V from the XIAO.' });
  else if (has('VIN', '5V')) items.push({ pin: 'VIN', ok: true, warn: true, say: 'VIN is on 5 V. Some boards cope, but the BME280 chip itself runs on 3.3 V. Use 3V3.' });
  else items.push({ pin: 'VIN', ok: false, say: 'VIN isn’t connected to the XIAO’s 3V3, so the sensor has no power.' });
  if (has('GND', 'GND')) items.push({ pin: 'GND', ok: true, say: 'GND shares the XIAO’s ground.' });
  else items.push({ pin: 'GND', ok: false, say: 'GND isn’t connected to the XIAO’s GND. Without a shared ground there’s no loop for power or signals.' });
  for (const [pin, want, other] of [['SDA', 'D4', 'D5'], ['SCL', 'D5', 'D4']]) {
    if (has(pin, want)) items.push({ pin, ok: true, say: `${pin} goes to ${want}.` });
    else if (has(pin, other)) items.push({ pin, ok: false, say: `${pin} goes to ${other}: SDA and SCL are swapped.` });
    else items.push({ pin, ok: false, say: `${pin} isn’t connected to ${want}.` });
  }
  return { ok: items.every(i => i.ok), items, wiring: w };
}

// Does the screen answer? Its four leads, checked the same way: { ok, items: [{ pin, ok, say }] }
export function screenStatus(parts) {
  const w = sensorWiring(parts, 'oled');
  if (!w) return null;
  const has = (pin, name) => w[pin].includes(name);
  const items = [];
  if (has('VCC', 'GND') && (has('GND', '3V3') || has('GND', '5V'))) {
    items.push({ pin: 'VCC', ok: false, danger: true, say: 'VCC and GND are swapped: the screen gets power backwards, which can kill it for good.' });
    items.push({ pin: 'GND', ok: false, danger: true, say: 'GND is on + and VCC on −. Follow the labels on the screen, not the order on the sensor.' });
  } else {
    if (has('VCC', '3V3')) items.push({ pin: 'VCC', ok: true, say: 'VCC gets 3.3 V.' });
    else if (has('VCC', '5V')) items.push({ pin: 'VCC', ok: true, warn: true, say: 'VCC is on 5 V. Most of these screens cope, but 3V3 keeps the signals at the XIAO’s level.' });
    else items.push({ pin: 'VCC', ok: false, say: 'VCC isn’t connected to 3V3, so the screen has no power.' });
    if (has('GND', 'GND')) items.push({ pin: 'GND', ok: true, say: 'GND shares the XIAO’s ground.' });
    else items.push({ pin: 'GND', ok: false, say: 'GND isn’t connected to the XIAO’s GND.' });
  }
  for (const [pin, want, other] of [['SDA', 'D4', 'D5'], ['SCL', 'D5', 'D4']]) {
    if (has(pin, want)) items.push({ pin, ok: true, say: `The screen’s ${pin} reaches ${want}.` });
    else if (has(pin, other)) items.push({ pin, ok: false, say: `The screen’s ${pin} reaches ${other}: SDA and SCL are swapped.` });
    else items.push({ pin, ok: false, say: `The screen’s ${pin} isn’t connected to ${want}.` });
  }
  return { ok: items.every(i => i.ok), items, wiring: w };
}

// Is the soil sensor powered, and is AOUT on a pin that can measure it? { ok, items: [{ pin, ok, warn, say }], aout }
// aout: the XIAO pin AOUT reaches ('D1' ...), or null when it reaches none.
export function soilStatus(parts) {
  const w = sensorWiring(parts, 'soil');
  if (!w) return null;
  const has = (pin, name) => w[pin].includes(name);
  const items = [];
  if (has('VCC', 'GND')) items.push({ pin: 'VCC', ok: false, say: 'VCC is joined to GND: the sensor gets no power.' });
  else if (has('VCC', '3V3')) items.push({ pin: 'VCC', ok: true, say: 'VCC gets 3.3 V.' });
  else if (has('VCC', '5V')) items.push({ pin: 'VCC', ok: true, warn: true, say: 'VCC is on 5 V. The v1.2 has its own regulator, so it copes, but 3V3 is simpler and safe.' });
  else items.push({ pin: 'VCC', ok: false, say: 'VCC isn’t connected to 3V3, so the sensor is off.' });
  if (has('GND', 'GND')) items.push({ pin: 'GND', ok: true, say: 'GND shares the XIAO’s ground.' });
  else items.push({ pin: 'GND', ok: false, say: 'GND isn’t connected to the XIAO’s GND.' });
  const aout = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'].find(n => has('AOUT', n)) || null;
  const say = {
    D1: ['ok', 'AOUT goes to D1 (A1): an analog pin with no other job.'],
    D2: ['ok', 'AOUT goes to D2 (A2), an analog pin. Change SOIL_PIN to A2 in the code.'],
    D0: ['warn', 'AOUT goes to D0 (A0). It measures, but D0 is checked by the chip at power-up, so D1 is a safer choice.'],
    D3: ['warn', 'AOUT goes to D3. It’s on the second analog converter, which stops working while Wi-Fi is on. Use D1.'],
  }[aout] || [false, aout ? `AOUT goes to ${aout}, which can’t measure a voltage. Move it to D1.` : 'AOUT isn’t connected to any XIAO pin.'];
  items.push({ pin: 'AOUT', ok: !!say[0], warn: say[0] === 'warn', say: say[1] });
  return { ok: items.every(i => i.ok), items, aout, wiring: w };
}

// The wires a signal takes from one hole to another, as loop steps, or null if they aren't joined by wires.
export function wireRoute(parts, from, to) {
  const edges = edgesOf(parts).filter(isWire);
  return loops(edges, -1, netOf(from), netOf(to))[0] || (netOf(from) === netOf(to) ? [] : null);
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
