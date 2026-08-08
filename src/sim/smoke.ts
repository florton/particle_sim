/**
 * Smoke: an incompressible fluid on a staggered grid, with the population as
 * tracers in it.
 *
 * Every other mode in this set is a force law. A particle is told what it weighs
 * and where the other mass is, and it steps. Even the self-gravitating disc,
 * which needs a mesh, needs it only as an accelerator — the mesh is standing in
 * for a sum over pairs that would be correct and unaffordable, and if pairs were
 * free the mesh could be deleted without changing the physics.
 *
 * This mode cannot be written that way, and the reason is worth the file.
 *
 * A fluid is incompressible: the velocity field has to be divergence-free
 * everywhere, at every instant. That is not a force between particles, it is a
 * constraint on the whole field at once, and it propagates at infinite speed —
 * put your thumb over one end of a full pipe and the far end knows immediately.
 * Enforcing it means solving a Poisson equation for pressure over the entire
 * domain every frame and subtracting its gradient. There is no local rule, no
 * softening length and no interaction radius that produces it, because the thing
 * being imposed is global by construction. So the grid here is not an
 * optimization of something else. It is where the physics lives, and the million
 * particles are what makes it visible.
 *
 * Which is the other half. The grid is 172 x 96, and the interesting length
 * scale in a plume is much smaller than a cell: a tracer path integrates the
 * field, so material lines stretch and fold far below the resolution of the
 * thing that moved them. Rendering the grid's own density field would draw a
 * 172-pixel-wide image of a smooth blob. A million tracers through the same
 * field draw filaments the grid has no way to represent, and that difference is
 * the whole reason to spend a million particles on a 16k-cell simulation.
 *
 * This file is the CPU reference — the naive arm runs it, and the WGSL in
 * render/webgpu.ts mirrors it pass for pass. Keep the two in sync; where they
 * disagree, this one is the specification.
 *
 * Scheme is Stam's stable fluids with the usual corrections:
 *
 *   advect     semi-Lagrangian, unconditionally stable, and diffusive
 *   buoyancy   Boussinesq, from an advected temperature field
 *   confine    vorticity confinement, to put back what advect just ate
 *   project    red-black Gauss-Seidel on the pressure Poisson equation
 *
 * Velocity lives on a staggered (MAC) grid: the x-component on the vertical cell
 * faces, the y-component on the horizontal ones, pressure and temperature at the
 * centers. Collocating all of them at the centers is simpler to write and has a
 * checkerboard null space — a pressure field that alternates cell to cell has
 * zero centered gradient, so the projection cannot see it and cannot remove it.
 * It shows up as a fixed high-frequency rattle in the velocity that no amount of
 * iteration touches. Staggering makes every derivative in the scheme a
 * difference between adjacent samples, which has no null space to hide in.
 */

import { SPECIES_COUNT, STRIDE, type Sim } from './world';

/**
 * Cells per side. The fluid box is [-1, 1]^2, so a cell is 2/N across.
 *
 * Wider than it is tall, and that is a framing decision before it is a physical
 * one. The camera fits the short side of the window (see cameraZoom in
 * render/backend.ts), so a square box in a 16:9 window is a square with 44% of
 * the screen left over either side of it — and unlike the galaxy, whose margins
 * the outer field fills with more world, a fluid domain has a hard edge and the
 * empty part would read as a box drawn in the middle of the screen. A domain
 * 3.6 x 2 covers a 16:9 window exactly and leaves a small margin on 21:9.
 *
 * It is also the better box. A plume needs room either side to entrain from and
 * to spread into, and the first version of this mode was square: measured over
 * 60 s, the column went unstable, flopped against a wall and stayed there, with
 * the tracers ending up in two motionless sheets down the left and right edges
 * and the middle of the box empty. Some of that was the closed walls rather than
 * the shape, but the two problems have the same fix.
 *
 * Cells are square — one H for both axes — so every stencil in the file is
 * isotropic and no derivative needs to know which direction it is taking.
 */
export const NY = 96;
export const NX = 172;
/** Cell width in simulation units, both axes. */
export const H = 2 / NY;
/** Half-extents of the fluid box: x in [-XR, XR], y in [-1, 1]. */
export const XR = (NX * H) / 2;
export const YR = 1;
/**
 * Row stride of the two staggered velocity planes.
 *
 * NX+1 because there are NX+1 vertical faces across NX cells. Both components
 * use it even though only one of them needs the extra column: u is (NX+1) x NY
 * and v is NX x (NY+1), and padding both to (NX+1) x (NY+1) means one index
 * expression, one buffer and one dispatch shape covers the pair. The cost is one
 * wasted row and column — 269 floats out of 16781.
 */
export const SX = NX + 1;
export const CELLS = NX * NY;
export const FACES = SX * (NY + 1);

/**
 * Pressure sweeps per frame, counted in red-black pairs.
 *
 * This does not converge the Poisson solve and is not trying to. Gauss-Seidel
 * removes error at a rate set by wavelength: the cell-scale component of the
 * residual is gone in a handful of sweeps, and the box-scale component needs on
 * the order of N^2 of them. Twenty is enough that the flow has no visible local
 * compression — smoke does not pile up or tear — while the slow, smooth
 * remainder shows up as a gentle global drift that is indistinguishable from the
 * fluid being slightly compressible, which nobody can see.
 *
 * Red-black rather than Jacobi for two reasons. It converges about twice as fast
 * per unit work, because half the cells in each sweep read neighbours that were
 * already updated this sweep rather than last one. And it needs no second
 * buffer: red cells only ever read black cells, so the update is safe in place
 * even with every cell running concurrently, which is what lets the GPU version
 * run it as two plain dispatches with no ping-pong.
 */
