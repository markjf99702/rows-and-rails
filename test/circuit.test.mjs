// The circuit check, without a browser:  node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, flowPoints } from '../js/circuit.js';
import { connected, netHoles, holeNear, holeToward, HOLES } from '../js/board.js';

const battery = { type: 'battery' };
const good = [
  battery,
  { type: 'resistor', a: 'T+12', b: 'a12' },
  { type: 'led', a: 'c12', b: 'c13' },
  { type: 'wire', a: 'a13', b: 'T-14' },
];
const state = parts => analyze(parts).leds.map(l => l.state + (l.why ? ':' + l.why : '')).join();

test('the board has the right number of holes and strips', () => {
  assert.equal(HOLES.length, 300 + 4 * 25);
  assert.equal(netHoles('12ae').length, 5);
  assert.equal(netHoles('T+').length, 25);
  assert.ok(connected('a12', 'e12'));
  assert.ok(!connected('e12', 'f12'), 'the middle gap splits a row');
  assert.ok(!connected('a12', 'a13'));
  assert.ok(!connected('T+2', 'B+2'), 'top and bottom rails are separate');
  assert.equal(holeNear(11.2, 4.9).id, 'c12');
  assert.equal(holeNear(11.5, 8.5), null, 'nothing in the gap');
});

test('the arrow keys step from hole to hole', () => {
  assert.equal(holeToward('c12', 1, 0), 'c13', 'along the row numbers');
  assert.equal(holeToward('c12', 0, 1), 'd12', 'across, a to j');
  assert.equal(holeToward('e12', 0, 1), 'f12', 'over the middle gap');
  assert.equal(holeToward('a12', 0, -1), 'T-12', 'out onto the rails');
  assert.equal(holeToward('T-6', 1, 0), 'T-8', 'along a rail, over the skipped hole between groups of five');
  assert.equal(holeToward('a7', 0, -1), 'T-6', 'to the nearest rail hole where none lines up');
  assert.equal(holeToward('B+17', 0, -1), 'B-17');
  assert.equal(holeToward('a30', 1, 0), null, 'nothing past the end');
  assert.equal(holeToward('T+2', 0, -1), null, 'or past the edge');
  // From any hole, every way that has holes leads to one, and back again comes home on the main rows.
  for (const h of HOLES) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const to = holeToward(h.id, dx, dy);
    if (HOLES.some(q => (q.x - h.x) * dx + (q.y - h.y) * dy > 0)) assert.ok(to, `${h.id} stuck going ${dx},${dy}`);
    if (h.kind === 'main' && to && dx) assert.equal(holeToward(to, -dx, -dy), h.id, `${h.id} and back`);
  }
});

test('the lesson circuit lights', () => {
  const r = analyze(good);
  assert.equal(state(good), 'lit');
  assert.equal(r.short, false);
  const pts = flowPoints(r.flow);
  assert.deepEqual(pts[0], [1, -2.15]);
  assert.deepEqual(pts.at(-1), [3, -2.15]);
});

test('the usual mistakes', () => {
  const swap = (i, p) => good.map((q, k) => (k === i ? p : q));
  assert.equal(state(swap(2, { type: 'led', a: 'c13', b: 'c12' })), 'off:backwards');
  assert.equal(state(swap(2, { type: 'led', a: 'b12', b: 'd12' })), 'off:same-strip');
  assert.equal(state(swap(3, { type: 'wire', a: 'h13', b: 'B-14' })), 'off:open');
  assert.equal(state(swap(1, { type: 'wire', a: 'T+12', b: 'a12' })), 'burned');
  assert.equal(state(swap(3, { type: 'wire', a: 'a13', b: 'B-14' })), 'off:open', 'the bottom rail is not powered');
  assert.equal(state(good.slice(1)), 'off:open', 'no battery');
});

test('a wire from + to − is a short', () => {
  const r = analyze([...good, { type: 'wire', a: 'T+20', b: 'T-20' }]);
  assert.equal(r.short, true);
  assert.equal(state([...good, { type: 'wire', a: 'T+20', b: 'T-20' }]), 'off:shorted');
});

test('bridging to the bottom rails works', () => {
  const parts = [battery,
    { type: 'wire', a: 'T+30', b: 'B+30' }, { type: 'wire', a: 'T-29', b: 'B-29' },
    { type: 'resistor', a: 'B+20', b: 'j20' }, { type: 'led', a: 'h20', b: 'h21' }, { type: 'wire', a: 'j21', b: 'B-21' }];
  assert.equal(state(parts), 'lit');
});

test('two LEDs in a row both light', () => {
  const parts = [battery, { type: 'resistor', a: 'T+12', b: 'a12' }, { type: 'led', a: 'c12', b: 'c13' },
    { type: 'led', a: 'd13', b: 'd14' }, { type: 'wire', a: 'a14', b: 'T-15' }];
  assert.equal(state(parts), 'lit,lit');
});

