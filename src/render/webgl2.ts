/**
 * WebGL2 fallback. Integration runs on the GPU via transform feedback with the
 * rasterizer discarded, then a second instanced pass draws the result. Same
 * property as the WebGPU path: particle data never returns to JS.
 *
 * Ping-pong is required because a buffer cannot be both TF output and vertex
 * input in the same draw.
 *
 * KNOWN GAP, mode 0 only: this path does not run the disc's self-gravity. The
 * other four modes are prescribed fields with no mesh to solve, so they are
 * exact here. Transform feedback
 * has no atomics and no shared memory, so the density mesh would have to be
 * built by additively splatting a million points into a float framebuffer and
 * solved in a second full-screen pass — doable, and not done yet. Until it is,
 * the fallback integrates the central mass and the cursor only, which means it
 * is the *old* fixed-potential galaxy: it phase-mixes into a smooth featureless
 * disc within a few seconds and stays there. Everything else here — the seeding
 * profile, the constants, the cooling control, the framing — is kept in sync
 * with the WGSL path so the difference is exactly the one term.
 */

import {
  CAPTURE_K, CAPTURE_R2, CURSOR_SOFT2, CURSOR_SOFT2_HOLD, DOMAIN, G_CORE,
  G_CURSOR, G_CURSOR_HOLD, HALO_A2, MESH_R, M_DISC, RADIAL_DAMP, haloMass,
  type Sim,
} from '../sim/world';
import * as barred from '../sim/barred';
import * as classic from '../sim/classic';
import { BARRED, CHLADNI, CLASSIC, COLLISION, SELFGRAV, seedMode } from '../sim/modes';
import { PAIR_MASS, createPair, type PairState } from '../sim/pair';
import { cameraTilt, cameraZoom, type Backend } from './backend';

const SIM_VS = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aVel;
in float aSpecies;
out vec2 vPos;
out vec2 vVel;
uniform float uDt;
uniform vec2 uMouse;
uniform int uMode;
uniform float uTime;
uniform float uWarp;
uniform float uWarpM;
uniform float uCooling;
uniform float uGrav;
uniform float uGCursor;
// Core strength of the fixed-potential disc, driven live from the UI — see
// coreGravity() in sim/classic.ts. A uniform rather than a baked constant
// because it is the one term in that mode a slider moves.
uniform float uGCore;
// Dark-halo mass of the HALO mode, live from the UI and 0 everywhere else — see
// M_HALO in sim/world.ts. A uniform for the same reason uGCore is.
uniform float uHalo;
uniform vec2 uC0;
uniform vec2 uC1;
uniform float uPMass;

const float PI = 3.14159265;
const vec2 MODES[6] = vec2[6](
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(0.0, 2.0),
  vec2(2.0, 0.0), vec2(1.0, 3.0), vec2(3.0, 1.0)
);

float hash(vec2 s) {
  return fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
}

// --- fixed-potential modes ---------------------------------------------------
//
// The barred disc, the collision and the original disc, each with its own
// constants — see sim/barred.ts and sim/classic.ts, and webgpu.ts for the
// derivations. None of them shares a number with the self-gravitating disc below.
const float BD_DAMP_INNER = ${barred.DAMP_INNER};
const float BD_DAMP_OUTER = ${barred.DAMP_OUTER};
const float BD_BAR_OMEGA = ${barred.BAR_OMEGA};
const float BD_BAR_K = ${barred.BAR_K};
const float BD_BAR_A2 = ${barred.BAR_A2};
const float BD_ESCAPE_R = ${barred.ESCAPE_R};
const float BD_RETURN_LO = ${barred.RETURN_LO};
const float BD_RETURN_HI = ${barred.RETURN_HI};
const float BD_CORE_FRAC = ${barred.CORE_FRAC};
const float BD_SPECIES_SPREAD = ${barred.SPECIES_SPREAD};