export const SWEEPS = 20;

/**
 * Buoyant acceleration per unit temperature — the Boussinesq approximation, in
 * which a density difference enters the momentum equation as a body force and
 * nowhere else.
 *
 * Read against DRAG below rather than against the box: with a linear drag the
 * terminal speed is simply BUOY/DRAG, so 0.5 over 0.5 puts fully heated fluid at
 * about 1 unit/s and crosses the 2-unit height in a couple of seconds. Fast
 * enough to be a plume, slow enough that a tracer takes several frames to cross
 * a cell and the semi-Lagrangian backtrace stays in its own neighbourhood.
 */
export const BUOY = 0.5;
/**
 * How fast the source pulls the fluid in it toward T = 1, in e-folds per second.
 *
 * A held temperature rather than a rate of heat injection, which is the same
 * choice as a hot plate against a blowtorch and the reason is that the two
 * constants otherwise fight. Injecting at a rate leaves the source saturating at
 * HEAT/COOL, so the temperature the plume starts at and the distance it stays
 * hot for are the same knob: the first version had them at 4.0 and 4.0, which
 * gave a source at T = 1 and a cooling length of about a fifth of the box. The
 * plume got one kick at the bottom and coasted the rest of the way, and it
 * showed — measured over 60 s, the tracers never organized into a column, mean
 * tracer height sat at -0.65 and the picture was a fuzzy blob over the source
 * rather than a plume. Pinning the source temperature separates them: this sets
 * how fast the source comes up, COOL sets how far the plume stays lit.
 */
export const SRC_RATE = 8.0;
/**
 * Radiative cooling, in e-folds per second.
 *
 * Low, and deliberately comparable to DRAG rather than to the frame rate. Heat
 * has to survive the transit or there is no plume — a parcel takes about two
 * seconds to cross the box at BUOY/DRAG, so a cooling rate much above 1 puts the
 * buoyancy entirely in the bottom fifth. What it still does at 0.45 is give heat
 * a finite life, so the box does not fill with hot fluid and turn the whole
 * domain into one uniform updraft with no return flow.
 */
export const COOL = 0.45;
/** Upward acceleration applied directly in the source, on top of buoyancy. */
export const JET = 1.5;
/**
 * Linear drag on the velocity field, in e-folds per second.
 *
 * Standing in for the momentum a real plume loses to entraining still air, and
 * doing a job the open boundaries alone did not. Without it the box has no sink
 * for kinetic energy other than outflow and numerical diffusion, and measured
 * over 60 s the peak field speed climbed steadily past what the buoyancy could
 * account for, dragging the residual divergence up with it — the projection was
 * being handed a harder problem every frame and given the same twenty sweeps to
 * solve it. A drag makes the energy budget close.
 */
export const DRAG = 0.5;
/** Half-width of the source band, in simulation units. */
export const SRC_W = 0.26;
/** Height of the source band above the floor. */
export const SRC_H = 0.12;
/**
 * Seconds the source takes to come up to full strength after a seed.
 *
 * An impulsively started jet rolls up exactly one strong starting vortex — a
 * textbook result, and visible here as a symmetric pair of counter-rotating
 * cores that sit over the source for the first several seconds. It is correct
 * physics and it looks like a mistake: a tight vortex evacuates its own core, so
 * what is on screen is two large, hard-edged black circles, which is the single
 * most conspicuous thing in the frame at the exact moment somebody has pressed
 * [R] and is deciding what they are looking at.
 *
 * The honest fix is not to suppress the vortex but to stop starting the jet
 * impulsively, because nothing switches on in one frame. Smoothstepped over 1.4 s
 * the source builds faster than the plume crosses the box and the roll-up is
 * spread over enough shear layers that no single core dominates.
 */
export const SRC_RAMP = 1.4;

/**
 * Vorticity confinement strength — the slider, and the one constant here that
 * changes what kind of thing this is.
 *
 * Semi-Lagrangian advection is unconditionally stable, which is the only reason
 * a fluid can be stepped at 60 Hz at all, and it buys that stability by
 * interpolating: every step reads the field at a point between samples and
 * averages four of them. Averaging is a low-pass filter. Applied sixty times a
 * second it is a large, entirely artificial viscosity, and what it removes first
 * is the smallest resolved eddies — which is exactly the structure that makes
 * smoke read as smoke rather than as a lava lamp.
 *
 * Confinement is the standard correction and it is worth being clear about what
 * it is: not a physical force. It finds where vorticity is concentrated, points
 * up that gradient, and adds a force that spins those spots back up, restoring
 * energy at the grid scale to replace what the interpolation took. It is a
 * numerical patch for a numerical defect. It happens to also be the knob that
 * moves this between two real regimes — a laminar column that mushrooms once and
 * relaxes, and a plume that sheds vortices continuously the whole way up — so it
 * is on a slider rather than in this constant, and the default is only a default.
 */
/**
 * Default, and low — well under where the confinement starts to dominate.
 *
 * Picked by looking at it rather than from the sweep, and the sweep explains
 * why. Enstrophy runs 0.84, 5.7, 58 at epsilon 0, 6, 12: the step from 6 to 12
 * is an order of magnitude, and somewhere in there the plume stops looking like
 * smoke and starts looking like a diagram of vortices. Real smoke is mostly
 * smooth sheets with structure at a few scales, not curls at every point.
 *
 * The usable window is narrower than the slider suggests, and 3 sits just above
 * the bottom of it. At 2 the confinement no longer keeps up with the diffusion
 * the semi-Lagrangian advection is applying and the plume goes laminar within
 * half a minute — a smooth column with nothing in it. So this is not "as low as
 * possible"; it is about the lowest setting that still sustains structure, with
 * only a cell's worth of margin above the floor.
 *
 * There is a second reason to keep it down. A tightly wound vortex evacuates its
 * own core, so at high epsilon the field fills with small round voids each ringed
 * by a bright filament — and a dense field of small holes is a strong and
 * genuinely unpleasant visual pattern for a fair number of people. The setting
 * that looks most like smoke is also the one that does not produce it, so there
 * is nothing to trade off; the slider still goes up for anyone who wants it.
 */
