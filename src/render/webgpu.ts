/**
 * WebGPU backend: compute shader integrates, render pipeline draws, and both
 * bind the *same* storage buffer. The particle data never round-trips to JS
 * after upload — the CPU's only per-frame write is a 16-byte uniform.
 */

import { G_CURSOR, type Sim } from '../sim/world';
import { PAIR_DISC_R, PAIR_MASS, type PairState } from '../sim/pair';
import { READBACK_MAX, type Backend } from './backend';

const WORKGROUP = 64;

const SHADER = /* wgsl */ `
struct Params {
  dt     : f32,
  mx     : f32,
  my     : f32,
  aspect : f32,
  size   : f32,
  gain   : f32,
  mask   : u32,
  mode   : u32,
  time   : f32,
  warpN  : f32,
  warpM  : f32,
  gcur   : f32,
  // Collision mode only: the two cores, their velocities (needed at seeding, so
  // each disc is born already moving with its host) and the second disc's spin.
  c0     : vec2<f32>,
  v0     : vec2<f32>,
  c1     : vec2<f32>,
  v1     : vec2<f32>,
  pmass  : f32,
  spin1  : f32,
  discR  : f32,
  scale  : f32,
};

// Primary attractor strength. Fixed at the origin -- see the integrate entry
// point. (No backticks in here: this block lives inside a JS template literal.)
const G_CORE = 0.55;
// Cursor mass arrives per frame in params.gcur -- light while the pointer moves,
// near-core while it is held. See sim/world.ts for the two values.
// Terminal speed. Without it a close cursor pass flings grains off to infinity.
const V_MAX = 3.0;
// Radial-velocity retention per step, as a function of radius -- see damping()
// below. Mirrored in sim/world.ts and render/webgl2.ts.
const DAMP_INNER = 0.9995;
const DAMP_OUTER = 0.995;

// Rotating bar -- see the bar() function for why this exists at all. Mirrored in
// sim/world.ts and render/webgl2.ts; the three must stay in sync.
const BAR_OMEGA = 1.6;   // pattern speed: corotation at r ~ 0.58
const BAR_K = 0.045;     // quadrupole strength
const BAR_A2 = 0.1225;   // (0.35)^2 -- bar radial scale, squared

// Recycling bounds -- see the respawn() note. Anything past ESCAPE_R or inside
// CORE_R rejoins the disc between RETURN_LO and RETURN_HI.
const ESCAPE_R = 1.15;
const RETURN_LO = 0.04;
const RETURN_HI = 0.80;
// A species is recycled once it has fallen to this fraction of its home radius --
// far enough in to shear into an arm first, not so far that the bands merge.
const CORE_FRAC = 0.28;
// How far a particle's home radius is allowed to wander from its species' centre,
// in species widths. Mirrors the seeding jitter in sim/world.ts.
const SPECIES_SPREAD = 1.6;

// Per-species (n, m) offsets from the cursor-driven base frequency. Each species
// settles onto the nodal lines of its own standing wave, so six figures resolve
// at once in six colours. Kept small and mutually offset so they stay visibly
// distinct at every base frequency.
const MODES = array<vec2<f32>, 6>(
  vec2<f32>(0.0, 1.0),
  vec2<f32>(1.0, 0.0),
  vec2<f32>(0.0, 2.0),
  vec2<f32>(2.0, 0.0),
  vec2<f32>(1.0, 3.0),
  vec2<f32>(3.0, 1.0)
);

const PI = 3.14159265;

/** Cheap per-particle hash for the vibration jitter. */
fn hash(n : u32) -> f32 {
  var x = n * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967296.0;
}

// Mirrors SPECIES_COLORS in sim/world.ts — keep in sync.
const PALETTE = array<vec3<f32>, 6>(
  vec3<f32>(0.29, 0.62, 1.00),
  vec3<f32>(1.00, 0.45, 0.62),
  vec3<f32>(0.42, 1.00, 0.72),
  vec3<f32>(1.00, 0.76, 0.33),
  vec3<f32>(0.72, 0.55, 1.00),
  vec3<f32>(0.35, 0.95, 1.00)
);

@group(0) @binding(0) var<storage, read_write> parts : array<vec4<f32>>;
@group(0) @binding(1) var<uniform> params : Params;
@group(0) @binding(2) var<storage, read> cspecies : array<u32>;

/**
 * Chladni plate. Particles descend |w| toward the nodal lines of a standing
 * wave, exactly as sand does on a vibrating plate — the sand collects where the
 * plate is not moving. Analytic gradient, so this is O(n) with no neighbour
 * search: a million grains cost one evaluation each.
 */
fn chladni(i : u32, p : vec4<f32>, dt : f32) -> vec4<f32> {
  // Cursor drives the base frequency across a wide range; each species offsets
  // from it, so all six figures sweep together but never coincide.
  let nm = MODES[cspecies[i]];
  let n = params.warpN + nm.x;
  let m = params.warpM + nm.y;

  let u = (p.x + 1.0) * 0.5;
  let v = (p.y + 1.0) * 0.5;

  let w = cos(n * PI * u) * cos(m * PI * v) - cos(m * PI * u) * cos(n * PI * v);

  let dwdu = -n * PI * sin(n * PI * u) * cos(m * PI * v)
             + m * PI * sin(m * PI * u) * cos(n * PI * v);
  let dwdv = -m * PI * cos(n * PI * u) * sin(m * PI * v)
             + n * PI * cos(m * PI * u) * sin(n * PI * v);

  // Descend |w|: step against the gradient, signed by which side of the node
  // this grain sits on.
  let g = vec2<f32>(dwdu, dwdv) * sign(w) * 0.5;

  // Vibration amplitude scales with |w| — grains far from a node keep getting
  // kicked, grains on the node go still. That is what sharpens the figure.
  let amp = abs(w);
  let j = vec2<f32>(
    hash(i * 2u + u32(params.time * 60.0)) - 0.5,
    hash(i * 2u + 1u + u32(params.time * 60.0)) - 0.5
  );

  var vel = (p.zw - g * 2.4 * dt + j * amp * 2.2 * dt) * 0.86;
  var pos = p.xy + vel * dt;

  pos = clamp(pos, vec2<f32>(-1.0), vec2<f32>(1.0));
  return vec4<f32>(pos, vel);
}

/**
 * Galaxy collision: the restricted three-body model.
 *
 * Two cores on their own two-body orbit, solved on the CPU and arriving here as
 * six floats; every particle is a massless test particle in the sum of their two
 * fields. Toomre & Toomre showed in 1972 that this -- no self-gravity, no gas,
 * no N-body -- is enough to produce the tidal tails and the bridge that the
 * Antennae and the Mice are famous for. The tails are not thrown out by the
 * collision so much as left behind by it: material on the far side of each disc
 * is held less tightly than material on the near side, so the differential pull
 * stretches the disc into a tail pointing away and a bridge pointing across.
 *
 * The disc's spin sense relative to the orbit is the whole story. A prograde
 * encounter -- disc rotating the same way the cores swing -- keeps the outer
 * particles in step with the perturber for a long fraction of an orbit, and that
 * sustained pull is what throws a tail half the frame long. Flip the spin and
 * the same encounter barely marks it. Press R to see the difference; it is the
 * single most surprising result in the file.
 *
 * Nothing is recycled here and there are no walls. A tail is material genuinely
 * leaving, and catching it would be catching the thing worth watching.
 */
fn collide(p : vec4<f32>, dt : f32) -> vec4<f32> {
  let d0 = params.c0 - p.xy;
  let q0 = dot(d0, d0) + 0.004;
  let d1 = params.c1 - p.xy;
  let q1 = dot(d1, d1) + 0.004;

  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let qm = dot(dm, dm) + 0.02;

  var v = p.zw
    + d0 * (params.pmass / (q0 * sqrt(q0))) * dt
    + d1 * (params.pmass / (q1 * sqrt(q1))) * dt
    + dm * (params.gcur / (qm * sqrt(qm))) * dt;

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }
  return vec4<f32>(p.xy + v * dt, v);
}

/**
 * Put a particle back on the disc, on a circular orbit along its current ray.
 *
 * Both ends of the disc leak, and each leak is what the demo used to decay into.
 *
 * Outward: the box walls used to be inelastic reflectors, so every grain the
 * cursor threw out ended up sliding along an edge. Enough of them tile the square
 * with a uniform speckle that nothing ever clears -- that was the static.
 *
 * Inward: a bar torques angular momentum outward, which drives the material that
 * loses it toward the centre; the radial damping then makes that one-way. Real
 * bars do exactly this, and it is why they fuel nuclear starbursts. Measured
 * here, the entire disc was inside r < 0.2 within thirty seconds, which is the
 * white blob. Left alone, the honest end state of this system is a point.
 *
 * So the disc is closed rather than conservative: what falls through the middle
 * comes back at the edge. This is the one piece of the force law that is a choice
 * about the toy rather than about the physics, and it is what makes the steady
 * state a structured disc instead of a bright dot. The return radius is spread
 * over a band and follows the ray the particle left on, so the replenishment
 * reads as circulation rather than as a ring appearing out of nowhere.
 */
fn damping(r : f32) -> f32 {
  return mix(DAMP_INNER, DAMP_OUTER, smoothstep(0.25, 0.6, r));
}

/**
 * The radius a particle belongs at, from its species -- and deliberately not a
 * clean function of it.
 *
 * Some species/radius correlation has to survive recycling. Returning everything
 * to one shared band was measured to converge all six species onto the same mean
 * radius within a minute, and additive blending over a mixed population is grey:
 * the disc whitens and the filter chips stop carving anything.
 *
 * But the first fix for that -- one hard annulus per species -- traded the
 * problem for a worse one. Six disjoint bands draw six clean concentric rings,
 * and clean concentric rings look authored. This demo's whole claim is that its
 * structure is emergent, and a ring you can predict from a constant is not.
 *
 * So the bands overlap, by more than a full species width. Each particle draws a
 * home radius from a distribution centred on its species and wide enough to reach
 * well into its neighbours', which is the same jitter the initial seeding uses.
 * Statistically the six colours still occupy six different parts of the disc.
 * Locally, no edge between them is anywhere.
 */
/**
 * The primary's radial acceleration factor: multiply by the vector to the centre
 * to get the acceleration. Attraction minus a short-range repulsive core --
 * without the second term the whole population collapses to a single point.
 */
fn coreF(q : f32) -> f32 {
  return G_CORE / (q * sqrt(q)) - 0.0025 / (q * q);
}

/**
 * Speed of a circular orbit at r under that force -- not sqrt(G/r).
 *
 * The difference only matters near the middle, and near the middle it decides
 * whether there is a galaxy or a hole. The potential is softened, so inside the
 * softening length the true circular speed falls well below the Kepler value;
 * seeding at the Kepler value there launches everything straight back out and
 * the centre can never hold a population. Deriving the speed from the same
 * expression the integrator uses lets the innermost species sit as a bulge
 * instead of leaving a clean dark disc where the nucleus should be.
 */
fn vCirc(r : f32) -> f32 {
  let q = r * r + 0.004;
  return r * sqrt(max(0.0, coreF(q)));
}

fn homeRadius(i : u32) -> f32 {
  let j = (hash(i * 11u + 5u) - 0.5) * SPECIES_SPREAD;
  let f = clamp((f32(cspecies[i]) + 0.5 + j) / 6.0, 0.04, 1.0);
  return RETURN_LO + (RETURN_HI - RETURN_LO) * f;
}

fn respawn(i : u32, dir : vec2<f32>, spin : f32) -> vec4<f32> {
  let r = homeRadius(i);
  let vOrb = vCirc(r) * spin;
  return vec4<f32>(dir * r, -dir.y * vOrb, dir.x * vOrb);
}

/**
 * Rotating bar: an m=2 quadrupole turning at a fixed pattern speed.
 *
 * The disc has no self-gravity — every particle is an independent test particle
 * in a smooth potential. That has a consequence which no amount of tuning fixes:
 * inner orbits run faster than outer ones, so any arm the cursor raises shears,
 * winds up, and phase-mixes below pixel size within seconds. Real spiral arms are
 * held together by the disc's own gravity responding to itself. There is nothing
 * here to hold one, so structure could only ever decay.
 *
 * A rotating quadrupole replaces decay with a *driving* frequency. Orbits whose
 * own frequency resonates with the pattern get herded onto closed orbits and stay
 * there: a ring near the inner Lindblad resonance, another near the outer one,
 * with the bar between them. This is why real barred galaxies have rings, and
 * unlike a stirred arm it cannot mix away, because the driver never stops. The
 * resting state becomes structure rather than mush.
 *
 *   phi(r, th) = A(r) * cos(2 * (th - OMEGA * t)),   A(r) = -K r^2 / (r^2 + a^2)^2
 *
 * A vanishes at the centre and falls off outside a, so the bar is confined to the
 * disc and the core stays a clean monopole. Forces are the exact gradient of that
 * potential, so the pattern shuffles energy between orbits without injecting any.
 *
 * ur is the outward radial unit vector; the double angle comes from it directly
 * (cos 2th = ux^2 - uy^2, sin 2th = 2 ux uy), so there is no atan2 per particle.
 */
fn bar(ur : vec2<f32>, r : f32, t : f32) -> vec2<f32> {
  let c2 = ur.x * ur.x - ur.y * ur.y;
  let s2 = 2.0 * ur.x * ur.y;
  let cp = cos(2.0 * BAR_OMEGA * t);
  let sp = sin(2.0 * BAR_OMEGA * t);
  // Rotate the pattern: angles relative to the bar, not to the screen.
  let cos2 = c2 * cp + s2 * sp;
  let sin2 = s2 * cp - c2 * sp;

  let q = r * r + BAR_A2;
  let a = -BAR_K * r * r / (q * q);
  let da = -2.0 * BAR_K * r * (BAR_A2 - r * r) / (q * q * q);

  let fr = -da * cos2;          // -dphi/dr
  let ft = 2.0 * a * sin2 / r;  // -(1/r) dphi/dth
  return ur * fr + vec2<f32>(-ur.y, ur.x) * ft;
}

/**
 * Uniformly redistribute the population. Dispatched once when entering Chladni
 * mode: the plate has to start as evenly spread sand. Arriving from the galaxy
 * with everything piled in the core produces one bright diagonal and nothing
 * else, because a grain that reaches a node has zero vibration amplitude and
 * never moves again.
 */
@compute @workgroup_size(${WORKGROUP})
fn scatter(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }

  if (params.mode == 1u) {
    // Chladni: evenly spread sand.
    parts[i] = vec4<f32>(
      hash(i * 3u) * 2.0 - 1.0,
      hash(i * 3u + 1u) * 2.0 - 1.0,
      0.0, 0.0
    );
    return;
  }

  let a = hash(i * 3u) * 6.2831853;

  if (params.mode == 2u) {
    // Collision: two discs, one per core, interleaved by parity so both inherit
    // the full species mix and the colour bands survive the merger.
    let g = i & 1u;
    let c = select(params.c0, params.c1, g == 1u);
    let cv = select(params.v0, params.v1, g == 1u);
    let spin = select(1.0, params.spin1, g == 1u);

    // Filled discs, not rings.
    //
    // The sqrt is what makes them discs: it gives uniform surface density, where
    // sampling the radius directly piles everything at the centre. Species still
    // correlates with radius, softly and with the bands overlapping, so the
    // encounter draws the tail out roughly sorted by where it came from without
    // either disc reading as a set of concentric hoops.
    let j = (hash(i * 11u + 5u) - 0.5) * SPECIES_SPREAD;
    let f = clamp((f32(cspecies[i]) + 0.5 + j) / 6.0, 0.02, 1.0);
    // Small inner cutoff: seeding on top of a core gives an orbital speed that
    // saturates the velocity clamp and the nucleus blows out flat white.
    let r = max(0.05, params.discR * sqrt(f));
    let vOrb = sqrt(params.pmass / r) * spin;
    // Each disc is born already moving with its host, or it would be left behind
    // on the first frame and the encounter would never happen.
    parts[i] = vec4<f32>(
      c + vec2<f32>(cos(a), sin(a)) * r,
      cv + vec2<f32>(-sin(a), cos(a)) * vOrb
    );
    return;
  }

  // Galaxy: re-seed the orbital disc. Returning from Chladni would otherwise
  // leave a million grains sitting on nodal lines with zero angular momentum,
  // and they would simply rain into the core.
  let r = max(0.03, sqrt(hash(i * 3u + 1u)) * 0.65);
  let vOrb = vCirc(r) * 0.94;
  parts[i] = vec4<f32>(cos(a) * r, sin(a) * r, -sin(a) * vOrb, cos(a) * vOrb);
}

@compute @workgroup_size(${WORKGROUP})
fn integrate(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }

  var p = parts[i];
  let dt = params.dt;

  if (params.mode == 1u) {
    parts[i] = chladni(i, p, dt);
    return;
  }

  if (params.mode == 2u) {
    parts[i] = collide(p, dt);
    return;
  }

  // Primary: fixed at the origin. This is what holds the disc together.
  //
  // An earlier revision made the *cursor* the only attractor. Moving it broke
  // every orbit simultaneously and the disc detonated into uniform static, with
  // nothing left to re-form it. Anchoring the primary and demoting the cursor to
  // a weaker secondary mass turns interaction into tidal perturbation: the arms
  // stretch and wake, then relax back.
  let dc = -p.xy;
  let dc2 = dot(dc, dc) + 0.004;
  let rc = sqrt(dc2);
  let fc = coreF(dc2);

  // Secondary: the cursor. Softened harder so a direct hit shears rather than
  // slingshots.
  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let dm2 = dot(dm, dm) + 0.02;
  let fm = params.gcur / (dm2 * sqrt(dm2));

  // Rotating pattern. Without it the disc is a decaying system with nothing to
  // regenerate structure; with it, rings are where the disc settles.
  let ur = -dc / rc;
  let fb = bar(ur, rc, params.time);

  var v = p.zw + dc * fc * dt + dm * fm * dt + fb * dt;

  // Damp the RADIAL component only.
  //
  // Uniform damping looks harmless and is not: it bleeds orbital speed, orbits
  // shrink, and within ten seconds the whole disc has inspiralled into one dense
  // ball. Damping only the radial component removes eccentricity while leaving
  // angular momentum intact, which is what real accretion discs do — orbits
  // circularize instead of decaying. The practical payoff is that the disc
  // actively re-forms after the cursor stirs it, rather than staying wrecked.
  //
  // The rate is a function of radius, and it has to be. Measured at a single
  // uniform rate, the two failure modes are exclusive: damp hard enough to
  // circularize the scattered material (which is what stops the field turning
  // into speckle) and the bar's torque drains the disc inward until the inner
  // annulus is fourteen times denser than everything else -- the white core.
  // Damp gently enough to prevent that and the speckle never clears. Dissipating
  // in the outer disc and not in the inner one separates the two: the outside
  // stays swept, and nothing has a mechanism to pile up in the middle.
  let rdir = dc / rc;
  let vRad = dot(v, rdir) * rdir;
  v = (v - vRad) + vRad * damping(rc);

  // Whisper of global damping purely to bound energy the moving cursor injects.
  v = v * 0.99995;

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }

  var pos = p.xy + v * dt;

  // Close the disc at both ends -- see respawn(). Sign of angular momentum is
  // carried across, so a recycled grain rejoins moving the way the disc moves.
  //
  // The inner bound is per particle, at half its own home radius -- so it is as
  // ragged as homeRadius() is, and the hole in the middle has no clean edge.
  let floorR = max(0.05, homeRadius(i) * CORE_FRAC);
  let pr = length(pos);
  if (pr > ESCAPE_R || pr < floorR) {
    let spin = select(-1.0, 1.0, (pos.x * v.y - pos.y * v.x) >= 0.0);
    parts[i] = respawn(i, pos / max(pr, 1e-6), spin);
    return;
  }

  parts[i] = vec4<f32>(pos, v);
}

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
  @location(1) speed : f32,
  @location(2) tint : vec3<f32>,
};

@group(0) @binding(0) var<storage, read> rparts : array<vec4<f32>>;
@group(0) @binding(1) var<uniform> rparams : Params;
@group(0) @binding(2) var<storage, read> rspecies : array<u32>;

// Two triangles per particle, expanded from vertex_index. No index buffer,
// no per-particle vertex data — the position comes straight from storage.
const QUAD = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
);

@vertex
fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VSOut {
  let p = rparts[ii];
  let corner = QUAD[vi];
  let size = rparams.size;
  let sp = rspecies[ii];

  var out : VSOut;

  // Filtering happens here, on the GPU, over the whole population. The filter
  // chips are the only thing the reactive graph drives; culling a million
  // particles is a single uniform bit test per vertex, not a JS pass.
  if ((rparams.mask & (1u << sp)) == 0u) {
    out.pos = vec4<f32>(0.0, 0.0, 0.0, 0.0); // degenerate — clipped away
    out.uv = corner;
    out.speed = 0.0;
    out.tint = vec3<f32>(0.0);
    return out;
  }

  // Fit the unit disc to the *short* side of the viewport, and apply the same
  // factor to the position as to the quad.
  //
  // Without this the unit square is stretched to fill the window and a circular
  // orbit draws as an ellipse -- the disc reads as something squashed rather than
  // as something seen face-on, and that one detail is the largest single
  // difference in whether this looks like a galaxy. Handling only the landscape
  // case is not enough: on a portrait window the same correction overflows the
  // disc off both sides instead, so the limiting dimension has to be chosen.
  let a = rparams.aspect;
  let fx = 1.0 / max(a, 1.0);
  let fy = min(a, 1.0);
  let scale = rparams.scale;
  out.pos = vec4<f32>(
    (p.x * scale + corner.x * size) * fx,
    (p.y * scale + corner.y * size) * fy,
    0.0, 1.0
  );
  out.uv = corner;
  out.speed = clamp(length(p.zw) * 0.22, 0.0, 1.0);
  // Shift toward white with speed so the dense hot core still reads as bright
  // without losing species identity in the arms.
  // Shift toward white with speed so the dense hot core still reads as bright
  // without losing species identity in the arms.
  out.tint = mix(PALETTE[sp], vec3<f32>(1.0, 0.95, 0.88), out.speed * 0.3);
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  // Soft radial falloff; discard outside the disc so quads never show.
  let r = dot(in.uv, in.uv);
  if (r > 1.0) { discard; }
  let a = (1.0 - r) * (1.0 - r);

  // Additive blending sums every overlapping particle. At a million of them the
  // core saturates to flat white unless per-particle contribution scales down
  // with population — gain is set from the live count on the CPU side.
  return vec4<f32>(in.tint * a * rparams.gain, a * rparams.gain);
}
`;

