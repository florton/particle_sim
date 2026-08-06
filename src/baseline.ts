/**
 * The naive arm.
 *
 * This is what the same scene looks like built the way most dashboards are:
 * every particle is a real DOM element, positioned with `left`/`top`, and the
 * sidebar is rebuilt from a template string on every frame.
 *
 * It is deliberately *not* a strawman in its arithmetic — it runs the identical
 * force law from `integrateCPU`. The difference measured here is purely the cost
 * of the presentation strategy, which is the only honest comparison to draw.
 *
 * It runs at a far lower particle count than the GPU arm because at parity it
 * simply never paints a frame. The HUD shows both counts side by side; the point
 * of the toggle is that the naive arm struggles at 1/200th the workload.
 */

import {
  integrateCPU,
  integrateChladniCPU,
  integrateCollisionCPU,
  chladniWarp,
  reseed,
  STRIDE,
  SPECIES_NAMES,
  SPECIES_COLORS,
  type Sim,
} from './sim/world';
import type { PairState } from './sim/pair';

/** Even this is generous — 5000 absolutely-positioned nodes is already a lot. */
export const BASELINE_COUNT = 5_000;
const BASELINE_ROWS = 400;

export class BaselineArm {
  private layer: HTMLElement;
  private nodes: HTMLElement[] = [];
  private listHost: HTMLElement;
  private active = false;
  private mode = 0;
  private elapsed = 0;
  private pair?: PairState;

  constructor(
    private sim: Sim,
    parent: HTMLElement,
    sidebar: HTMLElement,
    /** Hidden while this arm runs; it owns the virtualized pool. */
    private gpuViewport: HTMLElement,
  ) {
    this.layer = document.createElement('div');
    this.layer.id = 'baseline-layer';
    parent.appendChild(this.layer);

    // Its own host: writing innerHTML into the virtualized viewport would
    // destroy the recycled node pool that arm depends on.
    this.listHost = document.createElement('div');
    this.listHost.id = 'baseline-list';
    sidebar.appendChild(this.listHost);
  }

  get count() {
    return BASELINE_COUNT;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.layer.style.display = 'block';
    this.listHost.style.display = 'block';
    this.gpuViewport.style.display = 'none';

    for (let i = 0; i < BASELINE_COUNT; i++) {
      const d = document.createElement('div');
      d.className = 'bp';
      const [r, g, b] = SPECIES_COLORS[this.sim.species[i]];
      d.style.background = `rgb(${(r * 255) | 0} ${(g * 255) | 0} ${(b * 255) | 0})`;
      this.layer.appendChild(d);
      this.nodes.push(d);
    }
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.layer.style.display = 'none';
    this.layer.replaceChildren();
    this.nodes.length = 0;
    this.listHost.innerHTML = '';
    this.listHost.style.display = 'none';
    this.gpuViewport.style.display = '';
  }

  get domNodes() {
    return this.active ? this.nodes.length + BASELINE_ROWS : 0;
  }

  /** Re-seed for the mode being compared, so both arms start from like states. */
  setMode(mode: number, pair?: PairState) {
    this.mode = mode;
    this.elapsed = 0;
    this.pair = pair;
    reseed(this.sim, BASELINE_COUNT, mode, pair);
  }

  frame(dt: number, mx: number, my: number, gCursor?: number) {
    if (!this.active) return;

    this.elapsed += dt;
    const saved = this.sim.count;
    this.sim.count = BASELINE_COUNT;
    if (this.mode === 2 && this.pair) {
      integrateCollisionCPU(this.sim, dt, mx, my, this.pair, gCursor);
    } else if (this.mode === 1) {
      const { n, m } = chladniWarp(mx, my, this.elapsed);
      integrateChladniCPU(this.sim, dt, n, m, this.elapsed);
    } else {
      // Elapsed drives the bar's phase — without it the pattern stands still and
      // this arm runs a different force law from the one it is being compared to.
      integrateCPU(this.sim, dt, mx, my, this.elapsed, gCursor);
    }
    this.sim.count = saved;

    const w = innerWidth;
    const h = innerHeight;
    const p = this.sim.particles;
    // Same camera as the GPU arm — the collision is drawn pulled back, and an arm
    // that framed it differently would not be showing the same scene.
    const s = this.mode === 2 ? 0.55 : 1;

    // The classic mistake: writing layout-triggering properties per node, per
    // frame. Each assignment invalidates layout for the whole layer.
    for (let i = 0; i < BASELINE_COUNT; i++) {
      const o = i * STRIDE;
      const node = this.nodes[i];
      node.style.left = ((p[o] * s * 0.5 + 0.5) * w).toFixed(1) + 'px';
      node.style.top = ((-p[o + 1] * s * 0.5 + 0.5) * h).toFixed(1) + 'px';
    }

    // And the other classic mistake: rebuilding the list markup every frame.
    let html = '';
    for (let i = 0; i < BASELINE_ROWS; i++) {
      const o = i * STRIDE;
      const v = Math.min(1, Math.hypot(p[o + 2], p[o + 3]) * 0.22);
      html +=
        `<div class="row"><span class="id">${i}</span>` +
        `<span class="sp">${SPECIES_NAMES[this.sim.species[i]]}</span>` +
        `<span class="v">${v.toFixed(4)}</span></div>`;
    }
    this.listHost.innerHTML = html;
  }
}
