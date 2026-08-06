(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const a of i)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function e(i){const a={};return i.integrity&&(a.integrity=i.integrity),i.referrerPolicy&&(a.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?a.credentials="include":i.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(i){if(i.ep)return;i.ep=!0;const a=e(i);fetch(i.href,a)}})();const G=240,H=240,_=40,xe=new Float32Array(G);class Ze{root;spark;sctx;frames=new Float32Array(G);head=0;filled=0;last=performance.now();dropped=0;total=0;longTasks=0;longTaskMs=0;refreshMs=16.67;fastest=1/0;textEls={};lastPaint=0;constructor(s){this.root=s,this.root.innerHTML="",this.spark=document.createElement("canvas"),this.spark.width=H*devicePixelRatio,this.spark.height=_*devicePixelRatio,this.spark.style.width=H+"px",this.spark.style.height=_+"px",this.spark.className="hud-spark",this.root.appendChild(this.spark);const e=this.spark.getContext("2d");if(!e)throw new Error("2D context unavailable for HUD sparkline");this.sctx=e,this.sctx.scale(devicePixelRatio,devicePixelRatio);for(const n of["fps","p50","p99","dropped","longtask","heap","entities","dom","effects","backend","arm"]){const i=document.createElement("div");i.className="hud-row";const a=document.createElement("span");a.className="hud-label",a.textContent=n;const o=document.createElement("span");o.className="hud-val",o.textContent="—",i.append(a,o),this.root.appendChild(i),this.textEls[n]=o}this.observeLongTasks()}observeLongTasks(){if(!("PerformanceObserver"in window))return;if(!PerformanceObserver.supportedEntryTypes?.includes("longtask")){this.textEls.longtask.textContent="unsupported";return}new PerformanceObserver(e=>{for(const n of e.getEntries())this.longTasks++,this.longTaskMs+=n.duration}).observe({entryTypes:["longtask"]})}frame(s){const e=s-this.last;this.last=s,this.total++,e>0&&e<1e3&&(this.frames[this.head]=e,this.head=(this.head+1)%G,this.filled<G&&this.filled++,e<this.fastest&&e>=4&&(this.fastest=e),this.refreshMs=Math.min(this.fastest,1e3/60),e>this.refreshMs*1.5&&this.dropped++)}paint(s,e){if(s-this.lastPaint<200)return;this.lastPaint=s;const n=this.filled;if(n===0)return;xe.set(this.frames.subarray(0,n));const i=xe.subarray(0,n);i.sort();const a=i[n*.5|0],o=i[Math.min(n-1,n*.99|0)];let f=0;for(let l=0;l<n;l++)f+=i[l];const u=f/n;this.textEls.fps.textContent=(1e3/u).toFixed(0),this.textEls.p50.textContent=a.toFixed(2)+" ms",this.textEls.p99.textContent=o.toFixed(2)+" ms",this.setWarn(this.textEls.p99,o>this.refreshMs*1.5);const r=this.total>0?this.dropped/this.total*100:0;this.textEls.dropped.textContent=`${this.dropped} (${r.toFixed(1)}%)`,this.setWarn(this.textEls.dropped,r>1),this.textEls.longtask.textContent!=="unsupported"&&(this.textEls.longtask.textContent=`${this.longTasks} / ${this.longTaskMs.toFixed(0)} ms`,this.setWarn(this.textEls.longtask,this.longTasks>0));const c=performance.memory;this.textEls.heap.textContent=c?(c.usedJSHeapSize/1048576).toFixed(1)+" MB":"n/a",this.textEls.entities.textContent=e.entities.toLocaleString(),this.textEls.dom.textContent=e.domNodes.toLocaleString(),this.textEls.effects.textContent=`${e.effectRuns} / ${this.total} frames`,this.textEls.backend.textContent=e.backend,this.textEls.arm.textContent=e.arm,this.drawSpark()}setWarn(s,e){s.className=e?"hud-val warn":"hud-val"}drawSpark(){const s=this.sctx,e=this.refreshMs,n=_/(e*2);s.clearRect(0,0,H,_),s.strokeStyle="rgba(120,200,255,0.25)",s.beginPath(),s.moveTo(0,_-e*n),s.lineTo(H,_-e*n),s.stroke(),s.strokeStyle="#6cf",s.lineWidth=1,s.beginPath();const i=this.filled,a=H/G;for(let o=0;o<i;o++){const f=(this.head-i+o+G*2)%G,u=_-Math.min(_,this.frames[f]*n),r=o*a;o===0?s.moveTo(r,u):s.lineTo(r,u)}s.stroke()}reset(){this.frames.fill(0),this.head=0,this.filled=0,this.dropped=0,this.total=0,this.longTasks=0,this.longTaskMs=0,this.last=performance.now(),this.fastest=1/0,this.refreshMs=1e3/60}}const O=4,te=.45,ge=.55,et=.1,pe=3,Me=.995,K=6,oe=["argon","boron","cesium","dysprosium","erbium","fermium"],be=[[.29,.62,1],[1,.45,.62],[.42,1,.72],[1,.76,.33],[.72,.55,1],[.35,.95,1]];function tt(t){return function(){t|=0,t=t+1831565813|0;let s=Math.imul(t^t>>>15,1|t);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}function st(t,s=2654435769){const e=new Float32Array(t*O),n=new Uint8Array(t),i=new Float32Array(t),a=tt(s);for(let o=0;o<t;o++){const f=o*O,u=a()*Math.PI*2,r=Math.sqrt(a())*.65;e[f]=Math.cos(u)*r,e[f+1]=Math.sin(u)*r;const c=Math.sqrt(ge/Math.max(r,.06))*.94;e[f+2]=-Math.sin(u)*c,e[f+3]=Math.cos(u)*c;const l=r/.65*K,p=(a()-.5)*1.6;n[o]=Math.max(0,Math.min(K-1,l+p|0)),i[o]=a()}return{particles:e,species:n,stat:i,capacity:t,count:t}}function Be(t,s,e,n){const i=t.particles,a=t.count,o=.99995;for(let f=0;f<a;f++){const u=f*O,r=i[u],c=i[u+1],l=-r,p=-c,m=l*l+p*p+.004,h=Math.sqrt(m),g=ge/(m*h)-.0025/(m*m),b=e-r,y=n-c,x=b*b+y*y+.02,A=et/(x*Math.sqrt(x));let w=i[u+2]+l*g*s+b*A*s,P=i[u+3]+p*g*s+y*A*s;const T=l/h,S=p/h,R=w*T+P*S;w=w-R*T+R*T*Me,P=P-R*S+R*S*Me,w*=o,P*=o;const k=Math.hypot(w,P);k>pe&&(w*=pe/k,P*=pe/k);let C=r+w*s,d=c+P*s;C<-1?(C=-1,w=-w*te):C>1&&(C=1,w=-w*te),d<-1?(d=-1,P=-P*te):d>1&&(d=1,P=-P*te),i[u]=C,i[u+1]=d,i[u+2]=w,i[u+3]=P}}const Se=new Float32Array([0,1,1,0,0,2,2,0,1,3,3,1]);function Ee(t){let s=Math.imul(t,747796405)+2891336453;return s=Math.imul(s>>>(s>>>28)+4^s,277803737),((s>>>22^s)>>>0)/4294967296}function nt(t,s,e){const n=Math.sin(e*.11)*1.4;return{n:1+(t*.5+.5)*12+n,m:1+(s*.5+.5)*12+n}}function it(t,s,e,n,i){const a=t.particles,o=t.count,f=i*60|0;for(let u=0;u<o;u++){const r=u*O,c=t.species[u],l=e+Se[c*2],p=n+Se[c*2+1],m=(a[r]+1)*.5,h=(a[r+1]+1)*.5,g=Math.cos(l*Math.PI*m),b=Math.cos(p*Math.PI*h),y=Math.cos(p*Math.PI*m),x=Math.cos(l*Math.PI*h),A=g*b-y*x,w=-l*Math.PI*Math.sin(l*Math.PI*m)*b+p*Math.PI*Math.sin(p*Math.PI*m)*x,P=-p*Math.PI*g*Math.sin(p*Math.PI*h)+l*Math.PI*y*Math.sin(l*Math.PI*h),T=Math.sign(A)*.5,S=Math.abs(A),R=Ee(u*2+f)-.5,k=Ee(u*2+1+f)-.5,C=(a[r+2]-w*T*2.4*s+R*S*2.2*s)*.86,d=(a[r+3]-P*T*2.4*s+k*S*2.2*s)*.86;a[r]=Math.max(-1,Math.min(1,a[r]+C*s)),a[r+1]=Math.max(-1,Math.min(1,a[r+1]+d*s)),a[r+2]=C,a[r+3]=d}}function rt(t,s,e){const n=t.particles;for(let i=0;i<s;i++){const a=i*O;if(e===1)n[a]=Math.random()*2-1,n[a+1]=Math.random()*2-1,n[a+2]=0,n[a+3]=0;else{const o=Math.random()*Math.PI*2,f=Math.sqrt(Math.random())*.65,u=Math.sqrt(ge/Math.max(f,.06))*.94;n[a]=Math.cos(o)*f,n[a+1]=Math.sin(o)*f,n[a+2]=-Math.sin(o)*u,n[a+3]=Math.cos(o)*u}}}function at({update:t,notify:s,unwatched:e}){return{link:n,unlink:i,propagate:a,checkDirty:o,shallowPropagate:f};function n(r,c,l){const p=c.depsTail;if(p!==void 0&&p.dep===r)return;const m=p!==void 0?p.nextDep:c.deps;if(m!==void 0&&m.dep===r){m.version=l,c.depsTail=m;return}const h=r.subsTail;if(h!==void 0&&h.version===l&&h.sub===c)return;const g=c.depsTail=r.subsTail={version:l,dep:r,sub:c,prevDep:p,nextDep:m,prevSub:h,nextSub:void 0};m!==void 0&&(m.prevDep=g),p!==void 0?p.nextDep=g:c.deps=g,h!==void 0?h.nextSub=g:r.subs=g}function i(r,c=r.sub){const{dep:l,prevDep:p,nextDep:m,nextSub:h,prevSub:g}=r;return m!==void 0?m.prevDep=p:c.depsTail=p,p!==void 0?p.nextDep=m:c.deps=m,h!==void 0?h.prevSub=g:l.subsTail=g,g!==void 0?g.nextSub=h:(l.subs=h)===void 0&&e(l),m}function a(r,c){let l=r.nextSub,p;e:do{const m=r.sub;let h=m.flags;if(h&60?h&12?h&4?!(h&48)&&u(r,m)?(m.flags=h|40,h&=1):h=0:m.flags=h&-9|32:h=0:(m.flags=h|32,c&&(m.flags|=8)),h&2&&s(m),h&1){const g=m.subs;if(g!==void 0){const b=(r=g).nextSub;b!==void 0&&(p={value:l,prev:p},l=b);continue}}if((r=l)!==void 0){l=r.nextSub;continue}for(;p!==void 0;)if(r=p.value,p=p.prev,r!==void 0){l=r.nextSub;continue e}break}while(!0)}function o(r,c){let l,p=0,m=!1;e:do{const h=r.dep,g=h.flags;if(c.flags&16)m=!0;else if((g&17)===17){const b=h.subs;t(h)&&(b.nextSub!==void 0&&f(b),m=!0)}else if((g&33)===33){l={value:r,prev:l},r=h.deps,c=h,++p;continue}if(!m){const b=r.nextDep;if(b!==void 0){r=b;continue}}for(;p--;){if(r=l.value,l=l.prev,m){const y=c.subs;if(t(c)){y.nextSub!==void 0&&f(y),c=r.sub;continue}m=!1}else c.flags&=-33;c=r.sub;const b=r.nextDep;if(b!==void 0){r=b;continue e}}return m&&!!c.flags}while(!0)}function f(r){do{const c=r.sub,l=c.flags;(l&48)===32&&(c.flags=l|16,(l&6)===2&&s(c))}while((r=r.nextSub)!==void 0)}function u(r,c){let l=c.depsTail;for(;l!==void 0;){if(l===r)return!0;l=l.prevDep}return!1}}const ie=64;let ce=0,X=0,N=0,Y=0,I;const F=[],{link:ye,unlink:Z,propagate:ot,checkDirty:Le,shallowPropagate:De}=at({update(t){return"getter"in t?Fe(t):"currentValue"in t?Oe(t):(t.flags=1,!0)},notify(t){let s=Y,e=s;do if(F[s++]=t,t.flags&=-3,t=t.subs?.sub,t===void 0||!(t.flags&2))break;while(!0);for(Y=s;e<--s;){const n=F[e];F[e++]=F[s],F[s]=n}},unwatched(t){"getter"in t?t.depsTail!==void 0&&(t.flags=17,Ve(t)):"currentValue"in t||("fn"in t?Ne.call(t):Ge.call(t))}});function le(t){const s=I;return I=t,s}function de(t){return ft.bind({currentValue:t,pendingValue:t,subs:void 0,subsTail:void 0,flags:1})}function Ue(t){return ut.bind({value:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:0,getter:t})}function ct(t){const s={fn:t,cleanup:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:6},e=le(s);e!==void 0&&(ye(s,e,0),e.flags|=ie);try{++X,s.cleanup=s.fn()}finally{--X,I=e,s.flags&=-5}return Ne.bind(s)}function Fe(t){if(t.flags&ie){let e=t.depsTail;for(;e!==void 0;){const n=e.prevDep,i=e.dep;!("getter"in i)&&!("currentValue"in i)&&Z(e,t),e=n}}t.depsTail=void 0,t.flags=5;const s=le(t);try{++ce;const e=t.value;return e!==(t.value=t.getter(e))}finally{I=s,t.flags&=-5,We(t)}}function Oe(t){return t.flags=1,t.currentValue!==(t.currentValue=t.pendingValue)}function lt(t){const s=t.flags;if(s&16||s&32&&Le(t.deps,t)){if(s&ie){let n=t.depsTail;for(;n!==void 0;){const i=n.prevDep,a=n.dep;!("getter"in a)&&!("currentValue"in a)&&Z(n,t),n=i}}if(t.cleanup&&(_e(t),!t.flags))return;t.depsTail=void 0,t.flags=6;const e=le(t);try{++ce,++X,t.cleanup=t.fn()}finally{--X,I=e,t.flags&=-5,We(t)}}else t.deps!==void 0&&(t.flags=2|s&ie)}function dt(){try{for(;N<Y;){const t=F[N];F[N++]=void 0,lt(t)}}finally{for(;N<Y;){const t=F[N];F[N++]=void 0,t.flags|=10}N=0,Y=0}}function ut(){const t=this.flags;if(t&16||t&32&&(Le(this.deps,this)||(this.flags=t&-33,!1))){if(Fe(this)){const e=this.subs;e!==void 0&&De(e)}}else if(!t){this.flags=5;const e=le(this);try{this.value=this.getter()}finally{I=e,this.flags&=-5}}const s=I;return s!==void 0&&ye(this,s,ce),this.value}function ft(...t){if(t.length){if(this.pendingValue!==(this.pendingValue=t[0])){this.flags=17;const s=this.subs;s!==void 0&&(ot(s,!!X),dt())}}else{if(this.flags&16&&Oe(this)){const e=this.subs;e!==void 0&&De(e)}const s=I;return s!==void 0&&ye(this,s,ce),this.currentValue}}function _e(t){const s=t.cleanup;t.cleanup=void 0;const e=I;I=void 0;try{s()}finally{I=e}}function Ne(){Ge.call(this),this.cleanup&&_e(this)}function Ge(){this.flags=0,Ve(this);const t=this.subs;t!==void 0&&Z(t)}function Ve(t){let s=t.depsTail;for(;s!==void 0;){const e=s.prevDep;Z(s,t),s=e}}function We(t){const s=t.depsTail;let e=s!==void 0?s.nextDep:t.deps;for(;e!==void 0;)e=Z(e,t)}const j=de((1<<K)-1),pt=de(-1),ue=de("gpu");de(0);const ht=Ue(()=>{const t=j(),s=[];for(let e=0;e<K;e++)t&1<<e&&s.push(e);return s}),mt=Ue(()=>{const t=ht();return t.length===K?"all species":t.length===0?"none":t.map(s=>oe[s]).join(", ")});function vt(t){j(j()^1<<t)}let ze=0;const $e=()=>ze;function gt(t){return ct(()=>{ze++,t()})}const ne=4096,se=24,Ae=4;class bt{constructor(s,e,n,i){this.sim=n,this.backend=i,this.viewport=s,this.spacer=e,this.filtered=new Uint32Array(n.capacity),this.poolIds=new Int32Array(0),this.buildPool(),this.refilter(),this.viewport.addEventListener("scroll",()=>{this.scrollTop=this.viewport.scrollTop,this.dirty=!0},{passive:!0}),new ResizeObserver(()=>{this.buildPool(),this.dirty=!0}).observe(this.viewport)}viewport;spacer;pool=[];poolIds;filtered;filteredCount=0;scrollTop=0;poolSize=0;dirty=!0;live=new Float32Array(0);liveBase=0;liveCount=0;readPending=!1;lastRead=0;buildPool(){const s=Math.ceil(this.viewport.clientHeight/se)+Ae*2;if(s!==this.poolSize){for(;this.pool.length<s;){const e=document.createElement("div");e.className="row";const n=document.createElement("span");n.className="id";const i=document.createElement("span");i.className="sp";const a=document.createElement("div");a.className="bar";const o=document.createElement("span");o.className="v",e.append(n,i,a,o);const f=this.pool.length;e.addEventListener("click",()=>{const u=this.poolIds[f];u>=0&&pt(u)}),this.viewport.appendChild(e),this.pool.push(e)}for(;this.pool.length>s;)this.pool.pop().remove();this.poolSize=s,this.poolIds=new Int32Array(s).fill(-1)}}refilter(){const s=j(),{species:e,count:n}=this.sim,i=this.filtered;let a=0;for(let o=0;o<n;o++)s&1<<e[o]&&(i[a++]=o);this.filteredCount=a,this.spacer.style.height=a*se+"px",this.dirty=!0}forceRepaint(){this.poolIds.fill(-1),this.dirty=!0}get rowCount(){return this.filteredCount}get liveNodes(){return this.poolSize}update(){const s=Math.max(0,(this.scrollTop/se|0)-Ae),e=Math.min(this.filteredCount,s+this.poolSize);if(this.scheduleReadback(s,e),!!this.dirty){this.dirty=!1;for(let n=0;n<this.poolSize;n++){const i=s+n,a=this.pool[n];if(i>=e){this.poolIds[n]!==-1&&(a.style.visibility="hidden",this.poolIds[n]=-1);continue}const o=this.filtered[i];if(this.poolIds[n]!==o){this.poolIds[n]=o;const u=this.sim.species[o],[r,c,l]=be[u],p=`rgb(${r*255|0} ${c*255|0} ${l*255|0})`;a.style.visibility="visible",a.children[0].textContent=String(o),a.children[1].textContent=oe[u],a.children[1].style.color=p,a.children[2].style.background=p}a.style.transform=`translateY(${i*se}px)`;const f=this.readLive(o);a.children[2].style.transform=`scaleX(${f.toFixed(3)})`,a.children[3].textContent=f.toFixed(4)}}}readLive(s){if(this.liveCount>0){const e=s-this.liveBase;if(e>=0&&e<this.liveCount){const n=e*O,i=this.live[n+2],a=this.live[n+3];return Math.min(1,Math.hypot(i,a)*.7)}}return this.sim.stat[s]}scheduleReadback(s,e){if(this.readPending||e<=s||!this.backend.readback)return;const n=performance.now();if(n-this.lastRead<80)return;this.lastRead=n;const i=this.filtered[s],o=this.filtered[Math.max(s,e-1)]-i+1;o<=0||o>ne||(this.readPending=!0,this.backend.readback(i,o).then(f=>{this.live=f,this.liveBase=i,this.liveCount=f.length/O,this.dirty=!0}).catch(()=>{}).finally(()=>{this.readPending=!1}))}}const he=64,yt=`
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
  _pad0  : f32,
};

// Primary attractor strength. Fixed at the origin -- see the integrate entry
// point. (No backticks in here: this block lives inside a JS template literal.)
const G_CORE = 0.55;
// Cursor mass, deliberately a fraction of the core so it perturbs, not destroys.
const G_CURSOR = 0.10;
// Terminal speed. Without it a close cursor pass flings grains off to infinity.
const V_MAX = 3.0;

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
 * Uniformly redistribute the population. Dispatched once when entering Chladni
 * mode: the plate has to start as evenly spread sand. Arriving from the galaxy
 * with everything piled in the core produces one bright diagonal and nothing
 * else, because a grain that reaches a node has zero vibration amplitude and
 * never moves again.
 */
@compute @workgroup_size(${he})
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

  // Galaxy: re-seed the orbital disc. Returning from Chladni would otherwise
  // leave a million grains sitting on nodal lines with zero angular momentum,
  // and they would simply rain into the core.
  let a = hash(i * 3u) * 6.2831853;
  let r = sqrt(hash(i * 3u + 1u)) * 0.65;
  let vOrb = sqrt(G_CORE / max(r, 0.06)) * 0.94;
  parts[i] = vec4<f32>(cos(a) * r, sin(a) * r, -sin(a) * vOrb, cos(a) * vOrb);
}

@compute @workgroup_size(${he})
fn integrate(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }

  var p = parts[i];
  let dt = params.dt;

  if (params.mode == 1u) {
    parts[i] = chladni(i, p, dt);
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
  // Attraction minus a short-range repulsive core. Without the second term the
  // whole population collapses to a single point.
  let fc = G_CORE / (dc2 * rc) - 0.0025 / (dc2 * dc2);

  // Secondary: the cursor. Softened harder so a direct hit shears rather than
  // slingshots.
  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let dm2 = dot(dm, dm) + 0.02;
  let fm = G_CURSOR / (dm2 * sqrt(dm2));

  var v = p.zw + dc * fc * dt + dm * fm * dt;

  // Damp the RADIAL component only.
  //
  // Uniform damping looks harmless and is not: it bleeds orbital speed, orbits
  // shrink, and within ten seconds the whole disc has inspiralled into one dense
  // ball. Damping only the radial component removes eccentricity while leaving
  // angular momentum intact, which is what real accretion discs do — orbits
  // circularize instead of decaying. The practical payoff is that the disc
  // actively re-forms after the cursor stirs it, rather than staying wrecked.
  let rdir = dc / rc;
  let vRad = dot(v, rdir) * rdir;
  v = (v - vRad) + vRad * 0.995;

  // Whisper of global damping purely to bound energy the moving cursor injects.
  v = v * 0.99995;

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }

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
`;async function Pt(t,s){if(!navigator.gpu)return null;const e=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!e)return null;const n=await e.requestDevice();n.addEventListener("uncapturederror",v=>{console.error("[webgpu]",v.error.message)});const i=t.getContext("webgpu");if(!i)return null;const a=navigator.gpu.getPreferredCanvasFormat();i.configure({device:n,format:a,alphaMode:"premultiplied"});const o=n.createBuffer({size:s.particles.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});n.queue.writeBuffer(o,0,s.particles);const f=n.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),u=new ArrayBuffer(48),r=new Float32Array(u),c=new Uint32Array(u),l=new Uint32Array(s.capacity);for(let v=0;v<s.capacity;v++)l[v]=s.species[v];const p=n.createBuffer({size:l.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(p,0,l);let m=63,h=0,g=0,b=!1;const y=n.createBuffer({size:ne*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),x=new Float32Array(ne*4),A=n.createShaderModule({code:yt}),w=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}}]}),P=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),T=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[w]}),compute:{module:A,entryPoint:"integrate"}}),S=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[w]}),compute:{module:A,entryPoint:"scatter"}}),R=n.createRenderPipeline({layout:n.createPipelineLayout({bindGroupLayouts:[P]}),vertex:{module:A,entryPoint:"vs"},fragment:{module:A,entryPoint:"fs",targets:[{format:a,blend:{color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),k=n.createBindGroup({layout:w,entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:p}}]}),C=n.createBindGroup({layout:P,entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:p}}]});let d=s.count;return{name:"webgpu",detail:`${e.info?.vendor??"gpu"} ${e.info?.architecture??""}`.trim(),setCount(v){d=Math.min(v,s.capacity)},setSpeciesMask(v){m=v>>>0},setMode(v){h=v|0,b=!0},frame(v,M,E){if(r[0]=v,r[1]=M,r[2]=E,r[3]=t.width/t.height,r[4]=Math.min(.006,Math.max(.0018,.06/Math.sqrt(d))),r[5]=Math.min(1,Math.max(.3,12e4/d)),c[6]=m,c[7]=h,g+=v,r[8]=g,h===1){const we=Math.sin(g*.11)*1.4;r[9]=1+(M*.5+.5)*12+we,r[10]=1+(E*.5+.5)*12+we}else r[9]=0,r[10]=0;n.queue.writeBuffer(f,0,u);const B=n.createCommandEncoder(),W=Math.ceil(d/he),L=B.beginComputePass();b&&(b=!1,L.setPipeline(S),L.setBindGroup(0,k),L.dispatchWorkgroups(W)),L.setPipeline(T),L.setBindGroup(0,k),L.dispatchWorkgroups(W),L.end();const ee=B.beginRenderPass({colorAttachments:[{view:i.getCurrentTexture().createView(),clearValue:{r:.027,g:.035,b:.051,a:1},loadOp:"clear",storeOp:"store"}]});ee.setPipeline(R),ee.setBindGroup(0,C),ee.draw(6,d),ee.end(),n.queue.submit([B.finish()])},resize(v,M){t.width=v,t.height=M},async readback(v,M){const E=Math.max(0,Math.min(v,d-1)),B=Math.max(0,Math.min(M,ne,d-E));if(B===0)return x.subarray(0,0);const W=B*16,L=n.createCommandEncoder();return L.copyBufferToBuffer(o,E*16,y,0,W),n.queue.submit([L.finish()]),await y.mapAsync(GPUMapMode.READ,0,W),x.set(new Float32Array(y.getMappedRange(0,W))),y.unmap(),x.subarray(0,B*4)},destroy(){o.destroy(),f.destroy(),p.destroy(),y.destroy(),n.destroy()}}}const wt=`#version 300 es
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

const float PI = 3.14159265;
const vec2 MODES[6] = vec2[6](
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(0.0, 2.0),
  vec2(2.0, 0.0), vec2(1.0, 3.0), vec2(3.0, 1.0)
);

float hash(vec2 s) {
  return fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
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

  // Must stay comparable with the WGSL path — see webgpu.ts for the reasoning
  // behind an anchored primary plus a weaker cursor secondary.
  vec2 dc = -aPos;
  float dc2 = dot(dc, dc) + 0.004;
  float rc = sqrt(dc2);
  float fc = 0.55 / (dc2 * rc) - 0.0025 / (dc2 * dc2);

  vec2 dm = uMouse - aPos;
  float dm2 = dot(dm, dm) + 0.02;
  float fm = 0.10 / (dm2 * sqrt(dm2));

  vec2 v = aVel + dc * fc * uDt + dm * fm * uDt;

  // Radial-only damping — see webgpu.ts for why uniform damping collapses the disc.
  vec2 rdir = dc / rc;
  vec2 vRad = dot(v, rdir) * rdir;
  v = ((v - vRad) + vRad * 0.995) * 0.99995;

  float speed = length(v);
  if (speed > 3.0) v *= 3.0 / speed;

  vec2 p = aPos + v * uDt;

  float bounce = 0.45;
  if (p.x < -1.0) { p.x = -1.0; v.x = -v.x * bounce; }
  else if (p.x > 1.0) { p.x = 1.0; v.x = -v.x * bounce; }
  if (p.y < -1.0) { p.y = -1.0; v.y = -v.y * bounce; }
  else if (p.y > 1.0) { p.y = 1.0; v.y = -v.y * bounce; }

  vPos = p;
  vVel = v;
}`,xt=`#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`,Mt=`#version 300 es
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
  gl_Position = vec4(
    aPos.x + aCorner.x * uSize / uAspect,
    aPos.y + aCorner.y * uSize,
    0.0, 1.0
  );
}`,St=`#version 300 es
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
}`;function Re(t,s,e){const n=t.createShader(s);if(t.shaderSource(n,e),t.compileShader(n),!t.getShaderParameter(n,t.COMPILE_STATUS))throw new Error("shader compile failed: "+t.getShaderInfoLog(n));return n}function Ce(t,s,e,n){const i=t.createProgram();if(t.attachShader(i,Re(t,t.VERTEX_SHADER,s)),t.attachShader(i,Re(t,t.FRAGMENT_SHADER,e)),n&&t.transformFeedbackVaryings(i,n,t.SEPARATE_ATTRIBS),t.linkProgram(i),!t.getProgramParameter(i,t.LINK_STATUS))throw new Error("program link failed: "+t.getProgramInfoLog(i));return i}function Et(t,s){const e=t.getContext("webgl2",{alpha:!1,antialias:!1});if(!e)return null;const n=s.capacity,i=new Float32Array(n*2),a=new Float32Array(n*2);for(let d=0;d<n;d++)i[d*2]=s.particles[d*4],i[d*2+1]=s.particles[d*4+1],a[d*2]=s.particles[d*4+2],a[d*2+1]=s.particles[d*4+3];const o=d=>{const v=e.createBuffer();return e.bindBuffer(e.ARRAY_BUFFER,v),e.bufferData(e.ARRAY_BUFFER,d,e.DYNAMIC_COPY),v};let f=o(i),u=o(a),r=o(i),c=o(a);const l=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),p=o(l),m=new Float32Array(n);for(let d=0;d<n;d++)m[d]=s.species[d];const h=o(m),g=Ce(e,wt,xt,["vPos","vVel"]),b=Ce(e,Mt,St),y={aPos:e.getAttribLocation(g,"aPos"),aVel:e.getAttribLocation(g,"aVel"),aSpecies:e.getAttribLocation(g,"aSpecies"),uDt:e.getUniformLocation(g,"uDt"),uMouse:e.getUniformLocation(g,"uMouse"),uMode:e.getUniformLocation(g,"uMode"),uTime:e.getUniformLocation(g,"uTime"),uWarp:e.getUniformLocation(g,"uWarp"),uWarpM:e.getUniformLocation(g,"uWarpM")},x={aPos:e.getAttribLocation(b,"aPos"),aVel:e.getAttribLocation(b,"aVel"),aCorner:e.getAttribLocation(b,"aCorner"),aSpecies:e.getAttribLocation(b,"aSpecies"),uAspect:e.getUniformLocation(b,"uAspect"),uSize:e.getUniformLocation(b,"uSize"),uGain:e.getUniformLocation(b,"uGain"),uMask:e.getUniformLocation(b,"uMask")},A=e.createTransformFeedback();let w=s.count;const P=(d,v,M=0,E=2)=>{e.bindBuffer(e.ARRAY_BUFFER,d),e.enableVertexAttribArray(v),e.vertexAttribPointer(v,E,e.FLOAT,!1,0,0),e.vertexAttribDivisor(v,M)};let T=63,S=0,R=0;const k=e.getExtension("WEBGL_debug_renderer_info"),C=String(k?e.getParameter(k.UNMASKED_RENDERER_WEBGL):e.getParameter(e.RENDERER));return e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),{name:"webgl2",detail:C,setCount(d){w=Math.min(d,s.capacity)},setSpeciesMask(d){T=d>>>0},setMode(d){S=d|0;for(let v=0;v<n;v++)if(S===1)i[v*2]=Math.random()*2-1,i[v*2+1]=Math.random()*2-1,a[v*2]=0,a[v*2+1]=0;else{const M=Math.random()*Math.PI*2,E=Math.sqrt(Math.random())*.65,B=Math.sqrt(.55/Math.max(E,.06))*.94;i[v*2]=Math.cos(M)*E,i[v*2+1]=Math.sin(M)*E,a[v*2]=-Math.sin(M)*B,a[v*2+1]=Math.cos(M)*B}for(const[v,M]of[[f,i],[r,i],[u,a],[c,a]])e.bindBuffer(e.ARRAY_BUFFER,v),e.bufferSubData(e.ARRAY_BUFFER,0,M)},frame(d,v,M){e.useProgram(g),e.uniform1f(y.uDt,d),e.uniform2f(y.uMouse,v,M),e.uniform1i(y.uMode,S),R+=d,e.uniform1f(y.uTime,R);const E=S===1?Math.sin(R*.11)*1.4:0;e.uniform1f(y.uWarp,S===1?1+(v*.5+.5)*12+E:0),e.uniform1f(y.uWarpM,S===1?1+(M*.5+.5)*12+E:0),P(f,y.aPos),P(u,y.aVel),P(h,y.aSpecies,0,1),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,A),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,0,r),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,1,c),e.enable(e.RASTERIZER_DISCARD),e.beginTransformFeedback(e.POINTS),e.drawArrays(e.POINTS,0,w),e.endTransformFeedback(),e.disable(e.RASTERIZER_DISCARD),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,0,null),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,1,null),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,null),e.clearColor(.027,.035,.051,1),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(b),e.uniform1f(x.uAspect,t.width/t.height),e.uniform1f(x.uSize,Math.min(.006,Math.max(.0018,.06/Math.sqrt(w)))),e.uniform1f(x.uGain,Math.min(1,Math.max(.6,2e5/w))),e.uniform1i(x.uMask,T),P(p,x.aCorner,0),P(r,x.aPos,1),P(c,x.aVel,1),P(h,x.aSpecies,1,1),e.drawArraysInstanced(e.TRIANGLES,0,6,w),[f,r]=[r,f],[u,c]=[c,u]},resize(d,v){t.width=d,t.height=v,e.viewport(0,0,d,v)},destroy(){e.deleteProgram(g),e.deleteProgram(b);for(const d of[f,r,u,c,p,h])e.deleteBuffer(d);e.deleteTransformFeedback(A)}}}const z=4e3,Te=400;class At{constructor(s,e,n,i){this.sim=s,this.gpuViewport=i,this.layer=document.createElement("div"),this.layer.id="baseline-layer",e.appendChild(this.layer),this.listHost=document.createElement("div"),this.listHost.id="baseline-list",n.appendChild(this.listHost)}layer;nodes=[];listHost;active=!1;mode=0;elapsed=0;get count(){return z}start(){if(!this.active){this.active=!0,this.layer.style.display="block",this.listHost.style.display="block",this.gpuViewport.style.display="none";for(let s=0;s<z;s++){const e=document.createElement("div");e.className="bp";const[n,i,a]=be[this.sim.species[s]];e.style.background=`rgb(${n*255|0} ${i*255|0} ${a*255|0})`,this.layer.appendChild(e),this.nodes.push(e)}}}stop(){this.active&&(this.active=!1,this.layer.style.display="none",this.layer.replaceChildren(),this.nodes.length=0,this.listHost.innerHTML="",this.listHost.style.display="none",this.gpuViewport.style.display="")}get domNodes(){return this.active?this.nodes.length+Te:0}setMode(s){this.mode=s,this.elapsed=0,rt(this.sim,z,s)}frame(s,e,n){if(!this.active)return;this.elapsed+=s;const i=this.sim.count;if(this.sim.count=z,this.mode===1){const{n:r,m:c}=nt(e,n,this.elapsed);it(this.sim,s,r,c,this.elapsed)}else Be(this.sim,s,e,n);this.sim.count=i;const a=innerWidth,o=innerHeight,f=this.sim.particles;for(let r=0;r<z;r++){const c=r*O,l=this.nodes[r];l.style.left=((f[c]*.5+.5)*a).toFixed(1)+"px",l.style.top=((-f[c+1]*.5+.5)*o).toFixed(1)+"px"}let u="";for(let r=0;r<Te;r++){const c=r*O,l=Math.min(1,Math.hypot(f[c+2],f[c+3])*.22);u+=`<div class="row"><span class="id">${r}</span><span class="sp">${oe[this.sim.species[r]]}</span><span class="v">${l.toFixed(4)}</span></div>`}this.listHost.innerHTML=u}}const qe=new URLSearchParams(location.search),He=Math.max(1,Number(qe.get("n"))||1e6),re=document.getElementById("stage"),ae=new Ze(document.getElementById("hud")),V=st(He),U={entities:0,domNodes:0,arm:"gpu",backend:"booting",effectRuns:0},Rt=qe.get("backend");async function Ct(){if(Rt!=="webgl2")try{const s=await Pt(re,V);if(s)return s}catch(s){console.warn("WebGPU init failed, falling back to WebGL2:",s)}const t=Et(re,V);if(!t)throw new Error("Neither WebGPU nor WebGL2 is available.");return t}let me=0,ve=0;addEventListener("pointermove",t=>{me=t.clientX/innerWidth*2-1,ve=-(t.clientY/innerHeight*2-1)});const D=await Ct();D.setCount(He);U.backend=`${D.name} · ${D.detail}`;const Ye=document.getElementById("list-viewport"),q=new bt(Ye,document.getElementById("list-spacer"),V,D),$=new At(V,document.body,document.getElementById("sidebar"),Ye),Ke=document.getElementById("sidebar-head"),ke=oe.map((t,s)=>{const e=document.createElement("button");e.className="chip",e.textContent=t;const[n,i,a]=be[s];return e.style.setProperty("--c",`rgb(${n*255|0} ${i*255|0} ${a*255|0})`),e.addEventListener("click",()=>vt(s)),Ke.appendChild(e),e}),Pe=document.createElement("div");Pe.className="summary";Ke.appendChild(Pe);gt(()=>{const t=j();for(let s=0;s<ke.length;s++)ke[s].classList.toggle("off",!(t&1<<s));D.setSpeciesMask(t),q.refilter(),Pe.textContent=`${q.rowCount.toLocaleString()} rows · ${mt()}`});const J=document.createElement("div");J.id="banner";document.body.appendChild(J);const Xe=()=>Q===1?"Chladni plate · 6 frequencies":"orbital galaxy";function je(){J.textContent=`${D.name} compute · ${V.count.toLocaleString()} particles · ${Xe()} — [M] mode · [B] compare`}function fe(t){ue(t),t==="baseline"?($.setMode(Q),$.start(),re.style.display="none",J.textContent=`naive DOM · ${z.toLocaleString()} particles as elements · ${Xe()} · sidebar rebuilt per frame — press [B]`):($.stop(),re.style.display="block",q.forceRepaint(),je()),J.className=t,U.arm=t,ae.reset()}let Q=0;function Tt(t){Q=t,D.setMode(Q),ue()==="gpu"?je():fe("baseline")}addEventListener("keydown",t=>{(t.key==="b"||t.key==="B")&&fe(ue()==="gpu"?"baseline":"gpu"),(t.key==="m"||t.key==="M")&&Tt(Q===0?1:0)});function Je(){const t=Math.min(devicePixelRatio,2);D.resize(innerWidth*t|0,innerHeight*t|0)}addEventListener("resize",Je);Je();fe("gpu");globalThis.__demo={sim:V,backend:D,hud:ae,counters:U,integrateCPU:Be,list:q,effectRuns:$e,setArm:fe};let Ie=performance.now();function Qe(t){ae.frame(t);const s=Math.min((t-Ie)/1e3,1/30);Ie=t,ue()==="gpu"?(D.frame(s,me,ve),q.update(),U.entities=V.count,U.domNodes=q.liveNodes):($.frame(s,me,ve),U.entities=$.count,U.domNodes=$.domNodes),U.effectRuns=$e(),ae.paint(t,U),requestAnimationFrame(Qe)}requestAnimationFrame(Qe);
