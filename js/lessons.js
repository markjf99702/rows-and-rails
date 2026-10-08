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

// ----- Level 2: a XIAO ESP32C3 and a BME280 temperature sensor -----

export const xiao = { type: 'xiao', col: 2, fixed: true };
export const bme = { type: 'sensor', col: 17, row: 'h', fixed: true };
const w3v3 = { type: 'wire', a: 'a4', b: 'T+4', color: 'red' };
const wgnd = { type: 'wire', a: 'a3', b: 'T-3', color: 'black' };
const svin = { type: 'wire', a: 'f17', b: 'T+17', color: 'red' };
const sgnd = { type: 'wire', a: 'f18', b: 'T-18', color: 'black' };
const scl = { type: 'wire', a: 'g19', b: 'j7', color: 'yellow' };
const sda = { type: 'wire', a: 'f20', b: 'i6', color: 'blue' };
const res2 = { type: 'resistor', a: 'b5', b: 'b10' };
const led2 = { type: 'led', a: 'd10', b: 'd11' };
const lgnd = { type: 'wire', a: 'a11', b: 'T-12', color: 'black' };
export const XIAO_CIRCUIT = [xiao, bme, w3v3, wgnd, svin, sgnd, scl, sda, res2, led2, lgnd];
export const HOT = 26;

const XIAO_AREA = [-1.9, -1.6, 21, 18.6];

export const SKETCH = `#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;
const int LED_PIN = D10;
const float HOT = ${HOT}.0;     // degrees C

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Wire.begin();              // SDA on D4, SCL on D5
  if (!bme.begin(0x76)) {    // some boards use 0x77
    Serial.println("Could not find a BME280 sensor");
    while (true) delay(10);
  }
}

void loop() {
  float t = bme.readTemperature();
  Serial.print("Temperature: ");
  Serial.print(t, 1);
  Serial.println(" C");
  digitalWrite(LED_PIN, t > HOT ? HIGH : LOW);
  delay(1000);
}`;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

