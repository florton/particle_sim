import './style.css';
import { Hud, type HudCounters } from './hud';
import {
  createSim, integrateCPU, RADIAL_DAMP, SPECIES_NAMES, SPECIES_COLORS, G_CURSOR_HOLD,
  randomSeed, withOuterField,
} from './sim/world';
import * as barred from './sim/barred';
import * as classic from './sim/classic';
import { CHLADNI, COLLISION, MODES, MODE_COUNT, SELFGRAV } from './sim/modes';
import { createPair, pairSeparation, resetPair, stepPair } from './sim/pair';
import { VirtualList } from './ui/list';
import { speciesMask, toggleSpecies, filterLabel, countEffect, effectRuns } from './ui/state';
import type { Backend } from './render/backend';
import { createWebGPUBackend } from './render/webgpu';
import { createWebGL2Backend } from './render/webgl2';
import { BaselineArm, BASELINE_COUNT } from './baseline';

// 50k was the number the original brief asked for, but CPU integration of 50k
// typed-array particles costs well under a millisecond — there is no bottleneck
// to relieve at that scale. ?n= makes the crossover measurable rather than
// assumed. See README for the measured curve.
const params = new URLSearchParams(location.search);
// ?n= is the *disc*, and the outer field is added on top of it — see
// withOuterField() in sim/world.ts for why that is the number worth pinning.
// The HUD still reports the true total, so the count it claims is the count it
// is actually simulating and drawing.
const DISC_COUNT = Math.max(1, Number(params.get('n')) || 1_000_000);
const CAPACITY = withOuterField(DISC_COUNT);

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const hud = new Hud(document.getElementById('hud')!);
// Fresh seed per load, so the disc the page boots into is a different draw each
// time rather than the same frozen arrangement — see randomSeed() in
// sim/world.ts. Same profile, same bands, different particles.
const sim = createSim(CAPACITY, randomSeed());

const counters: HudCounters = {
  entities: 0,
  domNodes: 0,
  arm: 'gpu',
  backend: 'booting',
  effectRuns: 0,
};

const forced = params.get('backend');

async function selectBackend(): Promise<Backend> {
  if (forced !== 'webgl2') {
    try {
      const gpu = await createWebGPUBackend(canvas, sim);
      if (gpu) return gpu;
    } catch (err) {
      console.warn('WebGPU init failed, falling back to WebGL2:', err);
    }
  }
  const gl = createWebGL2Backend(canvas, sim);
  if (!gl) throw new Error('Neither WebGPU nor WebGL2 is available.');
  return gl;
}

let mx = 0;
let my = 0;
addEventListener('pointermove', (e) => {
  mx = (e.clientX / innerWidth) * 2 - 1;
  my = -((e.clientY / innerHeight) * 2 - 1);
});

const backend = await selectBackend();
backend.setCount(CAPACITY);
counters.backend = `${backend.name} · ${backend.detail}`;

// --- hold to pull ---------------------------------------------------------
//
// In the self-gravitating disc, holding the pointer down ramps the cursor's mass
// toward G_CURSOR_HOLD instead of switching it there. The ramp is the whole
// reason this is usable: the force law is integrated explicitly, so a step
// change in a term that big arrives as an impulse — every particle near the
// cursor gets a full frame of the new acceleration at its old position, and the
// disc shatters rather than gathers. Ramped over a few hundred milliseconds the
// orbits track it and you get the intended thing: a well that deepens under your
// finger, material falling in along an arm, and the disc re-forming once you let
// go.
//
// Release is faster than the ramp. Building the well is the interaction and
// wants to feel deliberate; letting go should just let go.
//
// The fixed-potential modes switch between two cursor masses instead, and can:
// nothing there amplifies its own density contrast, so an impulse stirs the disc
// rather than collapsing it. See sim/modes.ts.
const GRAV_RAMP = 3.5; // e-folds per second, held
const GRAV_RELEASE = 8; // e-folds per second, released
let holding = false;
let grav = 1;

// The sidebar and HUD are interactive — dragging the cooling slider must not
// also drop a well into the middle of the galaxy.
const overUI = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('#sidebar, #hud, #banner');

function setHolding(next: boolean) {
  if (holding === next) return;
  holding = next;
  backend.setCursorMass(holding ? barred.G_CURSOR_HELD : barred.G_CURSOR);
}

addEventListener('pointerdown', (e) => {
  if (e.button === 0 && !overUI(e.target)) setHolding(true);
});
addEventListener('pointerup', () => setHolding(false));
addEventListener('pointercancel', () => setHolding(false));
// A pointer released outside the window never reports up.
addEventListener('blur', () => setHolding(false));

