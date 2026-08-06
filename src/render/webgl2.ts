/**
 * WebGL2 fallback. Integration runs on the GPU via transform feedback with the
 * rasterizer discarded, then a second instanced pass draws the result. Same
 * property as the WebGPU path: particle data never returns to JS.
 *
 * Ping-pong is required because a buffer cannot be both TF output and vertex
 * input in the same draw.
 */

import type { Sim } from '../sim/world';
import type { Backend } from './backend';

const SIM_VS = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aVel;
out vec2 vPos;
out vec2 vVel;
uniform float uDt;
uniform vec2 uMouse;

void main() {
  vec2 d = uMouse - aPos;
  float d2 = dot(d, d) + 0.004;
  float r = sqrt(d2);

  // Must stay bit-comparable with the WGSL path — see webgpu.ts.
  float f = 0.45 / (d2 * r) - 0.0025 / (d2 * d2);
  vec2 tangent = vec2(-d.y, d.x) / r;

  vec2 v = (aVel + d * f * uDt + tangent * 0.28 * uDt) * 0.9992;
  vec2 p = aPos + v * uDt;

  if (p.x < -1.0) { p.x = -1.0; v.x = -v.x; }
  else if (p.x > 1.0) { p.x = 1.0; v.x = -v.x; }
  if (p.y < -1.0) { p.y = -1.0; v.y = -v.y; }
  else if (p.y > 1.0) { p.y = 1.0; v.y = -v.y; }

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
out vec2 vUv;
out float vSpeed;
uniform float uAspect;

void main() {
  float size = 0.0035;
  vUv = aCorner;
  vSpeed = clamp(length(aVel) * 0.7, 0.0, 1.0);
  gl_Position = vec4(
    aPos.x + aCorner.x * size / uAspect,
    aPos.y + aCorner.y * size,
    0.0, 1.0
  );
}`;

const DRAW_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vSpeed;
out vec4 o;

void main() {
  float r = dot(vUv, vUv);
  if (r > 1.0) discard;
  float a = (1.0 - r) * (1.0 - r);
  vec3 rgb = mix(vec3(0.25, 0.62, 1.0), vec3(1.0, 0.78, 0.42), vSpeed);
  o = vec4(rgb * a, a);
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

  const simProg = link(gl, SIM_VS, SIM_FS, ['vPos', 'vVel']);
  const drawProg = link(gl, DRAW_VS, DRAW_FS);

  const simLoc = {
    aPos: gl.getAttribLocation(simProg, 'aPos'),
    aVel: gl.getAttribLocation(simProg, 'aVel'),
    uDt: gl.getUniformLocation(simProg, 'uDt'),
    uMouse: gl.getUniformLocation(simProg, 'uMouse'),
  };
  const drawLoc = {
    aPos: gl.getAttribLocation(drawProg, 'aPos'),
    aVel: gl.getAttribLocation(drawProg, 'aVel'),
    aCorner: gl.getAttribLocation(drawProg, 'aCorner'),
    uAspect: gl.getUniformLocation(drawProg, 'uAspect'),
  };

  const tf = gl.createTransformFeedback()!;
  let count = sim.count;

  const bindAttrib = (buf: WebGLBuffer, loc: number, divisor = 0) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(loc, divisor);
  };

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

    frame(dt: number, mx: number, my: number) {
      // --- integrate: TF pass, no rasterization ---
      gl.useProgram(simProg);
      gl.uniform1f(simLoc.uDt, dt);
      gl.uniform2f(simLoc.uMouse, mx, my);

      bindAttrib(posA, simLoc.aPos);
      bindAttrib(velA, simLoc.aVel);

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
      bindAttrib(cornerBuf, drawLoc.aCorner, 0);
      bindAttrib(posB, drawLoc.aPos, 1);
      bindAttrib(velB, drawLoc.aVel, 1);
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
      for (const b of [posA, posB, velA, velB, cornerBuf]) gl.deleteBuffer(b);
      gl.deleteTransformFeedback(tf);
    },
  };
}
