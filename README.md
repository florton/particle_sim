# 1,000,000 particles — WebGPU compute + virtualized DOM

A browser demo that simulates and renders one million particles at 60 fps while a
sidebar scrolls all 1,000,000 of them, and instruments itself so the claims can be
checked. All figures below are measured, not estimated.

LIVE: https://flanderslorton.com/particles/

## Stack

| | |
| --- | --- |
| Language | TypeScript 5.7, strict, no runtime framework |
| Build | Vite 6 — static output, no server or API |
| Primary backend | WebGPU: one compute shader for integration, one instanced draw call |
| Fallback backend | WebGL2 transform feedback, same force law |
| Reactivity | `alien-signals` — one signal, one effect, deliberately kept out of the frame loop |
| Animation | `motion` for UI transitions |
| Dependencies | 2 runtime packages; 120 kB built, 43 kB gzipped JS |

Particle data is uploaded once and never returns to the CPU on the render path.
Species filtering is a uniform bit test per vertex on the GPU, not a CPU pass over
the population. The sidebar virtualizes 1,000,000 rows down to ~33 live `<div>`s.

## Simulation modes

`M` cycles between seven modes. All share one particle buffer and one render path.

**Spiral galaxy** — a self-gravitating disc. Each frame the population deposits its
mass into a 64×64 mesh, the mesh is convolved for the force field, and every
particle reads that field back. The arms are an instability of the disc responding
to its own density, so they form, shear, dissolve and re-form indefinitely. A slider
sets the disc cooling rate, moving it between a cold disc with few sharp arms and a
hot one with many faint ones — grand-design versus flocculent.

**Chladni plate** — particles descend the gradient of a standing wave onto its nodal
lines. The cursor sweeps the base frequency across roughly 1–13 on each axis, with
each species offset from it, so six figures resolve at once in six colors. Analytic
gradient, so it stays O(n) with no neighbor search.

**Barred galaxy** — the same disc as test particles in a fixed potential, driven by a
rotating m=2 quadrupole. Without self-gravity an arm shears and phase-mixes away
within seconds, so structure here comes from resonance: orbits near the inner and
outer Lindblad resonances get herded onto closed orbits and hold rings open. The disc
is closed rather than conservative — what falls through the middle comes back at the
edge, on the radius its species belongs at.

**Galaxy collision** — Toomre & Toomre's restricted three-body model. Two cores on
their own two-body orbit, solved on the CPU with leapfrog; every one of the million
particles is a massless test particle in the sum of their fields. Enough for tidal
tails and a bridge. `R` flips the second disc's spin sense: the same two cores on the
same orbit throw a tail half the frame long prograde and barely mark the disc
retrograde.

**Fixed-potential disc** — anchored monopole, weak cursor, uniform radial damping,
walls. Nothing drives it and nothing responds to it, so it phase-mixes into a smooth
annulus within seconds. Kept as the baseline the two galaxy modes are measured
against.

**Smoke** — the only mode here that is not a force law. Every other entry tells a
particle what it weighs and where the other mass is; a fluid is incompressible, and
that is a constraint on the entire velocity field at once rather than an interaction
between any two points in it. Enforcing it means solving a Poisson equation for
pressure over the whole domain every frame and subtracting its gradient — there is no
local rule, no softening length and no interaction radius that produces it. So the
grid is not standing in for something more accurate here, the way the galaxy's mesh
stands in for a sum over pairs. It is where the physics is.

The particles are what makes it visible. The grid is 172×96 and the interesting length
scale in a plume is far below a cell: a tracer path integrates the field, so material
lines stretch and fold at scales the thing that moved them cannot represent. Drawing
the grid's own density would be a 172-pixel-wide picture of a smooth blob.

Semi-Lagrangian advection, Boussinesq buoyancy off an advected temperature field,
vorticity confinement, and twenty red-black Gauss-Seidel sweeps for the projection, on
a staggered MAC grid. The floor is solid and the other three sides are open. Heated
cells are allowed a non-zero target divergence, so the projection leaves the thermal
expansion in rather than removing it as an error.

Two things are added because the solve is two-dimensional and cannot produce them. In
3D, turbulence runs a forward cascade — the vortex-stretching term (ω·∇)u tips and thins
vortex tubes, and structure breaks downward through every scale. In 2D that term is
identically zero; vorticity is a scalar that is merely advected, and the cascade runs
*backwards*, small eddies merging into large persistent ones. So a 2D plume drifts
toward a few big smooth counter-rotating blobs no matter how it is tuned, which is also
why the confinement's usable window is so narrow: it is re-injecting at one scale what a
missing term should deliver across all of them. The tracers therefore carry a curl-noise
closure — two octaves of the curl of a value-noise potential, divergence-free by
construction and gated by the local resolved vorticity — which supplies the scales the
cascade would have populated. And the room gets a much larger, much slower version of the
same field, so the column leans and wanders because something is pushing it rather than
because a rounding error eventually broke a perfect symmetry.

