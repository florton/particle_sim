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
  RADIAL_DAMP,
  integrateChladniCPU,
  chladniWarp,
  reseedGalaxy,
  scatterPlate,
  STRIDE,
  SPECIES_NAMES,
  SPECIES_COLORS,
  type Sim,
} from './sim/world';
import * as barred from './sim/barred';
import * as classic from './sim/classic';
import { BARRED, CHLADNI, CLASSIC, COLLISION } from './sim/modes';
import { createPair, type PairState } from './sim/pair';
import { cameraTilt, cameraZoom } from './render/backend';

/** Even this is generous — 5000 absolutely-positioned nodes is already a lot. */
export const BASELINE_COUNT = 5_000;
const BASELINE_ROWS = 400;

export class BaselineArm {
  private cooling = RADIAL_DAMP;
  private mono = false;
  private tilted = false;
  private layer: HTMLElement;
  private nodes: HTMLElement[] = [];
  private listHost: HTMLElement;
  private active = false;
  private mode = 0;
  private elapsed = 0;
  /** Replaced by setMode() before the collision is ever compared. */
  private pair: PairState = createPair();

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
      d.style.background = this.nodeColor(i);
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

  /** Mirrors the GPU arm's cooling control, so the two stay comparable. */
  setCooling(v: number) {
    this.cooling = v;
  }

  /** Mirrors the GPU arm's view toggle, so the two arms frame alike. */
  setTilt(v: boolean) {
    this.tilted = v;
  }

  /** Mirrors the GPU arm's palette toggle. */
  setMono(v: boolean) {
    this.mono = v;
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].style.background = this.nodeColor(i);
    }
  }

  private nodeColor(i: number) {
    if (this.mono) return 'rgb(219 227 255)';
    const [r, g, b] = SPECIES_COLORS[this.sim.species[i]];
    return `rgb(${(r * 255) | 0} ${(g * 255) | 0} ${(b * 255) | 0})`;
  }

  /** Re-seed for the mode being compared, so both arms start from like states. */
  setMode(mode: number, pair: PairState) {
    this.mode = mode;
    this.pair = pair;
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    // Species is left alone: it belongs to the GPU arm's population, which is
    // still the one the sidebar and the chips are reading.
    switch (this.mode) {
      case CHLADNI: scatterPlate(this.sim, BASELINE_COUNT); break;
      case BARRED: barred.reseedDisc(this.sim, BASELINE_COUNT); break;
      case COLLISION: barred.reseedCollision(this.sim, BASELINE_COUNT, this.pair); break;
      case CLASSIC: classic.reseed(this.sim, BASELINE_COUNT); break;
      default: reseedGalaxy(this.sim, BASELINE_COUNT);
    }
  }

  /**
   * `grav` is the self-gravitating disc's ramped cursor multiplier; `cursorMass`
   * is the fixed-potential modes' switched cursor mass. Each mode reads the one
   * that belongs to it — see sim/modes.ts.
   */
  frame(dt: number, mx: number, my: number, grav = 1, cursorMass = barred.G_CURSOR) {
    if (!this.active) return;

    this.elapsed += dt;
    const saved = this.sim.count;
    this.sim.count = BASELINE_COUNT;
    switch (this.mode) {
      case CHLADNI: {
        const { n, m } = chladniWarp(mx, my, this.elapsed);
        integrateChladniCPU(this.sim, dt, n, m, this.elapsed);
        break;
      }
      case BARRED:
        barred.integrateCPU(this.sim, dt, mx, my, this.elapsed, cursorMass);
        break;
      case COLLISION:
        barred.integrateCollisionCPU(this.sim, dt, mx, my, this.pair, cursorMass);
        break;
      case CLASSIC:
        classic.integrateCPU(this.sim, dt, mx, my);
        break;
      default:
        integrateCPU(this.sim, dt, mx, my, this.cooling, grav);
    }
    this.sim.count = saved;

    const w = innerWidth;
    const h = innerHeight;
    const p = this.sim.particles;

    // The same camera the GPU arm uses, arithmetic for arithmetic.
    //
    // This used to map straight onto innerWidth/innerHeight, which stretches x
    // and y independently and draws every circular orbit as an ellipse. That was
    // survivable while the GPU arm did the same thing, and stopped being
    // survivable when it started framing properly: the two arms were then
    // drawing different shapes, and a comparison whose halves disagree about the
    // picture is not measuring what it claims to. The cost here is four
    // multiplies outside the loop -- nothing that could flatter this arm.
    const a = w / h;
    const z = cameraZoom(this.mode, a, this.tilted);
    const t = cameraTilt(this.mode, this.tilted);
    const fx = (z / Math.max(a, 1)) * 0.5;
    const fy = (z * Math.min(a, 1)) * 0.5 * t;

    // The classic mistake: writing layout-triggering properties per node, per
    // frame. Each assignment invalidates layout for the whole layer.
    for (let i = 0; i < BASELINE_COUNT; i++) {
      const o = i * STRIDE;
      const node = this.nodes[i];
      node.style.left = ((p[o] * fx + 0.5) * w).toFixed(1) + 'px';
      node.style.top = ((-p[o + 1] * fy + 0.5) * h).toFixed(1) + 'px';
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
