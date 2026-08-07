(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function t(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(a){if(a.ep)return;a.ep=!0;const o=t(a);fetch(a.href,o)}})();const se=240,me=240,J=40,lt=new Float32Array(se);class Kt{root;spark;sctx;frames=new Float32Array(se);head=0;filled=0;last=performance.now();dropped=0;total=0;longTasks=0;longTaskMs=0;refreshMs=16.67;fastest=1/0;textEls={};lastPaint=0;constructor(s){this.root=s,this.root.innerHTML="",this.spark=document.createElement("canvas"),this.spark.width=me*devicePixelRatio,this.spark.height=J*devicePixelRatio,this.spark.style.width=me+"px",this.spark.style.height=J+"px",this.spark.className="hud-spark",this.root.appendChild(this.spark);const t=this.spark.getContext("2d");if(!t)throw new Error("2D context unavailable for HUD sparkline");this.sctx=t,this.sctx.scale(devicePixelRatio,devicePixelRatio);for(const i of["fps","p50","p99","dropped","longtask","heap","entities","dom","effects","backend","arm"]){const a=document.createElement("div");a.className="hud-row";const o=document.createElement("span");o.className="hud-label",o.textContent=i;const r=document.createElement("span");r.className="hud-val",r.textContent="—",a.append(o,r),this.root.appendChild(a),this.textEls[i]=r}this.observeLongTasks()}observeLongTasks(){if(!("PerformanceObserver"in window))return;if(!PerformanceObserver.supportedEntryTypes?.includes("longtask")){this.textEls.longtask.textContent="unsupported";return}new PerformanceObserver(t=>{for(const i of t.getEntries())this.longTasks++,this.longTaskMs+=i.duration}).observe({entryTypes:["longtask"]})}frame(s){const t=s-this.last;this.last=s,this.total++,t>0&&t<1e3&&(this.frames[this.head]=t,this.head=(this.head+1)%se,this.filled<se&&this.filled++,t<this.fastest&&t>=4&&(this.fastest=t),this.refreshMs=Math.min(this.fastest,1e3/60),t>this.refreshMs*1.5&&this.dropped++)}paint(s,t){if(s-this.lastPaint<200)return;this.lastPaint=s;const i=this.filled;if(i===0)return;lt.set(this.frames.subarray(0,i));const a=lt.subarray(0,i);a.sort();const o=a[i*.5|0],r=a[Math.min(i-1,i*.99|0)];let m=0;for(let l=0;l<i;l++)m+=a[l];const p=m/i;this.textEls.fps.textContent=(1e3/p).toFixed(0),this.textEls.p50.textContent=o.toFixed(2)+" ms",this.textEls.p99.textContent=r.toFixed(2)+" ms",this.setWarn(this.textEls.p99,r>this.refreshMs*1.5);const n=this.total>0?this.dropped/this.total*100:0;this.textEls.dropped.textContent=`${this.dropped} (${n.toFixed(1)}%)`,this.setWarn(this.textEls.dropped,n>1),this.textEls.longtask.textContent!=="unsupported"&&(this.textEls.longtask.textContent=`${this.longTasks} / ${this.longTaskMs.toFixed(0)} ms`,this.setWarn(this.textEls.longtask,this.longTasks>0));const c=performance.memory;this.textEls.heap.textContent=c?(c.usedJSHeapSize/1048576).toFixed(1)+" MB":"n/a",this.textEls.entities.textContent=t.entities.toLocaleString(),this.textEls.dom.textContent=t.domNodes.toLocaleString(),this.textEls.effects.textContent=`${t.effectRuns} / ${this.total} frames`,this.textEls.backend.textContent=t.backend,this.textEls.arm.textContent=t.arm,this.drawSpark()}setWarn(s,t){s.className=t?"hud-val warn":"hud-val"}drawSpark(){const s=this.sctx,t=this.refreshMs,i=J/(t*2);s.clearRect(0,0,me,J),s.strokeStyle="rgba(120,200,255,0.25)",s.beginPath(),s.moveTo(0,J-t*i),s.lineTo(me,J-t*i),s.stroke(),s.strokeStyle="#6cf",s.lineWidth=1,s.beginPath();const a=this.filled,o=me/se;for(let r=0;r<a;r++){const m=(this.head-a+r+se*2)%se,p=J-Math.min(J,this.frames[m]*i),n=r*o;r===0?s.moveTo(n,p):s.lineTo(n,p)}s.stroke()}reset(){this.frames.fill(0),this.head=0,this.filled=0,this.dropped=0,this.total=0,this.longTasks=0,this.longTaskMs=0,this.last=performance.now(),this.fastest=1/0,this.refreshMs=1e3/60}}const q=4,Te=.45,Je=.42,ce=.18,wt=.65,Ue=wt/3,Ze=.15,w=64,He=1.5,Qe=.035,et=.05,We=3,de=.995,ye=6,De=He*(2/w);function xt(e){return Je/(e*Math.sqrt(e))-.0025/(e*e)}function Mt(e){const s=e*e+.004,t=Xt(e)/(e*e+De*De)**1.5;return e*Math.sqrt(Math.max(0,xt(s)+t))}function Xt(e){const s=e/Ue;return ce*(1-(1+s)*Math.exp(-s))}function St(e,s){const t=-Ue*(Math.log(Math.max(1e-9,e))+Math.log(Math.max(1e-9,s)));return Math.min(1.1,Math.max(.01,t))}const Ge=["argon","boron","cesium","dysprosium","erbium","fermium"],tt=[[.29,.62,1],[1,.45,.62],[.42,1,.72],[1,.76,.33],[.72,.55,1],[.35,.95,1]];function Jt(e){return function(){e|=0,e=e+1831565813|0;let s=Math.imul(e^e>>>15,1|e);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}function Le(e,s=2654435769){const{particles:t,species:i,stat:a,capacity:o}=e,r=Jt(s),m=()=>{const p=Math.max(1e-9,r());return Math.sqrt(-2*Math.log(p))*Math.cos(2*Math.PI*r())};for(let p=0;p<o;p++){const n=p*q,c=r()*Math.PI*2,l=St(r(),r());t[n]=Math.cos(c)*l,t[n+1]=Math.sin(c)*l;const h=Mt(l),f=h*Ze;t[n+2]=-Math.sin(c)*h+m()*f,t[n+3]=Math.cos(c)*h+m()*f;const u=l/(2.6*Ue)*ye,g=(r()-.5)*1.6;i[p]=Math.max(0,Math.min(ye-1,u+g|0)),a[p]=r()}}function Zt(e,s=2654435769){const t={particles:new Float32Array(e*q),species:new Uint8Array(e),stat:new Float32Array(e),capacity:e,count:e};return Le(t,s),t}const j=w*w,Qt=De*De,ke=new Float32Array(j),Pt=new Float32Array(j),Ct=new Float32Array(j),dt=new Int32Array(j),je=new Float32Array(j),Ye=new Float32Array(j);for(let e=0;e<w;e++)for(let s=0;s<w;s++)je[e*w+s]=(s+.5)/w*2-1,Ye[e*w+s]=(e+.5)/w*2-1;function es(e,s){ke.fill(0);const t=e.particles,i=ce/s;for(let r=0;r<s;r++){const m=r*q,p=(t[m]+1)*.5*w-.5,n=(t[m+1]+1)*.5*w-.5,c=Math.floor(p),l=Math.floor(n),h=p-c,f=n-l;for(let u=0;u<2;u++){const g=Math.min(w-1,Math.max(0,l+u)),v=u?f:1-f;for(let b=0;b<2;b++){const x=Math.min(w-1,Math.max(0,c+b));ke[g*w+x]+=i*(b?h:1-h)*v}}}const a=ce/j*.001;let o=0;for(let r=0;r<j;r++)ke[r]>a&&(dt[o++]=r);for(let r=0;r<j;r++){const m=je[r],p=Ye[r];let n=0,c=0;for(let l=0;l<o;l++){const h=dt[l],f=je[h]-m,u=Ye[h]-p,g=f*f+u*u+Qt,v=ke[h]/(g*Math.sqrt(g));n+=f*v,c+=u*v}Pt[r]=n,Ct[r]=c}}function Et(e,s,t,i,a=de){const o=e.particles,r=e.count,m=.99995;es(e,r);for(let p=0;p<r;p++){const n=p*q,c=o[n],l=o[n+1],h=-c,f=-l,u=h*h+f*f+.004,g=Math.sqrt(u),v=xt(u),b=(c+1)*.5*w-.5,x=(l+1)*.5*w-.5,_=Math.floor(b),k=Math.floor(x),E=b-_,A=x-k;let P=0,I=0;for(let oe=0;oe<2;oe++){const he=Math.min(w-1,Math.max(0,k+oe)),qe=oe?A:1-A;for(let N=0;N<2;N++){const fe=Math.min(w-1,Math.max(0,_+N)),pe=(N?E:1-E)*qe;P+=Pt[he*w+fe]*pe,I+=Ct[he*w+fe]*pe}}const R=t-c,L=i-l,B=R*R+L*L+et,ne=Qe/(B*Math.sqrt(B));let M=o[n+2]+h*v*s+P*s+R*ne*s,d=o[n+3]+f*v*s+I*s+L*ne*s;const S=h/g,O=f/g,U=M*S+d*O;M=M-U*S+U*S*a,d=d-U*O+U*O*a,M*=m,d*=m;const ue=Math.hypot(M,d);ue>We&&(M*=We/ue,d*=We/ue);let ee=c+M*s,K=l+d*s;ee<-1?(ee=-1,M=-M*Te):ee>1&&(ee=1,M=-M*Te),K<-1?(K=-1,d=-d*Te):K>1&&(K=1,d=-d*Te),o[n]=ee,o[n+1]=K,o[n+2]=M,o[n+3]=d}}const ut=new Float32Array([0,1,1,0,0,2,2,0,1,3,3,1]);function ht(e){let s=Math.imul(e,747796405)+2891336453;return s=Math.imul(s>>>(s>>>28)+4^s,277803737),((s>>>22^s)>>>0)/4294967296}function ts(e,s,t){const i=Math.sin(t*.11)*1.4;return{n:1+(e*.5+.5)*12+i,m:1+(s*.5+.5)*12+i}}function ss(e,s,t,i,a){const o=e.particles,r=e.count,m=a*60|0;for(let p=0;p<r;p++){const n=p*q,c=e.species[p],l=t+ut[c*2],h=i+ut[c*2+1],f=(o[n]+1)*.5,u=(o[n+1]+1)*.5,g=Math.cos(l*Math.PI*f),v=Math.cos(h*Math.PI*u),b=Math.cos(h*Math.PI*f),x=Math.cos(l*Math.PI*u),_=g*v-b*x,k=-l*Math.PI*Math.sin(l*Math.PI*f)*v+h*Math.PI*Math.sin(h*Math.PI*f)*x,E=-h*Math.PI*g*Math.sin(h*Math.PI*u)+l*Math.PI*b*Math.sin(l*Math.PI*u),A=Math.sign(_)*.5,P=Math.abs(_),I=ht(p*2+m)-.5,R=ht(p*2+1+m)-.5,L=(o[n+2]-k*A*2.4*s+I*P*2.2*s)*.86,B=(o[n+3]-E*A*2.4*s+R*P*2.2*s)*.86;o[n]=Math.max(-1,Math.min(1,o[n]+L*s)),o[n+1]=Math.max(-1,Math.min(1,o[n+1]+B*s)),o[n+2]=L,o[n+3]=B}}function is(e,s,t){const i=e.particles;for(let a=0;a<s;a++){const o=a*q;if(t===1)i[o]=Math.random()*2-1,i[o+1]=Math.random()*2-1,i[o+2]=0,i[o+3]=0;else{const r=Math.random()*Math.PI*2,m=St(Math.random(),Math.random()),p=Mt(m),n=Math.sqrt(-2*Math.log(Math.max(1e-9,Math.random()))),c=2*Math.PI*Math.random();i[o]=Math.cos(r)*m,i[o+1]=Math.sin(r)*m;const l=p*Ze;i[o+2]=-Math.sin(r)*p+n*Math.cos(c)*l,i[o+3]=Math.cos(r)*p+n*Math.sin(c)*l}}}function ns({update:e,notify:s,unwatched:t}){return{link:i,unlink:a,propagate:o,checkDirty:r,shallowPropagate:m};function i(n,c,l){const h=c.depsTail;if(h!==void 0&&h.dep===n)return;const f=h!==void 0?h.nextDep:c.deps;if(f!==void 0&&f.dep===n){f.version=l,c.depsTail=f;return}const u=n.subsTail;if(u!==void 0&&u.version===l&&u.sub===c)return;const g=c.depsTail=n.subsTail={version:l,dep:n,sub:c,prevDep:h,nextDep:f,prevSub:u,nextSub:void 0};f!==void 0&&(f.prevDep=g),h!==void 0?h.nextDep=g:c.deps=g,u!==void 0?u.nextSub=g:n.subs=g}function a(n,c=n.sub){const{dep:l,prevDep:h,nextDep:f,nextSub:u,prevSub:g}=n;return f!==void 0?f.prevDep=h:c.depsTail=h,h!==void 0?h.nextDep=f:c.deps=f,u!==void 0?u.prevSub=g:l.subsTail=g,g!==void 0?g.nextSub=u:(l.subs=u)===void 0&&t(l),f}function o(n,c){let l=n.nextSub,h;e:do{const f=n.sub;let u=f.flags;if(u&60?u&12?u&4?!(u&48)&&p(n,f)?(f.flags=u|40,u&=1):u=0:f.flags=u&-9|32:u=0:(f.flags=u|32,c&&(f.flags|=8)),u&2&&s(f),u&1){const g=f.subs;if(g!==void 0){const v=(n=g).nextSub;v!==void 0&&(h={value:l,prev:h},l=v);continue}}if((n=l)!==void 0){l=n.nextSub;continue}for(;h!==void 0;)if(n=h.value,h=h.prev,n!==void 0){l=n.nextSub;continue e}break}while(!0)}function r(n,c){let l,h=0,f=!1;e:do{const u=n.dep,g=u.flags;if(c.flags&16)f=!0;else if((g&17)===17){const v=u.subs;e(u)&&(v.nextSub!==void 0&&m(v),f=!0)}else if((g&33)===33){l={value:n,prev:l},n=u.deps,c=u,++h;continue}if(!f){const v=n.nextDep;if(v!==void 0){n=v;continue}}for(;h--;){if(n=l.value,l=l.prev,f){const b=c.subs;if(e(c)){b.nextSub!==void 0&&m(b),c=n.sub;continue}f=!1}else c.flags&=-33;c=n.sub;const v=n.nextDep;if(v!==void 0){n=v;continue e}}return f&&!!c.flags}while(!0)}function m(n){do{const c=n.sub,l=c.flags;(l&48)===32&&(c.flags=l|16,(l&6)===2&&s(c))}while((n=n.nextSub)!==void 0)}function p(n,c){let l=c.depsTail;for(;l!==void 0;){if(l===n)return!0;l=l.prevDep}return!1}}const _e=64;let Oe=0,be=0,te=0,ge=0,G;const H=[],{link:st,unlink:Ce,propagate:os,checkDirty:Rt,shallowPropagate:At}=ns({update(e){return"getter"in e?kt(e):"currentValue"in e?It(e):(e.flags=1,!0)},notify(e){let s=ge,t=s;do if(H[s++]=e,e.flags&=-3,e=e.subs?.sub,e===void 0||!(e.flags&2))break;while(!0);for(ge=s;t<--s;){const i=H[t];H[t++]=H[s],H[s]=i}},unwatched(e){"getter"in e?e.depsTail!==void 0&&(e.flags=17,_t(e)):"currentValue"in e||("fn"in e?Dt.call(e):Lt.call(e))}});function Ne(e){const s=G;return G=e,s}function Ve(e){return ds.bind({currentValue:e,pendingValue:e,subs:void 0,subsTail:void 0,flags:1})}function Tt(e){return ls.bind({value:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:0,getter:e})}function as(e){const s={fn:e,cleanup:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:6},t=Ne(s);t!==void 0&&(st(s,t,0),t.flags|=_e);try{++be,s.cleanup=s.fn()}finally{--be,G=t,s.flags&=-5}return Dt.bind(s)}function kt(e){if(e.flags&_e){let t=e.depsTail;for(;t!==void 0;){const i=t.prevDep,a=t.dep;!("getter"in a)&&!("currentValue"in a)&&Ce(t,e),t=i}}e.depsTail=void 0,e.flags=5;const s=Ne(e);try{++Oe;const t=e.value;return t!==(e.value=e.getter(t))}finally{G=s,e.flags&=-5,Bt(e)}}function It(e){return e.flags=1,e.currentValue!==(e.currentValue=e.pendingValue)}function rs(e){const s=e.flags;if(s&16||s&32&&Rt(e.deps,e)){if(s&_e){let i=e.depsTail;for(;i!==void 0;){const a=i.prevDep,o=i.dep;!("getter"in o)&&!("currentValue"in o)&&Ce(i,e),i=a}}if(e.cleanup&&(Ft(e),!e.flags))return;e.depsTail=void 0,e.flags=6;const t=Ne(e);try{++Oe,++be,e.cleanup=e.fn()}finally{--be,G=t,e.flags&=-5,Bt(e)}}else e.deps!==void 0&&(e.flags=2|s&_e)}function cs(){try{for(;te<ge;){const e=H[te];H[te++]=void 0,rs(e)}}finally{for(;te<ge;){const e=H[te];H[te++]=void 0,e.flags|=10}te=0,ge=0}}function ls(){const e=this.flags;if(e&16||e&32&&(Rt(this.deps,this)||(this.flags=e&-33,!1))){if(kt(this)){const t=this.subs;t!==void 0&&At(t)}}else if(!e){this.flags=5;const t=Ne(this);try{this.value=this.getter()}finally{G=t,this.flags&=-5}}const s=G;return s!==void 0&&st(this,s,Oe),this.value}function ds(...e){if(e.length){if(this.pendingValue!==(this.pendingValue=e[0])){this.flags=17;const s=this.subs;s!==void 0&&(os(s,!!be),cs())}}else{if(this.flags&16&&It(this)){const t=this.subs;t!==void 0&&At(t)}const s=G;return s!==void 0&&st(this,s,Oe),this.currentValue}}function Ft(e){const s=e.cleanup;e.cleanup=void 0;const t=G;G=void 0;try{s()}finally{G=t}}function Dt(){Lt.call(this),this.cleanup&&Ft(this)}function Lt(){this.flags=0,_t(this);const e=this.subs;e!==void 0&&Ce(e)}function _t(e){let s=e.depsTail;for(;s!==void 0;){const t=s.prevDep;Ce(s,e),s=t}}function Bt(e){const s=e.depsTail;let t=s!==void 0?s.nextDep:e.deps;for(;t!==void 0;)t=Ce(t,e)}const we=Ve((1<<ye)-1),us=Ve(-1),Ee=Ve("gpu");Ve(0);const hs=Tt(()=>{const e=we(),s=[];for(let t=0;t<ye;t++)e&1<<t&&s.push(t);return s}),fs=Tt(()=>{const e=hs();return e.length===ye?"all species":e.length===0?"none":e.map(s=>Ge[s]).join(", ")});function ps(e){we(we()^1<<e)}let Ut=0;const Gt=()=>Ut;function ms(e){return as(()=>{Ut++,e()})}const Fe=4096,Ie=24,ft=4;class gs{constructor(s,t,i,a){this.sim=i,this.backend=a,this.viewport=s,this.spacer=t,this.filtered=new Uint32Array(i.capacity),this.poolIds=new Int32Array(0),this.buildPool(),this.refilter(),this.viewport.addEventListener("scroll",()=>{this.scrollTop=this.viewport.scrollTop,this.dirty=!0},{passive:!0}),new ResizeObserver(()=>{this.buildPool(),this.dirty=!0}).observe(this.viewport)}viewport;spacer;pool=[];poolIds;filtered;filteredCount=0;scrollTop=0;poolSize=0;dirty=!0;live=new Float32Array(0);liveBase=0;liveCount=0;readPending=!1;lastRead=0;buildPool(){const s=Math.ceil(this.viewport.clientHeight/Ie)+ft*2;if(s!==this.poolSize){for(;this.pool.length<s;){const t=document.createElement("div");t.className="row";const i=document.createElement("span");i.className="id";const a=document.createElement("span");a.className="sp";const o=document.createElement("div");o.className="bar";const r=document.createElement("span");r.className="v",t.append(i,a,o,r);const m=this.pool.length;t.addEventListener("click",()=>{const p=this.poolIds[m];p>=0&&us(p)}),this.viewport.appendChild(t),this.pool.push(t)}for(;this.pool.length>s;)this.pool.pop().remove();this.poolSize=s,this.poolIds=new Int32Array(s).fill(-1)}}refilter(){const s=we(),{species:t,count:i}=this.sim,a=this.filtered;let o=0;for(let r=0;r<i;r++)s&1<<t[r]&&(a[o++]=r);this.filteredCount=o,this.spacer.style.height=o*Ie+"px",this.dirty=!0}forceRepaint(){this.poolIds.fill(-1),this.dirty=!0}get rowCount(){return this.filteredCount}get liveNodes(){return this.poolSize}update(){const s=Math.max(0,(this.scrollTop/Ie|0)-ft),t=Math.min(this.filteredCount,s+this.poolSize);if(this.scheduleReadback(s,t),!!this.dirty){this.dirty=!1;for(let i=0;i<this.poolSize;i++){const a=s+i,o=this.pool[i];if(a>=t){this.poolIds[i]!==-1&&(o.style.visibility="hidden",this.poolIds[i]=-1);continue}const r=this.filtered[a];if(this.poolIds[i]!==r){this.poolIds[i]=r;const p=this.sim.species[r],[n,c,l]=tt[p],h=`rgb(${n*255|0} ${c*255|0} ${l*255|0})`;o.style.visibility="visible",o.children[0].textContent=String(r),o.children[1].textContent=Ge[p],o.children[1].style.color=h,o.children[2].style.background=h}o.style.transform=`translateY(${a*Ie}px)`;const m=this.readLive(r);o.children[2].style.transform=`scaleX(${m.toFixed(3)})`,o.children[3].textContent=m.toFixed(4)}}}readLive(s){if(this.liveCount>0){const t=s-this.liveBase;if(t>=0&&t<this.liveCount){const i=t*q,a=this.live[i+2],o=this.live[i+3];return Math.min(1,Math.hypot(a,o)*.7)}}return this.sim.stat[s]}scheduleReadback(s,t){if(this.readPending||t<=s||!this.backend.readback)return;const i=performance.now();if(i-this.lastRead<80)return;this.lastRead=i;const a=this.filtered[s],r=this.filtered[Math.max(s,t-1)]-a+1;r<=0||r>Fe||(this.readPending=!0,this.backend.readback(a,r).then(m=>{this.live=m,this.liveBase=a,this.liveCount=m.length/q,this.dirty=!0}).catch(()=>{}).finally(()=>{this.readPending=!1}))}}const Z=64,F=w*w,pt=`
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
  // Cells lighter than this contribute nothing and are skipped by the
  // convolution — see solveField for why this is not simply "is it empty".
  massFloor : f32,
  // 1 = render luminance only, discarding the species palette.
  mono      : f32,
  _pad0     : f32,
};

// Central bulge + halo. Fixed at the origin -- see the integrate entry point.
// (No backticks in here: this block lives inside a JS template literal.)
const G_CORE = ${Je};
// Total self-gravitating mass of the disc. Mirrors M_DISC in sim/world.ts.
const M_DISC = ${ce};
const R_DISC = ${wt};
const H_DISC = ${Ue};
const SIGMA_FRAC = ${Ze};
// Cursor mass, deliberately a fraction of the core so it perturbs, not destroys.
// Mirrors G_CURSOR in sim/world.ts -- see there for why it is this small.
const G_CURSOR = ${Qe};
const CURSOR_SOFT2 = ${et};
// Terminal speed. Without it a close cursor pass flings grains off to infinity.
const V_MAX = 3.0;

const GRID = ${w}u;
const GRIDF = ${w}.0;
const CELLS = ${F}u;

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
  let disc = enclosed / pow(r * r + ${(He*(2/w))**2}, 1.5);
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

@compute @workgroup_size(${Z})
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
@compute @workgroup_size(${Z})
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
@compute @workgroup_size(${Z})
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
@compute @workgroup_size(${Z})
fn solveField(@builtin(global_invocation_id) gid : vec3<u32>) {
  let t = gid.x;
  if (t >= CELLS) { return; }

  let tp = cellCentre(t);
  var a = vec2<f32>(0.0, 0.0);

  for (var s = 0u; s < CELLS; s++) {
    let m = cellMass[s];
    // Skip by mass, not by emptiness.
    //
    // Testing for exact zero looks equivalent and quietly makes the cost a
    // function of how long the simulation has been running. A compact disc
    // occupies about a third of the grid; give it a minute and a thin spray of
    // escapees has touched roughly 80% of it, and every one of those cells costs
    // a full row of this loop while carrying a millionth of the mass. Measured
    // at 1M, self-gravity cost 3.4 ms on a fresh disc and 9.7 ms on a settled
    // one — the same code, three times slower, purely from where the stragglers
    // had got to.
    //
    // The floor is five orders of magnitude below a typical occupied cell, so
    // what it discards is far beneath the force noise the mesh already carries.
    if (m <= params.massFloor) { continue; }
    let d = cellCentre(s) - tp;
    // Softened, and the softening length is the reason the mesh is stable: a
    // bare 1/r^2 between neighbouring cells would let a single dense cell fling
    // its neighbours away rather than pull the disc together.
    let q = dot(d, d) + ${(He*(2/w))**2};
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
@compute @workgroup_size(${Z})
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

@compute @workgroup_size(${Z})
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
  //
  // In mono the palette is dropped for a single faintly warm white. Structure in
  // this image is carried almost entirely by density rather than by hue, so
  // removing colour costs nothing legible and the arms actually read *harder* —
  // which is why deep-sky astrophotography is usually luminance first.
  let base = select(PALETTE[sp], vec3<f32>(0.86, 0.89, 1.0), rparams.mono > 0.5);
  out.tint = mix(base, vec3<f32>(1.0, 0.95, 0.88), out.speed * 0.3);
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
`;async function vs(e,s){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)return null;const i=await t.requestDevice();i.addEventListener("uncapturederror",y=>{console.error("[webgpu]",y.error.message)});const a=e.getContext("webgpu");if(!a)return null;const o=navigator.gpu.getPreferredCanvasFormat();a.configure({device:i,format:o,alphaMode:"premultiplied"});const r=i.createBuffer({size:s.particles.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});i.queue.writeBuffer(r,0,s.particles);const m=i.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),p=new ArrayBuffer(80),n=new Float32Array(p),c=new Uint32Array(p),l=i.createBuffer({size:F*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),h=i.createBuffer({size:F*8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),f=i.createBuffer({size:F*4,usage:GPUBufferUsage.STORAGE}),u=i.createBuffer({size:F*12,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),g=new Uint32Array(s.capacity);for(let y=0;y<s.capacity;y++)g[y]=s.species[y];const v=i.createBuffer({size:g.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});i.queue.writeBuffer(v,0,g);let b=63,x=0,_=de,k=!1,E=0,A=!1;const P=i.createBuffer({size:Fe*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),I=new Float32Array(Fe*4),R=i.createShaderModule({code:pt});{const y=await R.getCompilationInfo();for(const C of y.messages){if(C.type==="info")continue;const z=`${C.lineNum}:${C.linePos}`,$=pt.split(`
`)[C.lineNum-1]?.trim()??"";(C.type==="error"?console.error:console.warn)(`[wgsl ${z}] ${C.message}
  ${$}`)}}const L=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}}]}),B=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),ne=i.createPipelineLayout({bindGroupLayouts:[L]}),M=y=>i.createComputePipeline({layout:ne,compute:{module:R,entryPoint:y}}),d=M("integrate"),S=M("scatter"),O=M("clearGrid"),U=M("depositMass"),ue=M("bakeGrid"),ee=M("solveField"),K="rgba16float",oe=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[B]}),vertex:{module:R,entryPoint:"vs"},fragment:{module:R,entryPoint:"fs",targets:[{format:K,blend:{color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),he=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),qe=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[he]}),vertex:{module:R,entryPoint:"tmVs"},fragment:{module:R,entryPoint:"tmFs",targets:[{format:o}]},primitive:{topology:"triangle-list"}});let N=null,fe=null;function pe(y,C){N?.destroy(),N=i.createTexture({size:{width:Math.max(1,y),height:Math.max(1,C)},format:K,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),fe=i.createBindGroup({layout:he,entries:[{binding:0,resource:N.createView()},{binding:1,resource:{buffer:m}}]})}pe(e.width,e.height);const jt=i.createBindGroup({layout:L,entries:[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:l}},{binding:4,resource:{buffer:h}},{binding:5,resource:{buffer:f}}]}),Yt=i.createBindGroup({layout:B,entries:[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:v}}]});let V=s.count;return{name:"webgpu",detail:`${t.info?.vendor??"gpu"} ${t.info?.architecture??""}`.trim(),setCount(y){V=Math.min(y,s.capacity)},setSpeciesMask(y){b=y>>>0},setMode(y){x=y|0,x===0?(Le(s),i.queue.writeBuffer(r,0,s.particles),A=!1):A=!0},setCooling(y){_=y},setMono(y){k=y},reset(){E=0,x===0?(Le(s),i.queue.writeBuffer(r,0,s.particles)):A=!0},frame(y,C,z){if(n[0]=y,n[1]=C,n[2]=z,n[3]=e.width/e.height,n[4]=Math.min(.006,Math.max(.0018,.06/Math.sqrt(V))),n[5]=6e4/V,c[6]=b,c[7]=x,E+=y,n[8]=E,x===1){const ct=Math.sin(E*.11)*1.4;n[9]=1+(C*.5+.5)*12+ct,n[10]=1+(z*.5+.5)*12+ct}else n[9]=0,n[10]=0;const $=Math.min(4096,Math.floor(39e8/Math.max(1,V)));n[11]=$,n[12]=ce/(V*$),n[13]=8,n[14]=1.42,n[15]=V,n[16]=_,n[17]=ce/F*.001,n[18]=k?1:0,i.queue.writeBuffer(m,0,p);const X=i.createCommandEncoder(),ae=Math.ceil(V/Z),ze=Math.ceil(F/Z),T=X.beginComputePass();T.setBindGroup(0,jt),A&&(A=!1,T.setPipeline(S),T.dispatchWorkgroups(ae)),x===0&&(T.setPipeline(O),T.dispatchWorkgroups(ze),T.setPipeline(U),T.dispatchWorkgroups(ae),T.setPipeline(ue),T.dispatchWorkgroups(ze),T.setPipeline(ee),T.dispatchWorkgroups(ze)),T.setPipeline(d),T.dispatchWorkgroups(ae),T.end();const Re=X.beginRenderPass({colorAttachments:[{view:N.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});Re.setPipeline(oe),Re.setBindGroup(0,Yt),Re.draw(6,V),Re.end();const Ae=X.beginRenderPass({colorAttachments:[{view:a.getCurrentTexture().createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:1},storeOp:"store"}]});Ae.setPipeline(qe),Ae.setBindGroup(0,fe),Ae.draw(3),Ae.end(),i.queue.submit([X.finish()])},resize(y,C){e.width=y,e.height=C,pe(y,C)},async readback(y,C){const z=Math.max(0,Math.min(y,V-1)),$=Math.max(0,Math.min(C,Fe,V-z));if($===0)return I.subarray(0,0);const X=$*16,ae=i.createCommandEncoder();return ae.copyBufferToBuffer(r,z*16,P,0,X),i.queue.submit([ae.finish()]),await P.mapAsync(GPUMapMode.READ,0,X),I.set(new Float32Array(P.getMappedRange(0,X))),P.unmap(),I.subarray(0,$*4)},async dumpGrid(){const y=i.createCommandEncoder();y.copyBufferToBuffer(l,0,u,0,F*4),y.copyBufferToBuffer(h,0,u,F*4,F*8),i.queue.submit([y.finish()]),await u.mapAsync(GPUMapMode.READ);const C=u.getMappedRange(),z=new Uint32Array(C.slice(0,F*4)),$=new Float32Array(C.slice(F*4,F*12));return u.unmap(),{dens:z,field:$,grid:w,massScale:n[12]}},destroy(){r.destroy(),m.destroy(),v.destroy(),l.destroy(),h.destroy(),f.destroy(),P.destroy(),u.destroy(),N?.destroy(),i.destroy()}}}const ys=`#version 300 es
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
  float fc = ${Je} / (dc2 * rc) - 0.0025 / (dc2 * dc2);

  vec2 dm = uMouse - aPos;
  float dm2 = dot(dm, dm) + ${et};
  float fm = ${Qe} / (dm2 * sqrt(dm2));

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
}`,bs=`#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`,ws=`#version 300 es
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
  // Fit to the short side and zoom, exactly as the WGSL path does — see the
  // vs() entry point in webgpu.ts for why position must be scaled too.
  float fx = uVScale / max(uAspect, 1.0);
  float fy = uVScale * min(uAspect, 1.0);
  gl_Position = vec4(
    (aPos.x + aCorner.x * uSize) * fx,
    (aPos.y + aCorner.y * uSize) * fy,
    0.0, 1.0
  );
}`,xs=`#version 300 es
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
}`;function mt(e,s,t){const i=e.createShader(s);if(e.shaderSource(i,t),e.compileShader(i),!e.getShaderParameter(i,e.COMPILE_STATUS))throw new Error("shader compile failed: "+e.getShaderInfoLog(i));return i}function gt(e,s,t,i){const a=e.createProgram();if(e.attachShader(a,mt(e,e.VERTEX_SHADER,s)),e.attachShader(a,mt(e,e.FRAGMENT_SHADER,t)),i&&e.transformFeedbackVaryings(a,i,e.SEPARATE_ATTRIBS),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw new Error("program link failed: "+e.getProgramInfoLog(a));return a}function Ms(e,s){const t=e.getContext("webgl2",{alpha:!1,antialias:!1});if(!t)return null;const i=s.capacity,a=new Float32Array(i*2),o=new Float32Array(i*2);for(let d=0;d<i;d++)a[d*2]=s.particles[d*4],a[d*2+1]=s.particles[d*4+1],o[d*2]=s.particles[d*4+2],o[d*2+1]=s.particles[d*4+3];const r=d=>{const S=t.createBuffer();return t.bindBuffer(t.ARRAY_BUFFER,S),t.bufferData(t.ARRAY_BUFFER,d,t.DYNAMIC_COPY),S};let m=r(a),p=r(o),n=r(a),c=r(o);const l=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),h=r(l),f=new Float32Array(i);for(let d=0;d<i;d++)f[d]=s.species[d];const u=r(f),g=gt(t,ys,bs,["vPos","vVel"]),v=gt(t,ws,xs),b={aPos:t.getAttribLocation(g,"aPos"),aVel:t.getAttribLocation(g,"aVel"),aSpecies:t.getAttribLocation(g,"aSpecies"),uDt:t.getUniformLocation(g,"uDt"),uMouse:t.getUniformLocation(g,"uMouse"),uMode:t.getUniformLocation(g,"uMode"),uTime:t.getUniformLocation(g,"uTime"),uWarp:t.getUniformLocation(g,"uWarp"),uWarpM:t.getUniformLocation(g,"uWarpM"),uCooling:t.getUniformLocation(g,"uCooling")},x={aPos:t.getAttribLocation(v,"aPos"),aVel:t.getAttribLocation(v,"aVel"),aCorner:t.getAttribLocation(v,"aCorner"),aSpecies:t.getAttribLocation(v,"aSpecies"),uAspect:t.getUniformLocation(v,"uAspect"),uSize:t.getUniformLocation(v,"uSize"),uGain:t.getUniformLocation(v,"uGain"),uMask:t.getUniformLocation(v,"uMask"),uVScale:t.getUniformLocation(v,"uVScale"),uMono:t.getUniformLocation(v,"uMono")},_=t.createTransformFeedback();let k=s.count;const E=(d,S,O=0,U=2)=>{t.bindBuffer(t.ARRAY_BUFFER,d),t.enableVertexAttribArray(S),t.vertexAttribPointer(S,U,t.FLOAT,!1,0,0),t.vertexAttribDivisor(S,O)};let A=63,P=0,I=0,R=de,L=!1;const B=t.getExtension("WEBGL_debug_renderer_info"),ne=String(B?t.getParameter(B.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER));t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE);const M=()=>{for(let d=0;d<i;d++)P===1&&(a[d*2]=Math.random()*2-1,a[d*2+1]=Math.random()*2-1,o[d*2]=0,o[d*2+1]=0);if(P===0){Le(s);for(let d=0;d<i;d++)a[d*2]=s.particles[d*4],a[d*2+1]=s.particles[d*4+1],o[d*2]=s.particles[d*4+2],o[d*2+1]=s.particles[d*4+3]}for(const[d,S]of[[m,a],[n,a],[p,o],[c,o]])t.bindBuffer(t.ARRAY_BUFFER,d),t.bufferSubData(t.ARRAY_BUFFER,0,S)};return{name:"webgl2",detail:ne,setCount(d){k=Math.min(d,s.capacity)},setSpeciesMask(d){A=d>>>0},setCooling(d){R=d},setMono(d){L=d},setMode(d){P=d|0,M()},reset(){I=0,M()},frame(d,S,O){t.useProgram(g),t.uniform1f(b.uDt,d),t.uniform2f(b.uMouse,S,O),t.uniform1i(b.uMode,P),t.uniform1f(b.uCooling,R),I+=d,t.uniform1f(b.uTime,I);const U=P===1?Math.sin(I*.11)*1.4:0;t.uniform1f(b.uWarp,P===1?1+(S*.5+.5)*12+U:0),t.uniform1f(b.uWarpM,P===1?1+(O*.5+.5)*12+U:0),E(m,b.aPos),E(p,b.aVel),E(u,b.aSpecies,0,1),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,_),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,n),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,c),t.enable(t.RASTERIZER_DISCARD),t.beginTransformFeedback(t.POINTS),t.drawArrays(t.POINTS,0,k),t.endTransformFeedback(),t.disable(t.RASTERIZER_DISCARD),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,null),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,null),t.clearColor(.027,.035,.051,1),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(v),t.uniform1f(x.uAspect,e.width/e.height),t.uniform1f(x.uSize,Math.min(.006,Math.max(.0018,.06/Math.sqrt(k)))),t.uniform1f(x.uGain,Math.min(1,Math.max(.6,2e5/k))),t.uniform1i(x.uMask,A),t.uniform1f(x.uVScale,1.42),t.uniform1f(x.uMono,L?1:0),E(h,x.aCorner,0),E(n,x.aPos,1),E(c,x.aVel,1),E(u,x.aSpecies,1,1),t.drawArraysInstanced(t.TRIANGLES,0,6,k),[m,n]=[n,m],[p,c]=[c,p]},resize(d,S){e.width=d,e.height=S,t.viewport(0,0,d,S)},destroy(){t.deleteProgram(g),t.deleteProgram(v);for(const d of[m,n,p,c,h,u])t.deleteBuffer(d);t.deleteTransformFeedback(_)}}}const re=5e3,vt=400;class Ss{constructor(s,t,i,a){this.sim=s,this.gpuViewport=a,this.layer=document.createElement("div"),this.layer.id="baseline-layer",t.appendChild(this.layer),this.listHost=document.createElement("div"),this.listHost.id="baseline-list",i.appendChild(this.listHost)}cooling=de;mono=!1;layer;nodes=[];listHost;active=!1;mode=0;elapsed=0;get count(){return re}start(){if(!this.active){this.active=!0,this.layer.style.display="block",this.listHost.style.display="block",this.gpuViewport.style.display="none";for(let s=0;s<re;s++){const t=document.createElement("div");t.className="bp",t.style.background=this.nodeColour(s),this.layer.appendChild(t),this.nodes.push(t)}}}stop(){this.active&&(this.active=!1,this.layer.style.display="none",this.layer.replaceChildren(),this.nodes.length=0,this.listHost.innerHTML="",this.listHost.style.display="none",this.gpuViewport.style.display="")}get domNodes(){return this.active?this.nodes.length+vt:0}setCooling(s){this.cooling=s}setMono(s){this.mono=s;for(let t=0;t<this.nodes.length;t++)this.nodes[t].style.background=this.nodeColour(t)}nodeColour(s){if(this.mono)return"rgb(219 227 255)";const[t,i,a]=tt[this.sim.species[s]];return`rgb(${t*255|0} ${i*255|0} ${a*255|0})`}setMode(s){this.mode=s,this.reset()}reset(){this.elapsed=0,is(this.sim,re,this.mode)}frame(s,t,i){if(!this.active)return;this.elapsed+=s;const a=this.sim.count;if(this.sim.count=re,this.mode===1){const{n,m:c}=ts(t,i,this.elapsed);ss(this.sim,s,n,c,this.elapsed)}else Et(this.sim,s,t,i,this.cooling);this.sim.count=a;const o=innerWidth,r=innerHeight,m=this.sim.particles;for(let n=0;n<re;n++){const c=n*q,l=this.nodes[n];l.style.left=((m[c]*.5+.5)*o).toFixed(1)+"px",l.style.top=((-m[c+1]*.5+.5)*r).toFixed(1)+"px"}let p="";for(let n=0;n<vt;n++){const c=n*q,l=Math.min(1,Math.hypot(m[c+2],m[c+3])*.22);p+=`<div class="row"><span class="id">${n}</span><span class="sp">${Ge[this.sim.species[n]]}</span><span class="v">${l.toFixed(4)}</span></div>`}this.listHost.innerHTML=p}}const Ot=new URLSearchParams(location.search),Nt=Math.max(1,Number(Ot.get("n"))||1e6),Be=document.getElementById("stage"),xe=new Kt(document.getElementById("hud")),ie=Zt(Nt),W={entities:0,domNodes:0,arm:"gpu",backend:"booting",effectRuns:0},Ps=Ot.get("backend");async function Cs(){if(Ps!=="webgl2")try{const s=await vs(Be,ie);if(s)return s}catch(s){console.warn("WebGPU init failed, falling back to WebGL2:",s)}const e=Ms(Be,ie);if(!e)throw new Error("Neither WebGPU nor WebGL2 is available.");return e}let Ke=0,Xe=0;addEventListener("pointermove",e=>{Ke=e.clientX/innerWidth*2-1,Xe=-(e.clientY/innerHeight*2-1)});const D=await Cs();D.setCount(Nt);W.backend=`${D.name} · ${D.detail}`;const Vt=document.getElementById("list-viewport"),le=new gs(Vt,document.getElementById("list-spacer"),ie,D),Y=new Ss(ie,document.body,document.getElementById("sidebar"),Vt),it=document.getElementById("sidebar-head"),yt=Ge.map((e,s)=>{const t=document.createElement("button");t.className="chip",t.textContent=e;const[i,a,o]=tt[s];return t.style.setProperty("--c",`rgb(${i*255|0} ${a*255|0} ${o*255|0})`),t.addEventListener("click",()=>ps(s)),it.appendChild(t),t}),nt=document.createElement("div");nt.className="summary";it.appendChild(nt);const $t=.982,Me=1,ot=document.createElement("div");ot.className="control";const at=document.createElement("label");at.htmlFor="cooling";const Q=document.createElement("input");Q.type="range";Q.id="cooling";Q.min="0";Q.max="1000";const Es=e=>Me-(Me-$t)*(1-e/1e3)**2,Rs=e=>1e3*(1-Math.sqrt((Me-e)/(Me-$t)));function qt(e){D.setCooling?.(e),Y.setCooling(e);const s=e**60;at.textContent=`disc cooling · ${((1-s)*100).toFixed(1)}%/s`+(e>=Me-1e-6?" — none, disc goes smooth":"")}Q.value=String(Rs(de));Q.addEventListener("input",()=>qt(Es(+Q.value)));ot.append(at,Q);it.appendChild(ot);ms(()=>{const e=we();for(let s=0;s<yt.length;s++)yt[s].classList.toggle("off",!(e&1<<s));D.setSpeciesMask(e),le.refilter(),nt.textContent=`${le.rowCount.toLocaleString()} rows · ${fs()}`});const Se=document.createElement("div");Se.id="banner";document.body.appendChild(Se);const zt=()=>Pe===1?"Chladni plate · 6 frequencies":"orbital galaxy";function rt(){Se.textContent=`${D.name} compute · ${ie.count.toLocaleString()} particles · ${zt()} — [M] mode · [B] compare · [R] restart · [C] ${ve?"colour":"mono"}`}function $e(e){Ee(e),e==="baseline"?(Y.setMode(Pe),Y.start(),Be.style.display="none",Se.textContent=`naive DOM · ${re.toLocaleString()} particles as elements · ${zt()} · sidebar rebuilt per frame — [B] compare · [R] restart`):(Y.stop(),Be.style.display="block",le.forceRepaint(),rt()),Se.className=e,W.arm=e,xe.reset()}let Pe=0;function As(e){Pe=e,D.setMode(Pe),Ee()==="gpu"?rt():$e("baseline")}let ve=!1;function Ts(e){ve=e,D.setMono?.(ve),Y.setMono(ve),Ee()==="gpu"&&rt()}function ks(){D.reset(),Y.reset(),xe.reset()}addEventListener("keydown",e=>{(e.key==="b"||e.key==="B")&&$e(Ee()==="gpu"?"baseline":"gpu"),(e.key==="m"||e.key==="M")&&As(Pe===0?1:0),(e.key==="r"||e.key==="R")&&ks(),(e.key==="c"||e.key==="C")&&Ts(!ve)});function Wt(){const e=Math.min(devicePixelRatio,2);D.resize(innerWidth*e|0,innerHeight*e|0)}addEventListener("resize",Wt);Wt();qt(de);$e("gpu");globalThis.__demo={sim:ie,backend:D,hud:xe,counters:W,integrateCPU:Et,list:le,effectRuns:Gt,setArm:$e};let bt=performance.now();function Ht(e){xe.frame(e);const s=Math.min((e-bt)/1e3,1/30);bt=e,Ee()==="gpu"?(D.frame(s,Ke,Xe),le.update(),W.entities=ie.count,W.domNodes=le.liveNodes):(Y.frame(s,Ke,Xe),W.entities=Y.count,W.domNodes=Y.domNodes),W.effectRuns=Gt(),xe.paint(e,W),requestAnimationFrame(Ht)}requestAnimationFrame(Ht);
