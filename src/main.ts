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

const modeLabel = () => (mode === 1 ? 'Chladni plate · 6 frequencies' : 'orbital galaxy');

function refreshBanner() {
  banner.textContent =
    `${backend.name} compute · ${sim.count.toLocaleString()} particles · ${modeLabel()} — ` +
    `[M] mode · [B] compare · hold to pull`;
}

function setArm(next: 'gpu' | 'baseline') {
  arm(next);
  if (next === 'baseline') {
    // Compare within the current mode: the naive arm runs the same force law the
    // GPU arm is running, not whichever one it happened to be written against.
    baseline.setMode(mode);
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
function setMode(next: number) {
  mode = next;
  backend.setMode(mode);
  if (arm() === 'gpu') refreshBanner();
  // Switching mode while comparing should switch the thing being compared.
  else setArm('baseline');
}

addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') setArm(arm() === 'gpu' ? 'baseline' : 'gpu');
  if (e.key === 'm' || e.key === 'M') setMode(mode === 0 ? 1 : 0);
});

function fit() {
  const dpr = Math.min(devicePixelRatio, 2);
  backend.resize((innerWidth * dpr) | 0, (innerHeight * dpr) | 0);
}
addEventListener('resize', fit);
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

  if (arm() === 'gpu') {
    backend.frame(dt, mx, my);
    list.update();
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
