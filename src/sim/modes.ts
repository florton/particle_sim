/**
 * The five simulations this demo can run, and how the shell should behave in
 * each.
 *
 * They are five different force laws, not five settings of one. Three of them
 * are galaxies that answer each other: CLASSIC is a disc of test particles in a
 * fixed potential and phase-mixes into a smooth annulus; BARRED drives the same
 * disc with a rotating quadrupole so resonance holds rings open; SELFGRAV gives
 * the disc mass of its own so it amplifies its own density contrast into arms.
 * Each keeps its own constants, its own seeding and its own branch of the
 * shaders — see sim/world.ts, sim/barred.ts, sim/classic.ts. Nothing is shared
 * between them but the buffer layout and the palette.
 *
 * This table is the only place the set is enumerated. The shaders switch on the
 * same integers, so the order here is load-bearing.
 */

import * as barred from './barred';
import * as classic from './classic';
import type { PairState } from './pair';
import { mulberry32, scatterPlate, seedGalaxy, type Sim } from './world';

export const SELFGRAV = 0;
export const CHLADNI = 1;
export const BARRED = 2;
export const COLLISION = 3;
export const CLASSIC = 4;

export interface ModeDef {
  /** Shown in the banner. */
  label: string;
  /**
   * What holding the pointer down does.
   *
   * `ramp` is the self-gravitating disc's: cursor mass, softening and a capture
   * drag ramp in together over a few hundred milliseconds, because a step change
   * in a term that large arrives as an impulse and shatters the disc. `step`
   * is the fixed-potential version — two cursor masses, switched. See
   * G_CURSOR_HOLD in sim/world.ts and G_CURSOR_HELD in sim/barred.ts.
   */
  hold: 'ramp' | 'step' | 'none';
  /** Whether the disc-cooling slider means anything here. */
  cooling: boolean;
  /**
   * Whether the core-gravity slider means anything here.
   *
   * Only the fixed-potential disc. Its primary is prescribed and carries the
   * whole rotation curve, so scaling it is exactly a speed control — v =
   * sqrt(G/r) — and the radial damping recircularizes the orbits into the new
   * disc within a second. Nothing else in the set can say that: the
   * self-gravitating disc's structure lives on the *ratio* of core to disc mass
   * (see M_DISC in sim/world.ts), the barred disc's rings sit at resonances tied
   * to its own core, and the plate has no gravity at all.
   */
  gravity: boolean;
  /** What [R] does, for the banner. */
  restart: string;
}

export const MODES: readonly ModeDef[] = [
  {
    label: 'orbital galaxy · self-gravitating',
    hold: 'ramp',
    cooling: true,
    gravity: false,
    restart: 'restart',
  },
  {
    label: 'Chladni plate · 6 frequencies',
    hold: 'none',
    cooling: false,
    gravity: false,
    restart: 'restart',
  },
  {
    label: 'orbital galaxy · barred',
    hold: 'step',
    cooling: false,
    gravity: false,
    restart: 'reset',
  },
  {
    label: 'galaxy collision',
    hold: 'step',
    cooling: false,
    gravity: false,
    restart: 'flip spin',
  },
  {
    label: 'orbital galaxy · fixed potential',
    hold: 'none',
    cooling: false,
    gravity: true,
    restart: 'reset',
  },
];

export const MODE_COUNT = MODES.length;

/**
 * Fill the whole population for a mode: species and stat as well as positions.
 *
 * Species is not incidental. It is drawn from radius at seeding time, and each
 * family bands it differently — the exponential disc cuts its bands on the
 * scale length, the uniform discs on the nominal radius — so carrying one
 * family's species array into another's disc would leave six colours smeared
 * evenly over it and the filter chips carving nothing. In the barred disc it is
 * load-bearing twice over, because a recycled particle returns to the radius its
 * species belongs at.
 *
 * Deterministic, so restarting is exactly reloading.
 */
export function seedMode(sim: Sim, mode: number, pair: PairState, seed = 0x9e3779b9) {
  switch (mode) {
    case BARRED:
      barred.seedSpecies(sim, mulberry32(seed));
      barred.reseedDisc(sim, sim.capacity, mulberry32(seed ^ 0x51));
      break;
    case COLLISION:
      barred.seedSpecies(sim, mulberry32(seed));
      barred.reseedCollision(sim, sim.capacity, pair, mulberry32(seed ^ 0x51));
      break;
    case CLASSIC:
      // One call over one stream, unlike the two families above. Species here is
      // banded from the radius it is seeded at rather than from a home radius
      // the force law returns particles to, so the two cannot be drawn
      // separately — see seedDisc() in sim/classic.ts.
      classic.seedDisc(sim, mulberry32(seed));
      break;
    case CHLADNI:
      // Species stays the exponential disc's, so leaving the plate for mode 0
      // finds its bands intact. Only the positions become sand.
      seedGalaxy(sim, seed);
      scatterPlate(sim, sim.capacity, mulberry32(seed ^ 0x51));
      break;
    default:
      seedGalaxy(sim, seed);
  }
}