const listViewport = document.getElementById('list-viewport')!;
const list = new VirtualList(listViewport, document.getElementById('list-spacer')!, sim, backend);
const baseline = new BaselineArm(
  sim,
  document.body,
  document.getElementById('sidebar')!,
  listViewport,
);

// --- filter chips ---------------------------------------------------------

const head = document.getElementById('sidebar-head')!;
const chips = SPECIES_NAMES.map((name, i) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = name;
  const [r, g, b2] = SPECIES_COLORS[i];
  b.style.setProperty('--c', `rgb(${(r * 255) | 0} ${(g * 255) | 0} ${(b2 * 255) | 0})`);
  b.addEventListener('click', () => toggleSpecies(i));
  head.appendChild(b);
  return b;
});

const summary = document.createElement('div');
summary.className = 'summary';
head.appendChild(summary);

// --- disc temperature -----------------------------------------------------
//
// Deliberately the only physical constant with a control on it. Spiral arms are
// a self-gravitating instability, and how strongly the disc amplifies its own
// density contrast depends on how cold it is — so this slider moves the galaxy
// between the two kinds that actually exist. Cold is a grand-design spiral with
// few strong arms; hot is flocculent, many faint ones that dissolve as fast as
// they form. Not a rendering setting: it is changing the physics, live, over a
// million particles, and the structure reorganizes within a couple of seconds.

// The range is measured, not guessed. Over 40 s of headless integration the
// trade is monotone and steep in both directions at once:
//
//   cooling  late A(m=2)  mass drained to core  disc remaining
//   0.985      2.2e-1           36.5%               60%
//   0.990      8.2e-2           24.8%               69%
//   0.995      3.7e-2            8.0%               86%   <- default
//
// Colder makes arms about six times stronger and eats the disc to do it: the
// dissipation that keeps Toomre Q low enough to amplify structure is the same
// dissipation that lets material sink to the center. So the low end of this
// slider is a deliberately unsustainable setting — it is the grand-design look,
// and it costs a third of the disc in under a minute. The default is the one
// that still resembles a galaxy several minutes in.
const COOLING_MIN = 0.982; // strong dissipation — cold, sharply defined arms
const COOLING_MAX = 1.0; // none at all — the disc heats up and goes smooth

const coolRow = document.createElement('div');
coolRow.className = 'control';
const coolLabel = document.createElement('label');
coolLabel.htmlFor = 'cooling';
const coolInput = document.createElement('input');
coolInput.type = 'range';
coolInput.id = 'cooling';
coolInput.min = '0';
coolInput.max = '1000';
// Slider position is nonlinear: everything interesting happens in the last
// fraction of a percent below 1.0, so a linear mapping would put the entire
// usable range in the last few pixels of travel.
const coolFromSlider = (t: number) =>
  COOLING_MAX - (COOLING_MAX - COOLING_MIN) * (1 - t / 1000) ** 2;
const coolToSlider = (v: number) =>
  1000 * (1 - Math.sqrt((COOLING_MAX - v) / (COOLING_MAX - COOLING_MIN)));

function applyCooling(v: number) {
  backend.setCooling?.(v);
  baseline.setCooling(v);
  const perSec = v ** 60;
  coolLabel.textContent =
    `disc cooling · ${((1 - perSec) * 100).toFixed(1)}%/s` +
    (v >= COOLING_MAX - 1e-6 ? ' — none, disc goes smooth' : '');
}
coolInput.value = String(coolToSlider(RADIAL_DAMP));
coolInput.addEventListener('input', () => applyCooling(coolFromSlider(+coolInput.value)));
coolRow.append(coolLabel, coolInput);
head.appendChild(coolRow);

// --- core gravity, fixed-potential disc only ------------------------------
//
// The other half of the same idea as the cooling slider, for the one mode where
// it is safe: the fixed-potential disc's primary is prescribed and carries the
// entire rotation curve, so scaling it is exactly a speed control. Circular
// speed goes as sqrt(G), and because the damping here is radial-only the disc
// does not just get faster — the existing orbits are suddenly wrong for the new
// potential, fall eccentric, and recircularize into a tighter or wider annulus
// over about a second. Turning the knob is visible as the disc breathing.
//
// Nothing else in the set gets this. See `gravity` in sim/modes.ts for why.
//
// Geometric travel rather than linear, because what the eye reads is the ratio:
// halving G looks like the same size of change as doubling it, and a linear
// slider would spend most of its length above the default.
const GRAV_G_MIN = 0.1;
const GRAV_G_MAX = 3.0;
const gravFromSlider = (t: number) => GRAV_G_MIN * (GRAV_G_MAX / GRAV_G_MIN) ** (t / 1000);
const gravToSlider = (v: number) =>
  (1000 * Math.log(v / GRAV_G_MIN)) / Math.log(GRAV_G_MAX / GRAV_G_MIN);

