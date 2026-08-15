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
 * There is a second reason to keep it down. A tightly wound vortex evacuates its
 * own core, so at high epsilon the field fills with small round voids each ringed
 * by a bright filament — and a dense field of small holes is a strong and
 * genuinely unpleasant visual pattern for a fair number of people. The setting
 * that looks most like smoke is also the one that does not produce it, so there
 * is nothing to trade off; the slider still goes up for anyone who wants it.
 *
 * This was 3, and 3 was correct while the confinement was the only thing putting
 * structure back. The note that used to be here said 2 "goes laminar within half
 * a minute", and the interesting thing is that it was a statement about the
 * *picture* being read as one about the field. Field enstrophy in 15 s windows
 * over 90 s, measured on the code as it was:
 *
 *   eps 2   1.09  1.19  1.13  1.50  1.52  1.51
 *   eps 3   0.95  1.88  3.16  3.48  3.33  3.34
 *
 * Nothing decays. epsilon 2 simply sustains about a third of the vorticity, and
 * with the tracers carrying no structure of their own that third was not enough
 * to look like anything — so the plume read as smooth and "laminar" was the word
 * for it.
 *
 * SUBGRID_V changes what that setting is for. The tracers now carry the small
 * scales themselves, so the confinement is no longer being asked to manufacture
 * detail; it only has to keep the resolved eddies from being smeared flat. And
 * the confinement was never good at the first job — what it actually produces at
 * the plume's rim, where the strain is low and there is nothing to sharpen, is
 * isolated vortices winding themselves up out of nothing, each evacuating its own
 * core. Those are the spirals on the edges, they are the numerics rather than the
 * flow, and they go away when epsilon comes down. The same 90 s run on the
 * current code holds flat at 2 — 0.69, 0.93, 0.89, 1.02, 0.95, 0.78 — so there
 * is no decay to trade against.
 */
export const VORT = 2;
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
 * It sat at 8e-5 for exactly as long as this was the only sub-grid term, because
 * the small pockets are the ones worth losing and 8e-5 is the weakest setting
 * that closes them. But note what that trade is made of: a random walk is
 * *isotropic and uncorrelated*, so the only thing it can do to a structure is
 * blur it, and the two structures here are the same size. Paying a filament to
 * close a void is the best a scheme with no spatial coherence can do.
 *
 * SUBGRID_V below is the same missing physics with the coherence put back, and
 * it fills the pockets by folding them shut rather than by smearing them out —
 * so this drops back to 2e-5, where its whole job is softening the interface at
 * the scale of a single tracer. The pair is not redundant: the curl noise has
 * structure and therefore leaves its own texture behind, and a little genuinely
 * uncorrelated jitter under it is what keeps that texture from reading as a
 * pattern.
 */
export const DIFFUSIVITY = 2e-5;

// --- sub-grid turbulence -----------------------------------------------------
//
// What the grid does not have, supplied as a field rather than as noise.
//
// The argument for this mode has always been that the tracers show structure the
// 172 x 96 grid cannot represent, and that is true of *stretching* — a material
// line folded by a resolved eddy gets thinner than a cell for free, because a
// tracer path integrates the field and integration has no resolution limit. It
// is not true of anything the flow does below a cell, which is simply absent.
//
// In 3D that absence is most of the picture. Turbulence there runs a forward
// cascade: energy enters at the large scales, vortex stretching — the (w.grad)u
// term — tips and thins vortex tubes, and structure breaks downward through
// every scale until viscosity eats it. A photograph of smoke is that cascade
// made visible, which is why it has detail at every magnification.
//
// In 2D the stretching term is identically zero. Vorticity is a scalar that is
// merely advected, and the cascade runs the other way: energy moves *up* in
// scale, small eddies merge into large persistent ones, and a 2D plume drifts
// toward a few big smooth counter-rotating structures. That is the lava-lamp
// quality, and it is not a tuning failure — it is what the equations being
// solved actually do. It is also why the vorticity confinement in VORT has such
// a narrow usable window: confinement is re-injecting at the grid scale what a
// missing term should be delivering across every scale below it, and a single
// injection scale is either too weak to matter or so strong it dominates.
//
// So the sub-grid motion is added directly, as the curl of a scalar potential.
// Two properties make that the right shape for it rather than a hack:
//
//   Divergence-free by construction. The curl of anything is, identically, at
//   every point and with no solve — which matters because this is added *after*
//   the projection, to the tracers rather than to the field. Adding an arbitrary
//   velocity there would put compression back into a flow that just had it
//   removed, and tracers would pile up and tear.
//
//   Spatially coherent. Neighbouring tracers get nearly the same displacement,
//   so a ribbon becomes wavy rather than blurry. This is the entire difference
//   from DIFFUSIVITY above and the reason both can exist: a random walk only
//   ever destroys information, a coherent field creates it.
//
// This does not restore the physics. There is no cascade here, no energy moving
// between scales, and the noise knows nothing about the flow except how hard to
// push. What it restores is the *appearance* of the scales the cascade would
// have populated, which is the honest description and is standard practice —
// see Bridson, Hourihan and Nordenstam, "Curl-Noise for Procedural Fluid Flow".