export const VORT = 3;
/**
 * Top of the slider.
 *
 * The whole usable range is at the bottom. Below about 2 the plume goes laminar
 * and by 12 it is curling at every point, which leaves the interesting travel
 * between roughly 3 and 8; past that the picture gets worse rather than
 * different, and past 24 the clamp in CONF_MAX is doing all the work anyway —
 * measured, enstrophy moves 128 to 160 between epsilon 24 and 40, against 5.7 to
 * 58 between 6 and 12. So the top is 10: a slider whose upper half is settings
 * nobody should pick is a slider with no resolution in the half they should.
 */
export const VORT_MAX = 10;

/**
 * Ceiling on the confinement acceleration, per cell.
 *
 * Confinement is a positive feedback and will run away without one. The force it
 * adds is proportional to the vorticity already present, so vorticity drives a
 * force that makes more vorticity: the growth is exponential, and past some
 * strength the field detonates rather than becoming more turbulent.
 *
 * Measured over 10 s from one seed, mean enstrophy and peak field speed against
 * epsilon 0, 6, 12, 24, 40:
 *
 *   unclamped   0.84 / 0.44   5.12 / 0.57   77.8 / 3.20   1179 / 14.6   7234 / 28.1
 *   clamped     0.84 / 0.44   5.69 / 0.62   57.9 / 1.33    128 / 2.61    160 / 2.66
 *
 * Buoyancy sustains about 1 unit/s in the body of the plume (BUOY/DRAG) and
 * roughly 3 inside the jet, so the top of the unclamped column is the feedback
 * diverging rather than a rougher plume.
 *
 * Clamping the magnitude keeps the direction, which is the part that carries the
 * physics — the force still points where it pointed, it just stops being able to
 * grow without limit. 2.5 is comfortably above the buoyant scale, so the clamp
 * is inactive in ordinary flow and only engages where a vortex is winding itself
 * up.
 */
export const CONF_MAX = 2.5;

/** Cursor force per unit of pointer speed. */
export const CURSOR_K = 6;
/** Squared radius of the cursor's influence, as a Gaussian falloff. */
export const CURSOR_R2 = 0.018;
/** Temperature per second injected under a held pointer. */
export const CURSOR_HEAT = 4.0;

/**
 * How far a tracer's slot in the source may wander from its species' band, in
 * band widths.
 *
 * Over one, so the six ribbons overlap. Same argument as bdHomeRadius() in
 * sim/barred.ts: disjoint bands draw six clean stripes, and clean stripes look
 * authored. Overlapped ones are still six statistically distinct populations
 * across the source while having no edge anywhere in particular.
 */
export const SPECIES_SPREAD = 1.5;

/**
 * Tracer turnover, as a per-tick recycle probability and the tick rate it is
 * drawn against — together, a residence time of about twelve seconds.
 *
 * Recycling only at the open top is not enough, and the reason is the failure
 * mode of every tracer scheme in a bounded flow: stagnation. A closed box driven
 * from one spot has corners and recirculation zones where the velocity is
 * essentially zero, tracers that wander in never come out, and over a couple of
 * minutes the plume thins while the corners silt up with motionless particles.
 * Giving every tracer a finite expected life empties them.
 *
 * Stateless, because there is nowhere to keep the state: a particle is four
 * floats and all four are position and velocity. So the draw is a hash of the
 * slot against a time bucket rather than a counter — same result, no storage,
 * and identical on both arms. The tick rate is high so the recycling is spread
 * across frames instead of arriving as a visible cull four times a second.
 */
export const TURN_HZ = 60;
export const RECYCLE_P = 0.0013;

// An ambient-haze pass was tried here and removed. The idea was that the voids
// read as holes rather than as thin smoke because they are pure black, which is
// not physical — a room with a plume in it is not a vacuum — so a fraction of
// the population was drawn uniformly over the box instead of at the source, to
// put a grey floor under the gaps.
//
// It cannot work at this budget, and the arithmetic says so before the picture
// does. 18% of a million tracers over a 7.2-unit box is 0.09 tracers per pixel;
// at the gain this mode renders with that is about 0.001 of luminance after the
// tonemap, against a background already sitting at 0.03. To lift a void to even
// a tenth of full brightness needs roughly forty times the density — more
// tracers for the haze alone than the whole population has. What it did buy was
// 18% fewer tracers in the plume. Removed.

/** Speed ceiling, as a guard on the backtrace rather than as physics. */
export const V_MAX = 4;

