(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function t(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=t(i);fetch(i.href,r)}})();const J=240,le=240,H=40,Xe=new Float32Array(J);class Bt{root;spark;sctx;frames=new Float32Array(J);head=0;filled=0;last=performance.now();dropped=0;total=0;longTasks=0;longTaskMs=0;refreshMs=16.67;fastest=1/0;textEls={};lastPaint=0;constructor(s){this.root=s,this.root.innerHTML="",this.spark=document.createElement("canvas"),this.spark.width=le*devicePixelRatio,this.spark.height=H*devicePixelRatio,this.spark.style.width=le+"px",this.spark.style.height=H+"px",this.spark.className="hud-spark",this.root.appendChild(this.spark);const t=this.spark.getContext("2d");if(!t)throw new Error("2D context unavailable for HUD sparkline");this.sctx=t,this.sctx.scale(devicePixelRatio,devicePixelRatio);for(const n of["fps","p50","p99","dropped","longtask","heap","entities","dom","effects","backend","arm"]){const i=document.createElement("div");i.className="hud-row";const r=document.createElement("span");r.className="hud-label",r.textContent=n;const o=document.createElement("span");o.className="hud-val",o.textContent="—",i.append(r,o),this.root.appendChild(i),this.textEls[n]=o}this.observeLongTasks()}observeLongTasks(){if(!("PerformanceObserver"in window))return;if(!PerformanceObserver.supportedEntryTypes?.includes("longtask")){this.textEls.longtask.textContent="unsupported";return}new PerformanceObserver(t=>{for(const n of t.getEntries())this.longTasks++,this.longTaskMs+=n.duration}).observe({entryTypes:["longtask"]})}frame(s){const t=s-this.last;this.last=s,this.total++,t>0&&t<1e3&&(this.frames[this.head]=t,this.head=(this.head+1)%J,this.filled<J&&this.filled++,t<this.fastest&&t>=4&&(this.fastest=t),this.refreshMs=Math.min(this.fastest,1e3/60),t>this.refreshMs*1.5&&this.dropped++)}paint(s,t){if(s-this.lastPaint<200)return;this.lastPaint=s;const n=this.filled;if(n===0)return;Xe.set(this.frames.subarray(0,n));const i=Xe.subarray(0,n);i.sort();const r=i[n*.5|0],o=i[Math.min(n-1,n*.99|0)];let f=0;for(let c=0;c<n;c++)f+=i[c];const h=f/n;this.textEls.fps.textContent=(1e3/h).toFixed(0),this.textEls.p50.textContent=r.toFixed(2)+" ms",this.textEls.p99.textContent=o.toFixed(2)+" ms",this.setWarn(this.textEls.p99,o>this.refreshMs*1.5);const a=this.total>0?this.dropped/this.total*100:0;this.textEls.dropped.textContent=`${this.dropped} (${a.toFixed(1)}%)`,this.setWarn(this.textEls.dropped,a>1),this.textEls.longtask.textContent!=="unsupported"&&(this.textEls.longtask.textContent=`${this.longTasks} / ${this.longTaskMs.toFixed(0)} ms`,this.setWarn(this.textEls.longtask,this.longTasks>0));const d=performance.memory;this.textEls.heap.textContent=d?(d.usedJSHeapSize/1048576).toFixed(1)+" MB":"n/a",this.textEls.entities.textContent=t.entities.toLocaleString(),this.textEls.dom.textContent=t.domNodes.toLocaleString(),this.textEls.effects.textContent=`${t.effectRuns} / ${this.total} frames`,this.textEls.backend.textContent=t.backend,this.textEls.arm.textContent=t.arm,this.drawSpark()}setWarn(s,t){s.className=t?"hud-val warn":"hud-val"}drawSpark(){const s=this.sctx,t=this.refreshMs,n=H/(t*2);s.clearRect(0,0,le,H),s.strokeStyle="rgba(120,200,255,0.25)",s.beginPath(),s.moveTo(0,H-t*n),s.lineTo(le,H-t*n),s.stroke(),s.strokeStyle="#6cf",s.lineWidth=1,s.beginPath();const i=this.filled,r=le/J;for(let o=0;o<i;o++){const f=(this.head-i+o+J*2)%J,h=H-Math.min(H,this.frames[f]*n),a=o*r;o===0?s.moveTo(a,h):s.lineTo(a,h)}s.stroke()}reset(){this.frames.fill(0),this.head=0,this.filled=0,this.dropped=0,this.total=0,this.longTasks=0,this.longTaskMs=0,this.last=performance.now(),this.fastest=1/0,this.refreshMs=1e3/60}}const j=.5,Dt=.01,Lt=1.5,Ut=.35,Le=.3;function Ue(e,s=e.spin1){const t=j*2,n=Lt,i=Math.sqrt(2*t/n),r=Math.sqrt(2*t*Ut)/n,o=-Math.sqrt(Math.max(0,i*i-r*r));e.x0=-n/2,e.y0=0,e.x1=n/2,e.y1=0,e.vx0=-o/2,e.vy0=-r/2,e.vx1=o/2,e.vy1=r/2,e.spin1=s,e.elapsed=0}function Ft(){const e={x0:0,y0:0,vx0:0,vy0:0,x1:0,y1:0,vx1:0,vy1:0,spin1:1,elapsed:0};return Ue(e),e}function Nt(e,s){const t=()=>{const r=e.x1-e.x0,o=e.y1-e.y0,f=r*r+o*o+Dt,h=j/(f*Math.sqrt(f));return[r*h,o*h]};let[n,i]=t();e.vx0+=n*s*.5,e.vy0+=i*s*.5,e.vx1-=n*s*.5,e.vy1-=i*s*.5,e.x0+=e.vx0*s,e.y0+=e.vy0*s,e.x1+=e.vx1*s,e.y1+=e.vy1*s,[n,i]=t(),e.vx0+=n*s*.5,e.vy0+=i*s*.5,e.vx1-=n*s*.5,e.vy1-=i*s*.5,e.elapsed+=s}function Gt(e){return Math.hypot(e.x1-e.x0,e.y1-e.y0)}const G=4,Vt=.55,ie=.2,lt=.6,ne=3,Je=.9995,Wt=.995,Q=6,Qe=1.6,Ze=.045,et=.35*.35,zt=1.15,tt=.04,Ht=.8,$t=.28,Fe=1.6,Me=["argon","boron","cesium","dysprosium","erbium","fermium"],Ne=[[.29,.62,1],[1,.45,.62],[.42,1,.72],[1,.76,.33],[.72,.55,1],[.35,.95,1]];function jt(e){return function(){e|=0,e=e+1831565813|0;let s=Math.imul(e^e>>>15,1|e);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}function Kt(e,s=2654435769){const t=new Float32Array(e*G),n=new Uint8Array(e),i=new Float32Array(e),r=jt(s);for(let o=0;o<e;o++){const f=o*G,h=r()*Math.PI*2,a=Math.max(.03,Math.sqrt(r())*.65);t[f]=Math.cos(h)*a,t[f+1]=Math.sin(h)*a;const d=Pe(a)*.94;t[f+2]=-Math.sin(h)*d,t[f+3]=Math.cos(h)*d;const c=a/.65*Q,l=(r()-.5)*Fe;n[o]=Math.max(0,Math.min(Q-1,c+l|0)),i[o]=r()}return{particles:t,species:n,stat:i,capacity:e,count:e}}function dt(e,s,t,n,i=0,r=ie){const o=e.particles,f=e.count,h=.99995,a=Math.cos(2*Qe*i),d=Math.sin(2*Qe*i);for(let c=0;c<f;c++){const l=c*G,p=o[l],m=o[l+1],y=-p,v=-m,x=y*y+v*v+.004,w=Math.sqrt(x),A=ut(x),E=t-p,P=n-m,_=E*E+P*P+.02,R=r/(_*Math.sqrt(_)),C=p/w,b=m/w,I=C*C-b*b,U=2*C*b,ae=I*a+U*d,g=U*a-I*d,u=w*w+et,M=-Ze*w*w/(u*u),k=-(-2*Ze*w*(et-w*w)/(u*u*u))*ae,F=2*M*g/w,O=C*k-b*F,z=b*k+C*F;let S=o[l+2]+y*A*s+E*R*s+O*s,D=o[l+3]+v*A*s+P*R*s+z*s;const re=y/w,K=v/w,Y=S*re+D*K,Te=Math.max(0,Math.min(1,(w-.25)/.35)),ze=Je+(Wt-Je)*Te*Te*(3-2*Te);S=S-Y*re+Y*re*ze,D=D-Y*K+Y*K*ze,S*=h,D*=h;const _e=Math.hypot(S,D);_e>ne&&(S*=ne/_e,D*=ne/_e);let oe=p+S*s,ce=m+D*s;const He=Yt(e.species[c],c),Ot=Math.max(.05,He*$t),Ie=Math.hypot(oe,ce);if(Ie>zt||Ie<Ot){const $e=1/Math.max(Ie,1e-6),je=oe*$e,Ke=ce*$e,qt=oe*D-ce*S>=0?1:-1,ke=He,Ye=Pe(ke)*qt;oe=je*ke,ce=Ke*ke,S=-Ke*Ye,D=je*Ye}o[l]=oe,o[l+1]=ce,o[l+2]=S,o[l+3]=D}}function ut(e){return Vt/(e*Math.sqrt(e))-.0025/(e*e)}function Pe(e){const s=e*e+.004;return e*Math.sqrt(Math.max(0,ut(s)))}function Yt(e,s){const t=(Oe(s*11+5)-.5)*Fe,n=Math.min(1,Math.max(.04,(e+.5+t)/Q));return tt+(Ht-tt)*n}const st=new Float32Array([0,1,1,0,0,2,2,0,1,3,3,1]);function Oe(e){let s=Math.imul(e,747796405)+2891336453;return s=Math.imul(s>>>(s>>>28)+4^s,277803737),((s>>>22^s)>>>0)/4294967296}function Xt(e,s,t){const n=Math.sin(t*.11)*1.4;return{n:1+(e*.5+.5)*12+n,m:1+(s*.5+.5)*12+n}}function Jt(e,s,t,n,i){const r=e.particles,o=e.count,f=i*60|0;for(let h=0;h<o;h++){const a=h*G,d=e.species[h],c=t+st[d*2],l=n+st[d*2+1],p=(r[a]+1)*.5,m=(r[a+1]+1)*.5,y=Math.cos(c*Math.PI*p),v=Math.cos(l*Math.PI*m),x=Math.cos(l*Math.PI*p),w=Math.cos(c*Math.PI*m),A=y*v-x*w,E=-c*Math.PI*Math.sin(c*Math.PI*p)*v+l*Math.PI*Math.sin(l*Math.PI*p)*w,P=-l*Math.PI*y*Math.sin(l*Math.PI*m)+c*Math.PI*x*Math.sin(c*Math.PI*m),_=Math.sign(A)*.5,R=Math.abs(A),C=Oe(h*2+f)-.5,b=Oe(h*2+1+f)-.5,I=(r[a+2]-E*_*2.4*s+C*R*2.2*s)*.86,U=(r[a+3]-P*_*2.4*s+b*R*2.2*s)*.86;r[a]=Math.max(-1,Math.min(1,r[a]+I*s)),r[a+1]=Math.max(-1,Math.min(1,r[a+1]+U*s)),r[a+2]=I,r[a+3]=U}}function Qt(e,s,t,n,i,r=ie){const o=e.particles,f=e.count;for(let h=0;h<f;h++){const a=h*G,d=o[a],c=o[a+1],l=i.x0-d,p=i.y0-c,m=l*l+p*p+.004,y=j/(m*Math.sqrt(m)),v=i.x1-d,x=i.y1-c,w=v*v+x*x+.004,A=j/(w*Math.sqrt(w)),E=t-d,P=n-c,_=E*E+P*P+.02,R=r/(_*Math.sqrt(_));let C=o[a+2]+(l*y+v*A+E*R)*s,b=o[a+3]+(p*y+x*A+P*R)*s;const I=Math.hypot(C,b);I>ne&&(C*=ne/I,b*=ne/I),o[a]=d+C*s,o[a+1]=c+b*s,o[a+2]=C,o[a+3]=b}}function Zt(e,s,t,n){const i=e.particles;for(let r=0;r<s;r++){const o=r*G;if(t===2&&n){const f=r&1,h=Math.random()*Math.PI*2,a=(Math.random()-.5)*Fe,d=Math.min(1,Math.max(.02,(e.species[r]+.5+a)/Q)),c=Math.max(.05,Le*Math.sqrt(d)),l=Math.sqrt(j/c)*(f?n.spin1:1);i[o]=(f?n.x1:n.x0)+Math.cos(h)*c,i[o+1]=(f?n.y1:n.y0)+Math.sin(h)*c,i[o+2]=(f?n.vx1:n.vx0)-Math.sin(h)*l,i[o+3]=(f?n.vy1:n.vy0)+Math.cos(h)*l}else if(t===1)i[o]=Math.random()*2-1,i[o+1]=Math.random()*2-1,i[o+2]=0,i[o+3]=0;else{const f=Math.random()*Math.PI*2,h=Math.max(.03,Math.sqrt(Math.random())*.65),a=Pe(h)*.94;i[o]=Math.cos(f)*h,i[o+1]=Math.sin(f)*h,i[o+2]=-Math.sin(f)*a,i[o+3]=Math.cos(f)*a}}}function es({update:e,notify:s,unwatched:t}){return{link:n,unlink:i,propagate:r,checkDirty:o,shallowPropagate:f};function n(a,d,c){const l=d.depsTail;if(l!==void 0&&l.dep===a)return;const p=l!==void 0?l.nextDep:d.deps;if(p!==void 0&&p.dep===a){p.version=c,d.depsTail=p;return}const m=a.subsTail;if(m!==void 0&&m.version===c&&m.sub===d)return;const y=d.depsTail=a.subsTail={version:c,dep:a,sub:d,prevDep:l,nextDep:p,prevSub:m,nextSub:void 0};p!==void 0&&(p.prevDep=y),l!==void 0?l.nextDep=y:d.deps=y,m!==void 0?m.nextSub=y:a.subs=y}function i(a,d=a.sub){const{dep:c,prevDep:l,nextDep:p,nextSub:m,prevSub:y}=a;return p!==void 0?p.prevDep=l:d.depsTail=l,l!==void 0?l.nextDep=p:d.deps=p,m!==void 0?m.prevSub=y:c.subsTail=y,y!==void 0?y.nextSub=m:(c.subs=m)===void 0&&t(c),p}function r(a,d){let c=a.nextSub,l;e:do{const p=a.sub;let m=p.flags;if(m&60?m&12?m&4?!(m&48)&&h(a,p)?(p.flags=m|40,m&=1):m=0:p.flags=m&-9|32:m=0:(p.flags=m|32,d&&(p.flags|=8)),m&2&&s(p),m&1){const y=p.subs;if(y!==void 0){const v=(a=y).nextSub;v!==void 0&&(l={value:c,prev:l},c=v);continue}}if((a=c)!==void 0){c=a.nextSub;continue}for(;l!==void 0;)if(a=l.value,l=l.prev,a!==void 0){c=a.nextSub;continue e}break}while(!0)}function o(a,d){let c,l=0,p=!1;e:do{const m=a.dep,y=m.flags;if(d.flags&16)p=!0;else if((y&17)===17){const v=m.subs;e(m)&&(v.nextSub!==void 0&&f(v),p=!0)}else if((y&33)===33){c={value:a,prev:c},a=m.deps,d=m,++l;continue}if(!p){const v=a.nextDep;if(v!==void 0){a=v;continue}}for(;l--;){if(a=c.value,c=c.prev,p){const x=d.subs;if(e(d)){x.nextSub!==void 0&&f(x),d=a.sub;continue}p=!1}else d.flags&=-33;d=a.sub;const v=a.nextDep;if(v!==void 0){a=v;continue e}}return p&&!!d.flags}while(!0)}function f(a){do{const d=a.sub,c=d.flags;(c&48)===32&&(d.flags=c|16,(c&6)===2&&s(d))}while((a=a.nextSub)!==void 0)}function h(a,d){let c=d.depsTail;for(;c!==void 0;){if(c===a)return!0;c=c.prevDep}return!1}}const ye=64;let Re=0,ue=0,X=0,de=0,N;const W=[],{link:Ge,unlink:pe,propagate:ts,checkDirty:ht,shallowPropagate:ft}=es({update(e){return"getter"in e?mt(e):"currentValue"in e?vt(e):(e.flags=1,!0)},notify(e){let s=de,t=s;do if(W[s++]=e,e.flags&=-3,e=e.subs?.sub,e===void 0||!(e.flags&2))break;while(!0);for(de=s;t<--s;){const n=W[t];W[t++]=W[s],W[s]=n}},unwatched(e){"getter"in e?e.depsTail!==void 0&&(e.flags=17,wt(e)):"currentValue"in e||("fn"in e?yt.call(e):bt.call(e))}});function Ee(e){const s=N;return N=e,s}function Se(e){return rs.bind({currentValue:e,pendingValue:e,subs:void 0,subsTail:void 0,flags:1})}function pt(e){return as.bind({value:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:0,getter:e})}function ss(e){const s={fn:e,cleanup:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:6},t=Ee(s);t!==void 0&&(Ge(s,t,0),t.flags|=ye);try{++ue,s.cleanup=s.fn()}finally{--ue,N=t,s.flags&=-5}return yt.bind(s)}function mt(e){if(e.flags&ye){let t=e.depsTail;for(;t!==void 0;){const n=t.prevDep,i=t.dep;!("getter"in i)&&!("currentValue"in i)&&pe(t,e),t=n}}e.depsTail=void 0,e.flags=5;const s=Ee(e);try{++Re;const t=e.value;return t!==(e.value=e.getter(t))}finally{N=s,e.flags&=-5,xt(e)}}function vt(e){return e.flags=1,e.currentValue!==(e.currentValue=e.pendingValue)}function ns(e){const s=e.flags;if(s&16||s&32&&ht(e.deps,e)){if(s&ye){let n=e.depsTail;for(;n!==void 0;){const i=n.prevDep,r=n.dep;!("getter"in r)&&!("currentValue"in r)&&pe(n,e),n=i}}if(e.cleanup&&(gt(e),!e.flags))return;e.depsTail=void 0,e.flags=6;const t=Ee(e);try{++Re,++ue,e.cleanup=e.fn()}finally{--ue,N=t,e.flags&=-5,xt(e)}}else e.deps!==void 0&&(e.flags=2|s&ye)}function is(){try{for(;X<de;){const e=W[X];W[X++]=void 0,ns(e)}}finally{for(;X<de;){const e=W[X];W[X++]=void 0,e.flags|=10}X=0,de=0}}function as(){const e=this.flags;if(e&16||e&32&&(ht(this.deps,this)||(this.flags=e&-33,!1))){if(mt(this)){const t=this.subs;t!==void 0&&ft(t)}}else if(!e){this.flags=5;const t=Ee(this);try{this.value=this.getter()}finally{N=t,this.flags&=-5}}const s=N;return s!==void 0&&Ge(this,s,Re),this.value}function rs(...e){if(e.length){if(this.pendingValue!==(this.pendingValue=e[0])){this.flags=17;const s=this.subs;s!==void 0&&(ts(s,!!ue),is())}}else{if(this.flags&16&&vt(this)){const t=this.subs;t!==void 0&&ft(t)}const s=N;return s!==void 0&&Ge(this,s,Re),this.currentValue}}function gt(e){const s=e.cleanup;e.cleanup=void 0;const t=N;N=void 0;try{s()}finally{N=t}}function yt(){bt.call(this),this.cleanup&&gt(this)}function bt(){this.flags=0,wt(this);const e=this.subs;e!==void 0&&pe(e)}function wt(e){let s=e.depsTail;for(;s!==void 0;){const t=s.prevDep;pe(s,e),s=t}}function xt(e){const s=e.depsTail;let t=s!==void 0?s.nextDep:e.deps;for(;t!==void 0;)t=pe(t,e)}const he=Se((1<<Q)-1),os=Se(-1),te=Se("gpu");Se(0);const cs=pt(()=>{const e=he(),s=[];for(let t=0;t<Q;t++)e&1<<t&&s.push(t);return s}),ls=pt(()=>{const e=cs();return e.length===Q?"all species":e.length===0?"none":e.map(s=>Me[s]).join(", ")});function ds(e){he(he()^1<<e)}let Mt=0;const Pt=()=>Mt;function us(e){return ss(()=>{Mt++,e()})}const ve=4096,me=24,nt=4;class hs{constructor(s,t,n,i){this.sim=n,this.backend=i,this.viewport=s,this.spacer=t,this.filtered=new Uint32Array(n.capacity),this.poolIds=new Int32Array(0),this.buildPool(),this.refilter(),this.viewport.addEventListener("scroll",()=>{this.scrollTop=this.viewport.scrollTop,this.dirty=!0},{passive:!0}),new ResizeObserver(()=>{this.buildPool(),this.dirty=!0}).observe(this.viewport)}viewport;spacer;pool=[];poolIds;filtered;filteredCount=0;scrollTop=0;poolSize=0;dirty=!0;live=new Float32Array(0);liveBase=0;liveCount=0;readPending=!1;lastRead=0;buildPool(){const s=Math.ceil(this.viewport.clientHeight/me)+nt*2;if(s!==this.poolSize){for(;this.pool.length<s;){const t=document.createElement("div");t.className="row";const n=document.createElement("span");n.className="id";const i=document.createElement("span");i.className="sp";const r=document.createElement("div");r.className="bar";const o=document.createElement("span");o.className="v",t.append(n,i,r,o);const f=this.pool.length;t.addEventListener("click",()=>{const h=this.poolIds[f];h>=0&&os(h)}),this.viewport.appendChild(t),this.pool.push(t)}for(;this.pool.length>s;)this.pool.pop().remove();this.poolSize=s,this.poolIds=new Int32Array(s).fill(-1)}}refilter(){const s=he(),{species:t,count:n}=this.sim,i=this.filtered;let r=0;for(let o=0;o<n;o++)s&1<<t[o]&&(i[r++]=o);this.filteredCount=r,this.spacer.style.height=r*me+"px",this.dirty=!0}forceRepaint(){this.poolIds.fill(-1),this.dirty=!0}get rowCount(){return this.filteredCount}get liveNodes(){return this.poolSize}update(){const s=Math.max(0,(this.scrollTop/me|0)-nt),t=Math.min(this.filteredCount,s+this.poolSize);if(this.scheduleReadback(s,t),!!this.dirty){this.dirty=!1;for(let n=0;n<this.poolSize;n++){const i=s+n,r=this.pool[n];if(i>=t){this.poolIds[n]!==-1&&(r.style.visibility="hidden",this.poolIds[n]=-1);continue}const o=this.filtered[i];if(this.poolIds[n]!==o){this.poolIds[n]=o;const h=this.sim.species[o],[a,d,c]=Ne[h],l=`rgb(${a*255|0} ${d*255|0} ${c*255|0})`;r.style.visibility="visible",r.children[0].textContent=String(o),r.children[1].textContent=Me[h],r.children[1].style.color=l,r.children[2].style.background=l}r.style.transform=`translateY(${i*me}px)`;const f=this.readLive(o);r.children[2].style.transform=`scaleX(${f.toFixed(3)})`,r.children[3].textContent=f.toFixed(4)}}}readLive(s){if(this.liveCount>0){const t=s-this.liveBase;if(t>=0&&t<this.liveCount){const n=t*G,i=this.live[n+2],r=this.live[n+3];return Math.min(1,Math.hypot(i,r)*.7)}}return this.sim.stat[s]}scheduleReadback(s,t){if(this.readPending||t<=s||!this.backend.readback)return;const n=performance.now();if(n-this.lastRead<80)return;this.lastRead=n;const i=this.filtered[s],o=this.filtered[Math.max(s,t-1)]-i+1;o<=0||o>ve||(this.readPending=!0,this.backend.readback(i,o).then(f=>{this.live=f,this.liveBase=i,this.liveCount=f.length/G,this.dirty=!0}).catch(()=>{}).finally(()=>{this.readPending=!1}))}}const qe=64,fs=`
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
@compute @workgroup_size(${qe})
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

@compute @workgroup_size(${qe})
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
`;async function ps(e,s){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)return null;const n=await t.requestDevice();n.addEventListener("uncapturederror",u=>{console.error("[webgpu]",u.error.message)});const i=e.getContext("webgpu");if(!i)return null;const r=navigator.gpu.getPreferredCanvasFormat();i.configure({device:n,format:r,alphaMode:"premultiplied"});const o=n.createBuffer({size:s.particles.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});n.queue.writeBuffer(o,0,s.particles);const f=n.createBuffer({size:96,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),h=new ArrayBuffer(96),a=new Float32Array(h),d=new Uint32Array(h),c=new Uint32Array(s.capacity);for(let u=0;u<s.capacity;u++)c[u]=s.species[u];const l=n.createBuffer({size:c.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(l,0,c);let p=63,m=0,y=ie,v=null,x=0,w=!1;const A=n.createBuffer({size:ve*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),E=new Float32Array(ve*4),P=n.createShaderModule({code:fs}),_=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}}]}),R=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),C=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[_]}),compute:{module:P,entryPoint:"integrate"}}),b=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[_]}),compute:{module:P,entryPoint:"scatter"}}),I=n.createRenderPipeline({layout:n.createPipelineLayout({bindGroupLayouts:[R]}),vertex:{module:P,entryPoint:"vs"},fragment:{module:P,entryPoint:"fs",targets:[{format:r,blend:{color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),U=n.createBindGroup({layout:_,entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:l}}]}),ae=n.createBindGroup({layout:R,entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:l}}]});let g=s.count;return{name:"webgpu",detail:`${t.info?.vendor??"gpu"} ${t.info?.architecture??""}`.trim(),setCount(u){g=Math.min(u,s.capacity)},setSpeciesMask(u){p=u>>>0},setMode(u){m=u|0,w=!0},setCursorMass(u){y=u},setPair(u){v=u},frame(u,M,T){if(a[0]=u,a[1]=M,a[2]=T,a[3]=e.width/e.height,a[4]=Math.min(.006,Math.max(.0018,.06/Math.sqrt(g))),a[5]=Math.min(1,Math.max(.3,12e4/g)),d[6]=p,d[7]=m,x+=u,a[8]=x,m===1){const S=Math.sin(x*.11)*1.4;a[9]=1+(M*.5+.5)*12+S,a[10]=1+(T*.5+.5)*12+S}else a[9]=0,a[10]=0;a[11]=y,a[23]=m===2?.55:1,v&&(a[12]=v.x0,a[13]=v.y0,a[14]=v.vx0,a[15]=v.vy0,a[16]=v.x1,a[17]=v.y1,a[18]=v.vx1,a[19]=v.vy1,a[20]=j,a[21]=v.spin1,a[22]=Le),n.queue.writeBuffer(f,0,h);const k=n.createCommandEncoder(),F=Math.ceil(g/qe),O=k.beginComputePass();w&&(w=!1,O.setPipeline(b),O.setBindGroup(0,U),O.dispatchWorkgroups(F)),O.setPipeline(C),O.setBindGroup(0,U),O.dispatchWorkgroups(F),O.end();const z=k.beginRenderPass({colorAttachments:[{view:i.getCurrentTexture().createView(),clearValue:{r:.027,g:.035,b:.051,a:1},loadOp:"clear",storeOp:"store"}]});z.setPipeline(I),z.setBindGroup(0,ae),z.draw(6,g),z.end(),n.queue.submit([k.finish()])},resize(u,M){e.width=u,e.height=M},async readback(u,M){const T=Math.max(0,Math.min(u,g-1)),k=Math.max(0,Math.min(M,ve,g-T));if(k===0)return E.subarray(0,0);const F=k*16,O=n.createCommandEncoder();return O.copyBufferToBuffer(o,T*16,A,0,F),n.queue.submit([O.finish()]),await A.mapAsync(GPUMapMode.READ,0,F),E.set(new Float32Array(A.getMappedRange(0,F))),A.unmap(),E.subarray(0,k*4)},destroy(){o.destroy(),f.destroy(),l.destroy(),A.destroy(),n.destroy()}}}const ms=`#version 300 es
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
}`,vs=`#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`,gs=`#version 300 es
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
}`;function it(e,s,t){const n=e.createShader(s);if(e.shaderSource(n,t),e.compileShader(n),!e.getShaderParameter(n,e.COMPILE_STATUS))throw new Error("shader compile failed: "+e.getShaderInfoLog(n));return n}function at(e,s,t,n){const i=e.createProgram();if(e.attachShader(i,it(e,e.VERTEX_SHADER,s)),e.attachShader(i,it(e,e.FRAGMENT_SHADER,t)),n&&e.transformFeedbackVaryings(i,n,e.SEPARATE_ATTRIBS),e.linkProgram(i),!e.getProgramParameter(i,e.LINK_STATUS))throw new Error("program link failed: "+e.getProgramInfoLog(i));return i}function bs(e,s){const t=e.getContext("webgl2",{alpha:!1,antialias:!1});if(!t)return null;const n=s.capacity,i=new Float32Array(n*2),r=new Float32Array(n*2);for(let g=0;g<n;g++)i[g*2]=s.particles[g*4],i[g*2+1]=s.particles[g*4+1],r[g*2]=s.particles[g*4+2],r[g*2+1]=s.particles[g*4+3];const o=g=>{const u=t.createBuffer();return t.bindBuffer(t.ARRAY_BUFFER,u),t.bufferData(t.ARRAY_BUFFER,g,t.DYNAMIC_COPY),u};let f=o(i),h=o(r),a=o(i),d=o(r);const c=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),l=o(c),p=new Float32Array(n);for(let g=0;g<n;g++)p[g]=s.species[g];const m=o(p),y=at(t,ms,vs,["vPos","vVel"]),v=at(t,gs,ys),x={aPos:t.getAttribLocation(y,"aPos"),aVel:t.getAttribLocation(y,"aVel"),aSpecies:t.getAttribLocation(y,"aSpecies"),uDt:t.getUniformLocation(y,"uDt"),uMouse:t.getUniformLocation(y,"uMouse"),uMode:t.getUniformLocation(y,"uMode"),uTime:t.getUniformLocation(y,"uTime"),uWarp:t.getUniformLocation(y,"uWarp"),uWarpM:t.getUniformLocation(y,"uWarpM"),uGCursor:t.getUniformLocation(y,"uGCursor"),uC0:t.getUniformLocation(y,"uC0"),uC1:t.getUniformLocation(y,"uC1"),uPMass:t.getUniformLocation(y,"uPMass")},w={aPos:t.getAttribLocation(v,"aPos"),aVel:t.getAttribLocation(v,"aVel"),aCorner:t.getAttribLocation(v,"aCorner"),aSpecies:t.getAttribLocation(v,"aSpecies"),uAspect:t.getUniformLocation(v,"uAspect"),uSize:t.getUniformLocation(v,"uSize"),uScale:t.getUniformLocation(v,"uScale"),uGain:t.getUniformLocation(v,"uGain"),uMask:t.getUniformLocation(v,"uMask")},A=t.createTransformFeedback();let E=s.count;const P=(g,u,M=0,T=2)=>{t.bindBuffer(t.ARRAY_BUFFER,g),t.enableVertexAttribArray(u),t.vertexAttribPointer(u,T,t.FLOAT,!1,0,0),t.vertexAttribDivisor(u,M)};let _=63,R=0,C=ie,b=null,I=0;const U=t.getExtension("WEBGL_debug_renderer_info"),ae=String(U?t.getParameter(U.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER));return t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE),{name:"webgl2",detail:ae,setCount(g){E=Math.min(g,s.capacity)},setSpeciesMask(g){_=g>>>0},setCursorMass(g){C=g},setPair(g){b=g},setMode(g){R=g|0;for(let u=0;u<n;u++)if(R===1)i[u*2]=Math.random()*2-1,i[u*2+1]=Math.random()*2-1,r[u*2]=0,r[u*2+1]=0;else if(R===2&&b){const M=u&1,T=M?b.x1:b.x0,k=M?b.y1:b.y0,F=M?b.vx1:b.vx0,O=M?b.vy1:b.vy0,z=M?b.spin1:1,S=Math.random()*Math.PI*2,D=(Math.random()-.5)*1.6,re=Math.min(1,Math.max(.02,(s.species[u]+.5+D)/6)),K=Math.max(.05,Le*Math.sqrt(re)),Y=Math.sqrt(j/K)*z;i[u*2]=T+Math.cos(S)*K,i[u*2+1]=k+Math.sin(S)*K,r[u*2]=F-Math.sin(S)*Y,r[u*2+1]=O+Math.cos(S)*Y}else{const M=Math.random()*Math.PI*2,T=Math.max(.03,Math.sqrt(Math.random())*.65),k=Pe(T)*.94;i[u*2]=Math.cos(M)*T,i[u*2+1]=Math.sin(M)*T,r[u*2]=-Math.sin(M)*k,r[u*2+1]=Math.cos(M)*k}for(const[u,M]of[[f,i],[a,i],[h,r],[d,r]])t.bindBuffer(t.ARRAY_BUFFER,u),t.bufferSubData(t.ARRAY_BUFFER,0,M)},frame(g,u,M){t.useProgram(y),t.uniform1f(x.uDt,g),t.uniform2f(x.uMouse,u,M),t.uniform1i(x.uMode,R),I+=g,t.uniform1f(x.uTime,I);const T=R===1?Math.sin(I*.11)*1.4:0;t.uniform1f(x.uWarp,R===1?1+(u*.5+.5)*12+T:0),t.uniform1f(x.uWarpM,R===1?1+(M*.5+.5)*12+T:0),t.uniform1f(x.uGCursor,C),t.uniform2f(x.uC0,b?b.x0:0,b?b.y0:0),t.uniform2f(x.uC1,b?b.x1:0,b?b.y1:0),t.uniform1f(x.uPMass,j),P(f,x.aPos),P(h,x.aVel),P(m,x.aSpecies,0,1),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,A),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,a),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,d),t.enable(t.RASTERIZER_DISCARD),t.beginTransformFeedback(t.POINTS),t.drawArrays(t.POINTS,0,E),t.endTransformFeedback(),t.disable(t.RASTERIZER_DISCARD),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,null),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,null),t.clearColor(.027,.035,.051,1),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(v),t.uniform1f(w.uAspect,e.width/e.height),t.uniform1f(w.uSize,Math.min(.006,Math.max(.0018,.06/Math.sqrt(E)))),t.uniform1f(w.uGain,Math.min(1,Math.max(.6,2e5/E))),t.uniform1f(w.uScale,R===2?.55:1),t.uniform1i(w.uMask,_),P(l,w.aCorner,0),P(a,w.aPos,1),P(d,w.aVel,1),P(m,w.aSpecies,1,1),t.drawArraysInstanced(t.TRIANGLES,0,6,E),[f,a]=[a,f],[h,d]=[d,h]},resize(g,u){e.width=g,e.height=u,t.viewport(0,0,g,u)},destroy(){t.deleteProgram(y),t.deleteProgram(v);for(const g of[f,a,h,d,l,m])t.deleteBuffer(g);t.deleteTransformFeedback(A)}}}const se=5e3,rt=400;class ws{constructor(s,t,n,i){this.sim=s,this.gpuViewport=i,this.layer=document.createElement("div"),this.layer.id="baseline-layer",t.appendChild(this.layer),this.listHost=document.createElement("div"),this.listHost.id="baseline-list",n.appendChild(this.listHost)}layer;nodes=[];listHost;active=!1;mode=0;elapsed=0;pair;get count(){return se}start(){if(!this.active){this.active=!0,this.layer.style.display="block",this.listHost.style.display="block",this.gpuViewport.style.display="none";for(let s=0;s<se;s++){const t=document.createElement("div");t.className="bp";const[n,i,r]=Ne[this.sim.species[s]];t.style.background=`rgb(${n*255|0} ${i*255|0} ${r*255|0})`,this.layer.appendChild(t),this.nodes.push(t)}}}stop(){this.active&&(this.active=!1,this.layer.style.display="none",this.layer.replaceChildren(),this.nodes.length=0,this.listHost.innerHTML="",this.listHost.style.display="none",this.gpuViewport.style.display="")}get domNodes(){return this.active?this.nodes.length+rt:0}setMode(s,t){this.mode=s,this.elapsed=0,this.pair=t,Zt(this.sim,se,s,t)}frame(s,t,n,i){if(!this.active)return;this.elapsed+=s;const r=this.sim.count;if(this.sim.count=se,this.mode===2&&this.pair)Qt(this.sim,s,t,n,this.pair,i);else if(this.mode===1){const{n:c,m:l}=Xt(t,n,this.elapsed);Jt(this.sim,s,c,l,this.elapsed)}else dt(this.sim,s,t,n,this.elapsed,i);this.sim.count=r;const o=innerWidth,f=innerHeight,h=this.sim.particles,a=this.mode===2?.55:1;for(let c=0;c<se;c++){const l=c*G,p=this.nodes[c];p.style.left=((h[l]*a*.5+.5)*o).toFixed(1)+"px",p.style.top=((-h[l+1]*a*.5+.5)*f).toFixed(1)+"px"}let d="";for(let c=0;c<rt;c++){const l=c*G,p=Math.min(1,Math.hypot(h[l+2],h[l+3])*.22);d+=`<div class="row"><span class="id">${c}</span><span class="sp">${Me[this.sim.species[c]]}</span><span class="v">${p.toFixed(4)}</span></div>`}this.listHost.innerHTML=d}}const Rt=new URLSearchParams(location.search),Et=Math.max(1,Number(Rt.get("n"))||1e6),be=document.getElementById("stage"),we=new Bt(document.getElementById("hud")),Z=Kt(Et),V={entities:0,domNodes:0,arm:"gpu",backend:"booting",effectRuns:0},xs=Rt.get("backend");async function Ms(){if(xs!=="webgl2")try{const s=await ps(be,Z);if(s)return s}catch(s){console.warn("WebGPU init failed, falling back to WebGL2:",s)}const e=bs(be,Z);if(!e)throw new Error("Neither WebGPU nor WebGL2 is available.");return e}let Be=0,De=0,ge=!1;addEventListener("pointermove",e=>{Be=e.clientX/innerWidth*2-1,De=-(e.clientY/innerHeight*2-1)});const q=await Ms();q.setCount(Et);function Ae(e){ge!==e&&(ge=e,q.setCursorMass(ge?lt:ie))}addEventListener("pointerdown",e=>{e.target?.closest?.("#sidebar")||Ae(!0)});addEventListener("pointerup",()=>Ae(!1));addEventListener("pointercancel",()=>Ae(!1));addEventListener("blur",()=>Ae(!1));V.backend=`${q.name} · ${q.detail}`;const St=document.getElementById("list-viewport"),ee=new hs(St,document.getElementById("list-spacer"),Z,q),$=new ws(Z,document.body,document.getElementById("sidebar"),St),At=document.getElementById("sidebar-head"),ot=Me.map((e,s)=>{const t=document.createElement("button");t.className="chip",t.textContent=e;const[n,i,r]=Ne[s];return t.style.setProperty("--c",`rgb(${n*255|0} ${i*255|0} ${r*255|0})`),t.addEventListener("click",()=>ds(s)),At.appendChild(t),t}),Ve=document.createElement("div");Ve.className="summary";At.appendChild(Ve);us(()=>{const e=he();for(let s=0;s<ot.length;s++)ot[s].classList.toggle("off",!(e&1<<s));q.setSpeciesMask(e),ee.refilter(),Ve.textContent=`${ee.rowCount.toLocaleString()} rows · ${ls()}`});const fe=document.createElement("div");fe.id="banner";document.body.appendChild(fe);const Ps=3,Ct=()=>L===1?"Chladni plate · 6 frequencies":L===2?`galaxy collision · ${B.spin1>0?"prograde":"retrograde"}`:"barred galaxy";function We(){fe.textContent=`${q.name} compute · ${Z.count.toLocaleString()} particles · ${Ct()} — `+(L===2?"[M] mode · [B] compare · [R] flip spin · hold to pull":"[M] mode · [B] compare · [R] reset · hold to pull")}function Ce(e){te(e),e==="baseline"?($.setMode(L,B),$.start(),be.style.display="none",fe.textContent=`naive DOM · ${se.toLocaleString()} particles as elements · ${Ct()} · sidebar rebuilt per frame — press [B]`):($.stop(),be.style.display="block",ee.forceRepaint(),We()),fe.className=e,V.arm=e,we.reset()}let L=0;const B=Ft();q.setPair(B);function Rs(e){L=e,L===2&&Ue(B),q.setMode(L),te()==="gpu"?We():Ce("baseline")}function Es(){if(L===2){Tt();return}q.setMode(L),te()==="baseline"&&$.setMode(L,B)}function Tt(e=!0){Ue(B,e?-B.spin1:B.spin1),q.setMode(2),te()==="baseline"&&$.setMode(2,B),We()}addEventListener("keydown",e=>{(e.key==="b"||e.key==="B")&&Ce(te()==="gpu"?"baseline":"gpu"),(e.key==="m"||e.key==="M")&&Rs((L+1)%Ps),(e.key==="r"||e.key==="R")&&Es()});const Ss=document.getElementById("sidebar");let xe=!0;function _t(){xe=getComputedStyle(Ss).display!=="none"}function It(){const e=Math.min(devicePixelRatio,2);q.resize(innerWidth*e|0,innerHeight*e|0)}_t();addEventListener("resize",()=>{It();const e=!xe;_t(),e&&xe&&te()==="gpu"&&ee.forceRepaint()});It();Ce("gpu");globalThis.__demo={sim:Z,backend:q,hud:we,counters:V,integrateCPU:dt,list:ee,effectRuns:Pt,setArm:Ce};let ct=performance.now();function kt(e){we.frame(e);const s=Math.min((e-ct)/1e3,1/30);ct=e,L===2&&(Nt(B,s),B.elapsed>6&&(Gt(B)>2.4||B.elapsed>42)&&Tt()),te()==="gpu"?(q.frame(s,Be,De),xe&&ee.update(),V.entities=Z.count,V.domNodes=ee.liveNodes):($.frame(s,Be,De,ge?lt:ie),V.entities=$.count,V.domNodes=$.domNodes),V.effectRuns=Pt(),we.paint(e,V),requestAnimationFrame(kt)}requestAnimationFrame(kt);