/**
 * Wavelength of the coarse octave, in simulation units.
 *
 * 0.09 is 4.3 cells, and it is picked from underneath rather than from above:
 * the grid's own smallest honest feature is about four cells across — below that
 * the semi-Lagrangian interpolation has already averaged it away — so this is
 * the largest scale that is genuinely missing rather than merely weak. Anything
 * coarser competes with structure the solver is entitled to produce, and the
 * plume starts moving in ways the pressure field did not ask for.
 */
export const SUBGRID_L = 0.09;
/**
 * Velocity amplitude of the coarse octave, in units per second — the knob.
 *
 * Read against the plume, which runs about 1 unit/s (BUOY/DRAG). Kolmogorov puts
 * the eddy velocity at a scale L at roughly V (L/L0)^(1/3), so a box-scale 1
 * unit/s at L0 = 2 predicts about 0.35 at L = 0.09. That is the number for a
 * flow with nothing resolved between the two, and here the grid already carries
 * most of it — this only has to supply what falls off the bottom.
 *
 * 0.06 is a sixth of that, chosen against the two things that go wrong at the
 * ends rather than by matching the spectrum:
 *
 *   too low    the interfaces stay smooth and the plume still reads as 2D
 *   too high   the noise is visibly not the flow — tracers wander across the
 *              ribbons they belong to and the dye stops folding coherently
 *
 * The second bound is the tighter one and it is a displacement, not a velocity.
 * A tracer lives about twelve seconds (RECYCLE_P) and the field decorrelates
 * every SUBGRID_L / SUBGRID_V = 1.5 s, so the walk over a full residence has rms
 * roughly V sqrt(tau T) = 0.25 units, or twelve cells. That would be far too much
 * for a random walk. It is acceptable here precisely because it is coherent: a
 * ribbon and its neighbourhood are displaced together, so twelve cells of
 * wandering is twelve cells of waviness rather than twelve cells of blur.
 */
export const SUBGRID_V = 0.06;
/**
 * Amplitude of the fine octave, relative to the coarse one, and its wavelength.
 *
 * Half the scale at 0.79 the speed, which is (1/2)^(1/3) — the Kolmogorov
 * scaling again, and the point of obeying it here is that it makes the fine
 * octave's *strain rate* 1.6x the coarse one's. Detail comes from strain, so an
 * octave series that flattens amplitude with scale looks like one blurry scale
 * repeated, and one that follows the law looks like a cascade.
 */
export const SUBGRID_FALLOFF = 0.79;
/**
 * How fast the potential evolves, in lattice units per second, at the coarse
 * octave.
 *
 * Set to the eddy turnover, SUBGRID_V / SUBGRID_L = 0.67 — a structure at this
 * scale should lose its identity in about the time it takes to turn over once.
 * Much slower and the noise is a fixed pattern in space that the plume slides
 * through, which is immediately legible as wallpaper; much faster and it stops
 * being a flow at all and becomes a shimmer.
 */
