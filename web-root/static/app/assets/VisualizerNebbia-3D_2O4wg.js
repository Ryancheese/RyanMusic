import{O as Vt,I as cs,g as Ge,n as st,a5 as Ee,w as hs,a6 as fs,a7 as ze,a8 as us,P as gt,a9 as He,T as je,aa as Et,ab as Gt,ac as Yt,k as ue,l as de,ad as ds,S as ms,U as bs,ae as ps,u as xs,r as X,i as ys,j as Rt,V as gs,m as vs}from"./index-DNQBNUaQ.js";import{u as ws,r as Ss}from"./subtitleFontSizes-V98QZjGR.js";import{r as Es,a as Kt,l as Ms}from"./lucideIconResolver-CuW_4uDZ.js";import{s as As}from"./wordSegmentation-D5b90VO-.js";const Nt="icon:",Wt=i=>i.startsWith(Nt),zt={"❤":"Heart","♥":"Heart","💗":"Heart","⭐":"Star","★":"Star","☆":"Star","🌙":"Moon","☀":"Sun","🌞":"Sun","🎵":"Music","♪":"Music2","🎶":"Music","🌸":"Flower","✿":"Flower2","🌷":"Flower2","✨":"Sparkles","☁":"Cloud","🌧":"CloudRain","☂":"Umbrella","☔":"Umbrella","🐱":"Cat","😊":"Smile","🙂":"Smile","❄":"Snowflake","🍃":"Leaf","🌿":"Leaf","🪶":"Feather"},Rs=["Heart","Star","Moon","Music","Flower","Sparkles","CloudRain","Umbrella","Smile","Leaf"],Ts=i=>{const t=new Set;for(const e of i)for(const s of e.fullText.replace(/[️‍]/g,""))zt[s]&&t.add(zt[s]);return[...t]},Fs=i=>{const t=i.replace(/[️‍]/g,"");return zt[t]?Nt+zt[t]:t},ks=(i,t,e)=>{const s=[];let n=0;for(const l of t)s.push(n),n+=l.length;const o=l=>{let r=0;for(;r+1<s.length&&s[r+1]<=l;)r+=1;return r},a=[];for(const l of As(i)){if(!l.segment.trim())continue;const r=o(l.index),h=o(l.index+l.segment.length-1);let c=[];for(let f=r;f<=h;f+=1)e[f].ch.trim()&&(Wt(e[f].ch)?(c.length&&a.push(c),a.push([f]),c=[]):c.push(f));c.length&&a.push(c)}return a},Bs=(i,t,e,s)=>{const n=Vt(String(t));return i.map((o,a)=>{const l=cs(o),r=l.map(m=>({ch:Fs(m.char),t:m.startTime,d:Math.max(0,m.endTime-m.startTime)})),h=ks(o,l.map(m=>m.char),r),c=Math.max(o.startTime,Ge(o)),f=i[a+1]?.startTime??1/0,u=st(n+Math.imul(a+1,977)+31>>>0),d=r[r.length-1];if(d&&s.length&&!r.some(m=>Wt(m.ch))&&u()<e){const m=d.t+d.d;r.push({ch:" ",t:m,d:0},{ch:Nt+s[Math.floor(u()*s.length)],t:m+.08,d:1.1}),h.push([r.length-1])}return{chars:r,words:h,t:o.startTime,end:c,next:f}})},_s=2.5,Is=i=>{const t=typeof Intl<"u"&&"Segmenter"in Intl?new Intl.Segmenter(void 0,{granularity:"grapheme"}):null;return t?[...t.segment(i)].map(e=>e.segment):[...i]},Ns=(i,t)=>{const e=[];let s=0;for(const l of t)e.push(s),s+=l.length;const n=[],o=typeof Intl<"u"&&"Segmenter"in Intl?new Intl.Segmenter(void 0,{granularity:"word"}):null,a=o?[...o.segment(i)].map(l=>({at:l.index,text:l.segment})):[...i.matchAll(/\S+/g)].map(l=>({at:l.index??0,text:l[0]}));for(const l of a){if(!l.text.trim())continue;const r=e.flatMap((h,c)=>h>=l.at&&h<l.at+l.text.length&&t[c].trim()?[c]:[]);r.length&&n.push(r)}return n},Me=(i,t,e)=>{const s=Is(i),n=s.map((a,l)=>({ch:a,t:t+l*.1,d:.5})),o=n[n.length-1];return{chars:n,words:Ns(i,s),t,end:o?o.t+o.d:t,next:1/0,credits:e}},Ls=(i,t,e)=>{const s=t?.trim();if(!i.length||!s)return i;const n=Math.max(...i.map(r=>r.end))+_s,o=i.map((r,h)=>h===i.length-1?{...r,next:Math.min(r.next,n)}:r),a=Me(s,n,"title");o.push(a);const l=e?.trim();return l&&o.push(Me(l,a.end+.2,"artist")),o},q={edge:.6,beads:.35,drip:.25,refract:1,glint:1,fieldDrops:.5,wind:0,endBead:1,endBeadMin:48,beadHold:4,breathSpread:.3,breathHold:1,breathFade:8,breathThick:.7,bumpRate:1,bumpFall:.5},et=.5,me=4,A=(i,t=0,e=1)=>Math.max(t,Math.min(e,i)),K=i=>i*i*(3-2*i),rt=[1.5,3,5,8],Ds=[11,8,5.5,3.6],qs=.18,Cs=.35,Ae=2.5,Us=6,Tt=1/480;class Ps{u=rt.map(()=>[0,0]);v=rt.map(()=>[0,0]);last=-1;step(t,e,s){const n=this.last;if(this.last=t,e||n<0||t<=n)return;let o=Math.max(n,t-.1);for(;o<t;){const a=Math.min(Tt,t-o),l=s(o-Tt),r=s(o),h=s(o+Tt);for(let c=0;c<2;c+=1){const f=-3*Cs*(h[c]-2*r[c]+l[c])/(Tt*Tt);rt.forEach((u,d)=>{const m=Ds[d]*Math.PI*2,p=f-2*qs*m*this.v[d][c]-m*m*this.u[d][c];this.v[d][c]+=p*a,this.u[d][c]+=this.v[d][c]*a})}o+=a}}offset(t){let e=0;for(;e<rt.length-2&&t>rt[e+1];)e+=1;const s=A((t-rt[e])/(rt[e+1]-rt[e])),n=A((t-Ae)/(Us-Ae)),o=(this.u[e][0]+(this.u[e+1][0]-this.u[e][0])*s)*n,a=(this.u[e][1]+(this.u[e+1][1]-this.u[e][1])*s)*n,l=A((Math.abs(a)-Math.abs(o)*.5)/Math.max(t,1)*.12,-.25,.35);return[o,a,l]}}const Os=.6,Gs=.3,ge=(i,t)=>-i*q.wind*t;class zs{drops=[];trails=[];smears=[];fieldDrops=[];bumps=[];nextBump=0;rng=st(777);now=0;H=0;lastTrigger=-1/0;spring=new Ps;bump=1;buildField(t,e){const s=st(4242),n=Math.round(t*e/2200*q.fieldDrops);this.fieldDrops=[];for(let o=0;o<n;o+=1){const l=s()<.12?40+s()*34:14+s()**1.4*22,r=s()*.25,h=s()*t,c=e*(1-s()**1.25);this.fieldDrops.push({x:h,y:c,hx:h,hy:c,w:l*(1+r*.5),h:l*(1+r),phase:s()*6.28,fall:null,smear:null})}this.trails.length=0,this.smears.length=0,this.H=e}beginFrame(t,e,s=!0){this.now=t,this.drops.length=0,this.spring.step(t,e,n=>this.shakeAt(n)),!(e||!s||this.bump<=0||q.bumpRate<=0)&&t>this.nextBump&&(this.nextBump>0&&this.trigger(t,.5+this.rng()*.7),this.nextBump=t+(3+this.rng()*9)/q.bumpRate)}trigger(t,e){for(this.bumps.push({t,a:e});this.bumps.length&&t-this.bumps[0].t>3;)this.bumps.shift();const s=A((t-this.lastTrigger)/7.5);this.lastTrigger=t;for(const n of this.fieldDrops)if(!(n.fall||n.w<26)&&this.rng()<q.bumpFall*e*s*(n.w-24)/45){n.smear&&n.smear.end===null&&(n.smear.end=t),n.smear=null;const o={x:n.x,y0:n.y-n.h*.05,y1:n.y,w:n.w,end:null,seed:this.rng()*100};n.fall={t0:t+this.rng()*.12,y0:n.y,len:(30+this.rng()*150)*n.w/50,dur:1+this.rng()*2.2,trail:o},this.trails.push(o)}}shake(){return this.shakeAt(this.now)}shakeAt(t){let e=0,s=0;for(const n of this.bumps){const o=t-n.t;if(o<0)continue;const a=n.a*this.bump;s+=a*7*Math.exp(-o*4.5)*Math.sin(o*Math.PI*2*3.8),e+=a*2*Math.exp(-o*5.5)*Math.sin(o*Math.PI*2*2.7+1.2)*(1-Math.exp(-o*60))}return[e,s]}wobble(t){let e=0;for(const s of this.bumps){const n=this.now-s.t;n>=0&&(e+=s.a*this.bump*.07*Math.exp(-n*3.2)*Math.sin(n*Math.PI*2*7+t))}return e}put(t,e,s,n,o=1,a=1){if(s<.5||n<=.01)return;const[l,r,h]=this.spring.offset(s),c=this.wobble(t*.05+e*.03)-h,f=s*8*o*(1+c),u=s*8*a*(1-c);this.drops.push(t+l,e+r,f,u,f/100,Math.min(1,n))}fieldInstances(t,e){t.length=0;for(const s of this.fieldDrops){let n=s.x,o=s.y,a=0;if(s.fall){const f=s.fall,u=f.trail,d=A((this.now-f.t0)/f.dur);o=f.y0+f.len*(d-Math.sin(d*6*Math.PI)/(6*Math.PI)),n=u.x+Math.sin(o*.07+u.seed)*1.4+Math.sin(o*.021+u.seed*2)*2.2+ge(o-u.y0,e),a=.4*(1-Math.cos(d*6*Math.PI))*(d<1?1:0),u.y1=o,d>=1&&(u.end=this.now,s.fall=null,o-s.h/8>this.H?(s.x=s.hx,s.y=s.hy):(s.x=n,s.y=o))}const[l,r,h]=this.spring.offset(s.w/8);s.fall||this.trackSmear(s,l,r);const c=this.wobble(s.phase)-h;t.push(n+l,o+r,s.w*(1+c),s.h*(1-c+a),s.w/100,1)}return t}trackSmear(t,e,s){const n=Math.hypot(e,s);let o=t.smear;if(n<Gs){o&&o.end===null&&(o.end=this.now);return}if(o?.gone&&(o=null),!o){if(n<Os)return;o={x:t.x,y:t.y,w:t.w,ax:0,ay:0,bx:0,by:0,end:null},t.smear=o,this.smears.push(o)}o.end=null,s<o.ay&&(o.ax=e,o.ay=s),s>o.by&&(o.bx=e,o.by=s)}}const Hs="/static/app/assets/nebbiaRaindrop-DNADElS4.png",Ct=(i,t,e)=>{const s=i.createShader(t);return i.shaderSource(s,e),i.compileShader(s),s},bt=(i,t,e,s)=>{const n=i.createProgram();i.attachShader(n,t),i.attachShader(n,e);for(const[o,a]of Object.entries(s))i.bindAttribLocation(n,a,o);return i.linkProgram(n),n},js=(i,t)=>{if(i.getProgramParameter(t,i.LINK_STATUS))return;const e=(i.getAttachedShaders(t)??[]).map(s=>i.getShaderInfoLog(s)).filter(Boolean).join(`
`);throw new Error(`Nebbia program: ${i.getProgramInfoLog(t)}${e?`
${e}`:""}`)},at=(i,t)=>{const e=i.createTexture();return i.activeTexture(i.TEXTURE0+t),i.bindTexture(i.TEXTURE_2D,e),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),{t:e,unit:t}},Ft=[{b:.0012,y0:.03,y1:.63,fog:!1},{b:.03,y0:0,y1:.66,fog:!0},{b:.09,y0:-.06,y1:.73,fog:!0}],Re=[.02,.035],Xs=.5,Jt=.15,Zt=.2,Vs=(i,t,e,s)=>{const n=Math.floor(i/e*s),o=Math.min(s,Math.ceil(t/e*s)-n),a=(n%s+s)%s,l=Math.min(Math.max(o,0),s-a),r=o<=0?[]:o>l?[[a,l],[0,o-l]]:[[a,o]];return{x0:n*e/s,runs:r}},Ws=["uFillB","uFillLayer","uFillX0","uFillGeo","uFillSize"];class $s{constructor(t,e){this.gl=t,Ft.forEach((s,n)=>Re.forEach((o,a)=>{const l=at(t,e+n*2+a);t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),this.caches.push({tex:l,fb:t.createFramebuffer(),level:n,layer:a,w:1,h:1,lo:0,hi:0,valid:!1})}))}gl;caches=[];span=1;aspect=1;bindSamplers(t){const{gl:e}=this;e.useProgram(t),this.caches.forEach((s,n)=>e.uniform1i(e.getUniformLocation(t,`uBld${n}`),s.tex.unit))}invalidate(){for(const t of this.caches)t.valid=!1}resize(t,e,s){const{gl:n}=this;this.aspect=t/e,this.span=this.aspect+2*Jt+Zt;const o=n.getParameter(n.MAX_TEXTURE_SIZE);for(const a of this.caches){const l=Ft[a.level],r=Math.min(l.fog?s:e*Xs,o/this.span);a.w=Math.max(1,Math.ceil(this.span*r)),a.h=Math.max(1,Math.ceil((l.y1-l.y0)*r)),n.activeTexture(n.TEXTURE0+a.tex.unit),n.bindTexture(n.TEXTURE_2D,a.tex.t),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,a.w,a.h,0,n.RGBA,n.UNSIGNED_BYTE,null),n.bindFramebuffer(n.FRAMEBUFFER,a.fb),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,a.tex.t,0),a.valid=!1}n.bindFramebuffer(n.FRAMEBUFFER,null)}update(t,e,s){const{gl:n}=this;let o=-1,a=!1;for(const r of this.caches){const h=t*Re[r.layer],c=h-Jt,f=h+this.aspect+Jt;if(r.valid&&c>=r.lo&&f<=r.hi)continue;const u=r.valid&&c>=r.lo&&f-r.hi<this.span/2;if(!u&&o>=0&&o!==r.level){r.valid=!1;continue}if(a||(n.useProgram(e),n.enable(n.SCISSOR_TEST),a=!0),u){const d=f+Zt/4;this.fill(r,r.hi,d,s),r.hi=d,r.lo=d-this.span}else o=r.level,r.lo=c-Zt/4,r.hi=r.lo+this.span,this.fill(r,r.lo,r.hi,s),r.valid=!0}a&&(n.disable(n.SCISSOR_TEST),n.bindFramebuffer(n.FRAMEBUFFER,null));const l=Ft.map((r,h)=>this.caches[h*2].valid&&this.caches[h*2+1].valid?1:0);return{on:[l[0],l[1],l[2]],geo:Ft.flatMap(r=>[r.y0,r.y1,this.span])}}fill(t,e,s,n){const{gl:o}=this,a=Ft[t.level],{x0:l,runs:r}=Vs(e,s,this.span,t.w);if(r.length){o.activeTexture(o.TEXTURE0+t.tex.unit),o.bindTexture(o.TEXTURE_2D,null),o.bindFramebuffer(o.FRAMEBUFFER,t.fb),o.viewport(0,0,t.w,t.h),o.uniform1f(n.uFillB,a.b),o.uniform1f(n.uFillLayer,t.layer),o.uniform1f(n.uFillX0,l),o.uniform3f(n.uFillGeo,a.y0,a.y1,this.span),o.uniform2f(n.uFillSize,t.w,t.h);for(const[h,c]of r)o.scissor(h,0,c,t.h),o.drawArrays(o.TRIANGLE_STRIP,0,4);o.bindTexture(o.TEXTURE_2D,t.tex.t)}}}const Ys=4;class Ks{constructor(t,e,s,n=null){this.gl=t,this.ok=s,this.layers=[{tex:at(t,e),fb:s?t.createFramebuffer():null,div:me,b:.03,w:1,h:1},{tex:at(t,e+1),fb:s?t.createFramebuffer():null,div:me*2,b:.09,w:1,h:1}],s&&n!==null&&this.layers.push({tex:at(t,n),fb:t.createFramebuffer(),div:Ys,b:.006,w:1,h:1})}gl;ok;layers;resize(t,e){const{gl:s}=this;if(this.ok){for(const n of this.layers)n.w=Math.max(1,Math.ceil(t/n.div)),n.h=Math.max(1,Math.ceil(e/n.div)),s.activeTexture(s.TEXTURE0+n.tex.unit),s.bindTexture(s.TEXTURE_2D,n.tex.t),s.texImage2D(s.TEXTURE_2D,0,s.RGBA16F,n.w,n.h,0,s.RGBA,s.HALF_FLOAT,null),s.bindFramebuffer(s.FRAMEBUFFER,n.fb),s.framebufferTexture2D(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,n.tex.t,0);s.bindFramebuffer(s.FRAMEBUFFER,null)}}draw(t){const{gl:e}=this;if(this.ok){for(const s of this.layers)e.bindFramebuffer(e.FRAMEBUFFER,s.fb),e.viewport(0,0,s.w,s.h),e.uniform1f(t,s.b),e.drawArrays(e.TRIANGLE_STRIP,0,4);e.bindFramebuffer(e.FRAMEBUFFER,null)}}}class Js{constructor(t,e){this.gl=t,this.tex=at(t,e),this.fb=t.createFramebuffer()}gl;tex;fb;w=1;h=1;ok=!1;dirty=!1;resize(t,e){const{gl:s}=this,n=s.getParameter(s.MAX_TEXTURE_SIZE);this.w=t,this.h=e,this.ok=t<=n&&e<=n,this.ok&&(s.activeTexture(s.TEXTURE0+this.tex.unit),s.bindTexture(s.TEXTURE_2D,this.tex.t),s.texImage2D(s.TEXTURE_2D,0,s.RGBA8,t,e,0,s.RGBA,s.UNSIGNED_BYTE,null),s.bindFramebuffer(s.FRAMEBUFFER,this.fb),s.framebufferTexture2D(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,this.tex.t,0),s.bindFramebuffer(s.FRAMEBUFFER,null),this.dirty=!0)}update(t){const{gl:e}=this;return this.ok&&this.dirty&&(e.activeTexture(e.TEXTURE0+this.tex.unit),e.bindTexture(e.TEXTURE_2D,null),e.useProgram(t),e.bindFramebuffer(e.FRAMEBUFFER,this.fb),e.viewport(0,0,this.w,this.h),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindTexture(e.TEXTURE_2D,this.tex.t),this.dirty=!1),this.ok}}const It=6;class Zs{data=new Float32Array(It*4096);count=0;a=1;b=0;c=0;d=1;e=0;f=0;k=1;path=[];clear(){this.count=0,this.path.length=0}setTransform(t,e,s,n,o,a){this.a=t,this.b=e,this.c=s,this.d=n,this.e=o,this.f=a,this.k=Math.hypot(t,e)}moveTo(t,e){this.path.length&&this.path.push(NaN,NaN),this.lineTo(t,e)}lineTo(t,e){this.path.push(this.a*t+this.c*e+this.e,this.b*t+this.d*e+this.f)}stroke(t,e){const s=this.path,n=t*this.k;for(let o=2;o<s.length;o+=2)Number.isNaN(s[o])||Number.isNaN(s[o-2])||this.push(s[o-2],s[o-1],s[o],s[o+1],n,e);s.length=0}push(t,e,s,n,o,a){if((this.count+1)*It>this.data.length){const h=new Float32Array(this.data.length*2);h.set(this.data),this.data=h}const l=this.count*It,r=this.data;r[l]=t,r[l+1]=e,r[l+2]=s,r[l+3]=n,r[l+4]=o,r[l+5]=a,this.count+=1}}const Qs=`#version 300 es
in vec2 aCorner; in vec4 aSeg; in vec2 aParam;
uniform vec2 uView;
out vec2 vP; flat out vec4 vSeg; flat out vec2 vParam;
void main() {
  vec2 a = aSeg.xy, b = aSeg.zw, d = b - a;
  float l = length(d);
  vec2 t = l > 1e-5 ? d / l : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
  // 最宽那层的半宽再留 1 像素抗锯齿
  float R = aParam.x * 0.65 + 1.0;
  vec2 p = (a + b) * 0.5 + t * aCorner.x * (l * 0.5 + R) + n * aCorner.y * R;
  vP = p; vSeg = aSeg; vParam = aParam;
  gl_Position = vec4(p / uView * 2.0 - 1.0, 0.0, 1.0);
}`,to=`#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vSeg; flat in vec2 vParam;
out vec4 o;
// 半宽 r 的线离像素中心 d 时的覆盖度（1 像素线性过渡，接近画布的抗锯齿）
float cover(float r, float d) { return clamp(r + 0.5 - d, 0.0, 1.0); }
// 画布的颜色是 8 位：先量化再乘覆盖度
float level(float x) { return floor(x * 255.0 + 0.5) / 255.0; }
void main() {
  vec2 a = vSeg.xy, ba = vSeg.zw - a, pa = vP - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float d = length(pa - ba * h), w = vParam.x * 0.5, v = vParam.y;
  // 三层按画布的 lighten 一层层叠：每层都比下面亮，覆盖度 a 的像素是 m + a × (这层 − m)
  float m = level(v * 0.38) * cover(w * 1.3, d);
  m += cover(w, d) * (level(v * 0.72) - m);
  m += cover(w * 0.62, d) * (level(v) - m);
  o = vec4(m, 0.0, 0.0, 1.0);
}`;class eo{constructor(t,e){this.gl=t,this.tex=at(t,e),this.fb=t.createFramebuffer(),this.vao=t.createVertexArray(),t.bindVertexArray(this.vao),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),this.buf=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.buf);const s=It*4;t.enableVertexAttribArray(1),t.vertexAttribPointer(1,4,t.FLOAT,!1,s,0),t.vertexAttribDivisor(1,1),t.enableVertexAttribArray(2),t.vertexAttribPointer(2,2,t.FLOAT,!1,s,16),t.vertexAttribDivisor(2,1),t.bindVertexArray(null)}gl;tex;prog=null;vao;buf;uView=null;fb;w=1;h=1;attach(t){this.prog=t,this.uView=this.gl.getUniformLocation(t,"uView")}resize(t,e){const{gl:s}=this;this.w=Math.max(1,Math.round(t*et)),this.h=Math.max(1,Math.round(e*et)),s.activeTexture(s.TEXTURE0+this.tex.unit),s.bindTexture(s.TEXTURE_2D,this.tex.t),s.texImage2D(s.TEXTURE_2D,0,s.R8,this.w,this.h,0,s.RED,s.UNSIGNED_BYTE,null),s.bindFramebuffer(s.FRAMEBUFFER,this.fb),s.framebufferTexture2D(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,this.tex.t,0),s.bindFramebuffer(s.FRAMEBUFFER,null)}draw(t){const{gl:e}=this;e.bindFramebuffer(e.FRAMEBUFFER,this.fb),e.viewport(0,0,this.w,this.h),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),t.count&&this.prog&&(e.useProgram(this.prog),e.bindVertexArray(this.vao),e.bindBuffer(e.ARRAY_BUFFER,this.buf),e.bufferData(e.ARRAY_BUFFER,t.data.subarray(0,t.count*It),e.DYNAMIC_DRAW),e.uniform2f(this.uView,this.w,this.h),e.enable(e.BLEND),e.blendEquation(e.MAX),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,t.count),e.blendEquation(e.FUNC_ADD),e.disable(e.BLEND),e.bindVertexArray(null)),e.bindFramebuffer(e.FRAMEBUFFER,null)}}const so=`
uniform float uBubbles;
// 跟拍冒的每排：x、冒出的时刻、大小（0 是空格）、种子
uniform vec4 uBurst[12];
uniform int uBurstN;
// 1 时舞潮踏拍的气泡一项开着：不冒随机的大泡
uniform float uBeatRows;
// 一颗泡（d 是到泡心的偏移，y 朝下）：rgb 加上去的光，a 泡里压暗多少
vec4 aqBubble(vec2 d, float rad, float b) {
  float l = length(d), aa = max(b, 0.0005);
  float keep = rad * rad / (rad * rad + b * b * 4.0);
  float disc = smoothstep(rad + aa, rad - aa, l);
  float up = 0.5 + 0.5 * clamp(-d.y / max(l, 1e-5), -1.0, 1.0);
  float fres = pow(clamp(l / rad, 0.0, 1.0), 5.0) * disc * (0.35 + 0.65 * up);
  float spec = glowPt(d + vec2(rad * 0.36, rad * 0.4), rad * 0.15, b, 0.0);
  float spec2 = glowPt(d - vec2(rad * 0.32, rad * 0.42), rad * 0.1, b, 0.0) * 0.3;
  float caus = glowPt(d - vec2(0.0, rad * 0.5), rad * 0.32, b, 0.0) * 0.14;
  vec4 big = vec4(vec3(fres * 0.9 * keep + spec * 1.3 + spec2 + caus), disc * 0.14 * keep);
  vec4 tiny = vec4(vec3(glowPt(d, rad * 0.6, b, 0.0) * 1.3 + spec * 1.2), 0.0);
  return mix(tiny, big, smoothstep(0.0018, 0.0034, rad));
}
vec3 aqBubbles(vec3 col, vec2 q, float b, vec3 bc) {
  float t = uTime;
  float drift = sceneryOn(SCN_RAIN_SLANT) ? 0.1 : 0.0;
  float fade = smoothstep(0.93, 0.8, q.y);
  float qx = q.x + (0.92 - q.y) * drift;
  // 细泡：每股从一个泉眼冒出，越往上越散、泡越大一点
  if (sceneryOn(SCN_RAIN)) {
    float cw = 0.055, cx = floor(qx / cw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = cx + k;
      if (h1(n * 2.3 + 1.0) > uBubbles * 0.9) continue;
      float src = (n + 0.5) * cw + (h1(n + 3.0) - 0.5) * cw * 0.5;
      float sp = 0.14 + 0.1 * h1(n + 7.0), ch = 0.014 + 0.01 * h1(n + 5.0);
      float rise = clamp((0.92 - q.y) / 0.9, 0.0, 1.0);
      float sw = 0.003 + 0.016 * rise, swe = sqrt(sw * sw + b * b);
      float sx = qx - src;
      col += bc * exp(-sx * sx / (swe * swe)) * 0.03 * fade * (sw / swe + 0.3);
      if (b > 0.02) continue;
      float v = q.y + t * sp, iy = floor(v / ch);
      for (float j = -1.0; j <= 1.0; j++) {
        float m = iy + j, hb = h1(m * 1.31 + n * 17.0);
        if (hb > 0.85) continue;
        // 每颗在格子里上下错一点、左右散开，不排成一串珠子
        float y = (m + 0.2 + 0.6 * h1(m * 2.7 + n)) * ch - t * sp;
        float up = clamp((0.92 - y) / 0.9, 0.0, 1.0);
        float rad = 0.0012 + 0.003 * hb * hb * hb + 0.0012 * up;
        vec2 c = vec2(src + sin(m * 2.1 + t * 6.0) * (0.0015 + 0.006 * up) + (h1(m + n) - 0.5) * (0.006 + 0.03 * up), y);
        vec4 bub = aqBubble(vec2(qx, q.y) - c, rad, b);
        col = col * (1.0 - bub.a * fade) + bc * bub.rgb * fade * (0.6 + 0.4 * h1(m * 5.0 + n));
      }
    }
  }
  // 大泡：少、慢，上下略扁，边缘一边浮一边轻轻晃
  if (sceneryOn(SCN_CARS) && uBeatRows < 0.5) {
    float bw = 0.13, bx = floor(qx / bw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = bx + k;
      float sp = 0.07 + 0.04 * h1(n + 41.0), ch = 0.42;
      float iy = floor((q.y + t * sp) / ch);
      for (float j = -1.0; j <= 0.0; j++) {
        float m = iy + j;
        if (h1(m * 3.7 + n * 11.0) > min(1.1 * uBubbles, 0.85)) continue;
        float rad = 0.008 + 0.016 * pow(h1(m + n * 5.0), 1.5);
        vec2 c = vec2((n + 0.2 + 0.6 * h1(m * 7.0 + n)) * bw + sin(t * 1.3 + m) * 0.02, (m + 0.5) * ch - t * sp);
        vec2 d = vec2(qx, q.y) - c;
        // 按方向缩放偏移，轮廓就晃：sin(3θ + φ)、sin(2θ - φ') 用方向的余弦正弦展开，不用 atan
        vec2 u = d / max(length(d), 1e-5);
        float c2 = u.x * u.x - u.y * u.y, s2 = 2.0 * u.x * u.y;
        float c3 = u.x * (4.0 * u.x * u.x - 3.0), s3 = u.y * (3.0 - 4.0 * u.y * u.y);
        float f1 = t * 4.0 + m, f2 = t * 3.0;
        float shape = 1.0 + 0.03 * (s3 * cos(f1) + c3 * sin(f1)) + 0.02 * (s2 * cos(f2) - c2 * sin(f2));
        vec4 bub = aqBubble(vec2(d.x, d.y * 1.18) / shape, rad, b);
        col = col * (1.0 - bub.a * fade) + bc * (bub.rgb + glowPt(d, rad * 1.4, b, 0.0) * 0.04) * fade;
      }
    }
  }
  // 跟拍冒的一排排大泡：一排六颗，冒出时从小涨到全大，先冲一下再慢慢浮；离这一排远的像素直接跳过。
  // 每颗带一圈光晕，雾后面糊开也是一排亮点，看得出跟拍
  for (int i = 0; i < 12; i++) {
    if (i >= uBurstN) break;
    vec4 B = uBurst[i];
    float a = t - B.y;
    if (B.z <= 0.0 || a < 0.0) continue;
    float y0 = 0.9 - 0.2 * a - 0.28 * (1.0 - exp(-a * 3.0));
    if (abs(q.y - y0) > 0.08 + b * 3.0) continue;
    float grow = smoothstep(0.0, 0.15, a) * (0.55 + 0.45 * B.z);
    for (float k = 0.0; k < 6.0; k++) {
      float h = h1(B.w + k * 7.3), h2 = h1(B.w * 1.7 + k * 3.1);
      float rad = (0.008 + 0.012 * h) * grow;
      vec2 c = vec2(B.x + (k - 2.5) * 0.05 + (h2 - 0.5) * 0.02 + sin(a * 3.0 + k * 1.7) * 0.004 * a, y0 + (h - 0.5) * 0.04);
      vec2 d = vec2(qx, q.y) - c;
      vec4 bub = aqBubble(vec2(d.x, d.y * 1.18), rad, b);
      col = col * (1.0 - bub.a * fade) + bc * (bub.rgb + glowPt(d, rad * 2.0 + 0.004, b, 0.0) * 0.22) * fade;
    }
  }
  return col;
}
`,oo=`
// 每只：xy 位置（scene 坐标）、z 伞盖半径、w 收缩（0 舒张，1 收得最紧）；颜色 rgb（已按远近调暗），a 触手波的相位
uniform vec4 uJelly[24], uJellyC[24];
uniform int uJellyN;
vec3 jellies(vec2 q, float b) {
  vec3 c = vec3(0.0);
  float sharp = 1.0 - clamp(b * 25.0, 0.0, 1.0);
  bool fine = b < 0.004;
  for (int i = 0; i < 24; i++) {
    if (i >= uJellyN) break;
    vec4 J = uJelly[i];
    float size = J.z, pulse = J.w;
    vec2 d = q - J.xy;
    if (abs(d.x) > size * 2.2 + b * 3.0 || d.y < -size * 1.6 - b * 3.0 || d.y > size * 5.0 + b * 3.0) continue;
    vec3 jc = uJellyC[i].rgb * uNeon;
    float ph = uJellyC[i].a;
    // 伞盖：收缩时变窄变高；下沿往两边垂、带一圈波纹
    float wx = size * (1.0 - 0.18 * pulse), hy = size * 0.72 * (1.0 + 0.14 * pulse);
    vec2 p = vec2(d.x / wx, d.y / hy);
    float soft = b / size + 0.04;
    // 下沿那一段 r 涨得快（÷0.3），模糊时按 soft 放缓，不然雾后面伞裙下沿还是一道硬边；波纹也跟着糊掉
    float edge = 0.05 + 0.3 * p.x * p.x + 0.04 * cos(p.x * 14.0 + ph * 0.5) * sharp;
    float r = max(length(vec2(p.x, min(p.y, 0.0))), (p.y - edge) / (0.3 + soft) + 1.0);
    float fill = smoothstep(1.0 + soft, 1.0 - soft, r);
    float rr = (r - 0.9) / (0.09 + soft);
    float rim = exp(-rr * rr);
    vec2 pc = p + vec2(0.0, 0.4);
    float lobe = length(pc) - 0.26 - 0.07 * cos(4.0 * atan(pc.y, pc.x));
    float gon = exp(-lobe * lobe / (0.004 + soft * soft)) * (0.4 + 0.6 * sharp);
    c += jc * (fill * (0.16 + 0.55 * rim + 0.45 * gon) + glowPt(d + vec2(0.0, size * 0.25), size * 0.9, b, 0.0) * 0.18);
    if (d.y <= 0.0) continue;
    // 伞下一道拖尾光：模糊时靠它认出是水母
    float we = sqrt(pow(wx * 0.55, 2.0) + b * b);
    c += jc * exp(-d.x * d.x / (we * we)) * pow(max(1.0 - d.y / (size * 3.5), 0.0), 2.0) * 0.12 * smoothstep(0.0, size * 0.3, d.y);
    if (!fine) continue;
    // 触手：伞裙下沿垂下几根细丝，顺着往下传的波飘
    float w = 0.0012 + size * 0.012;
    we = sqrt(w * w + b * b);
    for (float k = 0.0; k < 6.0; k++) {
      float len = size * (2.6 + 1.6 * h1(float(i) * 13.0 + k));
      float s = d.y / len;
      if (s > 1.05) continue;
      float tx = (k / 5.0 - 0.5) * 1.5 * wx * (1.0 - 0.35 * min(s, 1.0));
      float dx = d.x - tx - sin(d.y / size * 2.6 - ph * 0.9 + k * 1.3) * size * 0.28 * min(s, 1.0);
      c += jc * (w / we) * exp(-dx * dx / (we * we)) * pow(max(1.0 - s, 0.0), 1.5) * smoothstep(hy * 0.1, hy * 0.35, d.y) * 0.8;
    }
    // 中间的口腕：粗一点、短一点的一条飘带
    float s = d.y / (size * 1.7);
    if (s < 1.0) {
      float wa = size * 0.14 * (1.0 - s * 0.6), wae = sqrt(wa * wa + b * b);
      float dx = d.x - sin(d.y / size * 3.5 - ph + 1.0) * size * 0.12 * s;
      c += jc * (wa / wae) * exp(-dx * dx / (wae * wae)) * (1.0 - s) * 0.35 * smoothstep(0.0, 0.01, d.y);
    }
  }
  return c;
}
`,Xe=`
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// 格子编号 → 0..1 的伪随机数（Dave Hoskins 的 hash11）。原来用 fract(sin(n) × 43758)，sin 的精度各家驱动不一样、
// 编号随行驶越来越大时平台间会对不上；纯算术的分布一样（均匀、相邻编号不相关），只是每格具体的值换了
float h1(float n) { n = fract(n * 0.1031); n *= n + 33.33; n *= n + n; return fract(n); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 pick(float h) { return h < 0.34 ? uLa : (h < 0.67 ? uLb : uLc); }
// 高斯光点：r 光点半径，b 模糊半径，streak 横向拖影半长；模糊越大越暗、越散
float glowPt(vec2 d, float r, float b, float streak) {
  d.x = sign(d.x) * max(abs(d.x) - streak, 0.0);
  float s2 = r * r + b * b;
  return (r * r / s2) * exp(-dot(d, d) / s2 * 1.6);
}
// 软边矩形：size 半宽高，soft 模糊半径
float softBox(vec2 d, vec2 size, float soft) {
  vec2 q = abs(d) - size;
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float k = min(size.x, size.y);
  return (1.0 - smoothstep(-soft * 0.5, soft, sd)) * k / (k + soft * 0.6);
}
// 半径 r、模糊 b 的 glowPt 纵向照得到多远：再远指数项 < 1e-6，乘上最大的倍数（霓虹 2.8 × uNeon 2）也远不到 8 位输出的一级。
// 下面各组灯纵向照不到当前这一行就整组跳过，画面不变
float reach(float r, float b) { return 3.0 * sqrt(r * r + b * b); }
const float HZ = 0.6, ROAD = 0.7;
const float WIND = 0.6;   // 车速 1 时，雨相对车身每往下 1 就往后 0.6（和 JS 里的 WIND_DRIFT 对应）
const vec3 SODIUM = vec3(1.0, 0.68, 0.32);
// uScenery 的位：窗外画哪几样（设置里的开关，nebbiaFrameUniforms.ts）。聚光灯不占位，关掉时 uSpotI 为 0
const int SCN_BUILDINGS = 1, SCN_LIGHTS = 2, SCN_CARS = 4, SCN_ROAD = 8, SCN_RAIN = 16, SCN_RAIN_SLANT = 32;
bool sceneryOn(int bit) { return (uScenery & bit) != 0; }
`,Ve=`
// 聚光灯光柱：从楼底的光源射向玻璃上的光斑，越近越宽越亮；b 是模糊半径（雾后面看光柱更散）
float beamFrom(vec2 src, vec2 q, float b) {
  vec2 d = uSpotTgt - src;
  float L = length(d);
  if (uSpotI <= 0.0 || L < 1e-3) return 0.0;
  d /= L;
  vec2 rel = q - src;
  float along = dot(rel, d);
  // 到「光源—光斑」这条线段的距离，不是到无限长中轴线的：末端是以光斑为圆心的圆头。
  // 原来按中轴线算、再沿光柱方向平切，末端是一道和光柱一样宽的平口；两盏灯从不同角度打到同一处，
  // 两个平口的角露在光斑两侧，看着像个 X
  float perp = length(rel - d * clamp(along, 0.0, L));
  float k = clamp(along / L, 0.0, 1.0);
  float w = mix(0.004, uSpotR * 0.9, k) + b;
  float body = exp(-perp * perp / (w * w)) * smoothstep(-0.01, 0.04, along) * (0.25 + 0.75 * k * k);
  // 光源本身：楼底一颗很亮的灯
  float lamp = exp(-dot(rel, rel) / (0.00004 + b * b * 0.25)) * 2.5 / (1.0 + b * 50.0);
  return (body * 0.7 + lamp) * uSpotI;
}
// 左右两盏，光源左右对称，打到同一个字上
float spotBeam(vec2 q, float b) { return beamFrom(uSpotSrc, q, b) + beamFrom(uSpotSrc2, q, b); }
`,no=`${Xe}${Ve}${oo}${so}
// 「舞潮踏拍」的水草一项（nebbiaWeedSway.ts）：弹簧现在、0.05、0.1、0.15 秒前的位置；根取现在、梢取 0.15 秒前，
// 从根往梢传
uniform vec4 uSway;
float weedKick(float s) {
  float f = clamp(s, 0.0, 1.0) * 3.0;
  return f < 1.0 ? mix(uSway.x, uSway.y, f) : f < 2.0 ? mix(uSway.y, uSway.z, f - 1.0) : mix(uSway.z, uSway.w, f - 2.0);
}
vec3 scene(vec2 q, float b) {
  float t = uTime, sharp = 1.0 - clamp(b * 25.0, 0.0, 1.0);
  vec3 deep = uSky0 * 0.55;
  vec3 col = mix(mix(uSky1, uLa, 0.3) * 1.25 + 0.02, deep, smoothstep(0.0, 0.95, q.y));
  vec3 lightC = mix(uLa, vec3(1.0), 0.45);
  // 水面照下来的光束，越往下越淡；最上面一层水面的粼光
  float rx = q.x + q.y * 0.35;
  float rays = pow(0.5 + 0.5 * sin(rx * 9.0 + t * 0.3 + sin(rx * 3.1 - t * 0.2) * 1.5), 6.0)
             + 0.6 * pow(0.5 + 0.5 * sin(rx * 17.0 - t * 0.45), 8.0);
  col += lightC * mix(0.25, rays, sharp * 0.6 + 0.4) * (1.0 - smoothstep(0.0, 0.85, q.y)) * 0.13;
  col += lightC * 0.8 * exp(-q.y * 14.0) * (0.25 + 0.15 * sin(q.x * 30.0 + t * 1.3 + sin(q.x * 7.0)) * sharp);
  // 沙底和焦散（「马路」）
  if (sceneryOn(SCN_ROAD)) {
    float floorY = 0.89 + 0.015 * sin(q.x * 3.0);
    float caus = pow(abs(sin(q.x * 23.0 + sin(q.y * 40.0 + t) * 1.2 + t * 0.6) * sin(q.x * 17.0 - t * 0.5 + q.y * 30.0)), 3.0);
    col = mix(col, deep * 1.3 + 0.03 + lightC * caus * 0.12 * sharp, smoothstep(floorY - 0.01 - b, floorY + 0.01 + b, q.y));
  }
  // 礁石（「楼群」）：顶上被水面的光照亮、带一点焦散，往下渐暗，表面有坑洼的纹理；比后面的水亮一点才看得出是石头
  if (sceneryOn(SCN_BUILDINGS)) {
    float rockY = 0.8 + 0.07 * vnoise(vec2(q.x * 3.5, 1.0)) + 0.02 * vnoise(vec2(q.x * 14.0, 3.0));
    float under = max(q.y - rockY, 0.0);
    float tex = 0.75 + 0.5 * mix(0.5, vnoise(q * vec2(26.0, 34.0)) * 0.65 + vnoise(q * vec2(70.0, 90.0)) * 0.35, sharp);
    vec3 rock = mix(deep * 1.6 + lightC * 0.07, deep * 0.75, smoothstep(0.0, 0.09, under)) * tex;
    float rc = pow(abs(sin(q.x * 31.0 + t * 0.5 + sin(q.y * 50.0 - t * 0.7)) * sin(q.x * 19.0 - t * 0.4 + q.y * 37.0)), 4.0);
    rock += lightC * (0.16 * exp(-under * 70.0) + rc * 0.07 * sharp * (1.0 - smoothstep(0.0, 0.05, under)));
    col = mix(col, rock, smoothstep(rockY - b - 0.003, rockY + b + 0.003, q.y) * 0.95);
    // 石脊前面一块块圆石头：按椭球的法线算受光（光从水面往下打），顶上亮、底下暗，边缘被噪声啃得不圆
    float rw = 0.17, rcx = floor(q.x / rw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = rcx + k, h = h1(n * 4.1 + 2.0);
      if (h > 0.7) continue;
      float rx = 0.06 + 0.05 * h1(n + 9.0), ry = rx * (0.55 + 0.3 * h1(n * 2.7));
      vec2 c = vec2((n + 0.3 + 0.4 * h1(n * 5.3)) * rw, 0.95);
      vec2 d = (q - c) / vec2(rx, ry);
      float edge = 0.12 * (vnoise(vec2(atan(d.y, d.x) * 2.5, n * 3.0)) - 0.5);
      float e = length(d) + edge, soft = (b + 0.003) / ry;
      float cover = smoothstep(1.0 + soft, 1.0 - soft, e);
      if (cover <= 0.0) continue;
      vec3 nrm = normalize(vec3(d * 0.9, sqrt(max(1.0 - dot(d, d), 0.04))));
      float lit = max(dot(nrm, normalize(vec3(-0.35, -1.0, 0.7))), 0.0);
      vec3 stone = (deep * 1.8 + lightC * 0.08) * (0.4 + 1.0 * lit) * tex + lightC * pow(lit, 6.0) * 0.16 * sharp;
      col = mix(col, stone, cover * 0.97);
    }
  }
  // 水草（「楼群」）和长在上面的一串串荧光粒子（「光斑」）：水草从根到梢传一道波，摆得快一点，
  // 「舞潮踏拍」时再跟拍往一边推（weedKick）；粒子跟着草身一起摆，越往梢越亮，各自一闪一闪
  bool weeds = sceneryOn(SCN_BUILDINGS), glow = sceneryOn(SCN_LIGHTS);
  if (weeds || glow) {
    float cw = 0.06, cx = floor(q.x / cw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = cx + k, h = h1(n * 1.7 + 5.0);
      if (h > 0.45) continue;
      float top = 0.55 + 0.25 * h1(n + 2.0), base = 0.92, len = base - top;
      float sway = t * (3.6 + 1.8 * h) + h * 20.0, bend = 0.07 * (0.7 + 0.6 * h);
      if (weeds) {
        float s = clamp((base - q.y) / len, 0.0, 1.0);
        float x0 = (n + 0.5) * cw + sin(q.y * 11.0 + sway) * 0.025 * s + weedKick(s) * bend * s * s;
        float w = 0.003 * (1.0 - s * 0.6), we = sqrt(w * w + b * b), dx = q.x - x0;
        float a = (w / we) * exp(-dx * dx / (we * we)) * smoothstep(top - b, top + 0.02 + b, q.y) * step(q.y, base) * 0.5;
        col = mix(col, mix(deep, vec3(0.02, 0.08, 0.05), 0.6), a);
      }
      // 草梢上面离粒子太远（雾的预渲染要算上光晕糊开的范围）就跳过
      if (!glow || q.y < top - 0.05 - b * 3.0) continue;
      float s = clamp((base - q.y) / len, 0.0, 1.0);
      float N = 11.0, gap = len / (N - 1.0);
      // 雾后面（预渲染）粒子糊成一条：按连续的一条光带算，不一颗颗算，免得光晕比间距宽时漏算出断层
      if (b > 0.012) {
        float xs = (n + 0.5) * cw + sin(q.y * 11.0 + sway) * 0.025 * s + weedKick(s) * bend * s * s, dx = q.x - xs;
        float fj = s * (N - 1.0), ja = floor(fj);
        vec3 pc = mix(mix(pick(h1(n * 3.0 + ja)), pick(h1(n * 3.0 + ja + 1.0)), fj - ja), vec3(1.0), 0.25);
        float line = 0.0;
        for (float r3 = 0.0; r3 < 3.0; r3++) {
          float r = r3 < 0.5 ? 0.0018 + 0.0018 * s : r3 < 1.5 ? (0.0018 + 0.0018 * s) * 4.0 : 0.009 + 0.008 * s;
          float wgt = r3 < 0.5 ? 1.6 : r3 < 1.5 ? 0.25 : 0.4;
          // 一颗 glowPt 沿竖直方向积分，再除以间距：一串粒子的平均亮度
          float s2 = r * r + b * b;
          line += wgt * (r * r / s2) * exp(-dx * dx / s2 * 1.6) * sqrt(3.1416 * s2 / 1.6) / gap;
        }
        float e = 0.009 + b;
        line *= smoothstep(top - e, top + e, q.y) * smoothstep(base + e, base - e, q.y);
        col += pc * line * 0.7 * (0.35 + 0.65 * s) * uNeon;
        continue;
      }
      // 清晰的画面一颗颗算：最近的一颗前后各两颗（光晕比间距宽），超出两头的不算，不会把梢上那颗算两遍
      float j0 = floor(s * (N - 1.0) + 0.5);
      for (float dj = -2.0; dj <= 2.0; dj++) {
        float j = j0 + dj, sj = j / (N - 1.0);
        if (j < 0.0 || j > N - 1.0) continue;
        float py = base - sj * len;
        vec2 pp = vec2((n + 0.5) * cw + sin(py * 11.0 + sway) * 0.025 * sj + weedKick(sj) * bend * sj * sj, py);
        float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * (2.5 + h1(n * 9.0 + j) * 3.0) + j * 1.7 + h * 30.0), 2.0);
        float pr = 0.0018 + 0.0018 * sj;
        vec3 pc = mix(pick(h1(n * 3.0 + j)), vec3(1.0), 0.25);
        // 每颗带一圈大光晕：雾后面细小的亮点糊没了，光晕糊开还是一团团彩色的光
        vec2 d = q - pp;
        col += pc * (glowPt(d, pr, b, 0.0) * 1.6 + glowPt(d, pr * 4.0, b, 0.0) * 0.25 + glowPt(d, 0.009 + 0.008 * sj, b, 0.0) * 0.4) * tw * (0.35 + 0.65 * sj) * uNeon;
      }
    }
  }
  col += jellies(q, b);
  col = aqBubbles(col, q, b, mix(lightC, vec3(1.0), 0.4));
  // 聚光灯：从水面上方打到正在写的字上
  col += lightC * spotBeam(q, b) * 0.8;
  return col;
}
`,io=`${Xe}// 路灯和招牌（倒影也用它）
vec3 lampsSigns(vec2 q, float b, float t) {
  vec3 c = vec3(0.0);
  // 招牌、店面：近，移动快，带横向拖影
  float xs = q.x + t * 0.42, cw = 0.34, streak = 0.012 * uBus;
  float cs = floor(xs / cw);
  // 招牌的灯在 0.46–0.56 高、店面在 0.645（倒影调用时 q、b 不一样，各自判断）
  bool sg = abs(q.y - 0.51) < 0.05 + reach(0.016, b + 0.002), sh = abs(q.y - 0.645) < reach(0.026, b + 0.003);
  if (sg || sh) for (float k = -1.0; k <= 1.0; k++) {
    float n = cs + k;
    // 招牌、店面的灯：都画成圆的散景光斑（远处的灯失焦后是圆的），不画方块
    if (sg) {
      vec2 cen = vec2((n + 0.2 + 0.6 * h1(n)) * cw, 0.46 + 0.1 * h1(n + 17.0));
      if (h1(n + 33.0) < 0.75) c += pick(h1(n + 2.0)) * glowPt(vec2(xs, q.y) - cen, 0.006 + 0.01 * h1(n + 5.0), b + 0.002, streak) * 1.6;
    }
    // 店面：底层一两团暖光
    vec2 shop = vec2((n + 0.5) * cw, 0.645);
    if (sh && h1(n + 41.0) < 0.6) c += mix(SODIUM, pick(h1(n + 8.0)), 0.3) * glowPt(vec2(xs, q.y) - shop, 0.016 + 0.01 * h1(n + 3.0), b + 0.003, streak) * 0.9;
  }
  // 路灯：中景，灯头 + 雨里的大光晕（0.36 高，光晕半径 0.07）
  float xl = q.x + t * 0.22, lw = 0.55;
  float cl = floor(xl / lw);
  if (abs(q.y - 0.36) < reach(0.07, b)) for (float k = -1.0; k <= 1.0; k++) {
    vec2 d = vec2(xl - (cl + k + 0.5) * lw, q.y - 0.36);
    c += SODIUM * (glowPt(d, 0.007, b, 0.004 * uBus) * 2.6 + glowPt(d, 0.07, b, 0.0) * 0.3);
  }
  return c;
}
// 一层楼群（layer 0 = 远，1 = 近）。返回 rgb = 颜色，a = 覆盖度。
// 每格一栋：宽度、高度随机，一半带收分的顶层，少数顶上有天线；立面下亮上暗（被街灯照）、一侧有一道边光；
// 窗是小格子，每栋亮灯比例不同，有的整层全黑，亮着的窗分暖白、冷白和主题色，亮度不一。
vec4 building(vec2 q, float b, float t, float layer) {
  float near = layer;
  float x = q.x + t * mix(0.02, 0.035, near) + layer * 7.7;
  float cw = mix(0.065, 0.12, near), aa = max(b, 0.0012);
  float c0 = floor(x / cw);
  vec4 res = vec4(0.0);
  // 每栋楼（连收分顶层、天线）都落在自己那一格里，左右邻居只在离格边不到模糊半径（再加天线宽）时才碰得到这个像素：
  // 离得更远时邻居的覆盖度必然是 0，跳过，画面不变。清晰窗外模糊半径很小，大部分像素只用算本格一栋
  float fx = x - c0 * cw, nbReach = aa + 0.0013;
  for (float k = -1.0; k <= 1.0; k++) {
    if ((k < 0.0 && fx > nbReach) || (k > 0.0 && cw - fx > nbReach)) continue;
    float n = c0 + k + layer * 100.0;
    float w = cw * (0.72 + 0.26 * h1(n));
    float left = (c0 + k) * cw + (cw - w) * h1(n + 1.0);
    float lx = x - left;
    float hgt = mix(0.07, 0.11, near) + mix(0.16, 0.27, near) * pow(h1(n + 2.0), 1.5);
    float base = HZ + near * 0.015;
    float top = base - hgt;
    // 收分的顶层
    bool tier = h1(n + 3.0) < 0.5;
    float tw = w * (0.5 + 0.25 * h1(n + 4.0)), tl = (w - tw) * 0.5, th = hgt * (0.12 + 0.15 * h1(n + 5.0));
    float body = smoothstep(-aa, aa, lx) * smoothstep(-aa, aa, w - lx) * smoothstep(-aa, aa, q.y - top);
    float up = tier ? smoothstep(-aa, aa, lx - tl) * smoothstep(-aa, aa, tl + tw - lx) * smoothstep(-aa, aa, q.y - (top - th)) : 0.0;
    float roof = tier ? top - th : top;
    // 天线
    float ant = h1(n + 6.0) < 0.3 ? smoothstep(0.0012 + aa, 0.0, abs(lx - w * 0.5)) * smoothstep(-aa, aa, q.y - (roof - 0.04 - 0.03 * h1(n + 7.0))) : 0.0;
    float cov = max(max(body, up), ant);
    if (cov <= 0.0) continue;
    // 立面：暗色，按楼略有差别；越往下越被街面的灯照亮；左侧一道细边光
    vec3 fac = mix(uSky0, vec3(0.015, 0.018, 0.025), 0.55) * (0.7 + 0.6 * h1(n + 8.0));
    float lowLit = pow(clamp((q.y - roof) / (base - roof), 0.0, 1.0), 2.5);
    fac += mix(SODIUM, uLa, 0.5) * 0.1 * lowLit;
    fac += mix(uSky1, uLb, 0.3) * 0.12 * smoothstep(0.003 + aa, 0.0, lx) * body;
    // 窗格
    float fh = mix(0.0075, 0.012, near), wc = mix(0.0055, 0.0085, near);
    vec2 g = vec2((lx - wc * 0.6) / wc, (q.y - roof - fh * 0.8) / fh);
    vec2 id = floor(g), f = fract(g);
    float dens = 0.15 + 0.5 * h1(n + 9.0);
    float floorOn = step(0.18, hash(vec2(id.y, n)));
    float on = step(hash(id + n * 3.7), dens) * floorOn;
    // 窗区边界跟着模糊半径变软，糊开时不出硬边
    float inside = smoothstep(-aa, aa, lx - wc * 0.6) * smoothstep(-aa, aa, w - wc * 0.6 - lx) * smoothstep(-aa, aa, q.y - roof - fh * 0.8) * smoothstep(-aa, aa, base - fh - q.y);
    float pane = smoothstep(0.32, 0.22, abs(f.x - 0.5)) * smoothstep(0.3, 0.2, abs(f.y - 0.5));
    // 被雾糊开时窗格变成平均亮度，不闪
    float blurMix = clamp(b / (wc * 0.8), 0.0, 1.0);
    float win = mix(pane * on, 0.3 * dens * 0.82, blurMix) * inside * max(body, up);
    float hc = hash(id + n * 1.3);
    vec3 wcol = hc < 0.5 ? vec3(1.0, 0.78, 0.5) : (hc < 0.8 ? vec3(0.78, 0.88, 1.0) : pick(hash(id + 5.0)));
    // 糊开时每格的颜色、亮度也换成平均值，否则会出现马赛克
    wcol = mix(wcol * (0.55 + 0.6 * hash(id + 2.9)), vec3(0.95, 0.82, 0.66) * 0.85, blurMix);
    vec3 bc = fac + wcol * win * mix(0.7, 1.0, near);
    // 远层被大气冲淡，往天色靠
    bc = mix(bc, mix(uSky0, uSky1, 0.7), mix(0.45, 0.12, near));
    res = vec4(mix(res.rgb, bc, cov), max(res.a, cov));
  }
  return res;
}
// 从楼群缓存取一层（预乘颜色）：横向按这层的速度（building 里的 0.02、0.035）平移，环形取样
vec4 bldAt(sampler2D s, vec2 q, float t, float speed, vec3 g) {
  // 没有 mipmap；在分支里取样，用 textureLod 不依赖导数
  return textureLod(s, vec2((q.x + t * speed) / g.z, (q.y - g.x) / (g.y - g.x)), 0.0);
}
// 主题色霓虹（照雨湖的远处灯光）：楼群之间密密的彩色小散景，偶尔一大团霓虹带一圈很大的光晕。
// 颜色取这首歌的三个灯光色；移动速度介于楼群和路灯之间。倒影也用它。
vec3 neonLights(vec2 q, float b, float t) {
  vec3 c = vec3(0.0);
  float bb = b + 0.003;   // 散景本身就是虚的
  // 小散景：两排格子，每格最多一颗，落在楼群那一段高度里（0.38–0.58）
  if (abs(q.y - (HZ - 0.12)) < 0.1 + reach(0.012, bb)) for (float row = 0.0; row < 2.0; row++) {
    float x = q.x + t * (0.06 + row * 0.03) + row * 7.3, cw = 0.045 - row * 0.012;
    float c0 = floor(x / cw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = c0 + k + row * 300.0;
      if (h1(n + 11.0) > 0.85) continue;
      vec2 cen = vec2((c0 + k + 0.15 + 0.7 * h1(n)) * cw, HZ - 0.02 - 0.2 * pow(h1(n + 3.0), 1.6));
      float r = 0.004 + 0.008 * pow(h1(n + 6.0), 3.0);
      c += pick(h1(n + 9.0)) * glowPt(vec2(x, q.y) - cen, r, bb, 0.0) * (1.0 + 1.8 * h1(n + 13.0));
    }
  }
  // 大霓虹：稀疏，一个亮核 + 一圈很大的同色光晕（雨湖左边那盏洋红灯）
  float xb = q.x + t * 0.1, bw = 0.75, cb = floor(xb / bw);
  if (abs(q.y - (HZ - 0.14)) < 0.06 + reach(0.13, b)) for (float k = -1.0; k <= 1.0; k++) {
    float n = cb + k + 500.0;
    vec2 d = vec2(xb - (cb + k + 0.2 + 0.6 * h1(n)) * bw, q.y - (HZ - 0.08 - 0.12 * h1(n + 2.0)));
    vec3 lc = pick(h1(n + 4.0));
    c += lc * (glowPt(d, 0.014, bb, 0.0) * 2.0 + glowPt(d, 0.13, b, 0.0) * 0.4);
  }
  return c;
}
${Ve}
// 公交车侧窗外的雨夜街景：远处楼群慢、路灯中速、招牌和车灯快
vec3 scene(vec2 q, float b) {
  float t = uTime * uBus;
  vec3 col = mix(uSky0, uSky1, smoothstep(0.0, HZ, q.y));
  col += mix(uLa, SODIUM, 0.4) * 0.14 * exp(-abs(q.y - HZ + 0.12) * 6.0);
  // 楼群：远近两层，远层矮、淡、窗小；近层高、细节多
  float aa = max(b, 0.0015), c0;
  // 楼群走缓存（nebbiaBuildingCache.ts）。水珠透镜（b = 0.006）折射得远，会取到缓存范围外面，照旧现算（只占几颗水珠的面积）；
  // 缓存还没画好的那档也现算
  bool bldOn = sceneryOn(SCN_BUILDINGS);
  bool cached = b < 0.002 ? uBldOn.x : (b > 0.05 ? uBldOn.z : (b > 0.02 ? uBldOn.y : false));
  if (bldOn && cached) {
    vec4 bf, bn;
    if (b > 0.05) { bf = bldAt(uBld4, q, t, 0.02, uBldGeo[2]); bn = bldAt(uBld5, q, t, 0.035, uBldGeo[2]); }
    else if (b > 0.02) { bf = bldAt(uBld2, q, t, 0.02, uBldGeo[1]); bn = bldAt(uBld3, q, t, 0.035, uBldGeo[1]); }
    else { bf = bldAt(uBld0, q, t, 0.02, uBldGeo[0]); bn = bldAt(uBld1, q, t, 0.035, uBldGeo[0]); }
    col = col * (1.0 - bf.a) + bf.rgb;
    col = col * (1.0 - bn.a) + bn.rgb;
  } else if (bldOn) {
    vec4 bf = building(q, b, t, 0.0);
    col = mix(col, bf.rgb, bf.a);
    vec4 bn = building(q, b, t, 1.0);
    col = mix(col, bn.rgb, bn.a);
  }
  // 主题色霓虹压在楼群前面；天边再铺一层很宽的主题色辉光
  bool lightsOn = sceneryOn(SCN_LIGHTS);
  if (lightsOn) {
    col += (neonLights(q, b, t) + uLa * 0.12 * exp(-abs(q.y - HZ + 0.1) * 5.0)) * uNeon;
    col += lampsSigns(q, b, t);
  }
  // 湿路面和倒影（路面关掉时车灯也没有倒影）
  float road = sceneryOn(SCN_ROAD) ? smoothstep(ROAD - aa, ROAD + aa, q.y) : 0.0;
  col = mix(col, uSky0 * 0.5, road * 0.85);
  // 倒影都乘 road，路面以上恰好是 0：直接跳过，画面不变，省掉屏上大半像素的两整套招牌、霓虹计算
  if (road > 0.0 && lightsOn) {
    vec2 qr = vec2(q.x, ROAD - (q.y - ROAD) * 0.55);
    col += lampsSigns(qr, b + 0.012, t) * road * 0.35;
    // 霓虹倒影：纵向压得更扁，所以在湿路面上拉成竖直的光柱（雨湖的倒影做法）
    vec2 qn = vec2(q.x, HZ - (q.y - ROAD) * 0.22);
    col += neonLights(qn, b + 0.008, t) * road * 0.45 * uNeon;
  }
  // 车灯：同向车道尾灯（红），对向车道前灯（白），快速掠过拖出长影
  if (sceneryOn(SCN_CARS)) for (float lane = 0.0; lane < 2.0; lane++) {
    float sp = lane < 0.5 ? 0.55 : -1.1, ly = lane < 0.5 ? 0.76 : 0.83, ww = 0.9;
    float xc = q.x + t * sp, cc = floor(xc / ww);
    vec3 lc = lane < 0.5 ? vec3(1.0, 0.18, 0.12) : vec3(1.0, 0.95, 0.85);
    // 车灯和它在路面上的倒影纵向都照不到这一行（倒影乘 road，路面以上本来就是 0）就跳过这条车道
    bool hd = abs(q.y - ly) < reach(0.004, b), rf = road > 0.0 && abs((q.y - ly) * 3.0 - 0.03) < reach(0.02, b * 2.0);
    if (!hd && !rf) continue;
    for (float k = -1.0; k <= 1.0; k++) {
      float n = cc + k + lane * 50.0;
      if (h1(n) > 0.6) continue;
      float cx = (cc + k + 0.2 + 0.6 * h1(n + 4.0)) * ww;
      float st = abs(sp) * 0.03 * uBus;
      if (hd) {
        c0 = glowPt(vec2(xc - cx + 0.035, q.y - ly), 0.004, b, st) + glowPt(vec2(xc - cx - 0.035, q.y - ly), 0.004, b, st);
        col += lc * c0 * 2.2;
      }
      if (rf) col += lc * glowPt(vec2(xc - cx, (q.y - ly) * 3.0 - 0.03), 0.02, b * 2.0, st) * road * 0.3;
    }
  }
  // 窗外的雨：相对车身的速度 = 往下落 + 往后（车往右开，窗外往左走），车越快越斜；停站时竖直落。
  // 雨丝只在聚光灯光柱里画（被照亮的那些）。设置里可以让它总是竖直落，或者不下（只剩光柱）
  float beam = spotBeam(q, b);
  if (!sceneryOn(SCN_RAIN)) return col + uLa * beam;
  vec2 rd = normalize(vec2(sceneryOn(SCN_RAIN_SLANT) ? -WIND * uBus : 0.0, 1.0));
  vec2 r = vec2(dot(q, rd), dot(q, vec2(-rd.y, rd.x)));
  float colId = floor(r.y / 0.007), hr = h1(colId);
  float seg = fract(r.x * (1.5 + hr) - uTime * (2.5 + hr * 2.0) * (1.0 + 0.4 * uBus) + hr * 10.0);
  float line = smoothstep(0.0012 + b, 0.0, abs(fract(r.y / 0.007) - 0.5) * 0.007) * smoothstep(0.0, 0.1, seg) * smoothstep(0.3, 0.1, seg);
  // 聚光灯：光柱叠在最前面；光柱里的雨丝被照亮
  col += uLa * beam + mix(uLa, vec3(1.0), 0.5) * line * beam * 1.6 * step(0.3, hr) * (1.0 - clamp(b * 40.0, 0.0, 1.0));
  return col;
}
`,ao=`#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPos, 0.0, 1.0); }`,We=i=>`precision highp float;
uniform vec2 uRes, uSceneShift; uniform float uTime, uBus, uNeon;
uniform vec3 uSky0, uSky1, uLa, uLb, uLc;
// 聚光灯：光源（远处楼底）、照到玻璃上的点、光斑半径，都在 scene 坐标；uSpotI 强度
uniform vec2 uSpotSrc, uSpotSrc2, uSpotTgt; uniform float uSpotR, uSpotI;
// 窗外画哪几样（位见 nebbiaSceneGlsl.ts 的 SCN_*）
uniform int uScenery;
// 楼群缓存（nebbiaBuildingCache.ts）：三档模糊 × 远近两层，预乘颜色；uBldOn 每档画好了没有，uBldGeo 每档 (y0, y1, 横向周期)
uniform bvec3 uBldOn; uniform sampler2D uBld0, uBld1, uBld2, uBld3, uBld4, uBld5; uniform vec3 uBldGeo[3];
in vec2 vUv; layout(location = 0) out vec4 outColor;
${i}`,St=We(io),Qt=We(no),$e=i=>`#version 300 es
${i}
uniform float uFogB;
void main() {
  vec2 s0 = vUv + uSceneShift, q0 = vec2(s0.x * uRes.x / uRes.y, s0.y);
  outColor = vec4(scene(q0, uFogB), 1.0);
}`,Te=$e(St),ro=`#version 300 es
${St}
uniform float uFillB, uFillLayer, uFillX0; uniform vec3 uFillGeo; uniform vec2 uFillSize;
void main() {
  float span = uFillGeo.z;
  float xw = uFillX0 + fract((gl_FragCoord.x / uFillSize.x * span - uFillX0) / span) * span;
  vec4 r = building(vec2(xw, mix(uFillGeo.x, uFillGeo.y, gl_FragCoord.y / uFillSize.y)), uFillB, 0.0, uFillLayer);
  outColor = vec4(r.rgb * r.a, r.a);
}`,Ye=`
vec3 staticNoise(vec2 px) { return vec3(vnoise(px / 6.0) * 0.6 + vnoise(px / 2.2) * 0.4, vnoise(px / 55.0 + 3.1), vnoise(px / 1.6)); }`,lo=`#version 300 es
${St}
${Ye}
void main() { outColor = vec4(staticNoise(gl_FragCoord.xy), 1.0); }`,vt=(i,t=St,e=!1)=>`#version 300 es
#define NEBBIA_FOG_TEX ${i?1:0}
${e?`#define NEBBIA_DEW 1
`:""}${t}
uniform sampler2D uMask, uDrop, uField;
#ifdef NEBBIA_DEW
// 凝露玻璃上冷凝水珠的高光（tuning.dewGlint）；细水珠折射的窗外（nebbiaFogGl.ts 预渲染的清晰的那层）
uniform float uDewGlint;
uniform sampler2D uFogSharp;
#endif
// 哈气的白气遮罩（R 形状、G 浓度，nebbiaBreath.ts）；屏上没有哈气时 uBreathOn 为假，不采样
uniform sampler2D uBreath; uniform bool uBreathOn; uniform float uBreathThick;
uniform vec2 uGlassShift; uniform float uMist, uEdge, uRefract, uGlint;
// 预渲染好的两层雾（NEBBIA_FOG_TEX 为 0 时主画面自己算：不支持浮点渲染目标时）
uniform sampler2D uFogBlur, uFogGlow;
// 静态噪声纹理（nebbiaNoiseTex.ts）：按 px 取样；uNoiseOn 为假（还没算好、画布超过纹理尺寸上限）时现算
uniform bool uNoiseOn; uniform sampler2D uNoise;
// 透明（窗外是共用背景或桌面）：不画窗外，输出预乘的透明度。雾是一层半透明的雾，擦开的地方全透明，
// 光（聚光灯、擦痕边、水珠高光）只加颜色不加不透明度，叠在后面的东西上。雾的颜色跟主题日夜：日间乳白、夜间深色
uniform bool uSeeThrough; uniform vec3 uMistTint;
${Ye}
void main() {
  // 颠簸：玻璃上的东西（雾、擦痕、水珠）跟车身一起晃，窗外晃得更多
  vec2 gv = vUv + uGlassShift, sv = vUv + uSceneShift;
  vec2 px = gv * uRes;
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2(sv.x * aspect, sv.y);
  float m = texture(uMask, gv).r;
  // 擦痕边缘：细噪声让边缘毛糙，大块噪声让重新起雾时一片片回来
  vec3 nz = uNoiseOn ? texture(uNoise, px / uRes).rgb : staticNoise(px);
  float fine = nz.r, blotch = nz.g;
  float th = 0.3 + (fine - 0.5) * 0.22 * uEdge + (blotch - 0.5) * 0.12;
  float clear = smoothstep(th - 0.05, th + 0.06, m);
  // 哈气：就是这一片的雾一下变密（更细密的一层水汽凝上来），不是另盖一层。边由大块噪声揉散成一卷卷的、
  // 细噪声让它发毛，散的时候从薄的地方先透。在白气上写的字照样擦开，水珠周围照样抹开一圈
  float breath = 0.0;
  if (uBreathOn) {
    vec2 bm = texture(uBreath, gv).rg;
    if (bm.r > 0.003) {
      // 值噪声直接取阈值会露出横平竖直的格子：每层转一个角度、叠三层，边缘才是一卷卷的
      vec2 r1 = mat2(0.80, -0.60, 0.60, 0.80) * px, r2 = mat2(0.36, 0.93, -0.93, 0.36) * px;
      float bn = vnoise(r1 / 34.0 + 7.0) * 0.55 + vnoise(r2 / 15.0 + 2.3) * 0.3 + vnoise(px / 6.5) * 0.15;
      float bth = 0.3 + (bn - 0.5) * 0.5;
      breath = smoothstep(bth - 0.2, bth + 0.25, bm.r) * bm.g * uBreathThick;
    }
  }
  // 雾：模糊的窗外提亮发灰，光晕散得更开，加浓淡起伏和细颗粒，下半部分略浓
  float dens = uMist * (0.82 + 0.3 * vnoise(px / 380.0 + uTime * 0.015)) * (0.9 + 0.2 * vUv.y) + breath * 0.9;
  vec3 haze = vec3(0.70, 0.74, 0.78);
  vec3 blur = vec3(0.0), glow = vec3(0.0);
  if (!uSeeThrough) {
#if NEBBIA_FOG_TEX
  // 预渲染纹理的第 0 行是 vUv.y = 1（屏幕底部），所以纵向翻一下
  vec2 fu = vec2(vUv.x, 1.0 - vUv.y);
  blur = texture(uFogBlur, fu).rgb;
  glow = texture(uFogGlow, fu).rgb;
#else
  blur = scene(q, 0.03);
  glow = scene(q, 0.09);
#endif
  }
  // 密到普通雾的范围以上（哈气）时，窗外再暗一点、乳白再多一点
  vec3 fog = blur * max(0.08, 1.0 - 0.45 * dens - 0.25 * breath) + glow * 0.9 * dens + haze * (0.2 * dens + 0.25 * breath);
  // 透明时雾的浓淡就是不透明度，颜色是 uMistTint
  float alpha = 1.0;
  if (uSeeThrough) {
    // 深色的雾叠在暗桌面上不显，比白雾浓一点
    alpha = clamp((0.62 * dens + 0.3 * breath) * mix(1.3, 1.0, dot(uMistTint, vec3(0.333))), 0.0, 0.92);
    fog = uMistTint * alpha;
  }
  // 透明时颗粒乘不透明度：雾很淡的地方不在后面的东西上撒亮点
  fog += (hash(px) - 0.5) * 0.025 * alpha;
  // 聚光灯照到玻璃上：雾里的小水滴把光散开，字周围一圈雾被照成强调色
  vec2 sd = q - uSpotTgt;
  fog += uLa * uSpotI * exp(-dot(sd, sd) / (uSpotR * uSpotR * 2.2)) * (0.18 + 0.4 * dens);
  fog += smoothstep(0.78, 0.98, nz.b) * 0.05 * dens;
  // 水珠纹理：擦痕边 / 下淌的水珠 rd，雾上的凝结水珠 fd（擦开的地方没有）
  vec4 rd = texture(uDrop, gv);
  vec4 fd = texture(uField, gv) * (1.0 - clear);
  // 和 raindrop-fx 一样，水珠周围一圈的雾也被抹掉
  clear = max(clear, smoothstep(0.93, 1.0, rd.a));
  vec3 col = fog;
  if (clear > 0.001) {
    // 擦开的地方：清晰的窗外，留一层很薄的水膜
    vec3 wiped = (uSeeThrough ? vec3(0.0) : scene(q, 0.0012) * 1.05) + haze * 0.02 * dens;
    float rim = clear * (1.0 - clear) * 4.0;
    col = mix(fog, wiped, clear) + rim * haze * 0.16 * dens;
    if (uSeeThrough) alpha = mix(alpha, 0.02 * dens, clear) + rim * 0.16 * dens;
  }
  // 合成方式照搬 raindrop-fx 的 compose.glsl：阈值成形、按法线折射清晰的窗外、按光照明暗
  vec4 comp = vec4(rd.rgb + fd.rgb - 2.0 * rd.rgb * fd.rgb, max(rd.a, fd.a));
  float dmask = smoothstep(0.96, 0.99, comp.a);
  if (dmask > 0.001) {
    vec2 nn = comp.rg - 0.5;
    vec2 ruv = sv + vec2(-nn.x, nn.y) * (comp.b * 0.6 + 0.4) * uRefract;
    // 雾笺 demo 用的是轻度模糊的背景、漫反射 0.2–0.5、高光指数 48
    vec3 lens;
#if defined(NEBBIA_DEW) && NEBBIA_FOG_TEX
    // 凝露的细水珠又密又小，每个像素重算一遍窗外太贵：读预渲染好的同样模糊（0.006）的窗外，低分辨率下放大看不出差别。
    // 擦痕边的水珠（rd 占上风）照旧现算
    if (!uSeeThrough && fd.a > rd.a) lens = texture(uFogSharp, vec2(ruv.x - uSceneShift.x, 1.0 - ruv.y + uSceneShift.y)).rgb;
    else
#endif
    lens = scene(vec2(ruv.x * aspect, ruv.y), 0.006);
    vec3 normal = normalize(vec3(nn * 2.0, 1.0));
    vec3 lightDir = normalize(vec3(-1.0, 1.0, 2.0));
    float lambert = clamp(dot(lightDir, normal), 0.0, 1.0);
    float spec = pow(max(dot(normal, normalize(lightDir + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
    lens += (lambert - 0.8) * vec3(0.3, 0.3, 0.32) + spec * vec3(0.3, 0.3, 0.33) * uGlint;
    if (uSeeThrough) {
      // 和 raindrop-fx 一样，水珠是一颗透镜，里面是折射过来的背景。透明时拿不到窗后面的画面，折射的还是雾笺自己的
      // 雨夜街景（和街景模式的水珠一样）。白雾时水珠不透明：街景比雾暗，和透出后面的字一样是暗的；
      // 深色雾时字透出的后面比雾亮，水珠也要以透出后面为主：街景留一半不到，边上一圈折射的暗边
      float dark = 1.0 - dot(uMistTint, vec3(0.333));
      float rimA = (1.0 - smoothstep(0.975, 0.995, comp.a)) * 0.21;
      float da = mix(1.0, 0.47 + rimA, dark);
      lens = max(lens, vec3(0.0)) * mix(1.0, 0.47, dark);
      alpha = mix(alpha, da, dmask);
    } else {
      // 车厢里的灯照在水珠表面：比纯透过去的窗外亮一点，不会在灰白的雾上显成黑点
      lens = max(lens, fog * 0.55) + haze * 0.08 * dens;
#ifdef NEBBIA_DEW
      // 凝露玻璃上的细小冷凝水珠（nebbiaCondensation.ts）：后面暗（水族箱的水、夜里的街）时照常画会像一粒粒脏点；
      // 按挂在玻璃上的水珠画，比雾亮一点、带一点高光。擦痕边的水珠（rd 占上风的地方）照旧
      float fine = step(rd.a, fd.a);
      lens = mix(lens, max(lens * 1.15, fog * (1.0 + 0.051 * uDewGlint)) + (spec * 0.544 + lambert * 0.068) * dens * uDewGlint, fine);
#endif
    }
    col = mix(col, lens, dmask);
  }
  outColor = uSeeThrough ? vec4(max(col, 0.0), alpha) : vec4(col, 1.0);
}`,co=vt(!0),ho=vt(!1),fo=(i,t="rain")=>{const e=t==="dew";return i==="aquarium"?{fog:$e(Qt),main:vt(!0,Qt,e),mainFallback:vt(!1,Qt,e)}:e?{fog:Te,main:vt(!0,St,!0),mainFallback:vt(!1,St,!0)}:{fog:Te,main:co,mainFallback:ho}},uo=`#version 300 es
in vec2 aCorner; in vec4 aRect; in vec2 aParam;
uniform vec2 uView;
out vec2 vUV; out float vSize; out float vAlpha;
void main() {
  vec2 p = aRect.xy + (aCorner - 0.5) * aRect.zw;
  vUV = aCorner; vSize = aParam.x; vAlpha = aParam.y;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, p.y / uView.y * 2.0 - 1.0, 0.0, 1.0);
}`,mo=`#version 300 es
precision mediump float;
uniform sampler2D uSprite;
in vec2 vUV; in float vSize; in float vAlpha; out vec4 o;
void main() {
  vec4 c = texture(uSprite, vUV);
  c.a *= vAlpha;
  o = vec4(c.rg * c.a, vSize * c.a, c.a);
}`,bo=i=>{if(!i.getExtension("EXT_color_buffer_float"))return!1;const t=i.createTexture(),e=i.createFramebuffer();i.bindTexture(i.TEXTURE_2D,t),i.texImage2D(i.TEXTURE_2D,0,i.RGBA16F,1,1,0,i.RGBA,i.HALF_FLOAT,null),i.bindFramebuffer(i.FRAMEBUFFER,e),i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,t,0);const s=i.checkFramebufferStatus(i.FRAMEBUFFER)===i.FRAMEBUFFER_COMPLETE;return i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindTexture(i.TEXTURE_2D,null),i.deleteFramebuffer(e),i.deleteTexture(t),s||console.warn("[Nebbia] fog prepass framebuffer incomplete, computing the fog in the main pass"),s};class po{constructor(t,e,s="night",n="rain"){this.gl=t,this.parallel=t.getExtension("KHR_parallel_shader_compile");const o=Ct(t,t.VERTEX_SHADER,ao),a=r=>Ct(t,t.FRAGMENT_SHADER,r),l=fo(s,n);this.programs={fog:e?bt(t,o,a(l.fog),{aPos:0}):null,main:bt(t,o,a(e?l.main:l.mainFallback),{aPos:0}),sprite:bt(t,Ct(t,t.VERTEX_SHADER,uo),a(mo),{aCorner:0,aRect:1,aParam:2}),mask:bt(t,Ct(t,t.VERTEX_SHADER,Qs),a(to),{aCorner:0,aSeg:1,aParam:2}),bldFill:s==="night"?bt(t,o,a(ro),{aPos:0}):null,noise:bt(t,o,a(lo),{aPos:0})}}gl;programs;parallel;done=!1;poll(){if(this.done)return!0;const{gl:t,parallel:e}=this,s=[this.programs.fog,this.programs.main,this.programs.sprite,this.programs.mask,this.programs.bldFill,this.programs.noise].filter(n=>!!n);if(e&&!s.every(n=>t.getProgramParameter(n,e.COMPLETION_STATUS_KHR)))return!1;for(const n of s)js(t,n);for(const n of s)for(const o of t.getAttachedShaders(n)??[])t.deleteShader(o);return this.done=!0,!0}}const Ke=["uSky0","uSky1","uLa","uLb","uLc"],Je=["uRes","uSceneShift","uTime","uBus","uNeon",...Ke,"uSpotSrc","uSpotSrc2","uSpotTgt","uSpotR","uSpotI","uScenery","uBldOn","uBldGeo","uJelly","uJellyC","uJellyN","uBubbles","uSway","uBurst","uBurstN","uBeatRows"],xo=[...Je,"uDewGlint","uMist","uEdge","uRefract","uGlint","uGlassShift","uBreathOn","uBreathThick","uNoiseOn","uSeeThrough","uMistTint"],yo=1,go={on:[0,0,0],geo:[0,1,1,0,1,1,0,1,1]},te=(i,t,e)=>Object.fromEntries(e.map(s=>[s,i.getUniformLocation(t,s)]));class vo{constructor(t,e=!1,s="night",n="rain"){this.canvas=t,this.seeThrough=e;const o=t.getContext("webgl2",{antialias:!1,alpha:e,preserveDrawingBuffer:!1});if(!o)throw new Error("Nebbia: WebGL2 unavailable");this.gl=o,this.fogOK=bo(o),this.build=new po(o,this.fogOK,s,n),this.quadVao=o.createVertexArray(),o.bindVertexArray(this.quadVao),o.bindBuffer(o.ARRAY_BUFFER,o.createBuffer()),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),o.STATIC_DRAW),o.enableVertexAttribArray(0),o.vertexAttribPointer(0,2,o.FLOAT,!1,0,0),this.mask=new eo(o,2),this.drop=at(o,3),this.field=at(o,4),this.sprite=at(o,5),this.fogGl=new Ks(o,6,this.fogOK,n==="dew"&&!e?1:null),this.breath=at(o,8),this.bld=s==="night"?new $s(o,9):null,this.noise=new Js(o,15),this.spriteVao=o.createVertexArray(),o.bindVertexArray(this.spriteVao),o.bindBuffer(o.ARRAY_BUFFER,o.createBuffer()),o.bufferData(o.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),o.STATIC_DRAW),o.enableVertexAttribArray(0),o.vertexAttribPointer(0,2,o.FLOAT,!1,0,0),this.instBuf=o.createBuffer(),o.bindBuffer(o.ARRAY_BUFFER,this.instBuf),o.enableVertexAttribArray(1),o.vertexAttribPointer(1,4,o.FLOAT,!1,24,0),o.vertexAttribDivisor(1,1),o.enableVertexAttribArray(2),o.vertexAttribPointer(2,2,o.FLOAT,!1,24,16),o.vertexAttribDivisor(2,1),o.bindVertexArray(null),this.loadSprite()}canvas;seeThrough;gl;build;quadVao;spriteVao;instBuf;U={};F={};B={};bld;uView=null;uFogB=null;linked=!1;mask;drop;field;sprite;breath;fogGl;fogOK;noise;W=1;H=1;spriteReady=!1;fieldValid=!1;instData=new Float32Array(0);palette=null;mistTint=[.07,.08,.1];onSpriteReady=null;get isContextLost(){return this.gl.isContextLost()}get ready(){if(this.linked)return!0;if(!this.build.poll())return!1;const{gl:t}=this,{main:e,fog:s,sprite:n,mask:o,bldFill:a}=this.build.programs;this.mask.attach(o),this.U=te(t,e,xo),t.useProgram(e);const[l,r,h]=this.fogGl.layers,c=[["uMask",this.mask.tex],["uDrop",this.drop],["uField",this.field],["uFogBlur",l.tex],["uFogGlow",r.tex],["uBreath",this.breath],["uNoise",this.noise.tex]];h&&c.push(["uFogSharp",h.tex]);for(const[f,u]of c)t.uniform1i(t.getUniformLocation(e,f),u.unit);return t.uniform1f(this.U.uBreathThick,q.breathThick),t.uniform1i(this.U.uSeeThrough,this.seeThrough?1:0),this.bld?.bindSamplers(e),s&&(this.F=te(t,s,Je),this.uFogB=t.getUniformLocation(s,"uFogB"),this.bld?.bindSamplers(s)),a&&(this.B=te(t,a,[...Ke,...Ws])),t.useProgram(n),this.uView=t.getUniformLocation(n,"uView"),t.uniform1i(t.getUniformLocation(n,"uSprite"),this.sprite.unit),this.linked=!0,this.palette&&this.applyPalette(this.palette),!0}loadSprite(){const t=new Image;t.onload=()=>{const{gl:e}=this;e.isContextLost()||(e.activeTexture(e.TEXTURE0+this.sprite.unit),e.bindTexture(e.TEXTURE_2D,this.sprite.t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),e.generateMipmap(e.TEXTURE_2D),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),this.spriteReady=!0,this.onSpriteReady?.())},t.src=Hs}setPalette(t,e,s,n,o){this.palette=[t,e,s,n,o],this.linked&&this.applyPalette(this.palette)}applyPalette([t,e,s,n,o]){const{gl:a}=this,{main:l,fog:r,bldFill:h}=this.build.programs;for(const[c,f]of[[l,this.U],[r,this.F],[h,this.B]])c&&(a.useProgram(c),a.uniform3fv(f.uSky0,t),a.uniform3fv(f.uSky1,e),a.uniform3fv(f.uLa,s),a.uniform3fv(f.uLb,n),a.uniform3fv(f.uLc,o));this.bld?.invalidate()}resize(t,e,s){const{gl:n}=this;this.W=Math.max(1,Math.round(t)),this.H=Math.max(1,Math.round(e)),this.canvas.width=Math.max(1,Math.round(t*s)),this.canvas.height=Math.max(1,Math.round(e*s)),this.mask.resize(t,e),this.fieldValid=!1;for(const o of[this.drop,this.field])n.activeTexture(n.TEXTURE0+o.unit),n.bindTexture(n.TEXTURE_2D,o.t),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,this.W,this.H,0,n.RGBA,n.UNSIGNED_BYTE,null),o.fb||(o.fb=n.createFramebuffer()),n.bindFramebuffer(n.FRAMEBUFFER,o.fb),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,o.t,0);n.bindFramebuffer(n.FRAMEBUFFER,null),this.fogGl.resize(this.canvas.width,this.canvas.height),this.noise.resize(this.canvas.width,this.canvas.height),this.bld?.resize(this.canvas.width,this.canvas.height,Math.max(1,Math.ceil(this.canvas.height/me)))}renderDrops(t,e){const{gl:s}=this;if(s.bindFramebuffer(s.FRAMEBUFFER,t.fb),s.viewport(0,0,this.W,this.H),s.clearColor(0,0,0,0),s.clear(s.COLOR_BUFFER_BIT),e.length&&this.spriteReady){let n;e instanceof Float32Array?n=e:(this.instData.length<e.length&&(this.instData=new Float32Array(Math.ceil(e.length*1.5))),this.instData.set(e),n=this.instData.subarray(0,e.length)),s.useProgram(this.build.programs.sprite),s.bindVertexArray(this.spriteVao),s.bindBuffer(s.ARRAY_BUFFER,this.instBuf),s.bufferData(s.ARRAY_BUFFER,n,s.DYNAMIC_DRAW),s.uniform2f(this.uView,this.W,this.H),s.enable(s.BLEND),s.blendFuncSeparate(s.ONE_MINUS_DST_COLOR,s.ONE_MINUS_SRC_COLOR,s.ONE,s.ONE_MINUS_SRC_ALPHA),s.drawArraysInstanced(s.TRIANGLE_STRIP,0,4,e.length/6),s.disable(s.BLEND),s.bindVertexArray(null)}s.bindFramebuffer(s.FRAMEBUFFER,null)}setScene(t,e){const{gl:s}=this;s.uniform2f(t.uRes,this.canvas.width,this.canvas.height),s.uniform1f(t.uTime,e.time),s.uniform1f(t.uBus,e.bus),s.uniform1f(t.uNeon,e.neon),s.uniform2fv(t.uSceneShift,e.sceneShift),s.uniform2fv(t.uSpotSrc,e.spotSrc),s.uniform2fv(t.uSpotSrc2,e.spotSrc2),s.uniform2fv(t.uSpotTgt,e.spotTgt),s.uniform1f(t.uSpotR,e.spotR),s.uniform1f(t.uSpotI,e.spotI),s.uniform1i(t.uScenery,e.scenery),s.uniform1f(t.uDewGlint,e.dewGlint),e.aqua&&(s.uniform4fv(t.uJelly,e.aqua.jelly),s.uniform4fv(t.uJellyC,e.aqua.jellyColor),s.uniform1i(t.uJellyN,e.aqua.count),s.uniform1f(t.uBubbles,e.aqua.bubbles),s.uniform4fv(t.uSway,e.aqua.sway),s.uniform4fv(t.uBurst,e.aqua.bursts),s.uniform1i(t.uBurstN,e.aqua.burstCount),s.uniform1f(t.uBeatRows,e.aqua.beatRows))}setBuildings(t,e){const{gl:s}=this;s.uniform3i(t.uBldOn,e.on[0],e.on[1],e.on[2]),s.uniform3fv(t.uBldGeo,e.geo)}render(t,e,s,n,o,a=!0){const{gl:l,U:r}=this,{main:h,fog:c,bldFill:f,noise:u}=this.build.programs;this.mask.draw(t),e&&(l.activeTexture(l.TEXTURE0+this.breath.unit),l.bindTexture(l.TEXTURE_2D,this.breath.t),l.texImage2D(l.TEXTURE_2D,0,l.RGBA,l.RGBA,l.UNSIGNED_BYTE,e)),this.renderDrops(this.drop,s),(a||!this.fieldValid)&&(this.renderDrops(this.field,n),this.fieldValid=this.spriteReady),l.bindVertexArray(this.quadVao);const d=o.scenery&yo&&!this.seeThrough&&f&&this.bld?this.bld.update(o.time*o.bus,f,this.B):go,m=this.noise.update(u);c&&!this.seeThrough&&(l.useProgram(c),this.setScene(this.F,o),this.setBuildings(this.F,d),this.fogGl.draw(this.uFogB)),l.useProgram(h),this.setScene(r,o),this.setBuildings(r,d),l.uniform1f(r.uMist,o.mist),l.uniform1f(r.uEdge,o.edge),l.uniform1f(r.uRefract,o.refract),l.uniform1f(r.uGlint,o.glint),l.uniform2fv(r.uGlassShift,o.glassShift),l.uniform1i(r.uBreathOn,e?1:0),l.uniform1i(r.uNoiseOn,m?1:0),l.uniform3fv(r.uMistTint,this.mistTint),l.viewport(0,0,this.canvas.width,this.canvas.height),l.drawArrays(l.TRIANGLE_STRIP,0,4),l.bindVertexArray(null)}destroy(){this.gl.getExtension("WEBGL_lose_context")?.loseContext()}}const R=96;let kt=null,it=null;const wo=i=>{const t=(s,n)=>s<0||n<0||s>=R||n>=R?0:i[n*R+s];let e=!0;for(;e;){e=!1;for(let s=0;s<2;s+=1){const n=[];for(let o=0;o<R;o+=1)for(let a=0;a<R;a+=1){if(!i[o*R+a])continue;const l=[t(a,o-1),t(a+1,o-1),t(a+1,o),t(a+1,o+1),t(a,o+1),t(a-1,o+1),t(a-1,o),t(a-1,o-1)],r=l.reduce((c,f)=>c+f,0);if(r<2||r>6)continue;let h=0;for(let c=0;c<8;c+=1)!l[c]&&l[(c+1)%8]&&(h+=1);h===1&&((s===0?l[0]*l[2]*l[4]||l[2]*l[4]*l[6]:l[0]*l[2]*l[6]||l[0]*l[4]*l[6])||n.push(o*R+a))}for(const o of n)i[o]=0;n.length&&(e=!0)}}},So=i=>{const t=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]],e=(r,h)=>r>=0&&h>=0&&r<R&&h<R&&i[h*R+r]===1,s=(r,h)=>t.reduce((c,[f,u])=>c+(e(r+f,h+u)?1:0),0),n=new Uint8Array(R*R),o=[],a=(r,h)=>{let c=r,f=h;const u=[[c,f]];n[f*R+c]=1;let d=null;for(;;){let m=null,p=-9;for(const[x,y]of t){const b=c+x,g=f+y;if(!e(b,g)||n[g*R+b])continue;const v=d?(x*d[0]+y*d[1])/Math.hypot(x,y):0;v>p&&(p=v,m=[b,g,x,y])}if(!m)break;[c,f]=m,d=[m[2],m[3]],n[f*R+c]=1,u.push([c,f])}u.length>=4?o.push(u):l(u)&&o.push(u.length>1?u:[u[0],[u[0][0]+1,u[0][1]+1]])},l=r=>r.every(([h,c])=>t.every(([f,u])=>!e(h+f,c+u)||r.some(([d,m])=>d===h+f&&m===c+u)));for(let r=0;r<R;r+=1)for(let h=0;h<R;h+=1)i[r*R+h]&&s(h,r)===1&&!n[r*R+h]&&a(h,r);for(let r=0;r<R;r+=1)for(let h=0;h<R;h+=1)i[r*R+h]&&!n[r*R+h]&&a(h,r);return o},be=(i,t)=>{if(i.length<3)return i;const e=i[0],s=i[i.length-1],n=Math.hypot(s[0]-e[0],s[1]-e[1])||1;let o=0,a=0;for(let l=1;l<i.length-1;l+=1){const r=Math.abs((s[0]-e[0])*(e[1]-i[l][1])-(e[0]-i[l][0])*(s[1]-e[1]))/n;r>a&&(a=r,o=l)}return a>t?[...be(i.slice(0,o+1),t).slice(0,-1),...be(i.slice(o),t)]:[e,s]},Eo=(i,t)=>{let e=i;for(let s=0;s<t&&e.length>2;s+=1){const n=[e[0]];for(let o=0;o<e.length-1;o+=1){const a=e[o],l=e[o+1];n.push([a[0]*.75+l[0]*.25,a[1]*.75+l[1]*.25],[a[0]*.25+l[0]*.75,a[1]*.25+l[1]*.75])}n.push(e[e.length-1]),e=n}return e},Mo=(i,t,e)=>{if(typeof document>"u"||(kt||(kt=document.createElement("canvas"),kt.width=kt.height=R,it=kt.getContext("2d",{willReadFrequently:!0})),!it))return null;it.fillStyle="#000",it.fillRect(0,0,R,R),it.fillStyle="#fff",it.textAlign="center",it.textBaseline="alphabetic",it.font=`${e} ${R*.78}px ${t}`,it.fillText(i,R/2,R*.8);const s=it.getImageData(0,0,R,R).data,n=new Uint8Array(R*R);for(let l=0;l<R*R;l+=1)n[l]=s[l*4]>110?1:0;wo(n);const o=So(n).map(l=>Eo(be(l,1.2),2).map(([r,h])=>[r/R,h/R]));for(const l of o)l[0][1]+l[0][0]*.6>l[l.length-1][1]+l[l.length-1][0]*.6&&l.reverse();const a=(l,r)=>l.reduce((h,c)=>Math.min(h,c[r]),1/0);return o.sort((l,r)=>(a(l,1)-a(r,1))*.6+(a(l,0)-a(r,0))),o.length?o:null},Ao="/static/app/nebbia-strokes.json";let ee=null,pe=null;const Ro=()=>(ee||(ee=fetch(Ao).then(i=>i.ok?i.json():null).catch(()=>null).then(i=>(pe=i&&typeof i=="object"?i:null,pe))),ee),Ze=i=>pe?.[i]??null,Qe=i=>{let t=0;const e=i.filter(s=>s.length>1).map(s=>{const n=[0];for(let o=1;o<s.length;o+=1)n.push(n[o-1]+Math.hypot(s[o][0]-s[o-1][0],s[o][1]-s[o-1][1]));return t+=n[n.length-1],{pts:s,cum:n,len:n[n.length-1]}}).filter(s=>s.len>.005);return e.length?{strokes:e,total:t}:null},To=(i,t)=>{if(i.length<3)return i;const e=[];for(let s=0;s<i.length-1;s+=1){const n=i[Math.max(0,s-1)],o=i[s],a=i[s+1],l=i[Math.min(i.length-1,s+2)];for(let r=0;r<t;r+=1){const h=r/t,c=h*h,f=c*h,u=d=>.5*(2*o[d]+(-n[d]+a[d])*h+(2*n[d]-5*o[d]+4*a[d]-l[d])*c+(-n[d]+3*o[d]-3*a[d]+l[d])*f);e.push([u(0),u(1)])}}return e.push(i[i.length-1]),e};let pt=null;const Fo=i=>{const t=Es(i);if(!t||typeof document>"u")return null;pt||(pt=document.createElementNS("http://www.w3.org/2000/svg","svg"),pt.setAttribute("viewBox","0 0 24 24"),pt.style.cssText="position:absolute;width:24px;height:24px;left:-99px;top:-99px;visibility:hidden;pointer-events:none",document.body.appendChild(pt));const e=[];for(const[s,n]of t){const o=document.createElementNS("http://www.w3.org/2000/svg",s);for(const[c,f]of Object.entries(n))c!=="key"&&o.setAttribute(c,String(f));pt.appendChild(o);const a=typeof o.getTotalLength=="function"?o.getTotalLength():0,l=.35;let r=[],h=null;for(let c=0;a>0&&c<=a+1e-6;c+=l){const f=o.getPointAtLength(Math.min(c,a)),u=[f.x/24,f.y/24];h&&Math.hypot(u[0]-h[0],u[1]-h[1])>l*3/24&&(r.length>1&&e.push(r),r=[]),r.push(u),h=u}r.length>1&&e.push(r),o.remove()}return e.length?e:null};class ko{constructor(t,e){this.fontFamily=t,this.fontWeight=e,this.font=`${e} ${t}`}fontFamily;fontWeight;cache=new Map;font="";setFont(t,e){const s=`${e} ${t}`;return s===this.font?!1:(this.fontFamily=t,this.fontWeight=e,this.font=s,this.cache.clear(),!0)}clear(){this.cache.clear()}fontReady(){try{return document.fonts?.check(`${this.fontWeight} 16px ${this.fontFamily}`)??!0}catch{return!0}}get(t){const e=this.cache.get(t);if(e!==void 0)return e;let s=null;const n=Ze(t);t.startsWith(Nt)?s=Fo(t.slice(Nt.length)):n?s=n.map(a=>To(a.map(([l,r])=>[l/1024,r/1024]),6)):t.trim()&&(s=Mo(t,this.fontFamily,this.fontWeight));const o=s?Qe(s):null;return this.cache.set(t,o),o}}const Bo=(i,t,e)=>{if(e<=0)return i;const s=()=>t()*2-1,n=s()*.16*e,o=1+s()*.1*e,a=1+s()*.1*e,l=s()*.035*e,r=s()*.035*e,h=t()*6.28,c=t()*6.28,f=([m,p])=>{let x=(m-.5)*o,y=(p-.5)*a;return x+=y*n,x+=l*Math.sin(y*Math.PI*1.6+h),y+=r*Math.sin(x*Math.PI*1.6+c),[x+.5,y+.5]},u=A(8/i.strokes.length,.35,1),d=i.strokes.map(m=>{const p=m.pts,x=p.length,y=p.reduce((L,N)=>L+N[0],0)/x,b=p.reduce((L,N)=>L+N[1],0)/x,g=s()*.09*e*u,v=1+s()*.1*e*u,M=s()*.022*e*u,w=s()*.022*e*u,E=Math.cos(g),S=Math.sin(g),[F,B]=p[0],k=.006*e,I=18+t()*14,O=t()*6.28;return p.map(([L,N],C)=>{let D=F+(L-F)*v,H=B+(N-B)*v;const J=D-y,U=H-b;D=y+J*E-U*S+M,H=b+J*S+U*E+w;const Z=p[Math.max(0,C-1)],G=p[Math.min(x-1,C+1)],T=G[0]-Z[0],V=G[1]-Z[1],W=Math.hypot(T,V)||1,_=Math.sin(m.cum[C]*I+O)*k;return f([D-V/W*_,H+T/W*_])})});return Qe(d)??i},xe=(i,t)=>{const{pts:e,cum:s}=i;let n=1;for(;n<e.length-1&&s[n]<t;)n+=1;const o=e[n-1],a=e[n],l=Math.max(1e-6,s[n]-s[n-1]),r=A((t-s[n-1])/l),h=(a[0]-o[0])/l,c=(a[1]-o[1])/l;return[o[0]+(a[0]-o[0])*r,o[1]+(a[1]-o[1])*r,-c,h]},_o=/[぀-ヿ㐀-鿿豈-﫿가-힯]/,Ht=/^[，。、！？!?,.・…]$/,Io=/^[ー—～〜…-]$/,No=new Set([..."的了着过吗呢吧啊呀嘛之与和是也都就还又被把给のがをにはへとでやもねよなかしてたっ"]),Fe={hero:2,semi:1.35,support:1,particle:.78},ke={hero:1.55,semi:1.18,support:1,particle:.85},Y=.3,$=.32,ts=i=>/[　-鿿＀-￯]/.test(i),Lo=i=>Wt(i)?1.1:i===" "?.32:/[，。、・．]/.test(i)?.5:ts(i)?1:/[il.,'!|:;]/.test(i)?.3:/[mwMW]/.test(i)?.72:.5,Do=(i,t)=>{const e=[],s=n=>n.every(o=>/^[゠-ヿ]$/.test(i[o].ch));for(const n of t){const o=e[e.length-1];o&&(n.every(a=>Ht.test(i[a].ch))||s(n)&&s(o)&&n[0]===o[o.length-1]+1)?o.push(...n):e.push([...n])}return e},qo=(i,t)=>{const e=t.filter(o=>i[o].ch.trim()).length,s=i[t[0]].t,n=i[t[t.length-1]];return Math.min(e,8)*14+A(n.t+n.d-s,0,2.5)*18},Co=(i,t)=>{const e=t.map(o=>qo(i,o));let s=0;e.forEach((o,a)=>{o>e[s]&&(s=a)});let n=-1;return t.length>=4&&t.forEach((o,a)=>{a===s||Math.abs(a-s)<2||o.length<2||e[a]<e[s]*.35||(n<0||e[a]>e[n])&&(n=a)}),t.map((o,a)=>a===s&&t.length>1?"hero":a===n?"semi":o.length===1&&No.has(i[o[0]].ch)?"particle":"support")},Uo=(i,t)=>t.every(e=>_o.test(i[e].ch)||Ht.test(i[e].ch)),se=(i,t,e,s,n)=>{const o=[];t.forEach((r,h)=>{const c=e[h],f={idx:r,scale:s[c],cjk:Uo(i,r)},u=o[o.length-1];c==="particle"&&u&&u.role!=="hero"&&u.role!=="semi"?u.words.push(f):o.push({role:c,words:[f]})});const a=r=>r.words.reduce((h,c)=>h+c.idx.length,0),l=r=>r.role==="hero"||r.role==="semi";for(;o.length>n;){let r=-1,h=1/0;for(let c=0;c<o.length-1;c+=1)l(o[c])||l(o[c+1])||a(o[c])+a(o[c+1])<h&&(h=a(o[c])+a(o[c+1]),r=c);if(r<0)break;o[r]={role:"support",words:[...o[r].words,...o[r+1].words]},o.splice(r+1,1)}return o},Po=(i,t)=>i.cjk&&t.cjk?.04:.24,Oo=(i,t)=>{const e=Ze(i)?.length??0;return 1+.25*A((e-9)/10)/Math.max(1,t)},Go=(i,t,e)=>{const s=[];let n=0,o=0;return i.words.forEach((a,l)=>{l>0&&(n+=Po(i.words[l-1],a)*(e==="v"&&a.cjk?0:1));for(const r of a.idx){const h=t[r].ch,c=e==="v"&&a.cjk,f=c?Ht.test(h)?.55:1.02:Lo(h),u=e==="v"&&(!a.cjk||Io.test(h))?Math.PI/2:0,d=a.scale*(a.cjk?Oo(h,a.scale):1);s.push({k:r,off:n+f*d/2,s:d,rot:u,punct:c&&Ht.test(h)}),n+=f*d,o=Math.max(o,d)}}),e==="h"?{dir:e,items:s,w:n,h:o}:{dir:e,items:s,w:o,h:n}},z=(i,t,e,s)=>{for(const n of i.items)i.dir==="h"?s.push({k:n.k,x:t-i.w/2+n.off,y:e+i.h/2-n.s/2,s:n.s,rot:0}):s.push({k:n.k,x:t+(n.punct?n.s*.3:0),y:e-i.h/2+n.off-(n.punct?n.s*.2:0),s:n.s,rot:n.rot})},xt=i=>i.items.some(t=>t.rot)?1:0,P=(i,t,e)=>Go(i.blocks[t],i.chars,e),oe=(i,t,e)=>{const s=[],n=t.map(r=>r.map(h=>P(i,h,"h"))),o=n.map(r=>r.reduce((h,c)=>h+c.w,0)+Y*(r.length-1)),a=Math.max(...o);let l=0;return n.forEach((r,h)=>{const c=Math.max(...r.map(u=>u.h));let f=-o[h]/2+e[h]*a;r.forEach(u=>{z(u,f+u.w/2,l+c-u.h/2,s),f+=u.w+Y}),l+=c+$}),{items:s,vRot:0}},lt={ribbon:i=>oe(i,[i.blocks.map((t,e)=>e)],[0]),lines2(i){const t=i.blocks.length;if(t<2)return null;const e=i.blocks.map((l,r)=>P(i,r,"h")),s=e.reduce((l,r)=>l+r.w,0);let n=0,o=1,a=1/0;return e.forEach((l,r)=>{n+=l.w,r<t-1&&Math.abs(n-s/2)<a&&(a=Math.abs(n-s/2),o=r+1)}),oe(i,[[...Array(o).keys()],[...Array(t-o).keys()].map(l=>l+o)],[-.12,.12])},lines3(i){const t=i.blocks.length;if(t<3)return null;const e=i.blocks.map((a,l)=>P(i,l,"h")),s=e.reduce((a,l)=>a+l.w,0),n=[[]];let o=0;return e.forEach((a,l)=>{n[n.length-1].length&&n.length<3&&(o+a.w/2>s/3*n.length||t-l<=3-n.length)&&n.push([]),n[n.length-1].push(l),o+=a.w}),n.length===3?oe(i,n,[-.14,.1,-.04]):null},cross(i){const{blocks:t,h:e}=i,s=t.length;if(s<3||s>7)return null;const n=Math.floor(e/2),o=Math.ceil((s-1-e)/2);if(n===0&&e+o+1>=s)return null;const a=[],l=P(i,e,"h");z(l,0,0,a);let r=0,h=-l.w/2-$;for(let f=e-1;f>=n;f-=1){const u=P(i,f,"h");z(u,h-u.w/2,(l.h-u.h)/2,a),h-=u.w+Y}let c=-l.h/2-$;for(let f=n-1;f>=0;f-=1){const u=P(i,f,"v");r+=xt(u),z(u,0,c-u.h/2,a),c-=u.h+$}h=l.w/2+$;for(let f=e+1;f<=e+o;f+=1){const u=P(i,f,"h");z(u,h+u.w/2,(l.h-u.h)/2,a),h+=u.w+Y}c=l.h/2+$;for(let f=e+o+1;f<s;f+=1){const u=P(i,f,"v");r+=xt(u),z(u,0,c+u.h/2,a),c+=u.h+$}return{items:a,vRot:r}},pillar(i){const{blocks:t,h:e}=i,s=t.length;if(s<2||s>6)return null;const n=[],o=P(i,e,"v");let a=xt(o);z(o,0,0,n);const l=-o.h/2+.15,r=(h,c,f)=>{const u=[[]];let d=l;for(let p=h;p!==c;p+=1){const x=P(i,p,"v");a+=xt(x),d+x.h>o.h/2+.6&&u[u.length-1].length&&(u.push([]),d=l),u[u.length-1].push(x),d+=x.h+$}let m=f*(o.w/2+Y);for(const p of f>0?u:[...u].reverse()){d=l;for(const x of p)z(x,m+f*x.w/2,d+x.h/2,n),d+=x.h+$;m+=f*(Math.max(0,...p.map(x=>x.w))+Y)}};return r(0,e,-1),r(e+1,s,1),{items:n,vRot:a}},header(i){const{blocks:t,h:e}=i,s=t.length;if(s<3||s-1-e<2)return null;const n=[],o=P(i,e,"h");if(z(o,0,0,n),e>0){const h=t.slice(0,e).map((m,p)=>P(i,p,"h")),c=h.reduce((m,p)=>m+p.w,0)+Y*(e-1),f=Math.max(...h.map(m=>m.h));let u=-c/2;const d=-o.h/2-$-f/2;h.forEach(m=>{z(m,u+m.w/2,d+(f-m.h)/2,n),u+=m.w+Y})}let a=o.h/2+$;const l=-o.w*.22-Y/2,r=o.w*.22+Y/2;for(let h=e+1;h<s;h+=2){const c=P(i,h,"h"),f=h+1<s?P(i,h+1,"h"):null,u=Math.max(c.h,f?f.h:0);z(c,l-c.w/2,a+u-c.h/2,n),f&&z(f,r+f.w/2,a+u-f.h/2,n),a+=u+$}return{items:n,vRot:0}},badge(i){const{blocks:t,h:e}=i,s=t.length;if(s<3||s>7||e!==0)return null;const n=[],o=P(i,0,"v"),a=t.slice(1).map((u,d)=>P(i,d+1,"h")),l=Math.max(Math.max(...a.map(u=>u.w)),o.h*.9);z(o,o.w/2,o.h/2,n);let r=o.w+Y,h=0,c=0;const f=()=>h<o.h?o.w+Y:0;return a.forEach(u=>{r>f()&&r+u.w>o.w+Y+l&&(h+=c+$,r=f(),c=0),z(u,r+u.w/2,h+u.h/2,n),r+=u.w+Y,c=Math.max(c,u.h)}),{items:n,vRot:xt(o)}},columns(i){const{blocks:t}=i,e=t.length;if(e<2||e>5||t.some(o=>o.words.some(a=>!a.cjk)))return null;const s=[];let n=0;return t.forEach((o,a)=>{const l=P(i,a,"v");z(l,n+l.w/2,l.h/2+a%2*.5,s),n+=l.w+$}),{items:s,vRot:0}},orbit(i){const{blocks:t,h:e}=i,s=t.length;if(s<4||s>7)return null;const n=[],o=P(i,e,"h");z(o,0,0,n);const a=[{x0:-o.w/2,x1:o.w/2,y0:-o.h/2,y1:o.h/2}],l=(f,u)=>Math.max(f.x0-u.x1,u.x0-f.x1,f.y0-u.y1,u.y0-f.y1);let r=-Math.PI*.75,h=0;const c=Math.hypot(o.w,o.h)/2+$;for(let f=0;f<s;f+=1){if(f===e)continue;let u=c,d=r,m=null,p=P(i,f,"h");for(let x=0;x<600&&!m;x+=1){p=P(i,f,Math.abs(Math.cos(d))>.75?"v":"h");const y=Math.cos(d)*u*1.25,b=Math.sin(d)*u*.8,g={x0:y-p.w/2,x1:y+p.w/2,y0:b-p.h/2,y1:b+p.h/2};a.every(v=>l(v,g)>=Y)?m=g:(d+=.08,x%80===79&&(u+=.5))}if(!m)return null;a.push(m),h+=xt(p),z(p,(m.x0+m.x1)/2,(m.y0+m.y1)/2,n),r=d+.5}return{items:n,vRot:h}}},zo={ribbon:12,lines2:10,lines3:14,cross:0,pillar:1,header:1,badge:4,columns:2,orbit:4},Be=new Set(["ribbon","lines2","lines3"]),Ho=.03,Ut=i=>{let t=1/0,e=-1/0,s=1/0,n=-1/0;for(const o of i)t=Math.min(t,o.x-o.s/2),e=Math.max(e,o.x+o.s/2),s=Math.min(s,o.y-o.s/2),n=Math.max(n,o.y+o.s/2);return{x0:t,x1:e,y0:s,y1:n,w:e-t,h:n-s}},jo=(i,t)=>Math.max(0,Math.min(i.x1,t.x1)-Math.max(i.x0,t.x0))*Math.max(0,Math.min(i.y1,t.y1)-Math.max(i.y0,t.y0)),Xo=(i,t)=>{const{W:e,H:s,jitter:n,layouts:o,fontScale:a,visibleUntil:l,fogAt:r,lingerUntil:h}=t,c=e*.05,f=s*.07,u=Math.max(26,s*.065)*a,d=s*.14*a,m=[],p=[];let x=null,y=null;const b=(v,M)=>{const w=(M==="title"?null:lt.ribbon(v))??g(v),E=Ut(w.items),S=M==="title"?d*1.15:d*.55,F=Math.min(S,(e-c*2)*.8/E.w,s*.32/E.h),B=E.w*F,k=E.h*F,I=M==="title"||!y?s*.42:y.y1+k/2+F*.6,O={x0:e/2-B/2,x1:e/2+B/2,y0:I-k/2,y1:I+k/2};return M==="title"&&(y=O),{score:0,name:"ribbon",items:w.items,bb:E,S:F,cx:e/2,cy:I,box:O}},g=v=>{const M=lt.ribbon(v),w=Ut(M.items);return(Math.min(d*1.15,(e-c*2)*.8/w.w)>=u?null:lt.lines2(v))??M};return i.map((v,M)=>{const{chars:w}=v,E=st(Vt(w.map(T=>T.ch).join(""))+M*7919>>>0),S=w.filter(T=>T.ch.trim()),F=S.length>0&&(v.end-v.t)/S.length<.22,B=Do(w,v.words);if(!B.length)return w.map(()=>({x:e/2,y:s/2,s:u,rot:0}));const k=Co(w,B),I=F?ke:Fe,O=m.filter(T=>T.linger>v.t-.3).map(T=>({box:T.box,w:T.until<=v.t-.3?Ho:v.t<=T.fogAt?1:.6+.4*A((T.until-v.t)/Math.max(.001,T.until-T.fogAt))}));let L=v.credits?b({blocks:se(w,B,B.map(()=>"support"),Fe,9),h:0,chars:w},v.credits):null;if(!L)for(const T of[5,7]){const V=se(w,B,k,I,T),W={blocks:V,h:Math.max(0,V.findIndex(_=>_.role==="hero")),chars:w};for(const _ of Object.keys(lt)){if(!o.includes(_))continue;const j=lt[_](W);if(!j||!j.items.length)continue;const ot=Ut(j.items),nt=s*(_==="ribbon"?.28:.5),Q=(e-c*2)*(Be.has(_)?.94:.68),ct=Math.min(Q/ot.w,nt/ot.h,d);if(!(ct<u*.75))for(const ht of[ct,ct*.8,ct*.64,ct*.5].filter((ft,ut)=>ut===0||ft>=u*.75)){const ft=ot.w*ht,ut=ot.h*ht;for(const as of[.5,.3,.7])for(const rs of[.25,.42,.58,.75]){const Dt=A(as*e,c+ft/2,e-c-ft/2),Mt=A(rs*s,f+ut/2,s-f-ut/2),At={x0:Dt-ft/2,x1:Dt+ft/2,y0:Mt-ut/2,y1:Mt+ut/2},qt=ht*.3,ls={x0:At.x0-qt,x1:At.x1+qt,y0:At.y0-qt,y1:At.y1+qt};let tt=0;for(const Se of O)tt+=jo(ls,Se.box)/(ft*ut)*1e3*Se.w;tt-=ht/s*100,ht<u&&(tt+=40+(u-ht)/u*200),tt+=zo[_],tt+=j.vRot*(F?10:4),F&&!Be.has(_)&&(tt+=6),T===7&&V.length<=5&&(tt+=100);const we=p.lastIndexOf(_);we>=0&&(tt+=[18,9,4][p.length-1-we]),x&&Math.abs(x.cx-Dt)<e*.08&&Math.abs(x.cy-Mt)<s*.08&&(tt+=8),tt+=Math.abs(Mt-s*.5)/s*8,tt+=E()*8,(!L||tt<L.score)&&(L={score:tt,name:_,items:j.items,bb:ot,S:ht,cx:Dt,cy:Mt,box:At})}}}}if(!L){const V={blocks:se(w,B,k,ke,9),h:0,chars:w},W=lt.lines3(V)??lt.lines2(V)??lt.ribbon(V),_=Ut(W.items),j=Math.min(d,(e-c*2)/_.w,(s-f*2)/_.h);L={score:0,name:"lines3",items:W.items,bb:_,S:j,cx:e/2,cy:s/2,box:{x0:e/2-_.w*j/2,x1:e/2+_.w*j/2,y0:s/2-_.h*j/2,y1:s/2+_.h*j/2}}}const N=L;m.push({box:N.box,until:l(M),fogAt:r(M),linger:Math.max(l(M),h?.(M)??0)}),p.push(N.name),p.length>3&&p.shift(),x=N;const{bb:C,S:D,cx:H,cy:J}=N,U=(E()-.5)*.04*n,Z=new Map(N.items.map(T=>[T.k,T]));let G={x:H,y:J,s:D,rot:0};return w.map((T,V)=>{const W=Z.get(V);if(!W)return{...G,rot:0};const _=H+(W.x-(C.x0+C.x1)/2)*D,j=J+(W.y-(C.y0+C.y1)/2)*D,ot=W.s*D*(1+(E()-.5)*.08*n);return G={x:_+(E()-.5)*D*.04*n,y:j+(_-H)*U+(E()-.5)*D*.05*n,s:ot,rot:W.rot+(E()-.5)*.08*n+U},G})})},Vo=(i,t,e)=>i.length===1?i[0]:st(e+t*977+3>>>0)()<.5?"fog":"fingers",Wo=(i,t,e)=>Math.min(t,i+6)+e,$o=16,Yo=3,Ko=(i,t,e,s)=>{const n=Bo(t,st(Math.floor(e()*1e9)),s);i.glyph=n,i.beads=n.strokes.map(o=>{const a=[],l=7/i.s;for(let r=l*e();r<o.len;r+=l*(.5+e())){if(e()>q.beads)continue;const[h,c,f,u]=xe(o,r),d=e()<.5?-1:1;a.push({s:r,x:h,y:c,nx:f*d,ny:u*d,r:1.6+e()**2.2*3.6,j:e()})}return a}),i.drips=n.strokes.map(()=>e()<q.drip*.22?{delay:.3+e()*1.6,len:30+e()*130,dur:2+e()*3.5,r:3.2+e()*2.6,seed:e()*100}:null),i.ends=n.strokes.map(()=>({h:e(),j:e()}))},Jo=(i,t)=>(i.total*.28+(i.strokes.length-1)*.06)/t,ne=(i,t,e)=>{let s=-1/0;return{starts:i.map((o,a)=>{const l=Math.max(o.t,s);return s=l+t[a]*e,l}),end:s}},Zo=(i,t,e,s)=>{const n=t.appear.filter(d=>d!=="fade"),o=t.appear.includes("fade"),a=n.length?n[Math.floor(st(s+e*613+11>>>0)()*n.length)]:null,l=i.chars.filter(d=>d.glyph),r=l.map(d=>Jo(d.glyph,t.writeSpeed)),h=Math.max(i.next,i.end);let c=1;if(ne(l,r,1).end>h){let d=.3,m=1;for(let p=0;p<14;p+=1){const x=(d+m)/2;ne(l,r,x).end>h?m=x:d=x}c=d}const f=ne(l,r,c),u=!a||o&&l.length>0&&f.end>h+.001;l.forEach((d,m)=>{d.wt=f.starts[m],d.wd=r[m]*c}),a==="breath"&&!u&&l.length&&(i.appearBreathAt=l[0].wt-q.breathSpread-.3,i.appearBreathUntil=i.end+q.breathHold);for(const d of i.chars)d.appearDur=u?A(d.d*3,.35,1.2):0},Qo=(i,t)=>{const e=t.findIndex(r=>r.credits==="title"),s=t.findIndex(r=>r.credits==="artist");if(e<0||s<0)return;const n=i[e].chars.filter(r=>r.glyph),o=n[n.length-1];if(!o)return;const a=i[s].chars.find(r=>r.glyph),l=a?Math.max(0,o.wt+o.wd+.4-a.wt):0;for(const r of i[s].chars)r.wt+=l},$t=i=>{let t=1/0,e=-1/0,s=1/0,n=-1/0,o=0;for(const a of i.chars)a.glyph&&(t=Math.min(t,a.x-a.s/2),e=Math.max(e,a.x+a.s/2),s=Math.min(s,a.y-a.s/2),n=Math.max(n,a.y+a.s/2),o=Math.max(o,a.s));return{x0:t,x1:e,y0:s,y1:n,S:o}},tn=(i,t,e,s,n)=>{const o=Vt(String(n)),a=i.map((b,g)=>b.credits?"fog":Vo(e.fade,g,o)),l=b=>e.refog+(a[b]==="fog"?0:2.5),r=i.find(b=>b.credits)?.t??1/0,h=b=>Math.max(i[b].end+.5,r-l(b)*.6),c=b=>i[b].credits?1/0:Math.min(Wo(i[b].end,i[b].next,e.hold),h(b)),f=b=>Math.max(c(b),Math.min(c(b)+$o,(i[b+Yo]?.t??1/0)+e.hold,h(b))),u=b=>c(b)+l(b),d=Xo(i,{W:s.W,H:s.H,jitter:e.jitter,layouts:e.layouts,fontScale:s.fontScale,visibleUntil:u,fogAt:c,lingerUntil:b=>f(b)+l(b)}),m=i.map((b,g)=>({t:b.t,end:b.end,next:b.next,mode:a[g],fogAt:c(g),yieldAt:1/0,breathAt:1/0,breathUntil:1/0,appearBreathAt:1/0,appearBreathUntil:1/0,chars:b.chars.map((v,M)=>{const w=d[g][M],E=ts(v.ch)||Wt(v.ch),S={...v,x:w.x,y:w.y,s:w.s*(E?1:1.15),rot:w.rot,glyph:null,beads:[],drips:[],ends:[],appearDur:0,wt:v.t,wd:0},F=t.get(v.ch);return F&&Ko(S,F,st(g*131+M*17+5>>>0),e.warp),S})}));m.forEach((b,g)=>Zo(b,e,g,o)),Qo(m,i);const p=m.map($t),{breathSpread:x,breathHold:y}=q;return m.forEach((b,g)=>{if(i[g].credits)return;const v=f(g)+l(g);let M=-1;for(let w=g+1;w<m.length&&m[w].t<v;w+=1){const E=p[g],S=p[w];if(Math.min(E.x1,S.x1)>Math.max(E.x0,S.x0)&&Math.min(E.y1,S.y1)>Math.max(E.y0,S.y0)){b.yieldAt=sn(m[w].t,b),M=w;break}}b.fogAt=Math.max(c(g),Math.min(f(g),b.yieldAt-l(g))),M>=0&&!i[M].credits&&b.yieldAt<b.fogAt+l(g)&&(b.breathAt=b.yieldAt-x-.3,b.breathUntil=m[M].end+y)}),m},es=.6,en=.3,sn=(i,t)=>{let e=t.t;for(const s of t.chars)s.glyph&&(e=Math.max(e,s.wd>0?s.wt+s.wd:s.t+Math.min(s.appearDur,.5)));return Math.max(i,e+en+es)},on=(i,t)=>i.breathAt<1/0?1-K(A((t-i.breathAt)/q.breathSpread)):1-K(A((t-i.yieldAt+es)/1)),ss=50,nn=i=>null,Bt=1/ss,ie=(i,t)=>{let e=0,s=i.length;for(;e<s;){const n=e+s>>1;i[n]<t?e=n+1:s=n}return e},_e=new WeakMap,an=i=>{const t=_e.get(i);if(t)return t;const{db:e,top:s,fps:n}=i,o=e.length,a=Math.round(1.5*n),l=s-28,r=new Float32Array(o),h=[];for(let c=0;c<Math.min(o,a);c+=1)e[c]>l&&h.splice(ie(h,e[c]),0,e[c]);for(let c=0;c<o;c+=1){if(c>0){const d=c+a-1,m=c-a-1;d<o&&e[d]>l&&h.splice(ie(h,e[d]),0,e[d]),m>=0&&e[m]>l&&h.splice(ie(h,e[m]),1)}if(e[c]<=l)continue;const f=h[Math.floor(h.length*.1)],u=Math.max(f+3,h[Math.floor(h.length*.95)]);r[c]=A((e[c]-f)/(u-f))**1.2}return _e.set(i,r),r},rn=i=>A(2**((i+17.4)/8),.5,3),ln=(i,t)=>i.find(e=>t>=e.t-.3&&t<=e.end+1)??null;class cn{floor=0;peak=1;value=0;update(t,e){const s=1-Math.exp(-e/3);return this.peak=Math.max(t,this.peak+(t-this.peak)*s*.5),this.floor=Math.min(t,this.floor+(t-this.floor)*s*.3),this.value=A((t-this.floor)/Math.max(this.peak-this.floor,8))**1.2,this.value}}class ae{constructor(t){this.seed=t}seed;big=[];small=[];lastBucket=-1;vocal=null;vocalFrom=0;loud=1;buildBig(t,e,s,n,o=null){this.big=[],this.small=[],this.lastBucket=-1,this.vocal=o&&o.fps===ss?an(o):null,this.vocalFrom=this.vocal?o?.from??0:0,this.loud=o&&this.vocal?rn(o.top):1;const a=st(Ee(this.seed,911)),l=Math.min(s,n)/720,r=(c,f)=>{const u=f?$t(f):null;let d=0,m=0;for(let y=0;y<8&&(d=s*(.03+.94*a()),m=n*(.03+.94*a()),!(!u||d<u.x0-20||d>u.x1+20||m<u.y0-20||m>u.y1+20));y+=1);const p=(7+a()*6)*l,x=Array.from({length:4+Math.floor(a()*5)},()=>{const y=a()*6.28,b=p*(1.5+a()*1.4);return[Math.cos(y)*b,Math.sin(y)*b*.85+p*.2,(1+a()*1.6)*l]});this.big.push({t:c,x:d,y:m,R:p,big:!0,sat:x,seed:a()*100})},h=o&&this.vocal?this.vocalFrom/o.fps:1/0;if(t.forEach((c,f)=>{for(const u of e[f]??[]){const d=c.chars[u[0]].t;d<h&&a()<.6&&r(d,c)}}),o&&this.vocal){const c=this.vocal;for(const f of o.onsets)(c[f]>.15||a()<.3)&&r(f/o.fps,ln(t,f/o.fps))}this.big.sort((c,f)=>c.t-f.t)}advance(t,e,s,n,o,a){const l=Math.floor(t/Bt);if((l<this.lastBucket||l-this.lastBucket>n/Bt)&&(this.small=[],this.lastBucket=l-Math.ceil(n/Bt)),s>0){const r=Math.min(o,a)/720,h=this.vocal,c=u=>(.15+7*u*u)*s*Bt,f=c(e);for(let u=this.lastBucket+1;u<=l;u+=1){const d=st(Ee(this.seed+u,23249));d()>=(h&&(u<0||u>=this.vocalFrom)?c(u>=0&&u<h.length?h[u]:0)*this.loud:f)||this.small.push({t:(u+d())*Bt,x:o*(.03+.94*d()),y:a*(.03+.94*d()),R:(2+d()*3.5)*r,big:!1,sat:null,seed:d()*100})}}for(this.lastBucket=l;this.small.length&&this.small[0].t<t-n;)this.small.shift()}draw(t,e,s,n,o,a){const l=n*.3,r=.4+l+o*.5+n;let h=0,c=this.big.length;for(;h<c;){const u=h+c>>1;this.big[u].t<s-r?h=u+1:c=u}t.setTransform(et,0,0,et,0,0);const f=(u,d)=>{const m=u.R*d,p=s-u.t,x=1-K(A((p-.4)/l)),y=1-K(A((p-.4-o*.5)/n));if(u.big&&x>.002){for(let b=0;b<7;b+=1){const g=u.seed+b*.9,v=m*.3,M=u.x+Math.cos(g)*v,w=u.y+Math.sin(g*1.3)*v;t.moveTo(M,w),t.lineTo(M+.1,w)}t.stroke(m*1.3,x)}if(y>.01){const b=Math.exp(-p/.05);if(e.put(u.x,u.y+m*.1,m*.9*(.6+.4*y),y,1+.5*b,1-.35*b),u.sat)for(const[g,v,M]of u.sat){const w=A(p/.08),E=g*d,S=v*d;e.put(u.x+E*w,u.y+S*w,M*(.55+.45*y),y*w)}}};if(a>0)for(let u=h;u<this.big.length&&this.big[u].t<=s;u+=1)this.big[u].R*a>=1&&f(this.big[u],a);for(const u of this.small)u.t<=s&&f(u,1);t.setTransform(1,0,0,1,0,0)}scheduled(){return{big:this.big,small:this.small}}static lifeOf(t,e){return .4+t*.3+e*.5+t}}const yt=.25,hn=(i,t)=>{const e=st(t*6151+29>>>0),{x0:s,x1:n,y0:o,y1:a,S:l}=$t(i);if(!Number.isFinite(s))return null;const r=(s+n)/2,h=(o+a)/2,c=(n-s)/2+l*.3,f=(a-o)/2+l*.3,u=[{x:r,y:h,rx:c*.95,ry:f*.95}],d=5+Math.floor(e()*2),m=Math.min(c,f);for(let p=0;p<d;p+=1){const x=(p+e()*.6)/d*Math.PI*2,y=m*(.45+e()*.25);u.push({x:r+Math.cos(x)*c*.6,y:h+Math.sin(x)*f*.6,rx:y,ry:y})}return{lobes:u,cx:r,cy:h,ry:f}};class fn{canvas=document.createElement("canvas");ctx;active=!1;constructor(){const t=this.canvas.getContext("2d");if(!t)throw new Error("Nebbia: no 2D context for the breath mask");this.ctx=t}resize(t,e){this.canvas.width=Math.max(1,Math.round(t*yt)),this.canvas.height=Math.max(1,Math.round(e*yt))}begin(){if(!this.active)return;const{ctx:t}=this;t.setTransform(1,0,0,1,0,0),t.globalCompositeOperation="source-over",t.fillStyle="#000",t.fillRect(0,0,this.canvas.width,this.canvas.height),this.active=!1}drawLine(t,e,s,n,o){const{breathSpread:a,breathFade:l}=q;if(s<n)return;const r=1-K(A((s-Math.max(o,n+a))/l));if(r<=.002)return;t.breath===void 0&&(t.breath=hn(t,e));const h=t.breath;if(!h)return;const c=A((s-n)/a),f=1-(1-c)**3,u=.7+.3*f,d=.08+.92*f;this.active=!0;const{ctx:m}=this;m.globalCompositeOperation="lighten";const p=Math.round(255*r),x=Math.round(255*A(c*4));for(const y of h.lobes){const b=h.cx+(y.x-h.cx)*u,g=h.cy+(y.y-h.cy)*d;m.setTransform(yt*y.rx*u,0,0,yt*Math.max(y.ry*d,4),yt*b,yt*g);const v=m.createRadialGradient(0,0,0,0,0,1);v.addColorStop(0,`rgb(${p},${x},0)`),v.addColorStop(.45,`rgb(${Math.round(p*.7)},${x},0)`),v.addColorStop(.999,`rgb(0,${x},0)`),v.addColorStop(1,"rgb(0,0,0)"),m.fillStyle=v,m.beginPath(),m.arc(0,0,1,0,Math.PI*2),m.fill()}m.setTransform(1,0,0,1,0,0)}}const os=(i,t,e,s,n,o,a,l)=>{if(!(s-e<2))for(let r=e;r<s;r+=4){const h=Math.min(s,r+5),c=(r-e)/Math.max(1,s-e),f=n*(.72+.28*c)*(.85+.3*(.5+.5*Math.sin(r*.19+a*3)));i.moveTo(t+l(r),r),i.lineTo(t+l(h),h),i.stroke(f,o)}},un=(i,t,e)=>{const{pts:s,cum:n}=t;i.moveTo(s[0][0],s[0][1]);for(let o=1;o<s.length;o+=1){if(n[o]>=e){const a=(e-n[o-1])/Math.max(1e-6,n[o]-n[o-1]);i.lineTo(s[o-1][0]+(s[o][0]-s[o-1][0])*a,s[o-1][1]+(s[o][1]-s[o-1][1])*a);return}i.lineTo(s[o][0],s[o][1])}},ye=(i,t,e)=>{const s=Math.cos(i.rot),n=Math.sin(i.rot),o=(t-.5)*i.s,a=(e-.5)*i.s;return[i.x+s*o-n*a,i.y+n*o+s*a]},dn=(i,t,e,s,n,o,a,l)=>{let r=0,h=-1e9;for(const x of e.pts){const[y,b]=ye(t,x[0],x[1]);b>h&&(r=y,h=b)}h+=o*t.s*.35;const c=A(n/s.dur),f=c-Math.sin(c*6*Math.PI)/(6*Math.PI),u=s.len*f,d=s.r*(1-.35*c),m=x=>Math.sin(x*.07+s.seed)*1.6+Math.sin(x*.023+s.seed*2)*2.5+ge(x,i.busSpeed);u>1&&a>.002&&os(i.ctx,r,h,h+u,d*1.5,a*.95,s.seed,x=>m(x-h));const p=1-Math.cos(c*6*Math.PI);for(let x=14+s.seed%7*2;x<u-d*2;x+=18+(x*7+s.seed*13)%11)i.motion.put(r+m(x),h+x,d*(.3+.2*((x+s.seed)*.37%1)),l);i.motion.put(r+m(u),h+u+d*.3,d,l,1,1+.35*p*(c<1?1:0))},Ie=(i,t,e,s,n=s,o=null)=>{const a=t.glyph,l=t.appearDur>0;if(!a||e<(l?t.t:t.wt))return;const{ctx:r,motion:h}=i;let c=s,f=n;if(l){const w=K(A((e-t.t)/t.appearDur));c*=w,f*=w}const u=t.wd,d=Math.min(.06/i.writeSpeed,u*.08),m=u-d*(a.strokes.length-1);let p=e-(l?t.t:t.wt);const x=et,y=Math.cos(t.rot),b=Math.sin(t.rot);r.setTransform(y*t.s*x,b*t.s*x,-b*t.s*x,y*t.s*x,(t.x-t.s/2*(y-b))*x,(t.y-t.s/2*(b+y))*x);const g=A(Math.sqrt(9/a.strokes.length),.55,1),v=Math.max(i.strokeWidth*g,8*g/t.s),M=[];a.strokes.forEach((w,E)=>{const S=l?0:m*w.len/a.total;if(p<=0)return;const F=S>0?A(p/S):1,B=(F*.4+K(F)*.6)*w.len;if(c>.002&&(un(r,w,B),r.stroke(v,c)),!l){for(const I of t.beads[E]){if(I.s>B)break;const O=v/2+(I.r*.7+I.j*1.5)/t.s,[L,N]=ye(t,I.x+I.nx*O,I.y+I.ny*O),C=o?f*o(L,N):f;h.put(L,N,I.r*(.55+.45*C),C,1+I.j*.25,1+(1-I.j)*.3)}if(B>0&&t.s>=q.endBeadMin){const I=t.ends[E],[O,L]=xe(w,B),[N,C]=xe(w,Math.max(0,B-2/t.s));let D=O-N,H=L-C;const J=Math.hypot(D,H)||1;D/=J,H/=J;const U=t.s*(.031+.018*I.h)*q.endBead*(.5+.5*K(F)),[Z,G]=ye(t,O+D*U*.35/t.s,L+(H*U*.35+U*.15)/t.s),T=o?f*o(Z,G):f;h.put(Z,G,U*(.6+.4*T),T,1,1.12+I.j*.12)}const k=t.drips[E];k&&F>=1&&p-S>k.delay&&M.push([w,k,p-S-k.delay])}p-=S+(l?0:d)}),r.setTransform(et,0,0,et,0,0);for(const[w,E,S]of M)dn(i,t,w,E,S,v,c,f);r.setTransform(1,0,0,1,0,0)},mn=(i,t)=>{const e=st(t*4241+77>>>0),{x0:s,x1:n,y0:o,y1:a,S:l}=$t(i);if(!Number.isFinite(s))return null;const r=Math.max(14,l*.26),h=3+(e()<.5?1:0),c=r*(1.25+e()*.25),f=(h-1)*c+r,u=(o+a)/2,d=Math.max(3,Math.min(5,Math.ceil((a-o)/(f*.8))+2)),m=a-o-f*.6,p=e()<.7?1:-1,x=l*.35,y=[];for(let g=0;g<d;g+=1){const v=g%2===0?p:-p,M=u+(d>1?(g/(d-1)-.5)*Math.max(0,m):0)+(e()-.5)*r*.8,w=1-g*.08,E=(s+n)/2,S=((n-s)/2+x)*w,F=E-v*S+(e()-.5)*l*.3,B=E+v*S+(e()-.5)*l*.3,k=(e()-.5)*.16,I=(e()-.5)*l*.35,O=g/d*.92,L=Math.min(1,(g+1)/d*.92+.08);for(let N=0;N<h;N+=1){const C=(N-(h-1)/2)*c+(e()-.5)*r*.25,D=N===h-1?.84+e()*.1:.95+e()*.05,H=l*.04*e(),J=[];for(let U=0;U<=24;U+=1){const Z=U/24,G=F+(B-F)*D*Z;J.push([G,M+C+I*Math.sin(Math.PI*Z)+k*(G-E)+H*Math.sin(Z*5+N)])}y.push({pts:J,w:r*(.85+e()*.3),a:O,b:L})}}const b=[];for(const g of y.slice(-h)){const[v,M]=g.pts[g.pts.length-1];b.push({x:v,y:M,r:g.w*.22+1.5*e()}),e()<.6&&b.push({x:v-(g.pts[1][0]-g.pts[0][0])*.6,y:M+(e()-.5)*g.w*.6,r:1.5+e()*2.5})}return{streaks:y,beads:b,dur:.32*d}},ns=(i,t)=>A((t-i.a)/(i.b-i.a)),bn=(i,t,e,s)=>i.streaks.some(n=>{const o=ns(n,t);if(o<=0)return!1;const a=n.pts[0][0],l=n.pts[n.pts.length-1][0],r=a+(l-a)*o;if((e-a)*(r-e)<0)return!1;const h=A((e-a)/(l-a)),c=n.pts[Math.round(h*(n.pts.length-1))][1];return Math.abs(s-c)<n.w*.7}),pn=8,xn=2.5;class yn{ctx=new Zs;breath=new fn;H=1;resize(t,e){this.H=e,this.breath.resize(t,e)}draw(t,e,s,n,o,a,l){const{ctx:r}=this;r.clear(),this.breath.begin();const h={ctx:r,motion:o,strokeWidth:n.strokeWidth,writeSpeed:n.writeSpeed,busSpeed:n.busSpeed};t.forEach((c,f)=>{c.breathAt<1/0&&this.breath.drawLine(c,f,e,c.breathAt,c.breathUntil),c.appearBreathAt<1/0&&this.breath.drawLine(c,f,e,c.appearBreathAt,c.appearBreathUntil),e>=c.t-.5&&this.drawLine(h,c,f,e,n)}),a.draw(r,o,e,n.refog,q.beadHold,l),this.drawTrails(o,s,n)}drawLine(t,e,s,n,o){const{refog:a}=o,l=q.beadHold,{fogAt:r}=e,h=on(e,n);if(e.mode==="fog"){const b=(1-K(A((n-r)/a)))*h,g=(1-K(A((n-r-l)/(a*3))))*h;if(g>.002)for(const v of e.chars)Ie(t,v,n,b,g);return}e.wipe===void 0&&(e.wipe=mn(e,s));const c=e.wipe;if(!c)return;const f=e.breathAt<1/0?-1/0:e.yieldAt-c.dur-.9,u=r>f&&f>=e.end?f:r,d=A((n-u)/c.dur),m=(1-K(A((n-u-c.dur-.5)/a)))*h,p=(1-K(A((n-u-c.dur-.5-l)/(a*3))))*h;if(p<=.002)return;const x=d<=0?null:(b,g)=>bn(c,d,b,g)?0:1;for(const b of e.chars)Ie(t,b,n,d<=0?h:m,d<=0?h:p,x);if(d<=0)return;const{ctx:y}=t;if(y.setTransform(et,0,0,et,0,0),m>.002)for(const b of c.streaks){const g=ns(b,d);if(g<=0)continue;const v=b.pts,M=v.length-1,w=g*M,E=Math.floor(w);y.moveTo(v[0][0],v[0][1]);for(let S=1;S<=Math.min(E,M);S+=1)y.lineTo(v[S][0],v[S][1]);if(E<M){const S=v[E],F=v[E+1],B=w-E;y.lineTo(S[0]+(F[0]-S[0])*B,S[1]+(F[1]-S[1])*B)}y.stroke(b.w,m)}if(y.setTransform(1,0,0,1,0,0),d>=1)for(const b of c.beads)t.motion.put(b.x,b.y,b.r*(.55+.45*p),p)}drawTrails(t,e,s){const{ctx:n}=this,o=t.smears;n.setTransform(et,0,0,et,0,0);for(let l=o.length-1;l>=0;l-=1){const r=o[l],h=r.end===null?1:1-K(A((e-r.end-pn)/(s.refog*xn)));if(h<=.002){r.gone=!0,o.splice(l,1);continue}n.moveTo(r.x+r.ax,r.y+r.ay),n.lineTo(r.x+r.bx,r.y+r.by),n.stroke(r.w*.14,h*.9)}const a=t.trails;for(let l=a.length-1;l>=0;l-=1){const r=a[l],h=r.end===null?1:1-K(A((e-r.end-s.hold)/s.refog));if(h<=.002){a.splice(l,1);continue}if(r.y1-r.y0<2||r.y0>this.H)continue;n.setTransform(et,0,0,et,0,0);const c=f=>Math.sin(f*.07+r.seed)*1.4+Math.sin(f*.021+r.seed*2)*2.2+ge(f-r.y0,s.busSpeed);os(n,r.x,r.y0,r.y1,r.w*.18,h*.95,r.seed,c);for(let f=r.y0+10+r.seed%9;f<r.y1-r.w*.25;f+=16+(f*7+r.seed*13)%13)t.put(r.x+c(f),f,r.w*(.03+.03*((f+r.seed)*.37%1)),h)}n.setTransform(1,0,0,1,0,0)}}const re=(i,t)=>{const e=i?hs(i):null;return e?[e.r/255,e.g/255,e.b/255]:t},wt=([i,t,e])=>{const s=Math.max(i,t,e),n=Math.min(i,t,e),o=(s+n)/2,a=s-n;if(a===0)return[0,0,o];const l=a/(1-Math.abs(2*o-1));return[(s===i?((t-e)/a+6)%6:s===t?(e-i)/a+2:(i-t)/a+4)/6,l,o]},jt=([i,t,e])=>{const s=a=>(a+i*12)%12,n=t*Math.min(e,1-e),o=a=>e-n*Math.max(-1,Math.min(s(a)-3,9-s(a),1));return[o(0),o(8),o(4)]},le=i=>{const[t,e,s]=wt(i);return jt([t,Math.max(.55,e),Math.min(.78,Math.max(.6,s))])},Ne=(i,t)=>{const[e,s]=wt(i);return jt([e,Math.min(.55,s),t])},gn=i=>{const t=re(i.accentColor,[1,.81,.54]),e=re(i.backgroundColor,[.04,.06,.09]),s=[i.secondaryColor,i.primaryColor,...(i.wordColors??[]).map(h=>h.color)].map(h=>re(h,[0,0,0])).filter(h=>wt(h)[1]>.3&&wt(h)[2]>.25&&wt(h)[2]<.9),[n,o,a]=wt(t),l=s[0]??jt([(n+.55)%1,o,a]),r=s[1]??jt([(n+.9)%1,o,a]);return{sky0:Ne(e,.05),sky1:Ne(e.map((h,c)=>h*.7+t[c]*.3),.14),la:le(t),lb:le(l),lc:le(r)}},mt=i=>i.appearDur>0?i.t:i.wt,vn=i=>mt(i)+(i.appearDur>0?i.appearDur:i.wd),Le=new WeakMap,wn=i=>{let t=Le.get(i);if(t===void 0){t=i.end;for(const e of i.chars)e.glyph&&(t=Math.max(t,vn(e)));Le.set(i,t)}return t},Sn=(i,t)=>{for(let e=i.length-1;e>=0;e-=1){const s=i[e];if(t<s.t-.05||t>wn(s)+.8)continue;let n=-1;if(s.chars.forEach((a,l)=>{a.glyph&&mt(a)<=t&&(n<0||mt(a)>=mt(s.chars[n]))&&(n=l)}),n<0)continue;let o=null;for(let a=n+1;a<s.chars.length&&!o;a+=1)s.chars[a].glyph&&(o=s.chars[a]);return{c:s.chars[n],next:o}}return null};class En{x=0;y=0;r=0;i=0;vx=0;vy=0;vr=0;t=0;init=!1;update(t,e,s){this.t+=s,Math.abs(e-this.t)>.25||s===0?this.t=e:this.t+=(e-this.t)*(1-Math.exp(-s/.3));const n=Sn(t,this.t);if(n){const{c:o,next:a}=n,l=a?K(A((this.t-mt(o))/Math.max(.05,mt(a)-mt(o)))):0,r=a?o.x+(a.x-o.x)*l:o.x,h=a?o.y+(a.y-o.y)*l:o.y,c=a?o.s+(a.s-o.s)*l:o.s;(!this.init||s===0)&&(this.x=r,this.y=h,this.r=c,this.vx=this.vy=this.vr=0,this.init=!0);const f=1/.1,u=Math.ceil(s/.008);for(let d=0;d<u;d+=1){const m=s/u;this.vx+=(f*f*(r-this.x)-2*f*this.vx)*m,this.x+=this.vx*m,this.vy+=(f*f*(h-this.y)-2*f*this.vy)*m,this.y+=this.vy*m,this.vr+=(f*f*(c-this.r)-2*f*this.vr)*m,this.r+=this.vr*m}}s===0?this.i=n?1:0:this.i+=((n?1:0)-this.i)*(1-Math.exp(-s/(n?.15:.5)))}reset(){this.init=!1,this.i=0}}const Mn=.35,An=.3,Rn=.5;class Tn{list=null;key=null;next=0;lastT=-1/0;lastBump=-1/0;step(t,e,s){if(t!==this.list||e!==this.key)return this.list=t,this.key=e,this.seek(s),0;if(s<this.lastT||s-this.lastT>Rn)return this.seek(s),0;let n=0;const{times:o,strengths:a,kinds:l}=t;for(;this.next<o.length&&o[this.next]<=s;this.next+=1){const r=o[this.next];l[this.next]!==fs||a[this.next]<Mn||r-this.lastBump<An||(this.lastBump=r,n=Math.max(n,.3+.7*a[this.next]))}return this.lastT=s,n}reset(){this.list=null,this.key=null}seek(t){const e=this.list?.times;let s=0,n=e?.length??0;for(;s<n;){const o=s+n>>1;e[o]<=t?s=o+1:n=o}this.next=s,this.lastT=t,this.lastBump=-1/0}}const ve=je.nebbiaDrizzleRide,Fn=Et(ve,"rain"),kn=Et(ve,"bump");class Bn{drumBumps=new Tn;env=null;rain=1;step(t,e,s,n,o,a=!0){const l=ze(ve),r=l?He().key:null,h=l&&a?us(r):null;if(t.beginFrame(e,n,a&&!h),h&&!n){const c=this.drumBumps.step(h,r,s),f=gt(kn);c>0&&f>0&&o>0&&t.trigger(e,c*f)}else h||this.drumBumps.reset();this.rain=l?gt(Fn):1,this.env=l?nn():null}}const _n={buildings:1,lights:2,cars:4,road:8},In={slant:48,straight:16,off:0},Nn=(i,[t,e],s,n,o,a,l=null)=>{const r=n/o,h=l?-.04:.595;return{time:a,mist:i.mist,edge:q.edge,refract:q.refract,bus:i.busSpeed,glint:q.glint,neon:i.neon,glassShift:[-t*.35/n,-e*.35/o],sceneShift:[-t/n,-e/o],spotSrc:[i.spotX*r,h],spotSrc2:[(1-i.spotX)*r,h],spotTgt:[s.x/n*r,s.y/o],spotR:Math.max(.02,s.r/o*.75)*(l?.spotScale??1),spotI:i.scenery.includes("spot")?s.i*i.spot:0,scenery:i.scenery.reduce((c,f)=>c|(_n[f]??0),In[i.rain]),dewGlint:i.dewGlint,aqua:l}},Ln=1e3,Dn=3600;class qn{time=0;last=0;tick(t,e){const s=e?0:A(t-this.last,0,.1);return this.time=(this.time+s)%Dn,this.last=t,s}songChanged(){this.time>Ln&&(this.time=0)}}const Cn=81,De=1.5,Un=10,_t=6,ce=4,Pn=25,On=50,Gn=.05;class zn{list=[];inst=new Float32Array(0);rng=st(9191);W=0;H=0;time=0;sinceUpdate=0;lastSize=-1;lastCount=-1;dirty=!0;changed=!0;build(t,e){this.W=t,this.H=e,this.time=0;const s=Math.round(t*e/Cn*De);this.list=Array.from({length:s},()=>this.spawn(this.rng()*Un)),this.inst=new Float32Array(s*6),this.dirty=!0}spawn(t){const{rng:e}=this,s=this.H*(1-e()**1.4),n=s/Math.max(1,this.H),o=e()<.06+.08*n?3+e()*(.55+.7*n):1.2+e()**1.5*(1.35+.4*n);return{x:e()*this.W,y:s,r:o,sy:1+e()*.2,born:t,life:Pn+e()*On,full:!1}}instances(t,e=1,s=1){const n=this.inst;this.time+=Math.min(t,.1),this.sinceUpdate+=Math.min(t,.1);const o=this.time,a=Math.min(this.list.length,Math.round(this.list.length*e/De)),l=s!==this.lastSize;let r=this.dirty||l||a!==this.lastCount;if(!r&&this.sinceUpdate<Gn)return this.changed=!1,n.subarray(0,a*6);if(this.sinceUpdate=0,l)for(const h of this.list)h.full=!1;for(let h=0;h<a;h+=1){let c=this.list[h];o-c.born>_t+c.life+ce&&(c=this.list[h]=this.spawn(o+this.rng()*3));const f=o-c.born,u=f>=_t&&f<=_t+c.life;if(u&&c.full)continue;const d=Math.min(1,Math.max(0,f/_t)),m=Math.min(1,Math.max(0,(_t+c.life+ce-f)/ce)),p=c.r*s*Math.sqrt(d)*Math.sqrt(m),x=p<.5?0:p*8,y=h*6;n[y]=c.x,n[y+1]=c.y,n[y+2]=x,n[y+3]=x*c.sy,n[y+4]=x/100,n[y+5]=1,c.full=u,r=!0}return this.lastSize=s,this.lastCount=a,this.dirty=!1,this.changed=r,n.subarray(0,a*6)}}const Hn=.5;class jn{events=null;cursor=0;lastT=-1/0;hits=[];step(t,e){const{hits:s}=this;if(s.length=0,!t)return this.events=null,s;const n=t!==this.events||e<this.lastT||e-this.lastT>Hn;if(this.lastT=e,n){this.events=t;let o=0,a=t.length;for(;o<a;){const l=o+a>>1;t[l].t<=e?o=l+1:a=l}return this.cursor=o,s}for(;this.cursor<t.length&&t[this.cursor].t<=e;this.cursor+=1){const o=t[this.cursor];o.rhythmic!==!1&&s.push({index:this.cursor,gain:Math.max(.35,o.impact??1),down:o.kind==="downbeat"})}return s}}const Xn=[[1,.35,.72],[.35,.8,1],[.72,.5,1],[1,.72,.35]],he=-.35,qe=1.35,Ce=.4,Vn=.6,dt=i=>{const t=Math.sin(i*127.1+311.7)*43758.5453;return t-Math.floor(t)},Ue=i=>i.kickAge<.07?i.kickFrom+(i.kick-i.kickFrom)*i.kickAge/.07:i.kick*Math.exp(-(i.kickAge-.07)/.3),Wn=1.5,Pe=(i,t,e)=>({xf:dt(t*3.1+i),y:e,depth:dt(t*5.7+i*1.3),rate:1.6+.9*dt(t*2.3+i),phase:dt(t+i*7.3)*Math.PI*2,rise:.012+.012*dt(t*9.1+i),hue:dt(t*4.4+i*11),kick:0,kickFrom:0,kickAge:10,seed:t});class $n{list=Array.from({length:Gt},(t,e)=>Pe(e,e+1,he+dt(e*13.7)*(qe-he)));palette=[[1,.81,.54],[.54,.8,1],[.8,.54,1]];own=1;setPalette(t,e,s){this.palette=[t,e,s]}step(t,e,s,n,o,a,l){const r=Math.round(o.jellies),h=l>0?Ce:1;this.own+=Math.sign(h-this.own)*Math.min(Math.abs(h-this.own),e*(1-Ce)/Wn);const{own:c}=this,{jelly:f,jellyColor:u}=t;for(let d=0;d<r;d+=1){let m=this.list[d];m.phase+=e*m.rate;const p=Math.max(Math.sin(m.phase),0);for(const w of a){if(l<=0)break;m.kickFrom=Ue(m),m.kick=Math.max(m.kickFrom,w.gain*l*(w.down?1:Vn)),m.kickAge=0}m.kickAge+=e;const x=Ue(m);m.y-=e*(m.rise*(1+.9*p*c)+.06*x),m.y<he&&(m=this.list[d]=Pe(d,m.seed+Gt,qe));const y=(m.xf+.02*Math.sin(s*.15+m.hue*10))*(n+.2)-.1,b=d*4;f[b]=y,f[b+1]=m.y,f[b+2]=(.03+.055*m.depth)*o.jellySize,f[b+3]=Math.min(1.3,Math.max(p**3*c,x));const g=Xn[Math.floor(m.hue*4)%4],v=this.palette[Math.floor(m.hue*3.7%1*3)],M=.45+.55*m.depth;for(let w=0;w<3;w+=1)u[b+w]=(g[w]*.65+v[w]*.35)*M;u[b+3]=m.phase}t.count=r}}const Xt=2*Math.PI*2,Yn=2*.3*Xt,Kn=Xt*1.25,Pt=1/120,is=6,Ot=is*3+1;class Jn{x=0;v=0;side=1;carry=0;history=new Float32Array(Ot);head=0;kick(t){this.side=-this.side,this.v=this.side*t*Kn}step(t,e){for(this.carry+=Math.min(t,.1);this.carry>=Pt;)this.carry-=Pt,this.v+=(-Xt*Xt*this.x-Yn*this.v)*Pt,this.x+=this.v*Pt,this.head=(this.head+1)%Ot,this.history[this.head]=this.x;for(let s=0;s<4;s+=1)e[s]=this.history[(this.head-s*is+Ot*2)%Ot]}}const Zn=6,Qn=.45,fe=.06,ti=.25,Oe=i=>{const t=Math.sin(i*91.7+47.3)*43758.5453;return t-Math.floor(t)};class ei{jellies=new $n;cursor=new jn;out={jelly:new Float32Array(Gt*4),jellyColor:new Float32Array(Gt*4),count:0,bubbles:0,sway:new Float32Array(4),bursts:new Float32Array(Yt*4),burstCount:0,beatRows:0,spotScale:1};spotKick=0;spotFrom=0;spotAge=10;weed=new Jn;nextBurst=0;setPalette(t,e,s){this.jellies.setPalette(t,e,s)}step(t,e,s,n,o){const{out:a}=this,l=this.cursor.step(o?.events??null,o?.heard??0);this.jellies.step(a,t,e,s,n,l,o?.jelly??0),a.bubbles=n.bubbles;const{sway:r,bursts:h}=a;for(const f of l){const u=o?.weed??0,d=o?.bubble??0;u>0&&this.weed.kick(f.gain*u*(f.down?1:.7));const m=o?.spot??0;if(m>0&&(this.spotFrom=this.spotLevel(),this.spotKick=Math.max(this.spotFrom,Math.min(1.5,f.gain*m*(f.down?1:.7))),this.spotAge=0),d>0){const p=this.nextBurst*4;h[p]=.17+Oe(f.index)*Math.max(0,s-.34),h[p+1]=e,h[p+2]=Math.min(1,f.gain*d*(f.down?1:.75)),h[p+3]=Oe(f.index*3.3+1)*100,this.nextBurst=(this.nextBurst+1)%Yt}}a.beatRows=o&&o.bubble>0?1:0,this.spotAge+=t,a.spotScale=1+Qn*this.spotLevel(),this.weed.step(t,r);let c=0;for(let f=0;f<Yt;f+=1){const u=e-h[f*4+1];h[f*4+2]>0&&u>=0&&u<Zn?c=f+1:h[f*4+2]=0}return a.burstCount=c,a}spotLevel(){const t=this.spotAge;return t<fe?this.spotFrom+(this.spotKick-this.spotFrom)*t/fe:this.spotKick*Math.exp(-(t-fe)/ti)}}const Lt=je.nebbiaAquaBeat,si=Et(Lt,"jelly"),oi=Et(Lt,"weed"),ni=Et(Lt,"bubble"),ii=Et(Lt,"spot"),ai=["appear","fade","layouts","credits","jitter","warp","hold","refog","writeSpeed","doodle"],ri=(i,t)=>Array.isArray(i)&&Array.isArray(t)?i.join()===t.join():i===t;class li{constructor(t,e,s,n=1){this.input=t,this.theme=e,this.tuning=s,this.renderScale=n,this.aquarium=t.scene==="aquarium"?new ei:null,this.condensation=t.glass==="dew"?new zn:null,this.motion.bump=s.bump,this.canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;display:block",this.glyphs=new ko(ue(e),de(e,600)),t.host.appendChild(this.canvas);try{this.gl=new vo(this.canvas,t.seeThrough,t.scene,t.glass),this.gl.onSpriteReady=()=>this.requestFrame(),this.canvas.addEventListener("webglcontextlost",this.handleContextLost),this.canvas.addEventListener("webglcontextrestored",this.handleContextRestored),this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(t.host),this.applyTheme(),this.resize()}catch(o){throw this.dead=!0,this.observer?.disconnect(),this.canvas.removeEventListener("webglcontextlost",this.handleContextLost),this.canvas.removeEventListener("webglcontextrestored",this.handleContextRestored),this.canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext(),this.canvas.remove(),o}this.fontReady=this.glyphs.fontReady(),document.fonts?.addEventListener("loadingdone",this.handleFontsLoaded),Ro().then(o=>{o&&!this.dead&&(this.glyphs.clear(),this.rebuild())})}input;canvas=document.createElement("canvas");gl;mask=new yn;motion=new zs;spot=new En;energy=new cn;fieldInst=[];condensation;observer=null;glyphs;hits=new ae(0);laid=[];words=[];vocalEnv=null;drizzleRide=new Bn;clock=new qn;aquarium;aquaBeatsOut={events:[],heard:0,jelly:0,weed:0,bubble:0,spot:0};song={lines:[],seed:"nebbia"};theme;tuning;fontScale=1;renderScale;showText=!0;paused=!1;still=!1;W=0;H=0;raf=0;buildToken=0;firstDrawn=!1;dead=!1;fontReady=!0;startedAt=performance.now();shadersLogged=!1;setSong(t){t.seed!==this.song.seed&&this.clock.songChanged(),this.song=t,this.rebuild()}setFontScale(t){t!==this.fontScale&&(this.fontScale=t,this.rebuild())}setShowText(t){t!==this.showText&&(this.showText=t,this.rebuild())}setDaylight(t){this.gl.mistTint=t?[.86,.89,.92]:[.07,.08,.1],this.requestFrame()}setTheme(t){const e=String(Kt(t.lyricsIcons))!==String(Kt(this.theme.lyricsIcons));this.theme=t;const s=this.glyphs.setFont(ue(t),de(t,600));s&&(this.fontReady=this.glyphs.fontReady()),this.applyTheme(),s||e?this.rebuild():this.requestFrame()}setTuning(t){const e=this.tuning;this.tuning=t,this.motion.bump=t.bump,ai.some(s=>!ri(e[s],t[s]))&&this.rebuild(),this.requestFrame()}setRenderScale(t){t!==this.renderScale&&(this.renderScale=t,this.resize())}setPlayback(t,e){this.paused=t,this.still=e,this.requestFrame()}requestFrame(){!this.raf&&!this.dead&&(this.raf=requestAnimationFrame(this.frame))}destroy(){this.dead=!0,cancelAnimationFrame(this.raf),this.observer?.disconnect(),document.fonts?.removeEventListener("loadingdone",this.handleFontsLoaded),this.canvas.removeEventListener("webglcontextlost",this.handleContextLost),this.canvas.removeEventListener("webglcontextrestored",this.handleContextRestored),this.gl.destroy(),this.canvas.remove()}handleContextLost=t=>{t.preventDefault(),cancelAnimationFrame(this.raf),this.dead=!0,this.input.onFailed()};handleContextRestored=()=>{this.input.onRestored()};handleFontsLoaded=()=>{if(this.dead)return;const t=this.glyphs.fontReady(),e=t&&!this.fontReady;this.fontReady=t,e&&(this.glyphs.clear(),this.rebuild())};applyTheme(){const t=gn(this.theme);this.gl.setPalette(t.sky0,t.sky1,t.la,t.lb,t.lc),this.aquarium?.setPalette(t.la,t.lb,t.lc)}aquaBeats(){if(this.still||!ms()||!ze(Lt))return null;const t=He().time;if(t===null)return null;const e=this.aquaBeatsOut;return e.events=bs(),e.heard=t,e.jelly=gt(si),e.weed=gt(oi),e.bubble=gt(ni),e.spot=gt(ii),e}resize(){const{clientWidth:t,clientHeight:e}=this.input.host;if(t<1||e<1)return;const s=t!==this.W||e!==this.H;this.W=t,this.H=e;const n=ds(Math.min(2,window.devicePixelRatio||1),this.renderScale);this.gl.resize(this.W,this.H,n),this.mask.resize(this.W,this.H),s&&(this.condensation?this.condensation.build(this.W,this.H):this.motion.buildField(this.W,this.H),this.rebuild()),this.requestFrame()}rebuild(){const t=++this.buildToken,{lines:e,seed:s,title:n,artist:o}=this.song,a=Kt(this.theme.lyricsIcons),l=a.length?a:Rs;Ms([...l,...Ts(e)]).catch(()=>{}).then(()=>{if(t!==this.buildToken||this.dead||!this.W)return;const r=this.showText?Ls(Bs(e,s,this.tuning.doodle,l),this.tuning.credits?n:null,o):[];this.laid=tn(r,this.glyphs,this.tuning,{W:this.W,H:this.H,fontScale:this.fontScale},s),this.hits=new ae(Vt(String(s))),this.words=r.map(h=>h.words),this.rebuildHits(),this.spot.reset(),this.requestFrame()})}rebuildHits(){this.hits.buildBig(this.laid,this.words,this.W,this.H,this.vocalEnv)}shadersReady(){try{if(this.gl.ready)return this.shadersLogged||(this.shadersLogged=!0,console.info(`[Nebbia] shaders ready ${Math.round(performance.now()-this.startedAt)} ms after start`)),!0}catch(t){return console.warn("[Nebbia] shaders failed to build",t),this.dead=!0,this.input.onFailed(),!1}return this.raf=requestAnimationFrame(this.frame),!1}frame=()=>{if(this.raf=0,this.dead||this.gl.isContextLost||!this.shadersReady()||!this.W||!this.H)return;const t=performance.now()/1e3,e=this.paused||this.still,s=this.clock.tick(t,this.paused),n=this.input.currentTime.get(),o=this.tuning,a=this.drizzleRide,l=!this.condensation;l||!this.aquarium?a.step(this.motion,t,n,e,o.bump,!this.aquarium):this.motion.beginFrame(t,e,!1);const r=l?a.rain:0;l&&a.env!==this.vocalEnv&&(this.vocalEnv=a.env,this.rebuildHits());const h=this.energy.update(this.input.vocal.get(),Math.max(s,1/60));this.hits.advance(n,h,this.still?0:o.rainHit*r,ae.lifeOf(o.refog,q.beadHold),this.W,this.H),this.mask.draw(this.laid,n,t,o,this.motion,this.hits,o.rainBig*r),this.spot.update(this.laid,n,s);const c=this.aquarium?.step(s,this.clock.time,this.W/this.H,o,this.aquaBeats())??null,f=this.condensation?this.condensation.instances(e?0:s,o.dew,o.dewSize):this.motion.fieldInstances(this.fieldInst,o.busSpeed);this.gl.render(this.mask.ctx,this.mask.breath.active?this.mask.breath.canvas:null,this.motion.drops,f,Nn(o,this.motion.shake(),this.spot,this.W,this.H,this.clock.time,c),this.condensation?.changed??!0),this.firstDrawn||(this.firstDrawn=!0,this.input.onFirstFrame()),this.paused||(this.raf=requestAnimationFrame(this.frame))}}const ci=(i,t,e=!1)=>i.behind==="backdrop"||!e&&!!t?.transparent,hi=[],bi=i=>{const{currentTime:t,currentLineIndex:e,lines:s,theme:n,audioPower:o,audioBands:a,showText:l=!0,lyricsFontScale:r=1,staticMode:h=!1,paused:c=!1,seed:f="nebbia",songTitle:u,songArtist:d,isPlayerChromeHidden:m=!1,hideTranslationSubtitle:p=!1,isPreviewMode:x=!1,showSubtitleTranslation:y=!0,subtitleContentMode:b,subtitleTheme:g,subtitleFontScale:v,subtitleOverlayOpacity:M,subtitleOverlayBackground:w,isDaylight:E=!1,nebbiaTuning:S=ps}=i,{t:F}=xs(),B=X.useRef(null),k=X.useRef(null),[I,O]=X.useState(!1),[L,N]=X.useState(0),C=x||S.render.scale==="global"?1:S.render.scale,D=ci(S,i.background,i.isPreviewMode),H=S.behind==="aquarium"&&!D?"aquarium":"night",J=S.glass,U=ws({seed:f,lines:s,currentTime:t,readyGraceMs:3e3}),Z=U.isInstrumental?hi:U.lines,G=X.useMemo(()=>({lines:Z,seed:U.seed??"nebbia",title:u,artist:d}),[Z,U.seed,u,d]),T=X.useRef({theme:n,tuning:S,renderScale:C,song:G,lyricsFontScale:r,showText:l,isDaylight:E,paused:c,staticMode:h});T.current={theme:n,tuning:S,renderScale:C,song:G,lyricsFontScale:r,showText:l,isDaylight:E,paused:c,staticMode:h},X.useEffect(()=>{const ot=B.current;if(!ot)return;let nt;try{const Q=T.current;nt=new li({host:ot,seeThrough:D,scene:H,glass:J,currentTime:t,vocal:a.vocal,onFirstFrame:()=>{},onFailed:()=>O(!0),onRestored:()=>N(ct=>ct+1)},Q.theme,Q.tuning,Q.renderScale),nt.setFontScale(Q.lyricsFontScale),nt.setShowText(Q.showText),nt.setDaylight(Q.isDaylight),nt.setPlayback(Q.paused,Q.staticMode),nt.setSong(Q.song)}catch(Q){console.warn("[Nebbia] runtime failed to start",Q),O(!0);return}return k.current=nt,O(!1),()=>{k.current=null,nt.destroy()}},[a.vocal,t,L,J,H,D]),X.useEffect(()=>{k.current?.setSong(G)},[G]),X.useEffect(()=>{k.current?.setTuning(S)},[S]),X.useEffect(()=>{k.current?.setRenderScale(C)},[C]),X.useEffect(()=>{k.current?.setTheme(n)},[n]),X.useEffect(()=>{k.current?.setFontScale(r)},[r]),X.useEffect(()=>{k.current?.setShowText(l)},[l]),X.useEffect(()=>{k.current?.setDaylight(E)},[E]),X.useEffect(()=>{k.current?.setPlayback(c,h)},[c,h]),X.useEffect(()=>t.on("change",()=>{c&&k.current?.requestFrame()}),[t,c]);const{activeLine:V,recentCompletedLine:W,nextLines:_}=ys({currentTime:t,currentLineIndex:e,lines:s,getLineEndTime:Ge}),j=Ss(r);return Rt.jsxs(gs,{theme:n,audioPower:o,audioBands:a,sharedProps:i,renderBackground:D,children:[Rt.jsxs("div",{className:"pointer-events-none absolute inset-0 z-10 overflow-hidden",style:{background:D?void 0:"#05070a"},children:[Rt.jsx("div",{ref:B,className:"absolute inset-0","aria-hidden":"true"}),I&&Rt.jsx("div",{className:"absolute inset-0 flex items-center justify-center px-10 text-center",style:{color:n.primaryColor,fontFamily:ue(n),fontWeight:de(n,600),fontSize:`clamp(2rem, ${5.4*r}vw, 5.6rem)`},children:l&&!U.isInstrumental?V?.fullText||F("ui.waitingForMusic"):null})]}),Rt.jsx(vs,{showText:l,activeLine:V,recentCompletedLine:W,nextLines:_,theme:n,subtitleTheme:g,translationFontSize:j.translationFontSize,upcomingFontSize:j.upcomingFontSize,subtitleFontScale:v,subtitleOverlayOpacity:M,subtitleOverlayBackground:w,isPlayerChromeHidden:m,hideTranslationSubtitle:p,showSubtitleTranslation:y,subtitleContentMode:b})]})};export{bi as default};