/**
 * Tracer diffusivity — the sub-grid mixing the grid cannot represent.
 *
 * Without it the tracers render as a foam, and the reason is structural rather
 * than a tuning failure. A tracer is either present or absent; the flow is
 * incompressible, so it does not compress the population, it *folds* it, and
 * with three open sides most of what gets folded in is clean entrained fluid
 * carrying no tracers at all. Stretching and folding then does what it always
 * does: the clean regions round off into blobs and the tracers pile onto the
 * sheets between them. The picture is a bright web around a field of dark
 * rounded holes — which is both nothing like smoke and, in quantity, a genuinely
 * unpleasant thing to look at.
 *
 * What is missing is physical. The grid resolves eddies down to about a cell and
 * everything below that is simply absent, and the standard closure for the
 * transport those unresolved eddies would do is a diffusivity. Real smoke is
 * mixed at every scale below the ones here, which is why its edges are soft.
 * Adding it back as a per-tracer random walk fills the voids from their rims and
 * softens the interfaces without touching the flow.
 *
 * Small, and it has to be, because the first attempt at this was 5e-4 and it
 * erased the entire mode. That is worth stating plainly rather than tuning past:
 * the voids and the filaments are the *same* length scale. Both are set by how
 * far the flow folds material between one pass and the next, so a diffusivity
 * strong enough to fill a hole is strong enough to erase the ribbon beside it,
 * and at 5e-4 — about three cells of smearing over a transit — the plume came
 * out as a smooth grey column with no structure in it at all.
 *
 * So the setting is a compromise between the two, and the scale to think in is
 * the rms smear over a tracer's several-second transit, sqrt(2 D T):
 *
 *   2e-5   0.7 cells   softens the interface, leaves every pocket
 *   8e-5   1.4 cells   closes the small pockets, filaments intact
 *   5e-4   3.4 cells   featureless grey column
 *
 * 8e-5 because the small pockets are the ones worth losing. A void a cell or two
 * across carries no information — it is a gap in the sampling of a fold, not a
 * feature of the flow — and in quantity a field of them is the least pleasant
 * thing the mode produces. The large voids are real structure and survive this,
 * as do the ribbons, which are tens of cells long.
 */
export const DIFFUSIVITY = 8e-5;

// --- live controls -----------------------------------------------------------
//
// Module state, read by everything that needs it rather than threaded through
// signatures — the same arrangement as coreGravity() in sim/classic.ts and
// haloMass() in sim/world.ts, and for the same reason. Three separate paths want
// these numbers and two of them have no channel to receive one: the GPU backend
// folds them into a uniform each frame, and the CPU reference below is reached
// through the generic integrate path in baseline.ts.

let vort = VORT;
let cvx = 0;
let cvy = 0;
let held = 1;

export function vorticity() {
  return vort;
}

export function setVorticity(v: number) {
  vort = v;
}

/**
 * The pointer's velocity in simulation units per second, and its hold ramp.
 *
 * Velocity rather than position because a cursor stirs a fluid by dragging it:
 * a stationary pointer in a real tank does nothing at all, and a mode where
 * merely hovering injects momentum has a cursor that can never be put down. Set
 * from main.ts, which is the only place that knows both the pointer and dt.
 */
export function setCursor(vx: number, vy: number, grav: number) {
  cvx = vx;
  cvy = vy;
  held = grav;
}

export function cursorVel(): [number, number] {
  return [cvx, cvy];
}

// --- field state -------------------------------------------------------------
//
// Allocated once at module scope. This is the reference implementation and it is
// measured against, so it is not allowed to be the thing that makes the naive
// arm look slow — no allocation on the frame path, no polymorphism, one pass per
// stage over contiguous Float32Arrays.

/** x-velocity, on vertical faces: sample (i, j) sits at x = -XR + i*H. */
const uu = new Float32Array(FACES);
/** y-velocity, on horizontal faces: sample (i, j) sits at y = -1 + j*H. */
const vv = new Float32Array(FACES);
const uu2 = new Float32Array(FACES);
const vv2 = new Float32Array(FACES);
/** Temperature, at cell centers. */
const tt = new Float32Array(CELLS);
const tt2 = new Float32Array(CELLS);
/** Pressure, scaled by dt so the solve has no dt in it — see project(). */
const phi = new Float32Array(CELLS);
const dvg = new Float32Array(CELLS);
const crl = new Float32Array(CELLS);
/** Confinement force at cell centers, solved once per cell rather than
 *  re-derived per face — see confineAll(). */
const cfx = new Float32Array(CELLS);
const cfy = new Float32Array(CELLS);

/** Wipe the fluid. Called by the seeders, so [R] restarts the flow too. */
export function resetField() {
  uu.fill(0);
  vv.fill(0);
  uu2.fill(0);
  vv2.fill(0);
  tt.fill(0);
  tt2.fill(0);
  phi.fill(0);
  dvg.fill(0);
  crl.fill(0);
  cfx.fill(0);
  cfy.fill(0);
}

/**
 * The fluid state, for verification rather than for the demo.
 *
 * `div` is the divergence the projection was asked to remove, sampled before it
 * ran; recomputing it from `u`/`v` afterwards is what says whether it did. See
 * the verification section of the README.
 */
export function dumpField() {
  return { u: uu, v: vv, temp: tt, phi, div: dvg, nx: NX, ny: NY, stride: SX, h: H, xr: XR };
}

// --- staggered sampling ------------------------------------------------------
//
// Three grids at three different offsets, so every read is its own function
// rather than one function with an offset argument. Mirrored exactly in WGSL;
// an inconsistency here is a half-cell shear between the two arms that looks
// like turbulence and is not.

/** Bilinear read of an nx-by-ny sample grid with the given row stride. */
function bilerp(
  a: Float32Array,
  stride: number,
  gx: number,
  gy: number,
  nx: number,
  ny: number,
) {
  const x = gx < 0 ? 0 : gx > nx - 1 ? nx - 1 : gx;
  const y = gy < 0 ? 0 : gy > ny - 1 ? ny - 1 : gy;
  // One short of the last sample, so i+1 and j+1 are always in range. The half
  // cell this gives up at the far edge is inside the wall.
  let i = x | 0;
  let j = y | 0;
  if (i > nx - 2) i = nx - 2;
  if (j > ny - 2) j = ny - 2;
  const fx = x - i;
  const fy = y - j;
  const o0 = j * stride + i;
  const o1 = o0 + stride;
  const b0 = a[o0] + (a[o0 + 1] - a[o0]) * fx;
  const b1 = a[o1] + (a[o1 + 1] - a[o1]) * fx;
  return b0 + (b1 - b0) * fy;
}