// ----- Level 2 -----
import { sensorStatus } from '../js/circuit.js';
const xiao = { type: 'xiao', col: 2 }, bme = { type: 'sensor', col: 17, row: 'h' };
const L2 = [xiao, bme,
  { type: 'wire', a: 'a4', b: 'T+4' }, { type: 'wire', a: 'a3', b: 'T-3' },
  { type: 'wire', a: 'f17', b: 'T+17' }, { type: 'wire', a: 'f18', b: 'T-18' },
  { type: 'wire', a: 'g19', b: 'j7' }, { type: 'wire', a: 'f20', b: 'i6' },
  { type: 'resistor', a: 'b5', b: 'b10' }, { type: 'led', a: 'd10', b: 'd11' }, { type: 'wire', a: 'a11', b: 'T-12' }];
const swap2 = (i, p) => L2.map((q, k) => (k === i ? p : q));

test('the XIAO circuit: the sensor answers and D10 lights the LED', () => {
  assert.equal(sensorStatus(L2).ok, true);
  assert.equal(analyze(L2, { high: true }).leds[0].state, 'lit');
  assert.deepEqual(analyze(L2, { high: true }).leds[0].by, ['D10']);
  const low = analyze(L2, { high: false }).leds[0];
  assert.equal(low.state + ':' + low.why, 'off:low');
  assert.equal(analyze(L2, { high: true }).flowFrom, 'd5');
});

test('XIAO mistakes', () => {
  const swapped = sensorStatus(swap2(6, { type: 'wire', a: 'g19', b: 'i6' }).map((q, k) => (k === 7 ? { type: 'wire', a: 'f20', b: 'j7' } : q)));
  assert.equal(swapped.ok, false);
  assert.match(swapped.items.find(i => i.pin === 'SDA').say, /swapped/);
  const fiveVolt = sensorStatus(swap2(2, { type: 'wire', a: 'a2', b: 'T+2' }));
  assert.equal(fiveVolt.items[0].warn, true);
  assert.equal(sensorStatus(L2.filter((_, k) => k !== 5)).items.find(i => i.pin === 'GND').ok, false);
  assert.equal(sensorStatus(swap2(4, { type: 'wire', a: 'f17', b: 'B+17' })).items[0].ok, false, 'the bottom rail isn’t powered');
  assert.equal(analyze(swap2(8, { type: 'wire', a: 'b5', b: 'b10' }), { high: true }).leds[0].state, 'burned');
  assert.equal(analyze(swap2(8, { type: 'resistor', a: 'b6', b: 'b10' }), { high: true }).leds[0].state, 'off', 'D9 isn’t what the code switches');
  assert.equal(analyze([...L2, { type: 'wire', a: 'T+20', b: 'T-20' }], { high: true }).short, true);
});

// ----- Level 3 -----
import { screenStatus } from '../js/circuit.js';
const oled = { type: 'oled', leads: { GND: 'T-20', VCC: 'T+21', SCL: 'a22', SDA: 'a23' } };
const L3 = [...L2, oled, { type: 'wire', a: 'e22', b: 'f19' }, { type: 'wire', a: 'e23', b: 'g20' }];

test('the screen shares the bus with the sensor', () => {
  assert.equal(screenStatus(L3).ok, true);
  assert.equal(sensorStatus(L3).ok, true);
  assert.equal(analyze(L3, { high: true }).short, false);
  assert.equal(analyze(L3, { high: true }).leds[0].state, 'lit');
});

test('screen mistakes', () => {
  const swappedPower = L3.map(q => (q === oled ? { ...oled, leads: { ...oled.leads, GND: 'T+21', VCC: 'T-20' } } : q));
  assert.equal(screenStatus(swappedPower).items[0].danger, true);
  assert.equal(analyze(swappedPower, { high: true }).short, false, 'backwards power is not a short');
  const noJumper = L3.slice(0, -1);
  assert.equal(screenStatus(noJumper).items.find(i => i.pin === 'SDA').ok, false);
  assert.equal(sensorStatus(noJumper).ok, true, 'the sensor still works');
  const crossed = [...L3.slice(0, -2), { type: 'wire', a: 'e22', b: 'g20' }, { type: 'wire', a: 'e23', b: 'f19' }];
  assert.match(screenStatus(crossed).items.find(i => i.pin === 'SDA').say, /swapped/);
});

// ----- Level 5 -----
import { soilStatus } from '../js/circuit.js';
const soil = { type: 'soil', leads: { GND: 'T-17', VCC: 'T+18', AOUT: 'j3' } };
const L5 = [xiao, { type: 'wire', a: 'a4', b: 'T+4' }, { type: 'wire', a: 'a3', b: 'T-3' }, soil];

test('the soil sensor: powered from 3V3, AOUT on D1', () => {
  const st = soilStatus(L5);
  assert.equal(st.ok, true);
  assert.equal(st.aout, 'D1');
});