const gravRow = document.createElement('div');
gravRow.className = 'control';
const gravLabel = document.createElement('label');
gravLabel.htmlFor = 'coregrav';
const gravInput = document.createElement('input');
gravInput.type = 'range';
gravInput.id = 'coregrav';
gravInput.min = '0';
gravInput.max = '1000';

function applyCoreGravity(v: number) {
  // One write. The backends read it into a uniform each frame, the naive arm
  // integrates with it, and [R] re-seeds the disc at the matching circular
  // speed — all from this one value. See coreGravity() in sim/classic.ts.
  classic.setCoreGravity(v);
  gravLabel.textContent =
    `core gravity · ${v.toFixed(2)} — orbits ×${Math.sqrt(v / classic.G_CORE).toFixed(2)}`;
}
gravInput.value = String(gravToSlider(classic.G_CORE));
gravInput.addEventListener('input', () => applyCoreGravity(gravFromSlider(+gravInput.value)));
gravRow.append(gravLabel, gravInput);
head.appendChild(gravRow);

/**
 * Rebuild the filtered row set and the count above it.
 *
 * Driven by the filter chips through the reactive graph, and *also* called on a
 * mode switch — which is not a mask change but does replace the population's
 * species. Each mode bands species by radius differently (see sim/modes.ts), so
 * a filtered sidebar left alone across a switch keeps counting the previous
 * galaxy: measured at 200k, argon read 6,763 rows against the 15,579 actually
 * there. Culling the population itself is still a single uniform written to the
 * GPU — this pass is over the row set, not over the particles.
 */
function refreshFilter() {
  const mask = speciesMask();
  for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('off', !(mask & (1 << i)));
  backend.setSpeciesMask(mask);
  list.refilter();
  summary.textContent = `${list.rowCount.toLocaleString()} rows · ${filterLabel()}`;
}

// The only thing the reactive graph drives.
countEffect(refreshFilter);

// --- A/B toggle -----------------------------------------------------------

const banner = document.createElement('div');
banner.id = 'banner';
document.body.appendChild(banner);

const modeLabel = () =>
  mode === COLLISION
    ? `${MODES[mode].label} · ${pair.spin1 > 0 ? 'prograde' : 'retrograde'}`
    : MODES[mode].label;

function refreshBanner() {
  banner.textContent =
    `${backend.name} compute · ${sim.count.toLocaleString()} particles · ${modeLabel()} — ` +
    (MODES[mode].hold === 'none' ? '' : 'hold to pull · ') +
    `[M] mode · [B] compare · [R] ${MODES[mode].restart} · [C] ${mono ? 'color' : 'mono'}` +
    // The plate is always face-on, so offering it a view toggle would be
    // offering nothing -- see cameraTilt() in render/backend.ts.
    (mode === CHLADNI ? '' : ` · [V] ${tilted ? 'face-on' : 'tilt'}`);
}

// Plain state, like `mode` and `mono` below: read imperatively at the few points
// that branch on it, never subscribed to.
let arm: 'gpu' | 'baseline' = 'gpu';

function setArm(next: 'gpu' | 'baseline') {
  arm = next;
  if (next === 'baseline') {
    // Compare within the current mode: the naive arm runs the same force law the
    // GPU arm is running, not whichever one it happened to be written against.
    baseline.setMode(mode, pair);
    baseline.start();
    canvas.style.display = 'none';
    banner.textContent =
      `naive DOM · ${BASELINE_COUNT.toLocaleString()} particles as elements · ` +
      `${modeLabel()} · sidebar rebuilt per frame — [B] compare · [R] restart`;
  } else {
    baseline.stop();
    canvas.style.display = 'block';
    list.forceRepaint();
    refreshBanner();
  }
  banner.className = next;
  counters.arm = next;
  // Counters are per-arm; carrying them across would blur the comparison.
  hud.reset();
}

let mode = SELFGRAV;

// The colliding pair. One object, mutated in place and held by reference on all
// sides, so the per-frame cost of the whole encounter is two bodies of leapfrog.
const pair = createPair();
backend.setPair(pair);

function setMode(next: number) {
  mode = next;
  if (mode === COLLISION) resetPair(pair);
  backend.setMode(mode);
  // The new mode brought its own species banding with it.
  refreshFilter();
  // The slider only means something to the self-gravitating disc; every other
  // mode has a fixed dissipation law of its own.
  coolRow.style.display = MODES[mode].cooling ? '' : 'none';
  // And core gravity only to the fixed-potential disc.
  gravRow.style.display = MODES[mode].gravity ? '' : 'none';
  if (arm === 'gpu') refreshBanner();
  // Switching mode while comparing should switch the thing being compared.
  else setArm('baseline');
}

