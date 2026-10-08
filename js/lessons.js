// The walk-through: what the board shows at each step and what the panel says.

// focus: the part of the board a step zooms to on a small screen, as [x0, y0, x1, y1] in board coordinates.
const NEAR_BATTERY = [-1.6, -4.9, 16, 9.2];

const battery = { type: 'battery' };
const resistor = { type: 'resistor', a: 'T+12', b: 'a12' };
const led = { type: 'led', a: 'c12', b: 'c13' };
const ground = { type: 'wire', a: 'a13', b: 'T-14', color: 'black' };
export const LED_CIRCUIT = [battery, resistor, led, ground];

const art = {
  clip: `<svg class="art" viewBox="0 -18 240 128" role="img" aria-label="A cut-away side view: five holes in the plastic sit over one metal clip. A wire end and an LED leg pushed into two of the holes are both gripped by the same clip.">
    <rect x="8" y="8" width="224" height="86" rx="6" class="a-plastic"/>
    ${[40, 80, 120, 160, 200].map(x => `<rect x="${x - 6}" y="8" width="12" height="34" class="a-hole"/>`).join('')}
    <path d="M26 82H214" class="a-metal" stroke-width="7"/>
    ${[40, 80, 120, 160, 200].map(x => `<path d="M${x - 9} 82L${x - 3} 46M${x + 9} 82L${x + 3} 46" class="a-metal" stroke-width="4"/>`).join('')}
    <rect x="77" y="-6" width="6" height="66" rx="2" class="a-leg"/><rect x="74" y="-18" width="12" height="20" rx="3" fill="#2f9e57"/>
    <rect x="158" y="-14" width="4" height="72" rx="2" class="a-leg"/>
    <text x="120" y="106" class="a-text">one metal clip joins all five holes</text>
  </svg>`,
  led: `<svg class="art" viewBox="0 0 240 132" role="img" aria-label="An LED from the side: the long leg is + and goes toward the battery's +; the short leg is −, on the side where the rim is flat.">
    <path d="M90 64V36a30 30 0 0 1 60 0v28z" fill="#e0454b" opacity=".9"/>
    <path d="M84 64h66v9H84z" fill="#c5363c"/><path d="M150 64h4v9h-4z" class="a-flat"/>
    <path d="M108 73v52M132 73v34" class="a-wire"/>
    <text x="98" y="122" class="a-text end">long leg  +</text>
    <text x="142" y="104" class="a-text start">−  short leg</text>
    <text x="160" y="58" class="a-text start">flat edge on −</text>
  </svg>`,
  resistor: `<svg class="art" viewBox="0 0 240 70" role="img" aria-label="A resistor with bands orange, orange, brown and gold: 3, 3, times 10, which is 330 ohms.">
    <path d="M6 26h228" class="a-wire"/>
    <rect x="62" y="12" width="116" height="28" rx="12" fill="#e2c595"/>
    <rect x="80" y="12" width="9" height="28" fill="#e8771e"/><rect x="98" y="12" width="9" height="28" fill="#e8771e"/>
    <rect x="116" y="12" width="9" height="28" fill="#7a4a21"/><rect x="154" y="12" width="9" height="28" fill="#c9a13b"/>
    <text x="84" y="58" class="a-text">3</text><text x="102" y="58" class="a-text">3</text><text x="120" y="58" class="a-text">×10</text>
    <text x="200" y="58" class="a-text">= 330 Ω</text>
  </svg>`,
};

