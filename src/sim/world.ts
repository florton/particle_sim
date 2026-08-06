/**
 * Simulation state.
 *
 * `particles` is one interleaved Float32Array (stride 4: x, y, vx, vy). It is the
 * canonical hot data and is handed to the GPU verbatim — there is no marshalling
 * step because the ECS storage *is* the buffer backing store.
 *
 * Per-entity tags (species, stat) live in parallel typed arrays indexed by
 * particle slot. Entity id and slot index are the same number.
 *
 * On the absence of bitecs: an earlier revision created one bitecs entity per
 * particle. At 1M that cost ~650 ms of blocking startup and bought nothing —
 * nothing here queries relationally, and the component data was already plain
 * typed arrays. It was measured, it lost, it was removed. The data-oriented part
 * of "data-oriented ECS" is the memory layout below, not the library.
 */

export const STRIDE = 4; // x, y, vx, vy

/** Restitution at the box walls. Shared by all three integrators. */
export const BOUNCE = 0.45;
/** Primary attractor strength, fixed at the origin. */
export const G_CORE = 0.55;
/** Cursor mass — a fraction of the core, so it perturbs rather than destroys. */
export const G_CURSOR = 0.1;
/** Terminal speed. */
export const V_MAX = 3.0;
/** Radial-velocity retention per step. Circularizes orbits without killing them. */
export const RADIAL_DAMP = 0.995;
export const SPECIES_COUNT = 6;

export const SPECIES_NAMES = [
  'argon',
  'boron',
  'cesium',
  'dysprosium',
  'erbium',
  'fermium',
] as const;

/**
 * Species palette, linear RGB. Mirrored verbatim in the WGSL and GLSL shaders —
 * keep the three in sync. Chosen to stay distinguishable under additive blending,
 * where everything drifts toward white as density climbs.
 */
export const SPECIES_COLORS: readonly [number, number, number][] = [
  [0.29, 0.62, 1.0], // argon — blue
  [1.0, 0.45, 0.62], // boron — rose
  [0.42, 1.0, 0.72], // cesium — mint
  [1.0, 0.76, 0.33], // dysprosium — amber
  [0.72, 0.55, 1.0], // erbium — violet
  [0.35, 0.95, 1.0], // fermium — cyan
];

export interface Sim {
  /** Interleaved x, y, vx, vy — length = capacity * STRIDE. */
  particles: Float32Array<ArrayBuffer>;
  /** Species index per slot. */
  species: Uint8Array;
  /** Scalar per slot, used by the sidebar. */
  stat: Float32Array;
  capacity: number;
  count: number;
}

/**
 * Deterministic PRNG so a run is reproducible — comparing two arms is
 * meaningless if they get different starting conditions.
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
  const particles = new Float32Array(capacity * STRIDE);
  const species = new Uint8Array(capacity);
  const stat = new Float32Array(capacity);
  const rand = mulberry32(seed);

  for (let i = 0; i < capacity; i++) {
    const o = i * STRIDE;
    // Start in a disc so frame one reads as a structure rather than noise.
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.65;
    particles[o] = Math.cos(a) * r;
    particles[o + 1] = Math.sin(a) * r;

    // Circular-orbit velocity for the force law below: v = sqrt(G / r).
    //
    // This matters more than it looks. Seeding with an arbitrary tangential
    // speed makes every particle fall inward, slingshot, and randomize against
    // the walls — after a minute the whole field decays to uniform noise. Seeded
    // on-orbit, the disc is stable indefinitely. Slightly sub-orbital (0.94) so
    // it precesses into spiral arms instead of sitting as a featureless annulus.
    const vOrb = Math.sqrt(G_CORE / Math.max(r, 0.06)) * 0.94;
    particles[o + 2] = -Math.sin(a) * vOrb;
    particles[o + 3] = Math.cos(a) * vOrb;

    // Species banded by radius: the galaxy reads as composed rings rather than
    // uniform confetti, and the filter chips then carve visible structure.
    const band = (r / 0.65) * SPECIES_COUNT;
    const jitter = (rand() - 0.5) * 1.6;
    species[i] = Math.max(0, Math.min(SPECIES_COUNT - 1, (band + jitter) | 0));
    stat[i] = rand();
  }

  return { particles, species, stat, capacity, count: capacity };
}

/**
 * CPU reference integration — the measured baseline for the GPU path. It has to
 * be a fair implementation, not a strawman: allocation-free, monomorphic, one
 * pass over contiguous memory.
 */
export function integrateCPU(sim: Sim, dt: number, mx: number, my: number) {
  const p = sim.particles;
  const n = sim.count;
  const damp = 0.99995;

  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const x = p[o];
    const y = p[o + 1];

    // Identical force law to the GPU paths — a comparison between arms is only
    // meaningful if they are doing the same arithmetic.
    //
    // Primary at the origin holds the disc; the cursor is a weaker secondary
    // that perturbs it. See webgpu.ts for why the cursor is not the primary.
    const cx = -x;
    const cy = -y;
    const dc2 = cx * cx + cy * cy + 0.004;
    const rc = Math.sqrt(dc2);
    const fc = G_CORE / (dc2 * rc) - 0.0025 / (dc2 * dc2);

    const dx = mx - x;
    const dy = my - y;
    const dm2 = dx * dx + dy * dy + 0.02;
    const fm = G_CURSOR / (dm2 * Math.sqrt(dm2));

    // No constant tangential term: it pumps energy in every frame regardless of
    // position, which is what cooked the disc into uniform noise. Rotation comes
    // from the orbital seed instead.
    let vx = p[o + 2] + cx * fc * dt + dx * fm * dt;
    let vy = p[o + 3] + cy * fc * dt + dy * fm * dt;

    // Radial-only damping — see webgpu.ts for why uniform damping collapses the
    // disc into a ball instead of holding it open.
    const rdx = cx / rc;
    const rdy = cy / rc;
    const vr = vx * rdx + vy * rdy;
    vx = (vx - vr * rdx) + vr * rdx * RADIAL_DAMP;
    vy = (vy - vr * rdy) + vr * rdy * RADIAL_DAMP;
    vx *= damp;
    vy *= damp;

    const speed = Math.hypot(vx, vy);
    if (speed > V_MAX) {
      vx *= V_MAX / speed;
      vy *= V_MAX / speed;
    }

    let nx = x + vx * dt;
    let ny = y + vy * dt;

    // Reflect at the unit box, bleeding energy on contact. A perfectly elastic
    // wall lets escapees accumulate speed and slowly randomize the field.
    if (nx < -1) { nx = -1; vx = -vx * BOUNCE; } else if (nx > 1) { nx = 1; vx = -vx * BOUNCE; }
    if (ny < -1) { ny = -1; vy = -vy * BOUNCE; } else if (ny > 1) { ny = 1; vy = -vy * BOUNCE; }

    p[o] = nx;
    p[o + 1] = ny;
    p[o + 2] = vx;
    p[o + 3] = vy;
  }
}