The renderer treats it as an absorbing medium rather than an emissive one, which is the
other half of why it used to read as CG. Every other mode here genuinely emits, so
accumulating additively into an HDR buffer and curving the result is what a long exposure
of a bright thing on a dark sky does. Smoke emits nothing: it scatters light and blocks
it. The accumulation buffer already carried what was needed — alpha is a column density
and rgb/alpha the density-weighted mean dye colour — so the tonemap reads that as an
optical depth, marches the density toward a key light for self-shadowing, and composites
the result over a dim room instead of over a vacuum. Species


is used differently from anywhere else in the set: it picks which of six slots across
the source a tracer enters at, and a recycled tracer returns to its own, so six dye
ribbons are injected side by side and never homogenize. Turn five chips off and one
material line is left, folding — the actual signature of chaotic advection, and
invisible in the full-colour image because six interleaved folded ribbons just look
like smoke.

## Measurements

Intel Gen-9 integrated GPU, Chromium, 60 Hz display, 1182×877 backbuffer. The machine
throttles as it warms, so the reliable figures are back-to-back A/B deltas rather
than absolute milliseconds across sessions.

### Integration cost vs. entity count

| entities | CPU (typed arrays, single pass) | WebGPU encode+submit |
| --- | --- | --- |
| 50,000 | 0.66 ms | 0.013 ms |
| 250,000 | 3.36 ms | 0.010 ms |
| 1,000,000 | **13.39 ms** | 0.013 ms |

CPU cost is linear, GPU submit cost is flat, and the crossover is around 250k rather
than 50k. At 50,000 particles a plain `Float32Array` loop costs 0.66 ms — 4% of a
60 Hz frame, so there is nothing to relieve at that scale.

### A/B against a naive DOM implementation (`B`)

Both arms run the identical force law. The only difference is how the result reaches
the screen: the naive arm calls the same `integrateCPU`, then places one DOM element
per entity with `left`/`top` and rebuilds the sidebar from a template string every
frame.

| | GPU arm | naive DOM arm |
| --- | --- | --- |
| particles | **1,000,000** | 5,000 |
| fps | **58** | 16 |
| p50 frame time | **16.70 ms** | 66.60 ms |
| p99 frame time | **33.40 ms** | 83.40 ms |
| dropped frames | 3.9% | **99.6%** |
| blocking long tasks (~15 s of arm) | **0 / 0 ms** | 238 / 14,811 ms |
| live DOM nodes | **33** | 5,400 |
| reactive effect runs | 1 per 650 frames | 1 per 239 frames |

200× the particles at 3.6× the frame rate, with the main thread going from
essentially every millisecond inside a blocking long task to zero.

The smoke is the one mode where this comparison is not purely about presentation. The
naive arm runs the same fluid solve at the same grid resolution and the same sweep
count — anything else would have the two arms simulating different things — and that
costs it about 8–9 ms a frame against well under one on the GPU. It still measures 16
fps and 66.6 ms p50 there, unchanged, because the arm is quantized to whole refresh
intervals and the DOM work dominates by an order of magnitude; the fluid disappears
inside the rounding. Worth knowing rather than worth fixing.

### Does the galaxy have structure?

A(m=2) is the normalized Fourier amplitude of surface density at the m=2 angular
harmonic over the annulus 0.15 < r < 0.8. Nonzero means arms; a purely axisymmetric
disc sits at the shot-noise floor.

| | A(m=2) at t=6s | at t=20s | at t=60s | noise floor |
| --- | --- | --- | --- | --- |
| fixed potential (previous) | 3.4e-3 | 2.2e-3 | 1.7e-3 | 2.3e-3 |
| self-gravitating (now) | 4.9e-2 | 7.5e-2 | 2.2e-2 | 5.6e-3 |

The fixed-potential version never left the noise floor at any point — no azimuthal
structure after it settled, and none during the opening either. What looked like
spiral arms for the first two seconds was a *radial* breathing wave: every particle
was seeded at 0.94× circular speed, so the whole population reached apocenter
simultaneously and peak density hit 25× the mean at t=1.0s. Epicyclic frequency
varies with radius, the phases smeared, radial damping removed the remainder, and by
t=20s radial velocity dispersion had fallen 5× to a flat line.

