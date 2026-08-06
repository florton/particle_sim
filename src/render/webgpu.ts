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
  mask   : u32,
  mode   : u32,
  time   : f32,
  warp   : f32,
  _pad0  : f32,
  _pad1  : f32,
};

// Chladni mode pairs (n, m) per species. Each species settles onto the nodal
// lines of its own standing wave, so six figures resolve at once in six colours.
const MODES = array<vec2<f32>, 6>(
  vec2<f32>(1.0, 2.0),
  vec2<f32>(2.0, 3.0),
  vec2<f32>(3.0, 4.0),
  vec2<f32>(1.0, 4.0),
  vec2<f32>(2.0, 5.0),
  vec2<f32>(3.0, 5.0)
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
  let nm = MODES[cspecies[i]];
  // Cursor warps the frequencies live, so the figure reorganizes under the mouse.
  let n = nm.x + params.warp;
  let m = nm.y + params.warp;

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
  parts[i] = vec4<f32>(
    hash(i * 3u) * 2.0 - 1.0,
    hash(i * 3u + 1u) * 2.0 - 1.0,
    0.0, 0.0
  );
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

  let d = vec2<f32>(params.mx - p.x, params.my - p.y);
  let d2 = dot(d, d) + 0.004;
  let r = sqrt(d2);

  // Attraction minus a short-range repulsive core. Without the second term the
  // whole population collapses onto the cursor within a second and the demo
  // renders as a single white dot.
  let f = 0.45 / (d2 * r) - 0.0025 / (d2 * d2);

  // No constant tangential term — rotation comes from the orbital seed in
  // createSim. A constant push pumps energy in every frame and cooks the disc
  // into uniform noise over a few thousand frames. Damping near 1.0 because
  // orbits have to survive that long.
  var v = (p.zw + d * f * dt) * 0.9992;
  var pos = p.xy + v * dt;

  // Inelastic walls: perfectly elastic ones let escapees accumulate speed.
  let bounce = 0.45;
  if (pos.x < -1.0) { pos.x = -1.0; v.x = -v.x * bounce; }
  else if (pos.x > 1.0) { pos.x = 1.0; v.x = -v.x * bounce; }
  if (pos.y < -1.0) { pos.y = -1.0; v.y = -v.y * bounce; }
  else if (pos.y > 1.0) { pos.y = 1.0; v.y = -v.y * bounce; }

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

  out.pos = vec4<f32>(
    p.x + corner.x * size / rparams.aspect,
    p.y + corner.y * size,
    0.0, 1.0
  );
  out.uv = corner;
  out.speed = clamp(length(p.zw) * 0.22, 0.0, 1.0);
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

  const paramBuf = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Reused every frame; the only per-frame CPU->GPU traffic in the demo (32 bytes).
  // Two views over one buffer because `mask` is a u32 among f32s.
  const paramBytes = new ArrayBuffer(48);
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
      // In Chladni mode the cursor bends the frequencies, so dragging across the
      // plate morphs one figure into the next continuously.
      paramData[9] = mode === 1 ? mx * 1.6 : 0;
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
