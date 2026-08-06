/**
 * Simulation state.
 *
 * Two stores with different jobs, deliberately:
 *
 *  1. `particles` — one interleaved Float32Array (stride 4: x, y, vx, vy). This is
 *     the canonical hot data and is handed to the GPU verbatim. No marshalling step
 *     exists because there is nothing to marshal: the ECS storage *is* the vertex
 *     buffer backing store.
 *
 *  2. A bitecs world holding queryable per-entity tags (species, a scalar stat).
 *     This is what the sidebar filters on. bitecs earns its place here — for the
 *     position integration it would only be overhead, so it isn't used there.
 */

import { createWorld, addEntity, addComponent, query, type World } from 'bitecs';

export const STRIDE = 4; // x, y, vx, vy
export const SPECIES_COUNT = 6;

export const SPECIES_NAMES = [
  'argon',
  'boron',
  'cesium',
  'dysprosium',
  'erbium',
  'fermium',
] as const;

export interface Sim {
  world: World;
  /** Interleaved x, y, vx, vy — length = capacity * STRIDE. */
  particles: Float32Array<ArrayBuffer>;
  /** Entity ids, index-aligned with the particle slots. */
  eids: Uint32Array;
  capacity: number;
  count: number;
}

/** Species tag, SoA. bitecs 0.4 components are plain refs you own. */
export let Species: { id: Uint8Array };
/** A scalar the sidebar sorts and filters on. */
export let Stat: { value: Float32Array };

/**
 * Deterministic PRNG so a demo run is reproducible — a perf comparison between
 * two arms is meaningless if they get different starting conditions.
 */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(capacity: number, seed = 0x9e3779b9): Sim {
  const world = createWorld();
  const particles = new Float32Array(capacity * STRIDE);
  const eids = new Uint32Array(capacity);

  Species = { id: new Uint8Array(capacity + 1) };
  Stat = { value: new Float32Array(capacity + 1) };

  const rand = mulberry32(seed);

  for (let i = 0; i < capacity; i++) {
    const o = i * STRIDE;
    // Start in a disc so the initial frame reads as a structure, not noise.
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.65;
    particles[o] = Math.cos(a) * r;
    particles[o + 1] = Math.sin(a) * r;
    // Tangential velocity — gives the cloud a coherent rotation on frame one.
    particles[o + 2] = -Math.sin(a) * r * 0.35;
    particles[o + 3] = Math.cos(a) * r * 0.35;

    const eid = addEntity(world);
    eids[i] = eid;

    const sp = (rand() * SPECIES_COUNT) | 0;
    Species.id[eid] = sp;
    Stat.value[eid] = rand();

    addComponent(world, eid, Species);
    addComponent(world, eid, Stat);
  }

  return { world, particles, eids, capacity, count: capacity };
}

/**
 * CPU reference integration. Kept as the measured baseline for the GPU path —
 * the headline number in this demo is the delta between this and the compute
 * shader, so this has to be a *fair* implementation, not a strawman.
 *
 * Allocation-free, monomorphic, single pass over contiguous memory.
 */
export function integrateCPU(sim: Sim, dt: number, mx: number, my: number) {
  const p = sim.particles;
  const n = sim.count;
  const damp = 0.9992;

  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const x = p[o];
    const y = p[o + 1];

    const dx = mx - x;
    const dy = my - y;
    // Identical force law to the GPU paths — a comparison between arms is only
    // meaningful if they are doing the same arithmetic.
    const d2 = dx * dx + dy * dy + 0.004;
    const r = Math.sqrt(d2);
    const f = 0.45 / (d2 * r) - 0.0025 / (d2 * d2);
    const tx = -dy / r;
    const ty = dx / r;

    let vx = (p[o + 2] + dx * f * dt + tx * 0.28 * dt) * damp;
    let vy = (p[o + 3] + dy * f * dt + ty * 0.28 * dt) * damp;

    let nx = x + vx * dt;
    let ny = y + vy * dt;

    // Reflect at the unit box so the population stays bounded and visible.
    if (nx < -1) { nx = -1; vx = -vx; } else if (nx > 1) { nx = 1; vx = -vx; }
    if (ny < -1) { ny = -1; vy = -vy; } else if (ny > 1) { ny = 1; vy = -vy; }

    p[o] = nx;
    p[o + 1] = ny;
    p[o + 2] = vx;
    p[o + 3] = vy;
  }
}

/** Entities matching the current species filter, for the sidebar. */
export function queryBySpecies(sim: Sim): readonly number[] {
  return query(sim.world, [Species, Stat]) as unknown as readonly number[];
}