export const SUBGRID_RATE = 0.67;
/**
 * Vorticity at which the sub-grid amplitude saturates, and the floor it starts
 * from.
 *
 * A closure term is not supposed to be uniform. Real sub-grid motion is produced
 * by the resolved flow straining itself, so it lives in the shear layers and the
 * vortex cores and there is very little of it in fluid that is merely drifting.
 * Applying it everywhere at full strength is the tell of noise added for its own
 * sake: quiescent regions acquire a texture that has no cause, and the still air
 * beside the plume starts to crawl.
 *
 * So the amplitude ramps with the local |curl| the solver already computed for
 * the confinement, saturating at OMEGA. The floor is not zero because the smoke
 * is only ever *in* fluid that has been moved, and a hard zero puts a visible
 * boundary between the textured and untextured parts of the same plume.
 *
 * OMEGA is measured rather than guessed, and it has been wrong twice, both times
 * by landing past the top of the distribution — which pins the gate on its floor
 * and leaves a uniform noise field with an expensive multiply in front of it.
 * |curl| over 55 sampled frames of a settled plume, at the two confinement
 * settings that have been the default:
 *
 *   eps 3    median 0.38   p75 1.12   p90 2.23   p99 5.00   max 16.36
 *   eps 2    median 0.12   p75 0.37   p90 0.92   p99 4.55   max 16.12
 *
 * The distribution is extremely long-tailed at either — the max is over a hundred
 * times the median at eps 2 — so anything read off the peak is useless as a
 * saturation point. 1 sits between p75 and p90 of the current default: quiescent
 * fluid at the median comes out at 0.34, the shear layers at p90 reach 0.94, and
 * the vortex cores saturate.
 *
 * Note what the two rows also say, which is that this constant is coupled to the
 * confinement slider — the body of the distribution moves by a factor of three
 * between them while the tail barely moves at all. That coupling is left in
 * deliberately. A flow with more resolved vorticity in it should have more
 * sub-grid motion too, so a viewer who turns the slider up gets more of both,
 * and the alternative is normalizing against a running measure of a field the
 * user is actively changing. But it does mean this number is centred on the
 * default and only on the default.
 */
export const SUBGRID_OMEGA = 1;
export const SUBGRID_FLOOR = 0.25;

/**
 * Ambient motion in the room, as a terminal velocity in units per second.
 *
 * Everything that breaks the plume's symmetry at the moment is a hash: the
 * tracers are seeded and recycled with jitter, but the *field* is exactly
 * mirror-symmetric — a symmetric source in a symmetric box under a symmetric
 * force law — and stays that way until the confinement's own feedback finds a
 * rounding error to amplify. It does find one, which is why the plume is not
 * visibly symmetric for long, but the process has a signature: the column stands
 * straight for several seconds and then breaks, rather than never having been
 * straight in the first place. Nothing real starts symmetric.
 *
 * The room is the honest place to put the asymmetry. A plume rises into air that
 * has its own slow drift, and that drift is what makes real smoke lean and
 * wander. Same curl noise as above at a much larger scale, applied to the
 * velocity field rather than to the tracers, and applied as a force — so the
 * projection sees it and the walls and the plume's own pressure field all get a
 * say in what it actually does.
 *
 * Stated as the velocity it settles at rather than as the force, because the
 * force that produces it is not a meaningful number on its own: under a linear
 * drag the terminal speed is f/DRAG, so the acceleration below is DRAG * this.
 */
export const AMBIENT_V = 0.035;
/**
 * Wavelength of the ambient drift, in simulation units.
 *
 * 0.7 is a third of the box height, which puts one or two cells of the noise
 * lattice across the plume. Larger and it is a uniform crosswind that translates
 * the whole column; smaller and it is a second turbulence source competing with
 * the fluid's own eddies at scales the fluid is perfectly capable of.
 */
export const AMBIENT_L = 0.7;
/**
 * How fast the ambient drift changes, in lattice units per second.
 *
 * The turnover again, AMBIENT_V / AMBIENT_L = 0.05, which is a twenty-second
 * period. Deliberately slower than anything else in the mode: this is weather,
 * not turbulence, and its job is to be the reason the plume is leaning left this
 * minute rather than to be visible as motion of its own.
 */
export const AMBIENT_RATE = 0.05;

