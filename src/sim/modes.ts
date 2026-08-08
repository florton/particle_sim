/**
 * The six simulations this demo can run, and how the shell should behave in
 * each.
 *
 * They are six different force laws, not six settings of one. Four of them are
 * galaxies that answer each other: CLASSIC is a disc of test particles in a
 * fixed potential and phase-mixes into a smooth annulus; BARRED drives the same
 * disc with a rotating quadrupole so resonance holds rings open; SELFGRAV gives
 * the disc mass of its own so it amplifies its own density contrast into arms;
 * HALO embeds that same self-gravitating disc in a rigid extended halo, which
 * flattens its rotation curve and takes away its ability to run away with itself.
 * The first three keep their own constants, their own seeding and their own
 * branch of the shaders — see sim/world.ts, sim/barred.ts, sim/classic.ts.
 * Nothing is shared between them but the buffer layout and the palette.
 *
 * HALO is the exception and is meant to be: it is SELFGRAV's branch, seeding and
 * constants exactly, plus one term. A mode that differed in more than one thing
 * would not be able to attribute the difference to the halo.
 *
 * This table is the only place the set is enumerated. The shaders switch on the
 * same integers, so the order here is load-bearing.
 */

import * as barred from './barred';
import * as classic from './classic';
import type { PairState } from './pair';
import { mulberry32, randomSeed, scatterPlate, seedGalaxy, type Sim } from './world';

export const SELFGRAV = 0;
export const CHLADNI = 1;
export const BARRED = 2;
export const COLLISION = 3;
export const CLASSIC = 4;
export const HALO = 5;

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
  /**
   * Whether the dark-halo slider means anything here.
   *
   * Only HALO, which is mode 0's force law with one term added — see M_HALO in
   * sim/world.ts. The two are deliberately the same simulation otherwise, same
   * constants and same seeding, so [M] between them is a controlled comparison
   * and not two different galaxies.
   */
  halo: boolean;
  /** What [R] does, for the banner. */
  restart: string;
}

export const MODES: readonly ModeDef[] = [
  {
    label: 'orbital galaxy · self-gravitating',
    hold: 'ramp',
    cooling: true,
    gravity: false,
    halo: false,
    restart: 'restart',
  },
  {
    label: 'Chladni plate · 6 frequencies',
    hold: 'none',
    cooling: false,
    gravity: false,
    halo: false,
    restart: 'restart',
  },
  {
    label: 'orbital galaxy · barred',
    hold: 'step',
    cooling: false,
    gravity: false,
    halo: false,
    restart: 'reset',
  },
  {
    label: 'galaxy collision',
    hold: 'step',
    cooling: false,
    gravity: false,
    halo: false,
    restart: 'flip spin',
  },
  {
    label: 'orbital galaxy · fixed potential',
    hold: 'none',
    cooling: false,
    gravity: true,
    halo: false,
    restart: 'reset',
  },
  {
    // Mode 0 inside a dark halo, and identical to it in every other respect. The
    // cooling slider stays live because the halo's claim is about what the disc
    // can survive, and the cold end is where mode 0 stops surviving — a disc that
    // rings as a single mass rather than making arms. Whether the halo fixes that
    // is the question the mode poses; see the note on the slider in main.ts for
    // what is measured and what is not.
    label: 'orbital galaxy · dark halo',
    hold: 'ramp',
    cooling: true,
    gravity: false,
    halo: true,
    restart: 'restart',
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
 * Deterministic given a seed, and the seed is fresh each call — see randomSeed()
 * in sim/world.ts. Restarting or switching modes therefore draws a new disc from
 * the same distribution rather than replaying the one before it. Pass a seed
 * explicitly to pin the initial conditions for a measurement.
 */
export function seedMode(sim: Sim, mode: number, pair: PairState, seed = randomSeed()) {
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
      // SELFGRAV and HALO both. Same seeder, and the halo reaches it through
      // vCirc() rather than through an argument — so this is one disc placed on
      // whichever rotation curve the mode it is being seeded for actually has.
      // See haloMass() in sim/world.ts for why that is module state, and why
      // main.ts has to set it before it calls this.
      seedGalaxy(sim, seed);
  }
}
