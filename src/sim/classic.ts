/**
 * The original fixed-potential disc, from `main`.
 *
 * The simplest of the three galaxies and the one the other two were answers to:
 * an anchored monopole, a weak cursor secondary, uniform radial damping, and
 * walls. Nothing drives it and nothing responds to it, so it phase-mixes into a
 * smooth annulus within seconds and stays there — which is exactly what the bar
 * (sim/barred.ts) and the self-gravity (sim/world.ts) were each introduced to
 * fix. Kept as its own mode so the comparison is available rather than
 * described.
 *
 * Mirrored in WGSL (render/webgpu.ts) and GLSL (render/webgl2.ts).
 */

import { BOUNCE, SPECIES_COUNT, STRIDE, type Sim } from './world';

/** Primary attractor strength, fixed at the origin. The default of the slider
 *  below rather than a constant of the mode — see coreGravity(). */
export const G_CORE = 0.55;
/** Cursor mass — a fraction of the core, so it perturbs rather than destroys. */
export const G_CURSOR = 0.1;
/**
 * Cursor mass while the pointer is held down. Switched rather than ramped, which
 * this mode can afford for the same reason the barred disc can: the potential is
 * prescribed and nothing here amplifies its own density contrast, so an impulse
 * stirs the disc instead of collapsing it.
 *
 * Far under the core, and far under the barred disc's 0.75, because this mode has
 * no way back. The barred disc recycles anything it throws past ESCAPE_R and
 * returns it to its home radius; here the only restoring mechanism is radial
 * damping, so whatever a pull takes out of the annulus stays out — and what it
 * takes out first is the species/radius correlation the colour bands *are*.
 *
 * Measured against a 1.2 s pull at the disc edge, watched for six seconds after
 * release. At 0.6 — comparable to the core, the regime the barred disc is tuned
 * in — the disc was a featureless white blob before the pointer came up. At 0.3
 * and at 0.2 it re-formed, but as one saturated annulus with the six colours
 * mixed through it, so the filter chips carved nothing afterward and only [R]
 * brought them back. At 0.15 the same pull opens the disc into a wide spiral of
 * streams that is still visibly banded, and phase-mixes back to an annulus with
 * its colours intact.
 *
 * Only 1.5x the resting mass, which sounds like nothing and is not: the disc is
 * cold, on near-circular orbits, and has no self-gravity holding it together, so
 * it responds to the entire perturbation rather than to the part that exceeds its
 * own binding.
 */
export const G_CURSOR_HELD = 0.15;
/** Terminal speed. */
export const V_MAX = 3.0;
/** Radial-velocity retention per step. Circularizes orbits without killing them. */
export const RADIAL_DAMP = 0.995;
/** Nominal disc radius the species bands are cut against. */
export const R_DISC = 0.65;
/**
 * How far a home radius may wander from its species' centre, in species widths.
 * Over one, so the bands overlap and no edge between two colours is anywhere —
 * see homeRadius() below, and SPECIES_SPREAD in sim/barred.ts for the argument.
 */
export const SPECIES_SPREAD = 1.6;

/**
 * Live core strength, driven by the slider in main.ts. G_CORE is its default.
 *
 * Module state rather than a parameter threaded through every caller, because
 * three separate paths need the same number and two of them have no channel to
 * receive it: the GPU backends read it into a uniform each frame, the CPU
 * baseline integrates with it, and the *seeding* uses it through circularSpeed()
 * — and seeding is reached via seedMode() in sim/modes.ts, which is generic over
 * every mode and has no business carrying one mode's control on its
 * signature. One value, read by everything that needs it, is the smaller thing.
 *
 * Only this mode has it. The self-gravitating disc's stability depends on the
 * ratio between G_CORE and M_DISC (see sim/world.ts), so the same slider there
 * would be a knob that quietly destroys the galaxy; here the potential is fixed
 * and prescribed, so scaling it is exactly a speed control: v = sqrt(G/r).
 */
let gCore = G_CORE;

export function coreGravity() {
  return gCore;
}

export function setCoreGravity(v: number) {
  gCore = v;
}

/**
 * Circular-orbit speed: v = sqrt(G / r), with a floor on r.
 *
 * Deliberately not the softened expression the later modes use. Seeding on the
 * unsoftened Kepler value is what leaves this disc with a hole through the
 * middle — see vCirc() in sim/world.ts. It is part of what this mode is.
 */
export function circularSpeed(r: number) {
  return Math.sqrt(gCore / Math.max(r, 0.06)) * 0.94;
}

/** Cheap per-slot hash, so a home radius is a function of the slot and not of
 *  whichever random stream happens to be seeding it. Mirrors hash2 in
 *  sim/barred.ts and hash() in both shaders. */
function hash2(n: number) {
  let x = Math.imul(n, 747796405) + 2891336453;
  x = Math.imul((x >>> ((x >>> 28) + 4)) ^ x, 277803737);
  return (((x >>> 22) ^ x) >>> 0) / 4294967296;
}