STEPS.push(
  {
    id: 'xiao', level: 2, title: 'Meet the XIAO', xray: 'off', focus: XIAO_AREA,
    parts: [xiao],
    highlights: [{ net: '4ae', tone: 'plus' }, { net: '3ae', tone: 'minus' }, { net: '6fj', tone: 'a' }, { net: '7fj', tone: 'b' }],
    body: `<p>The Seeed Studio <b>XIAO ESP32C3</b> is a tiny computer with Wi-Fi and Bluetooth. It runs the code you write, reads sensors, and switches things on and off. A USB-C cable from your computer powers it and loads the code.</p>
      <p>It has 14 pins, seven down each side, 0.6 inch apart. It sits across the middle gap so every pin gets a clip of its own, with free holes beside each pin for wires.</p>
      <ul>
        <li><b class="plus">3V3</b>: 3.3 volts out, to power sensors.</li>
        <li><b class="minus">GND</b>: ground, the − side of everything.</li>
        <li><b>5V</b>: straight from USB. Too much for most sensors.</li>
        <li><b>D0 to D10</b>: pins your code reads or switches on and off. D4 and D5 are also <b>SDA</b> and <b>SCL</b>, the two wires sensors talk on.</li>
      </ul>
      <p class="hint">It comes without pins: solder on the two header strips first. The XIAO ESP32S3 and ESP32C6 have the same pins in the same places.</p>`,
  },
  {
    id: 'xpower', level: 2, title: 'Power the rails', xray: 'peek', focus: XIAO_AREA,
    parts: [xiao, w3v3, wgnd],
    highlights: [{ net: 'T+', tone: 'plus' }, { net: 'T-', tone: 'minus' }],
    body: `<p>One wire from <b class="plus">3V3 to the + rail</b>, one from <b class="minus">GND to the − rail</b>. Now the {T} rails carry 3.3 volts from the XIAO, the way the battery fed them in level 1.</p>
      <p>Leave 5V alone. It's whatever the USB port gives, and most sensors want 3.3.</p>
      <p>Only the {T} rails are live. The {B} pair isn't joined to them.</p>`,
  },
  {
    id: 'sensor', level: 2, title: 'Add a sensor', xray: 'peek', focus: XIAO_AREA,
    parts: [xiao, w3v3, wgnd, bme, svin, sgnd],
    highlights: [{ net: '17fj', tone: 'plus' }, { net: '18fj', tone: 'minus' }],
    body: `<p>This is a <b>BME280</b> breakout: a sensor for temperature, humidity and air pressure on a little purple board. Its four pins go in row h, each on its own clip, and the board lies over the holes below them.</p>
      <p>Two long wires reach up to the {T} rails: <b class="plus">VIN to +</b> and <b class="minus">GND to −</b>. Long wires across the gap are fine, as long as each end lands on the right clip.</p>
      <p class="hint">Check the labels on yours. Different makers put the four pins in a different order.</p>`,
  },
  {
    id: 'i2c', level: 2, title: 'Two wires to talk', xray: 'peek', focus: XIAO_AREA, bus: true,
    parts: [xiao, w3v3, wgnd, bme, svin, sgnd, scl, sda],
    body: `<p>The sensor and the XIAO talk over <b>I²C</b>, two wires that every I²C sensor you add can share.</p>
      <ul>
        <li><b class="sda">SDA</b> (data) carries the readings. It goes to <b>D4</b>.</li>
        <li><b class="scl">SCL</b> (clock) ticks to keep both ends in step. It goes to <b>D5</b>.</li>
      </ul>
      <p>The moving dots are the messages. Each sensor has an address, like a house number. Most purple BME280 boards answer at <code>0x76</code>, some at <code>0x77</code>.</p>`,
  },
  {
    id: 'xled', level: 2, title: 'An LED on a pin', xray: 'peek', focus: XIAO_AREA, bus: true, mode: 'pin',
    parts: XIAO_CIRCUIT,
    body: `<p>Pin <b>D10</b> is an output. When the code sets it <b>HIGH</b> it gives 3.3 volts, and <b>LOW</b> is 0. That's enough to light an LED through a resistor.</p>
      <p>It's the same loop as level 1, with the pin playing the battery: D10, the resistor, row 10, the LED, row 11, a wire to −, and back to the XIAO's GND.</p>
      <p class="hint">Never put an LED straight on a pin without its resistor. It's too much current for the LED and for the pin.</p>`,
  },
  {
    id: 'run', level: 2, title: 'Run the code', xray: 'off', focus: XIAO_AREA, bus: true, mode: 'run',
    parts: XIAO_CIRCUIT,
    body: `<p>This sketch reads the temperature once a second and turns the LED on above ${HOT} °C. Drag the temperature, or breathe on the sensor.</p>
      <details class="code"><summary>The code</summary><pre><code>${esc(SKETCH)}</code></pre>
        <button class="btn quiet copy" type="button">Copy the code</button>
        <p class="hint">In the Arduino IDE: add the esp32 boards from Espressif in the Boards Manager, pick <b>XIAO_ESP32C3</b>, and install the <b>Adafruit BME280</b> library. To see the readings, set Tools → USB CDC On Boot → Enabled, then open the Serial Monitor at 115200.</p>
      </details>`,
  },
  {
    id: 'xmistakes', level: 2, title: 'Why doesn’t it work?', xray: 'peek', focus: XIAO_AREA, mode: 'mistakes', bus: true,
    body: `<p>The usual reasons the sensor stays silent or the LED stays dark. Pick one, then show the fix.</p>`,
  },
  {
    id: 'challenge', level: 2, title: 'Wire it yourself', xray: 'off', focus: XIAO_AREA, mode: 'challenge', bus: true,
    body: `<p>The XIAO and the sensor are in place. Add the wires, the resistor and the LED so the sensor answers and D10 can light the LED. The list below ticks off as you go.</p>
      <p class="hint">Start with 3V3 and GND to the rails. Then everything else can reach power with a short wire.</p>`,
  },
);

const swap2 = (i, p) => XIAO_CIRCUIT.map((q, k) => (k === i ? p : q));
const at = p => XIAO_CIRCUIT.indexOf(p);

