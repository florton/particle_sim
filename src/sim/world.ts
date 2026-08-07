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
/**
 * Central attractor strength — bulge plus dark halo, fixed at the origin.
 *
 * Lower than it used to be, because it is no longer the only thing holding the
 * disc up. The disc now carries mass of its own (M_DISC) and supplies the rest
 * of the rotation curve. The *split* between these two is the single most
 * important number in the file: see M_DISC.
 */
export const G_CORE = 0.42;
/**
 * Total self-gravitating mass of the disc, spread across the particles.
 *
 * This is what makes structure possible at all. A disc of test particles in a
 * fixed potential has exactly one end state — smooth, axisymmetric, featureless —
 * and main reached it in about two seconds. Give the disc mass and it can
 * respond to its own density fluctuations: an overdensity pulls in more
 * material, shear stretches it into an arm, the arm dissolves, another forms.
 * Swing amplification. It never converges, which is the entire point.
 *
 * The ratio to G_CORE is a stability knob, and both ends of it are bad. Measured
 * over 40 s of headless integration:
 *
 *   G_CORE  M_DISC  late A(m=2)  mass drained to core
 *   0.34    0.26    6.9e-2       36.5%   <- strongest arms, disc eats itself
 *   0.42    0.18    4.5e-2        8.8%   <- chosen
 *   0.50    0.12    3.4e-2        3.3%   <- stable, arms getting faint
 *
 * A disc-dominated model makes the best spirals and then drains into a bright
 * knot in the middle, which is the white blob this work exists to remove. A
 * halo-dominated one is stable and dull. Real spiral galaxies sit near the
 * middle for the same reason.
 */
export const M_DISC = 0.18;
/** Nominal disc radius — the scale the species bands and the view are fitted to. */
export const R_DISC = 0.65;
/**
 * Exponential scale length of the disc.
 *
 * Real discs are exponential in surface density, and seeding one uniformly was
 * costing more than realism. A uniform disc has no central concentration at all,
 * so the middle of the galaxy was no brighter than its edge — and any slight
 * mismatch between the seeded circular speed and the softened mesh force showed
 * up there as a visible hole rather than being buried under a dense core.
 * Measured on the uniform profile, the inner 0.08 held 0.83% of the population
 * against 1.51% predicted: half the center left within a fifth of a second.
 *
 * The sampling is exact and costs two logarithms. Surface density
 * exp(-r/h) integrates to the mass profile 1 - (1 + r/h) e^(-r/h), which is
 * the CDF of a Gamma(2,1) — and a Gamma(2,1) is just the sum of two
 * exponentials. So r = -h (ln u1 + ln u2), with no inversion and no rejection.
 */
export const H_DISC = R_DISC / 3;
/**
 * Initial velocity dispersion, as a fraction of the local circular speed.
 *
 * Not decoration — a perfectly cold disc has Toomre Q near zero and fragments
 * violently on its first orbit rather than forming arms. Measured from a cold
 * start, the disc heated to sigma/v = 0.56, threw 60% of its mass out of the
 * annulus, and was left too depleted to make structure again. Starting near
 * Q ~ 1.3 skips that.
 *
 * A *fraction* rather than an absolute speed, because circular speed falls to
 * zero at the center and an absolute dispersion does not. At r = 0.01 the
 * orbital speed is 0.39, so a flat sigma of 0.17 is a 44% kick — enough to
 * scatter the innermost particles straight out and leave a dark pinhole in the
 * middle of an otherwise convincing galaxy.
 */
export const SIGMA_FRAC = 0.15;
/** Force-grid resolution. See render/webgpu.ts for the O(N + G^2) argument. */
export const GRID = 64;
/**
 * Half-width of the simulation domain — the box the walls are at.
 *
 * Larger than the mesh box, and that is the whole point. The camera frames the
 * disc on the short side of the window (see cameraZoom in render/backend.ts), so
 * a wide window shows x out to about 1.7 while the disc only reaches 0.65: a
 * round subject cannot fill a 21:9 frame without being zoomed in until it is
 * cropped. The fix is not a different camera but more world — an outer field of
 * particles occupying the margins the disc geometrically cannot.
 *
 * 2.0 covers the corners of a 21:9 window (1.81 at the extreme) with room for
 * the wall to sit outside HALO_R_MAX rather than on top of it. It is a square
 * because the camera is not: fit to the short axis, a portrait window needs the
 * same reach vertically that a landscape one needs horizontally, and a square
 * domain serves both without knowing which it is.
 */