/**
 * The radius a particle belongs at, from its species.
 *
 * The inverse of the banding in seedSpecies() below, and it has to exist for the
 * same reason barred.homeRadius() does: species is drawn *from* radius, so
 * anything that places particles by drawing a radius independently gets a disc
 * where the two are uncorrelated. Measured before this existed, all six species
 * sat at a mean radius of 0.432 with a correlation of -0.001 — six colours
 * smeared evenly over one annulus, which additive blending renders as grey.
 *
 * Uniform-density profile is preserved exactly rather than approximately:
 * seedSpecies draws r = sqrt(u) * R_DISC and bands on r/R_DISC, so mapping the
 * band back through (species + 0.5 + jitter) / SPECIES_COUNT * R_DISC returns
 * the same sqrt-distributed radii it came from. The jitter is the same width, so
 * the bands overlap here too and no edge between two colours is anywhere.
 */
export function homeRadius(species: number, i: number) {
  const j = (hash2(i * 11 + 5) - 0.5) * SPECIES_SPREAD;
  const f = Math.min(1, Math.max(0.03, (species + 0.5 + j) / SPECIES_COUNT));
  return R_DISC * f;
}

/**
 * Seed the whole population: positions, velocities and species in one pass.
 *
 * One pass over one random stream, and that is the entire point of it. Species
 * is banded *from* the radius drawn on the line above, so the two are the same
 * draw and cannot disagree. Splitting this into a seedSpecies() and a reseed()
 * over two streams is what silently removed the colour bands from this mode:
 * measured, all six species sat at a mean radius of 0.432 with a correlation of
 * -0.001 — six colours smeared evenly over one annulus, which additive blending
 * renders as grey. The disc looked right and had no structure in it at all.
 *
 * The draw order is load-bearing beyond that: angle, radius, jitter, stat, four
 * values per particle in that sequence, which is what the original had before
 * this mode was split out into its own file. Same PRNG and same seed, so this
 * reproduces its initial conditions exactly rather than approximately.
 */
export function seedDisc(sim: Sim, rand: () => number) {
  const p = sim.particles;
  for (let i = 0; i < sim.capacity; i++) {
    const o = i * STRIDE;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * R_DISC;
    const vOrb = circularSpeed(r);
    p[o] = Math.cos(a) * r;
    p[o + 1] = Math.sin(a) * r;
    p[o + 2] = -Math.sin(a) * vOrb;
    p[o + 3] = Math.cos(a) * vOrb;

    // Species banded by radius: the galaxy reads as composed rings rather than
    // uniform confetti, and the filter chips then carve visible structure. The
    // jitter is wide on purpose — the bands have to overlap, or the disc reads
    // as six authored rings rather than as a sorted population.
    const band = (r / R_DISC) * SPECIES_COUNT;
    const jitter = (rand() - 0.5) * SPECIES_SPREAD;
    sim.species[i] = Math.max(0, Math.min(SPECIES_COUNT - 1, (band + jitter) | 0));
    sim.stat[i] = rand();
  }
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
  gCursor = G_CURSOR,
) {
  const p = sim.particles;
  const n = sim.count;
  const damp = 0.99995;

  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const x = p[o];
    const y = p[o + 1];

    // Identical force law to the GPU paths — a comparison between arms is only
    // meaningful if they are doing the same arithmetic.
    const cx = -x;
    const cy = -y;
    const dc2 = cx * cx + cy * cy + 0.004;
    const rc = Math.sqrt(dc2);
    // Attraction minus a short-range repulsive core. Without the second term the
    // whole population collapses to a single point.
    const fc = gCore / (dc2 * rc) - 0.0025 / (dc2 * dc2);

    const dx = mx - x;
    const dy = my - y;
    const dm2 = dx * dx + dy * dy + 0.02;
    const fm = gCursor / (dm2 * Math.sqrt(dm2));

    let vx = p[o + 2] + cx * fc * dt + dx * fm * dt;
    let vy = p[o + 3] + cy * fc * dt + dy * fm * dt;

    // Radial-only damping — see webgpu.ts for why uniform damping collapses the
    // disc into a ball instead of holding it open.
    const rdx = cx / rc;
    const rdy = cy / rc;
    const vr = vx * rdx + vy * rdy;
    vx = vx - vr * rdx + vr * rdx * RADIAL_DAMP;
    vy = vy - vr * rdy + vr * rdy * RADIAL_DAMP;
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

/**
 * Re-seed the first `n` slots, positions only — the naive arm's path, which
 * replaces a prefix of the population and must leave species alone because the
 * sidebar and the chips are still reading the GPU arm's.
 *
 * So angle is random and radius is not: it comes back out of the particle's
 * existing species through homeRadius(), which is what keeps the colour bands
 * intact when the species array is not being rewritten alongside. The full
 * population is seeded by seedDisc() above instead.
 */
export function reseed(sim: Sim, n: number, rand: () => number = Math.random) {
  const p = sim.particles;
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const a = rand() * Math.PI * 2;
    const r = homeRadius(sim.species[i], i);
    const vOrb = circularSpeed(r);
    p[o] = Math.cos(a) * r;
    p[o + 1] = Math.sin(a) * r;
    p[o + 2] = -Math.sin(a) * vOrb;
    p[o + 3] = Math.cos(a) * vOrb;
  }
}
