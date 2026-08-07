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
  /** 0 = orbital galaxy, 1 = Chladni plate. */
  setMode(mode: number): void;
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