export const DOMAIN = 2.0;
/**
 * The mesh box: the region the self-gravity solver actually covers, in
 * simulation units. Fixed at the unit box, which is what makes the outer field
 * cheap — see HALO_EVERY.
 */
export const MESH_R = 1.0;
/**
 * One particle in this many is seeded into the outer field instead of the disc.
 *
 * Strided rather than appended, because the population is a prefix: the count
 * slider simulates and draws particles 0..count, so a halo living in the tail
 * would vanish entirely the first time the count came down. Every prefix of a
 * strided population holds the same fraction.
 */
export const HALO_EVERY = 8;
/** Fraction of the population that is disc, and so the share that has mass. */
export const DISC_SHARE = 1 - 1 / HALO_EVERY;
/** Inner edge of the outer field — clear of both the disc and the mesh box. */
export const HALO_R_MIN = 1.15;
/**
 * Outer edge of the outer field.
 *
 * Uniform in area over an annulus rather than over the square, even though it is
 * a square domain. Circular orbits preserve radius, so an area-uniform annulus
 * stays area-uniform forever — differential rotation only shears it in angle,
 * which is invisible in a field with no angular structure. Fill the square
 * corners instead and everything past 1.85 eventually swings onto an axis, hits
 * a wall it never should have been able to reach, and the field slowly rots into
 * a bright rim.
 */
export const HALO_R_MAX = 1.85;
/** Force softening, in grid cells. Below ~1 cell the mesh force is pure noise. */
export const SOFT_CELLS = 1.5;
/**
 * Cursor mass — a fraction of the core, so it perturbs rather than destroys.
 *
 * Cut hard when the disc gained self-gravity, and it had to be. Against a fixed
 * potential the cursor was a tidal nuisance: it stretched an arm, and the rigid
 * central field pulled everything back into place afterwards. A self-gravitating
 * disc has no such restoring authority — it *amplifies* density contrast,
 * because that is the same mechanism that makes the arms. So the overdensity the
 * cursor drags together keeps contracting after the cursor has gone, and one
 * sweep across the disc collapses it into a knot instead of stirring it.
 *
 * 0.035 against a 0.42 core and a 0.18 disc perturbs visibly and cannot run
 * away. The wider softening does the rest: it flattens the near field so
 * dragging the cursor *through* dense material shears it rather than gathering
 * it into a seed.
 */
export const G_CURSOR = 0.035;
/** Softening of the cursor's field. Wider than the core's, deliberately. */
export const CURSOR_SOFT2 = 0.05;
/**
 * Cursor softening at full hold. Tightened from CURSOR_SOFT2, and this is what
 * actually makes holding feel like grabbing.
 *
 * Mass alone does not work. 0.05 softening spreads the cursor's pull over a
 * radius of ~0.22 — a quarter of the disc — so scaling G_CURSOR up just adds a
 * broad tide competing with a 0.42 core that always wins. Measured: at 5x mass
 * with the wide softening a four-second hold drained the core fraction from 3.8%
 * to 21.8% and left A(m=2) at 0.014, i.e. it heated the disc to mush without
 * ever visibly grabbing anything.
 *
 * Narrowing the well concentrates the same force where the pointer is instead of
 * smearing it across the disc: peak acceleration goes up by (0.05/0.012)^1.5,
 * about 27x, inside a radius of ~0.11 and essentially unchanged outside it. Not
 * sufficient on its own either — see CAPTURE_R2 — but it is what makes the
 * capture term local instead of a brake applied to a quarter of the galaxy.
 */
