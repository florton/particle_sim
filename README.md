# 1,000,000 particles — WebGPU compute + virtualized DOM

A browser performance demo built to survive someone opening DevTools.

Every number below was measured on the machine that built it, not estimated.
Where a claim didn't survive measurement, the claim was changed rather than the
measurement.

## What it does

- **1,000,000 particles**, integrated in a WebGPU compute shader, drawn in one
  instanced call. Particle data is uploaded once and never returns to the CPU on
  the render path.
- **Two simulation modes**, `M` to switch:
  - **Spiral galaxy** — a self-gravitating disc. Every frame the population
    deposits its mass into a 64x64 mesh, the mesh convolves against itself for
    the force field, and every particle reads that field back. The arms are a
    genuine instability of the disc responding to its own density, so they form,
    shear, dissolve and re-form indefinitely and never twice the same. A slider
    sets the disc cooling rate, which moves it between a cold disc with few
    sharp arms and a hot one with many faint ones — the difference between a
    grand-design and a flocculent spiral, which is a real distinction between
    real galaxies.
  - **Chladni plate** — particles descend the gradient of a standing wave onto
    its nodal lines, the way sand does on a vibrating plate. The cursor sweeps
    the base frequency across roughly 1–13 on each axis, with each species offset
    from it, so six figures resolve at once in six colours — sparse sweeping
    curves at one corner, a dense interference lattice at the other. Analytic
    gradient, so it stays O(n) with no neighbour search.
- **A sidebar over all 1,000,000 rows** that keeps ~33 `<div>`s alive.
- **Six species filters** that cull on the GPU — a uniform bit test per vertex,
  not a CPU pass over the population.
- **A reactive graph that runs almost never** — and a HUD counter proving it.

## Measured results

Intel Gen-9 integrated GPU, Chromium, 60Hz display, 1182×877 backbuffer. This
machine throttles as it warms, so the trustworthy figures below are the
back-to-back A/B deltas rather than absolute milliseconds across sessions.

### Does the galaxy actually have structure?

The honest way to ask is to measure it. A(m=2) is the normalized Fourier
amplitude of surface density at the m=2 angular harmonic over the annulus
0.15 < r < 0.8 — nonzero means arms, and a purely axisymmetric disc sits at the
shot-noise floor.

| | A(m=2) at t=6s | at t=20s | at t=60s | noise floor |
| --- | --- | --- | --- | --- |
| fixed potential (previous) | 3.4e-3 | 2.2e-3 | 1.7e-3 | 2.3e-3 |
| self-gravitating (now) | 4.9e-2 | 7.5e-2 | 2.2e-2 | 5.6e-3 |

**The previous version never left the noise floor at any point in its life.** It
had no azimuthal structure at all — not after it settled, and not during the
pretty opening either. What looked like spiral arms for the first two seconds
was a *radial* breathing wave: every particle was seeded at 0.94x circular speed
so the whole population reached apocentre simultaneously, and peak density hit
25x the mean at t=1.0s. Epicyclic frequency varies with radius, the phases
smeared, the radial damping removed what was left, and by t=20s the radial
velocity dispersion had fallen 5x to a flat line. A collisionless disc in a
static axisymmetric potential has exactly one end state and that was it.

The second failure was independent and would have hidden the first even if the
physics had been fixed. At the 1M gain floor each particle deposited ~0.196 of
alpha into an 8-bit target and the disc averaged ~3.9 particles per pixel — so
the *mean* of the galaxy sat at 0.77 of full white and the inner disc ran about
eight times over it. Past that everything reads 1.0 and density stops being
visible, so structure and no structure look identical. Hence the HDR
accumulation buffer and the tonemap.

### Integration cost vs. entity count

| entities | CPU (typed arrays, single pass) | WebGPU encode+submit |
| --- | --- | --- |
| 50,000 | 0.66 ms | 0.013 ms |
| 250,000 | 3.36 ms | 0.010 ms |
| 1,000,000 | **13.39 ms** | 0.013 ms |

CPU cost is linear; GPU submit cost is flat. **The crossover is around 250k, not
50k.** At 50,000 particles a plain `Float32Array` loop costs 0.66 ms — 4% of a
60Hz frame. There is no bottleneck to relieve at that scale, and a demo built
around relieving it would be theatre.

### A/B: press `B`

Both arms run the **identical force law**. The only difference is how the result
reaches the screen.

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

**200× the particles at 3.6× the frame rate**, and the main thread goes from
essentially every millisecond spent inside a blocking long task to zero.

The naive arm is not a strawman in its arithmetic — it calls the same
`integrateCPU`. What it does differently is what most dashboards do: one DOM
element per entity positioned with `left`/`top`, and a sidebar rebuilt from a
template string every frame.

### What the disc cooling slider actually trades

Cooling is radial-velocity retention per step: it is the dissipation that keeps
Toomre Q low enough for the disc to amplify its own density contrast into arms.
It is also, unavoidably, what lets material sink to the centre. Measured over
40 s of headless integration:

| cooling | late A(m=2) | mass drained to core | disc remaining |
| --- | --- | --- | --- |
| 0.985 (cold) | 2.2e-1 | 36.5% | 60% |
| 0.990 | 8.2e-2 | 24.8% | 69% |
| 0.995 (default) | 3.7e-2 | 8.0% | 86% |

A colder disc makes arms roughly six times stronger and eats itself doing it.
This is the same axis real galaxies sit on: few strong arms is grand-design,
many faint ones is flocculent, and only about a tenth of observed spirals are
the former — those nearly always have a driver, a companion or a bar. The low
end of the slider is deliberately unsustainable, and the default is the setting
that still looks like a galaxy several minutes in.