/**
 * Thermal expansion, as divergence per unit heating rate.
 *
 * The Boussinesq approximation in BUOY lets a density difference into the
 * momentum equation and nowhere else — the fluid is treated as incompressible
 * everywhere, including in the one place it visibly is not. Air that goes from
 * ambient to plume temperature expands by a large fraction of its own volume,
 * and it does it in the source, over a fraction of a second. A strictly
 * divergence-free solve cannot show that: the fluid over the source is obliged
 * to carry away exactly as much as arrives, so the plume's root is a smooth
 * inlet rather than something pushing outward against the air around it.
 *
 * Putting it back costs one term. The projection makes the field match a target
 * divergence, and that target has always been zero only because nothing was
 * setting it: solve nabla^2 phi = div - E instead of nabla^2 phi = div and the
 * field comes out with divergence E exactly where E was asked for. E is the
 * heating rate, which the temperature commit already knows — it is the part of
 * the temperature change that did not come from advection.
 *
 * The number comes from the gas law rather than from taste. For an ideal gas at
 * constant pressure density goes as 1/T, so the volumetric expansion is
 * (dT/dt)/T with T absolute — and if this mode's t = 1 means roughly a doubling
 * of absolute temperature, which is a hot plume and not a fire, then E is
 * (dt/dt)/(1+t) and the coefficient is order one, not order a tenth.
 *
 * It was 0.08 first, from an estimate that assumed the source is heating the
 * whole time it is on. It is not, and the measurement is the useful part: over
 * 55 sampled frames of a settled plume, |E| is nonzero in 9.5% of cells and
 * reaches p99 0.014, p999 0.083, max 0.128. The source saturates at t = 1 within
 * a fraction of a second and then stops heating anything, so all the expansion
 * lives on the thin rim where cold entrained fluid first meets it — a real
 * effect, correctly placed, and at 0.08 about 1% of the plume's volume flux,
 * which is nothing anyone can see.
 *
 * 0.6 puts that at roughly 9%, which is a visible push at the root, and makes
 * the cursor's heat do something worth doing: CURSOR_HEAT is 4.0 per second over
 * a spot of radius 0.13, so a held pointer drives E to about 2.4 there and the
 * smoke visibly expands away from it rather than merely rising off it.
 *
 * Cooling comes along for free and with the right sign, because the same
 * difference is negative wherever COOL is winning. It is worth about -0.08 in
 * the body of the plume against a flow of 0.7, so it is a slow contraction as
 * the column cools — which is correct, is far too small to read as convergence,
 * and is in because leaving it out would mean writing code to remove it.
 */
export const EXPAND = 0.6;

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
/** Target divergence, from thermal expansion — see EXPAND and project(). */
const dil = new Float32Array(CELLS);
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
  dil.fill(0);
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
  return {
    u: uu,
    v: vv,
    temp: tt,
    phi,
    div: dvg,
    curl: crl,
    dil,
    nx: NX,
    ny: NY,
    stride: SX,
    h: H,
    xr: XR,
  };
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

/** The curl plane, read at an arbitrary point — the gate on the sub-grid noise.
 *  Cell-centered, so it samples exactly like temperature. */
function sampleCurl(px: number, py: number) {
  return sampleT(crl, px, py);
}

// --- curl noise --------------------------------------------------------------
//
// One divergence-free field, used at two scales for two jobs: the ambient drift
// in the room (AMBIENT_V) and the sub-grid motion the grid cannot carry
// (SUBGRID_V). See the block around those constants for what each is for.
//
// The construction is the whole point and is worth stating once. A stream
// function is any scalar psi; the field (d psi/dy, -d psi/dx) has divergence
// d2psi/dxdy - d2psi/dydx, which is zero identically — not approximately, not
// after a solve, but as an algebraic fact about mixed partials. So whatever psi
// is, however lumpy, the velocity read off it is incompressible. That is what
// makes it safe to add downstream of a pressure projection.
//
// psi is *gradient* noise — hash a direction at each lattice corner, take the dot
// product with the offset to it, fade between those. Value noise, which hashes a
// scalar at each corner and fades between the scalars, is cheaper and was what
// this used first. It is wrong here, and the way it is wrong is worth keeping on
// the record because it looked like a rendering bug rather than a noise bug.
//
// Everything downstream of psi is a derivative of it, and value noise's
// derivative is (b + d*u_y) * du_x, where du is the fade's slope. Every fade that
// joins smoothly to its neighbours has du = 0 at both ends — that is what makes
// it smooth — so the x-derivative of value noise vanishes identically on every
// vertical lattice plane, and the y-derivative on every horizontal one. As a
// scalar field nobody notices. As a *velocity* field it is a regular grid of
// planes along which the noise stops pushing, tracers accumulate on them, and
// the population reticulates: a visible square lattice at the noise wavelength,
// in the sparse regions where there is nothing else to look at. Real smoke does
// not do that, and no amount of diffusion is the fix — the wavelength here is
// tens of pixels, and a diffusivity strong enough to blur a grid that coarse is
// far past the one that erases every filament (see DIFFUSIVITY).
//
// Gradient noise has no such plane. Its derivative carries a second term, the
// fade-weighted average of the four corner *direction vectors*, which is order
// one everywhere and in particular on the lattice. What vanishes at a lattice
// point is the value, not the slope. This is the whole reason Perlin noise is
// built the way it is, and the reason Bridson's curl-noise paper specifies
// gradient noise rather than the cheaper thing.
//
// Time is the third dimension, so the field evolves in place rather than sliding.
// Two 2D slices lerped, rather than a 3D lattice: only the x and y derivatives
// are ever wanted, the time weight does not depend on x or y, so the derivative
// of the lerp is the lerp of the derivatives and it stays exact. The
// divergence-free identity holds at every fixed z, so an evolving psi is still
// exactly incompressible at every instant.