export const CURSOR_SOFT2_HOLD = 0.012;
/**
 * Capture radius (squared) and strength of the held cursor's drag term.
 *
 * Gravity alone cannot make a hold feel like grabbing, and the measurements say
 * why. Disc material at r = 0.5 is moving at roughly the local circular speed,
 * so it crosses a 0.1-radius well in about a fifth of a second: deepening the
 * well past that point stops capturing anything and starts delivering impulses.
 * Measured over a four-second hold at 4x with the tightened softening, mass
 * within 0.12 of the pointer went 2.32% -> 1.80% while the core went 3.88% ->
 * 15.25%. Against a no-hold control (core flat at ~3-4%, arms forming normally)
 * that is unambiguous: the pull was real, it just threw material at the core
 * instead of holding it, and the disc went smooth as a side effect.
 *
 * So the hold also bleeds velocity along the line to the pointer inside the
 * capture radius. That is dynamical friction rather than a new force: it removes
 * energy where the pointer is instead of injecting it, and material circularizes
 * into orbit around the cursor. With it, the same four-second hold takes mass
 * near the pointer from 1.3% to 9.1% and renders as a bright companion with a
 * tidal bridge back to the disc. That is the whole effect.
 *
 * Both numbers are load-bearing and were found by bisection, not derivation.
 * Doubling them (K=6 over a 0.02 radius) collects 45% of the galaxy into one
 * clump that detonates into uniform static on release; halving them (K=2 over
 * 0.008) captures 2% and reads as nothing at all.
 *
 * What none of this buys is a free lunch on the disc: a four-second hold puts
 * ~12% of the mass inside r<0.1 while held and ~41% twelve seconds after release,
 * against 7% for an untouched disc over the same 25 seconds. That cost is
 * remarkably insensitive to every constant here — it measured 12-15% for every
 * variant tried, including ones with no visible effect at all — because it comes
 * from taking material off circular orbits at all, not from how hard. Given the
 * price is fixed, these are set for the strongest effect rather than the
 * gentlest. [R] restarts.
 */
export const CAPTURE_R2 = 0.014;
/** Fraction of relative velocity the capture region removes per second. */
export const CAPTURE_K = 9;
/**
 * Cursor mass multiplier while the pointer is held down.
 *
 * One of three terms that ramp together; the other two are above. Mass is what
 * pulls material into reach, the tightened softening keeps that pull local, and
 * the capture drag is what holds onto what arrives. Dropping this to 2x with the
 * other two unchanged takes capture from 9.1% to 1.6% — the drag has nothing to
 * work on if nothing gets close — so it is not the small term it looks like.
 *
 * The ramp (see main.ts) matters as much as the ceiling: applied instantly this
 * is a step change in the force law and the disc detonates instead of gathering.
 */
export const G_CURSOR_HOLD = 4;
/** Terminal speed. */
export const V_MAX = 3.0;
/**
 * Radial-velocity retention per step. Circularizes orbits without killing them.
 *
 * With self-gravity this stopped being a cosmetic hack and became the physics.
 * Spiral structure heats a disc, and a hot disc cannot make more of it; real
 * discs keep making arms indefinitely because gas radiates that heat away.
 * Damping the radial component is that dissipation. Remove it and the disc
 * heats monotonically until arms stop forming.
 */
export const RADIAL_DAMP = 0.995;
export const SPECIES_COUNT = 6;

/** Softening length of the mesh force, in simulation units. */
const SOFT = SOFT_CELLS * (2 / GRID);

/**
 * Radial acceleration factor from the central mass: multiply by the vector to
 * the origin to get the acceleration. Attraction minus a short-range repulsive
 * core — without the second term the population collapses to a single point.
 * Shared with the integrators so seeding and stepping cannot disagree.
 */
export function coreF(q: number): number {
  return G_CORE / (q * Math.sqrt(q)) - 0.0025 / (q * q);
}

/**
 * Circular-orbit speed at radius r, under the force law actually integrated.
 *
 * Two things make this not sqrt(G/r), and both of them are visible on screen if
 * you get them wrong.
 *
 * The disc has mass of its own now, so the central term alone understates the
 * pull; seeded from it every particle would start below circular and the whole
 * population would rain inward together. For uniform surface density the
 * enclosed mass goes as (r/R)^2.
 *
 * And the potential is *softened*, so inside the softening length the true
 * circular speed falls well below the Kepler value. Seeding from an unsoftened
 * sqrt(G/r) with a floor on r — which is what the fixed-potential version did —
 * hands the innermost particles roughly two and a half times the speed that
 * would hold them, and they leave. The result is a galaxy with a hole punched
 * through the middle, which is a strange thing to have to debug and an obvious
 * one once seen. Deriving the speed from the same expression the integrator
 * uses removes the whole class of error.
 */
export function vCirc(r: number): number {
  const q = r * r + 0.004;
  const disc = discEnclosed(r) / (r * r + SOFT * SOFT) ** 1.5;
  return r * Math.sqrt(Math.max(0, coreF(q) + disc));
}