float bdCoreF(float q) {
  return ${barred.G_CORE} / (q * sqrt(q)) - 0.0025 / (q * q);
}

float bdVCirc(float r) {
  float q = r * r + 0.004;
  return r * sqrt(max(0.0, bdCoreF(q)));
}

// Home radius from species, with the bands deliberately overlapping — see
// bdHomeRadius() in webgpu.ts for why clean bands were the wrong fix.
float bdHomeRadius(float sp, float seed) {
  float j = (hash(vec2(seed, 5.5)) - 0.5) * BD_SPECIES_SPREAD;
  float f = clamp((sp + 0.5 + j) / 6.0, 0.04, 1.0);
  return BD_RETURN_LO + (BD_RETURN_HI - BD_RETURN_LO) * f;
}

vec2 bdBar(vec2 ur, float r, float t) {
  float c2 = ur.x * ur.x - ur.y * ur.y;
  float s2 = 2.0 * ur.x * ur.y;
  float cp = cos(2.0 * BD_BAR_OMEGA * t);
  float sp = sin(2.0 * BD_BAR_OMEGA * t);
  float cos2 = c2 * cp + s2 * sp;
  float sin2 = s2 * cp - c2 * sp;

  float q = r * r + BD_BAR_A2;
  float a = -BD_BAR_K * r * r / (q * q);
  float da = -2.0 * BD_BAR_K * r * (BD_BAR_A2 - r * r) / (q * q * q);

  return ur * (-da * cos2) + vec2(-ur.y, ur.x) * (2.0 * a * sin2 / r);
}