export async function createWebGPUBackend(
  canvas: HTMLCanvasElement,
  sim: Sim,
): Promise<Backend | null> {
  if (!navigator.gpu) return null;

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return null;

  const device = await adapter.requestDevice();

  // WebGPU reports most validation failures asynchronously. Without this the
  // failure mode is a black canvas and no console output, which is the worst
  // possible thing to debug.
  device.addEventListener('uncapturederror', (e) => {
    console.error('[webgpu]', (e as GPUUncapturedErrorEvent).error.message);
  });
  const ctx = canvas.getContext('webgpu');
  if (!ctx) return null;

  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const particleBuf = device.createBuffer({
    size: sim.particles.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  device.queue.writeBuffer(particleBuf, 0, sim.particles);

  // 96 bytes: 12 floats of shared state, then the collision pair. Must match the
  // Params struct exactly, including the trailing pad.
  const paramBuf = device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Reused every frame; the only per-frame CPU->GPU traffic in the demo (96 bytes).
  // Two views over one buffer because `mask` is a u32 among f32s.
  const paramBytes = new ArrayBuffer(96);
  const paramData = new Float32Array(paramBytes);
  const paramU32 = new Uint32Array(paramBytes);

  // Species ids, uploaded once and never touched again. u32 rather than u8:
  // WGSL storage arrays have no 8-bit element type.
  const speciesData = new Uint32Array(sim.capacity);
  for (let i = 0; i < sim.capacity; i++) speciesData[i] = sim.species[i];
  const speciesBuf = device.createBuffer({
    size: speciesData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(speciesBuf, 0, speciesData);

  let mask = (1 << 6) - 1;
  let mode = 0;
  let cursorMass = G_CURSOR;
  // Collision pair, written straight into the uniform slots that mirror it.
  let pair: PairState | null = null;
  let elapsed = 0;
  let pendingScatter = false;

  // One staging buffer + one CPU-side view, allocated once. The list pulls a
  // small window through these every frame, so allocating per call would show
  // up as exactly the GC sawtooth this demo claims not to have.
  const staging = device.createBuffer({
    size: READBACK_MAX * 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const scratchView = new Float32Array(READBACK_MAX * 4);

  const module = device.createShaderModule({ code: SHADER });

  const computeLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });
  const renderLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      // FRAGMENT too: the fragment stage reads params.gain. Omitting it is a
      // validation failure that WebGPU reports asynchronously — compute keeps
      // running while the render pipeline silently draws nothing.
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const computePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
    compute: { module, entryPoint: 'integrate' },
  });

  const scatterPipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
    compute: { module, entryPoint: 'scatter' },
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [renderLayout] }),
    vertex: { module, entryPoint: 'vs' },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [
        {
          format,
          // Additive: overlapping particles bloom instead of occluding.
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
  });

  const computeBind = device.createBindGroup({
    layout: computeLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuf } },
      { binding: 1, resource: { buffer: paramBuf } },
      { binding: 2, resource: { buffer: speciesBuf } },
    ],
  });
  const renderBind = device.createBindGroup({
    layout: renderLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuf } },
      { binding: 1, resource: { buffer: paramBuf } },
      { binding: 2, resource: { buffer: speciesBuf } },
    ],
  });

  let count = sim.count;

  return {
    name: 'webgpu',
    detail: `${adapter.info?.vendor ?? 'gpu'} ${adapter.info?.architecture ?? ''}`.trim(),

    setCount(n: number) {
      count = Math.min(n, sim.capacity);
    },

    setSpeciesMask(m: number) {
      mask = m >>> 0;
    },

    setMode(m: number) {
      mode = m | 0;
      pendingScatter = true;
    },

    setCursorMass(m: number) {
      cursorMass = m;
    },

    setPair(p) {
      pair = p;
    },

    frame(dt: number, mx: number, my: number) {
      paramData[0] = dt;
      paramData[1] = mx;
      paramData[2] = my;
      paramData[3] = canvas.width / canvas.height;
      // Keep total deposited energy roughly constant as count varies, so 10k and
      // 1M are both legible rather than invisible and blown out respectively.
      // Floor the size at roughly one physical pixel — below that the quad falls
      // between sample points and the population renders as nothing at all.
      // Per-particle deposited energy goes as size^2 * gain. Tuned by measurement:
      // size 0.0035 / gain 1.0 saturates to flat white at 1M, size 0.0013 / gain
      // 0.2 is invisible. These floors sit ~1/6 of saturation.
      paramData[4] = Math.min(0.006, Math.max(0.0018, 0.06 / Math.sqrt(count)));
      // Lower than you would guess: the galaxy core reaches very high overdraw,
      // and additive blending clips to white there long before the arms are lit.
      paramData[5] = Math.min(1, Math.max(0.3, 120_000 / count));
      paramU32[6] = mask;
      paramU32[7] = mode;
      elapsed += dt;
      paramData[8] = elapsed;
      if (mode === 1) {
        // Cursor sweeps the base frequency over a wide band — x drives n, y
        // drives m, each roughly 1..13. Combined with the per-species offsets
        // that spans simple crosses through to dense lattices. A slow idle
        // drift keeps it evolving when nobody is touching the mouse.
        const drift = Math.sin(elapsed * 0.11) * 1.4;
        paramData[9] = 1 + (mx * 0.5 + 0.5) * 12 + drift;
        paramData[10] = 1 + (my * 0.5 + 0.5) * 12 + drift;
      } else {
        paramData[9] = 0;
        paramData[10] = 0;
      }
      paramData[11] = cursorMass;
      // Collision spans a wider field than the disc does; pull the camera back so
      // the tails stay on screen instead of leaving the frame at their best moment.
      paramData[23] = mode === 2 ? 0.55 : 1.0;
      if (pair) {
        paramData[12] = pair.x0;
        paramData[13] = pair.y0;
        paramData[14] = pair.vx0;
        paramData[15] = pair.vy0;
        paramData[16] = pair.x1;
        paramData[17] = pair.y1;
        paramData[18] = pair.vx1;
        paramData[19] = pair.vy1;
        paramData[20] = PAIR_MASS;
        paramData[21] = pair.spin1;
        paramData[22] = PAIR_DISC_R;
      }
      device.queue.writeBuffer(paramBuf, 0, paramBytes);

      const enc = device.createCommandEncoder();

      const groups = Math.ceil(count / WORKGROUP);
      const cpass = enc.beginComputePass();
      if (pendingScatter) {
        pendingScatter = false;
        cpass.setPipeline(scatterPipeline);
        cpass.setBindGroup(0, computeBind);
        cpass.dispatchWorkgroups(groups);
      }
      cpass.setPipeline(computePipeline);
      cpass.setBindGroup(0, computeBind);
      cpass.dispatchWorkgroups(groups);
      cpass.end();

      const rpass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: ctx.getCurrentTexture().createView(),
            clearValue: { r: 0.027, g: 0.035, b: 0.051, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      rpass.setPipeline(renderPipeline);
      rpass.setBindGroup(0, renderBind);
      rpass.draw(6, count);
      rpass.end();

      device.queue.submit([enc.finish()]);
    },

    resize(w: number, h: number) {
      canvas.width = w;
      canvas.height = h;
    },

    async readback(offset: number, n: number) {
      const start = Math.max(0, Math.min(offset, count - 1));
      const want = Math.max(0, Math.min(n, READBACK_MAX, count - start));
      if (want === 0) return scratchView.subarray(0, 0);

      const bytes = want * 16;
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(particleBuf, start * 16, staging, 0, bytes);
      device.queue.submit([enc.finish()]);

      await staging.mapAsync(GPUMapMode.READ, 0, bytes);
      scratchView.set(new Float32Array(staging.getMappedRange(0, bytes)));
      staging.unmap();
      return scratchView.subarray(0, want * 4);
    },

    destroy() {
      particleBuf.destroy();
      paramBuf.destroy();
      speciesBuf.destroy();
      staging.destroy();
      device.destroy();
    },
  };
}