/** Grid coordinates of a point: vertical faces sit on integer gcx, horizontal
 *  faces on integer gcy. */
function gcx(x: number) {
  return (x + XR) / H;
}

function gcy(y: number) {
  return (y + YR) / H;
}

function sampleU(a: Float32Array, px: number, py: number) {
  return bilerp(a, SX, gcx(px), gcy(py) - 0.5, NX + 1, NY);
}

function sampleV(a: Float32Array, px: number, py: number) {
  return bilerp(a, SX, gcx(px) - 0.5, gcy(py), NX, NY + 1);
}

function sampleT(a: Float32Array, px: number, py: number) {
  return bilerp(a, NX, gcx(px) - 0.5, gcy(py) - 0.5, NX, NY);
}

/** Cell-centered velocity, for the curl. Clamped at the edges. */
function uCen(i: number, j: number) {
  const ci = i < 0 ? 0 : i > NX - 1 ? NX - 1 : i;
  const cj = j < 0 ? 0 : j > NY - 1 ? NY - 1 : j;
  return 0.5 * (uu[cj * SX + ci] + uu[cj * SX + ci + 1]);
}

function vCen(i: number, j: number) {
  const ci = i < 0 ? 0 : i > NX - 1 ? NX - 1 : i;
  const cj = j < 0 ? 0 : j > NY - 1 ? NY - 1 : j;
  return 0.5 * (vv[cj * SX + ci] + vv[(cj + 1) * SX + ci]);
}

// --- the solve ---------------------------------------------------------------

/**
 * Semi-Lagrangian advection of velocity by itself.
 *
 * Trace backwards from where a sample sits, one step, at the velocity there; the
 * new value is whatever the field held at the departure point. Backwards rather
 * than forwards is the whole trick — a forward push has to decide where its
 * mass landed and can leave holes, while a backward trace always has exactly one
 * answer per destination and can never produce a value outside the range of its
 * inputs. That last property is the unconditional stability, and it is also the
 * diffusion: a scheme that cannot overshoot also cannot preserve a peak.
 */
function advectVelocity(dt: number) {
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const px = -XR + i * H;
      const py = -YR + (j + 0.5) * H;
      const bx = px - sampleU(uu, px, py) * dt;
      const by = py - sampleV(vv, px, py) * dt;
      uu2[j * SX + i] = sampleU(uu, bx, by);
    }
  }
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i < NX; i++) {
      // Solid floor, and the only solid boundary in the mode. Left, right and
      // top are open and deliberately not clamped — see project().
      if (j === 0) {
        vv2[i] = 0;
        continue;
      }
      const px = -XR + (i + 0.5) * H;
      const py = -YR + j * H;
      const bx = px - sampleU(uu, px, py) * dt;
      const by = py - sampleV(vv, px, py) * dt;
      vv2[j * SX + i] = sampleV(vv, bx, by);
    }
  }
  uu.set(uu2);
  vv.set(vv2);
}

/**
 * Backtrace temperature into the scratch plane, and take the curl of the
 * velocity while we are walking the cells anyway.
 *
 * Split from the commit below because the read is nonlocal: the backtrace lands
 * between cells and reads four of them, so nothing may write the field being
 * read until every cell has finished reading it. The curl rides along because it
 * reads velocity and writes neither — one traversal instead of two, and the same
 * split the WGSL needs anyway, where the two halves are two dispatches.
 */
function advectTemperature(dt: number) {
  const inv = 1 / (2 * H);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const px = -XR + (i + 0.5) * H;
      const py = -YR + (j + 0.5) * H;
      const bx = px - sampleU(uu, px, py) * dt;
      const by = py - sampleV(vv, px, py) * dt;
      tt2[j * NX + i] = sampleT(tt, bx, by);
      crl[j * NX + i] = (vCen(i + 1, j) - vCen(i - 1, j)) * inv
        - (uCen(i, j + 1) - uCen(i, j - 1)) * inv;
    }
  }
}

/**
 * Commit the advected temperature with the source and the cooling on it, and
 * solve the confinement force from the curl the pass above left behind.
 *
 * Both halves are strictly local — every cell writes only its own — so they are
 * one pass. The confinement half has to be after the curl half rather than
 * inside it because it reads the curl of its four neighbours.
 */
function commitTemperature(dt: number, mx: number, my: number, elapsed: number) {
  // Unconditionally, even at epsilon 0 where every force it writes is zero.
  // Branching on the slider instead would leave the previous setting's forces
  // sitting in the planes the moment it was dragged to the bottom, which reads
  // as the confinement refusing to switch off.
  confineAll();

  const decay = Math.exp(-COOL * dt);
  // Fraction of the way to the source temperature this step closes. Capped at 1
  // so a long frame relaxes fully rather than overshooting past it.
  const pull = Math.min(1, SRC_RATE * dt) * sourceRamp(elapsed);
  const cheat = CURSOR_HEAT * dt * Math.max(0, held - 1);
  for (let j = 0; j < NY; j++) {
    const py = -YR + (j + 0.5) * H;
    for (let i = 0; i < NX; i++) {
      const px = -XR + (i + 0.5) * H;
      let t = tt2[j * NX + i] * decay;
      t += (1 - t) * pull * sourceWeight(px, py);
      if (cheat > 0) {
        const dx = px - mx;
        const dy = py - my;
        t += cheat * Math.exp(-(dx * dx + dy * dy) / CURSOR_R2);
      }
      tt[j * NX + i] = t;
    }
  }
}

