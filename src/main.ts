import './style.css';
import { Hud, type HudCounters } from './hud';
import {
  createSim, integrateCPU, RADIAL_DAMP, SPECIES_NAMES, SPECIES_COLORS, G_CURSOR_HOLD,
  M_HALO, M_HALO_MAX, haloShare, randomSeed, setHaloMass, withOuterField,
} from './sim/world';
import * as barred from './sim/barred';
import * as classic from './sim/classic';
import { CHLADNI, CLASSIC, COLLISION, HALO, MODES, MODE_COUNT } from './sim/modes';
import { createPair, pairSeparation, resetPair, stepPair } from './sim/pair';
import { VirtualList } from './ui/list';
import { speciesMask, toggleSpecies, filterLabel, countEffect, effectRuns } from './ui/state';
import { screenToSim, type Backend } from './render/backend';
import { createWebGPUBackend } from './render/webgpu';
import { createWebGL2Backend } from './render/webgl2';
import { BaselineArm, BASELINE_COUNT } from './baseline';

// 50k was the number the original brief asked for, but CPU integration of 50k
// typed-array particles costs well under a millisecond — there is no bottleneck
// to relieve at that scale. The count slider makes the crossover measurable
// rather than assumed. See README for the measured curve.
//
// These are *disc* counts, and the outer field is added on top — see
// withOuterField() in sim/world.ts for why that is the number worth pinning. The
// HUD and banner report the true total, so the count they claim is the count
// actually being simulated and drawn.
//
// The maximum is an allocation, not a setting: every buffer on both arms is
// sized to it at boot and the population is a prefix of that, so the slider
// costs nothing to move and cannot exceed it. 2M is twice the default, which is
// the usual amount of headroom to leave — enough that the top of the slider is
// worth having, not so much that a machine that could run the default fails to
// start.
const COUNT_MIN = 25_000;
const COUNT_MAX = 2_000_000;
const COUNT_DEFAULT = 1_000_000;
const params = new URLSearchParams(location.search);
const CAPACITY = withOuterField(COUNT_MAX);

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

// Pointer position, kept in *window* coordinates and converted to simulation
// coordinates once per frame in loop() rather than here.
//
// Two reasons for the split. The conversion needs the mode and the tilt, and
// neither exists yet at this point in module evaluation — a pointer event
// arriving while the backend is still being awaited below would hit the
// temporal dead zone. And the camera can change without the pointer moving:
// resize the window, tilt the view with [V], or switch mode, and a value
// converted at event time is silently stale until the pointer is moved again.
// Converting per frame is a handful of arithmetic and cannot go stale.
let px = innerWidth / 2;
let py = innerHeight / 2;
let mx = 0;
let my = 0;

/**
 * Whether the cursor is a mass in the force law yet, and where it has to move
 * from to become one.
 *
 * Every mode is seeded centred on the origin and the page opens with the pointer
 * wherever it already was — which on a fresh load is reported as the middle of
 * the window, i.e. the middle of the galaxy. So the disc's first act is to fall
 * into a well the user did not place and cannot see, and [R] does the same thing
 * again to a disc they were watching settle. The cursor is a physical body here,
 * not a hover state; it should not exist until it is aimed.
 *
 * Parked rather than branched: while disarmed the cursor is handed to the
 * integrators at CURSOR_PARK, far enough out that every 1/r^2 term involving it
 * underflows and every distance gate (capture radius, hold softening) is outside
 * its own threshold. One number, and no mode, arm or shader needs to know the
 * state exists — which matters because "all the modes" here means six force
 * laws across three integrators.
 *
 * The deadzone is what separates aiming from the pointer twitching, an OS
 * settling a trackpad, or a stray event on load. 8px is small enough to be gone
 * on the first deliberate movement and large enough that nothing accidental
 * crosses it.
 */
const CURSOR_DEADZONE = 8;
const CURSOR_PARK = 1e6;
let cursorArmed = false;
let armX = px;
let armY = py;