export const MISTAKES2 = [
  {
    id: 'swapped', label: 'SDA and SCL swapped',
    parts: swap2(at(scl), { type: 'wire', a: 'g19', b: 'i6', color: 'yellow' }).map(q => (q === sda ? { type: 'wire', a: 'f20', b: 'j7', color: 'blue' } : q)),
    text: `SDA goes to D5 and SCL to D4. The XIAO sends its clock on the sensor's data pin, so the sensor never answers and the sketch prints "Could not find a BME280 sensor". Swap the two wires.`,
  },
  {
    id: 'five-volt', label: 'Rails on 5V',
    parts: swap2(at(w3v3), { type: 'wire', a: 'a2', b: 'T+2', color: 'red' }),
    text: `The + rail is fed from 5V instead of 3V3, so the sensor and its signal lines get 5 volts. Some breakout boards cope, but the XIAO's pins are 3.3-volt only and it's an easy way to damage something. Feed the rail from 3V3.`,
  },
  {
    id: 'no-ground', label: 'No shared ground',
    parts: XIAO_CIRCUIT.filter(q => q !== sgnd),
    highlights: [{ net: '18fj', tone: 'bad' }],
    text: `The sensor's GND pin isn't wired to anything. Power and signals both need a way back, so with no shared ground the sensor is dead. Every part in a circuit shares the same ground.`,
  },
  {
    id: 'dead-rail', label: 'Unpowered rail',
    parts: swap2(at(svin), { type: 'wire', a: 'f17', b: 'B+17', color: 'red' }).map(q => (q === sgnd ? { type: 'wire', a: 'f18', b: 'B-18', color: 'black' } : q)),
    highlights: [{ net: 'B+', tone: 'bad' }, { net: 'B-', tone: 'bad' }],
    text: `The sensor is wired to the {B} rails, but the XIAO only feeds the {T} ones. Use the {T} rails, or join the two pairs with two wires.`,
  },
  {
    id: 'no-resistor', label: 'LED with no resistor',
    parts: swap2(at(res2), { type: 'wire', a: 'b5', b: 'b10', color: 'green' }),
    text: `The LED is wired straight to D10. When the pin goes HIGH it tries to push far more current than either the LED or the pin is made for. Put the resistor back.`,
  },
  {
    id: 'wrong-pin', label: 'Wrong pin',
    parts: swap2(at(res2), { type: 'resistor', a: 'b6', b: 'b10' }),
    highlights: [{ net: '6ae', tone: 'bad' }, { net: '5ae', tone: 'a' }],
    text: `The resistor starts in row 6, which is D9's clip, but the code switches D10, in row 5. The code and the wiring have to name the same pin. Move the resistor up one row, or change LED_PIN to D9.`,
  },
];
for (const m of MISTAKES2) if (!m.fix) m.fix = XIAO_CIRCUIT;

// ----- Level 3: a screen on the same two wires -----

export const oled = { type: 'oled', fixed: true, leads: { GND: 'T-20', VCC: 'T+21', SCL: 'a22', SDA: 'a23' } };
const jscl = { type: 'wire', a: 'e22', b: 'f19', color: 'yellow' };
const jsda = { type: 'wire', a: 'e23', b: 'g20', color: 'blue' };
export const SCREEN_CIRCUIT = [...XIAO_CIRCUIT, oled, jscl, jsda];
// The screen hangs above the board, so level 3 shows more room above it.
export const EXTENT3 = { x0: -1.9, x1: 30.9, y0: -13.3, y1: 18.5 };
const SCREEN_AREA = [1, -13.3, 28, 16];

export const SKETCH3 = `#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_SSD1306.h>

Adafruit_BME280 bme;
Adafruit_SSD1306 screen(128, 64, &Wire, -1);
const int LED_PIN = D10;
const float HOT = ${HOT}.0;     // degrees C
bool found;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Wire.begin();                               // SDA on D4, SCL on D5
  screen.begin(SSD1306_SWITCHCAPVCC, 0x3C);   // the screen's address
  screen.setTextColor(SSD1306_WHITE);
  found = bme.begin(0x76);                    // the sensor's address
}

void loop() {
  screen.clearDisplay();
  screen.setTextSize(1);
  screen.setCursor(0, 0);
  if (!found) {
    screen.print("No BME280 found");
  } else {
    float t = bme.readTemperature();
    float h = bme.readHumidity();
    screen.print("Temperature");
    screen.setTextSize(3);
    screen.setCursor(0, 16);
    screen.print(t, 1);
    screen.setTextSize(1);
    screen.setCursor(0, 54);
    screen.print("Humidity ");
    screen.print(h, 0);
    screen.print("%");
    digitalWrite(LED_PIN, t > HOT ? HIGH : LOW);
  }
  screen.display();
  delay(1000);
}`;

