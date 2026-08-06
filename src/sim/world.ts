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

import { PAIR_DISC_R, PAIR_MASS, type PairState } from './pair';

export const STRIDE = 4; // x, y, vx, vy

/** Primary attractor strength, fixed at the origin. */
export const G_CORE = 0.55;
/**
 * Cursor mass while the pointer is merely moving. A fraction of the core, so it
 * perturbs rather than destroys and the disc can relax back after a pass.
 */
export const G_CURSOR = 0.2;
/**
 * Cursor mass while the pointer is held down. Comparable to the core, which is
 * the regime where an encounter stops being a ripple and starts throwing tidal
 * tails and a bridge — Toomre's prograde-encounter result, driven by hand.
 */
export const G_CURSOR_HELD = 0.6;
/** Terminal speed. */
export const V_MAX = 3.0;
/**
 * Radial-velocity retention per step, inside and outside the disc. Dissipation
 * is a function of radius — see the note in render/webgpu.ts for the measurement
 * that forced it to be.
 */
export const DAMP_INNER = 0.9995;
export const DAMP_OUTER = 0.995;
export const SPECIES_COUNT = 6;

/**
 * Rotating bar. See the derivation in `render/webgpu.ts` — these three numbers
 * are mirrored into both shaders and must stay in sync with them.
 *
 * `BAR_OMEGA` is the pattern speed, chosen so corotation lands at r ≈ 0.58,
 * inside the disc edge: that puts the inner Lindblad resonance well within the
 * bar and the outer one near r ≈ 0.9, so both rings are on screen at once.
 */
export const BAR_OMEGA = 1.6;
/** Quadrupole strength — about a 15% perturbation on the monopole at r ≈ 0.4. */
export const BAR_K = 0.045;
/** Bar radial scale, squared. Beyond this the perturbation falls away. */
export const BAR_A2 = 0.35 * 0.35;
/** Past this radius a particle is recycled rather than bounced off the box. */
export const ESCAPE_R = 1.15;
/** Each species comes back into its own annulus inside this band. */
export const RETURN_LO = 0.04;
export const RETURN_HI = 0.80;
/** And is recycled once it falls to this fraction of its own home radius. */
export const CORE_FRAC = 0.28;
/**
 * How far a home radius may wander from its species' centre, in species widths.
 * Over one, so the bands overlap and no edge between two colours is anywhere —
 * see homeRadius() in render/webgpu.ts.
 */
export const SPECIES_SPREAD = 1.6;

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
    const r = Math.max(0.03, Math.sqrt(rand()) * 0.65);
    particles[o] = Math.cos(a) * r;
    particles[o + 1] = Math.sin(a) * r;

    // Circular-orbit velocity for the force law below: v = sqrt(G / r).
    //
    // This matters more than it looks. Seeding with an arbitrary tangential
    // speed makes every particle fall inward, slingshot, and randomize against
    // the walls — after a minute the whole field decays to uniform noise. Seeded
    // on-orbit, the disc is stable indefinitely. Slightly sub-orbital (0.94) so
    // it precesses into spiral arms instead of sitting as a featureless annulus.
    const vOrb = circularSpeed(r) * 0.94;
    particles[o + 2] = -Math.sin(a) * vOrb;
    particles[o + 3] = Math.cos(a) * vOrb;

    // Species banded by radius: the galaxy reads as composed rings rather than
    // uniform confetti, and the filter chips then carve visible structure. The
    // jitter is wide on purpose: the bands have to overlap, or the disc reads as
    // six authored rings rather than as a population that happens to be sorted.
    const band = (r / 0.65) * SPECIES_COUNT;
    const jitter = (rand() - 0.5) * SPECIES_SPREAD;
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
export function integrateCPU(
  sim: Sim,
  dt: number,
  mx: number,
  my: number,
  time = 0,
  gCursor = G_CURSOR,
) {
  const p = sim.particles;
  const n = sim.count;
  const damp = 0.99995;

  // Bar phase, hoisted: it depends only on time, not on the particle.
  const cp = Math.cos(2 * BAR_OMEGA * time);
  const sp = Math.sin(2 * BAR_OMEGA * time);

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
    const fc = coreF(dc2);

    const dx = mx - x;
    const dy = my - y;
    const dm2 = dx * dx + dy * dy + 0.02;
    const fm = gCursor / (dm2 * Math.sqrt(dm2));

    // Rotating m=2 bar — the gradient of A(r)cos(2(th - OMEGA t)). See
    // render/webgpu.ts for the derivation and for why the disc needs a driving
    // frequency at all. Outward unit vector, then the double angle from it.
    const ux = x / rc;
    const uy = y / rc;
    const c2 = ux * ux - uy * uy;
    const s2 = 2 * ux * uy;
    const cos2 = c2 * cp + s2 * sp;
    const sin2 = s2 * cp - c2 * sp;
    const q = rc * rc + BAR_A2;
    const barA = -BAR_K * rc * rc / (q * q);
    const barD = (-2 * BAR_K * rc * (BAR_A2 - rc * rc)) / (q * q * q);
    const fbr = -barD * cos2;
    const fbt = (2 * barA * sin2) / rc;
    const bx = ux * fbr - uy * fbt;
    const by = uy * fbr + ux * fbt;

    // No constant tangential term: it pumps energy in every frame regardless of
    // position, which is what cooked the disc into uniform noise. Rotation comes
    // from the orbital seed and the bar instead.
    let vx = p[o + 2] + cx * fc * dt + dx * fm * dt + bx * dt;
    let vy = p[o + 3] + cy * fc * dt + dy * fm * dt + by * dt;

    // Radial-only damping — see webgpu.ts for why uniform damping collapses the
    // disc into a ball instead of holding it open.
    const rdx = cx / rc;
    const rdy = cy / rc;
    const vr = vx * rdx + vy * rdy;
    const ds = Math.max(0, Math.min(1, (rc - 0.25) / 0.35));
    const dampR = DAMP_INNER + (DAMP_OUTER - DAMP_INNER) * ds * ds * (3 - 2 * ds);
    vx = (vx - vr * rdx) + vr * rdx * dampR;
    vy = (vy - vr * rdy) + vr * rdy * dampR;
    vx *= damp;
    vy *= damp;

    const speed = Math.hypot(vx, vy);
    if (speed > V_MAX) {
      vx *= V_MAX / speed;
      vy *= V_MAX / speed;
    }

    let nx = x + vx * dt;
    let ny = y + vy * dt;

    // Recycle escapees onto a circular orbit rather than reflecting them off the
    // box — see render/webgpu.ts. Bouncing left a speckle along the edges that
    // nothing ever cleared, and that speckle was most of what read as static.
    // Per-particle inner bound, at half its own home radius — see webgpu.ts.
    const home = homeRadius(sim.species[i], i);
    const floorR = Math.max(0.05, home * CORE_FRAC);
    const pr = Math.hypot(nx, ny);
    if (pr > ESCAPE_R || pr < floorR) {
      const inv = 1 / Math.max(pr, 1e-6);
      const rx = nx * inv;
      const ry = ny * inv;
      const spin = nx * vy - ny * vx >= 0 ? 1 : -1;
      const rr = home;
      const vOrb = circularSpeed(rr) * spin;
      nx = rx * rr;
      ny = ry * rr;
      vx = -ry * vOrb;
      vy = rx * vOrb;
    }

    p[o] = nx;
    p[o + 1] = ny;
    p[o + 2] = vx;
    p[o + 3] = vy;
  }
}