A second, independent problem would have hidden the first even with correct physics.
At the 1M gain floor each particle deposited ~0.196 of alpha into an 8-bit target and
the disc averaged ~3.9 particles per pixel, so the *mean* of the galaxy sat at 0.77 of
full white and the inner disc ran about eight times over it. Past that everything
reads 1.0 and density stops being visible. Hence the HDR accumulation buffer and the
tonemap.

### What the disc cooling slider trades

Cooling is radial-velocity retention per step — the dissipation that keeps Toomre Q
low enough for the disc to amplify its own density contrast into arms. It is also what
lets material sink to the center. Measured over 40 s of headless integration:

| cooling | late A(m=2) | mass drained to core | disc remaining |
| --- | --- | --- | --- |
| 0.985 (cold) | 2.2e-1 | 36.5% | 60% |
| 0.990 | 8.2e-2 | 24.8% | 69% |
| 0.995 (default) | 3.7e-2 | 8.0% | 86% |

A colder disc makes arms roughly six times stronger and consumes itself doing it. The
low end of the slider is deliberately unsustainable; the default is the setting that
still looks like a galaxy several minutes in.

### Cost of self-gravity

Measured by A/B against Chladni mode, which runs the same population and fill rate
with no mesh passes.

| particles | with self-gravity | without | delta |
| --- | --- | --- | --- |
| 100,000 | 16.7 ms | 16.7 ms | vsync-capped |
| 500,000 | 16.8 ms | 16.7 ms | vsync-capped |
| 1,000,000 | 20.2 ms | 16.8 ms | **3.4 ms** |

Up to 500k the solver is free. At 1M it costs 3.4 ms, and the reason that overruns the
frame is that the base 1M render already sat at 16.8 ms on this GPU before any physics.

Four results from tuning the solver:

- **Grid resolution has an optimum, and it is not the coarsest.** Self-gravity cost
  4.3 ms at 32², **3.4 ms at 64²**, and 49.6 ms at 128². The coarse grid is slower
  despite a 16× cheaper convolution.
- **Cloud-in-cell deposition with four atomics per particle beats nearest-cell with
  one** — 3.4 ms against 8.6 ms. The pass is bound by contention, not throughput: an
  exponential disc aims a large share of the population at a few central cells, and
  CIC divides that queue four ways. Same reason the coarser grid loses.
- **Privatizing the deposit into per-workgroup tiles made it worse** — 4.0 ms against
  3.4 ms — despite cutting global atomic traffic by over an order of magnitude.
  Collapsing a million independent threads into sixty-odd workgroups costs more than
  the contention did. Removed.
- **Convolution cost is a function of how long the sim has been running.** It skips
  cells with no mass, and a freshly seeded disc occupies about a third of the grid —
  but after a minute a thin spray of escapees has touched roughly 80% of it, each of
  those cells costing a full row of the loop while carrying a millionth of the mass.
  At 1M, identical code cost 3.4 ms on a fresh disc and **9.7 ms** on a settled one.
  Skipping by a mass floor rather than exact zero brings the settled case to 5.4 ms
  with mass conservation unaffected (`dumpGrid()` still sums to 0.18). This explained
  the dropped frames that looked like thermal throttling.

### Cost of the fluid

Same A/B as above, against Chladni mode at the same population — it shares the render
path and the HDR target and runs no grid passes at all. The fluid's cost is fixed:
16,512 cells and twenty sweeps regardless of how many tracers are in it.

| particles | smoke | Chladni | delta |
| --- | --- | --- | --- |
| 250,000 | 60 fps, 0% dropped | 60 fps, 0% dropped | vsync-capped |
| 1,000,000 | 42 fps, 36.2% dropped | 49 fps, 21.7% dropped | **~3.4 ms** |

The sub-grid noise and the shadow march do not measurably change that. Timed off the
vsync clock instead — 120–150 `frame()` calls back to back at 1M, synced on a readback,
1280×720 — smoke ran 22.2–23.5 ms against Chladni's 20.7–20.8 on a cold machine, so the
whole fluid including both new passes lands **~1.5–2.5 ms**, at or under where it was
before them.

That range is wider than the effect being measured, and it is quoted as a range for a
reason: repeating the same A/B once the machine had warmed gave Chladni 24.2–30.3 and
smoke 23.0–25.3, which is a *negative* delta. The thermal drift is larger than the thing
under test, so the honest claim is only that neither addition is expensive enough to
find. That is not surprising for either — at 1M sprites both modes are render-bound, the
noise is a few dozen ALU ops and sixteen trig calls on a pass that was already sampling
the velocity field, and the shadow march early-outs on the ~85% of the frame with no
smoke in it. A `timestamp-query` pass would settle it properly.