STEPS.push(
  {
    id: 'screen', level: 3, title: 'Add a screen', xray: 'off', focus: SCREEN_AREA,
    parts: [...XIAO_CIRCUIT, oled],
    highlights: [{ net: '22ae', tone: 'scl' }, { net: '23ae', tone: 'sda' }],
    body: `<p>This is a <b>0.96 inch OLED</b>: 128 by 64 tiny lights that glow on their own, run by an SSD1306 chip. It talks I²C too, so it needs the same four connections as the sensor.</p>
      <p>It's wider than the board, so it sits above it on four <b>female-to-male jumper wires</b>. <b class="minus">GND</b> and <b class="plus">VCC</b> go straight into the rails. <b class="scl">SCL</b> and <b class="sda">SDA</b> go into two empty rows, 22 and 23.</p>
      <p class="hint">Look at the pin order: the screen goes GND, VCC, SCL, SDA, and the sensor goes VIN, GND, SCL, SDA. Always follow the labels, not where a pin sits.</p>`,
  },
  {
    id: 'bus', level: 3, title: 'Share the two wires', xray: 'peek', focus: SCREEN_AREA, bus: true,
    parts: SCREEN_CIRCUIT,
    body: `<p>Two short jumpers join row 22 to the sensor's SCL row and row 23 to its SDA row. Now the screen and the sensor hang off the same two wires.</p>
      <p>That's what I²C is for: one pair of wires, lots of devices. The XIAO calls each one by its <b>address</b>, like a house number on a street. The sensor is <code>0x76</code> and the screen is <code>0x3C</code>, so they never answer for each other.</p>
      <p class="hint">Two devices with the same address can't share the wires. Many sensors have a pad or pin to change theirs.</p>`,
  },
  {
    id: 'show', level: 3, title: 'Show the temperature', xray: 'off', focus: SCREEN_AREA, bus: true, mode: 'run',
    parts: SCREEN_CIRCUIT,
    body: `<p>The sketch now writes the reading on the screen instead of the Serial Monitor, and still turns the LED on above ${HOT} °C. Drag the temperature or breathe on the sensor and watch the screen.</p>
      <details class="code"><summary>The code</summary><pre><code>${esc(SKETCH3)}</code></pre>
        <button class="btn quiet copy" type="button">Copy the code</button>
        <p class="hint">Install <b>Adafruit SSD1306</b> from the Library Manager (it brings Adafruit GFX with it) as well as Adafruit BME280. Some screens answer at <code>0x3D</code>: it's printed on the back.</p>
      </details>`,
  },
  {
    id: 'blank', level: 3, title: 'Blank screen?', xray: 'peek', focus: SCREEN_AREA, mode: 'mistakes', bus: true,
    body: `<p>A screen that stays black is almost always one of these. Pick one, then show the fix.</p>`,
  },
  {
    id: 'final', level: 3, title: 'Wire the whole thing', xray: 'off', focus: SCREEN_AREA, mode: 'challenge', bus: true,
    body: `<p>The XIAO, the sensor and the screen with its leads are in place. Everything else is up to you: power, both devices on the bus, and the LED on D10.</p>
      <p class="hint">Work outward from the XIAO: 3V3 and GND to the rails, then the sensor, then the jumpers to the screen's rows.</p>`,
  },
);

const swap3 = (from, to) => SCREEN_CIRCUIT.map(q => (q === from ? to : q));

