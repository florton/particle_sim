/**
 * WebGL2 fallback. Integration runs on the GPU via transform feedback with the
 * rasterizer discarded, then a second instanced pass draws the result. Same
 * property as the WebGPU path: particle data never returns to JS.
 *
 * Ping-pong is required because a buffer cannot be both TF output and vertex
 * input in the same draw.
 */

import { G_CURSOR, circularSpeed, type Sim } from '../sim/world';
import { PAIR_DISC_R, PAIR_MASS, type PairState } from '../sim/pair';
import type { Backend } from './backend';

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
uniform float uGCursor;
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

// Rotating bar — see webgpu.ts for the derivation and for why a fixed
// axisymmetric potential cannot hold structure on its own.
const float DAMP_INNER = 0.9995;
const float DAMP_OUTER = 0.995;
const float BAR_OMEGA = 1.6;
const float BAR_K = 0.045;
const float BAR_A2 = 0.1225;
const float ESCAPE_R = 1.15;
const float RETURN_LO = 0.04;
const float RETURN_HI = 0.80;
const float CORE_FRAC = 0.28;
const float SPECIES_SPREAD = 1.6;

// Home radius from species, with the bands deliberately overlapping — see
// homeRadius() in webgpu.ts for why clean bands were the wrong fix.
// Radial acceleration factor and the true circular speed under it — see
// coreF()/vCirc() in webgpu.ts for why sqrt(G/r) leaves a hole in the middle.
float coreF(float q) {
  return 0.55 / (q * sqrt(q)) - 0.0025 / (q * q);
}

float vCirc(float r) {
  float q = r * r + 0.004;
  return r * sqrt(max(0.0, coreF(q)));
}

float homeRadius(float sp, float seed) {
  float j = (hash(vec2(seed, 5.5)) - 0.5) * SPECIES_SPREAD;
  float f = clamp((sp + 0.5 + j) / 6.0, 0.04, 1.0);
  return RETURN_LO + (RETURN_HI - RETURN_LO) * f;
}

vec2 bar(vec2 ur, float r, float t) {
  float c2 = ur.x * ur.x - ur.y * ur.y;
  float s2 = 2.0 * ur.x * ur.y;
  float cp = cos(2.0 * BAR_OMEGA * t);
  float sp = sin(2.0 * BAR_OMEGA * t);
  float cos2 = c2 * cp + s2 * sp;
  float sin2 = s2 * cp - c2 * sp;

  float q = r * r + BAR_A2;
  float a = -BAR_K * r * r / (q * q);
  float da = -2.0 * BAR_K * r * (BAR_A2 - r * r) / (q * q * q);

  return ur * (-da * cos2) + vec2(-ur.y, ur.x) * (2.0 * a * sin2 / r);
}