The delta is from mean frame time — 1000/42 against 1000/49, so 23.8 ms against 20.4 —
rather than from p50, which reads 16.7 ms in all four cells because it is vsync-capped
and quantized to the refresh interval. At this grid size the fluid costs about what the
self-gravity mesh does, which is a coincidence of two unrelated solvers and not a
result.

Below the point where the render alone saturates the frame, the whole solver is free,
the same as the mesh and for the same reason: at 250k the base render leaves several
milliseconds of slack and 48 small dispatches fit inside it.

The projection is checked rather than admired. Sampled off the GPU after twelve seconds
of running, the pressure solve was handed a field with mean |divergence| 1.014 and left
0.017 — **98.4% removed**, with the peak going 11.36 to 0.252. Twenty sweeps does not
converge a 16k-cell Poisson solve and is not meant to; Gauss-Seidel clears error
fastest at the shortest wavelengths, so what twenty sweeps buys is no *local*
compression, which is the part the eye can see. The smooth remainder reads as the fluid
being very slightly compressible.

Four results from building it:

- **Vorticity confinement is a positive feedback and runs away.** The force it adds is
  proportional to the vorticity already present, so vorticity drives a force that makes
  more vorticity. Mean enstrophy and peak field speed over 10 s from one seed, with and
  without a ceiling on the force:

  | ε | unclamped | | clamped | |
  | --- | --- | --- | --- | --- |
  | | enstrophy | peak speed | enstrophy | peak speed |
  | 0 | 0.84 | 0.44 | 0.84 | 0.44 |
  | 6 | 5.12 | 0.57 | 5.69 | 0.62 |
  | 12 | 77.8 | 3.20 | 57.9 | 1.33 |
  | 24 | 1179 | 14.6 | 128 | 2.61 |
  | 40 | 7234 | 28.1 | 160 | 2.66 |

  The buoyancy sustains about 1 unit/s in the body of the plume and roughly 3 inside the
  jet itself, so the unclamped column at ε=24 and above is not a rougher plume — it is
  the feedback diverging. Clamping the magnitude keeps the direction, which is where the
  physics is; the clamp is inactive in ordinary flow and only engages on a vortex that
  is winding itself up.
- **A closed box cannot hold a plume.** With solid side walls the column went unstable,
  flopped over and got pinned by its own return flow, ending as two motionless sheets of
  tracers down the left and right edges with the middle empty. Opening three sides fixed
  the pinning, and also took the projection's residual from 1.6 to 0.04 — a Poisson
  problem with Dirichlet boundaries on three sides converges far faster than one boxed
  in by Neumann on all four.
- **Source temperature and cooling length are the same knob if you inject heat at a
  rate.** Held at rate 4.0 against cooling 4.0, the source sits at T=1 and the plume is
  cold within a fifth of the box: it gets one kick at the bottom and coasts, mean tracer
  height stuck at -0.65 and no column at all. Pinning the source to a fixed temperature
  instead separates them.
- **Exposure tuned for a galaxy renders a plume in white.** The disc's gain is sized for
  a population inside r=0.7 spanning orders of magnitude in density. A plume covers four
  times the area with its light in filaments that are all about equally bright, so every
  one of them landed above the tonemap's white rolloff — correct turbulent structure,
  rendered in monochrome, all six dye ribbons indistinguishable. The fluid carries its
  own gain and exposure.
- **Tracers with no diffusion render as a foam, and the fix is bounded by the thing it
  is fixing.** A tracer is present or absent, the flow folds rather than compresses, and
  with three open sides most of what gets folded in is clean fluid carrying nothing — so
  the clean regions round off into blobs and the tracers pile onto the sheets between
  them. What is missing is real: the grid resolves eddies down to about a cell and the
  standard closure for the transport the unresolved ones would do is a diffusivity. But
  the voids and the filaments are the *same* length scale, both set by how far the flow
  folds material between passes, so the setting is a compromise rather than a fix. The
  scale to think in is the rms smear over a tracer's transit, sqrt(2 D T):

  | D | smear | |
  | --- | --- | --- |
  | 2e-5 | 0.7 cells | softens the interfaces, leaves every pocket |
  | 8e-5 | 1.4 cells | closes the small pockets, filaments intact |
  | 5e-4 | 3.4 cells | featureless grey column |

  It sat at 8e-5 for as long as this was the only sub-grid term, because the small
  pockets are the ones worth losing and 8e-5 is the weakest setting that closes them.
  But the trade is made of nothing but the walk's own limitation: it is isotropic and
  uncorrelated, so the only thing it can do to a structure is blur it, and paying a
  filament to close a void is the best a scheme with no spatial coherence can manage.
  The curl noise below is the same missing physics with the coherence put back — it
  fills a pocket by folding it shut — so this dropped back to 2e-5, where its whole job
  is softening the interface at the scale of a single tracer. Both are kept: the noise
  has structure and therefore leaves its own texture, and a little genuinely
  uncorrelated jitter under it is what stops that texture reading as a pattern.
