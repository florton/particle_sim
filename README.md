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
  - **Orbital galaxy** — particles seeded at circular-orbit velocity around a
    cursor-following attractor with a repulsive core. Spiral arms are emergent,
    not authored.
  - **Chladni plate** — particles descend the gradient of a standing wave onto
    its nodal lines, the way sand does on a vibrating plate. Each species gets
    its own `(n, m)` frequency pair, so six figures resolve at once in six
    colours, and the cursor warps the frequencies live. Analytic gradient, so
    it stays O(n) with no neighbour search.
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
| particles | **1,000,000** | 4,000 |
| fps | **58** | 16 |
| p50 frame time | **16.70 ms** | 66.60 ms |
| p99 frame time | **33.40 ms** | 199.90 ms |
| dropped frames | 3.9% | **98.9%** |
| blocking long tasks | **0 / 0 ms** | 93 / 5,746 ms |
| live DOM nodes | **33** | 4,400 |
| reactive effect runs | 1 per 650 frames | 1 per 94 frames |

**250× the particles at 3.6× the frame rate**, and the main thread goes from
5.7 seconds of blocking long tasks to zero.

The naive arm is not a strawman in its arithmetic — it calls the same
`integrateCPU`. What it does differently is what most dashboards do: one DOM
element per entity positioned with `left`/`top`, and a sidebar rebuilt from a
template string every frame.

Honest caveat: the GPU arm's p99 of 33.40 ms is a dropped frame, not a clean
16.7. It sits at 4–10% depending on capture load. The p50 is rock solid; the tail
is not perfect, and the HUD is built to show that rather than hide it.

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

**"A HUD makes the demo trustworthy."** Only if the HUD is right. This one
reported *99.4% dropped frames* next to a healthy 16.80 ms p50 — because `reset()`
did not clear the observed-fastest-frame floor, and one sub-millisecond rAF
delivery during an arm switch permanently redefined the refresh interval to ~1 ms.
Instrumentation is code and has bugs like any other code. `src/hud.ts` now floors
refresh calibration at 4 ms and clears it on reset.

## Known issues

- **The particles still do not interact with each other.** Both modes are
  field-driven: every particle reads a function of its own position and nothing
  else. The structures are real (orbital mechanics; genuine nodal lines of a
  standing wave) but there are no particle-particle forces. Naive N-body at 1M is
  10¹² pairs and impossible; a GPU density-field pass — scatter into a coarse
  grid with atomics, then sample the neighbourhood — is O(n) and would give
  genuine emergent clustering. That is the next feature.
- fps is vsync-capped at 60, so the GPU's actual headroom at 1M is unmeasured.
  A `timestamp-query` pass would show it.
- p99 on the GPU arm is a dropped frame (33.40 ms), not a clean 16.7.

## Running it

```bash
npm install && npm run dev
```

Controls: `M` switches simulation mode, `B` switches arm, click the species
chips to filter, move the cursor to drive the field.

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
