// The circuit check, without a browser:  node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, flowPoints } from '../js/circuit.js';
import { connected, netHoles, holeNear, HOLES } from '../js/board.js';

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