/** Disc mass inside radius r, for the exponential profile seeded above. */
export function discEnclosed(r: number): number {
  const x = r / H_DISC;
  return M_DISC * (1 - (1 + x) * Math.exp(-x));
}

/** Radius sample for the exponential disc — see H_DISC. */
export function sampleRadius(u1: number, u2: number): number {
  const r = -H_DISC * (Math.log(Math.max(1e-9, u1)) + Math.log(Math.max(1e-9, u2)));
  return Math.min(1.1, Math.max(0.01, r));
}

/** True if slot `i` belongs to the outer field rather than the disc. */
export function isHalo(i: number) {
  return i % HALO_EVERY === 0;
}

/**
 * Total population needed to put exactly `disc` particles in the disc.
 *
 * The outer field is additive, not carved out: asking for a million particles
 * gets a million-particle *galaxy* with the field on top, rather than a
 * 875,000-particle galaxy wearing one. The count is what the disc looks like,
 * so it is the number worth holding fixed.
 *
 * Exact rather than a `* 8/7` estimate, because every prefix is strided: with
 * field slots at every HALO_EVERY-th index, a population of T holds
 * ceil(T/HALO_EVERY) field particles, so T = disc + k with k = ceil(T/8), which
 * solves to k = ceil(disc/7). A million disc particles is 1,142,858 total.
 *
 * The extra 14% is close to free. Field particles return immediately from
 * depositMass and take one reciprocal instead of a mesh gather, and the pass
 * that actually costs — the O(GRID^4) convolution — does not scale with
 * population at all.
 */
export function withOuterField(disc: number) {
  return disc + Math.ceil(disc / (HALO_EVERY - 1));
}

/**
 * Write one outer-field particle's position and velocity into `p` at `o`.
 *
 * On a circular orbit like everything else, from the same vCirc the disc is
 * seeded from — out here that is core plus the disc as a point mass, which is
 * exactly the approximation the integrators use outside the mesh box, so the
 * field is seeded on the orbit it is then stepped along. A star at r = 1.5 takes
 * about fifteen seconds to come round, so this reads as a slow wheel behind a
 * fast disc rather than as a static backdrop.
 *
 * No velocity dispersion. The disc needs it to avoid fragmenting on its first
 * orbit (see SIGMA_FRAC); the field has no self-gravity to fragment under, and
 * dispersion here would only let particles diffuse in radius until they found
 * the walls.
 */
export function seedHaloAt(p: Float32Array, o: number, rand: () => number) {
  const a = rand() * Math.PI * 2;
  // Uniform in *area*: r = sqrt(lerp(rmin^2, rmax^2, u)). Sampling r uniformly
  // instead would pile the field up against its inner edge.
  const r = Math.sqrt(
    HALO_R_MIN * HALO_R_MIN + rand() * (HALO_R_MAX * HALO_R_MAX - HALO_R_MIN * HALO_R_MIN),
  );
  const vOrb = vCirc(r);
  p[o] = Math.cos(a) * r;
  p[o + 1] = Math.sin(a) * r;
  p[o + 2] = -Math.sin(a) * vOrb;
  p[o + 3] = Math.cos(a) * vOrb;
}

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
export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fill a simulation with the initial galaxy, deterministically.
 *
 * Split out from createSim so that restarting is *exactly* reloading. The
 * alternative — re-deriving each particle's radius on the GPU from a hash, which
 * is what the mode-switch kernel does — quietly destroys the color banding,
 * because species is assigned *from* radius here and the species buffer is
 * uploaded once and never changed. Redraw the radii independently and every
 * species ends up spread over the whole disc: six colors, one gray ring.
 */