- **Value noise draws a lattice through a million tracers, and no aggregate catches it.**
  The curl-noise closure was built on value noise first — hash a scalar at each lattice
  corner, fade between the scalars — because it is cheaper and the difference from
  gradient noise looked cosmetic. It is not, and the reason is that everything here is a
  *derivative* of the noise. Value noise's is `(b + d·u_y)·du_x`, and every fade that
  joins smoothly to its neighbours has `du = 0` at both ends, so the x-derivative
  vanishes identically on every vertical lattice plane and the y-derivative on every
  horizontal one. The field stops pushing on a regular grid, tracers settle onto it, and
  the sparse regions at the plume's edge reticulate into visible squares at the noise
  wavelength — tens of pixels across, far too coarse for any diffusivity to blur without
  erasing the filaments too. Gradient noise carries a second term in its derivative, the
  fade-weighted mean of the four corner direction vectors, which is order one everywhere
  including on the lattice. Mean |∇ψ| binned by distance to the nearest plane, on it to
  mid-cell, 200k samples:

  | | on plane | → | mid-cell |
  | --- | --- | --- | --- |
  | value noise | 0.298 | 0.322 0.357 0.385 0.410 0.429 0.444 0.456 0.457 | 0.465 |
  | gradient noise | 0.928 | 0.930 0.926 0.922 0.916 0.909 0.910 0.895 0.879 | 0.855 |

  A 36% dip on a regular grid, against a flat 8% the other way. The part worth keeping is
  that **nothing aggregate would have found this**: the rms, the mean and the spectrum of
  the value-noise field were all unremarkable, and the only statistic that shows it is one
  binned against the lattice — which nobody computes unless they already suspect the
  lattice. It was found by looking at the picture. `dumpNoise()` exists so the check is
  cheap the next time.
- **The confinement's floor was a statement about the picture, read as one about the
  field.** The default was 3, and the note under it said ε=2 "goes laminar within half a
  minute". Field enstrophy in 15 s windows over 90 s says otherwise — nothing decays at
  either setting:

  | ε | 0–15s | 15–30 | 30–45 | 45–60 | 60–75 | 75–90 |
  | --- | --- | --- | --- | --- | --- | --- |
  | 2 | 1.09 | 1.19 | 1.13 | 1.50 | 1.52 | 1.51 |
  | 3 | 0.95 | 1.88 | 3.16 | 3.48 | 3.33 | 3.34 |

  ε=2 simply sustains about a third of the vorticity, and with the tracers carrying no
  structure of their own that third did not look like anything, so "laminar" was the word
  for it. Now that the closure supplies the small scales, the confinement is only being
  asked to stop the resolved eddies being smeared flat — and the thing it does badly is
  the other job: at the plume's rim, where the strain is low and there is nothing to
  sharpen, it winds isolated vortices up out of still fluid, each evacuating its own core
  into a small spiral. Those are numerics, not flow, and they go with ε. The default is
  now 2, which holds flat over the same 90 s (0.69, 0.93, 0.89, 1.02, 0.95, 0.78).
- **The sub-grid gate was scaled off the peak vorticity, twice.** The curl noise is
  gated by the local resolved |curl| so that quiescent fluid does not acquire a texture
  with no cause. Saturating that ramp was set from the peak of the distribution the first
  time (8) and from the wrong confinement setting the second (3) — and the distribution
  is extremely long-tailed, so anything read off its top pins the gate at its floor
  across the whole plume, which is a uniform noise field with an expensive multiply in
  front of it. Over 55 sampled frames of a settled plume:

  | ε | median | p75 | p90 | p99 | max |
  | --- | --- | --- | --- | --- | --- |
  | 3 | 0.38 | 1.12 | 2.23 | 5.00 | 16.36 |
  | 2 | 0.12 | 0.37 | 0.92 | 4.55 | 16.12 |

  The max is over a hundred times the median at ε=2. The setting is 1, between p75 and
  p90 of the default: quiescent fluid comes out at 0.34, shear layers at 0.94, vortex
  cores saturate. Those two rows also say the constant is coupled to the confinement
  slider — the body of the distribution moves threefold between them while the tail
  barely moves. That is left in on purpose, since a flow with more resolved vorticity
  should carry more sub-grid motion, but it means the number is centred on the default
  and only on the default.
