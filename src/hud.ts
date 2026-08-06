/**
 * Instrumentation HUD.
 *
 * Deliberately allocation-free on the hot path: every buffer below is sized once
 * at construction and written in place. If this file allocated per frame it would
 * contaminate the exact measurement it exists to report.
 */

const SAMPLES = 240; // ~2s at 120Hz
const SPARK_W = 240;
const SPARK_H = 40;

/** Sorted scratch buffer for percentiles, reused every readout. */
const scratch = new Float32Array(SAMPLES);

export interface HudCounters {
  /** Entities being simulated this frame. */
  entities: number;
  /** Live DOM nodes in the list (not total rows). */
  domNodes: number;
  /** Which arm is running. */
  arm: string;
  /** Compute backend actually in use. */
  backend: string;
  /** Total reactive-effect executions since load. Should stay flat while frames climb. */
  effectRuns: number;
}

export class Hud {
  private root: HTMLElement;
  private spark: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;

  private readonly frames = new Float32Array(SAMPLES);
  private head = 0;
  private filled = 0;

  private last = performance.now();
  private dropped = 0;
  private total = 0;
  private longTasks = 0;
  private longTaskMs = 0;

  /** Refresh interval in ms, estimated from the fastest frames observed. */
  private refreshMs = 16.67;
  private fastest = Infinity;

  private textEls: Record<string, HTMLElement> = {};
  private lastPaint = 0;

  constructor(mount: HTMLElement) {
    this.root = mount;
    this.root.innerHTML = '';

    this.spark = document.createElement('canvas');
    this.spark.width = SPARK_W * devicePixelRatio;
    this.spark.height = SPARK_H * devicePixelRatio;
    this.spark.style.width = SPARK_W + 'px';
    this.spark.style.height = SPARK_H + 'px';
    this.spark.className = 'hud-spark';
    this.root.appendChild(this.spark);

    const ctx = this.spark.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable for HUD sparkline');
    this.sctx = ctx;
    this.sctx.scale(devicePixelRatio, devicePixelRatio);

    for (const key of [
      'fps',
      'p50',
      'p99',
      'dropped',
      'longtask',
      'heap',
      'entities',
      'dom',
      'effects',
      'backend',
      'arm',
    ]) {
      const row = document.createElement('div');
      row.className = 'hud-row';
      const label = document.createElement('span');
      label.className = 'hud-label';
      label.textContent = key;
      const val = document.createElement('span');
      val.className = 'hud-val';
      val.textContent = '—';
      row.append(label, val);
      this.root.appendChild(row);
      this.textEls[key] = val;
    }

    this.observeLongTasks();
  }

