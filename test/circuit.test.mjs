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
