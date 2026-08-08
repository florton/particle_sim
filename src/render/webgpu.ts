/**
 * WebGPU backend: compute shaders integrate, render pipelines draw, and every
 * stage binds the *same* storage buffer. The particle data never round-trips to
 * JS after upload — the CPU's only per-frame write is a 64-byte uniform.
 *
 * Four compute dispatches per frame, in order:
 *
 *   clearGrid    zero the density mesh
 *   depositMass  every particle CIC-splats its mass into the mesh (atomics)
 *   solveField   the mesh convolves against itself to get the force field
 *   integrate    every particle gathers that field and steps
 *
 * That middle pair is the self-gravity, and the reason it is affordable is that
 * the particles never see each other. Direct particle-particle attraction is
 * O(N^2) — at a million that is 10^12 interactions per frame, which is not a
 * tuning problem but an arithmetic one. Here the particles talk to a GRID x GRID
 * mesh and the mesh talks to itself, so the cost is O(N + GRID^4) with GRID
 * fixed: linear in the population. Doubling the particle count doubles two cheap
 * linear passes and leaves the expensive one untouched.
 */

import {
  CAPTURE_K, CAPTURE_R2, CURSOR_SOFT2, CURSOR_SOFT2_HOLD, DISC_SHARE, DOMAIN,
  GRID, G_CORE, G_CURSOR, G_CURSOR_HOLD, HALO_A2, MESH_R, M_DISC, RADIAL_DAMP,
  SOFT_CELLS, STRIDE, haloMass, type Sim,
} from '../sim/world';
import * as barred from '../sim/barred';
import * as classic from '../sim/classic';
import {
  BARRED, CHLADNI, CLASSIC, COLLISION, HALO, SELFGRAV, seedMode, seedRange,
} from '../sim/modes';
import { PAIR_MASS, createPair, type PairState } from '../sim/pair';
import { READBACK_MAX, cameraTilt, cameraZoom, type Backend } from './backend';

const WORKGROUP = 64;
const CELLS = GRID * GRID;