let mono = false;
function setMono(next: boolean) {
  mono = next;
  backend.setMono?.(mono);
  baseline.setMono(mono);
  if (arm === 'gpu') refreshBanner();
}

/**
 * Face-on or inclined. A camera, not a simulation setting — the world stays two
 * dimensional and no force law can tell the difference. See TILT_COS in
 * render/backend.ts for what the angle is and why filling a widescreen window
 * is what it is for.
 *
 * Both arms are told, because the comparison is only worth anything if the two
 * are drawing the same picture.
 */
let tilted = false;
function setTilt(next: boolean) {
  tilted = next;
  backend.setTilt(tilted);
  baseline.setTilt(tilted);
  if (arm === 'gpu') refreshBanner();
}

function restart() {
  if (mode === COLLISION) {
    restartCollision();
    return;
  }
  backend.reset();
  baseline.reset();
  hud.reset();
}

/**
 * Restart the encounter, flipping the disc's spin sense each time.
 *
 * Prograde and retrograde are the demonstration: the same two cores on the same
 * orbit throw a tail half the frame long one way round and barely mark the disc
 * the other. Alternating on every restart puts the two side by side in time.
 */
function restartCollision(flip = true) {
  resetPair(pair, flip ? -pair.spin1 : pair.spin1);
  backend.setMode(COLLISION);
  if (arm === 'baseline') baseline.setMode(COLLISION, pair);
  else refreshBanner();
  hud.reset();
}

addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') setArm(arm === 'gpu' ? 'baseline' : 'gpu');
  if (e.key === 'm' || e.key === 'M') setMode((mode + 1) % MODE_COUNT);
  if (e.key === 'r' || e.key === 'R') restart();
  if (e.key === 'c' || e.key === 'C') setMono(!mono);
  if (e.key === 'v' || e.key === 'V') setTilt(!tilted);
});

function fit() {
  const dpr = Math.min(devicePixelRatio, 2);
  backend.resize((innerWidth * dpr) | 0, (innerHeight * dpr) | 0);
}
addEventListener('resize', fit);
fit();
applyCooling(RADIAL_DAMP);
applyCoreGravity(classic.G_CORE);
// setMode() is not called for the mode the page boots in, so the per-mode rows
// start in the state that mode wants: cooling belongs to it, core gravity does
// not.
gravRow.style.display = MODES[mode].gravity ? '' : 'none';
setArm('gpu');

// Verification handle. Lets the sim be driven and inspected without relying on
// rAF, so correctness is checkable independently of what the compositor is doing.
(globalThis as any).__demo = {
  sim, backend, baseline, hud, counters, integrateCPU, list, effectRuns, setArm,
};

let prev = performance.now();

function loop(now: number) {
  hud.frame(now);

  // Clamp dt so a stall doesn't launch every particle out of the box.
  const dt = Math.min((now - prev) / 1000, 1 / 30);
  prev = now;

  // The encounter is over once the cores are well separated and receding, or if
  // they have gone quiet; loop it rather than leaving a spent remnant on screen.
  if (mode === COLLISION) {
    stepPair(pair, dt);
    if (pair.elapsed > 6 && (pairSeparation(pair) > 2.4 || pair.elapsed > 42)) {
      restartCollision();
    }
  }

  const target = holding ? G_CURSOR_HOLD : 1;
  grav += (target - grav) * (1 - Math.exp(-(holding ? GRAV_RAMP : GRAV_RELEASE) * dt));
  // Snap, because the decay is asymptotic and never actually arrives. Every term
  // the hold adds is gated on grav being above 1, and they are all written to
  // vanish exactly at 1 — so leaving it resting at 1.0000001 would keep a dead
  // capture-drag and a hair of extra cursor mass in the force law forever. Idle
  // should be the same arithmetic it was before hold-to-pull existed.
  if (!holding && grav < 1.001) grav = 1;

  if (arm === 'gpu') {
    backend.frame(dt, mx, my, grav);
    list.update();
    counters.entities = sim.count;
    counters.domNodes = list.liveNodes;
  } else {
    baseline.frame(dt, mx, my, grav, holding ? barred.G_CURSOR_HELD : barred.G_CURSOR);
    counters.entities = baseline.count;
    counters.domNodes = baseline.domNodes;
  }

  counters.effectRuns = effectRuns();
  hud.paint(now, counters);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
