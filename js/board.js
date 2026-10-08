// The board itself: where every hole is, and which holes share a metal clip underneath.
// Pure data, no DOM, so the tests can use it too.
//
// Board coordinates are in "pitch" units (one hole spacing, 0.1 inch on a real board):
//   x runs along the board, 0..29 for the numbered rows 1..30.
//   y runs across it: the top rails, rows a–e, the middle gap, rows f–j, the bottom rails.

export const COLS = 30;
export const LETTERS = 'abcdefghij';
export const ROW_Y = { a: 3, b: 4, c: 5, d: 6, e: 7, f: 10, g: 11, h: 12, i: 13, j: 14 };
export const RAILS = { 'T+': 0, 'T-': 1, 'B-': 16, 'B+': 17 };
// The rails have holes in groups of five, with a skipped hole between groups.
export const RAIL_X = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29];
// The battery pack sits off the edge of the board; its leads are ordinary wires.
export const BATTERY = { 'BAT+': { x: 1, y: -2.15 }, 'BAT-': { x: 3, y: -2.15 }, plus: 'T+2', minus: 'T-4' };

export const EXTENT = { x0: -1.9, x1: 30.9, y0: -4.9, y1: 18.5 };

const holes = new Map();
for (let x = 0; x < COLS; x++) {
  for (const l of LETTERS) {
    const id = l + (x + 1);
    holes.set(id, { id, x, y: ROW_Y[l], kind: 'main', net: (x + 1) + (ROW_Y[l] < 8 ? 'ae' : 'fj') });
  }
}
for (const [rail, y] of Object.entries(RAILS)) {
  for (const x of RAIL_X) {
    const id = rail + (x + 1);
    holes.set(id, { id, x, y, kind: 'rail', net: rail });
  }
}
for (const t of ['BAT+', 'BAT-']) holes.set(t, { id: t, ...BATTERY[t], kind: 'battery', net: t.toLowerCase() });

export const HOLES = [...holes.values()].filter(h => h.kind !== 'battery');

export function hole(id) {
  const h = holes.get(id);
  if (!h) throw new Error('no such hole: ' + id);
  return h;
}

export const netOf = id => hole(id).net;

const byNet = new Map();
for (const h of HOLES) {
  if (!byNet.has(h.net)) byNet.set(h.net, []);
  byNet.get(h.net).push(h);
}
export const netHoles = net => byNet.get(net) || [];

export const connected = (a, b) => netOf(a) === netOf(b);

// The nearest hole to a point in board coordinates, if one is close enough.
export function holeNear(x, y, reach = 0.75) {
  let best = null, bestD = reach * reach;
  for (const h of HOLES) {
    const d = (h.x - x) ** 2 + (h.y - y) ** 2;
    if (d < bestD) { best = h; bestD = d; }
  }
  return best;
}

// The rails are at the top and bottom when the board lies on its side, and on the left and right
// when it stands up on a phone. Everything that names them asks here.
let SIDES = { T: 'top', B: 'bottom' };
export function setSides(orient) { SIDES = orient === 'v' ? { T: 'left', B: 'right' } : { T: 'top', B: 'bottom' }; }
export const side = k => SIDES[k];
// "{T}" and "{B}" in lesson text become the right words for the way the board is showing.
export const sided = s => s.replace(/\{T\}/g, SIDES.T).replace(/\{B\}/g, SIDES.B).replace(/\{Tc\}/g, cap(SIDES.T)).replace(/\{Bc\}/g, cap(SIDES.B));

const railName = net => `the ${SIDES[net[0]]} ${net[1] === '+' ? '+' : '−'} rail`;
const isRail = net => /^[TB][+-]$/.test(net);

export function describeNet(net) {
  if (isRail(net)) return railName(net);
  if (net === 'bat+' || net === 'bat-') return 'the battery';
  const m = /^(\d+)(ae|fj)$/.exec(net);
  return `row ${m[1]}, holes ${m[2] === 'ae' ? 'a–e' : 'f–j'}`;
}

export function describeHole(id) {
  const h = hole(id);
  if (h.kind === 'rail') return `${railName(h.net).slice(4)}, hole ${RAIL_X.indexOf(h.x) + 1}`;
  return id;
}

export function cap(s) { return s[0].toUpperCase() + s.slice(1); }