### What the self-gravity costs

Measured by A/B against Chladni mode, which runs the same population and the
same fill rate with no mesh passes at all.

| particles | with self-gravity | without | delta |
| --- | --- | --- | --- |
| 100,000 | 16.7 ms | 16.7 ms | vsync-capped, free |
| 500,000 | 16.8 ms | 16.7 ms | vsync-capped, free |
| 1,000,000 | 20.2 ms | 16.8 ms | **3.4 ms** |

Up to 500k the whole solver is free. At 1M it costs 3.4 ms — and the reason that
pushes the frame over budget is that the *base* 1M render was already sitting at
16.8 ms on this GPU before any physics was added.

Three results from tuning it, none of which were the expected one:

- **Grid resolution has an optimum, and it is not as coarse as possible.**
  Self-gravity cost 4.3 ms at 32^2, **3.4 ms at 64^2**, and 49.6 ms at 128^2. The
  coarse grid is *slower* despite a 16x cheaper convolution.
- **Cloud-in-cell deposition with four atomics per particle beats nearest-cell
  with one, 3.4 ms against 8.6 ms.** The pass is bound by contention, not
  throughput: an exponential disc aims an enormous share of the population at a
  few central cells, and CIC divides that queue four ways. This is also why the
  coarser grid loses.
- **Privatizing the deposit into per-workgroup tiles — the textbook fix for
  atomic contention — made it worse**, 4.0 ms against 3.4 ms. It does cut global
  atomic traffic by well over an order of magnitude, but collapsing a million
  independent threads into sixty-odd workgroups costs more than the contention
  did. Measured, lost, removed.

## Known Issues

- **The WebGL2 fallback does not run self-gravity.** Transform feedback has no
  atomics and no shared memory, so the mesh would have to be built by splatting
  points into a float framebuffer and solved in a second full-screen pass. Until
  that is written, the fallback is the old fixed-potential galaxy and decays to a
  smooth disc as described above. Everything else — seeding profile, constants,
  cooling control, framing — is kept in sync, so the difference is exactly the
  one term. It also has no HDR path, so it clips.
- At 1M the GPU arm runs ~19-20 ms on this integrated GPU rather than a clean
  16.7. `?n=500000` is a locked 60 fps with self-gravity and looks near-identical,
  since per-particle gain is normalized by population.
- fps is vsync-capped at 60, so the GPU's actual headroom below 1M is unmeasured.
  A `timestamp-query` pass would show it, and would also split the mesh passes
  apart instead of measuring them as a block.
- The disc slowly drains toward the centre: mass inside r<0.1 climbs from 5% to
  about 14% over 60 s. Radius-dependent cooling would counter it.

## Running it

```bash
npm install && npm run dev
```

Controls: `M` switches simulation mode, `B` switches arm, click the species
chips to filter, drag the **disc cooling** slider to change how sharply the arms
resolve, move the cursor to perturb the field. `B` compares within whichever
mode is active, so both arms always run the same force law — including the mesh
self-gravity, which the CPU reference implements at the same grid resolution.

## Deploying (self-hosted)

Fully static — no server, no runtime, no API. `npm run build` emits three files
totalling ~45 kB (15 kB gzipped JS) into `dist/`. Copy that directory to your
web root. Verified by serving the built output and confirming numbers identical
to the dev server.

**Serve it over HTTPS.** This is the one that will bite you. WebGPU requires a
secure context, so over plain `http://` on a LAN address every visitor silently
falls back to the WebGL2 path — it still works, but you lose the compute-shader
headline. `localhost` is exempt; a LAN IP is not. `file://` fails outright,
because ES module imports are blocked too.

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

No SPA rewrite rule is needed — it is a single page and the query parameters are
read client-side. No COOP/COEP headers either, since nothing here uses
`SharedArrayBuffer`. Just confirm your server sends a JavaScript MIME type for
`.js`, or the module script will refuse to execute.

If you serve from a subdirectory rather than the root, build with
`BASE_PATH=/subdir/ npm run build`. (In Git Bash on Windows, MSYS mangles a
leading-slash value into a Windows path — use `MSYS_NO_PATHCONV=1` there.)

Query parameters:

- `?n=250000` — entity count (default 1,000,000)
- `?backend=webgl2` — force the transform-feedback fallback

## Verification

The sim can be driven and inspected without relying on rAF:

```js
const { backend, sim, integrateCPU } = window.__demo;
const before = await backend.readback(0, 4);
for (let i = 0; i < 120; i++) backend.frame(1 / 60, 0.4, 0.2);
const after = await backend.readback(0, 4);
```

The self-gravity solver can be checked against an independent implementation
rather than by eye — `dumpGrid()` returns the density mesh and the force field
solved from it. Total mass should come back as `M_DISC` exactly, and the field
should point inward everywhere outside the core:

```js
const g = await window.__demo.backend.dumpGrid();
let total = 0;
for (const d of g.dens) total += d * g.massScale;   // -> 0.18
```

## Layout

| file | role |
| --- | --- |
| `src/hud.ts` | Instrumentation. Allocation-free; built before anything else. |
| `src/sim/world.ts` | Particle buffer, entity tags, shared constants, CPU reference integration including the mesh solver. |
| `src/render/webgpu.ts` | Compute + instanced render over one shared buffer. |
| `src/render/webgl2.ts` | Transform-feedback fallback, same force law. |
| `src/ui/list.ts` | Virtualized list + bounded windowed readback. |
| `src/ui/state.ts` | Signals, scoped to interaction-driven state only. |