/**
 * Turns the raw lattice gradient into a roughly unit-rms field, so the amplitude
 * constants above are readable as speeds rather than as the scale of a derivative
 * nobody has in their head.
 *
 * Measured rather than derived: over 200k points, |grad psi| for the noise below
 * has rms 0.7827 per lattice unit, and this is its reciprocal.
 *
 * The same sample is what says the lattice artifact is gone, and it is the check
 * worth keeping. Binning mean |grad psi| by distance to the nearest lattice
 * plane, from on it to mid-cell:
 *
 *   value noise      0.298  0.322  0.357  0.385  0.410  0.429  0.444  0.456  0.457  0.465
 *   gradient noise   0.928  0.930  0.926  0.922  0.916  0.909  0.910  0.895  0.879  0.855
 *
 * A 36% dip on a regular grid against a flat 8% the other way. Note that no
 * aggregate would have caught this — the rms, the mean and the spectrum of the
 * value-noise field were all unremarkable. It took binning against the lattice,
 * and before that it took somebody saying the edges looked like a lattice.
 */
export const NOISE_NORM = 1.278;

/** psi's x and y derivatives, in lattice units, from the last noiseGrad(). Two
 *  module-scope scalars rather than a returned pair, for the same reason the
 *  field planes are module-scope: this is on the frame path and must not
 *  allocate. */
let ngx = 0;
let ngy = 0;

const TAU = Math.PI * 2;

/** Hash of a lattice corner. hash2() is defined with the tracers below and
 *  hoisted; the mixing constants are the usual odd primes. */
function hash3(i: number, j: number, k: number) {
  return hash2(
    (Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1442695041)) | 0,
  );
}

/**
 * One 2D slice of gradient noise, accumulated into ngx/ngy with weight `w`.
 *
 * psi = sum over the four corners of (fade weight) * (corner direction . offset
 * to that corner), which is Perlin's construction. Differentiating a sum of
 * products gives two terms and the second one is the whole point:
 *
 *   dpsi/dx = du * (b + d*v)            the fade's slope against the corner values
 *           + sum(w_ij * g_ij.x)        the fade-weighted mean corner direction
 *
 * The first term is what value noise has on its own, and it vanishes on every
 * lattice plane because du does. The second does not vanish anywhere — it is an
 * average of unit vectors — so the field keeps pushing across the lattice and
 * there is no grid for tracers to settle onto. See the block comment above.
 *
 * Quintic fade rather than cubic. With gradient noise the derivative is the
 * output, so it is the derivative that has to be continuous across a lattice
 * plane, and that needs the fade's *second* derivative to vanish there. Cubic's
 * does not, and the crease it leaves is visible for the same reason the lattice
 * was: this field is looked at through a million tracers.
 */