  /**
   * Long tasks are the honest measure of main-thread health. A demo can hold 120fps
   * on the compositor while the main thread is unusable; this catches that.
   */
  private observeLongTasks() {
    if (!('PerformanceObserver' in window)) return;
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      this.textEls['longtask'].textContent = 'unsupported';
      return;
    }
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.longTasks++;
        this.longTaskMs += entry.duration;
      }
    });
    obs.observe({ entryTypes: ['longtask'] });
  }

  /** Call once per rAF, before any simulation work. */
  frame(now: number) {
    const dt = now - this.last;
    this.last = now;
    this.total++;

    // Ignore the first frame and any tab-restore spike.
    if (dt > 0 && dt < 1000) {
      this.frames[this.head] = dt;
      this.head = (this.head + 1) % SAMPLES;
      if (this.filled < SAMPLES) this.filled++;

      // Calibrate from the observed floor, but never grade on a curve: if the
      // demo never once reaches 60Hz, the budget stays 60Hz rather than quietly
      // redefining "on time" as whatever this machine happens to manage.
      //
      // The >= 4ms guard matters. rAF occasionally delivers two callbacks a
      // fraction of a millisecond apart (arm switches, tab restore). Treating
      // that as the refresh interval sets the drop threshold near zero and every
      // subsequent frame is reported as dropped — a 99% drop rate sitting next
      // to a healthy 16.8ms p50, which is how this was caught.
      if (dt < this.fastest && dt >= 4) this.fastest = dt;
      this.refreshMs = Math.min(this.fastest, 1000 / 60);
      if (dt > this.refreshMs * 1.5) this.dropped++;
    }
  }

  /** Repaint the HUD at 5Hz — repainting per frame would itself cost frames. */
  paint(now: number, counters: HudCounters) {
    if (now - this.lastPaint < 200) return;
    this.lastPaint = now;

    const n = this.filled;
    if (n === 0) return;

    scratch.set(this.frames.subarray(0, n));
    const view = scratch.subarray(0, n);
    view.sort();

    const p50 = view[(n * 0.5) | 0];
    const p99 = view[Math.min(n - 1, (n * 0.99) | 0)];

    let sum = 0;
    for (let i = 0; i < n; i++) sum += view[i];
    const mean = sum / n;

    this.textEls['fps'].textContent = (1000 / mean).toFixed(0);
    this.textEls['p50'].textContent = p50.toFixed(2) + ' ms';
    this.textEls['p99'].textContent = p99.toFixed(2) + ' ms';
    this.setWarn(this.textEls['p99'], p99 > this.refreshMs * 1.5);

    const dropPct = this.total > 0 ? (this.dropped / this.total) * 100 : 0;
    this.textEls['dropped'].textContent = `${this.dropped} (${dropPct.toFixed(1)}%)`;
    this.setWarn(this.textEls['dropped'], dropPct > 1);

    if (this.textEls['longtask'].textContent !== 'unsupported') {
      this.textEls['longtask'].textContent = `${this.longTasks} / ${this.longTaskMs.toFixed(0)} ms`;
      this.setWarn(this.textEls['longtask'], this.longTasks > 0);
    }

    // Non-standard, Chromium-only, and gated behind isolation in some builds.
    const mem = (performance as any).memory;
    this.textEls['heap'].textContent = mem
      ? (mem.usedJSHeapSize / 1048576).toFixed(1) + ' MB'
      : 'n/a';

    this.textEls['entities'].textContent = counters.entities.toLocaleString();
    this.textEls['dom'].textContent = counters.domNodes.toLocaleString();
    // Frames vs effects side by side is the honest version of "signals are fast":
    // they are fast here because they run ~never, not because the graph is quick.
    this.textEls['effects'].textContent = `${counters.effectRuns} / ${this.total} frames`;
    this.textEls['backend'].textContent = counters.backend;
    this.textEls['arm'].textContent = counters.arm;

    this.drawSpark();
  }

  private setWarn(el: HTMLElement, warn: boolean) {
    // Assigning the same string is a no-op in Blink; no need to guard.
    el.className = warn ? 'hud-val warn' : 'hud-val';
  }

  private drawSpark() {
    const ctx = this.sctx;
    const budget = this.refreshMs;
    // Scale so the frame budget sits at 1/2 height; spikes above are visible.
    const scale = SPARK_H / (budget * 2);

    ctx.clearRect(0, 0, SPARK_W, SPARK_H);

    ctx.strokeStyle = 'rgba(120,200,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, SPARK_H - budget * scale);
    ctx.lineTo(SPARK_W, SPARK_H - budget * scale);
    ctx.stroke();

    ctx.strokeStyle = '#6cf';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const n = this.filled;
    const step = SPARK_W / SAMPLES;
    for (let i = 0; i < n; i++) {
      // Walk oldest -> newest through the ring.
      const idx = (this.head - n + i + SAMPLES * 2) % SAMPLES;
      const y = SPARK_H - Math.min(SPARK_H, this.frames[idx] * scale);
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /** Reset counters when switching arms so the comparison is clean. */
  reset() {
    this.frames.fill(0);
    this.head = 0;
    this.filled = 0;
    this.dropped = 0;
    this.total = 0;
    this.longTasks = 0;
    this.longTaskMs = 0;
    this.last = performance.now();
    // Must reset too, or a stale floor from the previous arm silently sets the
    // budget for the next one.
    this.fastest = Infinity;
    this.refreshMs = 1000 / 60;
  }
}
