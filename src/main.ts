import './style.css';
import { Hud, type HudCounters } from './hud';
import { createSim, integrateCPU, SPECIES_NAMES } from './sim/world';
import { VirtualList } from './ui/list';
import { speciesMask, toggleSpecies, filterLabel, countEffect, effectRuns } from './ui/state';
import type { Backend } from './render/backend';
import { createWebGPUBackend } from './render/webgpu';
import { createWebGL2Backend } from './render/webgl2';

// 50k is the number the original brief asked for, but CPU integration of 50k
// typed-array particles costs well under a millisecond — there is no bottleneck
// to relieve at that scale. ?n= makes the crossover point measurable instead of
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

// ?backend=webgl2 forces the fallback so it can actually be verified rather
// than assumed to work.
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
  // Normalize to the clip space the shaders work in.
  mx = (e.clientX / innerWidth) * 2 - 1;
  my = -((e.clientY / innerHeight) * 2 - 1);
});

const backend = await selectBackend();
backend.setCount(CAPACITY);
counters.entities = CAPACITY;
counters.backend = `${backend.name} · ${backend.detail}`;

function fit() {
  const dpr = Math.min(devicePixelRatio, 2);
  backend.resize((innerWidth * dpr) | 0, (innerHeight * dpr) | 0);
}
addEventListener('resize', fit);
fit();

const list = new VirtualList(
  document.getElementById('list-viewport')!,
  document.getElementById('list-spacer')!,
  sim,
  backend,
);

// Species filter chips. This is the only thing the reactive graph drives.
const head = document.getElementById('sidebar-head')!;
const chips = SPECIES_NAMES.map((name, i) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = name;
  b.addEventListener('click', () => toggleSpecies(i));
  head.appendChild(b);
  return b;
});

const summary = document.createElement('div');
summary.className = 'summary';
head.appendChild(summary);

countEffect(() => {
  const mask = speciesMask();
  for (let i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('off', !(mask & (1 << i)));
  }
  list.refilter();
  summary.textContent = `${list.rowCount.toLocaleString()} rows · ${filterLabel()}`;
});

// Verification handle. Lets the sim be driven and inspected without relying on
// rAF, so correctness is checkable independently of what the compositor is doing.
(globalThis as any).__demo = { sim, backend, hud, counters, integrateCPU, list, effectRuns };

let prev = performance.now();

function loop(now: number) {
  hud.frame(now);

  // Clamp dt so a stall doesn't launch every particle out of the box.
  const dt = Math.min((now - prev) / 1000, 1 / 30);
  prev = now;

  backend.frame(dt, mx, my);
  list.update();

  counters.domNodes = list.liveNodes;
  counters.effectRuns = effectRuns();
  hud.paint(now, counters);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
