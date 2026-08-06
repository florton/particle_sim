# 1,000,000 particles — WebGPU compute + virtualized DOM

A browser performance demo built to survive someone opening DevTools.

Every number below was measured on the machine that built it, not estimated.
Where a claim didn't survive measurement, the claim was changed rather than the
measurement.

## What it does

- **1,000,000 particles**, integrated in a WebGPU compute shader, drawn in one
  instanced call. Particle data is uploaded once and never returns to the CPU on
  the render path.
- **A sidebar over all 1,000,000 rows** that keeps ~33 `<div>`s alive.
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

### Steady state at 1,000,000

| metric | value |
| --- | --- |
| p50 frame time | 16.70 ms (vsync-locked) |
| p99 frame time | 17.00–17.20 ms |
| dropped frames | 0.5–1.5% |
| live DOM nodes | 33 |
| reactive effect runs | 1 per ~200 frames |

## Things that turned out to be false

Kept here because the corrections are the interesting part.

**"Signals make the render loop fast."** They don't, and they can't. Signals skip
work when inputs are unchanged; a particle sim changes every input every frame,
so a dependency graph over it is pure bookkeeping. Signals here drive only the
species filter and selection. The HUD's `effects / frames` row exists to prove
the distinction is real — it reads `1 / 200` in steady state, not `200 / 200`.

**"Ten thousand DOM rows proves performance."** It proves brute force. This
renders ~33 rows and recycles them, which is faster and is also the only version
that survives a million-row dataset. Nobody can see 10,000 rows.

**"Reading back from the GPU is cheap if the window is small."** The *copy* is
cheap; the `mapAsync` sync point is not. Issuing one per frame cost roughly half
the frame rate — 19.7% dropped frames. Throttled to ~12 Hz, drops fell to ~0.5%
with no perceptible change, because a human cannot read a number that updates at
60 Hz anyway. See `src/ui/list.ts`.

**"An empty console means the GPU pipeline is fine."** WebGPU reports most
validation failures asynchronously. A render bind group that omitted
`FRAGMENT` visibility on a uniform read by the fragment stage produced a black
canvas, a healthy compute pass, and total console silence. `webgpu.ts` now
installs an `uncapturederror` listener at device creation.

## Known issues

- **~650 ms long task at startup.** Creating 1M bitecs entities dominates boot.
  The ECS layer is not earning its cost here: species and stat are already plain
  typed arrays indexed by entity id, and nothing queries relationally. Removing
  bitecs from the hot set is the obvious next change.
- **The A/B baseline arm is not built yet** (see below). Until it is, the demo
  shows good numbers without showing what they're better *than*.
- fps is vsync-capped at 60, so the GPU's actual headroom at 1M is unmeasured.
  A `timestamp-query` pass would show it.

## Running it

```bash
npm install && npm run dev
```

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
| `src/render/webgpu.ts` | Compute + instanced render over one shared buffer. |
| `src/render/webgl2.ts` | Transform-feedback fallback, same force law. |
| `src/ui/list.ts` | Virtualized list + bounded windowed readback. |
| `src/ui/state.ts` | Signals, scoped to interaction-driven state only. |