export function seedGalaxy(sim: Sim, seed = 0x9e3779b9) {
  const { particles, species, stat, capacity } = sim;
  const rand = mulberry32(seed);

  // Box-Muller, drawing from the same deterministic stream as everything else.
  const gauss = () => {
    const u = Math.max(1e-9, rand());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };

  for (let i = 0; i < capacity; i++) {
    const o = i * STRIDE;
    // Every eighth slot is outer field rather than disc — see HALO_EVERY. It
    // draws from the same stream in the same order, so restarting is still
    // exactly reloading.
    const halo = isHalo(i);
    let r: number;
    if (halo) {
      seedHaloAt(particles, o, rand);
      r = Math.hypot(particles[o], particles[o + 1]);
    } else {
      // Start as an exponential disc, so frame one reads as a galaxy rather than
      // as a flat washer — see H_DISC.
      const a = rand() * Math.PI * 2;
      r = sampleRadius(rand(), rand());
      particles[o] = Math.cos(a) * r;
      particles[o + 1] = Math.sin(a) * r;

      // On a circular orbit of the *combined* central + disc field, plus the
      // velocity dispersion that keeps the first orbit from fragmenting. Seeding
      // exactly on-orbit and perfectly cold is the one starting condition
      // guaranteed to look wrong: see SIGMA_FRAC.
      const vOrb = vCirc(r);
      const sigma = vOrb * SIGMA_FRAC;
      particles[o + 2] = -Math.sin(a) * vOrb + gauss() * sigma;
      particles[o + 3] = Math.cos(a) * vOrb + gauss() * sigma;
    }

    // Species banded by radius: the galaxy reads as composed rings rather than
    // uniform confetti, and the filter chips then carve visible structure.
    // Banded on the exponential scale length, not the nominal radius, or five of
    // the six species would land inside the innermost tenth of the disc.
    //
    // The outer field falls out of the same rule with no special case: it lives
    // past r = 1.15, which is off the end of every band, so it clamps into the
    // outermost species. That is the answer that was wanted anyway — the filter
    // chips then treat the field as the continuation of the outer disc, and no
    // chip carves confetti out of it.
    const band = (r / (2.6 * H_DISC)) * SPECIES_COUNT;
    const jitter = (rand() - 0.5) * 1.6;
    species[i] = Math.max(0, Math.min(SPECIES_COUNT - 1, (band + jitter) | 0));
    stat[i] = rand();
  }
}

export function createSim(capacity: number, seed = 0x9e3779b9): Sim {
  const sim: Sim = {
    particles: new Float32Array(capacity * STRIDE),
    species: new Uint8Array(capacity),
    stat: new Float32Array(capacity),
    capacity,
    count: capacity,
  };
  seedGalaxy(sim, seed);
  return sim;
}

// --- CPU-side particle mesh --------------------------------------------------
//
// The same scheme the GPU runs, at the same grid resolution, so the A/B is a
// comparison of *rendering paths* rather than of two different simulations.
// Allocated once at module scope: this is the reference implementation, and it
// is not allowed to be the thing that makes the baseline arm look slow.

const CELLS = GRID * GRID;
const SOFT2 = SOFT * SOFT;
const meshMass = new Float32Array(CELLS);
const meshAccX = new Float32Array(CELLS);
const meshAccY = new Float32Array(CELLS);
/** Indices of the non-empty cells, rebuilt each step. See solveMesh. */
const meshOcc = new Int32Array(CELLS);
const cellCx = new Float32Array(CELLS);
const cellCy = new Float32Array(CELLS);
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    cellCx[gy * GRID + gx] = ((gx + 0.5) / GRID) * 2 - 1;
    cellCy[gy * GRID + gx] = ((gy + 0.5) / GRID) * 2 - 1;
  }
}

/**
 * Build the density mesh and solve it for the force field.
 *
 * The convolution is O(CELLS^2) and independent of the population, which is
 * what makes it survivable here: the baseline arm runs 5,000 particles, and at
 * that count almost the whole box is empty. Compacting to the occupied cells
 * first turns 16.7 million cell pairs into a few hundred thousand.
 */