export const STEPS = [
  {
    id: 'meet', title: 'Meet the breadboard', xray: 'off',
    notes: [{ at: [5, 0.5], text: 'power rails' }, { at: [11, 5], text: 'rows a–e' }, { at: [17, 8.5], text: 'the middle gap' }, { at: [23, 12], text: 'rows f–j' }, { at: [26, 16.5], text: 'power rails' }],
    body: `<p>A breadboard lets you build a circuit without soldering. You push wires and the legs of parts into the holes, and metal clips inside grip them. Pull them out and try again as often as you like.</p>
      <p>The holes look the same, but they're wired together underneath in a fixed pattern. Once you know which holes are joined, you can read any breadboard.</p>
      <p class="hint">Tap any hole on the board to see which other holes it's joined to.</p>`,
  },
  {
    id: 'inside', title: 'Look under the plastic', xray: 'on',
    notes: [{ at: [6, 0.5], text: 'long clips' }, { at: [15, 5], text: 'short clips' }, { at: [24, 12], text: 'short clips' }],
    body: `<p>This is the board with its plastic see-through. Each strip of metal is one springy clip. Anything pushed into holes on the same clip is connected, as if you'd joined them with a wire.</p>
      ${art.clip}
      <p>Holes on different clips aren't connected at all, even when they're right next to each other.</p>
      <p class="hint">Use <b>See inside</b> above the board to switch this view on and off at any step.</p>`,
  },
  {
    id: 'rows', title: 'Rows of five', xray: 'peek', focus: [5, -1.6, 18, 15.4],
    highlights: [{ net: '12ae', tone: 'a' }, { net: '12fj', tone: 'b' }],
    notes: [{ at: [11, 8.5], text: 'not joined across the gap' }],
    body: `<p>Every numbered row has two short clips. Holes <b>a to e</b> share one, and holes <b>f to j</b> share another.</p>
      <p>So two legs pushed into, say, <code>b12</code> and <code>d12</code> are connected, with no wire needed. Legs in <code>b12</code> and <code>b13</code> are not.</p>
      <p class="hint">Try it: tap a few holes and watch which ones light up with them.</p>`,
  },
  {
    id: 'gap', title: 'The gap in the middle', xray: 'peek', focus: [-1.6, 1.5, 13, 15.5],
    parts: [{ type: 'chip', col: 5, pins: 8 }],
    highlights: [5, 6, 7, 8].flatMap((n, i) => [{ net: n + 'ae', tone: i % 2 ? 'b' : 'a' }, { net: n + 'fj', tone: i % 2 ? 'a' : 'b' }]),
    notes: [{ at: [6.5, 12], text: '8 legs, 8 separate clips' }],
    body: `<p>The groove down the middle splits every row in two. It's the width of a standard chip.</p>
      <p>A chip sits across the gap so every leg lands on its own clip. Each leg can then be wired somewhere different. Without the gap, the legs facing each other would be joined.</p>
      <p>That's why parts with lots of legs always go across the middle.</p>`,
  },
  {
    id: 'rails', title: 'The power rails', xray: 'on',
    highlights: [{ net: 'T+', tone: 'plus' }, { net: 'T-', tone: 'minus' }, { net: 'B-', tone: 'minus' }, { net: 'B+', tone: 'plus' }],
    notes: [{ at: [15, 8.5], text: '{T} and {B} rails are separate' }],
    body: `<p>The long strips along both edges are the <b>power rails</b>. Each one runs the whole length of the board.</p>
      <p>Plug your power into one pair: <span class="plus">+ next to the red line</span>, <span class="minus">− next to the blue line</span>. Then every row on the board is one short wire away from power.</p>
      <ul>
        <li>The {T} pair and the {B} pair aren't joined. To use both, add two wires: + to + and − to −.</li>
        <li>Not every board puts red and blue in the same order. Go by the lines printed on yours.</li>
        <li>On some longer boards the red and blue lines break halfway. That means the rail does too, and needs a short wire across the break.</li>
      </ul>`,
  },
  {
    id: 'power', title: 'Build it: power', xray: 'peek', build: 1, focus: NEAR_BATTERY,
    parts: [battery],
    highlights: [{ net: 'T+', tone: 'plus' }, { net: 'T-', tone: 'minus' }],
    body: `<p>Now let's light an LED. You'll need:</p>
      <ul class="kit">
        <li>A battery pack or a breadboard power supply, about 5 volts (3 AA batteries make 4.5)</li>
        <li>One LED</li>
        <li>One 330 Ω resistor (anything from 220 to 1,000 Ω works)</li>
        <li>One jumper wire</li>
      </ul>
      <p>First, plug the battery's <span class="plus">red lead into the + rail</span> and its <span class="minus">black lead into the − rail</span>. Every hole on those two rails is now live.</p>`,
  },
  {
    id: 'resistor', title: 'Build it: the resistor', xray: 'peek', build: 2, focus: NEAR_BATTERY,
    parts: [battery, resistor],
    highlights: [{ net: '12ae', tone: 'a' }],
    body: `<p>Put one leg of the resistor in the <b>+ rail</b> and the other in <b>row 12</b>. Resistors work either way round.</p>
      <p>Now all five holes of row 12, a to e, are connected to + through the resistor. It limits how much current can flow, so the LED doesn't burn out.</p>
      ${art.resistor}`,
  },
  {
    id: 'led', title: 'Build it: the LED', xray: 'peek', build: 3, focus: NEAR_BATTERY,
    parts: [battery, resistor, led],
    highlights: [{ net: '13ae', tone: 'b' }],
    notes: [{ at: [12.5, 8.5], text: 'row 13 goes nowhere yet' }],
    body: `<p>LEDs only work one way round. The <b>long leg (+)</b> goes in row 12, on the same clip as the resistor. The <b>short leg (−)</b> goes in row 13.</p>
      ${art.led}
      <p>It doesn't light yet. Row 13 isn't connected to anything else, so current has no way back to the battery.</p>`,
  },
  {
    id: 'loop', title: 'Build it: close the loop', xray: 'peek', build: 4, focus: NEAR_BATTERY,
    parts: LED_CIRCUIT,
    body: `<p>One wire from row 13 to the <b>− rail</b> closes the loop, and the LED lights.</p>
      <p>The moving dots show the path the current takes: out of the battery's +, along the rail, through the resistor, along row 12's clip, through the LED, along row 13's clip, down the wire, and back to −.</p>
      <p>That's the whole idea. Every circuit is a loop from + back to −, and the clips under the board are part of the loop.</p>`,
  },
  {
    id: 'mistakes', title: 'Why won’t it light?', xray: 'peek', mode: 'mistakes',
    body: `<p>When an LED stays dark, it's almost always one of these. Pick one, then show the fix.</p>`,
  },
  {
    id: 'quiz', title: 'Find a connected hole', xray: 'off', mode: 'quiz',
    body: `<p>One hole is glowing. Tap any <b>other</b> hole that's connected to it. Six rounds.</p>`,
  },
  {
    id: 'build', title: 'Build your own', xray: 'off', mode: 'sandbox', focus: NEAR_BATTERY,
    body: `<p>The battery is already on the {T} rails. Choose a part above the board, then tap two holes to place it. For an LED, tap the long leg's hole (+) first.</p>
      <p class="hint">Pinch or use the + and − buttons to zoom, and drag to move around the board.</p>`,
  },
];