const SHADER = /* wgsl */ `
struct Params {
  dt        : f32,
  mx        : f32,
  my        : f32,
  aspect    : f32,
  size      : f32,
  gain      : f32,
  mask      : u32,
  mode      : u32,
  time      : f32,
  warpN     : f32,
  warpM     : f32,
  fpScale   : f32,
  massScale : f32,
  exposure  : f32,
  vscale    : f32,
  // Live particle count, so the deposit pass never walks past the live
  // population into the unused tail of the buffer when the count slider is below
  // capacity.
  pcount    : f32,
  // Radial-velocity retention per step — the disc's cooling rate, driven live
  // from the UI. See sim/world.ts RADIAL_DAMP for what it physically is.
  rdamp     : f32,
  // Cells lighter than this contribute nothing and are skipped by the
  // convolution — see solveField for why this is not simply "is it empty".
  massFloor : f32,
  // 1 = render luminance only, discarding the species palette.
  mono      : f32,
  // Cursor mass multiplier, ramped by the pointer being held. 1 = passive.
  grav      : f32,
  // Cursor mass in the fixed-potential modes, switched rather than ramped.
  gcur      : f32,
  // Vertical foreshortening of the inclined view: 1 face-on, TILT_COS tilted.
  // Lands in the 4 bytes of padding c0's 8-byte alignment already reserved, so
  // it is free -- the struct is still 112 bytes. See cameraTilt in backend.ts.
  tiltY     : f32,
  // The two colliding cores, solved on the CPU -- see sim/pair.ts.
  c0        : vec2<f32>,
  c1        : vec2<f32>,
  pmass     : f32,
  // Core strength of the fixed-potential disc, driven live from the UI. A
  // uniform rather than a shader constant because it is the one term in that
  // mode a slider moves -- see coreGravity() in sim/classic.ts. Lands at offset
  // 108, in the padding the struct's 8-byte alignment already reserved, so the
  // uniform buffer is still 112 bytes.
  gcore     : f32,
  // Dark-halo mass of the HALO mode, driven live from the UI; 0 in every other
  // mode, which is what lets the term stay in the force law unbranched. Pushes
  // the struct to 116 bytes, padded to 120 by its vec2 alignment.
  mhalo     : f32,
};

// Central bulge + halo. Fixed at the origin -- see the integrate entry point.
// (No backticks in here: this block lives inside a JS template literal.)
const G_CORE = ${G_CORE};
// Total self-gravitating mass of the disc. Mirrors M_DISC in sim/world.ts.
const M_DISC = ${M_DISC};
// Cursor mass, deliberately a fraction of the core so it perturbs, not destroys.
// Mirrors G_CURSOR in sim/world.ts -- see there for why it is this small.
const G_CURSOR = ${G_CURSOR};
const CURSOR_SOFT2 = ${CURSOR_SOFT2};
// Held softening and the mass ceiling it ramps against -- see sim/world.ts.
const CURSOR_SOFT2_HOLD = ${CURSOR_SOFT2_HOLD};
const G_CURSOR_HOLD = f32(${G_CURSOR_HOLD});
const CAPTURE_R2 = ${CAPTURE_R2};
const CAPTURE_K = f32(${CAPTURE_K});
// Terminal speed. Without it a close cursor pass flings grains off to infinity.
const V_MAX = 3.0;

const GRID = ${GRID}u;
const GRIDF = ${GRID}.0;
const CELLS = ${CELLS}u;

// Per-species (n, m) offsets from the cursor-driven base frequency. Each species
// settles onto the nodal lines of its own standing wave, so six figures resolve
// at once in six colors. Kept small and mutually offset so they stay visibly
// distinct at every base frequency.
const MODES = array<vec2<f32>, 6>(
  vec2<f32>(0.0, 1.0),
  vec2<f32>(1.0, 0.0),
  vec2<f32>(0.0, 2.0),
  vec2<f32>(2.0, 0.0),
  vec2<f32>(1.0, 3.0),
  vec2<f32>(3.0, 1.0)
);

const PI = 3.14159265;

/** Cheap per-particle hash for the vibration jitter. */
fn hash(n : u32) -> f32 {
  var x = n * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967296.0;
}

// Mirrors SPECIES_COLORS in sim/world.ts — keep in sync.
const PALETTE = array<vec3<f32>, 6>(
  vec3<f32>(0.29, 0.62, 1.00),
  vec3<f32>(1.00, 0.45, 0.62),
  vec3<f32>(0.42, 1.00, 0.72),
  vec3<f32>(1.00, 0.76, 0.33),
  vec3<f32>(0.72, 0.55, 1.00),
  vec3<f32>(0.35, 0.95, 1.00)
);

@group(0) @binding(0) var<storage, read_write> parts : array<vec4<f32>>;
@group(0) @binding(1) var<uniform> params : Params;
@group(0) @binding(2) var<storage, read> cspecies : array<u32>;
// Density mesh. Fixed-point u32 because WGSL has no atomic float -- see fpScale.
@group(0) @binding(3) var<storage, read_write> dens : array<atomic<u32>>;
// Acceleration field, one vector per cell, written by solveField.
@group(0) @binding(4) var<storage, read_write> field : array<vec2<f32>>;
// The same mesh as plain f32, baked once per frame -- see bakeGrid.
@group(0) @binding(5) var<storage, read_write> cellMass : array<f32>;

/** Center of cell c in simulation space, which is the unit box [-1, 1]. */
fn cellCenter(c : u32) -> vec2<f32> {
  let g = vec2<f32>(f32(c % GRID), f32(c / GRID));
  return (g + 0.5) / GRIDF * 2.0 - 1.0;
}

/** Continuous grid coordinate of a point, with cell centers on integers. */
fn gridCoord(p : vec2<f32>) -> vec2<f32> {
  return (p + 1.0) * 0.5 * GRIDF - 0.5;
}

/** Radial acceleration factor from the central mass. Mirrors coreF() in
 *  sim/world.ts; used by both the integrator and the seeding below. */
fn coreF(q : f32) -> f32 {
  return G_CORE / (q * sqrt(q)) - 0.0025 / (q * q);
}

/** The dark halo, mirroring haloF() in sim/world.ts. Rigid background potential
 *  with a flat outer rotation curve; params.mhalo is 0 outside the HALO mode, so
 *  this contributes exactly nothing there and needs no branch to say so. */
fn haloF(q : f32) -> f32 {
  return params.mhalo / (q + ${HALO_A2});
}

/**
 * Chladni plate. Particles descend |w| toward the nodal lines of a standing
 * wave, exactly as sand does on a vibrating plate — the sand collects where the
 * plate is not moving. Analytic gradient, so this is O(n) with no neighbor
 * search: a million grains cost one evaluation each.
 */
fn chladni(i : u32, p : vec4<f32>, dt : f32) -> vec4<f32> {
  // Cursor drives the base frequency across a wide range; each species offsets
  // from it, so all six figures sweep together but never coincide.
  let nm = MODES[cspecies[i]];
  let n = params.warpN + nm.x;
  let m = params.warpM + nm.y;

  let u = (p.x + 1.0) * 0.5;
  let v = (p.y + 1.0) * 0.5;

  let w = cos(n * PI * u) * cos(m * PI * v) - cos(m * PI * u) * cos(n * PI * v);

  let dwdu = -n * PI * sin(n * PI * u) * cos(m * PI * v)
             + m * PI * sin(m * PI * u) * cos(n * PI * v);
  let dwdv = -m * PI * cos(n * PI * u) * sin(m * PI * v)
             + n * PI * cos(m * PI * u) * sin(n * PI * v);

  // Descend |w|: step against the gradient, signed by which side of the node
  // this grain sits on.
  let g = vec2<f32>(dwdu, dwdv) * sign(w) * 0.5;

  // Vibration amplitude scales with |w| — grains far from a node keep getting
  // kicked, grains on the node go still. That is what sharpens the figure.
  let amp = abs(w);
  let j = vec2<f32>(
    hash(i * 2u + u32(params.time * 60.0)) - 0.5,
    hash(i * 2u + 1u + u32(params.time * 60.0)) - 0.5
  );

  var vel = (p.zw - g * 2.4 * dt + j * amp * 2.2 * dt) * 0.86;
  var pos = p.xy + vel * dt;

  pos = clamp(pos, vec2<f32>(-1.0), vec2<f32>(1.0));
  return vec4<f32>(pos, vel);
}

// --- fixed-potential modes ---------------------------------------------------
//
// The barred disc, the collision and the original fixed-potential disc, kept as
// their own force laws rather than folded into the one above. None of them sees
// the density mesh at all: every particle here is a test particle in a
// prescribed field, which is the whole difference between them and mode 0. The
// constants come from sim/barred.ts and sim/classic.ts so there is one source of
// truth per mode.

const BD_G_CORE = ${barred.G_CORE};
const BD_DAMP_INNER = ${barred.DAMP_INNER};
const BD_DAMP_OUTER = ${barred.DAMP_OUTER};
const BD_BAR_OMEGA = ${barred.BAR_OMEGA};
const BD_BAR_K = ${barred.BAR_K};
const BD_BAR_A2 = ${barred.BAR_A2};
const BD_ESCAPE_R = ${barred.ESCAPE_R};
const BD_RETURN_LO = ${barred.RETURN_LO};
const BD_RETURN_HI = ${barred.RETURN_HI};
const BD_CORE_FRAC = ${barred.CORE_FRAC};
const BD_SPECIES_SPREAD = ${barred.SPECIES_SPREAD};
const CL_RADIAL_DAMP = ${classic.RADIAL_DAMP};

/**
 * The barred disc's primary, and the circular speed under it -- attraction minus
 * a short-range repulsive core, without which the population collapses to a
 * point. Its own pair, because this mode's core is stronger than mode 0's and
 * carries no disc mass beside it.
 */
fn bdCoreF(q : f32) -> f32 {
  return BD_G_CORE / (q * sqrt(q)) - 0.0025 / (q * q);
}

fn bdVCirc(r : f32) -> f32 {
  let q = r * r + 0.004;
  return r * sqrt(max(0.0, bdCoreF(q)));
}

/**
 * The radius a particle belongs at, from its species -- and deliberately not a
 * clean function of it.
 *
 * Some species/radius correlation has to survive recycling. Returning everything
 * to one shared band was measured to converge all six species onto the same mean
 * radius within a minute, and additive blending over a mixed population is grey:
 * the disc whitens and the filter chips stop carving anything.
 *
 * But the first fix for that -- one hard annulus per species -- traded the
 * problem for a worse one. Six disjoint bands draw six clean concentric rings,
 * and clean concentric rings look authored. This demo's whole claim is that its
 * structure is emergent, and a ring you can predict from a constant is not.
 *
 * So the bands overlap, by more than a full species width. Each particle draws a
 * home radius from a distribution centred on its species and wide enough to
 * reach well into its neighbours'. Statistically the six colors still occupy six
 * different parts of the disc. Locally, no edge between them is anywhere.
 */
fn bdHomeRadius(i : u32) -> f32 {
  let j = (hash(i * 11u + 5u) - 0.5) * BD_SPECIES_SPREAD;
  let f = clamp((f32(cspecies[i]) + 0.5 + j) / 6.0, 0.04, 1.0);
  return BD_RETURN_LO + (BD_RETURN_HI - BD_RETURN_LO) * f;
}

/**
 * Put a particle back on the disc, on a circular orbit along its current ray.
 *
 * Both ends of the disc leak, and each leak is what this mode used to decay into.
 *
 * Outward: the box walls used to be inelastic reflectors, so every grain the
 * cursor threw out ended up sliding along an edge. Enough of them tile the square
 * with a uniform speckle that nothing ever clears -- that was the static.
 *
 * Inward: a bar torques angular momentum outward, which drives the material that
 * loses it toward the centre; the radial damping then makes that one-way. Real
 * bars do exactly this, and it is why they fuel nuclear starbursts. Measured
 * here, the entire disc was inside r < 0.2 within thirty seconds, which is the
 * white blob. Left alone, the honest end state of this system is a point.
 *
 * So the disc is closed rather than conservative: what falls through the middle
 * comes back at the edge. This is the one piece of the force law that is a choice
 * about the toy rather than about the physics, and it is what makes the steady
 * state a structured disc instead of a bright dot.
 */
fn bdRespawn(i : u32, dir : vec2<f32>, spin : f32) -> vec4<f32> {
  let r = bdHomeRadius(i);
  let vOrb = bdVCirc(r) * spin;
  return vec4<f32>(dir * r, -dir.y * vOrb, dir.x * vOrb);
}

fn bdDamping(r : f32) -> f32 {
  return mix(BD_DAMP_INNER, BD_DAMP_OUTER, smoothstep(0.25, 0.6, r));
}

/**
 * Rotating bar: an m=2 quadrupole turning at a fixed pattern speed.
 *
 * This disc has no self-gravity -- every particle is an independent test particle
 * in a smooth potential. That has a consequence which no amount of tuning fixes:
 * inner orbits run faster than outer ones, so any arm the cursor raises shears,
 * winds up, and phase-mixes below pixel size within seconds. Real spiral arms are
 * held together by the disc's own gravity responding to itself, which is what
 * mode 0 does and this one cannot.
 *
 * A rotating quadrupole replaces decay with a *driving* frequency. Orbits whose
 * own frequency resonates with the pattern get herded onto closed orbits and stay
 * there: a ring near the inner Lindblad resonance, another near the outer one,
 * with the bar between them. This is why real barred galaxies have rings, and
 * unlike a stirred arm it cannot mix away, because the driver never stops. The
 * resting state becomes structure rather than mush.
 *
 *   phi(r, th) = A(r) * cos(2 * (th - OMEGA * t)),   A(r) = -K r^2 / (r^2 + a^2)^2
 *
 * A vanishes at the centre and falls off outside a, so the bar is confined to the
 * disc and the core stays a clean monopole. Forces are the exact gradient of that
 * potential, so the pattern shuffles energy between orbits without injecting any.
 *
 * ur is the outward radial unit vector; the double angle comes from it directly
 * (cos 2th = ux^2 - uy^2, sin 2th = 2 ux uy), so there is no atan2 per particle.
 */
fn bdBar(ur : vec2<f32>, r : f32, t : f32) -> vec2<f32> {
  let c2 = ur.x * ur.x - ur.y * ur.y;
  let s2 = 2.0 * ur.x * ur.y;
  let cp = cos(2.0 * BD_BAR_OMEGA * t);
  let sp = sin(2.0 * BD_BAR_OMEGA * t);
  // Rotate the pattern: angles relative to the bar, not to the screen.
  let cos2 = c2 * cp + s2 * sp;
  let sin2 = s2 * cp - c2 * sp;

  let q = r * r + BD_BAR_A2;
  let a = -BD_BAR_K * r * r / (q * q);
  let da = -2.0 * BD_BAR_K * r * (BD_BAR_A2 - r * r) / (q * q * q);

  let fr = -da * cos2;          // -dphi/dr
  let ft = 2.0 * a * sin2 / r;  // -(1/r) dphi/dth
  return ur * fr + vec2<f32>(-ur.y, ur.x) * ft;
}

fn bdIntegrate(i : u32, p : vec4<f32>, dt : f32) -> vec4<f32> {
  // Primary: fixed at the origin. This is what holds the disc together.
  let dc = -p.xy;
  let dc2 = dot(dc, dc) + 0.004;
  let rc = sqrt(dc2);
  let fc = bdCoreF(dc2);

  // Secondary: the cursor. Softened harder so a direct hit shears rather than
  // slingshots.
  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let dm2 = dot(dm, dm) + 0.02;
  let fm = params.gcur / (dm2 * sqrt(dm2));

  // Rotating pattern. Without it the disc is a decaying system with nothing to
  // regenerate structure; with it, rings are where the disc settles.
  let ur = -dc / rc;
  let fb = bdBar(ur, rc, params.time);

  var v = p.zw + dc * fc * dt + dm * fm * dt + fb * dt;

  // Damp the RADIAL component only -- see the integrate entry point for why
  // uniform damping collapses a disc into a ball.
  //
  // The rate is a function of radius, and it has to be. Measured at a single
  // uniform rate, the two failure modes are exclusive: damp hard enough to
  // circularize the scattered material (which is what stops the field turning
  // into speckle) and the bar's torque drains the disc inward until the inner
  // annulus is fourteen times denser than everything else -- the white core.
  // Damp gently enough to prevent that and the speckle never clears. Dissipating
  // in the outer disc and not in the inner one separates the two.
  let rdir = dc / rc;
  let vRad = dot(v, rdir) * rdir;
  v = (v - vRad) + vRad * bdDamping(rc);

  // Whisper of global damping purely to bound energy the moving cursor injects.
  v = v * 0.99995;

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }

  let pos = p.xy + v * dt;

  // Close the disc at both ends -- see bdRespawn(). Sign of angular momentum is
  // carried across, so a recycled grain rejoins moving the way the disc moves.
  //
  // The inner bound is per particle, at a fraction of its own home radius -- so
  // it is as ragged as bdHomeRadius() is, and the hole in the middle has no
  // clean edge.
  let floorR = max(0.05, bdHomeRadius(i) * BD_CORE_FRAC);
  let pr = length(pos);
  if (pr > BD_ESCAPE_R || pr < floorR) {
    let spin = select(-1.0, 1.0, (pos.x * v.y - pos.y * v.x) >= 0.0);
    return bdRespawn(i, pos / max(pr, 1e-6), spin);
  }

  return vec4<f32>(pos, v);
}

/**
 * Galaxy collision: the restricted three-body model.
 *
 * Two cores on their own two-body orbit, solved on the CPU and arriving here as
 * five floats; every particle is a massless test particle in the sum of their two
 * fields. Toomre & Toomre showed in 1972 that this -- no self-gravity, no gas,
 * no N-body -- is enough to produce the tidal tails and the bridge that the
 * Antennae and the Mice are famous for. The tails are not thrown out by the
 * collision so much as left behind by it: material on the far side of each disc
 * is held less tightly than material on the near side, so the differential pull
 * stretches the disc into a tail pointing away and a bridge pointing across.
 *
 * The disc's spin sense relative to the orbit is the whole story. A prograde
 * encounter -- disc rotating the same way the cores swing -- keeps the outer
 * particles in step with the perturber for a long fraction of an orbit, and that
 * sustained pull is what throws a tail half the frame long. Flip the spin and
 * the same encounter barely marks it. Press R to see the difference; it is the
 * single most surprising result in the file.
 *
 * Nothing is recycled here and there are no walls. A tail is material genuinely
 * leaving, and catching it would be catching the thing worth watching.
 */
fn collide(p : vec4<f32>, dt : f32) -> vec4<f32> {
  let d0 = params.c0 - p.xy;
  let q0 = dot(d0, d0) + 0.004;
  let d1 = params.c1 - p.xy;
  let q1 = dot(d1, d1) + 0.004;

  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let qm = dot(dm, dm) + 0.02;

  var v = p.zw
    + d0 * (params.pmass / (q0 * sqrt(q0))) * dt
    + d1 * (params.pmass / (q1 * sqrt(q1))) * dt
    + dm * (params.gcur / (qm * sqrt(qm))) * dt;

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }
  return vec4<f32>(p.xy + v * dt, v);
}

/**
 * The original disc: anchored monopole, weak cursor, uniform radial damping,
 * walls. Nothing drives it and nothing responds to it, so it phase-mixes into a
 * smooth annulus within seconds and stays there -- which is what both the bar
 * above and the self-gravity below exist to answer. Kept so the comparison can
 * be watched rather than described.
 */
fn clsIntegrate(p : vec4<f32>, dt : f32) -> vec4<f32> {
  let dc = -p.xy;
  let dc2 = dot(dc, dc) + 0.004;
  let rc = sqrt(dc2);
  let fc = params.gcore / (dc2 * rc) - 0.0025 / (dc2 * dc2);

  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let dm2 = dot(dm, dm) + 0.02;
  // params.gcur, not a constant: this mode switches between two cursor masses on
  // pointer down, like the barred disc above -- see G_CURSOR_HELD in
  // sim/classic.ts.
  let fm = params.gcur / (dm2 * sqrt(dm2));

  var v = p.zw + dc * fc * dt + dm * fm * dt;

  let rdir = dc / rc;
  let vRad = dot(v, rdir) * rdir;
  v = (v - vRad) + vRad * CL_RADIAL_DAMP;
  v = v * 0.99995;

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }

  var pos = p.xy + v * dt;

  // Inelastic walls: perfectly elastic ones let escapees accumulate speed.
  let bounce = 0.45;
  if (pos.x < -1.0) { pos.x = -1.0; v.x = -v.x * bounce; }
  else if (pos.x > 1.0) { pos.x = 1.0; v.x = -v.x * bounce; }
  if (pos.y < -1.0) { pos.y = -1.0; v.y = -v.y * bounce; }
  else if (pos.y > 1.0) { pos.y = 1.0; v.y = -v.y * bounce; }

  return vec4<f32>(pos, v);
}

// --- self-gravity: three passes over a GRID x GRID mesh ----------------------

@compute @workgroup_size(${WORKGROUP})
fn clearGrid(@builtin(global_invocation_id) gid : vec3<u32>) {
  let c = gid.x;
  if (c >= CELLS) { return; }
  atomicStore(&dens[c], 0u);
}

/**
 * Deposit every particle's mass into the mesh, cloud-in-cell.
 *
 * CIC splits each particle across the four cells nearest it, weighted by
 * distance, rather than dropping it whole into the one it happens to sit in.
 * That is the accurate choice — nearest-cell deposition makes a particle's force
 * contribution jump discontinuously as it drifts over a cell boundary, and a
 * million particles each jittering at the grid scale is a permanent noise floor
 * under exactly the faint arm structure this exists to expose.
 *
 * It is also, unexpectedly, the *fast* choice. Measured at 1M on a Gen-9 iGPU,
 * nearest-cell at one atomic per particle cost 8.6 ms; cloud-in-cell at four
 * cost 3.4 ms. Four times the atomic operations, two and a half times faster.
 *
 * The reason is that this pass is bound by contention, not by throughput. An
 * exponential disc drops an enormous share of the population into a handful of
 * central cells, and atomics against one address serialise. Nearest-cell aims
 * every one of those particles at a single cell; CIC spreads each across four,
 * which divides the queue. Nothing about the instruction count predicts this,
 * and it is why the grid resolution was chosen by measurement (see solveField).
 *
 * Accumulating into a private per-workgroup tile first — the textbook fix for
 * atomic contention — was tried and reverted. It does cut global atomic traffic
 * by well over an order of magnitude, but it also collapses a million
 * independent threads into sixty-odd workgroups that each clear and flush a
 * 4096-cell tile, and the lost parallelism costs more than the contention did:
 * 4.0 ms against 3.4 ms. The contention here is apparently already being
 * absorbed by the cache hierarchy about as well as on-chip storage would.
 *
 * Fixed point because WGSL has no atomic<f32>. fpScale is chosen on the CPU so
 * that count * fpScale cannot overflow u32 even in the degenerate case where
 * every particle lands in the same cell.
 */
@compute @workgroup_size(${WORKGROUP})
fn depositMass(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= u32(params.pcount)) { return; }

  // Outside the mesh box this is outer-field material, and the mesh has nothing
  // to say about it: the box does not cover where it is. Depositing it anyway
  // would not merely be wasted work -- the clamps below would file every one of
  // these particles into an edge cell, welding an eighth of the population into
  // a fake rim of mass around the boundary that the disc would then feel.
  //
  // This is what makes a domain larger than the solver cheap. The field is a
  // full participant in the force law and contributes nothing to its cost:
  // GRID stays at 64 and the O(GRID^4) convolution is untouched.
  let q = parts[i].xy;
  if (max(abs(q.x), abs(q.y)) >= ${MESH_R.toFixed(3)}) { return; }

  let g = gridCoord(parts[i].xy);
  let base = floor(g);
  let f = g - base;

  for (var dy = 0u; dy < 2u; dy++) {
    let jy = clamp(i32(base.y) + i32(dy), 0, i32(GRID) - 1);
    let wy = select(1.0 - f.y, f.y, dy == 1u);
    for (var dx = 0u; dx < 2u; dx++) {
      let jx = clamp(i32(base.x) + i32(dx), 0, i32(GRID) - 1);
      let w = select(1.0 - f.x, f.x, dx == 1u) * wy;
      atomicAdd(&dens[u32(jy) * GRID + u32(jx)], u32(w * params.fpScale + 0.5));
    }
  }
}

/**
 * Convert the atomic fixed-point mesh into plain floats, once, before the
 * convolution reads it 4096 times over.
 *
 * This pass looks redundant and is not. Atomic loads are not ordinary loads:
 * on most hardware they are serviced coherently and bypass the caches that make
 * a broadcast read of the same address across a whole wave nearly free. The
 * convolution's inner loop reads every cell once per target cell, so doing it
 * atomically means 16.7 million uncached reads. Baking to a normal array first
 * costs 4096 atomic loads total and lets the hot loop hit cache.
 */
@compute @workgroup_size(${WORKGROUP})
fn bakeGrid(@builtin(global_invocation_id) gid : vec3<u32>) {
  let c = gid.x;
  if (c >= CELLS) { return; }
  cellMass[c] = f32(atomicLoad(&dens[c])) * params.massScale;
}

/**
 * Convolve the mesh against itself: the acceleration at every cell from the
 * mass in every other cell.
 *
 * This is the one genuinely quadratic step, and it is quadratic in *cells*, not
 * particles -- 4096 targets x 4096 sources, fixed forever regardless of whether
 * the population is ten thousand or ten million. Done directly rather than
 * through an FFT or a relaxation solver for one specific reason: boundary
 * conditions. A galaxy sits in empty space, and both an FFT and a Jacobi/
 * multigrid solve want a boundary condition at the edge of the box that empty
 * space does not supply -- periodic wrapping makes the disc feel copies of
 * itself, and a Dirichlet edge needs a multipole expansion to be honest. Summing
 * the pairs directly has open boundaries built in, needs no solver, cannot fail
 * to converge, and is about forty lines. At this grid size it is affordable, so
 * it wins.
 *
 * The empty-cell skip is not a micro-optimization. A galaxy occupies maybe a
 * third of the box, and every thread in a workgroup walks the source cells in
 * the same order, so the branch is uniform across the wave -- no divergence, and
 * the loop simply gets shorter.
 */
@compute @workgroup_size(${WORKGROUP})
fn solveField(@builtin(global_invocation_id) gid : vec3<u32>) {
  let t = gid.x;
  if (t >= CELLS) { return; }

  let tp = cellCenter(t);
  var a = vec2<f32>(0.0, 0.0);

  for (var s = 0u; s < CELLS; s++) {
    let m = cellMass[s];
    // Skip by mass, not by emptiness.
    //
    // Testing for exact zero looks equivalent and quietly makes the cost a
    // function of how long the simulation has been running. A compact disc
    // occupies about a third of the grid; give it a minute and a thin spray of
    // escapees has touched roughly 80% of it, and every one of those cells costs
    // a full row of this loop while carrying a millionth of the mass. Measured
    // at 1M, self-gravity cost 3.4 ms on a fresh disc and 9.7 ms on a settled
    // one — the same code, three times slower, purely from where the stragglers
    // had got to.
    //
    // The floor is five orders of magnitude below a typical occupied cell, so
    // what it discards is far beneath the force noise the mesh already carries.
    if (m <= params.massFloor) { continue; }
    let d = cellCenter(s) - tp;
    // Softened, and the softening length is the reason the mesh is stable: a
    // bare 1/r^2 between neighboring cells would let a single dense cell fling
    // its neighbors away rather than pull the disc together.
    let q = dot(d, d) + ${(SOFT_CELLS * (2 / GRID)) ** 2};
    a += d * (m / (q * sqrt(q)));
  }

  field[t] = a;
}

/** Bilinear gather of the acceleration field at an arbitrary point. Matches the
 *  CIC deposit above, which is what makes the scheme conserve momentum. */
fn sampleField(p : vec2<f32>) -> vec2<f32> {
  let g = gridCoord(p);
  let base = floor(g);
  let f = g - base;

  var a = vec2<f32>(0.0, 0.0);
  for (var dy = 0u; dy < 2u; dy++) {
    let jy = clamp(i32(base.y) + i32(dy), 0, i32(GRID) - 1);
    let wy = select(1.0 - f.y, f.y, dy == 1u);
    for (var dx = 0u; dx < 2u; dx++) {
      let jx = clamp(i32(base.x) + i32(dx), 0, i32(GRID) - 1);
      let w = select(1.0 - f.x, f.x, dx == 1u) * wy;
      a += field[u32(jy) * GRID + u32(jx)] * w;
    }
  }
  return a;
}

@compute @workgroup_size(${WORKGROUP})
fn integrate(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }

  var p = parts[i];
  let dt = params.dt;

  if (params.mode == ${CHLADNI}u) {
    parts[i] = chladni(i, p, dt);
    return;
  }
  if (params.mode == ${BARRED}u) {
    parts[i] = bdIntegrate(i, p, dt);
    return;
  }
  if (params.mode == ${COLLISION}u) {
    parts[i] = collide(p, dt);
    return;
  }
  if (params.mode == ${CLASSIC}u) {
    parts[i] = clsIntegrate(p, dt);
    return;
  }

  // Central mass: bulge plus halo, fixed at the origin.
  //
  // An earlier revision made the *cursor* the only attractor. Moving it broke
  // every orbit simultaneously and the disc detonated into uniform static, with
  // nothing left to re-form it. Anchoring the primary and demoting the cursor to
  // a weaker secondary mass turns interaction into tidal perturbation: the arms
  // stretch and wake, then relax back.
  //
  // Plus the dark halo in mode ${HALO}, which is this same force law with that one
  // term switched on -- see M_HALO in sim/world.ts. Unlike the mesh below it acts
  // on the outer field as well, because a flat rotation curve is a statement
  // about what happens outside the disc.
  let dc = -p.xy;
  let dc2 = dot(dc, dc) + 0.004;
  let rc = sqrt(dc2);
  let fc = coreF(dc2) + haloF(dc2);

  // The disc's own gravity, gathered from the mesh the first three passes built.
  // This is the term that makes structure possible: it is the only one that
  // depends on where the other particles actually are this frame, so it is the
  // only one that can respond to an overdensity and amplify it into an arm.
  //
  // Outside the mesh box the disc is a point mass instead, and that is an
  // approximation only in name. Out there the whole disc subtends a small angle
  // -- at r = 1.5 it is a 0.65-radius object 1.5 away -- so its field is
  // M_DISC/r^2 to within its own flattening. It is also the *same* field the
  // outer particles were seeded on: vCirc() in sim/world.ts uses discEnclosed(),
  // which has already saturated to M_DISC by r = 1, so the field is stepped
  // along exactly the orbit it was placed on and does not drift.
  //
  // Cost: one reciprocal, against the alternative of growing the mesh to cover
  // the domain, which at the same cell size is GRID 64 -> 128 and 16x the
  // convolution.
  let outer = max(abs(p.x), abs(p.y)) >= ${MESH_R.toFixed(3)};
  var sg : vec2<f32>;
  if (outer) {
    sg = dc * (${M_DISC} / (dc2 * rc));
  } else {
    sg = sampleField(p.xy);
  }

  // Secondary: the cursor. Softened harder so a direct hit shears rather than
  // slingshots.
  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  // Mass and softening ramp together: the well deepens *and* narrows, so a hold
  // captures what is near the pointer instead of tugging on the whole disc.
  let ht = clamp((params.grav - 1.0) / (G_CURSOR_HOLD - 1.0), 0.0, 1.0);
  let soft = mix(CURSOR_SOFT2, CURSOR_SOFT2_HOLD, ht);
  let dm2 = dot(dm, dm) + soft;
  let fm = G_CURSOR * params.grav / (dm2 * sqrt(dm2));

  var v = p.zw + dc * fc * dt + sg * dt + dm * fm * dt;

  // Every dissipative term below belongs to the disc, so the outer field skips
  // all of them and orbits without friction of any kind.
  //
  // Not a shortcut -- applying them out there was measurably wrong. The field
  // is seeded on exactly circular orbits, so radial damping has nothing to
  // remove, but the 0.99995 global bleed does: for a Keplerian orbit r goes as
  // L^2, so shaving 3% off the speed costs 6% of the radius, permanently and
  // every minute. Measured with the disc's damping applied to the field, the
  // 90th-percentile field radius fell from 1.79 to 1.42 over sixty seconds and
  // was still falling -- the margins the field exists to fill were emptying
  // again while you watched. The disc over the same run held at 0.75-0.83,
  // because a disc-dominated rotation curve is much flatter than r^-1/2 and
  // because the mesh keeps re-circularizing it.
  //
  // The physical reading is the honest one too. Radial damping stands in for
  // gas radiating away the heat that spiral structure generates, and the global
  // bleed bounds the energy a moving cursor injects. The field has no gas, makes
  // no structure, and sits far outside the cursor's reach.
  if (!outer) {
    // Damp the RADIAL component only.
    //
    // Uniform damping looks harmless and is not: it bleeds orbital speed, orbits
    // shrink, and within ten seconds the whole disc has inspiralled into one dense
    // ball. Damping only the radial component removes eccentricity while leaving
    // angular momentum intact, which is what real accretion discs do — orbits
    // circularize instead of decaying. The practical payoff is that the disc
    // actively re-forms after the cursor stirs it, rather than staying wrecked.
    let rdir = dc / rc;
    let vRad = dot(v, rdir) * rdir;
    v = (v - vRad) + vRad * params.rdamp;

    // Whisper of global damping purely to bound energy the moving cursor injects.
    v = v * 0.99995;

    // Capture drag, held only. Weighted by proximity so it is a local well of
    // friction rather than a global brake -- see CAPTURE_R2 in sim/world.ts.
    //
    // Damps only the component along the line to the cursor, for exactly the
    // reason the disc's own cooling is radial-only: braking the full velocity
    // vector leaves the captured material with no angular momentum about anything,
    // and the knot drops straight down the core's potential the moment you let go.
    // Bleeding the approach component instead circularizes material into orbit
    // around the pointer, which both looks like capture and survives release.
    let cw = ht * exp(-dm2 / CAPTURE_R2);
    let mdir = dm / max(1e-4, length(dm));
    v = v - dot(v, mdir) * mdir * min(0.9, CAPTURE_K * cw * dt);
  }

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }

  var pos = p.xy + v * dt;

  // Inelastic walls: perfectly elastic ones let escapees accumulate speed.
  // At DOMAIN rather than at the mesh box -- the outer field lives between the
  // two, and bouncing it off the edge of the solver would be bouncing it off
  // nothing.
  let bounce = 0.45;
  let W = ${DOMAIN.toFixed(3)};
  if (pos.x < -W) { pos.x = -W; v.x = -v.x * bounce; }
  else if (pos.x > W) { pos.x = W; v.x = -v.x * bounce; }
  if (pos.y < -W) { pos.y = -W; v.y = -v.y * bounce; }
  else if (pos.y > W) { pos.y = W; v.y = -v.y * bounce; }

  parts[i] = vec4<f32>(pos, v);
}

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
  @location(1) speed : f32,
  @location(2) tint : vec3<f32>,
};

@group(0) @binding(0) var<storage, read> rparts : array<vec4<f32>>;
@group(0) @binding(1) var<uniform> rparams : Params;
@group(0) @binding(2) var<storage, read> rspecies : array<u32>;

// Two triangles per particle, expanded from vertex_index. No index buffer,
// no per-particle vertex data — the position comes straight from storage.
const QUAD = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
);

@vertex
fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VSOut {
  let p = rparts[ii];
  let corner = QUAD[vi];
  let size = rparams.size;
  let sp = rspecies[ii];

  var out : VSOut;

  // Filtering happens here, on the GPU, over the whole population. The filter
  // chips are the only thing the reactive graph drives; culling a million
  // particles is a single uniform bit test per vertex, not a JS pass.
  if ((rparams.mask & (1u << sp)) == 0u) {
    out.pos = vec4<f32>(0.0, 0.0, 0.0, 0.0); // degenerate — clipped away
    out.uv = corner;
    out.speed = 0.0;
    out.tint = vec3<f32>(0.0);
    return out;
  }

  // Fit the simulation to the viewport, applying the same factor to the position
  // as to the sprite.
  //
  // One camera for every mode. vscale is the whole of it -- how much clip
  // space one simulation unit spans along the short axis -- and it is solved on
  // the CPU by cameraZoom() in backend.ts, which is where the framing decisions
  // live. Nothing here is per-mode, so a mode cannot drift into its own framing.
  //
  // What is left is splitting that one number across the two axes, and both axes
  // take the same factor. Scaling them independently is what stretches the box to
  // fill the window, and it draws a circular orbit as an ellipse -- the galaxy
  // reads as something squashed rather than something seen face-on. Dividing by
  // max(a, 1) rather than always by a matters for the same reason in the other
  // direction, or a portrait window overflows the subject off the sides instead
  // of the top.
  //
  // The sprite takes the same factor as the position, so a particle is the same
  // fraction of the subject at every window size.
  let a = rparams.aspect;
  let s = rparams.vscale;
  let fx = s / max(a, 1.0);
  let fy = s * min(a, 1.0);

  // Inclination. The disc's y is foreshortened; the quad's own y is not, so a
  // particle stays a round dot rather than becoming a squashed one -- the disc
  // is being tilted, not the stars in it. vscale has already been solved against
  // the same factor, so the foreshortened disc fills the frame instead of
  // shrinking inside it. See cameraZoom in backend.ts.
  out.pos = vec4<f32>(
    (p.x + corner.x * size) * fx,
    (p.y * rparams.tiltY + corner.y * size) * fy,
    0.0, 1.0
  );
  out.uv = corner;
  out.speed = clamp(length(p.zw) * 0.22, 0.0, 1.0);
  // Shift toward white with speed so the dense hot core still reads as bright
  // without losing species identity in the arms.
  //
  // In mono the palette is dropped for a single faintly warm white. Structure in
  // this image is carried almost entirely by density rather than by hue, so
  // removing color costs nothing legible and the arms actually read *harder* —
  // which is why deep-sky astrophotography is usually luminance first.
  let base = select(PALETTE[sp], vec3<f32>(0.86, 0.89, 1.0), rparams.mono > 0.5);
  out.tint = mix(base, vec3<f32>(1.0, 0.95, 0.88), out.speed * 0.3);
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  // Soft radial falloff; discard outside the disc so quads never show.
  let r = dot(in.uv, in.uv);
  if (r > 1.0) { discard; }
  let a = (1.0 - r) * (1.0 - r);

  // Additive, into a 16-bit float target. The target format is the point: this
  // sum is unbounded and genuinely reaches into the tens, so an 8-bit
  // attachment clips it. gain now only normalizes for population size, keeping
  // total deposited light constant as the count changes; it no longer has to
  // double as a saturation guard, which is what used to force it so low that
  // the arms went dark before the core stopped being white.
  return vec4<f32>(in.tint * a * rparams.gain, a * rparams.gain);
}

// --- tonemap -----------------------------------------------------------------

/**
 * Fullscreen pass, HDR accumulation buffer to the swap chain.
 *
 * This exists because the old renderer had a hard ceiling that had nothing to do
 * with the physics. Each particle deposited about 0.196 of alpha at the 1M gain
 * floor, the disc averaged ~3.9 particles per pixel, so the *mean* of the galaxy
 * sat at 0.77 of full white and the inner disc ran roughly eight times over it.
 * Past that point every pixel reads 1.0 and density stops being visible at all:
 * structure and no structure look identical. Fixing the simulation alone would
 * not have made a single extra arm visible.
 *
 * The curve is 1 - exp(-x), which has no ceiling to hit -- it maps [0, inf) into
 * [0, 1) and simply compresses harder as it climbs. Applied per channel, so a
 * region bright enough to saturate one channel keeps rendering detail in the
 * others and the core rolls off through its own hue toward white instead of
 * clamping flat, which is also what an overexposed bright source really does.
 */
struct TMOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn tmVs(@builtin(vertex_index) vi : u32) -> TMOut {
  // One oversized triangle rather than two quad triangles: no seam down the
  // diagonal, and three vertices instead of six.
  let p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0), vec2<f32>(-1.0, 1.0), vec2<f32>( 3.0, 1.0)
  );
  var o : TMOut;
  o.pos = vec4<f32>(p[vi], 0.0, 1.0);
  o.uv = p[vi];
  return o;
}

@group(0) @binding(0) var hdr : texture_2d<f32>;
@group(0) @binding(1) var<uniform> tparams : Params;

@fragment
fn tmFs(in : TMOut) -> @location(0) vec4<f32> {
  let c = textureLoad(hdr, vec2<i32>(in.pos.xy), 0).rgb;

  // Tonemap the *luminance* and carry the chroma through unchanged, rather than
  // curving each channel on its own.
  //
  // Per-channel is the obvious version and it quietly destroys the palette. Six
  // species are only distinguishable by their ratios between channels, and any
  // curve applied independently to each one compresses the largest channel
  // hardest -- so the ratios flatten exactly where the disc is densest and every
  // bright region converges on white regardless of what color it started. That
  // is most of why the old renderer had six colors and showed one. Scaling all
  // three by a single factor moves brightness without touching hue at all.
  let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  // Reinhard, x / (1 + x), rather than 1 - exp(-x).
  //
  // An exponential disc spans a genuinely enormous range: the core is orders of
  // magnitude denser than the arms, which is the whole reason it looks like a
  // galaxy. 1 - exp(-x) is effectively saturated by x = 5, so any exposure that
  // lifted the arms out of the noise flattened the entire core to a white disc.
  // Reinhard never saturates -- it is still returning distinguishable values at
  // x = 100 -- so the core keeps its internal structure while the arms stay lit.
  let e = l * tparams.exposure;
  let lm = e / (1.0 + e);
  var mapped = c * (lm / max(l, 1e-6));

  // One concession: at the very top the ratio-preserving form can push a channel
  // past 1.0, which clips and shifts the hue anyway. Fading toward neutral over
  // the last stop keeps the genuinely overexposed core rolling off to white --
  // which is what an overexposed source does -- without touching anything below.
  mapped = mix(mapped, vec3<f32>(lm), smoothstep(0.75, 1.0, lm));

  // Background sits underneath rather than being cleared into the accumulation
  // buffer, so it never participates in the tonemap and the darkest particle
  // still lifts off it.
  let bg = vec3<f32>(0.027, 0.035, 0.051);
  let lit = bg + clamp(mapped, vec3<f32>(0.0), vec3<f32>(1.0)) * (1.0 - bg);

  // The swap chain is a plain unorm format, so the sRGB transfer is ours to
  // apply. Without it the whole image is roughly a stop and a half too dark and
  // every mid-tone is crushed.
  return vec4<f32>(pow(lit, vec3<f32>(1.0 / 2.2)), 1.0);
}
`;