void main() {
  // --- Chladni plate (see webgpu.ts for the derivation) ---
  if (uMode == ${CHLADNI}) {
    vec2 nm = MODES[int(aSpecies + 0.5)];
    float n = uWarp + nm.x;
    float m = uWarpM + nm.y;

    float u = (aPos.x + 1.0) * 0.5;
    float vv = (aPos.y + 1.0) * 0.5;

    float w = cos(n * PI * u) * cos(m * PI * vv) - cos(m * PI * u) * cos(n * PI * vv);
    float dwdu = -n * PI * sin(n * PI * u) * cos(m * PI * vv)
                 + m * PI * sin(m * PI * u) * cos(n * PI * vv);
    float dwdv = -m * PI * cos(n * PI * u) * sin(m * PI * vv)
                 + n * PI * cos(m * PI * u) * sin(n * PI * vv);

    vec2 g = vec2(dwdu, dwdv) * sign(w) * 0.5;
    float amp = abs(w);
    vec2 j = vec2(hash(aPos + uTime), hash(aPos.yx - uTime)) - 0.5;

    vec2 vel = (aVel - g * 2.4 * uDt + j * amp * 2.2 * uDt) * 0.86;
    vPos = clamp(aPos + vel * uDt, vec2(-1.0), vec2(1.0));
    vVel = vel;
    return;
  }

  // --- barred disc (see bdIntegrate() in webgpu.ts) ---
  if (uMode == ${BARRED}) {
    vec2 dcb = -aPos;
    float dcb2 = dot(dcb, dcb) + 0.004;
    float rcb = sqrt(dcb2);

    vec2 dmb = uMouse - aPos;
    float dmb2 = dot(dmb, dmb) + 0.02;

    vec2 vb = aVel
      + dcb * bdCoreF(dcb2) * uDt
      + dmb * (uGCursor / (dmb2 * sqrt(dmb2))) * uDt
      + bdBar(-dcb / rcb, rcb, uTime) * uDt;

    // Radial-only damping, at a rate that depends on radius — see webgpu.ts for
    // the measurement that forced it to.
    vec2 rdirb = dcb / rcb;
    vec2 vRadb = dot(vb, rdirb) * rdirb;
    float dampR = mix(BD_DAMP_INNER, BD_DAMP_OUTER, smoothstep(0.25, 0.6, rcb));
    vb = ((vb - vRadb) + vRadb * dampR) * 0.99995;

    float sb = length(vb);
    if (sb > 3.0) vb *= 3.0 / sb;

    vec2 pb = aPos + vb * uDt;

    // Close the disc at both ends — see bdRespawn() in webgpu.ts.
    float home = bdHomeRadius(floor(aSpecies + 0.5), float(gl_VertexID));
    float floorR = max(0.05, home * BD_CORE_FRAC);
    float prb = length(pb);
    if (prb > BD_ESCAPE_R || prb < floorR) {
      vec2 dir = pb / max(prb, 1e-6);
      float spin = (pb.x * vb.y - pb.y * vb.x) >= 0.0 ? 1.0 : -1.0;
      float vOrb = bdVCirc(home) * spin;
      pb = dir * home;
      vb = vec2(-dir.y, dir.x) * vOrb;
    }

    vPos = pb;
    vVel = vb;
    return;
  }

  // --- galaxy collision (see collide() in webgpu.ts) ---
  if (uMode == ${COLLISION}) {
    vec2 d0 = uC0 - aPos;
    float q0 = dot(d0, d0) + 0.004;
    vec2 d1 = uC1 - aPos;
    float q1 = dot(d1, d1) + 0.004;
    vec2 dmc = uMouse - aPos;
    float qm = dot(dmc, dmc) + 0.02;

    vec2 vc = aVel
      + d0 * (uPMass / (q0 * sqrt(q0))) * uDt
      + d1 * (uPMass / (q1 * sqrt(q1))) * uDt
      + dmc * (uGCursor / (qm * sqrt(qm))) * uDt;

    float sc = length(vc);
    if (sc > 3.0) vc *= 3.0 / sc;
    vPos = aPos + vc * uDt;
    vVel = vc;
    return;
  }

  // --- original fixed-potential disc (see clsIntegrate() in webgpu.ts) ---
  if (uMode == ${CLASSIC}) {
    vec2 dcc = -aPos;
    float dcc2 = dot(dcc, dcc) + 0.004;
    float rcc = sqrt(dcc2);
    float fcc = uGCore / (dcc2 * rcc) - 0.0025 / (dcc2 * dcc2);

    vec2 dmc2 = uMouse - aPos;
    float dm2c = dot(dmc2, dmc2) + 0.02;
    vec2 vv2 = aVel
      + dcc * fcc * uDt
      // uGCursor rather than a constant — two cursor masses, switched on pointer
      // down. See G_CURSOR_HELD in sim/classic.ts.
      + dmc2 * (uGCursor / (dm2c * sqrt(dm2c))) * uDt;

    vec2 rdirc = dcc / rcc;
    vec2 vRadc = dot(vv2, rdirc) * rdirc;
    vv2 = ((vv2 - vRadc) + vRadc * ${classic.RADIAL_DAMP}) * 0.99995;

    float sc2 = length(vv2);
    if (sc2 > 3.0) vv2 *= 3.0 / sc2;

    vec2 pc = aPos + vv2 * uDt;
    float bounceC = 0.45;
    if (pc.x < -1.0) { pc.x = -1.0; vv2.x = -vv2.x * bounceC; }
    else if (pc.x > 1.0) { pc.x = 1.0; vv2.x = -vv2.x * bounceC; }
    if (pc.y < -1.0) { pc.y = -1.0; vv2.y = -vv2.y * bounceC; }
    else if (pc.y > 1.0) { pc.y = 1.0; vv2.y = -vv2.y * bounceC; }

    vPos = pc;
    vVel = vv2;
    return;
  }

  // Must stay comparable with the WGSL path — see webgpu.ts for the reasoning
  // behind an anchored primary plus a weaker cursor secondary.
  vec2 dc = -aPos;
  float dc2 = dot(dc, dc) + 0.004;
  float rc = sqrt(dc2);
  // Core plus the dark halo — mirrors coreF() + haloF() in sim/world.ts. uHalo
  // is 0 in mode ${SELFGRAV}, so the two disc modes share this line unbranched.
  float fc = ${G_CORE} / (dc2 * rc) - 0.0025 / (dc2 * dc2)
           + uHalo / (dc2 + float(${HALO_A2}));

  vec2 dm = uMouse - aPos;
  // Mass and softening ramp together — see sim/world.ts CURSOR_SOFT2_HOLD.
  float ht = clamp((uGrav - 1.0) / (float(${G_CURSOR_HOLD}) - 1.0), 0.0, 1.0);
  float dm2 = dot(dm, dm) + mix(${CURSOR_SOFT2}, ${CURSOR_SOFT2_HOLD}, ht);
  float fm = ${G_CURSOR} * uGrav / (dm2 * sqrt(dm2));

  // Outside the mesh box, the disc as a point mass. This path has no mesh at all
  // (see the header), so this is the *only* place the disc's own mass appears in
  // it — and it has to, because the outer field is seeded from vCirc(), which
  // includes that mass. Leave it out and the field is seeded 20% fast at r = 1.5
  // and spirals outward onto the wall instead of holding station.
  bool outer = max(abs(aPos.x), abs(aPos.y)) >= float(${MESH_R.toFixed(3)});
  vec2 sg = outer ? dc * (float(${M_DISC}) / (dc2 * rc)) : vec2(0.0);

  vec2 v = aVel + dc * fc * uDt + sg * uDt + dm * fm * uDt;

  // All dissipation is disc physics; the outer field orbits frictionless. See
  // webgpu.ts for the measurement — with the global bleed applied out there the
  // field inspirals out of frame over about a minute.
  if (!outer) {
    // Radial-only damping — see webgpu.ts for why uniform damping collapses the disc.
    vec2 rdir = dc / rc;
    vec2 vRad = dot(v, rdir) * rdir;
    v = ((v - vRad) + vRad * uCooling) * 0.99995;

    // Capture drag along the cursor line only — see webgpu.ts for why not the
    // full velocity vector.
    float cw = ht * exp(-dm2 / float(${CAPTURE_R2}));
    vec2 mdir = dm / max(1e-4, length(dm));
    v -= dot(v, mdir) * mdir * min(0.9, float(${CAPTURE_K}) * cw * uDt);
  }

  float speed = length(v);
  if (speed > 3.0) v *= 3.0 / speed;

  vec2 p = aPos + v * uDt;

  // Walls at DOMAIN, matching webgpu.ts: the outer field that fills a wide
  // frame lives outside the unit box, so a unit-box wall would flatten it
  // against the edge of the disc on the first frame.
  float bounce = 0.45;
  float W = float(${DOMAIN.toFixed(3)});
  if (p.x < -W) { p.x = -W; v.x = -v.x * bounce; }
  else if (p.x > W) { p.x = W; v.x = -v.x * bounce; }
  if (p.y < -W) { p.y = -W; v.y = -v.y * bounce; }
  else if (p.y > W) { p.y = W; v.y = -v.y * bounce; }

  vPos = p;
  vVel = v;
}`;

const SIM_FS = `#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`;