- **Thermal expansion estimated from the source strength is off by an order of
  magnitude, because the source stops heating.** The first coefficient assumed fluid in
  the source heats at SRC_RATE the whole time it is on. It does not — it saturates at
  T=1 within a fraction of a second, and after that all the expansion lives on the thin
  rim where cold entrained fluid first meets it. Measured, |E| is nonzero in 9.5% of
  cells and reaches p99 0.014, p999 0.083, max 0.128: real, correctly placed, and worth
  about 1% of the plume's volume flux, which nobody can see. The gas law gives the
  coefficient properly — at constant pressure density goes as 1/T, so the expansion is
  (dT/dt)/T and the number is order one rather than order a tenth. At 0.6 it is ~9% of
  the volume flux, visible as a push at the root, and a held cursor now drives E to
  about 2.4 under the pointer so the smoke expands away from it instead of merely
  rising off it.
- **Rendering smoke correctly renders the dye invisible.** Three things desaturate it
  and they compound: a pixel's tint is the density-weighted mean of whatever species
  landed on it and six overlapping ribbons average to grey, the albedo lift pulls what
  survives toward white, and compositing `bg*trans + lit*(1-trans)` over a neutral room
  makes thin smoke seven parts grey wall. Each step is right and the sum is a monochrome
  plume — fine as a picture of smoke, useless as this mode, where the six ribbons are
  the only reason species exist here. Chroma is scaled about the pixel's own luminance
  before the lift, which moves hue without moving brightness. A filament carrying mostly
  one dye reads as that dye; a well-mixed region still goes grey, which is honest,
  because mixing really has happened there.
- **The confinement's usable window is narrow.** By ε=12 it curls at every point — smoke
  is mostly smooth sheets with structure at a few scales, and a tightly wound vortex also
  evacuates its own core, so a high setting fills the frame with small round voids each
  ringed by a bright filament. The slider tops out at 10 rather than at the point where
  the force saturates, because travel spent on settings nobody should pick is travel it
  does not have where it matters. The bottom of the window is set out above, and it moved
  once the tracers stopped depending on confinement for their detail.
- **Ambient haze to lift the voids off black does not survive the arithmetic.** The
  gaps read as holes partly because the fluid around the plume carries nothing at all,
  which is not physical — a room with a plume in it is not a vacuum. Drawing 18% of the
  population uniformly over the box instead of at the source is 0.09 tracers per pixel,
  which after the tonemap is about 0.001 of luminance against a background already at
  0.03: invisible. Lifting a void even to a tenth of full brightness needs forty times
  that, more tracers than the whole population has. What it did buy was 18% fewer
  tracers in the plume. Removed.

## Controls

| key | action |
| --- | --- |
| `M` | cycle simulation mode |
| `B` | switch between GPU and naive DOM arm |
| `R` | restart the simulation (flips spin sense in collision mode) |
| `C` | toggle species palette against a luminance-only render |
| `V` | face-on or inclined view (not on the plate or the smoke) |
| click chips | filter species |
| slider | disc cooling; vorticity confinement in the smoke |
| cursor | perturb the field; hold to grab it — in the smoke, stir it |

Holding the pointer ramps three things together over a few hundred milliseconds — the
cursor's mass to 4×, its softening down to a tenth, and a local drag that bleeds
approach velocity. This pulls a bright companion out of the disc with a tidal bridge
back to it, taking mass within 0.12 of the pointer from 1.3% to 9.1% over four
seconds. The interaction is destructive by design: material dragged off a circular
orbit has nowhere to go but inward, so a four-second hold leaves ~41% of the disc
inside r<0.1 twelve seconds later, against 7% for an untouched one.

The cooling slider belongs to the self-gravitating disc and is hidden in modes with
their own dissipation law; in those, holding switches the cursor between two masses
rather than ramping. `B` compares within whichever mode is active, so both arms always
run the same force law — including mesh self-gravity, which the CPU reference
implements at the same grid resolution, and the fluid, which it implements at the same
grid resolution and the same sweep count.

