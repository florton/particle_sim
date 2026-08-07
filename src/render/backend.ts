import type { PairState } from '../sim/pair';

/** Hard cap on a single readback window, in particles. */
export const READBACK_MAX = 4096;

/**
 * Camera framing, indexed by the mode ids in sim/modes.ts.
 *
 * `r` is the half-extent the mode wants on screen, in simulation units: fit it
 * to the short side of the window and the mode is framed the way it was tuned.
 * The self-gravitating disc asks for less than the simulation box because the
 * box runs to 1 and the disc only reaches about 0.7, so framing the box would
 * center the galaxy inside a wide empty margin; the collision asks for more than
 * the box because its tails leave the frame otherwise.
 *
 * `cover` is how far past that fit to zoom, as a fraction of the way to a cover
 * fit -- 0 fits `r` inside the window and letterboxes the long side, 1 fills the
 * long side and clips the short one down to 1/aspect of `r`.
 *
 * The galaxies take 0. Filling a wide window with a round subject means zooming
 * until it overruns the short side, and there is no version of that which is not
 * a much closer view of the disc -- there are no particles out past r ~ 1 to fill
 * the corners with, so the only way to put light at the left and right edges is
 * to bring the middle of the galaxy up to meet them. At 0.72 the disc reached
 * every edge and read as far too close. So these keep the framing they were
 * tuned at and accept a margin on an ultrawide window.
 *
 * The plate takes 1, and can afford to: it is a square, so a cover fit costs it
 * the outer band of a lattice that repeats anyway, and it has a hard boundary,
 * so anything less shows an actual dark border rather than a fade.
 */
export const FRAME = [
  { r: 0.70, cover: 0.0 }, // SELFGRAV  -- disc light is inside r = 0.7
  { r: 1.0,  cover: 1.0 }, // CHLADNI   -- square plate; fills the window
  { r: 1.0,  cover: 0.0 }, // BARRED    -- recycled at the box edge, so the box
  { r: 1.82, cover: 0.0 }, // COLLISION -- pulled back to hold both tails
  { r: 1.0,  cover: 0.0 }, // CLASSIC   -- framed on the box, like the barred disc
] as const;

/**
 * Camera zoom for a mode in a window of this aspect ratio, in clip units per
 * simulation unit along the *short* axis.
 *
 * The only thing that varies is the aspect ratio, so the framing is identical at
 * every resolution with the same window shape -- a 1280x720 laptop and a 4K
 * panel compose the same picture. Both backends call this and hand the result to
 * their vertex shader as a single number; see the entry points there for how the
 * two axes divide it up.
 */
export function cameraZoom(mode: number, aspect: number): number {
  const { r, cover } = FRAME[mode] ?? FRAME[0];
  // max(a, 1/a) is the zoom that takes a short-side fit to a cover fit, and it is
  // written this way so a portrait window is handled by the same expression as a
  // landscape one rather than by a second branch.
  const fill = 1 + cover * (Math.max(aspect, 1 / aspect) - 1);
  return fill / r;
}

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