const swap = (i, p) => LED_CIRCUIT.map((q, k) => (k === i ? p : q));

export const MISTAKES = [
  {
    id: 'backwards', label: 'Backwards LED', focus: NEAR_BATTERY,
    parts: swap(2, { type: 'led', a: 'c13', b: 'c12' }),
    text: `The long leg is in row 13 and the short leg in row 12, so the LED faces the wrong way. Current can only go in at the long leg. Turn it around.`,
  },
  {
    id: 'same-row', label: 'Both legs in one row', focus: NEAR_BATTERY,
    parts: swap(2, { type: 'led', a: 'b12', b: 'd12' }),
    highlights: [{ net: '12ae', tone: 'bad' }],
    text: `Both legs are in row 12, a to e, so the clip underneath joins them. Current has nowhere to go but around the LED. Put the two legs in different rows.`,
  },
  {
    id: 'gap', label: 'Wrong side of the gap', focus: [-1.6, -4.9, 17, 12],
    parts: swap(3, { type: 'wire', a: 'f13', b: 'T-14', color: 'black' }),
    highlights: [{ net: '13ae', tone: 'a' }, { net: '13fj', tone: 'b' }],
    text: `The wire is in row 13, but on the other side of the middle gap. Holes f to j aren't joined to a to e, so the loop is open. Move the wire into any hole from a13 to e13.`,
  },
  {
    id: 'bottom-rail', label: 'Unpowered rail',
    parts: swap(3, { type: 'wire', a: 'a13', b: 'B-14', color: 'black' }),
    highlights: [{ net: 'B-', tone: 'bad' }, { net: 'T-', tone: 'minus' }],
    fix: [...swap(3, { type: 'wire', a: 'a13', b: 'B-14', color: 'black' }), { type: 'wire', a: 'T+30', b: 'B+30', color: 'red' }, { type: 'wire', a: 'T-29', b: 'B-29', color: 'black' }],
    fixText: `Two wires join the {T} rails to the {B} ones. Now both pairs are live.`,
    text: `The wire goes to the {B} − rail, but the battery is on the {T} rails, and they aren't joined. Use the {T} − rail, or join the rails with two wires.`,
  },
  {
    id: 'no-resistor', label: 'No resistor', focus: NEAR_BATTERY,
    parts: swap(1, { type: 'wire', a: 'T+12', b: 'a12', color: 'red' }),
    text: `With nothing to hold the current back, the LED takes far more than it can handle. It flashes bright once and never lights again. Always put a resistor in the loop with an LED.`,
  },
  {
    id: 'short', label: 'Short circuit', focus: [-1.6, -4.9, 22, 9.2],
    parts: [...LED_CIRCUIT, { type: 'wire', a: 'T+20', b: 'T-20', color: 'yellow' }],
    highlights: [{ net: 'T+', tone: 'plus' }, { net: 'T-', tone: 'minus' }],
    text: `A wire straight from + to − gives the current a path with nothing on it, so nearly all of it goes that way. The LED goes dark and the battery and wire get hot. Never join the rails directly.`,
  },
];
for (const m of MISTAKES) if (!m.fix) m.fix = LED_CIRCUIT;