export const MISTAKES3 = [
  {
    id: 'power-swapped', label: 'GND and VCC swapped',
    parts: swap3(oled, { ...oled, leads: { ...oled.leads, GND: 'T+21', VCC: 'T-20' } }),
    text: `The leads went in by position, copying the sensor, so the screen's GND is on + and its VCC on −. Power backwards can kill a screen for good. Follow the labels on its pins.`,
  },
  {
    id: 'no-jumper', label: 'Missing jumper',
    parts: SCREEN_CIRCUIT.filter(q => q !== jsda),
    highlights: [{ net: '23ae', tone: 'bad' }],
    text: `Row 23 has the screen's SDA lead in it but nothing joins it to the bus, so the screen never hears the XIAO. The sensor still works: it has its own SDA wire.`,
  },
  {
    id: 'crossed', label: 'Jumpers crossed',
    parts: swap3(jscl, { type: 'wire', a: 'e22', b: 'g20', color: 'yellow' }).map(q => (q === jsda ? { type: 'wire', a: 'e23', b: 'f19', color: 'blue' } : q)),
    text: `The screen's SCL row is joined to the SDA line and its SDA row to SCL. The sensor is fine, but the screen gets clock on its data pin and stays dark.`,
  },
  {
    id: 'address', label: 'Wrong address',
    parts: SCREEN_CIRCUIT, address: 0x3D,
    text: `The wiring is right, but the code calls the screen at 0x3D and this one answers at 0x3C, so nobody replies. Check the back of the screen and use the address printed there.`,
    fixText: `The code calls 0x3C, the screen answers, and the reading appears.`,
  },
];
for (const m of MISTAKES3) if (!m.fix) m.fix = SCREEN_CIRCUIT;

// ----- Level 4: Wi-Fi, a page on your phone, and a buzz when it's hot -----

export const antenna = { type: 'antenna', fixed: true };
export const WIFI_CIRCUIT = [...SCREEN_CIRCUIT, antenna];
export const IP = '192.168.1.42';

export const SKETCH4 = `#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_SSD1306.h>

const char* WIFI_NAME = "your Wi-Fi name";       // a 2.4 GHz network
const char* WIFI_PASSWORD = "your Wi-Fi password";
const char* TOPIC = "pick-a-hard-to-guess-name";   // your ntfy topic

Adafruit_BME280 bme;
Adafruit_SSD1306 screen(128, 64, &Wire, -1);
WebServer server(80);
const int LED_PIN = D10;
const float HOT = ${HOT}.0;     // degrees C
float t, h;
bool warned = false;

// The page your phone opens. It asks for fresh numbers every 2 seconds.
const char PAGE[] = R"page(<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Weather station</title>
<body style="font: 22px sans-serif; text-align: center">
<h1 id="t">--</h1><p id="h"></p>
<script>
async function update() {
  const r = await (await fetch('/data')).json();
  document.getElementById('t').textContent = r.t.toFixed(1) + ' °C';
  document.getElementById('h').textContent = 'Humidity ' + r.h + '%';
}
update();
setInterval(update, 2000);
</script>)page";

void sendPage() { server.send(200, "text/html", PAGE); }
void sendData() {
  server.send(200, "application/json",
    "{\\"t\\":" + String(t, 1) + ",\\"h\\":" + String(h, 0) + "}");
}

// A push to your phone through ntfy.sh.
void notify(String message) {
  WiFiClientSecure tls;
  tls.setInsecure();   // skips checking ntfy's certificate
  HTTPClient http;
  http.begin(tls, String("https://ntfy.sh/") + TOPIC);
  http.addHeader("Title", "Weather station");
  http.POST(message);
  http.end();
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Wire.begin();
  screen.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  screen.setTextColor(SSD1306_WHITE);
  screen.clearDisplay();
  screen.print("Joining Wi-Fi...");
  screen.display();
  bme.begin(0x76);

  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(250);
  MDNS.begin("weather");          // http://weather.local
  server.on("/", sendPage);
  server.on("/data", sendData);
  server.begin();
}

void loop() {
  server.handleClient();          // answer the phone, if it's asking
  static unsigned long last = 0;
  if (millis() - last < 2000) return;
  last = millis();

  t = bme.readTemperature();
  h = bme.readHumidity();
  digitalWrite(LED_PIN, t > HOT ? HIGH : LOW);
  if (t > HOT && !warned) {
    notify("It's " + String(t, 1) + " C");
    warned = true;
  }
  if (t < HOT - 1) warned = false;  // a degree of slack, so it doesn't buzz on every wobble

  screen.clearDisplay();
  screen.setTextSize(1);
  screen.setCursor(0, 0);
  screen.print("Temperature");
  screen.setTextSize(3);
  screen.setCursor(0, 16);
  screen.print(t, 1);
  screen.setTextSize(1);
  screen.setCursor(0, 54);
  screen.print(WiFi.localIP());   // the address to type if weather.local won't open
  screen.display();
}`;

