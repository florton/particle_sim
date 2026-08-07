(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&o(i)}).observe(document,{childList:!0,subtree:!0});function t(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(n){if(n.ep)return;n.ep=!0;const a=t(n);fetch(n.href,a)}})();const xe=240,qe=240,me=40,Zt=new Float32Array(xe);class js{root;spark;sctx;frames=new Float32Array(xe);head=0;filled=0;last=performance.now();dropped=0;total=0;longTasks=0;longTaskMs=0;refreshMs=16.67;fastest=1/0;textEls={};lastPaint=0;constructor(s){this.root=s,this.root.innerHTML="",this.spark=document.createElement("canvas"),this.spark.width=qe*devicePixelRatio,this.spark.height=me*devicePixelRatio,this.spark.style.width=qe+"px",this.spark.style.height=me+"px",this.spark.className="hud-spark",this.root.appendChild(this.spark);const t=this.spark.getContext("2d");if(!t)throw new Error("2D context unavailable for HUD sparkline");this.sctx=t,this.sctx.scale(devicePixelRatio,devicePixelRatio);for(const o of["fps","p50","p99","dropped","longtask","heap","entities","dom","effects","backend","arm"]){const n=document.createElement("div");n.className="hud-row";const a=document.createElement("span");a.className="hud-label",a.textContent=o;const i=document.createElement("span");i.className="hud-val",i.textContent="—",n.append(a,i),this.root.appendChild(n),this.textEls[o]=i}this.observeLongTasks()}observeLongTasks(){if(!("PerformanceObserver"in window))return;if(!PerformanceObserver.supportedEntryTypes?.includes("longtask")){this.textEls.longtask.textContent="unsupported";return}new PerformanceObserver(t=>{for(const o of t.getEntries())this.longTasks++,this.longTaskMs+=o.duration}).observe({entryTypes:["longtask"]})}frame(s){const t=s-this.last;this.last=s,this.total++,t>0&&t<1e3&&(this.frames[this.head]=t,this.head=(this.head+1)%xe,this.filled<xe&&this.filled++,t<this.fastest&&t>=4&&(this.fastest=t),this.refreshMs=Math.min(this.fastest,1e3/60),t>this.refreshMs*1.5&&this.dropped++)}paint(s,t){if(s-this.lastPaint<200)return;this.lastPaint=s;const o=this.filled;if(o===0)return;Zt.set(this.frames.subarray(0,o));const n=Zt.subarray(0,o);n.sort();const a=n[o*.5|0],i=n[Math.min(o-1,o*.99|0)];let m=0;for(let l=0;l<o;l++)m+=n[l];const h=m/o;this.textEls.fps.textContent=(1e3/h).toFixed(0),this.textEls.p50.textContent=a.toFixed(2)+" ms",this.textEls.p99.textContent=i.toFixed(2)+" ms",this.setWarn(this.textEls.p99,i>this.refreshMs*1.5);const r=this.total>0?this.dropped/this.total*100:0;this.textEls.dropped.textContent=`${this.dropped} (${r.toFixed(1)}%)`,this.setWarn(this.textEls.dropped,r>1),this.textEls.longtask.textContent!=="unsupported"&&(this.textEls.longtask.textContent=`${this.longTasks} / ${this.longTaskMs.toFixed(0)} ms`,this.setWarn(this.textEls.longtask,this.longTasks>0));const c=performance.memory;this.textEls.heap.textContent=c?(c.usedJSHeapSize/1048576).toFixed(1)+" MB":"n/a",this.textEls.entities.textContent=t.entities.toLocaleString(),this.textEls.dom.textContent=t.domNodes.toLocaleString(),this.textEls.effects.textContent=`${t.effectRuns} / ${this.total} frames`,this.textEls.backend.textContent=t.backend,this.textEls.arm.textContent=t.arm,this.drawSpark()}setWarn(s,t){s.className=t?"hud-val warn":"hud-val"}drawSpark(){const s=this.sctx,t=this.refreshMs,o=me/(t*2);s.clearRect(0,0,qe,me),s.strokeStyle="rgba(120,200,255,0.25)",s.beginPath(),s.moveTo(0,me-t*o),s.lineTo(qe,me-t*o),s.stroke(),s.strokeStyle="#6cf",s.lineWidth=1,s.beginPath();const n=this.filled,a=qe/xe;for(let i=0;i<n;i++){const m=(this.head-n+i+xe*2)%xe,h=me-Math.min(me,this.frames[m]*o),r=i*a;i===0?s.moveTo(r,h):s.lineTo(r,h)}s.stroke()}reset(){this.frames.fill(0),this.head=0,this.filled=0,this.dropped=0,this.total=0,this.longTasks=0,this.longTaskMs=0,this.last=performance.now(),this.fastest=1/0,this.refreshMs=1e3/60}}const O=4,ve=.45,kt=.42,Be=.18,Ks=.65,It=Ks/3,ds=.15,E=64,hs=1.5,Ot=.035,tt=.05,Ut=.012,Lt=.014,Ft=9,ht=4,St=3,Ue=.995,ae=6,st=hs*(2/E);function us(e){return kt/(e*Math.sqrt(e))-.0025/(e*e)}function fs(e){const s=e*e+.004,t=Xs(e)/(e*e+st*st)**1.5;return e*Math.sqrt(Math.max(0,us(s)+t))}function Xs(e){const s=e/It;return Be*(1-(1+s)*Math.exp(-s))}function ps(e,s){const t=-It*(Math.log(Math.max(1e-9,e))+Math.log(Math.max(1e-9,s)));return Math.min(1.1,Math.max(.01,t))}const ut=["argon","boron","cesium","dysprosium","erbium","fermium"],Gt=[[.29,.62,1],[1,.45,.62],[.42,1,.72],[1,.76,.33],[.72,.55,1],[.35,.95,1]];function ge(e){return function(){e|=0,e=e+1831565813|0;let s=Math.imul(e^e>>>15,1|e);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}function Ct(e,s=2654435769){const{particles:t,species:o,stat:n,capacity:a}=e,i=ge(s),m=()=>{const h=Math.max(1e-9,i());return Math.sqrt(-2*Math.log(h))*Math.cos(2*Math.PI*i())};for(let h=0;h<a;h++){const r=h*O,c=i()*Math.PI*2,l=ps(i(),i());t[r]=Math.cos(c)*l,t[r+1]=Math.sin(c)*l;const d=fs(l),f=d*ds;t[r+2]=-Math.sin(c)*d+m()*f,t[r+3]=Math.cos(c)*d+m()*f;const p=l/(2.6*It)*ae,g=(i()-.5)*1.6;o[h]=Math.max(0,Math.min(ae-1,p+g|0)),n[h]=i()}}function Ys(e,s=2654435769){const t={particles:new Float32Array(e*O),species:new Uint8Array(e),stat:new Float32Array(e),capacity:e,count:e};return Ct(t,s),t}const ue=E*E,Js=st*st,Ze=new Float32Array(ue),ms=new Float32Array(ue),gs=new Float32Array(ue),Qt=new Int32Array(ue),At=new Float32Array(ue),Et=new Float32Array(ue);for(let e=0;e<E;e++)for(let s=0;s<E;s++)At[e*E+s]=(s+.5)/E*2-1,Et[e*E+s]=(e+.5)/E*2-1;function Zs(e,s){Ze.fill(0);const t=e.particles,o=Be/s;for(let i=0;i<s;i++){const m=i*O,h=(t[m]+1)*.5*E-.5,r=(t[m+1]+1)*.5*E-.5,c=Math.floor(h),l=Math.floor(r),d=h-c,f=r-l;for(let p=0;p<2;p++){const g=Math.min(E-1,Math.max(0,l+p)),v=p?f:1-f;for(let y=0;y<2;y++){const b=Math.min(E-1,Math.max(0,c+y));Ze[g*E+b]+=o*(y?d:1-d)*v}}}const n=Be/ue*.001;let a=0;for(let i=0;i<ue;i++)Ze[i]>n&&(Qt[a++]=i);for(let i=0;i<ue;i++){const m=At[i],h=Et[i];let r=0,c=0;for(let l=0;l<a;l++){const d=Qt[l],f=At[d]-m,p=Et[d]-h,g=f*f+p*p+Js,v=Ze[d]/(g*Math.sqrt(g));r+=f*v,c+=p*v}ms[i]=r,gs[i]=c}}function vs(e,s,t,o,n=Ue,a=1){const i=e.particles,m=e.count,h=.99995,r=Math.min(1,Math.max(0,(a-1)/(ht-1))),c=tt+(Ut-tt)*r;Zs(e,m);for(let l=0;l<m;l++){const d=l*O,f=i[d],p=i[d+1],g=-f,v=-p,y=g*g+v*v+.004,b=Math.sqrt(y),k=us(y),x=(f+1)*.5*E-.5,M=(p+1)*.5*E-.5,T=Math.floor(x),S=Math.floor(M),C=x-T,P=M-S;let A=0,D=0;for(let j=0;j<2;j++){const K=Math.min(E-1,Math.max(0,S+j)),te=j?P:1-P;for(let X=0;X<2;X++){const F=Math.min(E-1,Math.max(0,T+X)),se=(X?C:1-C)*te;A+=ms[K*E+F]*se,D+=gs[K*E+F]*se}}const B=t-f,N=o-p,$=B*B+N*N+c,le=Ot*a/($*Math.sqrt($));let u=i[d+2]+g*k*s+A*s+B*le*s,R=i[d+3]+v*k*s+D*s+N*le*s;const V=g/b,Q=v/b,ee=u*V+R*Q;if(u=u-ee*V+ee*V*n,R=R-ee*Q+ee*Q*n,u*=h,R*=h,r>0){const j=Math.min(.9,Ft*r*Math.exp(-$/Lt)*s),K=Math.max(1e-4,Math.hypot(B,N)),te=B/K,X=N/K,F=(u*te+R*X)*j;u-=F*te,R-=F*X}const U=Math.hypot(u,R);U>St&&(u*=St/U,R*=St/U);let I=f+u*s,W=p+R*s;I<-1?(I=-1,u=-u*ve):I>1&&(I=1,u=-u*ve),W<-1?(W=-1,R=-R*ve):W>1&&(W=1,R=-R*ve),i[d]=I,i[d+1]=W,i[d+2]=u,i[d+3]=R}}const es=new Float32Array([0,1,1,0,0,2,2,0,1,3,3,1]);function ts(e){let s=Math.imul(e,747796405)+2891336453;return s=Math.imul(s>>>(s>>>28)+4^s,277803737),((s>>>22^s)>>>0)/4294967296}function Qs(e,s,t){const o=Math.sin(t*.11)*1.4;return{n:1+(e*.5+.5)*12+o,m:1+(s*.5+.5)*12+o}}function eo(e,s,t,o,n){const a=e.particles,i=e.count,m=n*60|0;for(let h=0;h<i;h++){const r=h*O,c=e.species[h],l=t+es[c*2],d=o+es[c*2+1],f=(a[r]+1)*.5,p=(a[r+1]+1)*.5,g=Math.cos(l*Math.PI*f),v=Math.cos(d*Math.PI*p),y=Math.cos(d*Math.PI*f),b=Math.cos(l*Math.PI*p),k=g*v-y*b,x=-l*Math.PI*Math.sin(l*Math.PI*f)*v+d*Math.PI*Math.sin(d*Math.PI*f)*b,M=-d*Math.PI*g*Math.sin(d*Math.PI*p)+l*Math.PI*y*Math.sin(l*Math.PI*p),T=Math.sign(k)*.5,S=Math.abs(k),C=ts(h*2+m)-.5,P=ts(h*2+1+m)-.5,A=(a[r+2]-x*T*2.4*s+C*S*2.2*s)*.86,D=(a[r+3]-M*T*2.4*s+P*S*2.2*s)*.86;a[r]=Math.max(-1,Math.min(1,a[r]+A*s)),a[r+1]=Math.max(-1,Math.min(1,a[r+1]+D*s)),a[r+2]=A,a[r+3]=D}}function ys(e,s,t=Math.random){const o=e.particles;for(let n=0;n<s;n++){const a=n*O;o[a]=t()*2-1,o[a+1]=t()*2-1,o[a+2]=0,o[a+3]=0}}function to(e,s,t=Math.random){const o=e.particles;for(let n=0;n<s;n++){const a=n*O,i=t()*Math.PI*2,m=ps(t(),t()),h=fs(m),r=Math.sqrt(-2*Math.log(Math.max(1e-9,t()))),c=2*Math.PI*t();o[a]=Math.cos(i)*m,o[a+1]=Math.sin(i)*m;const l=h*ds;o[a+2]=-Math.sin(i)*h+r*Math.cos(c)*l,o[a+3]=Math.cos(i)*h+r*Math.sin(c)*l}}const Se=.5,so=.01,oo=1.5,no=.35,io=.3;function qt(e,s=e.spin1){const t=Se*2,o=oo,n=Math.sqrt(2*t/o),a=Math.sqrt(2*t*no)/o,i=-Math.sqrt(Math.max(0,n*n-a*a));e.x0=-o/2,e.y0=0,e.x1=o/2,e.y1=0,e.vx0=-i/2,e.vy0=-a/2,e.vx1=i/2,e.vy1=a/2,e.spin1=s,e.elapsed=0}function ft(){const e={x0:0,y0:0,vx0:0,vy0:0,x1:0,y1:0,vx1:0,vy1:0,spin1:1,elapsed:0};return qt(e),e}function ao(e,s){const t=()=>{const a=e.x1-e.x0,i=e.y1-e.y0,m=a*a+i*i+so,h=Se/(m*Math.sqrt(m));return[a*h,i*h]};let[o,n]=t();e.vx0+=o*s*.5,e.vy0+=n*s*.5,e.vx1-=o*s*.5,e.vy1-=n*s*.5,e.x0+=e.vx0*s,e.y0+=e.vy0*s,e.x1+=e.vx1*s,e.y1+=e.vy1*s,[o,n]=t(),e.vx0+=o*s*.5,e.vy0+=n*s*.5,e.vx1-=o*s*.5,e.vy1-=n*s*.5,e.elapsed+=s}function ro(e){return Math.hypot(e.x1-e.x0,e.y1-e.y0)}const $t=.55,Ee=.2,bs=.6,De=3,ot=.9995,Nt=.995,nt=1.6,it=.045,at=.35*.35,Vt=1.15,rt=.04,zt=.8,Ht=.28,Ke=1.6,_t=.65;function ws(e){return $t/(e*Math.sqrt(e))-.0025/(e*e)}function xs(e){const s=e*e+.004;return e*Math.sqrt(Math.max(0,ws(s)))}function co(e){let s=Math.imul(e,747796405)+2891336453;return s=Math.imul(s>>>(s>>>28)+4^s,277803737),((s>>>22^s)>>>0)/4294967296}function lo(e,s){const t=(co(s*11+5)-.5)*Ke,o=Math.min(1,Math.max(.04,(e+.5+t)/ae));return rt+(zt-rt)*o}function ss(e,s){for(let t=0;t<e.capacity;t++){const n=Math.sqrt(s())*_t/_t*ae,a=(s()-.5)*Ke;e.species[t]=Math.max(0,Math.min(ae-1,n+a|0)),e.stat[t]=s()}}function ho(e,s,t,o,n=0,a=Ee){const i=e.particles,m=e.count,h=.99995,r=Math.cos(2*nt*n),c=Math.sin(2*nt*n);for(let l=0;l<m;l++){const d=l*O,f=i[d],p=i[d+1],g=-f,v=-p,y=g*g+v*v+.004,b=Math.sqrt(y),k=ws(y),x=t-f,M=o-p,T=x*x+M*M+.02,S=a/(T*Math.sqrt(T)),C=f/b,P=p/b,A=C*C-P*P,D=2*C*P,B=A*r+D*c,N=D*r-A*c,$=b*b+at,le=-it*b*b/($*$),R=-(-2*it*b*(at-b*b)/($*$*$))*B,V=2*le*N/b,Q=C*R-P*V,ee=P*R+C*V;let U=i[d+2]+g*k*s+x*S*s+Q*s,I=i[d+3]+v*k*s+M*S*s+ee*s;const W=g/b,j=v/b,K=U*W+I*j,te=Math.max(0,Math.min(1,(b-.25)/.35)),X=ot+(Nt-ot)*te*te*(3-2*te);U=U-K*W+K*W*X,I=I-K*j+K*j*X,U*=h,I*=h;const F=Math.hypot(U,I);F>De&&(U*=De/F,I*=De/F);let se=f+U*s,fe=p+I*s;const _e=lo(e.species[l],l),Mt=Math.max(.05,_e*Ht),G=Math.hypot(se,fe);if(G>Vt||G<Mt){const Fe=1/Math.max(G,1e-6),w=se*Fe,_=fe*Fe,oe=se*I-fe*U>=0?1:-1,Y=xs(_e)*oe;se=w*_e,fe=_*_e,U=-_*Y,I=w*Y}i[d]=se,i[d+1]=fe,i[d+2]=U,i[d+3]=I}}function uo(e,s,t,o,n,a=Ee){const i=e.particles,m=e.count;for(let h=0;h<m;h++){const r=h*O,c=i[r],l=i[r+1],d=n.x0-c,f=n.y0-l,p=d*d+f*f+.004,g=Se/(p*Math.sqrt(p)),v=n.x1-c,y=n.y1-l,b=v*v+y*y+.004,k=Se/(b*Math.sqrt(b)),x=t-c,M=o-l,T=x*x+M*M+.02,S=a/(T*Math.sqrt(T));let C=i[r+2]+(d*g+v*k+x*S)*s,P=i[r+3]+(f*g+y*k+M*S)*s;const A=Math.hypot(C,P);A>De&&(C*=De/A,P*=De/A),i[r]=c+C*s,i[r+1]=l+P*s,i[r+2]=C,i[r+3]=P}}function Ms(e,s,t=Math.random){const o=e.particles;for(let n=0;n<s;n++){const a=n*O,i=t()*Math.PI*2,m=Math.max(.03,Math.sqrt(t())*_t),h=xs(m)*.94;o[a]=Math.cos(i)*m,o[a+1]=Math.sin(i)*m,o[a+2]=-Math.sin(i)*h,o[a+3]=Math.cos(i)*h}}function Rs(e,s,t,o=Math.random){const n=e.particles;for(let a=0;a<s;a++){const i=a*O,m=a&1,h=o()*Math.PI*2,r=(o()-.5)*Ke,c=Math.min(1,Math.max(.02,(e.species[a]+.5+r)/ae)),l=Math.max(.05,io*Math.sqrt(c)),d=Math.sqrt(Se/l)*(m?t.spin1:1);n[i]=(m?t.x1:t.x0)+Math.cos(h)*l,n[i+1]=(m?t.y1:t.y0)+Math.sin(h)*l,n[i+2]=(m?t.vx1:t.vx0)-Math.sin(h)*d,n[i+3]=(m?t.vy1:t.vy0)+Math.cos(h)*d}}const pt=.55,Wt=.1,Pt=3,ct=.995,Tt=.65;function fo(e){return Math.sqrt(pt/Math.max(e,.06))*.94}function po(e,s){for(let t=0;t<e.capacity;t++){const n=Math.sqrt(s())*Tt/Tt*ae,a=(s()-.5)*1.6;e.species[t]=Math.max(0,Math.min(ae-1,n+a|0)),e.stat[t]=s()}}function mo(e,s,t,o){const n=e.particles,a=e.count,i=.99995;for(let m=0;m<a;m++){const h=m*O,r=n[h],c=n[h+1],l=-r,d=-c,f=l*l+d*d+.004,p=Math.sqrt(f),g=pt/(f*p)-.0025/(f*f),v=t-r,y=o-c,b=v*v+y*y+.02,k=Wt/(b*Math.sqrt(b));let x=n[h+2]+l*g*s+v*k*s,M=n[h+3]+d*g*s+y*k*s;const T=l/p,S=d/p,C=x*T+M*S;x=x-C*T+C*T*ct,M=M-C*S+C*S*ct,x*=i,M*=i;const P=Math.hypot(x,M);P>Pt&&(x*=Pt/P,M*=Pt/P);let A=r+x*s,D=c+M*s;A<-1?(A=-1,x=-x*ve):A>1&&(A=1,x=-x*ve),D<-1?(D=-1,M=-M*ve):D>1&&(D=1,M=-M*ve),n[h]=A,n[h+1]=D,n[h+2]=x,n[h+3]=M}}function Ss(e,s,t=Math.random){const o=e.particles;for(let n=0;n<s;n++){const a=n*O,i=t()*Math.PI*2,m=Math.sqrt(t())*Tt,h=fo(m);o[a]=Math.cos(i)*m,o[a+1]=Math.sin(i)*m,o[a+2]=-Math.sin(i)*h,o[a+3]=Math.cos(i)*h}}const $e=0,ce=1,Pe=2,q=3,Ce=4,ke=[{label:"orbital galaxy · self-gravitating",hold:"ramp",cooling:!0,restart:"restart"},{label:"Chladni plate · 6 frequencies",hold:"none",cooling:!1,restart:"restart"},{label:"orbital galaxy · barred",hold:"step",cooling:!1,restart:"reset"},{label:"galaxy collision",hold:"step",cooling:!1,restart:"flip spin"},{label:"orbital galaxy · fixed potential",hold:"none",cooling:!1,restart:"reset"}],go=ke.length;function Ps(e,s,t,o=2654435769){switch(s){case Pe:ss(e,ge(o)),Ms(e,e.capacity,ge(o^81));break;case q:ss(e,ge(o)),Rs(e,e.capacity,t,ge(o^81));break;case Ce:po(e,ge(o)),Ss(e,e.capacity,ge(o^81));break;case ce:Ct(e,o),ys(e,e.capacity,ge(o^81));break;default:Ct(e,o)}}function vo({update:e,notify:s,unwatched:t}){return{link:o,unlink:n,propagate:a,checkDirty:i,shallowPropagate:m};function o(r,c,l){const d=c.depsTail;if(d!==void 0&&d.dep===r)return;const f=d!==void 0?d.nextDep:c.deps;if(f!==void 0&&f.dep===r){f.version=l,c.depsTail=f;return}const p=r.subsTail;if(p!==void 0&&p.version===l&&p.sub===c)return;const g=c.depsTail=r.subsTail={version:l,dep:r,sub:c,prevDep:d,nextDep:f,prevSub:p,nextSub:void 0};f!==void 0&&(f.prevDep=g),d!==void 0?d.nextDep=g:c.deps=g,p!==void 0?p.nextSub=g:r.subs=g}function n(r,c=r.sub){const{dep:l,prevDep:d,nextDep:f,nextSub:p,prevSub:g}=r;return f!==void 0?f.prevDep=d:c.depsTail=d,d!==void 0?d.nextDep=f:c.deps=f,p!==void 0?p.prevSub=g:l.subsTail=g,g!==void 0?g.nextSub=p:(l.subs=p)===void 0&&t(l),f}function a(r,c){let l=r.nextSub,d;e:do{const f=r.sub;let p=f.flags;if(p&60?p&12?p&4?!(p&48)&&h(r,f)?(f.flags=p|40,p&=1):p=0:f.flags=p&-9|32:p=0:(f.flags=p|32,c&&(f.flags|=8)),p&2&&s(f),p&1){const g=f.subs;if(g!==void 0){const v=(r=g).nextSub;v!==void 0&&(d={value:l,prev:d},l=v);continue}}if((r=l)!==void 0){l=r.nextSub;continue}for(;d!==void 0;)if(r=d.value,d=d.prev,r!==void 0){l=r.nextSub;continue e}break}while(!0)}function i(r,c){let l,d=0,f=!1;e:do{const p=r.dep,g=p.flags;if(c.flags&16)f=!0;else if((g&17)===17){const v=p.subs;e(p)&&(v.nextSub!==void 0&&m(v),f=!0)}else if((g&33)===33){l={value:r,prev:l},r=p.deps,c=p,++d;continue}if(!f){const v=r.nextDep;if(v!==void 0){r=v;continue}}for(;d--;){if(r=l.value,l=l.prev,f){const y=c.subs;if(e(c)){y.nextSub!==void 0&&m(y),c=r.sub;continue}f=!1}else c.flags&=-33;c=r.sub;const v=r.nextDep;if(v!==void 0){r=v;continue e}}return f&&!!c.flags}while(!0)}function m(r){do{const c=r.sub,l=c.flags;(l&48)===32&&(c.flags=l|16,(l&6)===2&&s(c))}while((r=r.nextSub)!==void 0)}function h(r,c){let l=c.depsTail;for(;l!==void 0;){if(l===r)return!0;l=l.prevDep}return!1}}const lt=64;let mt=0,ze=0,we=0,Ne=0,ne;const he=[],{link:jt,unlink:Xe,propagate:yo,checkDirty:Cs,shallowPropagate:As}=vo({update(e){return"getter"in e?_s(e):"currentValue"in e?Ts(e):(e.flags=1,!0)},notify(e){let s=Ne,t=s;do if(he[s++]=e,e.flags&=-3,e=e.subs?.sub,e===void 0||!(e.flags&2))break;while(!0);for(Ne=s;t<--s;){const o=he[t];he[t++]=he[s],he[s]=o}},unwatched(e){"getter"in e?e.depsTail!==void 0&&(e.flags=17,Is(e)):"currentValue"in e||("fn"in e?Bs.call(e):ks.call(e))}});function gt(e){const s=ne;return ne=e,s}function vt(e){return Ro.bind({currentValue:e,pendingValue:e,subs:void 0,subsTail:void 0,flags:1})}function Es(e){return Mo.bind({value:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:0,getter:e})}function bo(e){const s={fn:e,cleanup:void 0,subs:void 0,subsTail:void 0,deps:void 0,depsTail:void 0,flags:6},t=gt(s);t!==void 0&&(jt(s,t,0),t.flags|=lt);try{++ze,s.cleanup=s.fn()}finally{--ze,ne=t,s.flags&=-5}return Bs.bind(s)}function _s(e){if(e.flags&lt){let t=e.depsTail;for(;t!==void 0;){const o=t.prevDep,n=t.dep;!("getter"in n)&&!("currentValue"in n)&&Xe(t,e),t=o}}e.depsTail=void 0,e.flags=5;const s=gt(e);try{++mt;const t=e.value;return t!==(e.value=e.getter(t))}finally{ne=s,e.flags&=-5,Os(e)}}function Ts(e){return e.flags=1,e.currentValue!==(e.currentValue=e.pendingValue)}function wo(e){const s=e.flags;if(s&16||s&32&&Cs(e.deps,e)){if(s&lt){let o=e.depsTail;for(;o!==void 0;){const n=o.prevDep,a=o.dep;!("getter"in a)&&!("currentValue"in a)&&Xe(o,e),o=n}}if(e.cleanup&&(Ds(e),!e.flags))return;e.depsTail=void 0,e.flags=6;const t=gt(e);try{++mt,++ze,e.cleanup=e.fn()}finally{--ze,ne=t,e.flags&=-5,Os(e)}}else e.deps!==void 0&&(e.flags=2|s&lt)}function xo(){try{for(;we<Ne;){const e=he[we];he[we++]=void 0,wo(e)}}finally{for(;we<Ne;){const e=he[we];he[we++]=void 0,e.flags|=10}we=0,Ne=0}}function Mo(){const e=this.flags;if(e&16||e&32&&(Cs(this.deps,this)||(this.flags=e&-33,!1))){if(_s(this)){const t=this.subs;t!==void 0&&As(t)}}else if(!e){this.flags=5;const t=gt(this);try{this.value=this.getter()}finally{ne=t,this.flags&=-5}}const s=ne;return s!==void 0&&jt(this,s,mt),this.value}function Ro(...e){if(e.length){if(this.pendingValue!==(this.pendingValue=e[0])){this.flags=17;const s=this.subs;s!==void 0&&(yo(s,!!ze),xo())}}else{if(this.flags&16&&Ts(this)){const t=this.subs;t!==void 0&&As(t)}const s=ne;return s!==void 0&&jt(this,s,mt),this.currentValue}}function Ds(e){const s=e.cleanup;e.cleanup=void 0;const t=ne;ne=void 0;try{s()}finally{ne=t}}function Bs(){ks.call(this),this.cleanup&&Ds(this)}function ks(){this.flags=0,Is(this);const e=this.subs;e!==void 0&&Xe(e)}function Is(e){let s=e.depsTail;for(;s!==void 0;){const t=s.prevDep;Xe(s,e),s=t}}function Os(e){const s=e.depsTail;let t=s!==void 0?s.nextDep:e.deps;for(;t!==void 0;)t=Xe(t,e)}const He=vt((1<<ae)-1),So=vt(-1),Le=vt("gpu");vt(0);const Po=Es(()=>{const e=He(),s=[];for(let t=0;t<ae;t++)e&1<<t&&s.push(t);return s}),Co=Es(()=>{const e=Po();return e.length===ae?"all species":e.length===0?"none":e.map(s=>ut[s]).join(", ")});function Ao(e){He(He()^1<<e)}let Us=0;const Ls=()=>Us;function Eo(e){return bo(()=>{Us++,e()})}const et=4096,Qe=24,os=4;class _o{constructor(s,t,o,n){this.sim=o,this.backend=n,this.viewport=s,this.spacer=t,this.filtered=new Uint32Array(o.capacity),this.poolIds=new Int32Array(0),this.buildPool(),this.refilter(),this.viewport.addEventListener("scroll",()=>{this.scrollTop=this.viewport.scrollTop,this.dirty=!0},{passive:!0}),new ResizeObserver(()=>{this.buildPool(),this.dirty=!0}).observe(this.viewport)}viewport;spacer;pool=[];poolIds;filtered;filteredCount=0;scrollTop=0;poolSize=0;dirty=!0;live=new Float32Array(0);liveBase=0;liveCount=0;readPending=!1;lastRead=0;buildPool(){const s=Math.ceil(this.viewport.clientHeight/Qe)+os*2;if(s!==this.poolSize){for(;this.pool.length<s;){const t=document.createElement("div");t.className="row";const o=document.createElement("span");o.className="id";const n=document.createElement("span");n.className="sp";const a=document.createElement("div");a.className="bar";const i=document.createElement("span");i.className="v",t.append(o,n,a,i);const m=this.pool.length;t.addEventListener("click",()=>{const h=this.poolIds[m];h>=0&&So(h)}),this.viewport.appendChild(t),this.pool.push(t)}for(;this.pool.length>s;)this.pool.pop().remove();this.poolSize=s,this.poolIds=new Int32Array(s).fill(-1)}}refilter(){const s=He(),{species:t,count:o}=this.sim,n=this.filtered;let a=0;for(let i=0;i<o;i++)s&1<<t[i]&&(n[a++]=i);this.filteredCount=a,this.spacer.style.height=a*Qe+"px",this.dirty=!0}forceRepaint(){this.poolIds.fill(-1),this.dirty=!0}get rowCount(){return this.filteredCount}get liveNodes(){return this.poolSize}update(){const s=Math.max(0,(this.scrollTop/Qe|0)-os),t=Math.min(this.filteredCount,s+this.poolSize);if(this.scheduleReadback(s,t),!!this.dirty){this.dirty=!1;for(let o=0;o<this.poolSize;o++){const n=s+o,a=this.pool[o];if(n>=t){this.poolIds[o]!==-1&&(a.style.visibility="hidden",this.poolIds[o]=-1);continue}const i=this.filtered[n];if(this.poolIds[o]!==i){this.poolIds[o]=i;const h=this.sim.species[i],[r,c,l]=Gt[h],d=`rgb(${r*255|0} ${c*255|0} ${l*255|0})`;a.style.visibility="visible",a.children[0].textContent=String(i),a.children[1].textContent=ut[h],a.children[1].style.color=d,a.children[2].style.background=d}a.style.transform=`translateY(${n*Qe}px)`;const m=this.readLive(i);a.children[2].style.transform=`scaleX(${m.toFixed(3)})`,a.children[3].textContent=m.toFixed(4)}}}readLive(s){if(this.liveCount>0){const t=s-this.liveBase;if(t>=0&&t<this.liveCount){const o=t*O,n=this.live[o+2],a=this.live[o+3];return Math.min(1,Math.hypot(n,a)*.7)}}return this.sim.stat[s]}scheduleReadback(s,t){if(this.readPending||t<=s||!this.backend.readback)return;const o=performance.now();if(o-this.lastRead<80)return;this.lastRead=o;const n=this.filtered[s],i=this.filtered[Math.max(s,t-1)]-n+1;i<=0||i>et||(this.readPending=!0,this.backend.readback(n,i).then(m=>{this.live=m,this.liveBase=n,this.liveCount=m.length/O,this.dirty=!0}).catch(()=>{}).finally(()=>{this.readPending=!1}))}}const Me=64,z=E*E,ns=`
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
  // Cursor mass multiplier, ramped by the pointer being held. 1 = passive.
  grav      : f32,
  // Cursor mass in the fixed-potential modes, switched rather than ramped.
  gcur      : f32,
  // Camera scale for the collision, which spans a wider field than a disc does.
  scale     : f32,
  // The two colliding cores, solved on the CPU -- see sim/pair.ts.
  c0        : vec2<f32>,
  c1        : vec2<f32>,
  pmass     : f32,
};

// Central bulge + halo. Fixed at the origin -- see the integrate entry point.
// (No backticks in here: this block lives inside a JS template literal.)
const G_CORE = ${kt};
// Total self-gravitating mass of the disc. Mirrors M_DISC in sim/world.ts.
const M_DISC = ${Be};
// Cursor mass, deliberately a fraction of the core so it perturbs, not destroys.
// Mirrors G_CURSOR in sim/world.ts -- see there for why it is this small.
const G_CURSOR = ${Ot};
const CURSOR_SOFT2 = ${tt};
// Held softening and the mass ceiling it ramps against -- see sim/world.ts.
const CURSOR_SOFT2_HOLD = ${Ut};
const G_CURSOR_HOLD = f32(${ht});
const CAPTURE_R2 = ${Lt};
const CAPTURE_K = f32(${Ft});
// Terminal speed. Without it a close cursor pass flings grains off to infinity.
const V_MAX = 3.0;

const GRID = ${E}u;
const GRIDF = ${E}.0;
const CELLS = ${z}u;

// Per-species (n, m) offsets from the cursor-driven base frequency. Each species
// settles onto the nodal lines of its own standing wave, so six figures resolve
// at once in six colors. Kept small and mutually offset so they stay visibly
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

/** Center of cell c in simulation space, which is the unit box [-1, 1]. */
fn cellCenter(c : u32) -> vec2<f32> {
  let g = vec2<f32>(f32(c % GRID), f32(c / GRID));
  return (g + 0.5) / GRIDF * 2.0 - 1.0;
}

/** Continuous grid coordinate of a point, with cell centers on integers. */
fn gridCoord(p : vec2<f32>) -> vec2<f32> {
  return (p + 1.0) * 0.5 * GRIDF - 0.5;
}

/** Radial acceleration factor from the central mass. Mirrors coreF() in
 *  sim/world.ts; used by both the integrator and the seeding below. */
fn coreF(q : f32) -> f32 {
  return G_CORE / (q * sqrt(q)) - 0.0025 / (q * q);
}

/**
 * Chladni plate. Particles descend |w| toward the nodal lines of a standing
 * wave, exactly as sand does on a vibrating plate — the sand collects where the
 * plate is not moving. Analytic gradient, so this is O(n) with no neighbor
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

// --- fixed-potential modes ---------------------------------------------------
//
// The barred disc, the collision and the original fixed-potential disc, kept as
// their own force laws rather than folded into the one above. None of them sees
// the density mesh at all: every particle here is a test particle in a
// prescribed field, which is the whole difference between them and mode 0. The
// constants come from sim/barred.ts and sim/classic.ts so there is one source of
// truth per mode.

const BD_G_CORE = ${$t};
const BD_DAMP_INNER = ${ot};
const BD_DAMP_OUTER = ${Nt};
const BD_BAR_OMEGA = ${nt};
const BD_BAR_K = ${it};
const BD_BAR_A2 = ${at};
const BD_ESCAPE_R = ${Vt};
const BD_RETURN_LO = ${rt};
const BD_RETURN_HI = ${zt};
const BD_CORE_FRAC = ${Ht};
const BD_SPECIES_SPREAD = ${Ke};
const CL_G_CORE = ${pt};
const CL_G_CURSOR = ${Wt};
const CL_RADIAL_DAMP = ${ct};

/**
 * The barred disc's primary, and the circular speed under it -- attraction minus
 * a short-range repulsive core, without which the population collapses to a
 * point. Its own pair, because this mode's core is stronger than mode 0's and
 * carries no disc mass beside it.
 */
fn bdCoreF(q : f32) -> f32 {
  return BD_G_CORE / (q * sqrt(q)) - 0.0025 / (q * q);
}

fn bdVCirc(r : f32) -> f32 {
  let q = r * r + 0.004;
  return r * sqrt(max(0.0, bdCoreF(q)));
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
 * home radius from a distribution centred on its species and wide enough to
 * reach well into its neighbours'. Statistically the six colors still occupy six
 * different parts of the disc. Locally, no edge between them is anywhere.
 */
fn bdHomeRadius(i : u32) -> f32 {
  let j = (hash(i * 11u + 5u) - 0.5) * BD_SPECIES_SPREAD;
  let f = clamp((f32(cspecies[i]) + 0.5 + j) / 6.0, 0.04, 1.0);
  return BD_RETURN_LO + (BD_RETURN_HI - BD_RETURN_LO) * f;
}

/**
 * Put a particle back on the disc, on a circular orbit along its current ray.
 *
 * Both ends of the disc leak, and each leak is what this mode used to decay into.
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
 * state a structured disc instead of a bright dot.
 */
fn bdRespawn(i : u32, dir : vec2<f32>, spin : f32) -> vec4<f32> {
  let r = bdHomeRadius(i);
  let vOrb = bdVCirc(r) * spin;
  return vec4<f32>(dir * r, -dir.y * vOrb, dir.x * vOrb);
}

fn bdDamping(r : f32) -> f32 {
  return mix(BD_DAMP_INNER, BD_DAMP_OUTER, smoothstep(0.25, 0.6, r));
}

/**
 * Rotating bar: an m=2 quadrupole turning at a fixed pattern speed.
 *
 * This disc has no self-gravity -- every particle is an independent test particle
 * in a smooth potential. That has a consequence which no amount of tuning fixes:
 * inner orbits run faster than outer ones, so any arm the cursor raises shears,
 * winds up, and phase-mixes below pixel size within seconds. Real spiral arms are
 * held together by the disc's own gravity responding to itself, which is what
 * mode 0 does and this one cannot.
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
fn bdBar(ur : vec2<f32>, r : f32, t : f32) -> vec2<f32> {
  let c2 = ur.x * ur.x - ur.y * ur.y;
  let s2 = 2.0 * ur.x * ur.y;
  let cp = cos(2.0 * BD_BAR_OMEGA * t);
  let sp = sin(2.0 * BD_BAR_OMEGA * t);
  // Rotate the pattern: angles relative to the bar, not to the screen.
  let cos2 = c2 * cp + s2 * sp;
  let sin2 = s2 * cp - c2 * sp;

  let q = r * r + BD_BAR_A2;
  let a = -BD_BAR_K * r * r / (q * q);
  let da = -2.0 * BD_BAR_K * r * (BD_BAR_A2 - r * r) / (q * q * q);

  let fr = -da * cos2;          // -dphi/dr
  let ft = 2.0 * a * sin2 / r;  // -(1/r) dphi/dth
  return ur * fr + vec2<f32>(-ur.y, ur.x) * ft;
}

fn bdIntegrate(i : u32, p : vec4<f32>, dt : f32) -> vec4<f32> {
  // Primary: fixed at the origin. This is what holds the disc together.
  let dc = -p.xy;
  let dc2 = dot(dc, dc) + 0.004;
  let rc = sqrt(dc2);
  let fc = bdCoreF(dc2);

  // Secondary: the cursor. Softened harder so a direct hit shears rather than
  // slingshots.
  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let dm2 = dot(dm, dm) + 0.02;
  let fm = params.gcur / (dm2 * sqrt(dm2));

  // Rotating pattern. Without it the disc is a decaying system with nothing to
  // regenerate structure; with it, rings are where the disc settles.
  let ur = -dc / rc;
  let fb = bdBar(ur, rc, params.time);

  var v = p.zw + dc * fc * dt + dm * fm * dt + fb * dt;

  // Damp the RADIAL component only -- see the integrate entry point for why
  // uniform damping collapses a disc into a ball.
  //
  // The rate is a function of radius, and it has to be. Measured at a single
  // uniform rate, the two failure modes are exclusive: damp hard enough to
  // circularize the scattered material (which is what stops the field turning
  // into speckle) and the bar's torque drains the disc inward until the inner
  // annulus is fourteen times denser than everything else -- the white core.
  // Damp gently enough to prevent that and the speckle never clears. Dissipating
  // in the outer disc and not in the inner one separates the two.
  let rdir = dc / rc;
  let vRad = dot(v, rdir) * rdir;
  v = (v - vRad) + vRad * bdDamping(rc);

  // Whisper of global damping purely to bound energy the moving cursor injects.
  v = v * 0.99995;

  let speed = length(v);
  if (speed > V_MAX) { v = v * (V_MAX / speed); }

  let pos = p.xy + v * dt;

  // Close the disc at both ends -- see bdRespawn(). Sign of angular momentum is
  // carried across, so a recycled grain rejoins moving the way the disc moves.
  //
  // The inner bound is per particle, at a fraction of its own home radius -- so
  // it is as ragged as bdHomeRadius() is, and the hole in the middle has no
  // clean edge.
  let floorR = max(0.05, bdHomeRadius(i) * BD_CORE_FRAC);
  let pr = length(pos);
  if (pr > BD_ESCAPE_R || pr < floorR) {
    let spin = select(-1.0, 1.0, (pos.x * v.y - pos.y * v.x) >= 0.0);
    return bdRespawn(i, pos / max(pr, 1e-6), spin);
  }

  return vec4<f32>(pos, v);
}

/**
 * Galaxy collision: the restricted three-body model.
 *
 * Two cores on their own two-body orbit, solved on the CPU and arriving here as
 * five floats; every particle is a massless test particle in the sum of their two
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
 * The original disc: anchored monopole, weak cursor, uniform radial damping,
 * walls. Nothing drives it and nothing responds to it, so it phase-mixes into a
 * smooth annulus within seconds and stays there -- which is what both the bar
 * above and the self-gravity below exist to answer. Kept so the comparison can
 * be watched rather than described.
 */
fn clsIntegrate(p : vec4<f32>, dt : f32) -> vec4<f32> {
  let dc = -p.xy;
  let dc2 = dot(dc, dc) + 0.004;
  let rc = sqrt(dc2);
  let fc = CL_G_CORE / (dc2 * rc) - 0.0025 / (dc2 * dc2);

  let dm = vec2<f32>(params.mx - p.x, params.my - p.y);
  let dm2 = dot(dm, dm) + 0.02;
  let fm = CL_G_CURSOR / (dm2 * sqrt(dm2));

  var v = p.zw + dc * fc * dt + dm * fm * dt;

  let rdir = dc / rc;
  let vRad = dot(v, rdir) * rdir;
  v = (v - vRad) + vRad * CL_RADIAL_DAMP;
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

  return vec4<f32>(pos, v);
}

// --- self-gravity: three passes over a GRID x GRID mesh ----------------------

@compute @workgroup_size(${Me})
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
@compute @workgroup_size(${Me})
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
@compute @workgroup_size(${Me})
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
 * The empty-cell skip is not a micro-optimization. A galaxy occupies maybe a
 * third of the box, and every thread in a workgroup walks the source cells in
 * the same order, so the branch is uniform across the wave -- no divergence, and
 * the loop simply gets shorter.
 */
@compute @workgroup_size(${Me})
fn solveField(@builtin(global_invocation_id) gid : vec3<u32>) {
  let t = gid.x;
  if (t >= CELLS) { return; }

  let tp = cellCenter(t);
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
    let d = cellCenter(s) - tp;
    // Softened, and the softening length is the reason the mesh is stable: a
    // bare 1/r^2 between neighboring cells would let a single dense cell fling
    // its neighbors away rather than pull the disc together.
    let q = dot(d, d) + ${(hs*(2/E))**2};
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

@compute @workgroup_size(${Me})
fn integrate(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }

  var p = parts[i];
  let dt = params.dt;

  if (params.mode == ${ce}u) {
    parts[i] = chladni(i, p, dt);
    return;
  }
  if (params.mode == ${Pe}u) {
    parts[i] = bdIntegrate(i, p, dt);
    return;
  }
  if (params.mode == ${q}u) {
    parts[i] = collide(p, dt);
    return;
  }
  if (params.mode == ${Ce}u) {
    parts[i] = clsIntegrate(p, dt);
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
  // Mass and softening ramp together: the well deepens *and* narrows, so a hold
  // captures what is near the pointer instead of tugging on the whole disc.
  let ht = clamp((params.grav - 1.0) / (G_CURSOR_HOLD - 1.0), 0.0, 1.0);
  let soft = mix(CURSOR_SOFT2, CURSOR_SOFT2_HOLD, ht);
  let dm2 = dot(dm, dm) + soft;
  let fm = G_CURSOR * params.grav / (dm2 * sqrt(dm2));

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

  // Capture drag, held only. Weighted by proximity so it is a local well of
  // friction rather than a global brake -- see CAPTURE_R2 in sim/world.ts.
  //
  // Damps only the component along the line to the cursor, for exactly the
  // reason the disc's own cooling is radial-only: braking the full velocity
  // vector leaves the captured material with no angular momentum about anything,
  // and the knot drops straight down the core's potential the moment you let go.
  // Bleeding the approach component instead circularizes material into orbit
  // around the pointer, which both looks like capture and survives release.
  let cw = ht * exp(-dm2 / CAPTURE_R2);
  let mdir = dm / max(1e-4, length(dm));
  v = v - dot(v, mdir) * mdir * min(0.9, CAPTURE_K * cw * dt);

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
  //
  // Each mode keeps the framing it was built with. The fixed-potential discs fit
  // the box rather than the disc inside it and pull the camera back for the
  // collision, whose tails leave the frame at their best moment otherwise; the
  // original mode does not correct aspect at all, which is what makes its
  // circular orbits draw as ellipses on a wide monitor.
  let a = rparams.aspect;
  if (rparams.mode == ${Ce}u) {
    out.pos = vec4<f32>(p.x + corner.x * size / a, p.y + corner.y * size, 0.0, 1.0);
  } else if (rparams.mode == ${Pe}u || rparams.mode == ${q}u) {
    let fx = 1.0 / max(a, 1.0);
    let fy = min(a, 1.0);
    let sc = rparams.scale;
    out.pos = vec4<f32>(
      (p.x * sc + corner.x * size) * fx,
      (p.y * sc + corner.y * size) * fy,
      0.0, 1.0
    );
  } else {
    let s = rparams.vscale;
    let fx = s / max(a, 1.0);
    let fy = s * min(a, 1.0);
    out.pos = vec4<f32>(
      (p.x + corner.x * size) * fx,
      (p.y + corner.y * size) * fy,
      0.0, 1.0
    );
  }
  out.uv = corner;
  out.speed = clamp(length(p.zw) * 0.22, 0.0, 1.0);
  // Shift toward white with speed so the dense hot core still reads as bright
  // without losing species identity in the arms.
  //
  // In mono the palette is dropped for a single faintly warm white. Structure in
  // this image is carried almost entirely by density rather than by hue, so
  // removing color costs nothing legible and the arms actually read *harder* —
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
  // attachment clips it. gain now only normalizes for population size, keeping
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
  // bright region converges on white regardless of what color it started. That
  // is most of why the old renderer had six colors and showed one. Scaling all
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
`;async function To(e,s){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)return null;const o=await t.requestDevice();o.addEventListener("uncapturederror",w=>{console.error("[webgpu]",w.error.message)});const n=e.getContext("webgpu");if(!n)return null;const a=navigator.gpu.getPreferredCanvasFormat();n.configure({device:o,format:a,alphaMode:"premultiplied"});const i=o.createBuffer({size:s.particles.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});o.queue.writeBuffer(i,0,s.particles);const m=112,h=o.createBuffer({size:m,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),r=new ArrayBuffer(m),c=new Float32Array(r),l=new Uint32Array(r),d=o.createBuffer({size:z*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),f=o.createBuffer({size:z*8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),p=o.createBuffer({size:z*4,usage:GPUBufferUsage.STORAGE}),g=o.createBuffer({size:z*12,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),v=new Uint32Array(s.capacity),y=o.createBuffer({size:v.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),b=()=>{for(let w=0;w<s.capacity;w++)v[w]=s.species[w];o.queue.writeBuffer(y,0,v)};b();let k=63,x=$e,M=Ue,T=!1,S=0,C=Ee,P=ft();const A=o.createBuffer({size:et*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),D=new Float32Array(et*4),B=o.createShaderModule({code:ns});{const w=await B.getCompilationInfo();for(const _ of w.messages){if(_.type==="info")continue;const oe=`${_.lineNum}:${_.linePos}`,Y=ns.split(`
`)[_.lineNum-1]?.trim()??"";(_.type==="error"?console.error:console.warn)(`[wgsl ${oe}] ${_.message}
  ${Y}`)}}const N=o.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}}]}),$=o.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),le=o.createPipelineLayout({bindGroupLayouts:[N]}),u=w=>o.createComputePipeline({layout:le,compute:{module:B,entryPoint:w}}),R=u("integrate"),V=u("clearGrid"),Q=u("depositMass"),ee=u("bakeGrid"),U=u("solveField"),I="rgba16float",W=w=>o.createRenderPipeline({layout:o.createPipelineLayout({bindGroupLayouts:[$]}),vertex:{module:B,entryPoint:"vs"},fragment:{module:B,entryPoint:"fs",targets:[{format:w,blend:{color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),j=W(I),K=W(a),te=o.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),X=o.createRenderPipeline({layout:o.createPipelineLayout({bindGroupLayouts:[te]}),vertex:{module:B,entryPoint:"tmVs"},fragment:{module:B,entryPoint:"tmFs",targets:[{format:a}]},primitive:{topology:"triangle-list"}});let F=null,se=null;function fe(w,_){F?.destroy(),F=o.createTexture({size:{width:Math.max(1,w),height:Math.max(1,_)},format:I,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),se=o.createBindGroup({layout:te,entries:[{binding:0,resource:F.createView()},{binding:1,resource:{buffer:h}}]})}fe(e.width,e.height);const _e=o.createBindGroup({layout:N,entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:h}},{binding:2,resource:{buffer:y}},{binding:3,resource:{buffer:d}},{binding:4,resource:{buffer:f}},{binding:5,resource:{buffer:p}}]}),Mt=o.createBindGroup({layout:$,entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:h}},{binding:2,resource:{buffer:y}}]});let G=s.count;function Fe(){Ps(s,x,P),b(),o.queue.writeBuffer(i,0,s.particles)}return{name:"webgpu",detail:`${t.info?.vendor??"gpu"} ${t.info?.architecture??""}`.trim(),setCount(w){G=Math.min(w,s.capacity)},setSpeciesMask(w){k=w>>>0},setMode(w){x=w|0,Fe()},setCooling(w){M=w},setMono(w){T=w},setCursorMass(w){C=w},setPair(w){P=w},reset(){S=0,Fe()},frame(w,_,oe,Y=1){const pe=x===$e||x===ce;if(c[0]=w,c[1]=_,c[2]=oe,c[3]=e.width/e.height,c[4]=Math.min(.006,Math.max(.0018,.06/Math.sqrt(G))),c[5]=pe?6e4/G:Math.min(1,Math.max(.3,12e4/G)),l[6]=k,l[7]=x,S+=w,c[8]=S,x===ce){const be=Math.sin(S*.11)*1.4;c[9]=1+(_*.5+.5)*12+be,c[10]=1+(oe*.5+.5)*12+be}else c[9]=0,c[10]=0;const Ge=Math.min(4096,Math.floor(39e8/Math.max(1,G)));c[11]=Ge,c[12]=Be/(G*Ge),c[13]=8,c[14]=1.42,c[15]=G,c[16]=M,c[17]=Be/z*.001,c[18]=T?1:0,c[19]=Y,c[20]=C,c[21]=x===q?.55:1,c[22]=P.x0,c[23]=P.y0,c[24]=P.x1,c[25]=P.y1,c[26]=Se,o.queue.writeBuffer(h,0,r);const Ye=o.createCommandEncoder(),Jt=Math.ceil(G/Me),Rt=Math.ceil(z/Me),J=Ye.beginComputePass();J.setBindGroup(0,_e),x===$e&&(J.setPipeline(V),J.dispatchWorkgroups(Rt),J.setPipeline(Q),J.dispatchWorkgroups(Jt),J.setPipeline(ee),J.dispatchWorkgroups(Rt),J.setPipeline(U),J.dispatchWorkgroups(Rt)),J.setPipeline(R),J.dispatchWorkgroups(Jt),J.end();const Je=Ye.beginRenderPass({colorAttachments:[pe?{view:F.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}:{view:n.getCurrentTexture().createView(),clearValue:{r:.027,g:.035,b:.051,a:1},loadOp:"clear",storeOp:"store"}]});if(Je.setPipeline(pe?j:K),Je.setBindGroup(0,Mt),Je.draw(6,G),Je.end(),pe){const be=Ye.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:1},storeOp:"store"}]});be.setPipeline(X),be.setBindGroup(0,se),be.draw(3),be.end()}o.queue.submit([Ye.finish()])},resize(w,_){e.width=w,e.height=_,fe(w,_)},async readback(w,_){const oe=Math.max(0,Math.min(w,G-1)),Y=Math.max(0,Math.min(_,et,G-oe));if(Y===0)return D.subarray(0,0);const pe=Y*16,Ge=o.createCommandEncoder();return Ge.copyBufferToBuffer(i,oe*16,A,0,pe),o.queue.submit([Ge.finish()]),await A.mapAsync(GPUMapMode.READ,0,pe),D.set(new Float32Array(A.getMappedRange(0,pe))),A.unmap(),D.subarray(0,Y*4)},async dumpGrid(){const w=o.createCommandEncoder();w.copyBufferToBuffer(d,0,g,0,z*4),w.copyBufferToBuffer(f,0,g,z*4,z*8),o.queue.submit([w.finish()]),await g.mapAsync(GPUMapMode.READ);const _=g.getMappedRange(),oe=new Uint32Array(_.slice(0,z*4)),Y=new Float32Array(_.slice(z*4,z*12));return g.unmap(),{dens:oe,field:Y,grid:E,massScale:c[12]}},destroy(){i.destroy(),h.destroy(),y.destroy(),d.destroy(),f.destroy(),p.destroy(),A.destroy(),g.destroy(),F?.destroy(),o.destroy()}}}const Do=`#version 300 es
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
const float BD_DAMP_INNER = ${ot};
const float BD_DAMP_OUTER = ${Nt};
const float BD_BAR_OMEGA = ${nt};
const float BD_BAR_K = ${it};
const float BD_BAR_A2 = ${at};
const float BD_ESCAPE_R = ${Vt};
const float BD_RETURN_LO = ${rt};
const float BD_RETURN_HI = ${zt};
const float BD_CORE_FRAC = ${Ht};
const float BD_SPECIES_SPREAD = ${Ke};

float bdCoreF(float q) {
  return ${$t} / (q * sqrt(q)) - 0.0025 / (q * q);
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
  if (uMode == ${ce}) {
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
  if (uMode == ${Pe}) {
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
  if (uMode == ${q}) {
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
  if (uMode == ${Ce}) {
    vec2 dcc = -aPos;
    float dcc2 = dot(dcc, dcc) + 0.004;
    float rcc = sqrt(dcc2);
    float fcc = ${pt} / (dcc2 * rcc) - 0.0025 / (dcc2 * dcc2);

    vec2 dmc2 = uMouse - aPos;
    float dm2c = dot(dmc2, dmc2) + 0.02;
    vec2 vv2 = aVel
      + dcc * fcc * uDt
      + dmc2 * (${Wt} / (dm2c * sqrt(dm2c))) * uDt;

    vec2 rdirc = dcc / rcc;
    vec2 vRadc = dot(vv2, rdirc) * rdirc;
    vv2 = ((vv2 - vRadc) + vRadc * ${ct}) * 0.99995;

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
  float fc = ${kt} / (dc2 * rc) - 0.0025 / (dc2 * dc2);

  vec2 dm = uMouse - aPos;
  // Mass and softening ramp together — see sim/world.ts CURSOR_SOFT2_HOLD.
  float ht = clamp((uGrav - 1.0) / (float(${ht}) - 1.0), 0.0, 1.0);
  float dm2 = dot(dm, dm) + mix(${tt}, ${Ut}, ht);
  float fm = ${Ot} * uGrav / (dm2 * sqrt(dm2));

  vec2 v = aVel + dc * fc * uDt + dm * fm * uDt;

  // Radial-only damping — see webgpu.ts for why uniform damping collapses the disc.
  vec2 rdir = dc / rc;
  vec2 vRad = dot(v, rdir) * rdir;
  v = ((v - vRad) + vRad * uCooling) * 0.99995;

  // Capture drag along the cursor line only — see webgpu.ts for why not the
  // full velocity vector.
  float cw = ht * exp(-dm2 / float(${Lt}));
  vec2 mdir = dm / max(1e-4, length(dm));
  v -= dot(v, mdir) * mdir * min(0.9, float(${Ft}) * cw * uDt);

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
}`,Bo=`#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`,ko=`#version 300 es
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
uniform float uScale;

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
  // Each mode keeps the framing it was built with — see the vs() entry point in
  // webgpu.ts, which makes the same three choices.
  if (uMode == ${Ce}) {
    gl_Position = vec4(aPos.x + aCorner.x * uSize / uAspect, aPos.y + aCorner.y * uSize, 0.0, 1.0);
  } else if (uMode == ${Pe} || uMode == ${q}) {
    float fx = 1.0 / max(uAspect, 1.0);
    float fy = min(uAspect, 1.0);
    gl_Position = vec4(
      (aPos.x * uScale + aCorner.x * uSize) * fx,
      (aPos.y * uScale + aCorner.y * uSize) * fy,
      0.0, 1.0
    );
  } else {
    float fx = uVScale / max(uAspect, 1.0);
    float fy = uVScale * min(uAspect, 1.0);
    gl_Position = vec4(
      (aPos.x + aCorner.x * uSize) * fx,
      (aPos.y + aCorner.y * uSize) * fy,
      0.0, 1.0
    );
  }
}`,Io=`#version 300 es
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
}`;function is(e,s,t){const o=e.createShader(s);if(e.shaderSource(o,t),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS))throw new Error("shader compile failed: "+e.getShaderInfoLog(o));return o}function as(e,s,t,o){const n=e.createProgram();if(e.attachShader(n,is(e,e.VERTEX_SHADER,s)),e.attachShader(n,is(e,e.FRAGMENT_SHADER,t)),o&&e.transformFeedbackVaryings(n,o,e.SEPARATE_ATTRIBS),e.linkProgram(n),!e.getProgramParameter(n,e.LINK_STATUS))throw new Error("program link failed: "+e.getProgramInfoLog(n));return n}function Oo(e,s){const t=e.getContext("webgl2",{alpha:!1,antialias:!1});if(!t)return null;const o=s.capacity,n=new Float32Array(o*2),a=new Float32Array(o*2);for(let u=0;u<o;u++)n[u*2]=s.particles[u*4],n[u*2+1]=s.particles[u*4+1],a[u*2]=s.particles[u*4+2],a[u*2+1]=s.particles[u*4+3];const i=u=>{const R=t.createBuffer();return t.bindBuffer(t.ARRAY_BUFFER,R),t.bufferData(t.ARRAY_BUFFER,u,t.DYNAMIC_COPY),R};let m=i(n),h=i(a),r=i(n),c=i(a);const l=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),d=i(l),f=new Float32Array(o);for(let u=0;u<o;u++)f[u]=s.species[u];const p=i(f),g=as(t,Do,Bo,["vPos","vVel"]),v=as(t,ko,Io),y={aPos:t.getAttribLocation(g,"aPos"),aVel:t.getAttribLocation(g,"aVel"),aSpecies:t.getAttribLocation(g,"aSpecies"),uDt:t.getUniformLocation(g,"uDt"),uMouse:t.getUniformLocation(g,"uMouse"),uMode:t.getUniformLocation(g,"uMode"),uTime:t.getUniformLocation(g,"uTime"),uWarp:t.getUniformLocation(g,"uWarp"),uWarpM:t.getUniformLocation(g,"uWarpM"),uCooling:t.getUniformLocation(g,"uCooling"),uGrav:t.getUniformLocation(g,"uGrav"),uGCursor:t.getUniformLocation(g,"uGCursor"),uC0:t.getUniformLocation(g,"uC0"),uC1:t.getUniformLocation(g,"uC1"),uPMass:t.getUniformLocation(g,"uPMass")},b={aPos:t.getAttribLocation(v,"aPos"),aVel:t.getAttribLocation(v,"aVel"),aCorner:t.getAttribLocation(v,"aCorner"),aSpecies:t.getAttribLocation(v,"aSpecies"),uAspect:t.getUniformLocation(v,"uAspect"),uSize:t.getUniformLocation(v,"uSize"),uGain:t.getUniformLocation(v,"uGain"),uMask:t.getUniformLocation(v,"uMask"),uVScale:t.getUniformLocation(v,"uVScale"),uMono:t.getUniformLocation(v,"uMono"),uMode:t.getUniformLocation(v,"uMode"),uScale:t.getUniformLocation(v,"uScale")},k=t.createTransformFeedback();let x=s.count;const M=(u,R,V=0,Q=2)=>{t.bindBuffer(t.ARRAY_BUFFER,u),t.enableVertexAttribArray(R),t.vertexAttribPointer(R,Q,t.FLOAT,!1,0,0),t.vertexAttribDivisor(R,V)};let T=63,S=$e,C=0,P=Ue,A=!1,D=Ee,B=ft();const N=t.getExtension("WEBGL_debug_renderer_info"),$=String(N?t.getParameter(N.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER));t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE);const le=()=>{Ps(s,S,B);for(let u=0;u<o;u++)n[u*2]=s.particles[u*4],n[u*2+1]=s.particles[u*4+1],a[u*2]=s.particles[u*4+2],a[u*2+1]=s.particles[u*4+3],f[u]=s.species[u];t.bindBuffer(t.ARRAY_BUFFER,p),t.bufferSubData(t.ARRAY_BUFFER,0,f);for(const[u,R]of[[m,n],[r,n],[h,a],[c,a]])t.bindBuffer(t.ARRAY_BUFFER,u),t.bufferSubData(t.ARRAY_BUFFER,0,R)};return{name:"webgl2",detail:$,setCount(u){x=Math.min(u,s.capacity)},setSpeciesMask(u){T=u>>>0},setCooling(u){P=u},setMono(u){A=u},setCursorMass(u){D=u},setPair(u){B=u},setMode(u){S=u|0,le()},reset(){C=0,le()},frame(u,R,V,Q=1){t.useProgram(g),t.uniform1f(y.uDt,u),t.uniform2f(y.uMouse,R,V),t.uniform1i(y.uMode,S),t.uniform1f(y.uCooling,P),t.uniform1f(y.uGrav,Q),t.uniform1f(y.uGCursor,D),t.uniform2f(y.uC0,B.x0,B.y0),t.uniform2f(y.uC1,B.x1,B.y1),t.uniform1f(y.uPMass,Se),C+=u,t.uniform1f(y.uTime,C);const ee=S===ce?Math.sin(C*.11)*1.4:0;t.uniform1f(y.uWarp,S===ce?1+(R*.5+.5)*12+ee:0),t.uniform1f(y.uWarpM,S===ce?1+(V*.5+.5)*12+ee:0),M(m,y.aPos),M(h,y.aVel),M(p,y.aSpecies,0,1),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,k),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,r),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,c),t.enable(t.RASTERIZER_DISCARD),t.beginTransformFeedback(t.POINTS),t.drawArrays(t.POINTS,0,x),t.endTransformFeedback(),t.disable(t.RASTERIZER_DISCARD),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,0,null),t.bindBufferBase(t.TRANSFORM_FEEDBACK_BUFFER,1,null),t.bindTransformFeedback(t.TRANSFORM_FEEDBACK,null),t.clearColor(.027,.035,.051,1),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(v),t.uniform1f(b.uAspect,e.width/e.height),t.uniform1f(b.uSize,Math.min(.006,Math.max(.0018,.06/Math.sqrt(x)))),t.uniform1f(b.uGain,Math.min(1,Math.max(.6,2e5/x))),t.uniform1i(b.uMask,T),t.uniform1f(b.uVScale,1.42),t.uniform1f(b.uMono,A?1:0),t.uniform1i(b.uMode,S),t.uniform1f(b.uScale,S===q?.55:1),M(d,b.aCorner,0),M(r,b.aPos,1),M(c,b.aVel,1),M(p,b.aSpecies,1,1),t.drawArraysInstanced(t.TRIANGLES,0,6,x),[m,r]=[r,m],[h,c]=[c,h]},resize(u,R){e.width=u,e.height=R,t.viewport(0,0,u,R)},destroy(){t.deleteProgram(g),t.deleteProgram(v);for(const u of[m,r,h,c,d,p])t.deleteBuffer(u);t.deleteTransformFeedback(k)}}}const re=5e3,rs=400;class Uo{constructor(s,t,o,n){this.sim=s,this.gpuViewport=n,this.layer=document.createElement("div"),this.layer.id="baseline-layer",t.appendChild(this.layer),this.listHost=document.createElement("div"),this.listHost.id="baseline-list",o.appendChild(this.listHost)}cooling=Ue;mono=!1;layer;nodes=[];listHost;active=!1;mode=0;elapsed=0;pair=ft();get count(){return re}start(){if(!this.active){this.active=!0,this.layer.style.display="block",this.listHost.style.display="block",this.gpuViewport.style.display="none";for(let s=0;s<re;s++){const t=document.createElement("div");t.className="bp",t.style.background=this.nodeColor(s),this.layer.appendChild(t),this.nodes.push(t)}}}stop(){this.active&&(this.active=!1,this.layer.style.display="none",this.layer.replaceChildren(),this.nodes.length=0,this.listHost.innerHTML="",this.listHost.style.display="none",this.gpuViewport.style.display="")}get domNodes(){return this.active?this.nodes.length+rs:0}setCooling(s){this.cooling=s}setMono(s){this.mono=s;for(let t=0;t<this.nodes.length;t++)this.nodes[t].style.background=this.nodeColor(t)}nodeColor(s){if(this.mono)return"rgb(219 227 255)";const[t,o,n]=Gt[this.sim.species[s]];return`rgb(${t*255|0} ${o*255|0} ${n*255|0})`}setMode(s,t){this.mode=s,this.pair=t,this.reset()}reset(){switch(this.elapsed=0,this.mode){case ce:ys(this.sim,re);break;case Pe:Ms(this.sim,re);break;case q:Rs(this.sim,re,this.pair);break;case Ce:Ss(this.sim,re);break;default:to(this.sim,re)}}frame(s,t,o,n=1,a=Ee){if(!this.active)return;this.elapsed+=s;const i=this.sim.count;switch(this.sim.count=re,this.mode){case ce:{const{n:l,m:d}=Qs(t,o,this.elapsed);eo(this.sim,s,l,d,this.elapsed);break}case Pe:ho(this.sim,s,t,o,this.elapsed,a);break;case q:uo(this.sim,s,t,o,this.pair,a);break;case Ce:mo(this.sim,s,t,o);break;default:vs(this.sim,s,t,o,this.cooling,n)}this.sim.count=i;const m=innerWidth,h=innerHeight,r=this.sim.particles;for(let l=0;l<re;l++){const d=l*O,f=this.nodes[l];f.style.left=((r[d]*.5+.5)*m).toFixed(1)+"px",f.style.top=((-r[d+1]*.5+.5)*h).toFixed(1)+"px"}let c="";for(let l=0;l<rs;l++){const d=l*O,f=Math.min(1,Math.hypot(r[d+2],r[d+3])*.22);c+=`<div class="row"><span class="id">${l}</span><span class="sp">${ut[this.sim.species[l]]}</span><span class="v">${f.toFixed(4)}</span></div>`}this.listHost.innerHTML=c}}const Fs=new URLSearchParams(location.search),Gs=Math.max(1,Number(Fs.get("n"))||1e6),dt=document.getElementById("stage"),Ie=new js(document.getElementById("hud")),Ae=Ys(Gs),de={entities:0,domNodes:0,arm:"gpu",backend:"booting",effectRuns:0},Lo=Fs.get("backend");async function Fo(){if(Lo!=="webgl2")try{const s=await To(dt,Ae);if(s)return s}catch(s){console.warn("WebGPU init failed, falling back to WebGL2:",s)}const e=Oo(dt,Ae);if(!e)throw new Error("Neither WebGPU nor WebGL2 is available.");return e}let Dt=0,Bt=0;addEventListener("pointermove",e=>{Dt=e.clientX/innerWidth*2-1,Bt=-(e.clientY/innerHeight*2-1)});const L=await Fo();L.setCount(Gs);de.backend=`${L.name} · ${L.detail}`;const Go=3.5,qo=8;let Re=!1,Te=1;const $o=e=>e instanceof Element&&!!e.closest("#sidebar, #hud, #banner");function yt(e){Re!==e&&(Re=e,L.setCursorMass(Re?bs:Ee))}addEventListener("pointerdown",e=>{e.button===0&&!$o(e.target)&&yt(!0)});addEventListener("pointerup",()=>yt(!1));addEventListener("pointercancel",()=>yt(!1));addEventListener("blur",()=>yt(!1));const qs=document.getElementById("list-viewport"),Oe=new _o(qs,document.getElementById("list-spacer"),Ae,L),ie=new Uo(Ae,document.body,document.getElementById("sidebar"),qs),Kt=document.getElementById("sidebar-head"),cs=ut.map((e,s)=>{const t=document.createElement("button");t.className="chip",t.textContent=e;const[o,n,a]=Gt[s];return t.style.setProperty("--c",`rgb(${o*255|0} ${n*255|0} ${a*255|0})`),t.addEventListener("click",()=>Ao(s)),Kt.appendChild(t),t}),Xt=document.createElement("div");Xt.className="summary";Kt.appendChild(Xt);const $s=.982,We=1,bt=document.createElement("div");bt.className="control";const Yt=document.createElement("label");Yt.htmlFor="cooling";const ye=document.createElement("input");ye.type="range";ye.id="cooling";ye.min="0";ye.max="1000";const No=e=>We-(We-$s)*(1-e/1e3)**2,Vo=e=>1e3*(1-Math.sqrt((We-e)/(We-$s)));function Ns(e){L.setCooling?.(e),ie.setCooling(e);const s=e**60;Yt.textContent=`disc cooling · ${((1-s)*100).toFixed(1)}%/s`+(e>=We-1e-6?" — none, disc goes smooth":"")}ye.value=String(Vo(Ue));ye.addEventListener("input",()=>Ns(No(+ye.value)));bt.append(Yt,ye);Kt.appendChild(bt);Eo(()=>{const e=He();for(let s=0;s<cs.length;s++)cs[s].classList.toggle("off",!(e&1<<s));L.setSpeciesMask(e),Oe.refilter(),Xt.textContent=`${Oe.rowCount.toLocaleString()} rows · ${Co()}`});const je=document.createElement("div");je.id="banner";document.body.appendChild(je);const Vs=()=>H===q?`${ke[H].label} · ${Z.spin1>0?"prograde":"retrograde"}`:ke[H].label;function wt(){je.textContent=`${L.name} compute · ${Ae.count.toLocaleString()} particles · ${Vs()} — `+(ke[H].hold==="none"?"":"hold to pull · ")+`[M] mode · [B] compare · [R] ${ke[H].restart} · [C] ${Ve?"color":"mono"}`}function xt(e){Le(e),e==="baseline"?(ie.setMode(H,Z),ie.start(),dt.style.display="none",je.textContent=`naive DOM · ${re.toLocaleString()} particles as elements · ${Vs()} · sidebar rebuilt per frame — [B] compare · [R] restart`):(ie.stop(),dt.style.display="block",Oe.forceRepaint(),wt()),je.className=e,de.arm=e,Ie.reset()}let H=$e;const Z=ft();L.setPair(Z);function zo(e){H=e,H===q&&qt(Z),L.setMode(H),bt.style.display=ke[H].cooling?"":"none",Le()==="gpu"?wt():xt("baseline")}let Ve=!1;function Ho(e){Ve=e,L.setMono?.(Ve),ie.setMono(Ve),Le()==="gpu"&&wt()}function Wo(){if(H===q){zs();return}L.reset(),ie.reset(),Ie.reset()}function zs(e=!0){qt(Z,e?-Z.spin1:Z.spin1),L.setMode(q),Le()==="baseline"?ie.setMode(q,Z):wt(),Ie.reset()}addEventListener("keydown",e=>{(e.key==="b"||e.key==="B")&&xt(Le()==="gpu"?"baseline":"gpu"),(e.key==="m"||e.key==="M")&&zo((H+1)%go),(e.key==="r"||e.key==="R")&&Wo(),(e.key==="c"||e.key==="C")&&Ho(!Ve)});function Hs(){const e=Math.min(devicePixelRatio,2);L.resize(innerWidth*e|0,innerHeight*e|0)}addEventListener("resize",Hs);Hs();Ns(Ue);xt("gpu");globalThis.__demo={sim:Ae,backend:L,baseline:ie,hud:Ie,counters:de,integrateCPU:vs,list:Oe,effectRuns:Ls,setArm:xt};let ls=performance.now();function Ws(e){Ie.frame(e);const s=Math.min((e-ls)/1e3,1/30);ls=e,H===q&&(ao(Z,s),Z.elapsed>6&&(ro(Z)>2.4||Z.elapsed>42)&&zs()),Te+=((Re?ht:1)-Te)*(1-Math.exp(-(Re?Go:qo)*s)),!Re&&Te<1.001&&(Te=1),Le()==="gpu"?(L.frame(s,Dt,Bt,Te),Oe.update(),de.entities=Ae.count,de.domNodes=Oe.liveNodes):(ie.frame(s,Dt,Bt,Te,Re?bs:Ee),de.entities=ie.count,de.domNodes=ie.domNodes),de.effectRuns=Ls(),Ie.paint(e,de),requestAnimationFrame(Ws)}requestAnimationFrame(Ws);