void main() {
  // --- Chladni plate (see webgpu.ts for the derivation) ---
  if (uMode == 1) {
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

  // --- galaxy collision (see collide() in webgpu.ts) ---
  if (uMode == 2) {
    vec2 d0 = uC0 - aPos;
    float q0 = dot(d0, d0) + 0.004;
    vec2 d1 = uC1 - aPos;
    float q1 = dot(d1, d1) + 0.004;
    vec2 dmm = uMouse - aPos;
    float qm = dot(dmm, dmm) + 0.02;

    vec2 vc = aVel
      + d0 * (uPMass / (q0 * sqrt(q0))) * uDt
      + d1 * (uPMass / (q1 * sqrt(q1))) * uDt
      + dmm * (uGCursor / (qm * sqrt(qm))) * uDt;

    float sc = length(vc);
    if (sc > 3.0) vc *= 3.0 / sc;
    vPos = aPos + vc * uDt;
    vVel = vc;
    return;
  }

  // Must stay comparable with the WGSL path — see webgpu.ts for the reasoning
  // behind an anchored primary plus a weaker cursor secondary.
  vec2 dc = -aPos;
  float dc2 = dot(dc, dc) + 0.004;
  float rc = sqrt(dc2);
  float fc = coreF(dc2);

  vec2 dm = uMouse - aPos;
  float dm2 = dot(dm, dm) + 0.02;
  float fm = uGCursor / (dm2 * sqrt(dm2));

  vec2 ur = -dc / rc;
  vec2 v = aVel + dc * fc * uDt + dm * fm * uDt + bar(ur, rc, uTime) * uDt;

  // Radial-only damping — see webgpu.ts for why uniform damping collapses the disc.
  vec2 rdir = dc / rc;
  vec2 vRad = dot(v, rdir) * rdir;
  float dampR = mix(DAMP_INNER, DAMP_OUTER, smoothstep(0.25, 0.6, rc));
  v = ((v - vRad) + vRad * dampR) * 0.99995;

  float speed = length(v);
  if (speed > 3.0) v *= 3.0 / speed;

  vec2 p = aPos + v * uDt;

  // Close the disc at both ends — see respawn() in webgpu.ts.
  // Per-particle inner bound, at half its own home radius — see webgpu.ts.
  float home = homeRadius(floor(aSpecies + 0.5), float(gl_VertexID));
  float floorR = max(0.05, home * CORE_FRAC);
  float pr = length(p);
  if (pr > ESCAPE_R || pr < floorR) {
    vec2 u = p / max(pr, 1e-6);
    float spin = (p.x * v.y - p.y * v.x) >= 0.0 ? 1.0 : -1.0;
    float rr = home;
    float vOrb = vCirc(rr) * spin;
    p = u * rr;
    v = vec2(-u.y, u.x) * vOrb;
  }

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
uniform float uScale;
uniform int uMask;

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
  vTint = mix(PALETTE[sp], vec3(1.0, 0.95, 0.88), vSpeed * 0.3);
  // Fit to the short side, position and quad alike — see webgpu.ts.
  float fx = 1.0 / max(uAspect, 1.0);
  float fy = min(uAspect, 1.0);
  gl_Position = vec4(
    (aPos.x * uScale + aCorner.x * uSize) * fx,
    (aPos.y * uScale + aCorner.y * uSize) * fy,
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
    uTime: gl.getUniformLocation(simProg, 'uTime'),
    uWarp: gl.getUniformLocation(simProg, 'uWarp'),
    uWarpM: gl.getUniformLocation(simProg, 'uWarpM'),
    uGCursor: gl.getUniformLocation(simProg, 'uGCursor'),
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
    uScale: gl.getUniformLocation(drawProg, 'uScale'),
    uGain: gl.getUniformLocation(drawProg, 'uGain'),
    uMask: gl.getUniformLocation(drawProg, 'uMask'),
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
  let mode = 0;
  let cursorMass = G_CURSOR;
  let pair: PairState | null = null;
  let elapsed = 0;

  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const detail = dbg
    ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  return {
    name: 'webgl2',
    detail,

    setCount(v: number) {
      count = Math.min(v, sim.capacity);
    },

    setSpeciesMask(m: number) {
      mask = m >>> 0;
    },

    setCursorMass(m: number) {
      cursorMass = m;
    },

    setPair(p: PairState) {
      pair = p;
    },

    setMode(m: number) {
      mode = m | 0;

      // Parity with the WebGPU scatter pass. No compute shaders here, so this is
      // a CPU-side refill of both ping-pong buffers — a one-time cost on mode
      // switch, not per frame.
      for (let i = 0; i < n; i++) {
        if (mode === 1) {
          // Chladni: evenly spread sand, at rest.
          pos[i * 2] = Math.random() * 2 - 1;
          pos[i * 2 + 1] = Math.random() * 2 - 1;
          vel[i * 2] = 0;
          vel[i * 2 + 1] = 0;
        } else if (mode === 2 && pair) {
          // Collision: one disc per core, interleaved by parity — same seeding as
          // the WGSL scatter pass, so both backends start the same encounter.
          const g = i & 1;
          const cx = g ? pair.x1 : pair.x0;
          const cy = g ? pair.y1 : pair.y0;
          const cvx = g ? pair.vx1 : pair.vx0;
          const cvy = g ? pair.vy1 : pair.vy0;
          const spin = g ? pair.spin1 : 1;
          const a = Math.random() * Math.PI * 2;
          // Filled disc, softly banded by species — see the scatter pass in webgpu.ts.
          const j = (Math.random() - 0.5) * 1.6;
          const f = Math.min(1, Math.max(0.02, (sim.species[i] + 0.5 + j) / 6));
          const r = Math.max(0.05, PAIR_DISC_R * Math.sqrt(f));
          const vOrb = Math.sqrt(PAIR_MASS / r) * spin;
          pos[i * 2] = cx + Math.cos(a) * r;
          pos[i * 2 + 1] = cy + Math.sin(a) * r;
          vel[i * 2] = cvx - Math.sin(a) * vOrb;
          vel[i * 2 + 1] = cvy + Math.cos(a) * vOrb;
        } else {
          // Galaxy: re-seed the orbital disc, or the grains just rain into the core.
          const a = Math.random() * Math.PI * 2;
          const r = Math.max(0.03, Math.sqrt(Math.random()) * 0.65);
          const vOrb = circularSpeed(r) * 0.94;
          pos[i * 2] = Math.cos(a) * r;
          pos[i * 2 + 1] = Math.sin(a) * r;
          vel[i * 2] = -Math.sin(a) * vOrb;
          vel[i * 2 + 1] = Math.cos(a) * vOrb;
        }
      }
      for (const [buf, data] of [
        [posA, pos],
        [posB, pos],
        [velA, vel],
        [velB, vel],
      ] as const) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      }
    },

    frame(dt: number, mx: number, my: number) {
      // --- integrate: TF pass, no rasterization ---
      gl.useProgram(simProg);
      gl.uniform1f(simLoc.uDt, dt);
      gl.uniform2f(simLoc.uMouse, mx, my);
      gl.uniform1i(simLoc.uMode, mode);
      elapsed += dt;
      gl.uniform1f(simLoc.uTime, elapsed);
      // Same wide frequency sweep as the WebGPU path — see webgpu.ts.
      const drift = mode === 1 ? Math.sin(elapsed * 0.11) * 1.4 : 0;
      gl.uniform1f(simLoc.uWarp, mode === 1 ? 1 + (mx * 0.5 + 0.5) * 12 + drift : 0);
      gl.uniform1f(simLoc.uWarpM, mode === 1 ? 1 + (my * 0.5 + 0.5) * 12 + drift : 0);
      gl.uniform1f(simLoc.uGCursor, cursorMass);
      gl.uniform2f(simLoc.uC0, pair ? pair.x0 : 0, pair ? pair.y0 : 0);
      gl.uniform2f(simLoc.uC1, pair ? pair.x1 : 0, pair ? pair.y1 : 0);
      gl.uniform1f(simLoc.uPMass, PAIR_MASS);

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
      gl.uniform1f(drawLoc.uGain, Math.min(1, Math.max(0.6, 200_000 / count)));
      gl.uniform1f(drawLoc.uScale, mode === 2 ? 0.55 : 1.0);
      gl.uniform1i(drawLoc.uMask, mask);

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