// Where the readings travel: the XIAO, your router, and either your phone (same Wi-Fi) or the internet.
const box = (x, label, sub, cls = '') => `<g class="${cls}"><rect x="${x}" y="26" width="64" height="40" rx="8" class="d-box"/>
  <text x="${x + 32}" y="45" class="d-label">${label}</text><text x="${x + 32}" y="58" class="d-sub">${sub}</text></g>`;
const arrow = (x1, x2) => `<path d="M${x1} 46H${x2}" class="d-arrow"/><path d="M${x2 - 6} 41l6 5-6 5" class="d-arrow"/>`;
const routeLocal = `<svg class="art route" viewBox="0 0 300 92" role="img" aria-label="The XIAO sends the page to your Wi-Fi router, which passes it to your phone. Everything stays in your home.">
  <rect x="2" y="8" width="296" height="80" rx="12" class="d-home"/><text x="14" y="22" class="d-home-label">your home Wi-Fi</text>
  ${box(14, 'XIAO', 'weather.local')}${arrow(80, 116)}${box(118, 'router', '192.168.1.1')}${arrow(184, 220)}${box(222, 'phone', 'browser')}
</svg>`;
const routeOut = `<svg class="art route" viewBox="0 0 380 92" role="img" aria-label="For an alert, the XIAO sends a message through your router and the internet to ntfy.sh, which pushes it to the ntfy app on your phone, wherever it is.">
  <rect x="2" y="8" width="150" height="80" rx="12" class="d-home"/><text x="14" y="22" class="d-home-label">home</text>
  ${box(10, 'XIAO', 'POST')}${arrow(76, 84)}${box(86, 'router', '')}${arrow(152, 158)}${box(160, 'internet', '')}${arrow(226, 232)}${box(234, 'ntfy.sh', 'your topic')}${arrow(300, 306)}${box(308, 'phone', 'ntfy app', 'd-end')}
</svg>`;

