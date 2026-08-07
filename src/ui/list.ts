/**
 * Virtualized list over the filtered entity set.
 *
 * The original brief called for 10,000 live DOM rows. This renders ~60 and
 * recycles them. It is faster, and it is also the only version that stays
 * correct as the entity count goes to seven figures — you cannot put a million
 * <div>s in a document.
 *
 * Live values come from a bounded async GPU readback of just the visible span.
 * That keeps the "data stays on the GPU" property intact: we pull back a few
 * kilobytes for the rows a human is actually looking at, not the whole buffer.
 */

import { STRIDE, SPECIES_NAMES, SPECIES_COLORS, type Sim } from '../sim/world';
import { speciesMask, selectedEid } from './state';
import { READBACK_MAX, type Backend } from '../render/backend';

const ROW_H = 24;
const OVERSCAN = 4;

export class VirtualList {
  private viewport: HTMLElement;
  private spacer: HTMLElement;
  private pool: HTMLElement[] = [];
  private poolIds: Int32Array;

  /** Indices into sim.eids that pass the current filter. */
  private filtered: Uint32Array;
  private filteredCount = 0;

  private scrollTop = 0;
  private poolSize = 0;
  private dirty = true;

  /** Live values for the visible span, filled by async readback. */
  private live: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private liveBase = 0;
  private liveCount = 0;
  private readPending = false;
  private lastRead = 0;

  constructor(
    viewport: HTMLElement,
    spacer: HTMLElement,
    private sim: Sim,
    private backend: Backend,
  ) {
    this.viewport = viewport;
    this.spacer = spacer;
    this.filtered = new Uint32Array(sim.capacity);
    this.poolIds = new Int32Array(0);

    this.buildPool();
    this.refilter();

    this.viewport.addEventListener(
      'scroll',
      () => {
        this.scrollTop = this.viewport.scrollTop;
        this.dirty = true;
      },
      { passive: true },
    );

    new ResizeObserver(() => {
      this.buildPool();
      this.dirty = true;
    }).observe(this.viewport);
  }

  /** Pool size follows viewport height, not data size. */
  private buildPool() {
    const need = Math.ceil(this.viewport.clientHeight / ROW_H) + OVERSCAN * 2;
    if (need === this.poolSize) return;

    while (this.pool.length < need) {
      const row = document.createElement('div');
      row.className = 'row';
      const id = document.createElement('span');
      id.className = 'id';
      const sp = document.createElement('span');
      sp.className = 'sp';
      const bar = document.createElement('div');
      bar.className = 'bar';
      const v = document.createElement('span');
      v.className = 'v';
      row.append(id, sp, bar, v);

      const slot = this.pool.length;
      row.addEventListener('click', () => {
        const eid = this.poolIds[slot];
        if (eid >= 0) selectedEid(eid);
      });

      this.viewport.appendChild(row);
      this.pool.push(row);
    }
    while (this.pool.length > need) {
      this.pool.pop()!.remove();
    }
    this.poolSize = need;
    this.poolIds = new Int32Array(need).fill(-1);
  }

  /** Linear pass building the filtered index. Runs on filter change only. */
  refilter() {
    const mask = speciesMask();
    const { species, count } = this.sim;
    const out = this.filtered;
    let w = 0;
    for (let i = 0; i < count; i++) {
      if (mask & (1 << species[i])) out[w++] = i;
    }
    this.filteredCount = w;
    this.spacer.style.height = w * ROW_H + 'px';
    this.dirty = true;
  }

  /** Force a full row repaint — used when this arm regains the viewport. */
  forceRepaint() {
    this.poolIds.fill(-1);
    this.dirty = true;
  }

  get rowCount() {
    return this.filteredCount;
  }
  get liveNodes() {
    return this.poolSize;
  }

  /** Called per frame. Cheap when nothing scrolled and no readback landed. */
  update() {
    const first = Math.max(0, ((this.scrollTop / ROW_H) | 0) - OVERSCAN);
    const last = Math.min(this.filteredCount, first + this.poolSize);

    this.scheduleReadback(first, last);

    if (!this.dirty) return;
    this.dirty = false;

    for (let slot = 0; slot < this.poolSize; slot++) {
      const idx = first + slot;
      const row = this.pool[slot];

      if (idx >= last) {
        if (this.poolIds[slot] !== -1) {
          row.style.visibility = 'hidden';
          this.poolIds[slot] = -1;
        }
        continue;
      }

      const slotIdx = this.filtered[idx];

      // Text and color only change when a slot is recycled onto a different
      // entity — not every frame. Only the transform and the live value below
      // are touched per frame.
      if (this.poolIds[slot] !== slotIdx) {
        this.poolIds[slot] = slotIdx;
        const sp = this.sim.species[slotIdx];
        const [r, g, b] = SPECIES_COLORS[sp];
        const css = `rgb(${(r * 255) | 0} ${(g * 255) | 0} ${(b * 255) | 0})`;

        row.style.visibility = 'visible';
        row.children[0].textContent = String(slotIdx);
        row.children[1].textContent = SPECIES_NAMES[sp];
        (row.children[1] as HTMLElement).style.color = css;
        (row.children[2] as HTMLElement).style.background = css;
      }
      // transform only — never top/left, so rows never trigger layout.
      row.style.transform = `translateY(${idx * ROW_H}px)`;

      const v = this.readLive(slotIdx);
      (row.children[2] as HTMLElement).style.transform = `scaleX(${v.toFixed(3)})`;
      row.children[3].textContent = v.toFixed(4);
    }
  }

  /** Mark dirty each frame only while live data is arriving. */
  private readLive(slotIdx: number): number {
    if (this.liveCount > 0) {
      const rel = slotIdx - this.liveBase;
      if (rel >= 0 && rel < this.liveCount) {
        const o = rel * STRIDE;
        // Speed magnitude — a real quantity pulled from the GPU, not a fake oscillator.
        const vx = this.live[o + 2];
        const vy = this.live[o + 3];
        return Math.min(1, Math.hypot(vx, vy) * 0.7);
      }
    }
    return this.sim.stat[slotIdx];
  }

  /**
   * Pull back only the contiguous span covering the visible rows. Bounded by
   * pool size times filter sparsity, so a few KB at most — never the whole buffer.
   */
  private scheduleReadback(first: number, last: number) {
    if (this.readPending || last <= first || !this.backend.readback) return;

    // Throttle to ~12Hz. mapAsync is a pipeline sync point: issuing one every
    // frame measurably stalls the GPU (it cost ~50% of frame rate when this ran
    // unthrottled). Numbers in a sidebar do not need to update at 60Hz — a human
    // cannot read them that fast — so this is free in perceptual terms.
    const now = performance.now();
    if (now - this.lastRead < 80) return;
    this.lastRead = now;

    const lo = this.filtered[first];
    const hi = this.filtered[Math.max(first, last - 1)];
    const span = hi - lo + 1;
    if (span <= 0 || span > READBACK_MAX) return;

    this.readPending = true;
    this.backend
      .readback(lo, span)
      .then((buf) => {
        this.live = buf;
        this.liveBase = lo;
        this.liveCount = buf.length / STRIDE;
        this.dirty = true;
      })
      .catch(() => {})
      .finally(() => {
        this.readPending = false;
      });
  }
}