const DRAW_VS = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aVel;
in vec2 aCorner;
in float aSpecies;
out vec2 vUv;
out float vSpeed;
out vec3 vTint;
uniform float uAspect;
uniform float uSize;
uniform int uMask;
uniform float uVScale;
uniform float uMono;
uniform int uMode;
// Vertical foreshortening of the inclined view — see cameraTilt in backend.ts.
uniform float uTilt;

// Mirrors SPECIES_COLORS in sim/world.ts and PALETTE in webgpu.ts.
const vec3 PALETTE[6] = vec3[6](
  vec3(0.29, 0.62, 1.00),
  vec3(1.00, 0.45, 0.62),
  vec3(0.42, 1.00, 0.72),
  vec3(1.00, 0.76, 0.33),
  vec3(0.72, 0.55, 1.00),
  vec3(0.35, 0.95, 1.00)
);

void main() {
  int sp = int(aSpecies + 0.5);
  vUv = aCorner;

  if ((uMask & (1 << sp)) == 0) {
    gl_Position = vec4(0.0);   // degenerate — clipped
    vSpeed = 0.0;
    vTint = vec3(0.0);
    return;
  }

  vSpeed = clamp(length(aVel) * 0.22, 0.0, 1.0);
  // See webgpu.ts: mono drops the palette for a single faintly warm white.
  vec3 base = uMono > 0.5 ? vec3(0.86, 0.89, 1.0) : PALETTE[sp];
  vTint = mix(base, vec3(1.0, 0.95, 0.88), vSpeed * 0.3);
  // One camera for every mode, solved on the CPU by cameraZoom() in
  // backend.ts — see the vs() entry point in webgpu.ts, which splits the same
  // number across the two axes the same way.
  float fx = uVScale / max(uAspect, 1.0);
  float fy = uVScale * min(uAspect, 1.0);
  // Inclination on the disc's y only, not the quad's — the disc tilts, the
  // stars in it stay round. See the vs() entry point in webgpu.ts.
  gl_Position = vec4(
    (aPos.x + aCorner.x * uSize) * fx,
    (aPos.y * uTilt + aCorner.y * uSize) * fy,
    0.0, 1.0
  );
}`;

const DRAW_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vSpeed;
in vec3 vTint;
out vec4 o;
uniform float uGain;

void main() {
  float r = dot(vUv, vUv);
  if (r > 1.0) discard;
  float a = (1.0 - r) * (1.0 - r);
  o = vec4(vTint * a * uGain, a * uGain);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile failed: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function link(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
  varyings?: string[],
) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

export function createWebGL2Backend(
  canvas: HTMLCanvasElement,
  sim: Sim,
): Backend | null {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) return null;

  // Split the interleaved sim buffer into the two attribute streams TF needs.
  const n = sim.capacity;
  const pos = new Float32Array(n * 2);
  const vel = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos[i * 2] = sim.particles[i * 4];
    pos[i * 2 + 1] = sim.particles[i * 4 + 1];
    vel[i * 2] = sim.particles[i * 4 + 2];
    vel[i * 2 + 1] = sim.particles[i * 4 + 3];
  }

  const mkBuf = (data: Float32Array) => {
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
    return b;
  };

  let posA = mkBuf(pos);
  let velA = mkBuf(vel);
  let posB = mkBuf(pos);
  let velB = mkBuf(vel);

  const corners = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const cornerBuf = mkBuf(corners);

  // Species as float: WebGL2 integer attributes need vertexAttribIPointer and a
  // separate binding path; one float per particle is simpler and costs 4MB at 1M.
  const speciesData = new Float32Array(n);
  for (let i = 0; i < n; i++) speciesData[i] = sim.species[i];
  const speciesBuf = mkBuf(speciesData);

  const simProg = link(gl, SIM_VS, SIM_FS, ['vPos', 'vVel']);
  const drawProg = link(gl, DRAW_VS, DRAW_FS);

  const simLoc = {
    aPos: gl.getAttribLocation(simProg, 'aPos'),
    aVel: gl.getAttribLocation(simProg, 'aVel'),
    aSpecies: gl.getAttribLocation(simProg, 'aSpecies'),
    uDt: gl.getUniformLocation(simProg, 'uDt'),
    uMouse: gl.getUniformLocation(simProg, 'uMouse'),
    uMode: gl.getUniformLocation(simProg, 'uMode'),
    uHalo: gl.getUniformLocation(simProg, 'uHalo'),
    uTime: gl.getUniformLocation(simProg, 'uTime'),
    uWarp: gl.getUniformLocation(simProg, 'uWarp'),
    uWarpM: gl.getUniformLocation(simProg, 'uWarpM'),
    uCooling: gl.getUniformLocation(simProg, 'uCooling'),
    uGrav: gl.getUniformLocation(simProg, 'uGrav'),
    uGCursor: gl.getUniformLocation(simProg, 'uGCursor'),
    uGCore: gl.getUniformLocation(simProg, 'uGCore'),
    uC0: gl.getUniformLocation(simProg, 'uC0'),
    uC1: gl.getUniformLocation(simProg, 'uC1'),
    uPMass: gl.getUniformLocation(simProg, 'uPMass'),
  };
  const drawLoc = {
    aPos: gl.getAttribLocation(drawProg, 'aPos'),
    aVel: gl.getAttribLocation(drawProg, 'aVel'),
    aCorner: gl.getAttribLocation(drawProg, 'aCorner'),
    aSpecies: gl.getAttribLocation(drawProg, 'aSpecies'),
    uAspect: gl.getUniformLocation(drawProg, 'uAspect'),
    uSize: gl.getUniformLocation(drawProg, 'uSize'),
    uGain: gl.getUniformLocation(drawProg, 'uGain'),
    uMask: gl.getUniformLocation(drawProg, 'uMask'),
    uVScale: gl.getUniformLocation(drawProg, 'uVScale'),
    uMono: gl.getUniformLocation(drawProg, 'uMono'),
    uMode: gl.getUniformLocation(drawProg, 'uMode'),
    uTilt: gl.getUniformLocation(drawProg, 'uTilt'),
  };

  const tf = gl.createTransformFeedback()!;
  let count = sim.count;

  const bindAttrib = (buf: WebGLBuffer, loc: number, divisor = 0, size = 2) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(loc, divisor);
  };

  let mask = 0x3f;
  let mode = SELFGRAV;
  let elapsed = 0;
  let cooling = RADIAL_DAMP;
  let mono = false;
  let tilted = false;
  let cursorMass = barred.G_CURSOR;
  // Replaced by setPair() before collision mode is ever entered.
  let pair: PairState = createPair();

  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const detail = dbg
    ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  /**
   * Re-seed for the current mode and refill both ping-pong buffers.
   *
   * The same CPU seeding the WebGPU path uses, so the two backends start every
   * mode from the same distribution — a fresh seed per call, so not the same
   * draw; see seedMode() in sim/modes.ts. A one-time cost on mode switch or
   * restart, not per frame.
   */
  const reseedBuffers = () => {
    seedMode(sim, mode, pair);
    for (let i = 0; i < n; i++) {
      pos[i * 2] = sim.particles[i * 4];
      pos[i * 2 + 1] = sim.particles[i * 4 + 1];
      vel[i * 2] = sim.particles[i * 4 + 2];
      vel[i * 2 + 1] = sim.particles[i * 4 + 3];
      speciesData[i] = sim.species[i];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, speciesBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, speciesData);
    for (const [buf, data] of [
      [posA, pos],
      [posB, pos],
      [velA, vel],
      [velB, vel],
    ] as const) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
  };

  return {
    name: 'webgl2',
    detail,

    setCount(v: number) {
      count = Math.min(v, sim.capacity);
    },

    setSpeciesMask(m: number) {
      mask = m >>> 0;
    },

    setCooling(v: number) {
      cooling = v;
    },

    setMono(v: boolean) {
      mono = v;
    },

    setTilt(v: boolean) {
      tilted = v;
    },

    setCursorMass(m: number) {
      cursorMass = m;
    },

    setPair(p: PairState) {
      pair = p;
    },

    setMode(m: number) {
      mode = m | 0;
      reseedBuffers();
    },

    reset() {
      elapsed = 0;
      reseedBuffers();
    },

    frame(dt: number, mx: number, my: number, grav = 1) {
      // --- integrate: TF pass, no rasterization ---
      gl.useProgram(simProg);
      gl.uniform1f(simLoc.uDt, dt);
      gl.uniform2f(simLoc.uMouse, mx, my);
      gl.uniform1i(simLoc.uMode, mode);
      gl.uniform1f(simLoc.uCooling, cooling);
      gl.uniform1f(simLoc.uGrav, grav);
      gl.uniform1f(simLoc.uGCursor, cursorMass);
      // Read from the module rather than mirrored in by a setter — the same
      // number also has to reach the CPU baseline and the seeding, neither of
      // which goes through a backend. See coreGravity() in sim/classic.ts.
      gl.uniform1f(simLoc.uGCore, classic.coreGravity());
      gl.uniform1f(simLoc.uHalo, haloMass());
      gl.uniform2f(simLoc.uC0, pair.x0, pair.y0);
      gl.uniform2f(simLoc.uC1, pair.x1, pair.y1);
      gl.uniform1f(simLoc.uPMass, PAIR_MASS);
      elapsed += dt;
      gl.uniform1f(simLoc.uTime, elapsed);
      // Same wide frequency sweep as the WebGPU path — see webgpu.ts.
      const drift = mode === CHLADNI ? Math.sin(elapsed * 0.11) * 1.4 : 0;
      gl.uniform1f(simLoc.uWarp, mode === CHLADNI ? 1 + (mx * 0.5 + 0.5) * 12 + drift : 0);
      gl.uniform1f(simLoc.uWarpM, mode === CHLADNI ? 1 + (my * 0.5 + 0.5) * 12 + drift : 0);

      bindAttrib(posA, simLoc.aPos);
      bindAttrib(velA, simLoc.aVel);
      bindAttrib(speciesBuf, simLoc.aSpecies, 0, 1);

      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, posB);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, velB);

      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);

      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

      // --- draw the freshly written buffers ---
      gl.clearColor(0.027, 0.035, 0.051, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(drawProg);
      gl.uniform1f(drawLoc.uAspect, canvas.width / canvas.height);
      // Same size/gain curve as the WebGPU path — see webgpu.ts for the reasoning.
      gl.uniform1f(drawLoc.uSize, Math.min(0.006, Math.max(0.0018, 0.06 / Math.sqrt(count))));
      // Gain carries the tilt factor for the same reason the WebGPU path does:
      // the inclined camera moves in by 1/t, which grows sprite area by 1/t^2
      // against a disc whose screen area only grows by 1/t, so surface
      // brightness would climb by 1/t and clip. See webgpu.ts.
      const tilt = cameraTilt(mode, tilted);
      gl.uniform1f(drawLoc.uGain, Math.min(1, Math.max(0.6, 200_000 / count)) * tilt);
      gl.uniform1i(drawLoc.uMask, mask);
      // The whole camera, in one number — see cameraZoom() in backend.ts.
      gl.uniform1f(drawLoc.uVScale, cameraZoom(mode, canvas.width / canvas.height, tilted));
      gl.uniform1f(drawLoc.uTilt, tilt);
      gl.uniform1f(drawLoc.uMono, mono ? 1 : 0);
      gl.uniform1i(drawLoc.uMode, mode);

      bindAttrib(cornerBuf, drawLoc.aCorner, 0);
      bindAttrib(posB, drawLoc.aPos, 1);
      bindAttrib(velB, drawLoc.aVel, 1);
      bindAttrib(speciesBuf, drawLoc.aSpecies, 1, 1);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

      // swap
      [posA, posB] = [posB, posA];
      [velA, velB] = [velB, velA];
    },

    resize(w: number, h: number) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },

    destroy() {
      gl.deleteProgram(simProg);
      gl.deleteProgram(drawProg);
      for (const b of [posA, posB, velA, velB, cornerBuf, speciesBuf]) gl.deleteBuffer(b);
      gl.deleteTransformFeedback(tf);
    },
  };
}