STEPS.push(
  {
    id: 'wifi', level: 4, title: 'Wi-Fi is built in', xray: 'off', focus: SCREEN_AREA, mode: 'wifi',
    parts: WIFI_CIRCUIT,
    body: `<p>The ESP32 chip on the XIAO has a Wi-Fi radio inside, so this level needs no new wires. Everything happens in the code.</p>
      <ul>
        <li><b>Clip on the antenna.</b> The XIAO ESP32C3 comes with a little flat antenna on a thin cable. Press its round plug onto the tiny socket on the board. Without it, Wi-Fi barely reaches across a room.</li>
        <li><b>2.4 GHz only.</b> The ESP32C3 can't see 5 GHz networks. Most home routers broadcast both.</li>
      </ul>
      <p>From here the readings can go two ways: to a web page you open on your phone at home, and as a push alert that reaches your phone anywhere.</p>`,
  },
  {
    id: 'join', level: 4, title: 'Join your Wi-Fi', xray: 'off', focus: SCREEN_AREA, mode: 'join',
    parts: WIFI_CIRCUIT,
    body: `<p>Two lines join your network:</p>
      <pre class="snippet"><code>WiFi.begin("your Wi-Fi name", "your password");
while (WiFi.status() != WL_CONNECTED) delay(250);</code></pre>
      <p>Your router then hands the XIAO an <b>IP address</b>, its number on your home network, like <code>${IP}</code>. The screen shows it, which is handy later.</p>`,
  },
  {
    id: 'page', level: 4, title: 'A page on your phone', xray: 'off', focus: SCREEN_AREA, mode: 'run', bus: true, phone: 'page',
    parts: WIFI_CIRCUIT,
    body: `<p>The XIAO can run a tiny <b>web server</b>. Your phone, on the same Wi-Fi, opens <code>http://weather.local</code> and gets a page with the latest reading. The page asks again every 2 seconds.</p>
      ${routeLocal}
      <p>It all stays inside your home: no account, no cloud. Drag the temperature or breathe on the sensor and watch the phone.</p>`,
  },
  {
    id: 'ping', level: 4, title: 'A buzz when it’s hot', xray: 'off', focus: SCREEN_AREA, mode: 'run', bus: true, phone: 'ping',
    parts: WIFI_CIRCUIT,
    body: `<p>A page only helps when you look at it. For an alert, the XIAO sends a message to <b>ntfy.sh</b>, a free push service, and the <b>ntfy</b> app on your phone shows it, even when you're out.</p>
      ${routeOut}
      <ol class="how">
        <li>Install the ntfy app and subscribe to a topic name you make up.</li>
        <li>Put the same name in the sketch.</li>
        <li>Above ${HOT} °C the XIAO posts a message once, then waits for it to cool off a degree before it can buzz again.</li>
      </ol>
      <p class="hint">There's no sign-up, so the topic name works like a password: anyone who knows it can read your alerts. Make it long and hard to guess.</p>`,
  },
  {
    id: 'station', level: 4, title: 'The whole sketch', xray: 'off', focus: SCREEN_AREA, mode: 'run', bus: true, phone: 'page',
    parts: WIFI_CIRCUIT,
    body: `<p>Here it is all together: the sensor, the screen, the LED, the web page and the alert.</p>
      <details class="code"><summary>The code</summary><pre><code>${esc(SKETCH4)}</code></pre>
        <button class="btn quiet copy" type="button">Copy the code</button>
        <p class="hint">Put in your Wi-Fi name, password and ntfy topic before uploading. Everything it needs comes with the esp32 boards, plus the two Adafruit libraries from level 3. If you share the code, take your password out first.</p>
      </details>`,
  },
  {
    id: 'nowifi', level: 4, title: 'Can’t connect?', xray: 'off', focus: SCREEN_AREA, mode: 'trouble',
    body: `<p>Wi-Fi problems don't show on the breadboard, so look at the screen and the phone. Pick a symptom, then show the fix.</p>`,
  },
);

// wifi: what the XIAO manages ('joining' means stuck trying); phone: what your phone shows.
export const TROUBLE = [
  {
    id: '5ghz', label: '5 GHz network', wifi: 'joining', phone: 'error',
    say: 'The screen is stuck on “Joining Wi-Fi...”',
    text: `The ESP32C3 only speaks 2.4 GHz, so it can't see a 5 GHz network at all. Many routers have both under one name, or offer a separate 2.4 GHz network in their settings. A guest network is often 2.4 GHz too.`,
  },
  {
    id: 'password', label: 'Password typo', wifi: 'joining', phone: 'error',
    say: 'The screen is stuck on “Joining Wi-Fi...”',
    text: `The name and password must match exactly, capitals and spaces included. Copy them from your router's label or settings rather than typing them from memory.`,
  },
  {
    id: 'antenna', label: 'No antenna', wifi: 'joining', phone: 'error', noAntenna: true,
    say: 'The screen is stuck on “Joining Wi-Fi...”, or connects and drops',
    text: `Without its antenna the XIAO ESP32C3 can barely hear the router. Press the antenna's round plug onto the socket until it clicks.`,
  },
  {
    id: 'other-network', label: 'Phone on another network', wifi: 'on', phone: 'error',
    say: 'The screen shows its address, but the phone can’t reach weather.local',
    text: `The page only works on the same Wi-Fi as the XIAO. A phone on mobile data, or on a guest network that keeps devices apart, can't see it. Join the same network on your phone.`,
  },
  {
    id: 'dot-local', label: '“weather.local” won’t open', wifi: 'on', phone: 'nolocal',
    say: 'The phone says it can’t find weather.local',
    text: `Some phones, especially older Android ones, don't look up .local names. Type the address from the bottom of the screen instead: http://${IP}.`,
    fixUrl: IP,
  },
  {
    id: 'no-alert', label: 'No alerts', wifi: 'on', phone: 'quiet',
    say: 'The page works, but no alert ever arrives',
    text: `The topic in the ntfy app has to match the sketch exactly, capitals included, and the app needs permission to show notifications. Check both, then breathe on the sensor.`,
  },
];
