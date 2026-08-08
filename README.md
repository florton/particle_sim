# 1,000,000 particles — WebGPU compute + virtualized DOM

A browser demo that simulates and renders one million particles at 60 fps while a
sidebar scrolls all 1,000,000 of them, and instruments itself so the claims can be
checked. All figures below are measured, not estimated.

## Stack

| | |
| --- | --- |
| Language | TypeScript 5.7, strict, no runtime framework |
| Build | Vite 6 — static output, no server or API |
| Primary backend | WebGPU: one compute shader for integration, one instanced draw call |
| Fallback backend | WebGL2 transform feedback, same force law |
| Reactivity | `alien-signals` — one signal, one effect, deliberately kept out of the frame loop |
| Animation | `motion` for UI transitions |
| Dependencies | 2 runtime packages; ~45 kB built, 15 kB gzipped JS |

Particle data is uploaded once and never returns to the CPU on the render path.
Species filtering is a uniform bit test per vertex on the GPU, not a CPU pass over
the population. The sidebar virtualizes 1,000,000 rows down to ~33 live `<div>`s.

## Simulation modes

`M` cycles between five modes. All share one particle buffer and one render path.

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

## Controls

| key | action |
| --- | --- |
| `M` | cycle simulation mode |
| `B` | switch between GPU and naive DOM arm |
| `R` | restart the simulation (flips spin sense in collision mode) |
| `C` | toggle species palette against a luminance-only render |
| click chips | filter species |
| slider | disc cooling |
| cursor | perturb the field; hold to grab it |

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
implements at the same grid resolution.

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

## Deploying

Fully static — no server, no runtime, no API. `npm run build` emits three files
totalling ~45 kB (15 kB gzipped JS) into `dist/`. Copy that directory to your web
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
