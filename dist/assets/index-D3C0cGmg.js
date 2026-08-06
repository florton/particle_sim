(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&i(l)}).observe(document,{childList:!0,subtree:!0});function t(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=t(a);fetch(a.href,n)}})();const oe=240,fe=240,X=40,ct=new Float32Array(oe);class Ht{root;spark;sctx;frames=new Float32Array(oe);head=0;filled=0;last=performance.now();dropped=0;total=0;longTasks=0;longTaskMs=0;refreshMs=16.67;fastest=1/0;textEls={};lastPaint=0;constructor(s){this.root=s,this.root.innerHTML="",this.spark=document.createElement("canvas"),this.spark.width=fe*devicePixelRatio,this.spark.height=X*devicePixelRatio,this.spark.style.width=fe+"px",this.spark.style.height=X+"px",this.spark.className="hud-spark",this.root.appendChild(this.spark);const t=this.spark.getContext("2d");if(!t)throw new Error("2D context unavailable for HUD sparkline");this.sctx=t,this.sctx.scale(devicePixelRatio,devicePixelRatio);for(const i of["fps","p50","p99","dropped","longtask","heap","entities","dom","effects","backend","arm"]){const a=document.createElement("div");a.className="hud-row";const n=document.createElement("span");n.className="hud-label",n.textContent=i;const l=document.createElement("span");l.className="hud-val",l.textContent="—",a.append(n,l),this.root.appendChild(a),this.textEls[i]=l}this.observeLongTasks()}observeLongTasks(){if(!("PerformanceObserver"in window))return;if(!PerformanceObserver.supportedEntryTypes?.includes("longtask")){this.textEls.longtask.textContent="unsupported";return}new PerformanceObserver(t=>{for(const i of t.getEntries())this.longTasks++,this.longTaskMs+=i.duration}).observe({entryTypes:["longtask"]})}frame(s){const t=s-this.last;this.last=s,this.total++,t>0&&t<1e3&&(this.frames[this.head]=t,this.head=(this.head+1)%oe,this.filled<oe&&this.filled++,t<this.fastest&&t>=4&&(this.fastest=t),this.refreshMs=Math.min(this.fastest,1e3/60),t>this.refreshMs*1.5&&this.dropped++)}paint(s,t){if(s-this.lastPaint<200)return;this.lastPaint=s;const i=this.filled;if(i===0)return;ct.set(this.frames.subarray(0,i));const a=ct.subarray(0,i);a.sort();const n=a[i*.5|0],l=a[Math.min(i-1,i*.99|0)];let d=0;for(let c=0;c<i;c++)d+=a[c];const p=d/i;this.textEls.fps.textContent=(1e3/p).toFixed(0),this.textEls.p50.textContent=n.toFixed(2)+" ms",this.textEls.p99.textContent=l.toFixed(2)+" ms",this.setWarn(this.textEls.p99,l>this.refreshMs*1.5);const o=this.total>0?this.dropped/this.total*100:0;this.textEls.dropped.textContent=`${this.dropped} (${o.toFixed(1)}%)`,this.setWarn(this.textEls.dropped,o>1),this.textEls.longtask.textContent!=="unsupported"&&(this.textEls.longtask.textContent=`${this.longTasks} / ${this.longTaskMs.toFixed(0)} ms`,this.setWarn(this.textEls.longtask,this.longTasks>0));const r=performance.memory;this.textEls.heap.textContent=r?(r.usedJSHeapSize/1048576).toFixed(1)+" MB":"n/a",this.textEls.entities.textContent=t.entities.toLocaleString(),this.textEls.dom.textContent=t.domNodes.toLocaleString(),this.textEls.effects.textContent=`${t.effectRuns} / ${this.total} frames`,this.textEls.backend.textContent=t.backend,this.textEls.arm.textContent=t.arm,this.drawSpark()}setWarn(s,t){s.className=t?"hud-val warn":"hud-val"}drawSpark(){const s=this.sctx,t=this.refreshMs,i=X/(t*2);s.clearRect(0,0,fe,X),s.strokeStyle="rgba(120,200,255,0.25)",s.beginPath(),s.moveTo(0,X-t*i),s.lineTo(fe,X-t*i),s.stroke(),s.strokeStyle="#6cf",s.lineWidth=1,s.beginPath();const a=this.filled,n=fe/oe;for(let l=0;l<a;l++){const d=(this.head-a+l+oe*2)%oe,p=X-Math.min(X,this.frames[d]*i),o=l*n;l===0?s.moveTo(o,p):s.lineTo(o,p)}s.stroke()}reset(){this.frames.fill(0),this.head=0,this.filled=0,this.dropped=0,this.total=0,this.longTasks=0,this.longTaskMs=0,this.last=performance.now(),this.fastest=1/0,this.refreshMs=1e3/60}}const V=4,Ee=.45,Xe=.42,De=.18,bt=.65,Le=bt/3,Be=.15,w=64,We=1.5,Je=.035,Ze=.05,ze=3,ue=.995,me=6,Ie=We*(2/w);function wt(e){return Xe/(e*Math.sqrt(e))-.0025/(e*e)}function Qe(e){const s=e*e+.004,t=jt(e)/(e*e+Ie*Ie)**1.5;return e*Math.sqrt(Math.max(0,wt(s)+t))}function jt(e){const s=e/Le;return De*(1-(1+s)*Math.exp(-s))}function et(e,s){const t=-Le*(Math.log(Math.max(1e-9,e))+Math.log(Math.max(1e-9,s)));return Math.min(1.1,Math.max(.01,t))}const Ue=["argon","boron","cesium","dysprosium","erbium","fermium"],tt=[[.29,.62,1],[1,.45,.62],[.42,1,.72],[1,.76,.33],[.72,.55,1],[.35,.95,1]];function Yt(e){return function(){e|=0,e=e+1831565813|0;let s=Math.imul(e^e>>>15,1|e);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}function Kt(e,s=2654435769){const t=new Float32Array(e*V),i=new Uint8Array(e),a=new Float32Array(e),n=Yt(s),l=()=>{const d=Math.max(1e-9,n());return Math.sqrt(-2*Math.log(d))*Math.cos(2*Math.PI*n())};for(let d=0;d<e;d++){const p=d*V,o=n()*Math.PI*2,r=et(n(),n());t[p]=Math.cos(o)*r,t[p+1]=Math.sin(o)*r;const c=Qe(r),f=c*Be;t[p+2]=-Math.sin(o)*c+l()*f,t[p+3]=Math.cos(o)*c+l()*f;const u=r/(2.6*Le)*me,h=(n()-.5)*1.6;i[d]=Math.max(0,Math.min(me-1,u+h|0)),a[d]=n()}return{particles:t,species:i,stat:a,capacity:e,count:e}}const Z=w*w,Xt=Ie*Ie,Re=new Float32Array(Z),xt=new Float32Array(Z),Mt=new Float32Array(Z),lt=new Int32Array(Z),He=new Float32Array(Z),je=new Float32Array(Z);for(let e=0;e<w;e++)for(let s=0;s<w;s++)He[e*w+s]=(s+.5)/w*2-1,je[e*w+s]=(e+.5)/w*2-1;function Jt(e,s){Re.fill(0);const t=e.particles,i=De/s;for(let n=0;n<s;n++){const l=n*V,d=(t[l]+1)*.5*w-.5,p=(t[l+1]+1)*.5*w-.5,o=Math.floor(d),r=Math.floor(p),c=d-o,f=p-r;for(let u=0;u<2;u++){const h=Math.min(w-1,Math.max(0,r+u)),g=u?f:1-f;for(let y=0;y<2;y++){const M=Math.min(w-1,Math.max(0,o+y));Re[h*w+M]+=i*(y?c:1-c)*g}}}let a=0;for(let n=0;n<Z;n++)Re[n]>0&&(lt[a++]=n);for(let n=0;n<Z;n++){const l=He[n],d=je[n];let p=0,o=0;for(let r=0;r<a;r++){const c=lt[r],f=He[c]-l,u=je[c]-d,h=f*f+u*u+Xt,g=Re[c]/(h*Math.sqrt(h));p+=f*g,o+=u*g}xt[n]=p,Mt[n]=o}}function St(e,s,t,i,a=ue){const n=e.particles,l=e.count,d=.99995;Jt(e,l);for(let p=0;p<l;p++){const o=p*V,r=n[o],c=n[o+1],f=-r,u=-c,h=f*f+u*u+.004,g=Math.sqrt(h),y=wt(h),M=(r+1)*.5*w-.5,S=(c+1)*.5*w-.5,D=Math.floor(M),A=Math.floor(S),C=M-D,T=S-A;let E=0,R=0;for(let te=0;te<2;te++){const Me=Math.min(w-1,Math.max(0,A+te)),se=te?T:1-T;for(let ie=0;ie<2;ie++){const he=Math.min(w-1,Math.max(0,D+ie)),Se=(ie?C:1-C)*se;E+=xt[Me*w+he]*Se,R+=Mt[Me*w+he]*Se}}const L=t-r,F=i-c,$=L*L+F*F+Ze,m=Je/($*Math.sqrt($));let v=n[o+2]+f*y*s+E*s+L*m*s,x=n[o+3]+u*y*s+R*s+F*m*s;const I=f/g,q=u/g,z=v*I+x*q;v=v-z*I+z*I*a,x=x-z*q+z*q*a,v*=d,x*=d;const Y=Math.hypot(v,x);Y>ze&&(v*=ze/Y,x*=ze/Y);let B=r+v*s,ee=c+x*s;B<-1?(B=-1,v=-v*Ee):B>1&&(B=1,v=-v*Ee),ee<-1?(ee=-1,x=-x*Ee):ee>1&&(ee=1,x=-x*Ee),n[o]=B,n[o+1]=ee,n[o+2]=v,n[o+3]=x}}const dt=new Float32Array([0,1,1,0,0,2,2,0,1,3,3,1]);function ut(e){let s=Math.imul(e,747796405)+2891336453;return s=Math.imul(s>>>(s>>>28)+4^s,277803737),((s>>>22^s)>>>0)/4294967296}function Zt(e,s,t){const i=Math.sin(t*.11)*1.4;return{n:1+(e*.5+.5)*12+i,m:1+(s*.5+.5)*12+i}}function Qt(e,s,t,i,a){const n=e.particles,l=e.count,d=a*60|0;for(let p=0;p<l;p++){const o=p*V,r=e.species[p],c=t+dt[r*2],f=i+dt[r*2+1],u=(n[o]+1)*.5,h=(n[o+1]+1)*.5,g=Math.cos(c*Math.PI*u),y=Math.cos(f*Math.PI*h),M=Math.cos(f*Math.PI*u),S=Math.cos(c*Math.PI*h),D=g*y-M*S,A=-c*Math.PI*Math.sin(c*Math.PI*u)*y+f*Math.PI*Math.sin(f*Math.PI*u)*S,C=-f*Math.PI*g*Math.sin(f*Math.PI*h)+c*Math.PI*M*Math.sin(c*Math.PI*h),T=Math.sign(D)*.5,E=Math.abs(D),R=ut(p*2+d)-.5,L=ut(p*2+1+d)-.5,F=(n[o+2]-A*T*2.4*s+R*E*2.2*s)*.86,$=(n[o+3]-C*T*2.4*s+L*E*2.2*s)*.86;n[o]=Math.max(-1,Math.min(1,n[o]+F*s)),n[o+1]=Math.max(-1,Math.min(1,n[o+1]+$*s)),n[o+2]=F,n[o+3]=$}}function es(e,s,t){const i=e.particles;for(let a=0;a<s;a++){const n=a*V;if(t===1)i[n]=Math.random()*2-1,i[n+1]=Math.random()*2-1,i[n+2]=0,i[n+3]=0;else{const l=Math.random()*Math.PI*2,d=et(Math.random(),Math.random()),p=Qe(d),o=Math.sqrt(-2*Math.log(Math.max(1e-9,Math.random()))),r=2*Math.PI*Math.random();i[n]=Math.cos(l)*d,i[n+1]=Math.sin(l)*d;const c=p*Be;i[n+2]=-Math.sin(l)*p+o*Math.cos(r)*c,i[n+3]=Math.cos(l)*p+o*Math.sin(r)*c}}}function ts({update:e,notify:s,unwatched:t}){return{link:i,unlink:a,propagate:n,checkDirty:l,shallowPropagate:d};function i(o,r,c){const f=r.depsTail;if(f!==void 0&&f.dep===o)return;const u=f!==void 0?f.nextDep:r.deps;if(u!==void 0&&u.dep===o){u.version=c,r.depsTail=u;return}const h=o.subsTail;if(h!==void 0&&h.version===c&&h.sub===r)return;const g=r.depsTail=o.subsTail={version:c,dep:o,sub:r,prevDep:f,nextDep:u,prevSub:h,nextSub:void 0};u!==void 0&&(u.prevDep=g),f!==void 0?f.nextDep=g:r.deps=g,h!==void 0?h.nextSub=g:o.subs=g}function a(o,r=o.sub){const{dep:c,prevDep:f,nextDep:u,nextSub:h,prevSub:g}=o;return u!==void 0?u.prevDep=f:r.depsTail=f,f!==void 0?f.nextDep=u:r.deps=u,h!==void 0?h.prevSub=g:c.subsTail=g,g!==void 0?g.nextSub=h:(c.subs=h)===void 0&&t(c),u}function n(o,r){let c=o.nextSub,f;e:do{const u=o.sub;let h=u.flags;if(h&60?h&12?h&4?!(h&48)&&p(o,u)?(u.flags=h|40,h&=1):h=0:u.flags=h&-9|32:h=0:(u.flags=h|32,r&&(u.flags|=8)),h&2&&s(u),h&1){const g=u.subs;if(g!==void 0){const y=(o=g).nextSub;y!==void 0&&(f={value:c,prev:f},c=y);continue}}if((o=c)!==void 0){c=o.nextSub;continue}for(;f!==void 0;)if(o=f.value,f=f.prev,o!==void 0){c=o.nextSub;continue e}break}while(!0)}function l(o,r){let c,f=0,u=!1;e:do{const h=o.dep,g=h.flags;if(r.flags&16)u=!0;else if((g&17)===17){const y=h.subs;e(h)&&(y.nextSub!==void 0&&d(y),u=!0)}else if((g&33)===33){c={value:o,prev:c},o=h.deps,r=h,++f;continue}if(!u){const y=o.nextDep;if(y!==void 0){o=y;continue}}for(;f--;){if(o=c.value,c=c.prev,u){const M=r.subs;if(e(r)){M.nextSub!==void 0&&d(M),r=o.sub;continue}u=!1}else r.flags&=-33;r=o.sub;const y=o.nextDep;if(y!==void 0){o=y;continue e}}return u&&!!r.flags}while(!0)}function d(o){do{const r=o.sub,c=r.flags;(c&48)===32&&(r.flags=c|16,(c&6)===2&&s(r))}while((o=o.nextSub)!==void 0)}function p(o,r){let c=r.depsTail;for(;c!==void 0;){if(c===o)return!0;c=c.prevDep}return!1}}const ke=64;let Ge=0,ge=0,ne=0,pe=0,U;const j=[],{link:st,unlink:xe,propagate:ss,checkDirty:Pt,shallowPropagate:Ct}=ts({update(e){return"getter"in e?Rt(e):"currentValue"in e?At(e):(e.flags=1,!0)},notify(e){let s=pe,t=s;do if(j[s++]=e,e.flags&=-3,e=e.subs?.sub,e===void 0||!(e.flags&2))break;while(!0);for(pe=s;t<--s;){const i=j[t];j[t++]=j[s],j[s]=i}},unwatched(e){"getter"in e?e.depsTail!==void 0&&(e.flags=17,Ft(e)):"currentValue"in e||("fn"in e?It.call(e):kt.call(e))}});function Oe(e){const s=U;return U=e,s}function Ne(e){return rs.bind({currentValue:e,pendingValue:e,subs:void 0,subsTail:void 0,flags:1})}function Et(e){return as.bind({value:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:0,getter:e})}function is(e){const s={fn:e,cleanup:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:6},t=Oe(s);t!==void 0&&(st(s,t,0),t.flags|=ke);try{++ge,s.cleanup=s.fn()}finally{--ge,U=t,s.flags&=-5}return It.bind(s)}function Rt(e){if(e.flags&ke){let t=e.depsTail;for(;t!==void 0;){const i=t.prevDep,a=t.dep;!("getter"in a)&&!("currentValue"in a)&&xe(t,e),t=i}}e.depsTail=void 0,e.flags=5;const s=Oe(e);try{++Ge;const t=e.value;return t!==(e.value=e.getter(t))}finally{U=s,e.flags&=-5,_t(e)}}function At(e){return e.flags=1,e.currentValue!==(e.currentValue=e.pendingValue)}function ns(e){const s=e.flags;if(s&16||s&32&&Pt(e.deps,e)){if(s&ke){let i=e.depsTail;for(;i!==void 0;){const a=i.prevDep,n=i.dep;!("getter"in n)&&!("currentValue"in n)&&xe(i,e),i=a}}if(e.cleanup&&(Tt(e),!e.flags))return;e.depsTail=void 0,e.flags=6;const t=Oe(e);try{++Ge,++ge,e.cleanup=e.fn()}finally{--ge,U=t,e.flags&=-5,_t(e)}}else e.deps!==void 0&&(e.flags=2|s&ke)}function os(){try{for(;ne<pe;){const e=j[ne];j[ne++]=void 0,ns(e)}}finally{for(;ne<pe;){const e=j[ne];j[ne++]=void 0,e.flags|=10}ne=0,pe=0}}function as(){const e=this.flags;if(e&16||e&32&&(Pt(this.deps,this)||(this.flags=e&-33,!1))){if(Rt(this)){const t=this.subs;t!==void 0&&Ct(t)}}else if(!e){this.flags=5;const t=Oe(this);try{this.value=this.getter()}finally{U=t,this.flags&=-5}}const s=U;return s!==void 0&&st(this,s,Ge),this.value}function rs(...e){if(e.length){if(this.pendingValue!==(this.pendingValue=e[0])){this.flags=17;const s=this.subs;s!==void 0&&(ss(s,!!ge),os())}}else{if(this.flags&16&&At(this)){const t=this.subs;t!==void 0&&Ct(t)}const s=U;return s!==void 0&&st(this,s,Ge),this.currentValue}}function Tt(e){const s=e.cleanup;e.cleanup=void 0;const t=U;U=void 0;try{s()}finally{U=t}}function It(){kt.call(this),this.cleanup&&Tt(this)}function kt(){this.flags=0,Ft(this);const e=this.subs;e!==void 0&&xe(e)}function Ft(e){let s=e.depsTail;for(;s!==void 0;){const t=s.prevDep;xe(s,e),s=t}}function _t(e){const s=e.depsTail;let t=s!==void 0?s.nextDep:e.deps;for(;t!==void 0;)t=xe(t,e)}const ve=Ne((1<<me)-1),cs=Ne(-1),Ve=Ne("gpu");Ne(0);const ls=Et(()=>{const e=ve(),s=[];for(let t=0;t<me;t++)e&1<<t&&s.push(t);return s}),ds=Et(()=>{const e=ls();return e.length===me?"all species":e.length===0?"none":e.map(s=>Ue[s]).join(", ")});function us(e){ve(ve()^1<<e)}let Dt=0;const Lt=()=>Dt;function hs(e){return is(()=>{Dt++,e()})}const Te=4096,Ae=24,ht=4;class fs{constructor(s,t,i,a){this.sim=i,this.backend=a,this.viewport=s,this.spacer=t,this.filtered=new Uint32Array(i.capacity),this.poolIds=new Int32Array(0),this.buildPool(),this.refilter(),this.viewport.addEventListener("scroll",()=>{this.scrollTop=this.viewport.scrollTop,this.dirty=!0},{passive:!0}),new ResizeObserver(()=>{this.buildPool(),this.dirty=!0}).observe(this.viewport)}viewport;spacer;pool=[];poolIds;filtered;filteredCount=0;scrollTop=0;poolSize=0;dirty=!0;live=new Float32Array(0);liveBase=0;liveCount=0;readPending=!1;lastRead=0;buildPool(){const s=Math.ceil(this.viewport.clientHeight/Ae)+ht*2;if(s!==this.poolSize){for(;this.pool.length<s;){const t=document.createElement("div");t.className="row";const i=document.createElement("span");i.className="id";const a=document.createElement("span");a.className="sp";const n=document.createElement("div");n.className="bar";const l=document.createElement("span");l.className="v",t.append(i,a,n,l);const d=this.pool.length;t.addEventListener("click",()=>{const p=this.poolIds[d];p>=0&&cs(p)}),this.viewport.appendChild(t),this.pool.push(t)}for(;this.pool.length>s;)this.pool.pop().remove();this.poolSize=s,this.poolIds=new Int32Array(s).fill(-1)}}refilter(){const s=ve(),{species:t,count:i}=this.sim,a=this.filtered;let n=0;for(let l=0;l<i;l++)s&1<<t[l]&&(a[n++]=l);this.filteredCount=n,this.spacer.style.height=n*Ae+"px",this.dirty=!0}forceRepaint(){this.poolIds.fill(-1),this.dirty=!0}get rowCount(){return this.filteredCount}get liveNodes(){return this.poolSize}update(){const s=Math.max(0,(this.scrollTop/Ae|0)-ht),t=Math.min(this.filteredCount,s+this.poolSize);if(this.scheduleReadback(s,t),!!this.dirty){this.dirty=!1;for(let i=0;i<this.poolSize;i++){const a=s+i,n=this.pool[i];if(a>=t){this.poolIds[i]!==-1&&(n.style.visibility="hidden",this.poolIds[i]=-1);continue}const l=this.filtered[a];if(this.poolIds[i]!==l){this.poolIds[i]=l;const p=this.sim.species[l],[o,r,c]=tt[p],f=`rgb(${o*255|0} ${r*255|0} ${c*255|0})`;n.style.visibility="visible",n.children[0].textContent=String(l),n.children[1].textContent=Ue[p],n.children[1].style.color=f,n.children[2].style.background=f}n.style.transform=`translateY(${a*Ae}px)`;const d=this.readLive(l);n.children[2].style.transform=`scaleX(${d.toFixed(3)})`,n.children[3].textContent=d.toFixed(4)}}}readLive(s){if(this.liveCount>0){const t=s-this.liveBase;if(t>=0&&t<this.liveCount){const i=t*V,a=this.live[i+2],n=this.live[i+3];return Math.min(1,Math.hypot(a,n)*.7)}}return this.sim.stat[s]}scheduleReadback(s,t){if(this.readPending||t<=s||!this.backend.readback)return;const i=performance.now();if(i-this.lastRead<80)return;this.lastRead=i;const a=this.filtered[s],l=this.filtered[Math.max(s,t-1)]-a+1;l<=0||l>Te||(this.readPending=!0,this.backend.readback(a,l).then(d=>{this.live=d,this.liveBase=a,this.liveCount=d.length/V,this.dirty=!0}).catch(()=>{}).finally(()=>{this.readPending=!1}))}}const J=64,_=w*w,ft=`
struct Params {
  dt        : f32,
  mx        : f32,
  my        : f32,
  aspect    : f32,
  size      : f32,
  gain      : f32,
  mask      : u32,
  mode      : u32,
  time      : f32,
  warpN     : f32,
  warpM     : f32,
  fpScale   : f32,
  massScale : f32,
  exposure  : f32,
  vscale    : f32,
  // Live particle count, so the deposit pass never walks past the live
  // population into the unused tail of the buffer when ?n= is below capacity.
  pcount    : f32,
  // Radial-velocity retention per step — the disc's cooling rate, driven live
  // from the UI. See sim/world.ts RADIAL_DAMP for what it physically is.
  rdamp     : f32,
  _pad0     : f32,
  _pad1     : f32,
  _pad2     : f32,
};

// Central bulge + halo. Fixed at the origin -- see the integrate entry point.
// (No backticks in here: this block lives inside a JS template literal.)
const G_CORE = ${Xe};
// Total self-gravitating mass of the disc. Mirrors M_DISC in sim/world.ts.
const M_DISC = ${De};
const R_DISC = ${bt};
const H_DISC = ${Le};
const SIGMA_FRAC = ${Be};
// Cursor mass, deliberately a fraction of the core so it perturbs, not destroys.
// Mirrors G_CURSOR in sim/world.ts -- see there for why it is this small.
const G_CURSOR = ${Je};
const CURSOR_SOFT2 = ${Ze};
// Terminal speed. Without it a close cursor pass flings grains off to infinity.
const V_MAX = 3.0;

const GRID = ${w}u;
const GRIDF = ${w}.0;
const CELLS = ${_}u;

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
// Density mesh. Fixed-point u32 because WGSL has no atomic float -- see fpScale.
@group(0) @binding(3) var<storage, read_write> dens : array<atomic<u32>>;
// Acceleration field, one vector per cell, written by solveField.
@group(0) @binding(4) var<storage, read_write> field : array<vec2<f32>>;
// The same mesh as plain f32, baked once per frame -- see bakeGrid.
@group(0) @binding(5) var<storage, read_write> cellMass : array<f32>;

/** Centre of cell c in simulation space, which is the unit box [-1, 1]. */
fn cellCentre(c : u32) -> vec2<f32> {
  let g = vec2<f32>(f32(c % GRID), f32(c / GRID));
  return (g + 0.5) / GRIDF * 2.0 - 1.0;
}

/** Continuous grid coordinate of a point, with cell centres on integers. */
fn gridCoord(p : vec2<f32>) -> vec2<f32> {
  return (p + 1.0) * 0.5 * GRIDF - 0.5;
}

/** Radial acceleration factor from the central mass. Mirrors coreF() in
 *  sim/world.ts; used by both the integrator and the seeding below. */
fn coreF(q : f32) -> f32 {
  return G_CORE / (q * sqrt(q)) - 0.0025 / (q * q);
}

/**
 * Circular-orbit speed under the force law actually integrated. Mirrors vCirc()
 * in sim/world.ts -- see there for why this is not sqrt(G/r), and why getting it
 * wrong punches a visible hole through the middle of the galaxy.
 */
fn vCirc(r : f32) -> f32 {
  let q = r * r + 0.004;
  let x = r / H_DISC;
  let enclosed = M_DISC * (1.0 - (1.0 + x) * exp(-x));
  let disc = enclosed / pow(r * r + ${(We*(2/w))**2}, 1.5);
  return r * sqrt(max(0.0, coreF(q) + disc));
}

/** Exponential-disc radius from two uniforms. Mirrors sampleRadius() in
 *  sim/world.ts -- a Gamma(2,1) is the sum of two exponentials. */
fn sampleRadius(u1 : f32, u2 : f32) -> f32 {
  let r = -H_DISC * (log(max(1e-9, u1)) + log(max(1e-9, u2)));
  return clamp(r, 0.01, 1.1);
}

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

// --- self-gravity: three passes over a GRID x GRID mesh ----------------------

@compute @workgroup_size(${J})
fn clearGrid(@builtin(global_invocation_id) gid : vec3<u32>) {
  let c = gid.x;
  if (c >= CELLS) { return; }
  atomicStore(&dens[c], 0u);
}

/**
 * Deposit every particle's mass into the mesh, cloud-in-cell.
 *
 * CIC splits each particle across the four cells nearest it, weighted by
 * distance, rather than dropping it whole into the one it happens to sit in.
 * That is the accurate choice — nearest-cell deposition makes a particle's force
 * contribution jump discontinuously as it drifts over a cell boundary, and a
 * million particles each jittering at the grid scale is a permanent noise floor
 * under exactly the faint arm structure this exists to expose.
 *
 * It is also, unexpectedly, the *fast* choice. Measured at 1M on a Gen-9 iGPU,
 * nearest-cell at one atomic per particle cost 8.6 ms; cloud-in-cell at four
 * cost 3.4 ms. Four times the atomic operations, two and a half times faster.
 *
 * The reason is that this pass is bound by contention, not by throughput. An
 * exponential disc drops an enormous share of the population into a handful of
 * central cells, and atomics against one address serialise. Nearest-cell aims
 * every one of those particles at a single cell; CIC spreads each across four,
 * which divides the queue. Nothing about the instruction count predicts this,
 * and it is why the grid resolution was chosen by measurement (see solveField).
 *
 * Accumulating into a private per-workgroup tile first — the textbook fix for
 * atomic contention — was tried and reverted. It does cut global atomic traffic
 * by well over an order of magnitude, but it also collapses a million
 * independent threads into sixty-odd workgroups that each clear and flush a
 * 4096-cell tile, and the lost parallelism costs more than the contention did:
 * 4.0 ms against 3.4 ms. The contention here is apparently already being
 * absorbed by the cache hierarchy about as well as on-chip storage would.
 *
 * Fixed point because WGSL has no atomic<f32>. fpScale is chosen on the CPU so
 * that count * fpScale cannot overflow u32 even in the degenerate case where
 * every particle lands in the same cell.
 */
@compute @workgroup_size(${J})
fn depositMass(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= u32(params.pcount)) { return; }

  let g = gridCoord(parts[i].xy);
  let base = floor(g);
  let f = g - base;

  for (var dy = 0u; dy < 2u; dy++) {
    let jy = clamp(i32(base.y) + i32(dy), 0, i32(GRID) - 1);
    let wy = select(1.0 - f.y, f.y, dy == 1u);
    for (var dx = 0u; dx < 2u; dx++) {
      let jx = clamp(i32(base.x) + i32(dx), 0, i32(GRID) - 1);
      let w = select(1.0 - f.x, f.x, dx == 1u) * wy;
      atomicAdd(&dens[u32(jy) * GRID + u32(jx)], u32(w * params.fpScale + 0.5));
    }
  }
}

/**
 * Convert the atomic fixed-point mesh into plain floats, once, before the
 * convolution reads it 4096 times over.
 *
 * This pass looks redundant and is not. Atomic loads are not ordinary loads:
 * on most hardware they are serviced coherently and bypass the caches that make
 * a broadcast read of the same address across a whole wave nearly free. The
 * convolution's inner loop reads every cell once per target cell, so doing it
 * atomically means 16.7 million uncached reads. Baking to a normal array first
 * costs 4096 atomic loads total and lets the hot loop hit cache.
 */
@compute @workgroup_size(${J})
fn bakeGrid(@builtin(global_invocation_id) gid : vec3<u32>) {
  let c = gid.x;
  if (c >= CELLS) { return; }
  cellMass[c] = f32(atomicLoad(&dens[c])) * params.massScale;
}

/**
 * Convolve the mesh against itself: the acceleration at every cell from the
 * mass in every other cell.
 *
 * This is the one genuinely quadratic step, and it is quadratic in *cells*, not
 * particles -- 4096 targets x 4096 sources, fixed forever regardless of whether
 * the population is ten thousand or ten million. Done directly rather than
 * through an FFT or a relaxation solver for one specific reason: boundary
 * conditions. A galaxy sits in empty space, and both an FFT and a Jacobi/
 * multigrid solve want a boundary condition at the edge of the box that empty
 * space does not supply -- periodic wrapping makes the disc feel copies of
 * itself, and a Dirichlet edge needs a multipole expansion to be honest. Summing
 * the pairs directly has open boundaries built in, needs no solver, cannot fail
 * to converge, and is about forty lines. At this grid size it is affordable, so
 * it wins.
 *
 * The empty-cell skip is not a micro-optimisation. A galaxy occupies maybe a
 * third of the box, and every thread in a workgroup walks the source cells in
 * the same order, so the branch is uniform across the wave -- no divergence, and
 * the loop simply gets shorter.
 */
@compute @workgroup_size(${J})
fn solveField(@builtin(global_invocation_id) gid : vec3<u32>) {
  let t = gid.x;
  if (t >= CELLS) { return; }

  let tp = cellCentre(t);
  var a = vec2<f32>(0.0, 0.0);

  for (var s = 0u; s < CELLS; s++) {
    let m = cellMass[s];
    if (m == 0.0) { continue; }
    let d = cellCentre(s) - tp;
    // Softened, and the softening length is the reason the mesh is stable: a
    // bare 1/r^2 between neighbouring cells would let a single dense cell fling
    // its neighbours away rather than pull the disc together.
    let q = dot(d, d) + ${(We*(2/w))**2};
    a += d * (m / (q * sqrt(q)));
  }

  field[t] = a;
}

/** Bilinear gather of the acceleration field at an arbitrary point. Matches the
 *  CIC deposit above, which is what makes the scheme conserve momentum. */
fn sampleField(p : vec2<f32>) -> vec2<f32> {
  let g = gridCoord(p);
  let base = floor(g);
  let f = g - base;

  var a = vec2<f32>(0.0, 0.0);
  for (var dy = 0u; dy < 2u; dy++) {
    let jy = clamp(i32(base.y) + i32(dy), 0, i32(GRID) - 1);
    let wy = select(1.0 - f.y, f.y, dy == 1u);
    for (var dx = 0u; dx < 2u; dx++) {
      let jx = clamp(i32(base.x) + i32(dx), 0, i32(GRID) - 1);
      let w = select(1.0 - f.x, f.x, dx == 1u) * wy;
      a += field[u32(jy) * GRID + u32(jx)] * w;
    }
  }
  return a;
}

/**
 * Uniformly redistribute the population. Dispatched once when entering Chladni
 * mode: the plate has to start as evenly spread sand. Arriving from the galaxy
 * with everything piled in the core produces one bright diagonal and nothing
 * else, because a grain that reaches a node has zero vibration amplitude and
 * never moves again.
 */
@compute @workgroup_size(${J})
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
  let r = sampleRadius(hash(i * 3u + 1u), hash(i * 5u + 17u));
  let vOrb = vCirc(r);
  // Box-Muller, from two more hashes. A cold disc fragments instead of forming
  // arms -- see SIGMA_FRAC in sim/world.ts.
  let g1 = sqrt(-2.0 * log(max(1e-9, hash(i * 3u + 2u))));
  let g2 = 6.2831853 * hash(i * 7u + 13u);
  parts[i] = vec4<f32>(
    cos(a) * r,
    sin(a) * r,
    -sin(a) * vOrb + g1 * cos(g2) * vOrb * SIGMA_FRAC,
    cos(a) * vOrb + g1 * sin(g2) * vOrb * SIGMA_FRAC
  );
}

@compute @workgroup_size(${J})
fn integrate(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }

  var p = parts[i];
  let dt = params.dt;

  if (params.mode == 1u) {
    parts[i] = chladni(i, p, dt);
    return;
  }

  // Central mass: bulge plus halo, fixed at the origin.
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

  // The disc's own gravity, gathered from the mesh the first three passes built.
  // This is the term that makes structure possible: it is the only one that
  // depends on where the other particles actually are this frame, so it is the
  // only one that can respond to an overdensity and amplify it into an arm.
  let sg = sampleField(p.xy);

  // Secondary: the cursor. Softened harder so a direct hit shears rather than
  // slingshots.
  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let dm2 = dot(dm, dm) + CURSOR_SOFT2;
  let fm = G_CURSOR / (dm2 * sqrt(dm2));

  var v = p.zw + dc * fc * dt + sg * dt + dm * fm * dt;

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
  v = (v - vRad) + vRad * params.rdamp;

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

  // Fit the simulation to the *short* side of the viewport, and apply the same
  // factor to the position as to the sprite.
  //
  // The previous version divided only the sprite by aspect and wrote the
  // position straight to clip space, which stretches the whole simulation to
  // fill the window: a circular orbit draws as an ellipse, and on a wide monitor
  // the galaxy reads as something squashed rather than something seen face-on.
  // Choosing the limiting dimension rather than always dividing by aspect
  // matters too, or a portrait window overflows the disc off both sides instead.
  //
  // vscale then zooms in. Fitting the *box* to the short side is correct and
  // looks wrong: the simulation box runs to +-1 but the disc only reaches about
  // 0.7, so a correct fit frames the galaxy inside a wide empty margin. Zooming
  // by the ratio between them fills the frame without reintroducing any
  // distortion -- the few particles thrown past the edge are clipped, which is
  // the right trade for not framing mostly-empty space.
  let s = rparams.vscale;
  let fx = s / max(rparams.aspect, 1.0);
  let fy = s * min(rparams.aspect, 1.0);
  out.pos = vec4<f32>(
    (p.x + corner.x * size) * fx,
    (p.y + corner.y * size) * fy,
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

  // Additive, into a 16-bit float target. The target format is the point: this
  // sum is unbounded and genuinely reaches into the tens, so an 8-bit
  // attachment clips it. gain now only normalises for population size, keeping
  // total deposited light constant as the count changes; it no longer has to
  // double as a saturation guard, which is what used to force it so low that
  // the arms went dark before the core stopped being white.
  return vec4<f32>(in.tint * a * rparams.gain, a * rparams.gain);
}

// --- tonemap -----------------------------------------------------------------

/**
 * Fullscreen pass, HDR accumulation buffer to the swap chain.
 *
 * This exists because the old renderer had a hard ceiling that had nothing to do
 * with the physics. Each particle deposited about 0.196 of alpha at the 1M gain
 * floor, the disc averaged ~3.9 particles per pixel, so the *mean* of the galaxy
 * sat at 0.77 of full white and the inner disc ran roughly eight times over it.
 * Past that point every pixel reads 1.0 and density stops being visible at all:
 * structure and no structure look identical. Fixing the simulation alone would
 * not have made a single extra arm visible.
 *
 * The curve is 1 - exp(-x), which has no ceiling to hit -- it maps [0, inf) into
 * [0, 1) and simply compresses harder as it climbs. Applied per channel, so a
 * region bright enough to saturate one channel keeps rendering detail in the
 * others and the core rolls off through its own hue toward white instead of
 * clamping flat, which is also what an overexposed bright source really does.
 */
struct TMOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn tmVs(@builtin(vertex_index) vi : u32) -> TMOut {
  // One oversized triangle rather than two quad triangles: no seam down the
  // diagonal, and three vertices instead of six.
  let p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0), vec2<f32>(-1.0, 1.0), vec2<f32>( 3.0, 1.0)
  );
  var o : TMOut;
  o.pos = vec4<f32>(p[vi], 0.0, 1.0);
  o.uv = p[vi];
  return o;
}

@group(0) @binding(0) var hdr : texture_2d<f32>;
@group(0) @binding(1) var<uniform> tparams : Params;

@fragment
fn tmFs(in : TMOut) -> @location(0) vec4<f32> {
  let c = textureLoad(hdr, vec2<i32>(in.pos.xy), 0).rgb;

  // Tonemap the *luminance* and carry the chroma through unchanged, rather than
  // curving each channel on its own.
  //
  // Per-channel is the obvious version and it quietly destroys the palette. Six
  // species are only distinguishable by their ratios between channels, and any
  // curve applied independently to each one compresses the largest channel
  // hardest -- so the ratios flatten exactly where the disc is densest and every
  // bright region converges on white regardless of what colour it started. That
  // is most of why the old renderer had six colours and showed one. Scaling all
  // three by a single factor moves brightness without touching hue at all.
  let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  // Reinhard, x / (1 + x), rather than 1 - exp(-x).
  //
  // An exponential disc spans a genuinely enormous range: the core is orders of
  // magnitude denser than the arms, which is the whole reason it looks like a
  // galaxy. 1 - exp(-x) is effectively saturated by x = 5, so any exposure that
  // lifted the arms out of the noise flattened the entire core to a white disc.
  // Reinhard never saturates -- it is still returning distinguishable values at
  // x = 100 -- so the core keeps its internal structure while the arms stay lit.
  let e = l * tparams.exposure;
  let lm = e / (1.0 + e);
  var mapped = c * (lm / max(l, 1e-6));

  // One concession: at the very top the ratio-preserving form can push a channel
  // past 1.0, which clips and shifts the hue anyway. Fading toward neutral over
  // the last stop keeps the genuinely overexposed core rolling off to white --
  // which is what an overexposed source does -- without touching anything below.
  mapped = mix(mapped, vec3<f32>(lm), smoothstep(0.75, 1.0, lm));

  // Background sits underneath rather than being cleared into the accumulation
  // buffer, so it never participates in the tonemap and the darkest particle
  // still lifts off it.
  let bg = vec3<f32>(0.027, 0.035, 0.051);
  let lit = bg + clamp(mapped, vec3<f32>(0.0), vec3<f32>(1.0)) * (1.0 - bg);

  // The swap chain is a plain unorm format, so the sRGB transfer is ours to
  // apply. Without it the whole image is roughly a stop and a half too dark and
  // every mid-tone is crushed.
  return vec4<f32>(pow(lit, vec3<f32>(1.0 / 2.2)), 1.0);
}
`;async function ps(e,s){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)return null;const i=await t.requestDevice();i.addEventListener("uncapturederror",b=>{console.error("[webgpu]",b.error.message)});const a=e.getContext("webgpu");if(!a)return null;const n=navigator.gpu.getPreferredCanvasFormat();a.configure({device:i,format:n,alphaMode:"premultiplied"});const l=i.createBuffer({size:s.particles.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});i.queue.writeBuffer(l,0,s.particles);const d=i.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),p=new ArrayBuffer(80),o=new Float32Array(p),r=new Uint32Array(p),c=i.createBuffer({size:_*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),f=i.createBuffer({size:_*8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),u=i.createBuffer({size:_*4,usage:GPUBufferUsage.STORAGE}),h=i.createBuffer({size:_*12,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),g=new Uint32Array(s.capacity);for(let b=0;b<s.capacity;b++)g[b]=s.species[b];const y=i.createBuffer({size:g.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});i.queue.writeBuffer(y,0,g);let M=63,S=0,D=ue,A=0,C=!1;const T=i.createBuffer({size:Te*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),E=new Float32Array(Te*4),R=i.createShaderModule({code:ft});{const b=await R.getCompilationInfo();for(const P of b.messages){if(P.type==="info")continue;const W=`${P.lineNum}:${P.linePos}`,N=ft.split(`
`)[P.lineNum-1]?.trim()??"";(P.type==="error"?console.error:console.warn)(`[wgsl ${W}] ${P.message}
  ${N}`)}}const L=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}}]}),F=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),$=i.createPipelineLayout({bindGroupLayouts:[L]}),m=b=>i.createComputePipeline({layout:$,compute:{module:R,entryPoint:b}}),v=m("integrate"),x=m("scatter"),I=m("clearGrid"),q=m("depositMass"),z=m("bakeGrid"),Y=m("solveField"),B="rgba16float",ee=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[F]}),vertex:{module:R,entryPoint:"vs"},fragment:{module:R,entryPoint:"fs",targets:[{format:B,blend:{color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),te=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),Me=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[te]}),vertex:{module:R,entryPoint:"tmVs"},fragment:{module:R,entryPoint:"tmFs",targets:[{format:n}]},primitive:{topology:"triangle-list"}});let se=null,ie=null;function he(b,P){se?.destroy(),se=i.createTexture({size:{width:Math.max(1,b),height:Math.max(1,P)},format:B,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),ie=i.createBindGroup({layout:te,entries:[{binding:0,resource:se.createView()},{binding:1,resource:{buffer:d}}]})}he(e.width,e.height);const Se=i.createBindGroup({layout:L,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:{buffer:d}},{binding:2,resource:{buffer:y}},{binding:3,resource:{buffer:c}},{binding:4,resource:{buffer:f}},{binding:5,resource:{buffer:u}}]}),Wt=i.createBindGroup({layout:F,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:{buffer:d}},{binding:2,resource:{buffer:y}}]});let O=s.count;return{name:"webgpu",detail:`${t.info?.vendor??"gpu"} ${t.info?.architecture??""}`.trim(),setCount(b){O=Math.min(b,s.capacity)},setSpeciesMask(b){M=b>>>0},setMode(b){S=b|0,C=!0},setCooling(b){D=b},frame(b,P,W){if(o[0]=b,o[1]=P,o[2]=W,o[3]=e.width/e.height,o[4]=Math.min(.006,Math.max(.0018,.06/Math.sqrt(O))),o[5]=6e4/O,r[6]=M,r[7]=S,A+=b,o[8]=A,S===1){const rt=Math.sin(A*.11)*1.4;o[9]=1+(P*.5+.5)*12+rt,o[10]=1+(W*.5+.5)*12+rt}else o[9]=0,o[10]=0;const N=Math.min(4096,Math.floor(39e8/Math.max(1,O)));o[11]=N,o[12]=De/(O*N),o[13]=8,o[14]=1.42,o[15]=O,o[16]=D,i.queue.writeBuffer(d,0,p);const K=i.createCommandEncoder(),ce=Math.ceil(O/J),qe=Math.ceil(_/J),k=K.beginComputePass();k.setBindGroup(0,Se),C&&(C=!1,k.setPipeline(x),k.dispatchWorkgroups(ce)),S===0&&(k.setPipeline(I),k.dispatchWorkgroups(qe),k.setPipeline(q),k.dispatchWorkgroups(ce),k.setPipeline(z),k.dispatchWorkgroups(qe),k.setPipeline(Y),k.dispatchWorkgroups(qe)),k.setPipeline(v),k.dispatchWorkgroups(ce),k.end();const Pe=K.beginRenderPass({colorAttachments:[{view:se.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});Pe.setPipeline(ee),Pe.setBindGroup(0,Wt),Pe.draw(6,O),Pe.end();const Ce=K.beginRenderPass({colorAttachments:[{view:a.getCurrentTexture().createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:1},storeOp:"store"}]});Ce.setPipeline(Me),Ce.setBindGroup(0,ie),Ce.draw(3),Ce.end(),i.queue.submit([K.finish()])},resize(b,P){e.width=b,e.height=P,he(b,P)},async readback(b,P){const W=Math.max(0,Math.min(b,O-1)),N=Math.max(0,Math.min(P,Te,O-W));if(N===0)return E.subarray(0,0);const K=N*16,ce=i.createCommandEncoder();return ce.copyBufferToBuffer(l,W*16,T,0,K),i.queue.submit([ce.finish()]),await T.mapAsync(GPUMapMode.READ,0,K),E.set(new Float32Array(T.getMappedRange(0,K))),T.unmap(),E.subarray(0,N*4)},async dumpGrid(){const b=i.createCommandEncoder();b.copyBufferToBuffer(c,0,h,0,_*4),b.copyBufferToBuffer(f,0,h,_*4,_*8),i.queue.submit([b.finish()]),await h.mapAsync(GPUMapMode.READ);const P=h.getMappedRange(),W=new Uint32Array(P.slice(0,_*4)),N=new Float32Array(P.slice(_*4,_*12));return h.unmap(),{dens:W,field:N,grid:w,massScale:o[12]}},destroy(){l.destroy(),d.destroy(),y.destroy(),c.destroy(),f.destroy(),u.destroy(),T.destroy(),h.destroy(),se?.destroy(),i.destroy()}}}const ms=`#version 300 es
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
  float fc = ${Xe} / (dc2 * rc) - 0.0025 / (dc2 * dc2);

  vec2 dm = uMouse - aPos;
  float dm2 = dot(dm, dm) + ${Ze};
  float fm = ${Je} / (dm2 * sqrt(dm2));

  vec2 v = aVel + dc * fc * uDt + dm * fm * uDt;

  // Radial-only damping — see webgpu.ts for why uniform damping collapses the disc.
  vec2 rdir = dc / rc;
  vec2 vRad = dot(v, rdir) * rdir;
  v = ((v - vRad) + vRad * uCooling) * 0.99995;

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
}`,gs=`#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`,vs=`#version 300 es
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
  // Fit to the short side and zoom, exactly as the WGSL path does — see the
  // vs() entry point in webgpu.ts for why position must be scaled too.
  float fx = uVScale / max(uAspect, 1.0);
  float fy = uVScale * min(uAspect, 1.0);
  gl_Position = vec4(
    (aPos.x + aCorner.x * uSize) * fx,
    (aPos.y + aCorner.y * uSize) * fy,
    0.0, 1.0
  );
}`,ys=`#version 300 es
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
}`;function pt(e,s,t){const i=e.createShader(s);if(e.shaderSource(i,t),e.compileShader(i),!e.getShaderParameter(i,e.COMPILE_STATUS))throw new Error("shader compile failed: "+e.getShaderInfoLog(i));return i}function mt(e,s,t,i){const a=e.createProgram();if(e.attachShader(a,pt(e,e.VERTEX_SHADER,s)),e.attachShader(a,pt(e,e.FRAGMENT_SHADER,t)),i&&e.transformFeedbackVaryings(a,i,e.SEPARATE_ATTRIBS),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw new Error("program link failed: "+e.getProgramInfoLog(a));return a}function bs(e,s){const t=e.getContext("webgl2",{alpha:!1,antialias:!1});if(!t)return null;const i=s.capacity,a=new Float32Array(i*2),n=new Float32Array(i*2);for(let m=0;m<i;m++)a[m*2]=s.particles[m*4],a[m*2+1]=s.particles[m*4+1],n[m*2]=s.particles[m*4+2],n[m*2+1]=s.particles[m*4+3];const l=m=>{const v=t.createBuffer();return t.bindBuffer(t.ARRAY_BUFFER,v),t.bufferData(t.ARRAY_BUFFER,m,t.DYNAMIC_COPY),v};let d=l(a),p=l(n),o=l(a),r=l(n);const c=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),f=l(c),u=new Float32Array(i);for(let m=0;m<i;m++)u[m]=s.species[m];const h=l(u),g=mt(t,ms,gs,["vPos","vVel"]),y=mt(t,vs,ys),M={aPos:t.getAttribLocation(g,"aPos"),aVel:t.getAttribLocation(g,"aVel"),aSpecies:t.getAttribLocation(g,"aSpecies"),uDt:t.getUniformLocation(g,"uDt"),uMouse:t.getUniformLocation(g,"uMouse"),uMode:t.getUniformLocation(g,"uMode"),uTime:t.getUniformLocation(g,"uTime"),uWarp:t.getUniformLocation(g,"uWarp"),uWarpM:t.getUniformLocation(g,"uWarpM"),uCooling:t.getUniformLocation(g,"uCooling")},S={aPos:t.getAttribLocation(y,"aPos"),aVel:t.getAttribLocation(y,"aVel"),aCorner:t.getAttribLocation(y,"aCorner"),aSpecies:t.getAttribLocation(y,"aSpecies"),uAspect:t.getUniformLocation(y,"uAspect"),uSize:t.getUniformLocation(y,"uSize"),uGain:t.getUniformLocation(y,"uGain"),uMask:t.getUniformLocation(y,"uMask"),uVScale:t.getUniformLocation(y,"uVScale")},D=t.createTransformFeedback();let A=s.count;const C=(m,v,x=0,I=2)=>{t.bindBuffer(t.ARRAY_BUFFER,m),t.enableVertexAttribArray(v),t.vertexAttribPointer(v,I,t.FLOAT,!1,0,0),t.vertexAttribDivisor(v,x)};let T=63,E=0,R=0,L=ue;const F=t.getExtension("WEBGL_debug_renderer_info"),$=String(F?t.getParameter(F.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER));return t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE),{name:"webgl2",detail:$,setCount(m){A=Math.min(m,s.capacity)},setSpeciesMask(m){T=m>>>0},setCooling(m){L=m},setMode(m){E=m|0;for(let v=0;v<i;v++)if(E===1)a[v*2]=Math.random()*2-1,a[v*2+1]=Math.random()*2-1,n[v*2]=0,n[v*2+1]=0;else{const x=Math.random()*Math.PI*2,I=et(Math.random(),Math.random()),q=Qe(I),z=q*Be,Y=Math.sqrt(-2*Math.log(Math.max(1e-9,Math.random()))),B=2*Math.PI*Math.random();a[v*2]=Math.cos(x)*I,a[v*2+1]=Math.sin(x)*I,n[v*2]=-Math.sin(x)*q+Y*Math.cos(B)*z,n[v*2+1]=Math.cos(x)*q+Y*Math.sin(B)*z}for(const[v,x]of[[d,a],[o,a],[p,n],[r,n]])t.bindBuffer(t.ARRAY_BUFFER,v),t.bufferSubData(t.ARRAY_BUFFER,0,x)},frame(m,v,x){t.useProgram(g),t.uniform1f(M.uDt,m),t.uniform2f(M.uMouse,v,x),t.uniform1i(M.uMode,E),t.uniform1f(M.uCooling,L),R+=m,t.uniform1f(M.uTime,R);const I=E===1?Math.sin(R*.11)*1.4:0;t.uniform1f(M.uWarp,E===1?1+(v*.5+.5)*12+I:0),t.uniform1f(M.uWarpM,E===1?1+(x*.5+.5)*12+I:0),C(d,M.aPos),C(p,M.aVel),C(h,M.aSpecies,0,1),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,D),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,o),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,r),t.enable(t.RASTERIZER_DISCARD),t.beginTransformFeedback(t.POINTS),t.drawArrays(t.POINTS,0,A),t.endTransformFeedback(),t.disable(t.RASTERIZER_DISCARD),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,null),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,null),t.clearColor(.027,.035,.051,1),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(y),t.uniform1f(S.uAspect,e.width/e.height),t.uniform1f(S.uSize,Math.min(.006,Math.max(.0018,.06/Math.sqrt(A)))),t.uniform1f(S.uGain,Math.min(1,Math.max(.6,2e5/A))),t.uniform1i(S.uMask,T),t.uniform1f(S.uVScale,1.42),C(f,S.aCorner,0),C(o,S.aPos,1),C(r,S.aVel,1),C(h,S.aSpecies,1,1),t.drawArraysInstanced(t.TRIANGLES,0,6,A),[d,o]=[o,d],[p,r]=[r,p]},resize(m,v){e.width=m,e.height=v,t.viewport(0,0,m,v)},destroy(){t.deleteProgram(g),t.deleteProgram(y);for(const m of[d,o,p,r,f,h])t.deleteBuffer(m);t.deleteTransformFeedback(D)}}}const le=5e3,gt=400;class ws{constructor(s,t,i,a){this.sim=s,this.gpuViewport=a,this.layer=document.createElement("div"),this.layer.id="baseline-layer",t.appendChild(this.layer),this.listHost=document.createElement("div"),this.listHost.id="baseline-list",i.appendChild(this.listHost)}cooling=ue;layer;nodes=[];listHost;active=!1;mode=0;elapsed=0;get count(){return le}start(){if(!this.active){this.active=!0,this.layer.style.display="block",this.listHost.style.display="block",this.gpuViewport.style.display="none";for(let s=0;s<le;s++){const t=document.createElement("div");t.className="bp";const[i,a,n]=tt[this.sim.species[s]];t.style.background=`rgb(${i*255|0} ${a*255|0} ${n*255|0})`,this.layer.appendChild(t),this.nodes.push(t)}}}stop(){this.active&&(this.active=!1,this.layer.style.display="none",this.layer.replaceChildren(),this.nodes.length=0,this.listHost.innerHTML="",this.listHost.style.display="none",this.gpuViewport.style.display="")}get domNodes(){return this.active?this.nodes.length+gt:0}setCooling(s){this.cooling=s}setMode(s){this.mode=s,this.elapsed=0,es(this.sim,le,s)}frame(s,t,i){if(!this.active)return;this.elapsed+=s;const a=this.sim.count;if(this.sim.count=le,this.mode===1){const{n:o,m:r}=Zt(t,i,this.elapsed);Qt(this.sim,s,o,r,this.elapsed)}else St(this.sim,s,t,i,this.cooling);this.sim.count=a;const n=innerWidth,l=innerHeight,d=this.sim.particles;for(let o=0;o<le;o++){const r=o*V,c=this.nodes[o];c.style.left=((d[r]*.5+.5)*n).toFixed(1)+"px",c.style.top=((-d[r+1]*.5+.5)*l).toFixed(1)+"px"}let p="";for(let o=0;o<gt;o++){const r=o*V,c=Math.min(1,Math.hypot(d[r+2],d[r+3])*.22);p+=`<div class="row"><span class="id">${o}</span><span class="sp">${Ue[this.sim.species[o]]}</span><span class="v">${c.toFixed(4)}</span></div>`}this.listHost.innerHTML=p}}const Bt=new URLSearchParams(location.search),Ut=Math.max(1,Number(Bt.get("n"))||1e6),Fe=document.getElementById("stage"),_e=new Ht(document.getElementById("hud")),re=Kt(Ut),H={entities:0,domNodes:0,arm:"gpu",backend:"booting",effectRuns:0},xs=Bt.get("backend");async function Ms(){if(xs!=="webgl2")try{const s=await ps(Fe,re);if(s)return s}catch(s){console.warn("WebGPU init failed, falling back to WebGL2:",s)}const e=bs(Fe,re);if(!e)throw new Error("Neither WebGPU nor WebGL2 is available.");return e}let Ye=0,Ke=0;addEventListener("pointermove",e=>{Ye=e.clientX/innerWidth*2-1,Ke=-(e.clientY/innerHeight*2-1)});const G=await Ms();G.setCount(Ut);H.backend=`${G.name} · ${G.detail}`;const Gt=document.getElementById("list-viewport"),de=new fs(Gt,document.getElementById("list-spacer"),re,G),ae=new ws(re,document.body,document.getElementById("sidebar"),Gt),it=document.getElementById("sidebar-head"),vt=Ue.map((e,s)=>{const t=document.createElement("button");t.className="chip",t.textContent=e;const[i,a,n]=tt[s];return t.style.setProperty("--c",`rgb(${i*255|0} ${a*255|0} ${n*255|0})`),t.addEventListener("click",()=>us(s)),it.appendChild(t),t}),nt=document.createElement("div");nt.className="summary";it.appendChild(nt);const Ot=.982,ye=1,ot=document.createElement("div");ot.className="control";const at=document.createElement("label");at.htmlFor="cooling";const Q=document.createElement("input");Q.type="range";Q.id="cooling";Q.min="0";Q.max="1000";const Ss=e=>ye-(ye-Ot)*(1-e/1e3)**2,Ps=e=>1e3*(1-Math.sqrt((ye-e)/(ye-Ot)));function Nt(e){G.setCooling?.(e),ae.setCooling(e);const s=e**60;at.textContent=`disc cooling · ${((1-s)*100).toFixed(1)}%/s`+(e>=ye-1e-6?" — none, disc goes smooth":"")}Q.value=String(Ps(ue));Q.addEventListener("input",()=>Nt(Ss(+Q.value)));ot.append(at,Q);it.appendChild(ot);hs(()=>{const e=ve();for(let s=0;s<vt.length;s++)vt[s].classList.toggle("off",!(e&1<<s));G.setSpeciesMask(e),de.refilter(),nt.textContent=`${de.rowCount.toLocaleString()} rows · ${ds()}`});const be=document.createElement("div");be.id="banner";document.body.appendChild(be);const Vt=()=>we===1?"Chladni plate · 6 frequencies":"orbital galaxy";function $t(){be.textContent=`${G.name} compute · ${re.count.toLocaleString()} particles · ${Vt()} — [M] mode · [B] compare`}function $e(e){Ve(e),e==="baseline"?(ae.setMode(we),ae.start(),Fe.style.display="none",be.textContent=`naive DOM · ${le.toLocaleString()} particles as elements · ${Vt()} · sidebar rebuilt per frame — press [B]`):(ae.stop(),Fe.style.display="block",de.forceRepaint(),$t()),be.className=e,H.arm=e,_e.reset()}let we=0;function Cs(e){we=e,G.setMode(we),Ve()==="gpu"?$t():$e("baseline")}addEventListener("keydown",e=>{(e.key==="b"||e.key==="B")&&$e(Ve()==="gpu"?"baseline":"gpu"),(e.key==="m"||e.key==="M")&&Cs(we===0?1:0)});function qt(){const e=Math.min(devicePixelRatio,2);G.resize(innerWidth*e|0,innerHeight*e|0)}addEventListener("resize",qt);qt();Nt(ue);$e("gpu");globalThis.__demo={sim:re,backend:G,hud:_e,counters:H,integrateCPU:St,list:de,effectRuns:Lt,setArm:$e};let yt=performance.now();function zt(e){_e.frame(e);const s=Math.min((e-yt)/1e3,1/30);yt=e,Ve()==="gpu"?(G.frame(s,Ye,Ke),de.update(),H.entities=re.count,H.domNodes=de.liveNodes):(ae.frame(s,Ye,Ke),H.entities=ae.count,H.domNodes=ae.domNodes),H.effectRuns=Lt(),_e.paint(e,H),requestAnimationFrame(zt)}requestAnimationFrame(zt);