/**
 * How much of the source a point is in — 1 in the middle of the band, 0 outside
 * it, smooth in between so the plume has no visible rectangular root.
 */
function sourceWeight(px: number, py: number) {
  const h = py + YR;
  if (h > SRC_H) return 0;
  const fx = Math.max(0, 1 - (px / SRC_W) ** 2);
  const fy = 1 - h / SRC_H;
  return fx * fx * fy;
}

/** How far the source has come up since the seed — see SRC_RAMP. */
function sourceRamp(elapsed: number) {
  const s = Math.min(1, Math.max(0, elapsed / SRC_RAMP));
  return s * s * (3 - 2 * s);
}

/**
 * Confinement force at every cell center, from the curl.
 *
 * Point up the gradient of |vorticity|, cross that with the vorticity vector,
 * and the result is a force that pushes rotation back toward wherever rotation
 * already is — sharpening vortices instead of letting the interpolation smear
 * them flat. Scaled by H so the strength is a property of the flow rather than
 * of the resolution, and clamped, because it is a positive feedback: see
 * CONF_MAX.
 *
 * Solved per cell into its own pair of planes rather than per face inside the
 * force loop. The two are arithmetically identical — a face takes the mean of
 * the cells either side of it either way — but a face-side version calls this
 * four times per face and so evaluates every cell about eight times over. On the
 * CPU that was the single most expensive thing in the step.
 */
function confineAll() {
  const inv = 1 / (2 * H);
  for (let j = 0; j < NY; j++) {
    const jd = (j > 0 ? j - 1 : 0) * NX;
    const ju = (j < NY - 1 ? j + 1 : NY - 1) * NX;
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      const l = crl[j * NX + (i > 0 ? i - 1 : 0)];
      const r = crl[j * NX + (i < NX - 1 ? i + 1 : NX - 1)];
      const d = crl[jd + i];
      const u = crl[ju + i];
      let ex = (Math.abs(r) - Math.abs(l)) * inv;
      let ey = (Math.abs(u) - Math.abs(d)) * inv;
      const len = Math.sqrt(ex * ex + ey * ey) + 1e-8;
      ex /= len;
      ey /= len;
      const w = vort * H * crl[c];
      let fx = ey * w;
      let fy = -ex * w;
      const m = Math.abs(w);
      if (m > CONF_MAX) {
        fx *= CONF_MAX / m;
        fy *= CONF_MAX / m;
      }
      cfx[c] = fx;
      cfy[c] = fy;
    }
  }
}

/** Buoyancy, confinement, the jet and the cursor — everything that is not
 *  advection and not the projection. */
function addForces(dt: number, mx: number, my: number, elapsed: number) {
  const k = CURSOR_K * dt * held;
  const jet = JET * sourceRamp(elapsed);
  // Drag as a retention factor rather than a subtracted force, so it is exact at
  // any step size instead of being a first-order approximation of itself.
  const keep = Math.exp(-DRAG * dt);

  for (let j = 0; j < NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const px = -XR + i * H;
      const py = -YR + (j + 0.5) * H;
      // Confinement at a vertical face is the mean of the cells either side, and
      // at the two open edges there is only one of those.
      const cl = cfx[j * NX + (i > 0 ? i - 1 : 0)];
      const cr = cfx[j * NX + (i < NX ? i : NX - 1)];
      let f = 0.5 * (cl + cr);
      const dx = px - mx;
      const dy = py - my;
      f += cvx * k * Math.exp(-(dx * dx + dy * dy) / CURSOR_R2);
      uu[j * SX + i] = uu[j * SX + i] * keep + f * dt;
    }
  }

  for (let j = 1; j <= NY; j++) {
    for (let i = 0; i < NX; i++) {
      const px = -XR + (i + 0.5) * H;
      const py = -YR + j * H;
      // Temperature at a horizontal face is the mean of the cells either side.
      const tb = tt[(j - 1) * NX + i];
      const ta = j < NY ? tt[j * NX + i] : 0;
      let f = BUOY * 0.5 * (tb + ta);
      f += jet * sourceWeight(px, py);
      f += 0.5 * (cfy[(j - 1) * NX + i] + cfy[(j < NY ? j : NY - 1) * NX + i]);
      const dx = px - mx;
      const dy = py - my;
      f += cvy * k * Math.exp(-(dx * dx + dy * dy) / CURSOR_R2);
      vv[j * SX + i] = vv[j * SX + i] * keep + f * dt;
    }
  }
}