function solveMesh(sim: Sim, n: number) {
  meshMass.fill(0);
  const p = sim.particles;
  // Only the disc share deposits, so each depositing particle carries a
  // correspondingly larger slice — otherwise the mesh would hold 7/8 of M_DISC
  // and the disc would sit on a rotation curve 7% slower than it was seeded on.
  const mPer = M_DISC / (n * DISC_SHARE);

  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    // Outside the mesh box a particle is outer field, not disc: it is pulled by
    // the disc's mass but has none of its own here. Skipping it is also what
    // keeps the clamps below honest — they would otherwise file every one of
    // these into an edge cell and build a fake rim of mass around the box.
    if (Math.abs(p[o]) >= MESH_R || Math.abs(p[o + 1]) >= MESH_R) continue;
    const gx = (p[o] + 1) * 0.5 * GRID - 0.5;
    const gy = (p[o + 1] + 1) * 0.5 * GRID - 0.5;
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    const fx = gx - i0;
    const fy = gy - j0;
    for (let dy = 0; dy < 2; dy++) {
      const jj = Math.min(GRID - 1, Math.max(0, j0 + dy));
      const wy = dy ? fy : 1 - fy;
      for (let dx = 0; dx < 2; dx++) {
        const ii = Math.min(GRID - 1, Math.max(0, i0 + dx));
        meshMass[jj * GRID + ii] += mPer * (dx ? fx : 1 - fx) * wy;
      }
    }
  }

  // Compact by mass rather than by occupancy — see solveField in webgpu.ts.
  // A cell holding a millionth of the disc costs a full row of the convolution
  // and contributes nothing, and a settled disc accumulates thousands of them.
  const floor = (M_DISC / CELLS) * 1e-3;
  let nOcc = 0;
  for (let c = 0; c < CELLS; c++) if (meshMass[c] > floor) meshOcc[nOcc++] = c;

  for (let t = 0; t < CELLS; t++) {
    const tx = cellCx[t];
    const ty = cellCy[t];
    let ax = 0;
    let ay = 0;
    for (let k = 0; k < nOcc; k++) {
      const s = meshOcc[k];
      const dx = cellCx[s] - tx;
      const dy = cellCy[s] - ty;
      const q = dx * dx + dy * dy + SOFT2;
      const f = meshMass[s] / (q * Math.sqrt(q));
      ax += dx * f;
      ay += dy * f;
    }
    meshAccX[t] = ax;
    meshAccY[t] = ay;
  }
}

/**
 * CPU reference integration — the measured baseline for the GPU path. It has to
 * be a fair implementation, not a strawman: allocation-free, monomorphic, one
 * pass over contiguous memory, and running the *same* physics.
 */