In the smoke the cursor is a paddle rather than a mass, and what it injects is the
pointer's own velocity: a stationary pointer does nothing, because a stationary paddle
in a real tank does nothing. Holding ramps the stir and adds heat under the pointer,
using the same ramp the self-gravitating disc uses and for the same reason — a step
change in a term this size arrives as an impulse and tears the field.

## Running

```bash
npm install && npm run dev
```

Entity count is the first slider in the sidebar: 25,000 to 2,000,000 disc
particles, default 1,000,000. Buffers are allocated at the maximum and the
population is a prefix of them, so the slider never reloads or restarts in either
direction — dragging down drops the tail, dragging up seeds and uploads only the
slots being added. The galaxy on screen keeps its arms and its clock; the new
particles arrive cold and are mixed in by the disc within a second or two.

Query parameters:

- `?backend=webgl2` — force the transform-feedback fallback

## Verification

The sim can be driven and inspected without relying on rAF:

```js
const { backend, sim, integrateCPU } = window.__demo;
const before = await backend.readback(0, 4);
for (let i = 0; i < 120; i++) backend.frame(1 / 60, 0.4, 0.2);
const after = await backend.readback(0, 4);
```

`dumpGrid()` returns the density mesh and the force field solved from it, so the
self-gravity solver can be checked against an independent implementation. Total mass
should come back as `M_DISC` exactly, and the field should point inward everywhere
outside the core:

```js
const g = await window.__demo.backend.dumpGrid();
let total = 0;
for (const d of g.dens) total += d * g.massScale;   // -> 0.18
```

`dumpSmoke()` does the same for the fluid, and returns the projected velocity alongside
the divergence the solve was handed — so the one claim worth checking about a pressure
projection can be checked, rather than inferred from the picture looking like smoke.

The target is not zero everywhere. `dil` is the thermal expansion the solve was *asked*
to leave in the field, and `div` is the right-hand side it was handed, which is the raw
divergence minus that target. So the field going in had `div + dil` and the field coming
out should have `dil` — the residual to measure is the distance from the target, not the
distance from zero:

```js
const { div, dil, vel, nx, ny, stride, h } = await window.__demo.backend.dumpSmoke();
const U = (i, j) => vel[2 * (j * stride + i)];
const V = (i, j) => vel[2 * (j * stride + i) + 1];

let handed = 0, off = 0;
for (let j = 0; j < ny; j++)
  for (let i = 0; i < nx; i++) {
    const c = j * nx + i;
    const got = (U(i + 1, j) - U(i, j) + V(i, j + 1) - V(i, j)) / h;
    handed += Math.abs(div[c] + dil[c]);
    off += Math.abs(got - dil[c]);
  }

1 - off / handed;   // -> ~0.996
```

`__demo.smoke.dumpNoise(x, y, t)` returns the sub-grid curl-noise velocity at a point,
which exists because the one bug this mode has had that was invisible to every aggregate
was a lattice in that field. Bin the speed against distance to the nearest lattice plane
and a flat profile is the pass condition:

```js
const { dumpNoise } = window.__demo.smoke;
const band = new Float64Array(10), n = new Float64Array(10);
for (let i = 0; i < 2e5; i++) {
  const x = Math.random() * 40 - 20, y = Math.random() * 40 - 20;
  const [vx, vy] = dumpNoise(x, y, Math.random() * 10);   // unit wavelength
  const f = x - Math.floor(x);
  const b = Math.min(9, Math.floor(Math.min(f, 1 - f) * 20));
  band[b] += Math.hypot(vx, vy); n[b]++;
}
[...band].map((s, i) => (s / n[i]).toFixed(3));   // -> flat, ~0.93 down to ~0.86
```

`__demo.smoke` is the CPU reference the WGSL mirrors, and it needs no GPU at all —
`stepFluid(dt, mx, my)` advances the fluid on its own and `dumpField()` returns the
same planes. The confinement sweep and the CPU cost above were measured through it,
headless.

## Deploying

Fully static — no server, no runtime, no API. `npm run build` emits three files
totalling ~125 kB (43 kB gzipped JS) into `dist/`. Most of that is shader source: the
WGSL and GLSL are template literals and ship verbatim, comments included. Copy that
directory to your web
root. Verified by serving the built output and confirming numbers identical to the dev
server.

**Serve it over HTTPS.** WebGPU requires a secure context, so over plain `http://` on
a LAN address every visitor silently falls back to the WebGL2 path. `localhost` is
exempt; a LAN IP is not. `file://` fails outright, since ES module imports are blocked
too.

Nginx, root-served:

```nginx
root /var/www/particles;
index index.html;

# Hashed filenames — safe to cache forever.
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# index.html must not be cached, or clients pin to stale asset hashes.
location = /index.html {
  add_header Cache-Control "no-cache";
}
```