/**
 * Make the field divergence-free.
 *
 * Solve nabla^2 phi = div for a scalar potential, then subtract its gradient.
 * The Helmholtz decomposition says any field splits uniquely into a
 * divergence-free part and a gradient, so removing the gradient piece is exactly
 * the projection onto incompressible flows — and pressure is what that gradient
 * physically is.
 *
 * phi carries the dt rather than the pressure doing it: the true equation is
 * nabla^2 p = div/dt with a correction of dt*grad(p), and folding dt into the
 * unknown leaves an identical answer with no dt in the inner loop and no
 * division by a small number when a frame is short.
 *
 * Boundaries are where the character of the mode is set, and only the floor is
 * solid — no flow through it, which is a zero-gradient (Neumann) condition on
 * phi, written as a ghost value equal to the cell itself. Left, right and top
 * are open: phi = 0 outside them, a Dirichlet condition, which lets the solver
 * push fluid out of the box and draw it back in wherever it needs to.
 *
 * The first version of this mode had solid side walls, and the two things wrong
 * with that were worth the change. A closed box forces the return flow to fit
 * inside the picture, so the plume cannot rise without an equal descent right
 * next to it: measured over 60 s the column went unstable, flopped sideways, and
 * the recirculation pinned it against a wall for the rest of the run, with the
 * tracers ending in two still sheets down the left and right edges. And a
 * no-slip-ish edge has no way to release a tracer that reaches it — the recycle
 * timer was clearing them more slowly than the wall was collecting them.
 *
 * Opening three sides fixes both and is the more honest boundary anyway: a plume
 * in a room entrains air from beside it, and the interesting thing about smoke
 * is that it leaves.
 *
 * The previous frame's phi is the initial guess rather than zero. The flow
 * changes little between frames at 60 Hz, so the solve starts most of the way to
 * its answer and twenty sweeps go further than they otherwise would. Safe
 * because the Dirichlet edges leave the problem with no null space — there is
 * one phi, not a family of them differing by a constant, so there is nothing for
 * a warm start to accumulate.
 */
function project() {
  const inv = 1 / H;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      dvg[j * NX + i] =
        (uu[j * SX + i + 1] - uu[j * SX + i] + vv[(j + 1) * SX + i] - vv[j * SX + i]) * inv;
    }
  }

  const h2 = H * H;
  for (let s = 0; s < SWEEPS; s++) {
    for (let parity = 0; parity < 2; parity++) {
      for (let j = 0; j < NY; j++) {
        for (let i = (j + parity) & 1; i < NX; i += 2) {
          const c = j * NX + i;
          const l = i > 0 ? phi[c - 1] : 0;
          const r = i < NX - 1 ? phi[c + 1] : 0;
          const d = j > 0 ? phi[c - NX] : phi[c];
          const u = j < NY - 1 ? phi[c + NX] : 0;
          phi[c] = (l + r + d + u - h2 * dvg[c]) * 0.25;
        }
      }
    }
  }

  // The Dirichlet ghost of 0 outside each open edge falls straight out of the
  // gradient, so the edge faces need no special case — only the solid floor does.
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const right = i < NX ? phi[j * NX + i] : 0;
      const left = i > 0 ? phi[j * NX + i - 1] : 0;
      uu[j * SX + i] -= (right - left) * inv;
    }
  }
  for (let j = 1; j <= NY; j++) {
    for (let i = 0; i < NX; i++) {
      const above = j < NY ? phi[j * NX + i] : 0;
      vv[j * SX + i] -= (above - phi[(j - 1) * NX + i]) * inv;
    }
  }
}

/** One fluid step, without the tracers. Exposed so the solver can be driven and
 *  measured on its own — see the README. */
export function stepFluid(dt: number, mx: number, my: number, elapsed = SRC_RAMP) {
  advectVelocity(dt);
  advectTemperature(dt);
  commitTemperature(dt, mx, my, elapsed);
  addForces(dt, mx, my, elapsed);
  project();
}

// --- tracers -----------------------------------------------------------------

/** Cheap per-slot hash. Mirrors hash2 in sim/barred.ts and hash() in the WGSL. */
function hash2(n: number) {
  let x = Math.imul(n, 747796405) + 2891336453;
  x = Math.imul((x >>> ((x >>> 28) + 4)) ^ x, 277803737);
  return (((x >>> 22) ^ x) >>> 0) / 4294967296;
}

/**
 * Where in the source a tracer belongs, from its species.
 *
 * The mode's one use of the species array, and it is what the filter chips are
 * for here. Six colors are injected side by side across the width of the source
 * and never mix at the root, so what the disc modes use to show composition,
 * this uses to show *mixing*: turn five chips off and a single ribbon of dye is
 * left, stretching and folding through the plume. That is the actual signature
 * of chaotic advection, and it is invisible in the full-color image because six
 * interleaved folded ribbons look like smoke.
 *
 * Recycling reads this back, which is what makes the ribbons permanent. A
 * tracer that leaves through the top returns to its own color's slot rather than
 * to a shared one, so the source never homogenizes no matter how long it runs —
 * the same argument as bdRespawn() in sim/barred.ts, where a recycled particle
 * comes back at the radius its species belongs at.
 */
export function sourceX(species: number, i: number) {
  const j = (hash2(i * 11 + 5) - 0.5) * SPECIES_SPREAD;
  const f = Math.min(1, Math.max(0, (species + 0.5 + j) / SPECIES_COUNT));
  return (f * 2 - 1) * SRC_W;
}

/** Whether this slot's number came up for recycling on this tick. */
function recycled(i: number, elapsed: number) {
  return hash2(i * 2654435761 + (Math.floor(elapsed * TURN_HZ) | 0) * 40503) < RECYCLE_P;
}

/** Put a tracer back at the source. Deterministic in the slot, so a particle
 *  always re-enters at its own height within the band. */
function respawn(p: Float32Array, o: number, species: number, i: number) {
  p[o] = sourceX(species, i) + (hash2(i * 17 + 9) - 0.5) * 0.02;
  p[o + 1] = -YR + hash2(i * 7 + 3) * SRC_H;
  p[o + 2] = 0;
  p[o + 3] = 0;
}