test('soil sensor mistakes', () => {
  const withLeads = leads => L5.map(q => (q === soil ? { ...soil, leads: { ...soil.leads, ...leads } } : q));
  assert.equal(soilStatus(withLeads({ AOUT: 'j5' })).items[2].warn, true, 'D3 works but is on ADC2');
  assert.equal(soilStatus(withLeads({ AOUT: 'j9' })).aout, null, 'row 9 is no pin at all');
  assert.equal(soilStatus(withLeads({ VCC: 'B+18' })).items[0].ok, false, 'the bottom rail is not powered');
  assert.equal(soilStatus(L5.filter((_, k) => k !== 2)).items[1].ok, false, 'no ground wire to the rail');
  assert.equal(soilStatus(withLeads({ AOUT: 'j8' })).ok, false, 'D6 can’t measure');
});

// ----- The loop search -----
import { loops, edgesOf } from '../js/circuit.js';

// Every simple path, tried in full: the search before it learned to skip dead ends.
function everyPath(edges, flip = -1, start = 'bat+', end = 'bat-') {
  const adj = new Map();
  const add = (n, step) => { if (!adj.has(n)) adj.set(n, []); adj.get(n).push(step); };
  edges.forEach((e, k) => {
    if (e.na === e.nb) return;
    if (e.kind === 'led' ? k !== flip : true) add(e.na, { edge: e, from: e.a, to: e.b, next: e.nb });
    if (e.kind === 'led' ? k === flip : true) add(e.nb, { edge: e, from: e.b, to: e.a, next: e.na });
  });
  const out = [], seen = new Set([start]), path = [];
  (function walk(net) {
    if (out.length >= 400) return;
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

test('skipping dead ends finds the same loops, in the same order, as trying every path', () => {
  let seed = 12345;
  const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 2147483648 * n); };
  const near = HOLES.filter(h => h.x < 4); // the first four rows, so the parts join up into tangles
  const key = paths => JSON.stringify(paths.map(p => p.map(s => [s.edge.part, s.from, s.to])));
  const same = (parts, label) => {
    const edges = edgesOf(parts);
    const nets = [...new Set(edges.flatMap(e => [e.na, e.nb]))];
    let n = 0;
    for (const [flip, start, end] of [[-1, 'bat+', 'bat-'], [rand(edges.length), 'bat+', 'bat-'], [-1, nets[rand(nets.length)], nets[rand(nets.length)]]]) {
      const want = everyPath(edges, flip, start, end);
      n += want.length;
      assert.equal(key(loops(edges, flip, start, end)), key(want), label);
    }
    return n;
  };
  let found = 0;
  for (let k = 0; k < 400; k++) {
    const parts = [battery];
    for (let n = 6 + rand(18); n > 0; n--) parts.push({ type: ['wire', 'resistor', 'led', 'wire'][rand(4)], a: near[rand(near.length)].id, b: near[rand(near.length)].id });
    found += same(parts, `circuit ${k}`);
  }
  assert.ok(found > 3000, `only ${found} loops to compare`);
  // More loops than it keeps (400): it stops at the same ones.
  // Eight resistors from + to row 8, eight wires on to row 9, eight resistors from there to −, and a dead end off row 8.
  const many = [battery];
  for (let i = 0; i < 8; i++) many.push({ type: 'resistor', a: 'T+8', b: 'a8' }, { type: 'wire', a: 'b8', b: 'b9' }, { type: 'resistor', a: 'c9', b: 'T-10' });
  many.push({ type: 'wire', a: 'd8', b: 'f8' }, { type: 'wire', a: 'g8', b: 'g9' }, { type: 'resistor', a: 'h9', b: 'h10' }, { type: 'wire', a: 'i10', b: 'i8' });
  assert.ok(same(many, 'many loops') >= 400);
});

test('a big tangle of wires that goes nowhere is still quick to check', () => {
  // Rows 5 to 18 joined down both halves and across the gap twice in every row: 56 parts, fed from + with no way back.
  const parts = [battery, { type: 'wire', a: 'T+5', b: 'a5' }];
  for (let r = 5; r <= 18; r++) {
    if (r < 18) parts.push({ type: 'resistor', a: 'b' + r, b: 'b' + (r + 1) }, { type: 'wire', a: 'g' + r, b: 'g' + (r + 1) });
    parts.push({ type: 'wire', a: 'c' + r, b: 'h' + r }, { type: 'resistor', a: 'd' + r, b: 'i' + r });
  }
  const t0 = performance.now();
  const r = analyze([...parts, { type: 'led', a: 'c20', b: 'c21' }]);
  assert.ok(performance.now() - t0 < 300, `took ${Math.round(performance.now() - t0)} ms`);
  assert.equal(r.leds[0].state + ':' + r.leds[0].why, 'off:open');
});
