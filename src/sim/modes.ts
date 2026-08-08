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

export const CHLADNI = 0;
export const BARRED = 1;
export const COLLISION = 2;
export const CLASSIC = 3;
export const HALO = 4;
export const SELFGRAV = 5;

export interface ModeDef {
  /** Shown in the banner. */
  label: string;
  /**
   * What holding the pointer down does.
   *
   * `ramp` is the self-gravitating disc's: cursor mass, softening and a capture
   * drag ramp in together over a few hundred milliseconds, because a step change
   * in a term that large arrives as an impulse and shatters the disc. `step`
   * is the fixed-potential version — two cursor masses, switched, which those
   * modes can afford because nothing in them amplifies its own density contrast.
   * See G_CURSOR_HOLD in sim/world.ts, G_CURSOR_HELD in sim/barred.ts and
   * G_CURSOR_HELD in sim/classic.ts. Only the plate has no pull at all.
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
   * Only HALO, which is SELFGRAV's force law with one term added — see M_HALO in
   * sim/world.ts. The two are deliberately the same simulation otherwise, same
   * constants and same seeding, and they are adjacent in the order above, so [M]
   * between them is a controlled comparison and not two different galaxies.
   */
  halo: boolean;
  /** What [R] does, for the banner. */
  restart: string;
}

export const MODES: readonly ModeDef[] = [
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
    hold: 'step',
    cooling: false,
    gravity: true,
    halo: false,
    restart: 'reset',
  },
  {
    // The self-gravitating disc inside a dark halo, and identical to it in every
    // other respect. The cooling slider stays live because the halo's claim is
    // about what the disc can survive, and the cold end is where the bare disc
    // stops surviving — a disc that rings as a single mass rather than making
    // arms. Whether the halo fixes that is the question the mode poses; see the
    // note on the slider in main.ts for what is measured and what is not.
    label: 'orbital galaxy · dark halo',
    hold: 'ramp',
    cooling: true,
    gravity: false,
    halo: true,
    restart: 'restart',
  },
  {
    // Last in the order, and reached from the halo above it: the comparison the
    // pair exists for reads in that direction — show the galaxy, then take the
    // halo away and watch it run away with itself.
    label: 'orbital galaxy · self-gravitating',
    hold: 'ramp',
    cooling: true,
    gravity: false,
    halo: false,
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
  seedRange(sim, mode, pair, 0, sim.capacity, seed);
}

/**
 * The same, over the slot range [from, to) only.
 *
 * What lets the population grow without restarting: the slots past the live
 * count have never been integrated, so raising the count is a matter of filling
 * exactly those and leaving every particle already on screen where it is. See
 * applyCount() in main.ts for the shape of that, and grow() on the Backend for
 * the upload it turns into.
 *
 * Every seeder here writes slot i from slot i's own draw, so a range is a
 * well-formed piece of the same population rather than a special case — the
 * strided field/disc split and the species banding are both functions of the
 * index. What a range does *not* get is the whole-buffer stream, so seeding
 * [0, n) then [n, m) is not the same draw as seeding [0, m) at once. Nothing
 * depends on it being: determinism is a claim about restarts, and those go
 * through seedMode() above.
 *
 * The one thing that is not index-local is the *time* the range is seeded at.
 * Everything here reads live state — the halo through vCirc(), the collision
 * through `pair` — so a range seeded now is placed on the rotation curve and
 * around the cores as they are now, not as they were when the mode was entered.
 * That is what makes growing during an encounter put the new particles around
 * the cores rather than where the cores started.
 */
export function seedRange(
  sim: Sim,
  mode: number,
  pair: PairState,
  from: number,
  to: number,
  seed = randomSeed(),
) {
  switch (mode) {
    case BARRED:
      barred.seedSpecies(sim, mulberry32(seed), from, to);
      barred.reseedDisc(sim, to, mulberry32(seed ^ 0x51), from);
      break;
    case COLLISION:
      // Species first, and over the same range: reseedCollision() reads it back
      // to place each particle at the radius its colour belongs at.
      barred.seedSpecies(sim, mulberry32(seed), from, to);
      barred.reseedCollision(sim, to, pair, mulberry32(seed ^ 0x51), from);
      break;
    case CLASSIC:
      // One call over one stream, unlike the two families above. Species here is
      // banded from the radius it is seeded at rather than from a home radius
      // the force law returns particles to, so the two cannot be drawn
      // separately — see seedDisc() in sim/classic.ts.
      classic.seedDisc(sim, mulberry32(seed), from, to);
      break;
    case CHLADNI:
      // Species stays the exponential disc's, so leaving the plate for mode 0
      // finds its bands intact. Only the positions become sand.
      seedGalaxy(sim, seed, from, to);
      scatterPlate(sim, to, mulberry32(seed ^ 0x51), from);
      break;
    default:
      // SELFGRAV and HALO both. Same seeder, and the halo reaches it through
      // vCirc() rather than through an argument — so this is one disc placed on
      // whichever rotation curve the mode it is being seeded for actually has.
      // See haloMass() in sim/world.ts for why that is module state, and why
      // main.ts has to set it before it calls this.
      seedGalaxy(sim, seed, from, to);
  }
}