/** Take the cursor back out of the force law until it is aimed again. */
function disarmCursor() {
  cursorArmed = false;
  armX = px;
  armY = py;
  setHolding(false);
}

addEventListener('pointermove', (e) => {
  px = e.clientX;
  py = e.clientY;
  if (!cursorArmed && Math.hypot(px - armX, py - armY) > CURSOR_DEADZONE) cursorArmed = true;
});

const backend = await selectBackend();
counters.backend = `${backend.name} · ${backend.detail}`;

// --- drag to pull ---------------------------------------------------------
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
// The fixed-potential modes — barred, collision and the original disc — switch
// between two cursor masses instead, and can: nothing there amplifies its own
// density contrast, so an impulse stirs the disc rather than collapsing it. Each
// family has its own pair, because the two cursor masses only mean anything
// against the core they are being weighed against. See sim/modes.ts.
const GRAV_RAMP = 3.5; // e-folds per second, held
const GRAV_RELEASE = 8; // e-folds per second, released
let holding = false;
let grav = 1;

// The sidebar and HUD are interactive — dragging the cooling slider must not
// also drop a well into the middle of the galaxy.
const overUI = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('#sidebar, #hud, #banner');

/**
 * The switched cursor mass for the current mode — light while merely moving,
 * heavy while the pointer is down.
 *
 * Mode-dependent because the number is a ratio against that mode's core, not an
 * absolute: the original disc's cursor is half the barred disc's at rest and its
 * held value is scaled to match. The ramping modes ignore this entirely and take
 * `grav` on frame() instead.
 */
const cursorMass = (held: boolean) =>
  mode === CLASSIC
    ? (held ? classic.G_CURSOR_HELD : classic.G_CURSOR)
    : (held ? barred.G_CURSOR_HELD : barred.G_CURSOR);

function setHolding(next: boolean) {
  if (holding === next) return;
  holding = next;
  backend.setCursorMass(cursorMass(holding));
}

