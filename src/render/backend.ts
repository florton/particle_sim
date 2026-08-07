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
   * Switch simulation. The mode ids are the ones in sim/modes.ts, and the
   * shaders switch on the same integers.
   *
   * Re-seeds the population for the mode, so calling it again is also how a
   * collision is restarted.
   */
  setMode(mode: number): void;
  /**
   * The two colliding cores. Read every frame in collision mode and at seeding
   * time; ignored otherwise. The backend keeps the reference, so the caller may
   * hold one object and mutate it.
   */
  setPair(pair: PairState): void;
  /**
   * Cursor mass for the fixed-potential modes, in their own units — held
   * pointer is heavy enough to raise tidal tails, released is a light perturber
   * the disc recovers from. Set on pointer transitions, not per frame.
   *
   * The self-gravitating disc does not use this: its hold ramps continuously
   * and arrives as `grav` on frame(). See sim/modes.ts for why the two differ.
   */
  setCursorMass(m: number): void;
  /**
   * Radial-velocity retention per step — how fast the disc sheds orbital
   * eccentricity, which is the same thing as how cold it stays.
   *
   * Exposed because it is the one constant that visibly changes what kind of
   * galaxy this is. A cold disc has a low Toomre Q and amplifies its own
   * density contrast into strong, defined arms; a hot one cannot hold an arm
   * together and goes smooth. Everything else in the force law changes how it
   * behaves, this changes what it looks like.
   */
  setCooling?(retention: number): void;
  /**
   * Re-seed the population for the current mode, without rebuilding anything.
   *
   * A self-gravitating disc has no steady state to return to — it slowly
   * transfers angular momentum outward and drains mass toward the center, and
   * left alone for long enough it will always end up more concentrated than it
   * started. That is correct physics rather than a defect, which is exactly why
   * there has to be a way to start it over.
   */
  /** Drop the species palette and render luminance only. */
  setMono?(mono: boolean): void;
  reset(): void;
  /**
   * Advance one step. `grav` scales the cursor's mass — 1 is the passive
   * perturber, up to G_CURSOR_HOLD while the pointer is held down. It is a
   * per-frame argument rather than a setter because the caller ramps it
   * continuously; see main.ts.
   */
  frame(dt: number, mx: number, my: number, grav?: number): void;
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
  /**
   * Dump the self-gravity density mesh and the force field solved from it.
   *
   * Present only on backends that run the mesh solver. Exists so the solver can
   * be verified against an independent implementation instead of by eye — see
   * the verification section of the README.
   */
  dumpGrid?(): Promise<{
    dens: Uint32Array;
    field: Float32Array;
    grid: number;
    massScale: number;
  }>;
}
