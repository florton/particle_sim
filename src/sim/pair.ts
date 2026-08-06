/**
 * The two cores of a galaxy collision, and nothing else.
 *
 * This is the restricted three-body model Toomre & Toomre used in 1972 to show
 * that tidal tails and bridges — the Antennae, the Mice — fall straight out of
 * gravity, with no gas, no self-gravity and no N-body cost. The two cores are a
 * closed two-body problem solved on its own; every one of the million disc
 * particles is a massless test particle that feels both cores and influences
 * neither.
 *
 * Which is why this file is twelve lines of arithmetic and the demo still runs a
 * million particles: the expensive part of an N-body collision is the part this
 * model proves you do not need. The whole CPU cost per frame is one leapfrog step
 * over two bodies, and the result reaches the shader as six floats.
 *
 * Masses fold G in — a "mass" here is really GM.
 */

/** Total mass, split between the two cores. */
export const PAIR_MASS = 0.5;
/** Softening on the core-core force. Stops a near-direct hit from exploding. */
const PAIR_SOFT = 0.01;
/** Separation the encounter starts at. */
const START_SEP = 1.5;
/** Closest approach. Small enough to raise tails, wide enough to survive. */
const PERICENTER = 0.35;
/** Disc radius around each core at seeding. */
export const PAIR_DISC_R = 0.3;

export interface PairState {
  x0: number; y0: number; vx0: number; vy0: number;
  x1: number; y1: number; vx1: number; vy1: number;
  /** +1 prograde, -1 retrograde — the spin sense of the *second* disc. */
  spin1: number;
  /** Seconds since the last reset. */
  elapsed: number;
}

/**
 * A parabolic encounter, started on approach.
 *
 * Parabolic because that is the interesting case and the one Toomre ran: the
 * pair is marginally bound, so the cores fall together, swing through
 * pericenter, and separate again rather than either orbiting tamely or flying
 * past. For total mass mu at separation r, a parabolic orbit has
 * v = sqrt(2 mu / r); splitting that into tangential and radial parts by the
 * angular momentum sqrt(2 mu q) is what sets the closest approach q.
 */
export function resetPair(p: PairState, spin1 = p.spin1) {
  const mu = PAIR_MASS * 2;
  const r = START_SEP;
  const vRel = Math.sqrt((2 * mu) / r);
  const vt = Math.sqrt(2 * mu * PERICENTER) / r;
  // Radial component is what is left; negative because they start approaching.
  const vr = -Math.sqrt(Math.max(0, vRel * vRel - vt * vt));

  p.x0 = -r / 2; p.y0 = 0;
  p.x1 = r / 2; p.y1 = 0;
  // Equal masses, so each core takes half the relative velocity, opposed. The
  // barycenter is therefore at rest at the origin and stays there.
  p.vx0 = -vr / 2; p.vy0 = -vt / 2;
  p.vx1 = vr / 2; p.vy1 = vt / 2;
  p.spin1 = spin1;
  p.elapsed = 0;
}

export function createPair(): PairState {
  const p: PairState = {
    x0: 0, y0: 0, vx0: 0, vy0: 0,
    x1: 0, y1: 0, vx1: 0, vy1: 0,
    spin1: 1,
    elapsed: 0,
  };
  resetPair(p);
  return p;
}

/** One leapfrog (kick-drift-kick) step of the two-body problem. */
export function stepPair(p: PairState, dt: number) {
  const acc = () => {
    const dx = p.x1 - p.x0;
    const dy = p.y1 - p.y0;
    const d2 = dx * dx + dy * dy + PAIR_SOFT;
    const f = PAIR_MASS / (d2 * Math.sqrt(d2));
    return [dx * f, dy * f] as const;
  };

  let [ax, ay] = acc();
  p.vx0 += ax * dt * 0.5; p.vy0 += ay * dt * 0.5;
  p.vx1 -= ax * dt * 0.5; p.vy1 -= ay * dt * 0.5;

  p.x0 += p.vx0 * dt; p.y0 += p.vy0 * dt;
  p.x1 += p.vx1 * dt; p.y1 += p.vy1 * dt;

  [ax, ay] = acc();
  p.vx0 += ax * dt * 0.5; p.vy0 += ay * dt * 0.5;
  p.vx1 -= ax * dt * 0.5; p.vy1 -= ay * dt * 0.5;

  p.elapsed += dt;
}

/** Current separation — the caller uses it to decide when the show is over. */
export function pairSeparation(p: PairState) {
  return Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
}