addEventListener('pointerdown', (e) => {
  // Not while the cursor is parked. The ramp would run to full depth against a
  // body a million units away and then arrive all at once on the first mouse
  // movement — an impulse, which is the one thing the ramp exists to prevent.
  if (e.button === 0 && cursorArmed && !overUI(e.target)) setHolding(true);
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

// --- particle count -------------------------------------------------------
//
// The one control that is about the demo rather than about the physics, and it
// belongs on screen rather than in a query string: the whole claim here is that
// a million particles is a different thing from a hundred thousand, and that is
// an argument you win by letting someone drag the number and watch the arms
// coarsen, not by asking them to edit a URL and reload.
//
// Everything downstream is already written for it. The population is a prefix,
// strided so that every prefix holds the same share of outer field and the same
// species banding (see HALO_EVERY in sim/world.ts), and the per-particle mass is
// derived from the live count on every path — M_DISC/(count * DISC_SHARE) in the
// mesh solver and in the GPU uniform — so the disc keeps the same total mass and
// the same rotation curve at every setting. Fewer particles is a coarser
// sampling of one galaxy, not a lighter one.
//
// Geometric travel. The interesting axis is orders of magnitude — 25k, 250k, 2M
// are three different demos — and a linear slider would spend four fifths of its
// length between 400k and 2M, where the picture barely changes.
const countFromSlider = (t: number) => COUNT_MIN * (COUNT_MAX / COUNT_MIN) ** (t / 1000);
const countToSlider = (v: number) =>
  (1000 * Math.log(v / COUNT_MIN)) / Math.log(COUNT_MAX / COUNT_MIN);

const countRow = document.createElement('div');
countRow.className = 'control';
const countLabel = document.createElement('label');
countLabel.htmlFor = 'count';
const countInput = document.createElement('input');
countInput.type = 'range';
countInput.id = 'count';
countInput.min = '0';
countInput.max = '1000';

/** What the label says, for a disc count that may not have been applied yet. */
function countText(disc: number) {
  return `particles · ${withOuterField(disc).toLocaleString()} — ${disc.toLocaleString()} disc`;
}

/**
 * Adopt a new population size, re-seeding only if it grew.
 *
 * The two directions are not symmetric, which is what lets one of them be live.
 *
 * Shrinking is exact and free. The live population is the prefix 0..count, so
 * dropping the tail is two assignments and every particle that remains is the
 * one that was already there, on the orbit it was already on — nothing moves,
 * the disc just samples thinner. The mass per particle is derived from the count
 * on every path, so the total stays put and the rotation curve does not flinch.
 *
 * Growing cannot be. The slots past the live count are still holding whatever
 * the last seed left there and have not been integrated since, so raising the
 * count without a re-seed drops a pristine cold disc on top of an evolved one
 * and the two sit there counter-rotating. So growing restarts, and that is a CPU
 * seed of the whole buffer plus the upload behind it — tens of milliseconds,
 * nowhere near per-input-event cheap.
 */
function applyCount(disc: number) {
  const n = withOuterField(disc);
  const grew = n > sim.count;
  sim.count = n;
  backend.setCount(n);
  countLabel.textContent = countText(disc);
  // The row set is built from sim.count, and the banner quotes it.
  refreshFilter();
  if (grew) {
    // Without the flip [R] does: resizing the population is not a request to see
    // the other spin sense, and silently swapping it would break the one thing
    // the collision restart is for.
    if (mode === COLLISION) restartCollision(false);
    else restart();
  }
  if (arm === 'gpu') refreshBanner();
}

countInput.value = String(countToSlider(COUNT_DEFAULT));
// Both events, because the two directions cost different things — see
// applyCount(). `input` fires continuously through the drag and applies
// everything that is free, which is the whole downward half of the travel: drag
// left and the population thins and the frame time falls under the cursor, live.
// Upward it moves the label only, and `change` — one event, on release — is what
// actually grows the population and pays for the re-seed. So the number is
// always live, the picture is live whenever it can be, and a drag never fires
// more than one restart no matter how far it travels.
countInput.addEventListener('input', () => {
  const disc = Math.round(countFromSlider(+countInput.value));
  if (withOuterField(disc) < sim.count) applyCount(disc);
  else countLabel.textContent = countText(disc);
});
countInput.addEventListener('change', () => {
  applyCount(Math.round(countFromSlider(+countInput.value)));
});
countRow.append(countLabel, countInput);
head.appendChild(countRow);

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

// --- dark halo, halo disc only --------------------------------------------
//
// The third slider and the only one that changes what a mode *is* rather than
// how hard it runs. Mode 5 is mode 0 with a rigid extended halo added, and this
// is that halo's mass: at zero the two modes are the same simulation, and at the
// top the galaxy is halo-dominated everywhere.
//
// Two things should follow as it comes up, and they are the two arguments for
// dark matter in the order they were historically made.
//
// The first is measured. The outer field stops falling off: sampled at 0.90,
// mean speed runs 1.17 at r = 1.0 to 1.09 at r = 1.75, against 0.79 to 0.60 for
// the same disc with no halo — a 7% decline where the bare version drops 24%,
// which is Keplerian to within the noise. The field is seeded and stepped on the
// same curve, so that is a flat rotation curve rather than a drawing of one. The
// default has since moved up to 1.30, which is flatter still; see M_HALO in
// sim/world.ts for why that number and not this one.
//
// The second is not measured and is written here as the expectation it is. The
// halo raises the epicyclic frequency without adding anything the disc can
// amplify, so the disc should also settle — weaker arms, no bar, and the
// whole-disc ringing that the cold end of the cooling slider produces damping
// out. That is the Ostriker & Peebles argument, and it is why halos were held to
// be dynamically necessary rather than merely observed. Confirming it needs a
// headless run long enough to measure A(m=2) and the core fraction the way
// M_DISC in sim/world.ts was measured; sampling it through the live readback
// path does not work, because the sidebar is already using that buffer.
//
// Linear travel, unlike the other two: this one is a mass fraction and the eye
// reads it as a fraction, so the interesting range is the whole range.
//
// Dragging it re-poses the question without re-seeding, so the existing orbits
// are suddenly wrong for the new curve and the disc breathes outward as it
// re-circularizes — the same behavior the core-gravity slider has. [R] re-seeds
// on the curve it currently has, which is the clean comparison.
let haloValue = M_HALO;

const haloRow = document.createElement('div');
haloRow.className = 'control';
const haloLabel = document.createElement('label');
haloLabel.htmlFor = 'halo';
const haloInput = document.createElement('input');
haloInput.type = 'range';
haloInput.id = 'halo';
haloInput.min = '0';
haloInput.max = '1000';

function applyHalo(v: number) {
  haloValue = v;
  // Only written through when a mode that has a halo is up. The setter is the
  // world's and every disc mode shares that force law, so writing it from here
  // while mode 0 is on screen would silently give mode 0 a halo — which is the
  // one thing the comparison cannot survive.
  if (MODES[mode].halo) setHaloMass(v);
  haloLabel.textContent =
    v <= 1e-6
      ? 'dark halo · none — bare disc, same as mode 0'
      : `dark halo · ${v.toFixed(2)} — ${(haloShare(v) * 100).toFixed(0)}% of v² at the disc edge`;
}
haloInput.value = String((haloValue / M_HALO_MAX) * 1000);
haloInput.addEventListener('input', () => applyHalo((+haloInput.value / 1000) * M_HALO_MAX));
haloRow.append(haloLabel, haloInput);
head.appendChild(haloRow);

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
    (MODES[mode].hold === 'none' ? '' : 'drag to pull · ') +
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

/**
 * The mode the page boots into.
 *
 * HALO rather than SELFGRAV, which is the mode after it minus one term. Both are
 * the same disc and the same seeding, so this is not a change of subject — it is
 * a choice about which of the two is the picture and which is the comparison,
 * and the halo makes the better one: it flattens the rotation curve, so the
 * outer field turns as a wheel instead of falling off Keplerian, and it takes
 * away the disc's ability to run away with itself, so what is on screen after
 * two minutes still resembles what was on screen after ten seconds. [M] steps
 * straight to the bare disc to take the halo away, which is the direction the
 * comparison reads in anyway — you show the galaxy, then remove the thing
 * holding it together.
 *
 * Both backends construct themselves seeded for SELFGRAV, so booting elsewhere
 * costs one extra seed-and-upload at startup; setMode() at the bottom of this
 * file is what pays it, and it has to be setMode() rather than an assignment
 * because the halo mass must reach the world before the re-seed reads it.
 */
let mode = HALO;

// The colliding pair. One object, mutated in place and held by reference on all
// sides, so the per-frame cost of the whole encounter is two bodies of leapfrog.
const pair = createPair();
backend.setPair(pair);

function setMode(next: number) {
  mode = next;
  if (mode === COLLISION) resetPair(pair);
  // Before the backend re-seeds, not after: seeding reads the halo through
  // vCirc(), so a disc placed while this still says zero would be placed on the
  // bare rotation curve and then integrated inside a halo. See haloMass() in
  // sim/world.ts. Cleared on the way out for the same reason — every disc mode
  // shares one force law, and the halo is what makes this one a different mode.
  setHaloMass(MODES[mode].halo ? haloValue : 0);
  backend.setMode(mode);
  // Which re-seeds — so the cursor goes back out of the force law until it is
  // aimed at the new population. See CURSOR_DEADZONE.
  disarmCursor();
  // Unconditionally, because setHolding() is edge-triggered and the pointer is
  // already released by the time we get here: without this the new mode keeps
  // whichever family's rest mass the previous one left in the uniform.
  backend.setCursorMass(cursorMass(holding));
  // The new mode brought its own species banding with it.
  refreshFilter();
  // The slider only means something to the self-gravitating disc; every other
  // mode has a fixed dissipation law of its own.
  coolRow.style.display = MODES[mode].cooling ? '' : 'none';
  // And core gravity only to the fixed-potential disc.
  gravRow.style.display = MODES[mode].gravity ? '' : 'none';
  // And the halo only to the mode that is about having one.
  haloRow.style.display = MODES[mode].halo ? '' : 'none';
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
 *
 * Inclined by default. A disc seen face-on in a widescreen window is a circle
 * with the window's whole width left over either side of it; the same disc at 60
 * degrees projects to an ellipse that fills it. It is also what a disc actually
 * looks like — face-on is the special case, not the norm — so the default view is
 * the honest one and [V] is there to flatten it out when the structure is what
 * you want to read. See cameraZoom() in render/backend.ts for how the tilt turns
 * into a wider picture rather than a shorter one.
 */
let tilted = true;
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
  // A fresh disc is centred on the origin again, and the pointer is wherever it
  // was left — often right on top of it. See CURSOR_DEADZONE.
  disarmCursor();
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
  disarmCursor();
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
applyHalo(M_HALO);
// The population. The backends are constructed at capacity, so this is a shrink
// to the default rather than the page booting into the top of the slider — and a
// shrink costs nothing, which is why there is no reason to thread the default
// through the constructors instead.
applyCount(COUNT_DEFAULT);
// And the mode. setMode() rather than the row-visibility assignments this used
// to do inline, because the mode the page boots into is no longer the one the
// backends seed themselves for: it has a halo, and the halo has to reach the
// world before the re-seed reads it through vCirc(). Everything else setMode()
// does — the per-mode rows, the filter, the banner — was already needed here.
setMode(mode);
// And the camera. Both arms construct themselves face-on, so the default view
// has to be pushed rather than assumed — see `tilted` above.
setTilt(tilted);
setArm('gpu');

// Verification handle. Lets the sim be driven and inspected without relying on
// rAF, so correctness is checkable independently of what the compositor is doing.
(globalThis as any).__demo = {
  sim, backend, baseline, hud, counters, integrateCPU, list, effectRuns, setArm,
  // So the pointer mapping can be checked against the camera it inverts rather
  // than by dragging and squinting.
  screenToSim, cursor: () => [mx, my],
};

let prev = performance.now();

function loop(now: number) {
  hud.frame(now);

  // Clamp dt so a stall doesn't launch every particle out of the box.
  const dt = Math.min((now - prev) / 1000, 1 / 30);
  prev = now;

  // Where the pointer is, in the simulation rather than on the screen. Depends
  // on the mode and the tilt as well as the window, so it is solved here rather
  // than in the pointer handler — see screenToSim() in render/backend.ts.
  //
  // Or nowhere at all, until the pointer has been moved past the deadzone since
  // the last seeding — see CURSOR_DEADZONE above.
  //
  // Except on the plate, which is always armed. The cursor is not a mass there;
  // it is the frequency dial, and parking it at CURSOR_PARK drives n and m to
  // six million rather than out of range of a force law. The plate then renders
  // a lattice far finer than a pixel, which reads as noise until the pointer is
  // moved — a bug, not a neutral idle state.
  [mx, my] = cursorArmed || mode === CHLADNI
    ? screenToSim(px, py, innerWidth, innerHeight, mode, tilted)
    : [CURSOR_PARK, CURSOR_PARK];

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
    baseline.frame(dt, mx, my, grav, cursorMass(holding));
    counters.entities = baseline.count;
    counters.domNodes = baseline.domNodes;
  }

  counters.effectRuns = effectRuns();
  hud.paint(now, counters);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