function noiseSlice(i: number, j: number, k: number, fx: number, fy: number, w: number) {
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const du = 30 * fx * fx * (fx - 1) * (fx - 1);
  const dv = 30 * fy * fy * (fy - 1) * (fy - 1);

  // Corner directions, uniform on the circle. An angle from the hash rather than
  // a pick from a small table of directions: an eight-entry table is half
  // axis-aligned, and axis-aligned bias is the exact failure this rewrite is
  // removing.
  const a00 = hash3(i, j, k) * TAU;
  const a10 = hash3(i + 1, j, k) * TAU;
  const a01 = hash3(i, j + 1, k) * TAU;
  const a11 = hash3(i + 1, j + 1, k) * TAU;
  const g00x = Math.cos(a00), g00y = Math.sin(a00);
  const g10x = Math.cos(a10), g10y = Math.sin(a10);
  const g01x = Math.cos(a01), g01y = Math.sin(a01);
  const g11x = Math.cos(a11), g11y = Math.sin(a11);

  // Corner contributions: direction dotted with the offset from that corner.
  const n00 = g00x * fx + g00y * fy;
  const n10 = g10x * (fx - 1) + g10y * fy;
  const n01 = g01x * fx + g01y * (fy - 1);
  const n11 = g11x * (fx - 1) + g11y * (fy - 1);

  const b = n10 - n00;
  const c = n01 - n00;
  const d = n00 - n10 - n01 + n11;

  const w00 = (1 - u) * (1 - v);
  const w10 = u * (1 - v);
  const w01 = (1 - u) * v;
  const w11 = u * v;

  ngx += w * (du * (b + d * v) + w00 * g00x + w10 * g10x + w01 * g01x + w11 * g11x);
  ngy += w * (dv * (c + d * u) + w00 * g00y + w10 * g10y + w01 * g01y + w11 * g11y);
}

/**
 * psi's x and y derivatives at (x, y, z) in lattice coordinates, into ngx/ngy.
 *
 * Two 2D slices lerped in z rather than a 3D lattice. The time weight does not
 * depend on x or y, so the derivative of the lerp is exactly the lerp of the
 * derivatives and each slice can simply be accumulated with its weight — which
 * is why noiseSlice takes one.
 */
function noiseGrad(x: number, y: number, z: number) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const k = Math.floor(z);
  const fx = x - i;
  const fy = y - j;
  const fz = z - k;
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  ngx = 0;
  ngy = 0;
  noiseSlice(i, j, k, fx, fy, 1 - uz);
  noiseSlice(i, j, k + 1, fx, fy, uz);
}

/** The curl-noise velocity, in cnx and cny. `vel` is the resulting speed scale,
 *  `len` the wavelength in simulation units, `rate` the lattice speed in z. */
let cnx = 0;
let cny = 0;

function curlNoise(px: number, py: number, t: number, len: number, vel: number, rate: number) {
  // The +512 keeps the lattice indices positive over the whole box, so the hash
  // never has to agree with WGSL about how a negative i32 becomes a u32.
  noiseGrad(px / len + 512, py / len + 512, t * rate);
  const a = vel * NOISE_NORM;
  cnx = ngy * a;
  cny = -ngx * a;
}

/**
 * The curl-noise velocity at a point, for verification rather than for the demo
 * — the same arrangement as dumpField() above, and it allocates, which is why it
 * is not what the frame path calls.
 *
 * Worth having exported because the failure this construction had was silent in
 * every aggregate. Mean speed, rms and spectrum all looked fine while the field
 * had a null on every lattice plane; the only thing that showed it was binning
 * the speed by distance to the nearest plane, and the only thing that showed it
 * *first* was somebody looking at the picture. See the verification section of
 * the README for the check.
 */
export function dumpNoise(
  px: number,
  py: number,
  t: number,
  len = 1,
  vel = 1,
  rate = 1,
): [number, number] {
  curlNoise(px, py, t, len, vel, rate);
  return [cnx, cny];
}

/**
 * Two octaves of it, for the tracers — see SUBGRID_L.
 *
 * The offset on the second octave is not decoration. The fine octave's lattice
 * is exactly half the coarse one's, so without it every second plane of the two
 * coincides and whatever registration artifact either one has is reinforced
 * rather than broken up. The offset is not a whole number of either spacing.
 */