/** Radial acceleration factor of the primary — see coreF() in render/webgpu.ts. */
export function coreF(q: number) {
  return G_CORE / (q * Math.sqrt(q)) - 0.0025 / (q * q);
}

/**
 * Circular-orbit speed under that force, which is not sqrt(G/r). See vCirc() in
 * render/webgpu.ts — inside the softening length the difference is what decides
 * whether the middle holds a bulge or stays a clean dark hole.
 */
export function circularSpeed(r: number) {
  const q = r * r + 0.004;
  return r * Math.sqrt(Math.max(0, coreF(q)));
}

/** Home radius from species, bands overlapping — see render/webgpu.ts. */
export function homeRadius(species: number, i: number) {
  const j = (hash2(i * 11 + 5) - 0.5) * SPECIES_SPREAD;
  const f = Math.min(1, Math.max(0.04, (species + 0.5 + j) / SPECIES_COUNT));
  return RETURN_LO + (RETURN_HI - RETURN_LO) * f;
}

/** Mirrors MODES in both shaders — per-species (n, m) offsets. */
const MODE_OFFSETS = new Float32Array([0, 1, 1, 0, 0, 2, 2, 0, 1, 3, 3, 1]);

function hash2(n: number) {
  let x = Math.imul(n, 747796405) + 2891336453;
  x = Math.imul((x >>> ((x >>> 28) + 4)) ^ x, 277803737);
  return (((x >>> 22) ^ x) >>> 0) / 4294967296;
}

/**
 * Cursor-driven base frequencies. Shared by every arm and backend so they all
 * sweep identically — otherwise the A/B comparison is between two different
 * simulations, which proves nothing.
 */
export function chladniWarp(mx: number, my: number, elapsed: number) {
  const drift = Math.sin(elapsed * 0.11) * 1.4;
  return {
    n: 1 + (mx * 0.5 + 0.5) * 12 + drift,
    m: 1 + (my * 0.5 + 0.5) * 12 + drift,
  };
}

/**
 * CPU reference for the Chladni plate — same math as the WGSL chladni function.
 * Without this the naive arm ran galaxy physics behind a plate-labelled banner,
 * which would have made the comparison a lie in one of the two modes.
 */