/**
 * Place one tracer in a plume that is meant to look like it has been running.
 *
 * Every edge here is a distribution rather than a bound, and that is the whole
 * job. The first version drew height uniformly over the lower 70% of the box and
 * horizontal offset uniformly across a width that grew with it, which is a
 * trapezoid: the column stopped dead along a horizontal line partway up and had
 * a hard vertical edge down each side. Nothing in the flow puts a straight line
 * anywhere, so all three read as drawn on rather than simulated, and they stayed
 * legible for the couple of seconds it takes the fluid to get moving — which is
 * exactly the couple of seconds somebody is deciding what they are looking at.
 *
 * Height comes from 1 - cbrt(u), which is the inverse CDF of a (1-t)^2 density:
 * mass concentrated in the bottom quarter, thinning smoothly the whole way up
 * and reaching zero at the ceiling rather than at a line. Mean height lands near
 * t = 0.25, which is about where the settled plume actually sits — measured
 * ymean ran -0.33 to -0.45 over a minute, or t = 0.28 to 0.34.
 *
 * Width is triangular rather than uniform, from the sum of two draws. A uniform
 * offset has the same density right up to its bound and then none, which is the
 * vertical edge; a triangular one fades out. It is not a Gaussian and does not
 * need to be — it is bounded, costs two multiplies, and the fluid has replaced
 * it within a second or two anyway.
 */
function placeTracer(p: Float32Array, o: number, species: number, i: number, rand: () => number) {
  const t = 1 - Math.cbrt(rand());
  // Widening with height, which is roughly what an entraining plume does.
  const spread = 0.06 + 0.55 * t;
  p[o] = sourceX(species, i) + (rand() + rand() - 1) * 0.5 * spread;
  p[o + 1] = -YR + t * 2 * YR;
  p[o + 2] = 0;
  p[o + 3] = 0;
}

/**
 * Seed the population as a plume that has already been running.
 *
 * Not as a point at the source, which would spend the first several seconds as
 * one enormous puff climbing through still air before it looked like anything.
 * Every tracer is already on its species' ribbon, so the braiding starts on frame
 * one rather than after a full turnover.
 *
 * Species first and position from it, unlike the disc modes where species is
 * banded from a radius that was drawn first. Here position is what the force law
 * assigns and color is what it is assigned from, so the dependency runs the
 * other way. Same as sim/barred.ts, for the same reason.
 */
export function seedPlume(sim: Sim, rand: () => number, from = 0, to = sim.capacity) {
  const p = sim.particles;
  for (let i = from; i < to; i++) {
    const o = i * STRIDE;
    const s = Math.min(SPECIES_COUNT - 1, (rand() * SPECIES_COUNT) | 0);
    sim.species[i] = s;
    placeTracer(p, o, s, i, rand);
    sim.stat[i] = rand();
  }
  resetField();
}

/**
 * Re-seed a prefix, positions only — the naive arm's path, which must leave the
 * species array alone because the sidebar and the chips are still reading the
 * GPU arm's. Mirrors classic.reseed().
 */
export function reseed(sim: Sim, n: number, rand: () => number = Math.random) {
  const p = sim.particles;
  for (let i = 0; i < n; i++) {
    placeTracer(p, i * STRIDE, sim.species[i], i, rand);
  }
  resetField();
}

/**
 * CPU reference: one fluid step, then carry every tracer with it.
 *
 * The tracers are massless and have no equation of their own — position
 * integrates the field and velocity is *read back out of it* rather than
 * accumulated. Giving them inertia was the obvious first version and it is
 * wrong twice over: a tracer with momentum lags the flow and draws a smeared,
 * blunted version of it, and the whole claim of the mode is that the filaments
 * on screen are the fluid's and not an artifact of a million independent
 * integrators. The velocity slot is still written, because the renderer tints by
 * speed and the sidebar reports it — so what those show is the local speed of
 * the fluid, which is the honest reading of both.
 */
export function integrateSmokeCPU(sim: Sim, dt: number, mx: number, my: number, elapsed: number) {
  stepFluid(dt, mx, my, elapsed);

  const p = sim.particles;
  const n = sim.count;
  // Random-walk step for this frame: rms sqrt(2 D dt) per axis, so the
  // diffusivity is what it says it is at any frame rate rather than only at 60.
  // sqrt(3) converts the rms into the half-width of a uniform draw.
  const walk = Math.sqrt(2 * DIFFUSIVITY * dt) * 1.7320508;
  const tick = Math.floor(elapsed * 60) | 0;
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    if (recycled(i, elapsed)) {
      respawn(p, o, sim.species[i], i);
      continue;
    }
    const x = p[o];
    const y = p[o + 1];
    let vx = sampleU(uu, x, y);
    let vy = sampleV(vv, x, y);
    const speed = Math.hypot(vx, vy);
    if (speed > V_MAX) {
      vx *= V_MAX / speed;
      vy *= V_MAX / speed;
    }
    // Advection plus the sub-grid random walk — see DIFFUSIVITY. Hashed against
    // a time bucket rather than drawn from a stream, so it is stateless and the
    // WGSL can reproduce it exactly.
    const nx = x + vx * dt + (hash2(i * 3 + tick * 9781) * 2 - 1) * walk;
    const ny = y + vy * dt + (hash2(i * 3 + 1 + tick * 6151) * 2 - 1) * walk;
    // Out of the box is out of the simulation, and with three sides open that is
    // the flow doing its job rather than an edge case. Through the floor is the
    // exception — nothing should cross it, and anything that does has drifted
    // into the half cell the sampler gives up at the boundary. Both come back to
    // the source.
    if (ny > YR || ny < -YR || nx < -XR || nx > XR) {
      respawn(p, o, sim.species[i], i);
      continue;
    }
    p[o] = nx;
    p[o + 1] = ny;
    p[o + 2] = vx;
    p[o + 3] = vy;
  }
}