function subgridNoise(px: number, py: number, t: number) {
  curlNoise(px, py, t, SUBGRID_L, SUBGRID_V, SUBGRID_RATE);
  const vx = cnx;
  const vy = cny;
  // Rate is a turnover, vel/len, so halving the scale at 0.79 the speed takes it
  // to 2^(2/3) = 1.587 — not to 2. Getting this wrong is not subtle: the fine
  // octave boiling faster than it advects looks like film grain rather than
  // like fluid.
  curlNoise(
    px + 37.1,
    py - 19.3,
    t,
    SUBGRID_L * 0.5,
    SUBGRID_V * SUBGRID_FALLOFF,
    SUBGRID_RATE * 1.587,
  );
  cnx += vx;
  cny += vy;
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
  // Guarded because this is a rate and the caller owns dt. Nothing in the demo
  // passes zero, but the solver is also driven directly from the console.
  const rate = EXPAND / Math.max(dt, 1e-6);
  for (let j = 0; j < NY; j++) {
    const py = -YR + (j + 0.5) * H;
    for (let i = 0; i < NX; i++) {
      const px = -XR + (i + 0.5) * H;
      const advected = tt2[j * NX + i];
      let t = advected * decay;
      t += (1 - t) * pull * sourceWeight(px, py);
      if (cheat > 0) {
        const dx = px - mx;
        const dy = py - my;
        t += cheat * Math.exp(-(dx * dx + dy * dy) / CURSOR_R2);
      }
      tt[j * NX + i] = t;
      // Thermal expansion — see EXPAND. Everything the temperature did this step
      // that advection did not do is heating, and heating is what a low-Mach
      // fluid expands in response to. Taken as the difference rather than by
      // re-deriving the source and cooling terms, so the two cannot drift apart
      // and the cursor's heat is included for free.
      dil[j * NX + i] = (t - advected) * rate;
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
  // The ambient drift is specified as the speed it settles at, and under a
  // linear drag that is f/DRAG — so the force is DRAG times it. See AMBIENT_V.
  const amb = AMBIENT_V * DRAG;

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
      // Ambient drift. A force rather than a velocity, so it goes in upstream of
      // the projection and the fluid gets to answer it — the plume's own
      // pressure field and the open edges decide what a push on the room
      // actually does to the column, which is not something noise should be
      // allowed to dictate.
      curlNoise(px, py, elapsed, AMBIENT_L, amb, AMBIENT_RATE);
      f += cnx;
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
      curlNoise(px, py, elapsed, AMBIENT_L, amb, AMBIENT_RATE);
      f += cny;
      vv[j * SX + i] = vv[j * SX + i] * keep + f * dt;
    }
  }
}

/**
 * Make the field's divergence be what it is supposed to be — which is zero
 * almost everywhere, and the thermal expansion in the cells that are heating.
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
      // Divergence the field has, less the divergence it is supposed to have.
      // Solving against the difference leaves the projected field carrying
      // exactly dil, which is thermal expansion — see EXPAND. With dil zero this
      // is the incompressible projection unchanged, which is what every other
      // cell in the box gets.
      dvg[j * NX + i] =
        (uu[j * SX + i + 1] - uu[j * SX + i] + vv[(j + 1) * SX + i] - vv[j * SX + i]) * inv
        - dil[j * NX + i];
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
    // Sub-grid turbulence, gated by how hard the resolved flow is turning here —
    // see SUBGRID_V. Divergence-free by construction, which is what lets it be
    // added downstream of the projection without putting compression back.
    //
    // Added to the position rather than to the reported velocity: the velocity
    // slot is what the renderer tints by and the sidebar reads, and that is a
    // statement about the fluid. The closure term moves the tracer; it is not
    // something the fluid is doing.
    subgridNoise(x, y, elapsed);
    const gate =
      SUBGRID_FLOOR
      + (1 - SUBGRID_FLOOR) * Math.min(1, Math.abs(sampleCurl(x, y)) / SUBGRID_OMEGA);
    // Advection, the sub-grid field, and the uncorrelated jitter under it — see
    // DIFFUSIVITY. The jitter is hashed against a time bucket rather than drawn
    // from a stream, so it is stateless and the WGSL can reproduce it exactly.
    const nx = x + (vx + cnx * gate) * dt + (hash2(i * 3 + tick * 9781) * 2 - 1) * walk;
    const ny = y + (vy + cny * gate) * dt + (hash2(i * 3 + 1 + tick * 6151) * 2 - 1) * walk;
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