export function integrateChladniCPU(
  sim: Sim,
  dt: number,
  warpN: number,
  warpM: number,
  time: number,
) {
  const p = sim.particles;
  const n = sim.count;
  const tick = (time * 60) | 0;

  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const sp = sim.species[i];
    const fn = warpN + MODE_OFFSETS[sp * 2];
    const fm = warpM + MODE_OFFSETS[sp * 2 + 1];

    const u = (p[o] + 1) * 0.5;
    const v = (p[o + 1] + 1) * 0.5;

    const cnu = Math.cos(fn * Math.PI * u);
    const cmv = Math.cos(fm * Math.PI * v);
    const cmu = Math.cos(fm * Math.PI * u);
    const cnv = Math.cos(fn * Math.PI * v);

    const w = cnu * cmv - cmu * cnv;
    const dwdu =
      -fn * Math.PI * Math.sin(fn * Math.PI * u) * cmv +
      fm * Math.PI * Math.sin(fm * Math.PI * u) * cnv;
    const dwdv =
      -fm * Math.PI * cnu * Math.sin(fm * Math.PI * v) +
      fn * Math.PI * cmu * Math.sin(fn * Math.PI * v);

    const s = Math.sign(w) * 0.5;
    const amp = Math.abs(w);
    const jx = hash2(i * 2 + tick) - 0.5;
    const jy = hash2(i * 2 + 1 + tick) - 0.5;

    const vx = (p[o + 2] - dwdu * s * 2.4 * dt + jx * amp * 2.2 * dt) * 0.86;
    const vy = (p[o + 3] - dwdv * s * 2.4 * dt + jy * amp * 2.2 * dt) * 0.86;

    p[o] = Math.max(-1, Math.min(1, p[o] + vx * dt));
    p[o + 1] = Math.max(-1, Math.min(1, p[o + 1] + vy * dt));
    p[o + 2] = vx;
    p[o + 3] = vy;
  }
}

/**
 * CPU reference for the collision — the naive arm has to run the same force law
 * in every mode, or the A/B comparison is a comparison between two different
 * simulations. Two softened point masses plus the cursor; no walls, no
 * recycling, because a tidal tail is material genuinely leaving.
 */
export function integrateCollisionCPU(
  sim: Sim,
  dt: number,
  mx: number,
  my: number,
  pair: PairState,
  gCursor = G_CURSOR,
) {
  const p = sim.particles;
  const n = sim.count;

  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const x = p[o];
    const y = p[o + 1];

    const ax = pair.x0 - x;
    const ay = pair.y0 - y;
    const qa = ax * ax + ay * ay + 0.004;
    const fa = PAIR_MASS / (qa * Math.sqrt(qa));

    const bx = pair.x1 - x;
    const by = pair.y1 - y;
    const qb = bx * bx + by * by + 0.004;
    const fb = PAIR_MASS / (qb * Math.sqrt(qb));

    const cx = mx - x;
    const cy = my - y;
    const qc = cx * cx + cy * cy + 0.02;
    const fc = gCursor / (qc * Math.sqrt(qc));

    let vx = p[o + 2] + (ax * fa + bx * fb + cx * fc) * dt;
    let vy = p[o + 3] + (ay * fa + by * fb + cy * fc) * dt;

    const speed = Math.hypot(vx, vy);
    if (speed > V_MAX) {
      vx *= V_MAX / speed;
      vy *= V_MAX / speed;
    }

    p[o] = x + vx * dt;
    p[o + 1] = y + vy * dt;
    p[o + 2] = vx;
    p[o + 3] = vy;
  }
}

/** Re-seed the first `n` slots for a mode. Used by the naive arm on switch. */
export function reseed(sim: Sim, n: number, mode: number, pair?: PairState) {
  const p = sim.particles;
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    if (mode === 2 && pair) {
      // Two discs, interleaved by parity — mirrors the WGSL scatter pass.
      const g = i & 1;
      const a = Math.random() * Math.PI * 2;
      const j = (Math.random() - 0.5) * SPECIES_SPREAD;
      const f = Math.min(1, Math.max(0.02, (sim.species[i] + 0.5 + j) / SPECIES_COUNT));
      const r = Math.max(0.05, PAIR_DISC_R * Math.sqrt(f));
      const vOrb = Math.sqrt(PAIR_MASS / r) * (g ? pair.spin1 : 1);
      p[o] = (g ? pair.x1 : pair.x0) + Math.cos(a) * r;
      p[o + 1] = (g ? pair.y1 : pair.y0) + Math.sin(a) * r;
      p[o + 2] = (g ? pair.vx1 : pair.vx0) - Math.sin(a) * vOrb;
      p[o + 3] = (g ? pair.vy1 : pair.vy0) + Math.cos(a) * vOrb;
    } else if (mode === 1) {
      p[o] = Math.random() * 2 - 1;
      p[o + 1] = Math.random() * 2 - 1;
      p[o + 2] = 0;
      p[o + 3] = 0;
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = Math.max(0.03, Math.sqrt(Math.random()) * 0.65);
      const vOrb = circularSpeed(r) * 0.94;
      p[o] = Math.cos(a) * r;
      p[o + 1] = Math.sin(a) * r;
      p[o + 2] = -Math.sin(a) * vOrb;
      p[o + 3] = Math.cos(a) * vOrb;
    }
  }
}
