import type { PairState } from '../sim/pair';

/** Hard cap on a single readback window, in particles. */
export const READBACK_MAX = 4096;

/** Uniform surface over the WebGPU and WebGL2 paths. */
export interface Backend {
  /** Short id shown in the HUD: 'webgpu' | 'webgl2'. */
  name: string;
  /** Adapter/renderer string, so the numbers are attributable to hardware. */
  detail: string;
  setCount(n: number): void;
  /**
   * Bitmask of visible species. Filtering a million particles is a uniform bit
   * test per vertex on the GPU — the CPU never walks the population to do it.
   */
  setSpeciesMask(mask: number): void;
  /**
   * 0 = orbital galaxy, 1 = Chladni plate, 2 = galaxy collision. Re-seeds the
   * population for the mode, so calling it again is also how a collision is
   * restarted.
   */
  setMode(mode: number): void;
  /**
   * The two colliding cores. Read every frame in mode 2 and at seeding time;
   * ignored otherwise. The backend keeps the reference, so the caller may hold
   * one object and mutate it.
   */
  setPair(pair: PairState): void;
  /**
   * Mass of the cursor secondary, in units of the core. Held pointer = heavy
   * enough to raise real tidal tails; released = a light perturber the disc can
   * recover from. Set on pointer transitions, not per frame.
   */
  setCursorMass(m: number): void;
  frame(dt: number, mx: number, my: number): void;
  resize(w: number, h: number): void;
  destroy(): void;
  /**
   * Pull `count` particles starting at `offset` back to the CPU.
   *
   * Bounded on purpose: the caller may only ask for a small window (see
   * READBACK_MAX). Copying the whole buffer every frame would undo the entire
   * point of keeping the data GPU-resident, so the API makes that awkward.
   * Returns a view over a reused staging buffer — copy it if you need to keep it.
   */
  readback?(offset: number, count: number): Promise<Float32Array>;
}
