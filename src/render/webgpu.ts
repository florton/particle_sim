/**
 * WebGPU backend: compute shader integrates, render pipeline draws, and both
 * bind the *same* storage buffer. The particle data never round-trips to JS
 * after upload — the CPU's only per-frame write is a 16-byte uniform.
 */

import type { Sim } from '../sim/world';
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
  _pad0  : f32,
  _pad1  : f32,
};

@group(0) @binding(0) var<storage, read_write> parts : array<vec4<f32>>;
@group(0) @binding(1) var<uniform> params : Params;

@compute @workgroup_size(${WORKGROUP})
fn integrate(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }

  var p = parts[i];
  let dt = params.dt;

  let d = vec2<f32>(params.mx - p.x, params.my - p.y);
  let d2 = dot(d, d) + 0.004;
  let r = sqrt(d2);

  // Attraction minus a short-range repulsive core. Without the second term the
  // whole population collapses onto the cursor within a second and the demo
  // renders as a single white dot.
  let f = 0.45 / (d2 * r) - 0.0025 / (d2 * d2);

  // Tangential component keeps the cloud in orbit rather than radially falling.
  let tangent = vec2<f32>(-d.y, d.x) / r;

  // Damping near 1.0: orbits have to survive thousands of frames.
  var v = (p.zw + d * f * dt + tangent * 0.28 * dt) * 0.9992;
  var pos = p.xy + v * dt;

  if (pos.x < -1.0) { pos.x = -1.0; v.x = -v.x; }
  else if (pos.x > 1.0) { pos.x = 1.0; v.x = -v.x; }
  if (pos.y < -1.0) { pos.y = -1.0; v.y = -v.y; }
  else if (pos.y > 1.0) { pos.y = 1.0; v.y = -v.y; }

  parts[i] = vec4<f32>(pos, v);
}

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
  @location(1) speed : f32,
};

@group(0) @binding(0) var<storage, read> rparts : array<vec4<f32>>;
@group(0) @binding(1) var<uniform> rparams : Params;

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

  var out : VSOut;
  out.pos = vec4<f32>(
    p.x + corner.x * size / rparams.aspect,
    p.y + corner.y * size,
    0.0, 1.0
  );
  out.uv = corner;
  out.speed = clamp(length(p.zw) * 0.22, 0.0, 1.0);
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  // Soft radial falloff; discard outside the disc so quads never show.
  let r = dot(in.uv, in.uv);
  if (r > 1.0) { discard; }
  let a = (1.0 - r) * (1.0 - r);

  let cool = vec3<f32>(0.25, 0.62, 1.0);
  let hot  = vec3<f32>(1.0, 0.78, 0.42);
  let rgb = mix(cool, hot, in.speed);

  // Additive blending sums every overlapping particle. At a million of them the
  // core saturates to flat white unless per-particle contribution scales down
  // with population — gain is set from the live count on the CPU side.
  return vec4<f32>(rgb * a * rparams.gain, a * rparams.gain);
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

  const paramBuf = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Reused every frame; the only per-frame CPU->GPU traffic in the demo (32 bytes).
  const paramData = new Float32Array(8);

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
    ],
  });

  const computePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
    compute: { module, entryPoint: 'integrate' },
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
    ],
  });
  const renderBind = device.createBindGroup({
    layout: renderLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuf } },
      { binding: 1, resource: { buffer: paramBuf } },
    ],
  });

  let count = sim.count;

  return {
    name: 'webgpu',
    detail: `${adapter.info?.vendor ?? 'gpu'} ${adapter.info?.architecture ?? ''}`.trim(),

    setCount(n: number) {
      count = Math.min(n, sim.capacity);
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
      paramData[5] = Math.min(1, Math.max(0.6, 200_000 / count));
      device.queue.writeBuffer(paramBuf, 0, paramData);

      const enc = device.createCommandEncoder();

      const cpass = enc.beginComputePass();
      cpass.setPipeline(computePipeline);
      cpass.setBindGroup(0, computeBind);
      cpass.dispatchWorkgroups(Math.ceil(count / WORKGROUP));
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
      staging.destroy();
      device.destroy();
    },
  };
}