export function integrateCPU(
  sim: Sim,
  dt: number,
  mx: number,
  my: number,
  cooling = RADIAL_DAMP,
  grav = 1,
) {
  const p = sim.particles;
  const n = sim.count;
  const damp = 0.99995;

  // Cursor softening tightens as the hold ramps in — see CURSOR_SOFT2_HOLD.
  // Loop-invariant, so it stays out of the per-particle body.
  const ht = Math.min(1, Math.max(0, (grav - 1) / (G_CURSOR_HOLD - 1)));
  const cursorSoft = CURSOR_SOFT2 + (CURSOR_SOFT2_HOLD - CURSOR_SOFT2) * ht;

  solveMesh(sim, n);

  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const x = p[o];
    const y = p[o + 1];

    // Identical force law to the GPU paths — a comparison between arms is only
    // meaningful if they are doing the same arithmetic.
    //
    // Central mass at the origin, the disc's own self-gravity from the mesh, and
    // the cursor as a weak secondary. See webgpu.ts for why the cursor is not
    // the primary, and why the disc needs mass of its own at all.
    const cx = -x;
    const cy = -y;
    const dc2 = cx * cx + cy * cy + 0.004;
    const rc = Math.sqrt(dc2);
    const fc = coreF(dc2);

    // The disc's own gravity. Inside the mesh box, gathered from the mesh;
    // outside it, the disc as a point mass at the origin — see the same branch
    // in webgpu.ts for why that is the right answer out there and not a
    // shortcut.
    const outer = Math.abs(x) >= MESH_R || Math.abs(y) >= MESH_R;
    let sgx = 0;
    let sgy = 0;
    if (!outer) {
      // Bilinear gather from the mesh, matching the GPU's sampleField.
      const ggx = (x + 1) * 0.5 * GRID - 0.5;
      const ggy = (y + 1) * 0.5 * GRID - 0.5;
      const gi0 = Math.floor(ggx);
      const gj0 = Math.floor(ggy);
      const gfx = ggx - gi0;
      const gfy = ggy - gj0;
      for (let dy = 0; dy < 2; dy++) {
        const jj = Math.min(GRID - 1, Math.max(0, gj0 + dy));
        const wy = dy ? gfy : 1 - gfy;
        for (let dx = 0; dx < 2; dx++) {
          const ii = Math.min(GRID - 1, Math.max(0, gi0 + dx));
          const w = (dx ? gfx : 1 - gfx) * wy;
          sgx += meshAccX[jj * GRID + ii] * w;
          sgy += meshAccY[jj * GRID + ii] * w;
        }
      }
    } else {
      const fd = M_DISC / (dc2 * rc);
      sgx = cx * fd;
      sgy = cy * fd;
    }

    const dx = mx - x;
    const dy = my - y;
    const dm2 = dx * dx + dy * dy + cursorSoft;
    const fm = (G_CURSOR * grav) / (dm2 * Math.sqrt(dm2));

    // No constant tangential term: it pumps energy in every frame regardless of
    // position, which is what cooked the disc into uniform noise. Rotation comes
    // from the orbital seed instead.
    let vx = p[o + 2] + cx * fc * dt + sgx * dt + dx * fm * dt;
    let vy = p[o + 3] + cy * fc * dt + sgy * dt + dy * fm * dt;

    // All dissipation is disc physics, so the outer field skips it and orbits
    // frictionless — see the same branch in webgpu.ts for the measurement that
    // forced it.
    if (!outer) {
      // Radial-only damping — see webgpu.ts for why uniform damping collapses the
      // disc into a ball instead of holding it open.
      const rdx = cx / rc;
      const rdy = cy / rc;
      const vr = vx * rdx + vy * rdy;
      vx = (vx - vr * rdx) + vr * rdx * cooling;
      vy = (vy - vr * rdy) + vr * rdy * cooling;
      vx *= damp;
      vy *= damp;

      // Capture drag along the cursor line only — see webgpu.ts for why not the
      // full velocity vector.
      if (ht > 0) {
        const cd = Math.min(0.9, CAPTURE_K * ht * Math.exp(-dm2 / CAPTURE_R2) * dt);
        const dmLen = Math.max(1e-4, Math.hypot(dx, dy));
        const mdx = dx / dmLen;
        const mdy = dy / dmLen;
        const va = (vx * mdx + vy * mdy) * cd;
        vx -= va * mdx;
        vy -= va * mdy;
      }
    }

    const speed = Math.hypot(vx, vy);
    if (speed > V_MAX) {
      vx *= V_MAX / speed;
      vy *= V_MAX / speed;
    }

    let nx = x + vx * dt;
    let ny = y + vy * dt;

    // Reflect at the domain wall, bleeding energy on contact. A perfectly
    // elastic wall lets escapees accumulate speed and slowly randomize the
    // field. The wall is at DOMAIN, not at the mesh box — the outer field lives
    // between the two and must not be bounced off the edge of the solver.
    const W = DOMAIN;
    if (nx < -W) { nx = -W; vx = -vx * BOUNCE; } else if (nx > W) { nx = W; vx = -vx * BOUNCE; }
    if (ny < -W) { ny = -W; vy = -vy * BOUNCE; } else if (ny > W) { ny = W; vy = -vy * BOUNCE; }

    p[o] = nx;
    p[o + 1] = ny;
    p[o + 2] = vx;
    p[o + 3] = vy;
  }
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
 * Without this the naive arm ran galaxy physics behind a plate-labeled banner,
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
 * Spread the first `n` slots evenly over the box, at rest.
 *
 * The plate has to start as evenly spread sand. Arriving from a galaxy with
 * everything piled in the core produces one bright diagonal and nothing else,
 * because a grain that reaches a node has zero vibration amplitude and never
 * moves again.
 */
export function scatterPlate(sim: Sim, n: number, rand: () => number = Math.random) {
  const p = sim.particles;
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    p[o] = rand() * 2 - 1;
    p[o + 1] = rand() * 2 - 1;
    p[o + 2] = 0;
    p[o + 3] = 0;
  }
}

/** Re-seed the first `n` slots as the self-gravitating disc, positions only. */
export function reseedGalaxy(sim: Sim, n: number, rand: () => number = Math.random) {
  const p = sim.particles;
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    if (isHalo(i)) {
      seedHaloAt(p, o, rand);
      continue;
    }
    const a = rand() * Math.PI * 2;
    const r = sampleRadius(rand(), rand());
    const vOrb = vCirc(r);
    const g1 = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand())));
    const g2 = 2 * Math.PI * rand();
    p[o] = Math.cos(a) * r;
    p[o + 1] = Math.sin(a) * r;
    const sigma = vOrb * SIGMA_FRAC;
    p[o + 2] = -Math.sin(a) * vOrb + g1 * Math.cos(g2) * sigma;
    p[o + 3] = Math.cos(a) * vOrb + g1 * Math.sin(g2) * sigma;
  }
}
