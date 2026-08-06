import './style.css';
import { Hud, type HudCounters } from './hud';
import {
  createSim,
  integrateCPU,
  SPECIES_NAMES,
  SPECIES_COLORS,
  G_CURSOR,
  G_CURSOR_HELD,
} from './sim/world';
import { VirtualList } from './ui/list';
import { speciesMask, toggleSpecies, filterLabel, countEffect, effectRuns, arm } from './ui/state';
import type { Backend } from './render/backend';
import { createWebGPUBackend } from './render/webgpu';
import { createWebGL2Backend } from './render/webgl2';
import { BaselineArm, BASELINE_COUNT } from './baseline';
import { createPair, resetPair, stepPair, pairSeparation } from './sim/pair';

// 50k was the number the original brief asked for, but CPU integration of 50k
// typed-array particles costs well under a millisecond — there is no bottleneck
// to relieve at that scale. ?n= makes the crossover measurable rather than
// assumed. See README for the measured curve.
const params = new URLSearchParams(location.search);
const CAPACITY = Math.max(1, Number(params.get('n')) || 1_000_000);

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const hud = new Hud(document.getElementById('hud')!);
const sim = createSim(CAPACITY);

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
let held = false;
addEventListener('pointermove', (e) => {
  mx = (e.clientX / innerWidth) * 2 - 1;
  my = -((e.clientY / innerHeight) * 2 - 1);
});

const backend = await selectBackend();
backend.setCount(CAPACITY);

// Hold to make the cursor heavy. A light perturber raises a wake the disc
// recovers from; a near-core mass raises tidal tails and a bridge, and that is
// the whole of the interaction budget — one bit, but it spans both regimes.
// Clicks on the sidebar chips are excluded: those already mean something else.
function setHeld(next: boolean) {
  if (held === next) return;
  held = next;
  backend.setCursorMass(held ? G_CURSOR_HELD : G_CURSOR);
}
addEventListener('pointerdown', (e) => {
  if (!(e.target as HTMLElement)?.closest?.('#sidebar')) setHeld(true);
});
addEventListener('pointerup', () => setHeld(false));
addEventListener('pointercancel', () => setHeld(false));
// Releasing outside the window otherwise leaves the mass stuck on.
addEventListener('blur', () => setHeld(false));
counters.backend = `${backend.name} · ${backend.detail}`;

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

// The only thing the reactive graph drives. Culling the population itself is a
// single uniform written to the GPU — not a pass over a million particles.
countEffect(() => {
  const mask = speciesMask();
  for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('off', !(mask & (1 << i)));
  backend.setSpeciesMask(mask);
  list.refilter();
  summary.textContent = `${list.rowCount.toLocaleString()} rows · ${filterLabel()}`;
});

// --- A/B toggle -----------------------------------------------------------

const banner = document.createElement('div');
banner.id = 'banner';
document.body.appendChild(banner);

const MODE_COUNT = 3;
const modeLabel = () =>
  mode === 1
    ? 'Chladni plate · 6 frequencies'
    : mode === 2
      ? `galaxy collision · ${pair.spin1 > 0 ? 'prograde' : 'retrograde'}`
      : 'barred galaxy';

function refreshBanner() {
  banner.textContent =
    `${backend.name} compute · ${sim.count.toLocaleString()} particles · ${modeLabel()} — ` +
    (mode === 2
      ? `[M] mode · [B] compare · [R] flip spin · hold to pull`
      : `[M] mode · [B] compare · [R] reset · hold to pull`);
}

function setArm(next: 'gpu' | 'baseline') {
  arm(next);
  if (next === 'baseline') {
    // Compare within the current mode: the naive arm runs the same force law the
    // GPU arm is running, not whichever one it happened to be written against.
    baseline.setMode(mode, pair);
    baseline.start();
    canvas.style.display = 'none';
    banner.textContent =
      `naive DOM · ${BASELINE_COUNT.toLocaleString()} particles as elements · ` +
      `${modeLabel()} · sidebar rebuilt per frame — press [B]`;
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

let mode = 0;

// The colliding pair. One object, mutated in place and held by reference on both
// sides, so the per-frame cost of the whole encounter is two bodies of leapfrog.
const pair = createPair();
backend.setPair(pair);

function setMode(next: number) {
  mode = next;
  if (mode === 2) resetPair(pair);
  backend.setMode(mode);
  if (arm() === 'gpu') refreshBanner();
  // Switching mode while comparing should switch the thing being compared.
  else setArm('baseline');
}

/**
 * Re-seed whatever is running. `R` means restart in every mode, not just the one
 * that happens to have an ending.
 */
function restart() {
  if (mode === 2) {
    restartCollision();
    return;
  }
  backend.setMode(mode);
  if (arm() === 'baseline') baseline.setMode(mode, pair);
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
  backend.setMode(2);
  if (arm() === 'baseline') baseline.setMode(2, pair);
  refreshBanner();
}

addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') setArm(arm() === 'gpu' ? 'baseline' : 'gpu');
  if (e.key === 'm' || e.key === 'M') setMode((mode + 1) % MODE_COUNT);
  if (e.key === 'r' || e.key === 'R') restart();
});

/**
 * Whether the sidebar is on screen, per the media query in style.css.
 *
 * Read once per resize and cached, not per frame: getComputedStyle forces a
 * style recalc, and a demo whose whole claim is that it touches the DOM 33 times
 * would be a poor place to do that sixty times a second. `offsetParent` would be
 * the cheap test and is wrong here — it is null for any position:fixed element,
 * visible or not, which silently disabled the list.
 */
const sidebar = document.getElementById('sidebar')!;
let sidebarVisible = true;
function readSidebarVisible() {
  sidebarVisible = getComputedStyle(sidebar).display !== 'none';
}

function fit() {
  const dpr = Math.min(devicePixelRatio, 2);
  backend.resize((innerWidth * dpr) | 0, (innerHeight * dpr) | 0);
}
readSidebarVisible();
addEventListener('resize', () => {
  fit();
  const wasHidden = !sidebarVisible;
  readSidebarVisible();
  // Coming back from a hidden sidebar leaves the recycled pool stale.
  if (wasHidden && sidebarVisible && arm() === 'gpu') list.forceRepaint();
});
fit();
setArm('gpu');

// Verification handle. Lets the sim be driven and inspected without relying on
// rAF, so correctness is checkable independently of what the compositor is doing.
(globalThis as any).__demo = { sim, backend, hud, counters, integrateCPU, list, effectRuns, setArm };

let prev = performance.now();

function loop(now: number) {
  hud.frame(now);

  // Clamp dt so a stall doesn't launch every particle out of the box.
  const dt = Math.min((now - prev) / 1000, 1 / 30);
  prev = now;

  // The encounter is over once the cores are well separated and receding, or if
  // they have gone quiet; loop it rather than leaving a spent remnant on screen.
  if (mode === 2) {
    stepPair(pair, dt);
    if (pair.elapsed > 6 && (pairSeparation(pair) > 2.4 || pair.elapsed > 42)) {
      restartCollision();
    }
  }

  if (arm() === 'gpu') {
    backend.frame(dt, mx, my);
    // Skip the list entirely while the sidebar is hidden — its readback and row
    // writes are pure cost when nothing can see them.
    if (sidebarVisible) list.update();
    counters.entities = sim.count;
    counters.domNodes = list.liveNodes;
  } else {
    baseline.frame(dt, mx, my, held ? G_CURSOR_HELD : G_CURSOR);
    counters.entities = baseline.count;
    counters.domNodes = baseline.domNodes;
  }

  counters.effectRuns = effectRuns();
  hud.paint(now, counters);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
