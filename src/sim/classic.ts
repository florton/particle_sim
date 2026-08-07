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

/** Primary attractor strength, fixed at the origin. */
export const G_CORE = 0.55;
/** Cursor mass — a fraction of the core, so it perturbs rather than destroys. */
export const G_CURSOR = 0.1;
/** Terminal speed. */
export const V_MAX = 3.0;
/** Radial-velocity retention per step. Circularizes orbits without killing them. */
export const RADIAL_DAMP = 0.995;
/** Nominal disc radius the species bands are cut against. */
export const R_DISC = 0.65;

/**
 * Circular-orbit speed: v = sqrt(G / r), with a floor on r.
 *
 * Deliberately not the softened expression the later modes use. Seeding on the
 * unsoftened Kepler value is what leaves this disc with a hole through the
 * middle — see vCirc() in sim/world.ts. It is part of what this mode is.
 */
export function circularSpeed(r: number) {
  return Math.sqrt(G_CORE / Math.max(r, 0.06)) * 0.94;
}

/** Species banded by radius over a uniform-density disc. */
export function seedSpecies(sim: Sim, rand: () => number) {
  for (let i = 0; i < sim.capacity; i++) {
    const r = Math.sqrt(rand()) * R_DISC;
    const band = (r / R_DISC) * SPECIES_COUNT;
    const jitter = (rand() - 0.5) * 1.6;
    sim.species[i] = Math.max(0, Math.min(SPECIES_COUNT - 1, (band + jitter) | 0));
    sim.stat[i] = rand();
  }
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
    const cx = -x;
    const cy = -y;
    const dc2 = cx * cx + cy * cy + 0.004;
    const rc = Math.sqrt(dc2);
    // Attraction minus a short-range repulsive core. Without the second term the
    // whole population collapses to a single point.
    const fc = G_CORE / (dc2 * rc) - 0.0025 / (dc2 * dc2);

    const dx = mx - x;
    const dy = my - y;
    const dm2 = dx * dx + dy * dy + 0.02;
    const fm = G_CURSOR / (dm2 * Math.sqrt(dm2));

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

/** Re-seed the first `n` slots. Mirrors the WGSL scatter pass for this mode. */
export function reseed(sim: Sim, n: number, rand: () => number = Math.random) {
  const p = sim.particles;
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * R_DISC;
    const vOrb = circularSpeed(r);
    p[o] = Math.cos(a) * r;
    p[o + 1] = Math.sin(a) * r;
    p[o + 2] = -Math.sin(a) * vOrb;
    p[o + 3] = Math.cos(a) * vOrb;
  }
}
