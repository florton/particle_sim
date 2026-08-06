# 1,000,000 particles — WebGPU compute + virtualized DOM

A browser performance demo built to survive someone opening DevTools.

Every number below was measured on the machine that built it, not estimated.
Where a claim didn't survive measurement, the claim was changed rather than the
measurement.

## What it does

- **1,000,000 particles**, integrated in a WebGPU compute shader, drawn in one
  instanced call. Particle data is uploaded once and never returns to the CPU on
  the render path.
- **Three simulation modes**, `M` to cycle:
  - **Barred galaxy** — a fixed primary at the origin holds the disc, and a
    rotating m=2 quadrupole drives it. The bar is the point: without a driving
    frequency this disc has no self-gravity to hold an arm together, so anything
    you stir into it shears out and phase-mixes into a featureless blur within
    seconds. With one, orbits that resonate with the pattern are herded onto
    closed orbits and stay — rings near the Lindblad resonances, arms between
    them — and structure becomes the resting state rather than the decay product.
    Each of the six species keeps its own annulus, so the disc reads as six
    coloured rings being worked on individually rather than as one grey average.
    Hold the pointer down to make the cursor a near-core mass and tear it up.
  - **Galaxy collision** — two cores on a parabolic encounter, solved as a
    two-body problem on the CPU; every particle is a massless test particle in
    the sum of their fields. This is Toomre & Toomre's 1972 restricted three-body
    model, and the tidal tails and the bridge fall out of it for free. `R`
    restarts with the disc spin flipped: the same encounter throws a tail half
    the frame long prograde and barely marks the disc retrograde. Each disc is
    seeded as six coloured rings, so the tail arrives sorted by where it came
    from.
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

Intel Gen-9 integrated GPU, Chromium, 60Hz display, 1182×877 backbuffer.

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

## Known Issues

- fps is vsync-capped at 60, so the GPU's actual headroom at 1M is unmeasured.
  A `timestamp-query` pass would show it.
- p99 on the GPU arm is a dropped frame (33.40 ms), not a clean 16.7.

## Running it

```bash
npm install && npm run dev
```

Controls: `M` cycles simulation mode, `B` switches arm, `R` restarts the
collision with the spin flipped, click the species chips to filter, move the
cursor to drive the field and hold the pointer down to make it heavy. `B`
compares within whichever mode is active, so both arms always run the same force
law.

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

## Layout

| file | role |
| --- | --- |
| `src/hud.ts` | Instrumentation. Allocation-free; built before anything else. |
| `src/sim/world.ts` | Particle buffer, entity tags, CPU reference integration. |
| `src/sim/pair.ts` | The two colliding cores — a two-body problem, and nothing else. |
| `src/render/webgpu.ts` | Compute + instanced render over one shared buffer. |
| `src/render/webgl2.ts` | Transform-feedback fallback, same force law. |
| `src/ui/list.ts` | Virtualized list + bounded windowed readback. |
| `src/ui/state.ts` | Signals, scoped to interaction-driven state only. |