No SPA rewrite rule is needed — single page, query parameters read client-side. No
COOP/COEP headers either, since nothing uses `SharedArrayBuffer`. Confirm your server
sends a JavaScript MIME type for `.js`, or the module script will refuse to execute.

To serve from a subdirectory, build with `BASE_PATH=/subdir/ npm run build`. (In Git
Bash on Windows, MSYS mangles a leading-slash value into a Windows path — use
`MSYS_NO_PATHCONV=1`.)

## Layout

| file | role |
| --- | --- |
| `src/hud.ts` | Instrumentation. Allocation-free; built before anything else. |
| `src/sim/world.ts` | Particle buffer, entity tags, shared constants, CPU reference integration including the mesh solver. |
| `src/sim/smoke.ts` | The fluid: grid geometry, the solver, the tracers, and the CPU reference the WGSL mirrors. |
| `src/render/webgpu.ts` | Compute + instanced render over one shared buffer. |
| `src/render/webgl2.ts` | Transform-feedback fallback, same force law. |
| `src/ui/list.ts` | Virtualized list + bounded windowed readback. |
| `src/ui/state.ts` | Signals, scoped to interaction-driven state only — the species filter and the active arm. |

## Known issues

- **The WebGL2 fallback does not run self-gravity.** Transform feedback has no atomics
  and no shared memory, so the mesh would have to be built by splatting points into a
  float framebuffer and solved in a second full-screen pass. Until then the fallback is
  the fixed-potential galaxy and decays to a smooth disc. Everything else — seeding
  profile, constants, cooling control, framing — is kept in sync, so the difference is
  exactly that one term. It also has no HDR path, so it clips.
- **The WebGL2 fallback does not have the smoke at all**, and unlike self-gravity it is
  removed rather than degraded — `M` skips it on that backend. The distinction is the
  point: a disc missing its mesh term is still a disc running one of the other modes in
  the set, so it degrades into something honest. A fluid missing its pressure projection
  is not a worse fluid, and the tracers in it have no dynamics of their own to fall back
  on, so what would be left is a still image. Every stage of the solver is a gather over
  a small grid and needs no atomics, so this is work not done rather than a wall.
- **The smoke's tracers have a finite residence time, and that is a fudge.** Recycling
  only what leaves the box is not enough: stagnation points collect tracers that never
  come out, and over a couple of minutes the plume thins while the still corners fill.
  So roughly 8% of the population per second is recycled to the source regardless of
  where it is. It is drawn statelessly, as a hash of the slot against a time bucket,
  because a particle is four floats and all four are position and velocity.
- **Twenty sweeps leaves about 1.7% of the mean divergence in the field**, which is a
  real approximation and not a rounding error — see the figures above. It is invisible
  at this scale and would not be in a simulation that had to conserve anything.
- **The smoke is still a 2D section, and the two things it cannot have are still
  missing.** There is no vortex stretching, so nothing here runs a real forward cascade —
  the curl-noise closure supplies the *appearance* of the scales one would have
  populated, not the physics, and it knows nothing about the flow except how hard to
  push. And there is no depth: a volume superposes many layers along the view ray and
  fills its own gaps in, where a single plane has nothing behind it. The self-shadowing
  march fakes a light path across the screen because there is no path through the page to
  integrate, which is why its extinction coefficient is unrelated to the view ray's and
  has to be set by eye. Both are the same fix and it is a 3D solver.
- **The absorbing renderer makes sparse regions grainier, not smoother.** Isolated
  tracers at the plume's edge used to be a dim additive glow and now read as individual
  specks, because a lone particle is a small opaque thing rather than a small amount of
  light. It is arguably more honest — that is what a suspended soot grain does — but it
  is a real change and it is most visible with five filter chips off, where a sixth of
  the population is drawing the whole picture.
- At 1M the GPU arm runs ~19–20 ms on this integrated GPU rather than a clean 16.7.
  500k on the count slider is a locked 60 fps with self-gravity and looks near-identical, since
  per-particle gain is normalized by population.
- fps is vsync-capped at 60, so GPU headroom below 1M is unmeasured. A
  `timestamp-query` pass would show it, and would also split the mesh passes apart
  instead of measuring them as a block.
- The disc slowly drains toward the center: mass inside r<0.1 climbs from 5% to about
  14% over 60 s. This is correct physics for a dissipative disc — angular momentum
  moves outward, mass moves in — but it means there is no true steady state, which is
  why `R` exists. Radius-dependent cooling would slow it.
</content>