export async function createWebGPUBackend(
  canvas: HTMLCanvasElement,
  sim: Sim,
): Promise<Backend | null> {
  if (!navigator.gpu) return null;

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return null;

  const device = await adapter.requestDevice();

  // WebGPU reports most validation failures asynchronously. Without this the
  // failure mode is a black canvas and no console output, which is the worst
  // possible thing to debug.
  device.addEventListener('uncapturederror', (e) => {
    console.error('[webgpu]', (e as GPUUncapturedErrorEvent).error.message);
  });
  const ctx = canvas.getContext('webgpu');
  if (!ctx) return null;

  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const particleBuf = device.createBuffer({
    size: sim.particles.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  device.queue.writeBuffer(particleBuf, 0, sim.particles);

  // 120 bytes: 22 scalars, the two collision cores and their mass, then the two
  // live slider values and four bytes of tail padding the vec2 alignment forces.
  // Must match the Params struct exactly, vec2 alignment included.
  const PARAM_BYTES = 120;
  const paramBuf = device.createBuffer({
    size: PARAM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Reused every frame; the only per-frame CPU->GPU traffic in the demo.
  // Two views over one buffer because `mask` is a u32 among f32s.
  const paramBytes = new ArrayBuffer(PARAM_BYTES);
  const paramData = new Float32Array(paramBytes);
  const paramU32 = new Uint32Array(paramBytes);

  // The density mesh and the force field derived from it. Both are tiny —
  // 4096 cells is 16 kB and 32 kB — and neither is ever read by the CPU.
  const densBuf = device.createBuffer({
    size: CELLS * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const fieldBuf = device.createBuffer({
    size: CELLS * 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const cellMassBuf = device.createBuffer({
    size: CELLS * 4,
    usage: GPUBufferUsage.STORAGE,
  });
  // Its own staging buffer, deliberately not shared with the particle readback:
  // the sidebar holds that one mapped most of the time, and a second mapAsync
  // against a buffer with one outstanding is an immediate OperationError.
  const gridStaging = device.createBuffer({
    size: CELLS * 12,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Species ids. u32 rather than u8: WGSL storage arrays have no 8-bit element
  // type. Re-uploaded on a mode switch, because each family bands species by
  // radius differently — see seedMode() in sim/modes.ts.
  const speciesData = new Uint32Array(sim.capacity);
  const speciesBuf = device.createBuffer({
    size: speciesData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const uploadSpecies = (from = 0, to = sim.capacity) => {
    for (let i = from; i < to; i++) speciesData[i] = sim.species[i];
    // Element offsets, not byte offsets: writeBuffer measures into a typed array
    // in elements and into the destination in bytes.
    device.queue.writeBuffer(speciesBuf, from * 4, speciesData, from, to - from);
  };
  uploadSpecies();

  let mask = (1 << 6) - 1;
  let mode = SELFGRAV;
  let cooling = RADIAL_DAMP;
  let mono = false;
  let tilted = false;
  let elapsed = 0;
  let cursorMass = barred.G_CURSOR;
  // Replaced by setPair() before collision mode is ever entered; seeded here so
  // the uniform is never read uninitialized.
  let pair: PairState = createPair();

  // One staging buffer + one CPU-side view, allocated once. The list pulls a
  // small window through these every frame, so allocating per call would show
  // up as exactly the GC sawtooth this demo claims not to have.
  const staging = device.createBuffer({
    size: READBACK_MAX * 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const scratchView = new Float32Array(READBACK_MAX * 4);

  const module = device.createShaderModule({ code: SHADER });

  // Surface WGSL diagnostics with line numbers.
  //
  // Without this a shader that fails to compile produces only
  // "Invalid ComputePipeline ... due to a previous error" on every subsequent
  // submit — which names neither the entry point nor the line, and buries the
  // one message that does under a hundred frames of consequences.
  {
    const info = await module.getCompilationInfo();
    for (const m of info.messages) {
      if (m.type === 'info') continue;
      const where = `${m.lineNum}:${m.linePos}`;
      const line = SHADER.split('\n')[m.lineNum - 1]?.trim() ?? '';
      (m.type === 'error' ? console.error : console.warn)(
        `[wgsl ${where}] ${m.message}\n  ${line}`,
      );
    }
  }

  const computeLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' },
      },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    ],
  });
  const renderLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      // FRAGMENT too: the fragment stage reads params.gain. Omitting it is a
      // validation failure that WebGPU reports asynchronously — compute keeps
      // running while the render pipeline silently draws nothing.
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const computeLayoutDesc = device.createPipelineLayout({ bindGroupLayouts: [computeLayout] });
  const mkCompute = (entryPoint: string) =>
    device.createComputePipeline({ layout: computeLayoutDesc, compute: { module, entryPoint } });

  const computePipeline = mkCompute('integrate');
  const clearPipeline = mkCompute('clearGrid');
  const depositPipeline = mkCompute('depositMass');
  const bakePipeline = mkCompute('bakeGrid');
  const solvePipeline = mkCompute('solveField');

  // Particles accumulate here, not in the swap chain. rgba16float is blendable
  // in WebGPU and gives the additive sum somewhere to go above 1.0.
  const HDR_FORMAT: GPUTextureFormat = 'rgba16float';

  /**
   * The same particle pass, once per target format.
   *
   * The self-gravitating disc and the plate accumulate into the HDR texture and
   * are tonemapped; the fixed-potential modes draw straight to the swap chain
   * and clip at 1.0, which is the renderer they were built against and part of
   * how they look. A pipeline is bound to one target format, so this is two
   * objects rather than a flag.
   */
  const mkRender = (target: GPUTextureFormat) =>
    device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renderLayout] }),
      vertex: { module, entryPoint: 'vs' },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [
          {
            format: target,
            // Additive: overlapping particles bloom instead of occluding.
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });

  const renderPipeline = mkRender(HDR_FORMAT);
  const directPipeline = mkRender(format);

  const tonemapLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ],
  });

  const tonemapPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [tonemapLayout] }),
    vertex: { module, entryPoint: 'tmVs' },
    fragment: { module, entryPoint: 'tmFs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  // Recreated on resize; the bind group has to follow the texture it points at.
  let hdrTex: GPUTexture | null = null;
  let tonemapBind: GPUBindGroup | null = null;

  function allocHdr(w: number, h: number) {
    hdrTex?.destroy();
    hdrTex = device.createTexture({
      size: { width: Math.max(1, w), height: Math.max(1, h) },
      format: HDR_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    tonemapBind = device.createBindGroup({
      layout: tonemapLayout,
      entries: [
        { binding: 0, resource: hdrTex.createView() },
        { binding: 1, resource: { buffer: paramBuf } },
      ],
    });
  }
  allocHdr(canvas.width, canvas.height);

  const computeBind = device.createBindGroup({
    layout: computeLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuf } },
      { binding: 1, resource: { buffer: paramBuf } },
      { binding: 2, resource: { buffer: speciesBuf } },
      { binding: 3, resource: { buffer: densBuf } },
      { binding: 4, resource: { buffer: fieldBuf } },
      { binding: 5, resource: { buffer: cellMassBuf } },
    ],
  });
  const renderBind = device.createBindGroup({
    layout: renderLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuf } },
      { binding: 1, resource: { buffer: paramBuf } },
      { binding: 2, resource: { buffer: speciesBuf } },
    ],
  });

  let count = sim.count;

  /**
   * Re-seed the population for the current mode.
   *
   * CPU seeding and one upload, rather than a GPU kernel that
   * redraws radius from a hash: species is assigned *from* radius, and the
   * species buffer is the CPU's, so redrawing radii on the GPU independently of
   * it returns a disc with no color bands at all. It also keeps every mode's
   * initial conditions in one readable place — see seedMode() in sim/modes.ts.
   * One 16 MB upload on a keypress is a fine price for both.
   */
  function seed() {
    seedMode(sim, mode, pair);
    uploadSpecies();
    device.queue.writeBuffer(particleBuf, 0, sim.particles);
  }

  return {
    name: 'webgpu',
    detail: `${adapter.info?.vendor ?? 'gpu'} ${adapter.info?.architecture ?? ''}`.trim(),

    setCount(n: number) {
      count = Math.min(n, sim.capacity);
    },

    grow(from: number, to: number) {
      const hi = Math.min(to, sim.capacity);
      if (hi <= from) return;
      seedRange(sim, mode, pair, from, hi);
      uploadSpecies(from, hi);
      // STRIDE floats per particle: 16 bytes into the buffer, 4 elements into
      // the source array.
      device.queue.writeBuffer(
        particleBuf, from * STRIDE * 4, sim.particles, from * STRIDE, (hi - from) * STRIDE,
      );
    },

    setSpeciesMask(m: number) {
      mask = m >>> 0;
    },

    setMode(m: number) {
      mode = m | 0;
      seed();
    },

    setCooling(v: number) {
      cooling = v;
    },

    setMono(v: boolean) {
      mono = v;
    },

    setTilt(v: boolean) {
      tilted = v;
    },

    setCursorMass(m: number) {
      cursorMass = m;
    },

    setPair(p: PairState) {
      pair = p;
    },

    reset() {
      elapsed = 0;
      seed();
    },

    frame(dt: number, mx: number, my: number, grav = 1) {
      // The self-gravitating disc and the plate are tonemapped out of an HDR
      // buffer; the fixed-potential modes draw straight to the swap chain, which
      // is the renderer each of them was tuned against.
      const hdr = mode === SELFGRAV || mode === HALO || mode === CHLADNI;

      paramData[0] = dt;
      paramData[1] = mx;
      paramData[2] = my;
      paramData[3] = canvas.width / canvas.height;
      // Sprite half-width, in simulation units. Floored at roughly one physical
      // pixel — below that the quad falls between sample points and the
      // population renders as nothing at all.
      //
      // Held at 0.0018 deliberately. size is in simulation units and vscale
      // multiplies it, so each particle covers roughly a 2.2-pixel radius and a
      // million of them is ~13 million shaded fragments a frame — an obvious
      // place to look for the frame budget. Measured, dropping to 0.0012
      // returned 0.7 ms and visibly thinned the arms from ribbons to wisps.
      // The overdraw is not where the time is going (see the notes on the mesh
      // solver), so this stays at the value that renders arms with body to them.
      //
      // Scaled by the foreshortening, so that a sprite covers the same number of
      // pixels tilted as face-on. size is in simulation units and the tilted
      // camera moves in by 1/t, so without the t the stars grow on screen by 1/t
      // while the disc's *vertical* extent does not move at all -- only x
      // spreads. The point spread then doubles against the one axis the
      // inclination already compressed, and the arms smear across their own
      // thickness. The whole picture reads soft, which is what tilting looked
      // like before this term.
      const tilt = cameraTilt(mode, tilted);
      paramData[4] = Math.min(0.006, Math.max(0.0018, 0.06 / Math.sqrt(count))) * tilt;
      // Under the tonemap this is purely a normalization: total light deposited
      // across the frame is held constant as the population changes, and the
      // tonemap decides how bright that ends up looking. Drawing direct to the
      // swap chain it has to double as the saturation guard again, clamped low
      // because the core reaches very high overdraw and additive blending clips
      // to white there long before the arms are lit.
      //
      // Scaled by the foreshortening as well, because tilting is not
      // brightness-neutral -- but in the opposite direction from size, and for a
      // different reason. With sprite area now held fixed on screen, the same
      // particles carrying the same light are spread across a disc whose screen
      // area has grown by 1/t, so surface brightness *falls* by t and the arms
      // go dim. Dividing gain by t restores it: light per particle ends up 1/t
      // as before, only concentrated in a face-on-sized point rather than smeared
      // over one 1/t^2 larger. The cancellation is independent of the zoom clamp
      // in cameraZoom(), so it holds at every window shape.
      paramData[5] = (hdr ? 60_000 / count : Math.min(1, Math.max(0.3, 120_000 / count))) / tilt;
      paramU32[6] = mask;
      paramU32[7] = mode;
      elapsed += dt;
      paramData[8] = elapsed;
      if (mode === CHLADNI) {
        // Cursor sweeps the base frequency over a wide band — x drives n, y
        // drives m, each roughly 1..13. Combined with the per-species offsets
        // that spans simple crosses through to dense lattices. A slow idle
        // drift keeps it evolving when nobody is touching the mouse.
        const drift = Math.sin(elapsed * 0.11) * 1.4;
        paramData[9] = 1 + (mx * 0.5 + 0.5) * 12 + drift;
        paramData[10] = 1 + (my * 0.5 + 0.5) * 12 + drift;
      } else {
        paramData[9] = 0;
        paramData[10] = 0;
      }
      // Fixed-point scale for the atomic mass deposit, chosen so that the total
      // cannot overflow u32 even if every particle lands in one cell.
      const fpScale = Math.min(4096, Math.floor(3.9e9 / Math.max(1, count)));
      paramData[11] = fpScale;
      // Converts a raw fixed-point cell total back into simulation mass.
      // Divided by the *disc* share, not the whole population: the outer field
      // never reaches depositMass, so if each depositing particle carried
      // M_DISC/count the mesh would hold seven eighths of the disc's mass and
      // the whole thing would sit on a rotation curve it was not seeded on.
      paramData[12] = M_DISC / (count * DISC_SHARE * fpScale);
      // Tonemap exposure. Set from the arithmetic rather than by eye: each
      // particle deposits about `gain * 0.2` of light and the disc averages a
      // few particles per pixel, which puts the mean of the image near 0.05 in
      // the accumulation buffer. Under Reinhard that wants an exposure around 8
      // to land the mid-disc near a third and leave the core room to climb
      // without clipping.
      paramData[13] = 8;
      // The whole camera, in one number — see cameraZoom() in backend.ts.
      paramData[14] = cameraZoom(mode, canvas.width / canvas.height, tilted);
      paramData[15] = count;
      paramData[16] = cooling;
      // Five orders of magnitude below a typical occupied cell.
      paramData[17] = (M_DISC / CELLS) * 1e-3;
      paramData[18] = mono ? 1 : 0;
      paramData[19] = grav;
      paramData[20] = cursorMass;
      // Slot 21 is the padding c0's 8-byte alignment reserves; tiltY lives there
      // for free. The collision's old camera pull-back, which used to occupy it,
      // is now FRAME[COLLISION].r in backend.ts.
      paramData[21] = tilt;
      paramData[22] = pair.x0;
      paramData[23] = pair.y0;
      paramData[24] = pair.x1;
      paramData[25] = pair.y1;
      paramData[26] = PAIR_MASS;
      // Read from the module rather than mirrored into a local by a setter: the
      // same number also has to reach the CPU baseline and the seeding, neither
      // of which goes through a backend. See coreGravity() in sim/classic.ts.
      paramData[27] = classic.coreGravity();
      // Same arrangement, for the same reason: the halo also has to reach the
      // CPU baseline and the seeding. Zero outside the HALO mode -- see
      // haloMass() in sim/world.ts.
      paramData[28] = haloMass();
      device.queue.writeBuffer(paramBuf, 0, paramBytes);

      const enc = device.createCommandEncoder();

      const groups = Math.ceil(count / WORKGROUP);
      const cellGroups = Math.ceil(CELLS / WORKGROUP);
      const cpass = enc.beginComputePass();
      cpass.setBindGroup(0, computeBind);
      // Self-gravity: the two disc modes only. Every other mode is a prescribed
      // field and the particles in them are not supposed to see each other at
      // all. The halo mode runs the identical solver — its halo is a background
      // potential, not mass on the mesh, so nothing about this pass changes.
      //
      // Dispatches inside one compute pass are ordered and their writes are
      // visible to the next, so these four need no explicit barrier: the mesh
      // is fully deposited before it is solved, and fully solved before it is
      // sampled.
      if (mode === SELFGRAV || mode === HALO) {
        cpass.setPipeline(clearPipeline);
        cpass.dispatchWorkgroups(cellGroups);
        cpass.setPipeline(depositPipeline);
        cpass.dispatchWorkgroups(groups);
        cpass.setPipeline(bakePipeline);
        cpass.dispatchWorkgroups(cellGroups);
        cpass.setPipeline(solvePipeline);
        cpass.dispatchWorkgroups(cellGroups);
      }
      cpass.setPipeline(computePipeline);
      cpass.dispatchWorkgroups(groups);
      cpass.end();

      // Accumulate the particles. Into HDR when there is a tonemap to follow,
      // cleared to zero rather than to the background color so the background
      // does not get compressed along with them; otherwise straight to the swap
      // chain, over the background, which is what the fixed-potential modes did.
      const rpass = enc.beginRenderPass({
        colorAttachments: [
          hdr
            ? {
                view: hdrTex!.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store',
              }
            : {
                view: ctx.getCurrentTexture().createView(),
                clearValue: { r: 0.027, g: 0.035, b: 0.051, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
              },
        ],
      });
      rpass.setPipeline(hdr ? renderPipeline : directPipeline);
      rpass.setBindGroup(0, renderBind);
      rpass.draw(6, count);
      rpass.end();

      if (hdr) {
        const tpass = enc.beginRenderPass({
          colorAttachments: [
            {
              view: ctx.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'store',
            },
          ],
        });
        tpass.setPipeline(tonemapPipeline);
        tpass.setBindGroup(0, tonemapBind!);
        tpass.draw(3);
        tpass.end();
      }

      device.queue.submit([enc.finish()]);
    },

    resize(w: number, h: number) {
      canvas.width = w;
      canvas.height = h;
      allocHdr(w, h);
    },

    async readback(offset: number, n: number) {
      const start = Math.max(0, Math.min(offset, count - 1));
      const want = Math.max(0, Math.min(n, READBACK_MAX, count - start));
      if (want === 0) return scratchView.subarray(0, 0);

      const bytes = want * 16;
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(particleBuf, start * 16, staging, 0, bytes);
      device.queue.submit([enc.finish()]);

      await staging.mapAsync(GPUMapMode.READ, 0, bytes);
      scratchView.set(new Float32Array(staging.getMappedRange(0, bytes)));
      staging.unmap();
      return scratchView.subarray(0, want * 4);
    },

    /**
     * Dump the density mesh and the acceleration field derived from it.
     *
     * Not used by the demo — it exists so the self-gravity solver can be checked
     * against an independent implementation rather than against how it looks.
     * `dens` comes back in raw fixed-point units; multiply by `massScale`.
     */
    async dumpGrid() {
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(densBuf, 0, gridStaging, 0, CELLS * 4);
      enc.copyBufferToBuffer(fieldBuf, 0, gridStaging, CELLS * 4, CELLS * 8);
      device.queue.submit([enc.finish()]);

      await gridStaging.mapAsync(GPUMapMode.READ);
      const raw = gridStaging.getMappedRange();
      const dens = new Uint32Array(raw.slice(0, CELLS * 4));
      const field = new Float32Array(raw.slice(CELLS * 4, CELLS * 12));
      gridStaging.unmap();
      return { dens, field, grid: GRID, massScale: paramData[12] };
    },

    destroy() {
      particleBuf.destroy();
      paramBuf.destroy();
      speciesBuf.destroy();
      densBuf.destroy();
      fieldBuf.destroy();
      cellMassBuf.destroy();
      staging.destroy();
      gridStaging.destroy();
      hdrTex?.destroy();
      device.destroy();
    },
  };
}
