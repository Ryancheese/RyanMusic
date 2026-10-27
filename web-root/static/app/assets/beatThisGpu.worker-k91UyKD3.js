(function(){"use strict";const wr=`
fn erf_f32(v: f32) -> f32 {
  let a = abs(v);
  let x = 1.0 / (1.0 + 0.3275911 * a);
  let y = 1.0 - ((((1.061405429 * x - 1.453152027) * x + 1.421413741) * x - 0.284496736) * x + 0.254829592) * x * exp(-a * a);
  return select(-y, y, v >= 0.0);
}
fn gelu(v: f32) -> f32 { return 0.5 * v * (1.0 + erf_f32(v * 0.7071067811865476)); }
`,mr=`
struct P { frames: u32, bins: u32 }
@group(0) @binding(0) var<storage, read> mel: array<f32>;      // [T, bins]
@group(0) @binding(1) var<storage, read> scale: array<f32>;
@group(0) @binding(2) var<storage, read> shift: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>; // [bins, T]
@group(0) @binding(4) var<uniform> p: P;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= p.frames * p.bins) { return; }
  let f = i / p.frames;
  let t = i % p.frames;
  out[i] = mel[t * p.bins + f] * scale[f] + shift[f];
}
`,Ve=`
${wr}
struct P { fout: u32, frames: u32, cin: u32, cout: u32, kf: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
@group(0) @binding(1) var<storage, read> w: array<f32>;   // [kf, 3, cin, cout] = [K, cout]
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
@group(0) @binding(4) var<uniform> p: P;
var<workgroup> as_: array<f32, 1024>; // [64 rows][16 k]
var<workgroup> bs_: array<f32, 1024>; // [16 k][64 cols]

fn gather(row: u32, k: u32) -> f32 {
  let ci = k % p.cin;
  let tap = k / p.cin;
  let dt = tap % 3u;
  let df = tap / 3u;
  let t = row % p.frames;
  let fo = row / p.frames;
  let ti = i32(t) + i32(dt) - 1;
  if (ti < 0 || ti >= i32(p.frames)) { return 0.0; }
  return x[((fo * p.kf + df) * p.frames + u32(ti)) * p.cin + ci];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u, @builtin(local_invocation_index) li: u32) {
  let m = p.fout * p.frames;
  let kTotal = p.kf * 3u * p.cin;
  let row0 = wg.y * 64u;
  let col0 = wg.x * 64u;
  var acc: array<array<f32, 4>, 4>;
  for (var k0 = 0u; k0 < kTotal; k0 += 16u) {
    for (var i = 0u; i < 4u; i++) {
      let idx = li + i * 256u;
      let ar = row0 + idx / 16u;
      let ak = k0 + idx % 16u;
      var av = 0.0;
      if (ar < m && ak < kTotal) { av = gather(ar, ak); }
      as_[idx] = av;
      let bk = k0 + idx / 64u;
      let bc = col0 + idx % 64u;
      var bv = 0.0;
      if (bk < kTotal && bc < p.cout) { bv = w[bk * p.cout + bc]; }
      bs_[idx] = bv;
    }
    workgroupBarrier();
    for (var kk = 0u; kk < 16u; kk++) {
      var a: array<f32, 4>;
      var bb: array<f32, 4>;
      for (var i = 0u; i < 4u; i++) { a[i] = as_[(l.y * 4u + i) * 16u + kk]; }
      for (var j = 0u; j < 4u; j++) { bb[j] = bs_[kk * 64u + l.x * 4u + j]; }
      for (var i = 0u; i < 4u; i++) {
        for (var j = 0u; j < 4u; j++) { acc[i][j] += a[i] * bb[j]; }
      }
    }
    workgroupBarrier();
  }
  for (var i = 0u; i < 4u; i++) {
    let r = row0 + l.y * 4u + i;
    if (r >= m) { continue; }
    for (var j = 0u; j < 4u; j++) {
      let c = col0 + l.x * 4u + j;
      if (c >= p.cout) { continue; }
      y[r * p.cout + c] = gelu(acc[i][j] + b[c]);
    }
  }
}
`,Zr=1,kr=2,Xe=4,Jr=8,Oe=(o,r="f32")=>{const a=r!=="f32";return`
${a?"enable f16;":""}
${wr}
struct P { m: u32, n: u32, k: u32, flags: u32, posDiv: u32, posMod: u32, dmodel: u32, wStride: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
${o}
@group(0) @binding(2) var<storage, read> bias: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
@group(0) @binding(4) var<storage, read> table: array<f32>; // [pos][16][cos, sin]
@group(0) @binding(5) var<uniform> p: P;
${a?`var<workgroup> as_: array<vec4h, 256>; // [16 k][16 row quads]
var<workgroup> bs_: array<vec4h, 256>; // [16 k][16 col quads]
var<workgroup> sums_: array<vec4f, 256>; // per-loader row sums of squares
const A_SCALE = 64.0;`:`var<workgroup> as_: array<vec4f, 256>; // [16 k][16 row quads]; afterwards the per-loader row sums of squares
var<workgroup> bs_: array<vec4f, 256>; // [16 k][16 col quads]`}
@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u, @builtin(local_invocation_index) li: u32) {
  let row0 = wg.y * 64u;
  let col0 = wg.x * 64u;
  var acc: array<vec4f, 4>; // acc[j] = rows 4*l.y..+3 of column 4*l.x + j
  // Loader roles: A - invocation li reads k = li % 16 of row quad li / 16; B - k = li / 16, col quad li % 16.
  let aK = li % 16u;
  let aQuad = li / 16u;
  let bK = li / 16u;
  let bQuad = li % 16u;
  var squares = vec4f(0.0);
  for (var k0 = 0u; k0 < p.k; k0 += 16u) {
    var av = vec4f(0.0);
    let ak = k0 + aK;
    if (ak < p.k) {
      for (var r = 0u; r < 4u; r++) {
        let row = row0 + aQuad * 4u + r;
        if (row < p.m) { av[r] = x[row * p.k + ak]; }
      }
    }
    squares = fma(av, av, squares);
    as_[aK * 16u + aQuad] = ${a?"vec4h(select(av, av / A_SCALE, (p.flags & 4u) != 0u))":"av"};
    var bv = ${a?"vec4h":"vec4f"}(0.0);
    let bk = k0 + bK;
    let bc = col0 + bQuad * 4u;
    if (bk < p.k && bc < p.n) { bv = weightQuad((bk * p.wStride + bc) / 4u); }
    bs_[bK * 16u + bQuad] = bv;
    workgroupBarrier();
${a?`${r==="math"?`    var part: array<vec4h, 4>;
`:""}    for (var kk = 0u; kk < 16u; kk++) {
      let a = as_[kk * 16u + l.y];
      let b = bs_[kk * 16u + l.x];
${r==="math"?`      part[0] = fma(a, vec4h(b.x), part[0]);
      part[1] = fma(a, vec4h(b.y), part[1]);
      part[2] = fma(a, vec4h(b.z), part[2]);
      part[3] = fma(a, vec4h(b.w), part[3]);
    }
    for (var j = 0u; j < 4u; j++) { acc[j] += vec4f(part[j]); }`:`      let af = vec4f(a);
      let bf = vec4f(b);
      acc[0] = fma(af, vec4f(bf.x), acc[0]);
      acc[1] = fma(af, vec4f(bf.y), acc[1]);
      acc[2] = fma(af, vec4f(bf.z), acc[2]);
      acc[3] = fma(af, vec4f(bf.w), acc[3]);
    }`}`:`    for (var kk = 0u; kk < 16u; kk++) {
      let a = as_[kk * 16u + l.y];
      let b = bs_[kk * 16u + l.x];
      acc[0] = fma(a, vec4f(b.x), acc[0]);
      acc[1] = fma(a, vec4f(b.y), acc[1]);
      acc[2] = fma(a, vec4f(b.z), acc[2]);
      acc[3] = fma(a, vec4f(b.w), acc[3]);
    }`}
    workgroupBarrier();
  }
  // The 16 loaders of row quad q are invocations 16q..16q+15; their partial sums meet in ${a?"sums_":"as_"}.
  ${a?"sums_":"as_"}[li] = squares;
  workgroupBarrier();
  var rowScale = vec4f(1.0);
  if ((p.flags & 4u) != 0u) {
    var total = vec4f(0.0);
    for (var t = 0u; t < 16u; t++) { total += ${a?"sums_":"as_"}[l.y * 16u + t]; }
    rowScale = ${a?"A_SCALE":"1.0"} / max(sqrt(total), vec4f(1e-12));
  }
  for (var i = 0u; i < 4u; i++) {
    let r = row0 + l.y * 4u + i;
    if (r >= p.m) { continue; }
    var v: array<f32, 4>;
    for (var j = 0u; j < 4u; j++) {
      let c = min(col0 + l.x * 4u + j, p.n - 1u);
      v[j] = acc[j][i] * rowScale[i] + bias[c];
    }
    let c0 = col0 + l.x * 4u;
    if ((p.flags & 8u) != 0u && c0 < 2u * p.dmodel) {
      let pos = (r / p.posDiv) % p.posMod;
      for (var pair = 0u; pair < 2u; pair++) {
        let t = (pos * 16u + ((c0 + 2u * pair) % 32u) / 2u) * 2u;
        let cs = table[t];
        let sn = table[t + 1u];
        let x0 = v[2u * pair];
        let x1 = v[2u * pair + 1u];
        v[2u * pair] = x0 * cs - x1 * sn;
        v[2u * pair + 1u] = x1 * cs + x0 * sn;
      }
    }
    for (var j = 0u; j < 4u; j++) {
      let c = c0 + j;
      if (c >= p.n) { continue; }
      var res = v[j];
      let o = r * p.n + c;
      if ((p.flags & 1u) != 0u) { res = gelu(res); }
      if ((p.flags & 2u) != 0u) { res += y[o]; }
      y[o] = res;
    }
  }
}
`},yr=Oe(`
@group(0) @binding(1) var<storage, read> w: array<vec4f>;
fn weightQuad(i: u32) -> vec4f { return w[i]; }`),_r=Oe(`
@group(0) @binding(1) var<storage, read> w: array<vec2u>; // four fp16 columns per element
fn weightQuad(i: u32) -> vec4f { let q = w[i]; return vec4f(unpack2x16float(q.x), unpack2x16float(q.y)); }`),xr=`
@group(0) @binding(1) var<storage, read> w: array<vec4h>;
fn weightQuad(i: u32) -> vec4h { return w[i]; }`,$r=Oe(xr,"storage"),Mr=Oe(xr,"math"),Ze=o=>`
${o?"enable f16;":""}
struct P { n: u32, heads: u32, width: u32, dmodel: u32, seqStride: u32, batchStride: u32 }
@group(0) @binding(0) var<storage, read> qkv: array<f32>;
@group(0) @binding(1) var<storage, read_write> o: array<f32>; // [rows, dmodel]
@group(0) @binding(2) var<uniform> p: P;
const TILE = 32u;
var<workgroup> ks: array<${o?.k?"vec4h":"vec4f"}, 256>; // [TILE keys][8 x vec4]
var<workgroup> vs: array<${o?"vec4h":"vec4f"}, 256>;
@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u) {
  let b = wg.z;
  let h = wg.y;
  let qi = wg.x * 64u + l.x;
  let valid = qi < p.n;
  let qrow = b * p.batchStride + min(qi, p.n - 1u) * p.seqStride;
  var q: array<vec4f, 8>;
  var acc: array<vec4f, 8>;
  let qBase = qrow * p.width + h * 32u;
  for (var d = 0u; d < 8u; d++) {
    q[d] = vec4f(qkv[qBase + 4u * d], qkv[qBase + 4u * d + 1u], qkv[qBase + 4u * d + 2u], qkv[qBase + 4u * d + 3u]) * 0.17677669529663687;
    acc[d] = vec4f(0.0);
  }
  var m = -3.0e38;
  var sum = 0.0;
  for (var k0 = 0u; k0 < p.n; k0 += TILE) {
    // 32 keys x 8 vec4 = 256 vec4 each for K and V, four per invocation.
    for (var i = 0u; i < 4u; i++) {
      let idx = l.x + i * 64u;
      let kj = k0 + idx / 8u;
      var kv = vec4f(0.0);
      var vv = vec4f(0.0);
      if (kj < p.n) {
        let base = (b * p.batchStride + kj * p.seqStride) * p.width + h * 32u + (idx % 8u) * 4u;
        let kb = base + p.dmodel;
        let vb = base + 2u * p.dmodel;
        kv = vec4f(qkv[kb], qkv[kb + 1u], qkv[kb + 2u], qkv[kb + 3u]);
        vv = vec4f(qkv[vb], qkv[vb + 1u], qkv[vb + 2u], qkv[vb + 3u]);
      }
      ks[idx] = ${o?.k?"vec4h(kv)":"kv"};
      vs[idx] = ${o?"vec4h(vv)":"vv"};
    }
    workgroupBarrier();
    // Constant trip counts so the compiler unrolls and keeps s[] in registers; keys past the end
    // of the sequence get a score of -3e38, whose exp is exactly 0.
    var s: array<f32, 32>;
    var tileMax = -3.0e38;
    for (var j = 0u; j < TILE; j++) {
      var dotv = vec4f(0.0);
      for (var d = 0u; d < 8u; d++) { dotv = fma(q[d], ${o?.k?"vec4f(ks[j * 8u + d])":"ks[j * 8u + d]"}, dotv); }
      s[j] = select(-3.0e38, dotv.x + dotv.y + dotv.z + dotv.w, k0 + j < p.n);
      tileMax = max(tileMax, s[j]);
    }
    let mNew = max(m, tileMax);
    let r = exp(m - mNew);
    sum *= r;
    for (var d = 0u; d < 8u; d++) { acc[d] *= r; }
    m = mNew;
${o?.pv?`    var part: array<vec4h, 8>;
    for (var j = 0u; j < TILE; j++) {
      let e = exp(s[j] - m);
      sum += e;
      let eh = vec4h(f16(e));
      for (var d = 0u; d < 8u; d++) { part[d] = fma(eh, vs[j * 8u + d], part[d]); }
    }
    for (var d = 0u; d < 8u; d++) { acc[d] += vec4f(part[d]); }`:`    for (var j = 0u; j < TILE; j++) {
      let e = exp(s[j] - m);
      sum += e;
      for (var d = 0u; d < 8u; d++) { acc[d] = fma(vec4f(e), ${o?"vec4f(vs[j * 8u + d])":"vs[j * 8u + d]"}, acc[d]); }
    }`}
    workgroupBarrier();
  }
  if (!valid) { return; }
  let gate = 1.0 / (1.0 + exp(-qkv[qrow * p.width + 3u * p.dmodel + h]));
  let scale = gate / sum;
  let oBase = qrow * p.dmodel + h * 32u;
  for (var d = 0u; d < 8u; d++) {
    let v = acc[d] * scale;
    o[oBase + 4u * d] = v.x;
    o[oBase + 4u * d + 1u] = v.y;
    o[oBase + 4u * d + 2u] = v.z;
    o[oBase + 4u * d + 3u] = v.w;
  }
}
`,qr=Ze(null),jr=Ze({k:!0,pv:!1}),Br=Ze({k:!0,pv:!0}),Sr=`
struct P { freqs: u32, frames: u32, channels: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
@group(0) @binding(1) var<storage, read_write> y: array<f32>;
@group(0) @binding(2) var<uniform> p: P;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= p.freqs * p.frames * p.channels) { return; }
  let c = i % p.channels;
  let t = (i / p.channels) % p.frames;
  let f = i / (p.channels * p.frames);
  y[(t * p.freqs + f) * p.channels + c] = x[i];
}
`,Pr=`
struct P { frames: u32 }
@group(0) @binding(0) var<storage, read> l: array<f32>;
@group(0) @binding(1) var<storage, read_write> out: array<f32>;
@group(0) @binding(2) var<uniform> p: P;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let t = id.x;
  if (t >= p.frames) { return; }
  out[t] = l[t * 2u] + l[t * 2u + 1u];
  out[p.frames + t] = l[t * 2u + 1u];
}
`,Ce=1500,ye=128,Je=32,et=50,rt=o=>o.reduce((r,a)=>r*a,1),tt=new Map([[mr,"stem_bn"],[Ve,"conv"],[yr,"matmul"],[_r,"matmul"],[$r,"matmul"],[Mr,"matmul"],[qr,"attention"],[jr,"attention"],[Br,"attention"],[Sr,"flatten"],[Pr,"sum_head"]]);class er{constructor(r,a,l,d,i){this.device=r,this.build=a,this.melBuffer=l,this.outBuffer=d,this.owned=i}device;build;melBuffer;outBuffer;owned;fineStages=new Set;autoRuns=0;graphs=new Map;get bytes(){let r=this.owned.reduce((a,l)=>a+l.size,0);for(const a of this.graphs.values())r+=a.owned.reduce((l,d)=>l+d.size,0);return r}graph(r){let a=this.graphs.get(r);if(!a){for(const[l,d]of this.graphs)l!==Ce&&(d.owned.forEach(i=>i.destroy()),this.graphs.delete(l));a=this.build(r),this.graphs.set(r,a)}return a.steps}static async create(r,a,l,d={}){if(d.f16&&!r.features.has("shader-f16"))throw new Error("beat_this f16: device lacks shader-f16");const i=Ce,B=[],c=(f,P=0)=>{const H=r.createBuffer({size:Math.max(16,f*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST|P});return B.push(H),H},g=c(Math.ceil(a.byteLength/4));r.queue.writeBuffer(g,0,a.buffer,a.byteOffset,a.byteLength);const h=f=>{const P=l.tensors[f];if(!P)throw new Error(`beat_this weights: missing tensor ${f}`);return P},S=f=>{const{byte_offset:P,shape:H,dtype:k,stride:y}=h(f),R=y?H[0]*y:rt(H);return{buffer:g,offset:P,size:R*(k==="f16"?2:4)}},u=f=>l.tensors[f].shape,x=l.hyper_parameters.transformer_dim,z=l.hyper_parameters.stem_dim,p=l.hyper_parameters.ff_mult,V=ye/4*i,G=f=>3*f+f/Je,O=c(i*ye),ce=c(i*ye),$=[c(V*z),c(V*z)],ne=c(Math.max(V*G(z),i*G(x))),C=c(V*z),M=c(Math.max(V*z*p,i*x*p)),T=c(i*4*z*8),Z=c(i*2),J=c(i*2),v=c(4096),W=a.byteOffset+h("rope.freqs").byte_offset,ee=new Float32Array(a.buffer.slice(W,W+Je/2*4)),N=new Float32Array(i*16*2);for(let f=0;f<i;f+=1)for(let P=0;P<16;P+=1){const H=Math.fround(Math.fround(f)*ee[P]);N[(f*16+P)*2]=Math.cos(H),N[(f*16+P)*2+1]=Math.sin(H)}const me=c(N.length);r.queue.writeBuffer(me,0,N);const re=new Map,Se=f=>{let P=re.get(f);return P||(P=r.createComputePipeline({layout:"auto",compute:{module:r.createShaderModule({code:f}),entryPoint:"main"}}),re.set(f,P)),P},Qe=f=>{const P=[],H=b=>{const _=new Uint32Array(Math.ceil(b.length/4)*4);_.set(b);const L=r.createBuffer({size:_.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return r.queue.writeBuffer(L,0,_),P.push(L),L},k=[];let y="stem";const R=(b,_,L,fe,Q="")=>{const le=Se(b),be=[..._,{buffer:H(L)}].map((Ae,xe)=>({binding:xe,resource:Ae})),ze=`${y} ${tt.get(b)}${Q?` ${Q}`:""}`;k.push({kind:"dispatch",label:ze,pipeline:le,group:r.createBindGroup({layout:le.getBindGroupLayout(0),entries:be}),count:fe})},oe=b=>[Math.ceil(b/64),1,1],te=(b,_,L)=>k.push({kind:"stage",name:b,buffer:_,floats:L}),se=(b,_,L,fe,Q,le,be={posDiv:1,posMod:1,dmodel:0})=>{const[ze,Ae]=u(_),{dtype:xe,stride:ue}=h(_);if(!ue)throw new Error(`beat_this weights: ${_} has no row stride (re-export the weights)`);const pr=d.f16==="math"?Mr:$r;R(xe!=="f16"?yr:d.f16?pr:_r,[{buffer:b},S(_),L?S(L):{buffer:v},{buffer:fe},{buffer:me}],[Q,Ae,ze,le,be.posDiv,be.posMod,be.dmodel,ue],[Math.ceil(Ae/64),Math.ceil(Q/64),1],_.split(".").slice(-2).join("."))},Ee=(b,_,L,fe,Q)=>{const le=fe/Je,be=3*fe+le;y=_,se(b,`${_}.attn.qkvg.w`,`${_}.attn.qkvg.b`,ne,L,Xe|Jr,{posDiv:Q.posDiv,posMod:Q.n,dmodel:fe}),R(d.f16?d.f16==="math"?Br:jr:qr,[{buffer:ne},{buffer:C}],[Q.n,le,be,fe,Q.seqStride,Q.batchStride],[Math.ceil(Q.n/64),le,Q.batches]),se(C,`${_}.attn.out.w`,null,b,L,kr),se(b,`${_}.ff.w1`,`${_}.ff.b1`,M,L,Xe|Zr),se(M,`${_}.ff.w2`,`${_}.ff.b2`,b,L,kr)};R(mr,[{buffer:O},S("stem.bn.scale"),S("stem.bn.shift"),{buffer:ce}],[f,ye],oe(f*ye));let X=ye/4,I=z;R(Ve,[{buffer:ce},S("stem.conv.w"),S("stem.conv.b"),{buffer:$[0]}],[X,f,1,I,4],[Math.ceil(I/64),Math.ceil(X*f/64),1]);let D=0;te("stem",$[D],X*f*I);for(let b=0;b<3;b+=1){const _=X*f;Ee($[D],`block${b}.freq`,_,I,{n:X,seqStride:f,batchStride:1,batches:f,posDiv:f}),te(`block${b}_freq`,$[D],_*I),Ee($[D],`block${b}.time`,_,I,{n:f,seqStride:1,batchStride:f,batches:X,posDiv:1}),te(`block${b}_time`,$[D],_*I);const L=1-D;y=`block${b}`,R(Ve,[{buffer:$[D]},S(`block${b}.conv.w`),S(`block${b}.conv.b`),{buffer:$[L]}],[X/2,f,I,I*2,2],[Math.ceil(I*2/64),Math.ceil(X/2*f/64),1]),D=L,X/=2,I*=2,te(`block${b}_conv`,$[D],X*f*I)}y="frontend",R(Sr,[{buffer:$[D]},{buffer:T}],[X,f,I],oe(X*f*I)),D=1-D,se(T,"frontend.linear.w","frontend.linear.b",$[D],f,0),te("frontend",$[D],f*x);for(let b=0;b<l.hyper_parameters.n_layers;b+=1)Ee($[D],`layer${b}`,f,x,{n:f,seqStride:1,batchStride:f,batches:1,posDiv:1}),te(`layer${b}`,$[D],f*x);return y="head",se($[D],"head.w","head.b",Z,f,Xe),R(Pr,[{buffer:Z},{buffer:J}],[f],oe(f)),te("logits",J,f*2),{steps:k,owned:P}},Pe=new er(r,Qe,O,J,B);return Pe.graph(i),await r.queue.onSubmittedWorkDone(),Pe}async run(r,a={}){const l=r.length/ye;if(!Number.isInteger(l)||l<1||l>Ce)throw new Error(`beat_this chunk must be 1..${Ce} frames x ${ye}, got ${r.length} values`);const d=this.graph(l),{device:i}=this;i.queue.writeBuffer(this.melBuffer,0,r.buffer,r.byteOffset,r.byteLength);let B=i.createCommandEncoder();const c=[],g=a.profile&&i.features.has("timestamp-query")?d.filter(v=>v.kind==="dispatch"):[],h=g.length?i.createQuerySet({type:"timestamp",count:g.length*2}):null;let S=0,u=null,x=0,z=0;const p=a.slice??"none",V=p==="auto"?1:Math.max(1,a.inFlight??1),G=[],O=async(v=!1)=>{u?.end(),u=null;const W=performance.now();for(i.queue.submit([B.finish()]),G.push(i.queue.onSubmittedWorkDone());G.length>(v?0:V-1);)await G.shift();const ee=performance.now()-W;return x+=ee,z+=1,B=i.createCommandEncoder(),ee},ce=a.budgetMs??8;p==="auto"&&++this.autoRuns%et===0&&this.fineStages.clear();let $=0;const ne=performance.now();for(const v of d){if((p==="dispatch"||p==="auto"&&this.fineStages.has($))&&u&&(await O(),await a.between?.()),v.kind==="dispatch"){h&&(u?.end(),u=B.beginComputePass({timestampWrites:{querySet:h,beginningOfPassWriteIndex:S,endOfPassWriteIndex:S+1}}),S+=2),u??=B.beginComputePass(),u.setPipeline(v.pipeline),u.setBindGroup(0,v.group),u.dispatchWorkgroups(...v.count);continue}if((p==="stage"||p==="auto"&&!this.fineStages.has($))&&v.name!=="logits"){const me=await O();p==="auto"&&me>ce&&this.fineStages.add($),await a.between?.()}if($+=1,!a.stages&&v.name!=="logits")continue;u?.end(),u=null;const N=i.createBuffer({size:v.floats*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});B.copyBufferToBuffer(v.buffer,0,N,0,v.floats*4),c.push({name:v.name,buffer:N})}u?.end();let C=null;if(h){const v=i.createBuffer({size:S*8,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});C=i.createBuffer({size:S*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),B.resolveQuerySet(h,0,S,v,0),B.copyBufferToBuffer(v,0,C,0,S*8)}await O(!0);const M=performance.now()-ne,T={};for(const{name:v,buffer:W}of c)await W.mapAsync(GPUMapMode.READ),T[v]=new Float32Array(W.getMappedRange().slice(0)),W.destroy();let Z;if(C){await C.mapAsync(GPUMapMode.READ);const v=new BigInt64Array(C.getMappedRange());Z=g.map((W,ee)=>({label:W.kind==="dispatch"?W.label:"",ms:Number(v[ee*2+1]-v[ee*2])/1e6})),C.destroy(),h?.destroy()}const J=T.logits;return{beat:J.subarray(0,l),downbeat:J.subarray(l,2*l),gpuMs:x,wallMs:M,slices:z,...a.stages?{stages:T}:{},...Z?{profile:Z}:{}}}destroy(){this.owned.forEach(r=>r.destroy()),this.graphs.forEach(r=>r.owned.forEach(a=>a.destroy()))}}const Ne=128,Er=64,rr=1024,at=`
struct Params { frames: u32, first: u32, count: u32 }
@group(0) @binding(0) var<storage, read> mel: array<f32>;
@group(0) @binding(1) var<storage, read_write> energy: array<f32>;
@group(0) @binding(2) var<uniform> p: Params;

const BANDS: i32 = ${Ne};
const HALF: i32 = 8;
const TAPS: i32 = 17;

fn magnitude(frame: i32, band: i32) -> f32 {
  if (frame < 0 || frame >= i32(p.frames) || band < 0 || band >= BANDS) { return 0.0; }
  let v = mel[u32(frame * BANDS + band)];
  // expm1 without its cancellation near 0.
  if (v < 1e-3) { return max(0.0, v + 0.5 * v * v); }
  return exp(v) - 1.0;
}

fn median(values: ptr<function, array<f32, 17>>) -> f32 {
  for (var i = 1; i < TAPS; i++) {
    let value = (*values)[i];
    var j = i - 1;
    while (j >= 0 && (*values)[j] > value) {
      (*values)[j + 1] = (*values)[j];
      j--;
    }
    (*values)[j + 1] = value;
  }
  return (*values)[HALF];
}

@compute @workgroup_size(${Er})
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= p.count) { return; }
  let at = p.first + id.x;
  let frame = i32(at);
  var percussive = 0.0;
  var total = 0.0;
  var taps: array<f32, 17>;
  for (var band = 0; band < BANDS; band++) {
    for (var k = 0; k < TAPS; k++) { taps[k] = magnitude(frame + k - HALF, band); }
    let harmonic = median(&taps);
    for (var k = 0; k < TAPS; k++) { taps[k] = magnitude(frame, band + k - HALF); }
    let hit = median(&taps);
    let value = magnitude(frame, band);
    let e = value * value;
    let hh = harmonic * harmonic;
    let pp = hit * hit;
    if (hh + pp > 0.0) { percussive += e * pp / (hh + pp); }
    total += e;
  }
  energy[2u * at] = percussive;
  energy[2u * at + 1u] = total;
}
`,Ar=new WeakMap,Ur=async(o,r,a)=>{if(a<1||r.length<a*Ne)throw new Error(`percussive: ${r.length} floats for ${a} frames`);let l=Ar.get(o);l||(l=await o.createComputePipelineAsync({layout:"auto",compute:{module:o.createShaderModule({code:at}),entryPoint:"main"}}),Ar.set(o,l));const d=o.createBuffer({size:a*Ne*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),i=o.createBuffer({size:a*2*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),B=Math.ceil(a/rr),c=o.createBuffer({size:B*256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),g=o.createBuffer({size:a*2*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});try{o.queue.writeBuffer(d,0,r.buffer,r.byteOffset,a*Ne*4);for(let x=0;x<B;x+=1){const z=x*rr,p=Math.min(rr,a-z);o.queue.writeBuffer(c,x*256,new Uint32Array([a,z,p,0]));const V=o.createBindGroup({layout:l.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:d}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:c,offset:x*256,size:16}}]}),G=o.createCommandEncoder(),O=G.beginComputePass();O.setPipeline(l),O.setBindGroup(0,V),O.dispatchWorkgroups(Math.ceil(p/Er)),O.end(),x===B-1&&G.copyBufferToBuffer(i,0,g,0,a*2*4),o.queue.submit([G.finish()]),await o.queue.onSubmittedWorkDone()}await g.mapAsync(GPUMapMode.READ);const h=new Float32Array(g.getMappedRange().slice(0));g.unmap();const S=new Float32Array(a),u=new Float32Array(a);for(let x=0;x<a;x+=1)S[x]=h[2*x],u[x]=h[2*x+1];return{percussive:S,total:u}}finally{d.destroy(),i.destroy(),c.destroy(),g.destroy()}},tr=`
fn erf_f32(v: f32) -> f32 {
  let a = abs(v);
  let x = 1.0 / (1.0 + 0.3275911 * a);
  let y = 1.0 - ((((1.061405429 * x - 1.453152027) * x + 1.421413741) * x - 0.284496736) * x + 0.254829592) * x * exp(-a * a);
  return select(-y, y, v >= 0.0);
}
fn gelu(v: f32) -> f32 { return 0.5 * v * (1.0 + erf_f32(v * 0.7071067811865476)); }
`,$e=1,Te=2,Tr=o=>o?`
@group(0) @binding(1) var<storage, read> w: array<u32>;
fn wload(e: u32) -> f32 {
  let pair = unpack2x16float(w[e >> 1u]);
  return select(pair.x, pair.y, (e & 1u) == 1u);
}`:`
@group(0) @binding(1) var<storage, read> w: array<f32>;
fn wload(e: u32) -> f32 { return w[e]; }`,ar=o=>`
var<workgroup> as_: array<${o==="f16"?"vec4h":"vec4f"}, 256>;
var<workgroup> bs_: array<${o==="f16"?"vec4h":"vec4f"}, 256>;`,Me=(o,r)=>`${o==="f16"?"vec4h":"vec4f"}(${r})`,nr=o=>o==="f16"?`
    var part: array<vec4h, 4>;
    for (var kk = 0u; kk < 16u; kk++) {
      let a = as_[kk * 16u + l.y];
      let bb = bs_[kk * 16u + l.x];
      for (var i = 0u; i < 4u; i++) { part[i] = fma(vec4h(a[i]), bb, part[i]); }
    }
    for (var i = 0u; i < 4u; i++) { acc[i] += vec4f(part[i]); }`:`
    for (var kk = 0u; kk < 16u; kk++) {
      let a = as_[kk * 16u + l.y];
      let bb = bs_[kk * 16u + l.x];
      for (var i = 0u; i < 4u; i++) { acc[i] = fma(vec4f(a[i]), bb, acc[i]); }
    }`,Ie=o=>o==="f16"?"enable f16;":"",Lr=(o,r)=>`
${ar(r)}
@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u, @builtin(local_invocation_index) li: u32) {
  let n = ${o};
  let row0 = wg.y * 64u;
  let col0 = wg.x * 64u;
  var acc: array<vec4f, 4>;
  for (var k0 = 0u; k0 < p.k; k0 += 16u) {
    // Invocation li: rows 4 (li / 16).. at k li % 16 of A, columns 4 (li % 16).. at k li / 16 of B.
    let ak = k0 + li % 16u;
    var av = vec4f(0.0);
    let bk = k0 + li / 16u;
    var bv = vec4f(0.0);
    for (var c = 0u; c < 4u; c++) {
      let ar = row0 + (li / 16u) * 4u + c;
      if (ar < p.m && ak < p.k) { av[c] = wload(ar * p.k + ak); }
      let bc = col0 + (li % 16u) * 4u + c;
      if (bk < p.k && bc < n) { bv[c] = gather(bk, bc); }
    }
    as_[(li % 16u) * 16u + li / 16u] = ${Me(r,"av")};
    bs_[li] = ${Me(r,"bv")};
    workgroupBarrier();${nr(r)}
    workgroupBarrier();
  }
  for (var i = 0u; i < 4u; i++) {
    let r = row0 + l.y * 4u + i;
    if (r >= p.m) { continue; }
    for (var j = 0u; j < 4u; j++) {
      let c = col0 + l.x * 4u + j;
      if (c >= n) { continue; }
      store(r, c, acc[i][j]);
    }
  }
}
`,nt=(o,r="f32")=>`
${Ie(r)}
${tr}
struct P { m: u32, k: u32, cin: u32, kh: u32, kw: u32, sh: u32, sw: u32, ph: u32, pw: u32, dh: u32, dw: u32, hin: u32, win: u32, hout: u32, wout: u32, flags: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
${Tr(o)}
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read> side: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
@group(0) @binding(5) var<uniform> p: P;

fn gather(k: u32, n: u32) -> f32 {
  let taps = p.kh * p.kw;
  let ci = k / taps;
  let r = k - ci * taps;
  let a = r / p.kw;
  let c = r - a * p.kw;
  let ho = n / p.wout;
  let wo = n - ho * p.wout;
  let hi = i32(ho * p.sh + a * p.dh) - i32(p.ph);
  let wi = i32(wo * p.sw + c * p.dw) - i32(p.pw);
  if (hi < 0 || hi >= i32(p.hin) || wi < 0 || wi >= i32(p.win)) { return 0.0; }
  return x[(ci * p.hin + u32(hi)) * p.win + u32(wi)];
}

fn store(r: u32, c: u32, sum: f32) {
  var v = sum + b[r];
  if ((p.flags & ${$e}u) != 0u) { v = gelu(v); }
  let o = r * p.hout * p.wout + c;
  if ((p.flags & ${Te}u) != 0u) { y[o] = y[o] + side[r] * v; } else { y[o] = v; }
}
${Lr("p.hout * p.wout",r)}
`,ot=(o,r="f32")=>`
${Ie(r)}
${tr}
struct P { m: u32, k: u32, cin: u32, hin: u32, win: u32, axis: u32, flags: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
${Tr(o)}
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
@group(0) @binding(4) var<uniform> p: P;

fn gather(k: u32, n: u32) -> f32 {
  let ci = k / 2u;
  let t = k - ci * 2u;
  if (p.axis == 0u) {
    let q = n / p.win;
    let w = n - q * p.win;
    if (q < t || q - t >= p.hin) { return 0.0; }
    return x[(ci * p.hin + q - t) * p.win + w];
  }
  let h = n / (p.win + 1u);
  let q = n - h * (p.win + 1u);
  if (q < t || q - t >= p.win) { return 0.0; }
  return x[(ci * p.hin + h) * p.win + q - t];
}

fn store(r: u32, c: u32, sum: f32) {
  let co = r / 4u;
  let ph = r - co * 4u;
  var v = sum + b[co];
  if ((p.flags & ${$e}u) != 0u) { v = gelu(v); }
  if (p.axis == 0u) {
    let q = c / p.win;
    let w = c - q * p.win;
    let o = 4u * q + ph;
    if (o < 2u || o - 2u >= 4u * p.hin) { return; }
    y[(co * 4u * p.hin + o - 2u) * p.win + w] = v;
  } else {
    let h = c / (p.win + 1u);
    let q = c - h * (p.win + 1u);
    let o = 4u * q + ph;
    if (o < 2u || o - 2u >= 4u * p.win) { return; }
    y[(co * p.hin + h) * 4u * p.win + o - 2u] = v;
  }
}
${Lr("select(p.hin * (p.win + 1u), (p.hin + 1u) * p.win, p.axis == 0u)",r)}
`,or=`
struct P { parts: u32, c: u32, inner: u32, cs: u32, gs: u32, mode: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
@group(0) @binding(1) var<storage, read> stats: array<f32>;
@group(0) @binding(2) var<storage, read_write> partial: array<f32>;
@group(0) @binding(3) var<uniform> p: P;
var<workgroup> sums: array<f32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_index) li: u32) {
  let g = wg.y;
  let n = p.c * p.inner;
  let chunk = (n + p.parts - 1u) / p.parts;
  let lo = wg.x * chunk;
  let hi = min(n, lo + chunk);
  let mean = stats[g * 4u];
  var s = 0.0;
  for (var e = lo + li; e < hi; e += 256u) {
    let ch = e / p.inner;
    let v = x[ch * p.cs + g * p.gs + e - ch * p.inner];
    if (p.mode == 0u) { s += v; } else { let d = v - mean; s = fma(d, d, s); }
  }
  sums[li] = s;
  workgroupBarrier();
  for (var span = 128u; span > 0u; span >>= 1u) {
    if (li < span) { sums[li] += sums[li + span]; }
    workgroupBarrier();
  }
  if (li == 0u) { partial[g * p.parts + wg.x] = sums[0]; }
}
`,sr=`
struct P { parts: u32, n: u32, mode: u32 }
@group(0) @binding(0) var<storage, read> partial: array<f32>;
@group(0) @binding(1) var<storage, read_write> stats: array<f32>;
@group(0) @binding(2) var<uniform> p: P;
var<workgroup> sums: array<f32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_index) li: u32) {
  let g = wg.x;
  var s = 0.0;
  for (var i = li; i < p.parts; i += 256u) { s += partial[g * p.parts + i]; }
  sums[li] = s;
  workgroupBarrier();
  for (var span = 128u; span > 0u; span >>= 1u) {
    if (li < span) { sums[li] += sums[li + span]; }
    workgroupBarrier();
  }
  if (li != 0u) { return; }
  let total = sums[0];
  let n = f32(p.n);
  if (p.mode == 0u) {
    stats[g * 4u] = total / n;
  } else if (p.mode == 1u) {
    stats[g * 4u + 1u] = 1.0 / sqrt(total / n + 1e-5);
  } else {
    let sd = sqrt(total / (n - 1.0));
    stats[g * 4u + 1u] = 1.0 / (sd + 1e-5);
    stats[g * 4u + 2u] = sd;
  }
}
`,ur=`
${tr}
struct P { c: u32, h: u32, w: u32, perH: u32, gelu: u32 }
@group(0) @binding(0) var<storage, read_write> x: array<f32>;
@group(0) @binding(1) var<storage, read> stats: array<f32>;
@group(0) @binding(2) var<storage, read> gamma: array<f32>;
@group(0) @binding(3) var<storage, read> beta: array<f32>;
@group(0) @binding(4) var<uniform> p: P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) groups: vec3u) {
  let i = id.x + id.y * groups.x * 256u;
  let plane = p.h * p.w;
  if (i >= p.c * plane) { return; }
  let ch = i / plane;
  let g = select(0u, (i - ch * plane) / p.w, p.perH == 1u);
  var v = (x[i] - stats[g * 4u]) * stats[g * 4u + 1u] * gamma[ch] + beta[ch];
  if (p.gelu == 1u) { v = gelu(v); }
  x[i] = v;
}
`,zr=`
struct P { c: u32, h: u32, w: u32, perH: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
@group(0) @binding(1) var<storage, read> stats: array<f32>;
@group(0) @binding(2) var<storage, read> gamma: array<f32>;
@group(0) @binding(3) var<storage, read> beta: array<f32>;
@group(0) @binding(4) var<storage, read> scale: array<f32>;
@group(0) @binding(5) var<storage, read_write> res: array<f32>;
@group(0) @binding(6) var<uniform> p: P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) groups: vec3u) {
  let i = id.x + id.y * groups.x * 256u;
  let plane = p.h * p.w;
  if (i >= p.c * plane) { return; }
  let ch = i / plane;
  let at = i - ch * plane;
  let g = select(0u, at / p.w, p.perH == 1u);
  let mean = stats[g * 4u];
  let rstd = stats[g * 4u + 1u];
  let a = (x[i] - mean) * rstd * gamma[ch] + beta[ch];
  let gch = ch + p.c;
  let gate = (x[gch * plane + at] - mean) * rstd * gamma[gch] + beta[gch];
  res[i] = res[i] + scale[ch] * (a / (1.0 + exp(-gate)));
}
`,Le=`
struct P { c: u32, h: u32, w: u32, emb: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
@group(0) @binding(1) var<storage, read> emb: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
@group(0) @binding(3) var<uniform> p: P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) groups: vec3u) {
  let i = id.x + id.y * groups.x * 256u;
  let plane = p.h * p.w;
  if (i >= p.c * plane) { return; }
  var v = x[i] / (1.0 + exp(-x[i + p.c * plane]));
  if (p.emb == 1u) {
    let ch = i / plane;
    v += emb[ch * p.h + (i - ch * plane) / p.w];
  }
  y[i] = v;
}
`,ir=`
struct P { n: u32 }
@group(0) @binding(0) var<storage, read_write> x: array<f32>;
@group(0) @binding(1) var<storage, read> y: array<f32>;
@group(0) @binding(2) var<uniform> p: P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) groups: vec3u) {
  let i = id.x + id.y * groups.x * 256u;
  if (i < p.n) { x[i] = x[i] + y[i]; }
}
`,cr=`
struct P { n: u32 }
@group(0) @binding(0) var<storage, read_write> x: array<f32>;
@group(0) @binding(1) var<storage, read> stats: array<f32>;
@group(0) @binding(2) var<uniform> p: P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) groups: vec3u) {
  let i = id.x + id.y * groups.x * 256u;
  if (i < p.n) { x[i] = (x[i] - stats[0]) * stats[1]; }
}
`,Fe=`
struct P { c: u32, n: u32, pos: u32 }
@group(0) @binding(0) var<storage, read> x: array<f32>;
@group(0) @binding(1) var<storage, read> gamma: array<f32>;
@group(0) @binding(2) var<storage, read> beta: array<f32>;
@group(0) @binding(3) var<storage, read> pos: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
@group(0) @binding(5) var<uniform> p: P;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let t = id.x;
  if (t >= p.n) { return; }
  var s = 0.0;
  for (var ch = 0u; ch < p.c; ch++) { s += x[ch * p.n + t]; }
  let mean = s / f32(p.c);
  var q = 0.0;
  for (var ch = 0u; ch < p.c; ch++) { let d = x[ch * p.n + t] - mean; q = fma(d, d, q); }
  let rstd = 1.0 / sqrt(q / f32(p.c) + 1e-5);
  for (var ch = 0u; ch < p.c; ch++) {
    var v = (x[ch * p.n + t] - mean) * rstd * gamma[ch] + beta[ch];
    if (p.pos == 1u) { v += pos[ch * p.n + t]; }
    y[ch * p.n + t] = v;
  }
}
`,st=(o="f32")=>`
${Ie(o)}
struct P { nq: u32, nk: u32, qr0: u32, kr0: u32, head0: u32 }
@group(0) @binding(0) var<storage, read> q: array<f32>;
@group(0) @binding(1) var<storage, read> kv: array<f32>;
@group(0) @binding(2) var<storage, read_write> s: array<f32>;
@group(0) @binding(3) var<uniform> p: P;
${ar(o)} // [16 d][16 query quads], [16 d][16 key quads]
@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u, @builtin(local_invocation_index) li: u32) {
  let h = p.head0 + wg.z;
  let row0 = wg.y * 64u;
  let col0 = wg.x * 64u;
  var acc: array<vec4f, 4>;
  for (var d0 = 0u; d0 < 64u; d0 += 16u) {
    // Invocation li: queries and keys 4 (li % 16).. at dimension li / 16.
    let d = d0 + li / 16u;
    var av = vec4f(0.0);
    var bv = vec4f(0.0);
    for (var c = 0u; c < 4u; c++) {
      let e = (li % 16u) * 4u + c;
      let i = row0 + e;
      let j = col0 + e;
      av[c] = select(0.0, q[(p.qr0 + h * 64u + d) * p.nq + min(i, p.nq - 1u)], i < p.nq);
      bv[c] = select(0.0, kv[(p.kr0 + h * 64u + d) * p.nk + min(j, p.nk - 1u)], j < p.nk);
    }
    as_[li] = ${Me(o,"av")};
    bs_[li] = ${Me(o,"bv")};
    workgroupBarrier();${nr(o)}
    workgroupBarrier();
  }
  for (var i = 0u; i < 4u; i++) {
    let r = row0 + l.y * 4u + i;
    if (r >= p.nq) { continue; }
    for (var j = 0u; j < 4u; j++) {
      let c = col0 + l.x * 4u + j;
      if (c < p.nk) { s[(wg.z * p.nq + r) * p.nk + c] = acc[i][j]; }
    }
  }
}
`,Gr=`
struct P { nk: u32 }
@group(0) @binding(0) var<storage, read_write> s: array<f32>;
@group(0) @binding(1) var<uniform> p: P;
var<workgroup> red: array<f32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(num_workgroups) groups: vec3u, @builtin(local_invocation_index) li: u32) {
  let base = (wg.x + wg.y * groups.x) * p.nk;
  var m = -3.0e38;
  for (var j = li; j < p.nk; j += 256u) { m = max(m, s[base + j]); }
  red[li] = m;
  workgroupBarrier();
  for (var span = 128u; span > 0u; span >>= 1u) {
    if (li < span) { red[li] = max(red[li], red[li + span]); }
    workgroupBarrier();
  }
  m = red[0];
  workgroupBarrier();
  var sum = 0.0;
  for (var j = li; j < p.nk; j += 256u) {
    let e = exp(s[base + j] - m);
    s[base + j] = e;
    sum += e;
  }
  red[li] = sum;
  workgroupBarrier();
  for (var span = 128u; span > 0u; span >>= 1u) {
    if (li < span) { red[li] += red[li + span]; }
    workgroupBarrier();
  }
  let inv = 1.0 / red[0];
  for (var j = li; j < p.nk; j += 256u) { s[base + j] *= inv; }
}
`,ut=(o="f32")=>`
${Ie(o)}
struct P { nq: u32, nk: u32, vr0: u32, head0: u32 }
@group(0) @binding(0) var<storage, read> s: array<f32>;
@group(0) @binding(1) var<storage, read> kv: array<f32>;
@group(0) @binding(2) var<storage, read_write> o: array<f32>;
@group(0) @binding(3) var<uniform> p: P;
${ar(o)} // [16 keys][16 query quads], [16 keys][16 d quads]
@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u, @builtin(local_invocation_index) li: u32) {
  let h = p.head0 + wg.z;
  let row0 = wg.y * 64u;
  var acc: array<vec4f, 4>;
  for (var j0 = 0u; j0 < p.nk; j0 += 16u) {
    // Invocation li: queries and dimensions 4 (li / 16).. at key li % 16.
    let jj = li % 16u;
    let j = j0 + jj;
    var a = vec4f(0.0);
    var b = vec4f(0.0);
    for (var c = 0u; c < 4u; c++) {
      let r = (li / 16u) * 4u + c;
      let i = row0 + r;
      if (j < p.nk) {
        if (i < p.nq) { a[c] = s[(wg.z * p.nq + i) * p.nk + j]; }
        b[c] = kv[(p.vr0 + h * 64u + r) * p.nk + j];
      }
    }
    as_[jj * 16u + li / 16u] = ${Me(o,"a")};
    bs_[jj * 16u + li / 16u] = ${Me(o,"b")};
    workgroupBarrier();${nr(o)}
    workgroupBarrier();
  }
  for (var i = 0u; i < 4u; i++) {
    let r = row0 + l.y * 4u + i;
    if (r >= p.nq) { continue; }
    for (var j = 0u; j < 4u; j++) {
      let d = l.x * 4u + j;
      o[(h * 64u + d) * p.nq + r] = acc[i][j];
    }
  }
}
`,We=4096,Dr=`
struct P { frames: u32, len: u32 }
@group(0) @binding(0) var<storage, read> mix: array<f32>;      // [2, len]
@group(0) @binding(1) var<storage, read> win: array<f32>;
@group(0) @binding(2) var<storage, read> tw: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> y: array<vec2f>;  // [2 frames, 64 k1, 64 n2]
@group(0) @binding(4) var<uniform> p: P;
fn reflect(i: i32, n: i32) -> i32 {
  var j = select(i, -i, i < 0);
  return select(j, 2 * (n - 1) - j, j >= n);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n2 = id.x;
  let k1 = id.y;
  let s = id.z;
  if (n2 >= 64u || k1 >= 64u || s >= 2u * p.frames) { return; }
  let ch = s / p.frames;
  let f = s - ch * p.frames;
  let padded = i32(p.len) + 3072;
  var acc = vec2f(0.0);
  for (var n1 = 0u; n1 < 64u; n1++) {
    let n = n1 * 64u + n2;
    let at = reflect(reflect(i32((f + 2u) * 1024u + n) - 2048, padded) - 1536, i32(p.len));
    let v = mix[ch * p.len + u32(at)] * win[n];
    let t = tw[((k1 * n1) % 64u) * 64u];
    acc += v * vec2f(t.x, -t.y);
  }
  let t = tw[k1 * n2];
  y[(s * 64u + k1) * 64u + n2] = vec2f(acc.x * t.x + acc.y * t.y, acc.y * t.x - acc.x * t.y);
}
`,Rr=`
struct P { frames: u32 }
@group(0) @binding(0) var<storage, read> y: array<vec2f>;
@group(0) @binding(1) var<storage, read> tw: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> spec: array<f32>;
@group(0) @binding(3) var<uniform> p: P;
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let k2 = id.x;
  let k1 = id.y;
  let s = id.z;
  if (k2 >= 32u || k1 >= 64u || s >= 2u * p.frames) { return; }
  var acc = vec2f(0.0);
  for (var n2 = 0u; n2 < 64u; n2++) {
    let v = y[(s * 64u + k1) * 64u + n2];
    let t = tw[((k2 * n2) % 64u) * 64u];
    acc += vec2f(v.x * t.x + v.y * t.y, v.y * t.x - v.x * t.y);
  }
  let ch = s / p.frames;
  let f = s - ch * p.frames;
  let k = k1 + 64u * k2;
  spec[((ch * 2u) * 2048u + k) * p.frames + f] = acc.x;
  spec[((ch * 2u + 1u) * 2048u + k) * p.frames + f] = acc.y;
}
`,Or=`
struct P { frames: u32, source: u32 }
@group(0) @binding(0) var<storage, read> z: array<f32>;     // [16, 2048, frames]
@group(0) @binding(1) var<storage, read> stats: array<f32>;
@group(0) @binding(2) var<storage, read> tw: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> y: array<vec2f>;
@group(0) @binding(4) var<uniform> p: P;
fn bin(ch: u32, f: u32, k: u32) -> vec2f {
  let kk = select(k, 4096u - k, k > 2048u);
  if (kk == 2048u) { return vec2f(0.0); }
  let base = (p.source * 4u + ch * 2u) * 2048u + kk;
  let re = z[base * p.frames + f] * stats[2] + stats[0];
  let im = z[(base + 2048u) * p.frames + f] * stats[2] + stats[0];
  return select(vec2f(re, im), vec2f(re, -im), k > 2048u);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n2 = id.x;
  let k1 = id.y;
  let s = id.z;
  if (n2 >= 64u || k1 >= 64u || s >= 2u * p.frames) { return; }
  let ch = s / p.frames;
  let f = s - ch * p.frames;
  var acc = vec2f(0.0);
  for (var k2 = 0u; k2 < 64u; k2++) {
    let v = bin(ch, f, k1 + 64u * k2);
    let t = tw[((k2 * n2) % 64u) * 64u];
    acc += vec2f(v.x * t.x - v.y * t.y, v.x * t.y + v.y * t.x);
  }
  let t = tw[k1 * n2];
  y[(s * 64u + k1) * 64u + n2] = vec2f(acc.x * t.x - acc.y * t.y, acc.x * t.y + acc.y * t.x);
}
`,Cr=`
struct P { frames: u32 }
@group(0) @binding(0) var<storage, read> y: array<vec2f>;
@group(0) @binding(1) var<storage, read> tw: array<vec2f>;
@group(0) @binding(2) var<storage, read> win: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;  // [2 frames, 4096]
@group(0) @binding(4) var<uniform> p: P;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n2 = id.x;
  let n1 = id.y;
  let s = id.z;
  if (n2 >= 64u || n1 >= 64u || s >= 2u * p.frames) { return; }
  var acc = 0.0;
  for (var k1 = 0u; k1 < 64u; k1++) {
    let v = y[(s * 64u + k1) * 64u + n2];
    let t = tw[((k1 * n1) % 64u) * 64u];
    acc += v.x * t.x - v.y * t.y;
  }
  let n = n1 * 64u + n2;
  out[s * 4096u + n] = acc / 4096.0 * win[n];
}
`,Nr=`
struct P { frames: u32, len: u32, source: u32, out_at: u32 }
@group(0) @binding(0) var<storage, read> fr: array<f32>;
@group(0) @binding(1) var<storage, read> env: array<f32>;
@group(0) @binding(2) var<storage, read> xt: array<f32>;      // [8, len]
@group(0) @binding(3) var<storage, read> tstats: array<f32>;
@group(0) @binding(4) var<storage, read_write> out: array<f32>; // [2, len] at out_at (one per source asked for)
@group(0) @binding(5) var<uniform> p: P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) groups: vec3u) {
  let i = id.x + id.y * groups.x * 256u;
  if (i >= 2u * p.len) { return; }
  let ch = i / p.len;
  let j = i - ch * p.len;
  let pos = 3584u + j;
  var acc = 0.0;
  let last = pos / 1024u;
  for (var jj = select(0u, last - 3u, last >= 3u); jj <= last; jj++) {
    if (jj < 2u || jj >= p.frames + 2u) { continue; }
    let n = pos - jj * 1024u;
    if (n < 4096u) { acc += fr[(ch * p.frames + jj - 2u) * 4096u + n]; }
  }
  let t = xt[(p.source * 2u + ch) * p.len + j] * tstats[2] + tstats[0];
  out[p.out_at + i] = acc / env[1536u + j] + t;
}
`,He=172032,qe=["drums","bass","other","vocals"],w=168,it=8,ie=2048,j=512,ct=8,je=4,ft=50,lt=o=>o.reduce((r,a)=>r*a,1);class fr{constructor(r,a,l,d,i){this.device=r,this.steps=a,this.mixBuffer=l,this.outBuffer=d,this.owned=i}device;steps;mixBuffer;outBuffer;owned;fineStages=new Set;autoRuns=0;get bytes(){return this.owned.reduce((r,a)=>r+a.size,0)}static async create(r,a,l,d={}){if(l.segment!==He)throw new Error(`htdemucs weights are for a ${l.segment}-sample segment, not ${He}`);if(d.f16&&!r.features.has("shader-f16"))throw new Error("htdemucs f16 needs a device opened with shader-f16");const i=d.sources??[d.source??0];if(i.length===0||i.some(e=>!(e>=0&&e<qe.length)))throw new Error(`htdemucs sources must be indices into ${qe.join(", ")}, got ${i.join(", ")}`);const B=d.f16?"f16":"f32",c=st(B),g=ut(B);r.pushErrorScope("validation");const h=He,S=[],u=e=>{const t=r.createBuffer({size:Math.max(16,Math.ceil(e)*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});return S.push(t),t},x=u(Math.ceil(a.byteLength/4));r.queue.writeBuffer(x,0,a.buffer,a.byteOffset,a.byteLength);const z=e=>{const t=l.tensors[e];if(!t)throw new Error(`htdemucs weights: missing tensor ${e}`);return t},p=e=>{const{byte_offset:t,shape:n,dtype:s}=z(e),m=lt(n)*(s==="f16"?2:4);return{buffer:x,offset:t,size:Math.ceil(m/4)*4}},V=e=>z(e).dtype==="f16",G=e=>z(e).shape[0],O=new Float32Array(We*2);for(let e=0;e<We;e+=1)O[e*2]=Math.cos(2*Math.PI*e/We),O[e*2+1]=Math.sin(2*Math.PI*e/We);const ce=u(O.length);r.queue.writeBuffer(ce,0,O);const $=48*(ie/4)*w,ne=u(2*h),C=u(2*h*i.length),M=u(4),T=u(4),Z=u(4*ie),J=u(4096),v=u(64),W=u(2*w*4096*2),ee=u(4*ie*w),N=u($),me=u($/8),re=u(2*$),Se=[u(16*ie*w),u(16*ie*w)],Qe=u(16*ie*w),Pe=u(8*h),f=u(2*w*4096),P=[],H=[];for(let e=0;e<4;e+=1)P.push(u(48*2**e*(ie/4**(e+1))*w)),H.push(u(48*2**e*(h/4**(e+1))));const k=it*w,y=h/256,R=u(j*k),oe=u(j*y),te=u(j*k),se=u(j*y),Ee=u(j*k),X=u(j*y),I=u(3*j*k),D=u(3*j*y),b=u(2*j*y),_=u(2*j*k),L=u(j*k),fe=u(j*y),Q=u(4*j*k),le=u(je*k*k),be=new Map,ze=e=>{let t=be.get(e);return t||(t=r.createComputePipeline({layout:"auto",compute:{module:r.createShaderModule({code:e}),entryPoint:"main"}}),be.set(e,t)),t},Ae=e=>{const t=new Uint32Array(Math.ceil(e.length/4)*4);t.set(e);const n=r.createBuffer({size:t.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return r.queue.writeBuffer(n,0,t),S.push(n),n},xe=[];let ue="input";const pr=new Map([[ir,"add"],[g,"attn_out"],[c,"attn_scores"],[Gr,"softmax"],[Le,"glu"],[zr,"gn_glu"],[ur,"gn"],[Or,"istft_a"],[Cr,"istft_b"],[Fe,"layer_norm"],[cr,"normalize"],[Nr,"overlap_add"],[sr,"stats_final"],[or,"stats"],[Dr,"stft_a"],[Rr,"stft_b"]]),q=(e,t,n,s,m="")=>{const A=ze(e),U=[...t,Ae(n)].map((E,Y)=>({binding:Y,resource:E instanceof GPUBuffer?{buffer:E}:E})),F=`${ue} ${pr.get(e)??"gemm"}${m?` ${m}`:""}`;xe.push({kind:"dispatch",label:F,pipeline:A,group:r.createBindGroup({layout:A.getBindGroupLayout(0),entries:U}),count:s})},pe=e=>{const t=Math.ceil(e/256),n=Math.min(t,32768);return[n,Math.ceil(t/n),1]},ge=(e,t,n)=>xe.push({kind:"stage",name:e,buffer:t,floats:n}),Ge=(e,t,n,s,m,A,U,F)=>{const E=s*m,Y=Math.max(1,Math.min(256,Math.floor(4096/n),Math.ceil(E/16384)));q(or,[e,t,J],[Y,s,m,A,U,0],[Y,n,1]),q(sr,[J,t],[Y,E,0],[n,1,1]),q(or,[e,t,J],[Y,s,m,A,U,1],[Y,n,1]),q(sr,[J,t],[Y,E,F],[n,1,1])},Wr=(e,t,n,s,m)=>{m?Ge(e,Z,n,t,s,n*s,s,1):Ge(e,Z,1,1,t*n*s,0,0,1)},ve=(e,t,n,s,m=0,A=v)=>{const{sh:U=1,sw:F=1,ph:E=0,pw:Y=0,dh:De=1,dw:Re=1}=s,Vr=G(`${t}.w`),Xr=z(`${t}.w`).shape[1],dt=Xr/(s.kh*s.kw),hr=Math.floor((s.hin+2*E-De*(s.kh-1)-1)/U)+1,br=Math.floor((s.win+2*Y-Re*(s.kw-1)-1)/F)+1;return q(nt(V(`${t}.w`),B),[e,p(`${t}.w`),p(`${t}.b`),A,n],[Vr,Xr,dt,s.kh,s.kw,U,F,E,Y,De,Re,s.hin,s.win,hr,br,m],[Math.ceil(hr*br/64),Math.ceil(Vr/64),1],t.split(".").slice(1).join(".")),[hr,br]},Hr=(e,t,n,s,m,A,U)=>{const F=G(`${t}.w`),E=z(`${t}.w`).shape[1],Y=A===0?(s+1)*m:s*(m+1);q(ot(V(`${t}.w`),B),[e,p(`${t}.w`),p(`${t}.b`),n],[F,E,E/2,s,m,A,U],[Math.ceil(Y/64),Math.ceil(F/64),1],"tr")},Ke=(e,t,n,s,m)=>{for(let A=0;A<2;A+=1){const U=`${e}.dc${A}`,F=2**A,E=G(`${U}.c1.w`);ve(N,`${U}.c1`,me,{hin:n,win:s,kh:1,kw:3,pw:F,dw:F}),Wr(me,E,n,s,m),q(ur,[me,Z,p(`${U}.n1.g`),p(`${U}.n1.b`)],[E,n,s,m?1:0,1],pe(E*n*s)),ve(me,`${U}.c2`,re,{hin:n,win:s,kh:1,kw:1}),Wr(re,2*t,n,s,m),q(zr,[re,Z,p(`${U}.n2.g`),p(`${U}.n2.b`),p(`${U}.ls`),N],[t,n,s,m?1:0],pe(t*n*s))}},dr=Pe;Ge(ne,M,1,1,2*h,0,0,2),xe.push({kind:"copy",from:ne,to:dr,bytes:2*h*4}),q(cr,[dr,M],[2*h],pe(2*h)),q(Dr,[ne,p("stft.window"),ce,W],[w,h],[1,64,2*w]),q(Rr,[W,ce,ee],[w],[1,64,2*w]),Ge(ee,T,1,1,4*ie*w,0,0,2),q(cr,[ee,T],[4*ie*w],pe(4*ie*w)),ge("norm_spec",ee,4*ie*w);let Yr=dr,Qr=ee,K=h,ae=ie;for(let e=0;e<4;e+=1){const t=48*2**e;ue=`tenc${e}`;const[,n]=ve(Yr,`tenc${e}.conv`,N,{hin:1,win:K,kh:1,kw:8,sw:4,pw:2},$e);K=n,Ke(`tenc${e}`,t,1,K,!1),ve(N,`tenc${e}.rw`,re,{hin:1,win:K,kh:1,kw:1}),q(Le,[re,v,H[e]],[t,1,K,0],pe(t*K)),ge(`tenc${e}`,H[e],t*K),Yr=H[e],ue=`enc${e}`;const[s]=ve(Qr,`enc${e}.conv`,N,{hin:ae,win:w,kh:8,kw:1,sh:4,ph:2},$e);ae=s,Ke(`enc${e}`,t,ae,w,!0),ve(N,`enc${e}.rw`,re,{hin:ae,win:w,kh:1,kw:1}),q(Le,[re,e===0?p("freq_emb"):v,P[e]],[t,ae,w,e===0?1:0],pe(t*ae*w)),ge(`enc${e}`,P[e],t*ae*w),Qr=P[e]}ue="tf_in",ve(P[3],"up",te,{hin:1,win:k,kh:1,kw:1}),ve(H[3],"up_t",se,{hin:1,win:y,kh:1,kw:1}),q(Fe,[te,p("norm_in.g"),p("norm_in.b"),p("pos"),R],[j,k,1],[Math.ceil(k/64),1,1]),q(Fe,[se,p("norm_in_t.g"),p("norm_in_t.b"),p("pos_t"),oe],[j,y,1],[Math.ceil(y/64),1,1]),ge("tf_in",R,j*k),ge("tf_in_t",oe,j*y);const Ue=(e,t,n,s)=>q(Fe,[e,p(`${t}.g`),p(`${t}.b`),v,n],[j,s,0],[Math.ceil(s/64),1,1]),de=(e,t,n,s,m=0,A=v)=>ve(e,t,n,{hin:1,win:s,kh:1,kw:1},m,A),gr=(e,t,n,s,m,A,U,F)=>{for(let E=0;E<ct;E+=je){const Y=`heads ${E}-${E+je-1}`;q(c,[e,t,le],[s,m,A,U,E],[Math.ceil(m/64),Math.ceil(s/64),je],Y);const De=je*s,Re=Math.min(De,32768);q(Gr,[le],[m],[Re,Math.ceil(De/Re),1],Y),q(g,[le,t,n],[s,m,F,E],[1,Math.ceil(s/64),je],Y)}},vr=(e,t,n,s)=>{Ue(e,`${t}.nf`,s,n),de(s,`${t}.ff1`,Q,n,$e),de(Q,`${t}.ff2`,e,n,Te,p(`${t}.g2`)),Ge(e,Z,1,1,j*n,0,0,1),q(ur,[e,Z,p(`${t}.no.g`),p(`${t}.no.b`)],[j,1,n,0,0],pe(j*n))};for(let e=0;e<5;e+=1){const t=`tf${e}`,n=`tft${e}`;if(ue=t,e%2===0)for(const[s,m,A,U,F,E]of[[R,t,k,te,I,L],[oe,n,y,se,D,fe]])Ue(s,`${m}.n1`,U,A),de(U,`${m}.qkv`,F,A),gr(F,F,E,A,A,0,j,2*j),de(E,`${m}.out`,s,A,Te,p(`${m}.g1`)),vr(s,m,A,U);else Ue(R,`${t}.n1`,te,k),de(te,`${t}.q`,I,k),Ue(oe,`${t}.nkv`,X,y),de(X,`${t}.kv`,b,y),Ue(oe,`${n}.n1`,se,y),de(se,`${n}.q`,D,y),Ue(R,`${n}.nkv`,Ee,k),de(Ee,`${n}.kv`,_,k),gr(I,b,L,k,y,0,0,j),gr(D,_,fe,y,k,0,0,j),de(L,`${t}.out`,R,k,Te,p(`${t}.g1`)),de(fe,`${n}.out`,oe,y,Te,p(`${n}.g1`)),vr(R,t,k,te),vr(oe,n,y,se);ge(`tf${e}`,R,j*k),ge(`tft${e}`,oe,j*y)}let ke=Se[0];ue="dec0",de(R,"down",ke,k);for(let e=0;e<4;e+=1){const t=48*2**(3-e);ue=`dec${e}`;const n=ae*w;q(ir,[ke,P[3-e]],[t*n],pe(t*n)),ve(ke,`dec${e}.rw`,re,{hin:ae,win:w,kh:3,kw:3,ph:1,pw:1}),q(Le,[re,v,N],[t,ae,w,0],pe(t*n)),Ke(`dec${e}`,t,ae,w,!0);const s=e===3?Qe:Se[(e+1)%2];Hr(N,`dec${e}.tr`,s,ae,w,0,e===3?0:$e),ae*=4,ge(`dec${e}`,s,G(`dec${e}.tr.w`)/4*ae*w),ke=s}ke=Se[0],ue="tdec0",de(oe,"down_t",ke,y);for(let e=0;e<4;e+=1){const t=48*2**(3-e);ue=`tdec${e}`,q(ir,[ke,H[3-e]],[t*K],pe(t*K)),ve(ke,`tdec${e}.rw`,re,{hin:1,win:K,kh:1,kw:3,pw:1}),q(Le,[re,v,N],[t,1,K,0],pe(t*K)),Ke(`tdec${e}`,t,1,K,!1);const n=e===3?Pe:Se[(e+1)%2];Hr(N,`tdec${e}.tr`,n,1,K,1,e===3?0:$e),K*=4,ge(`tdec${e}`,n,G(`tdec${e}.tr.w`)/4*K),ke=n}ue="output",i.forEach((e,t)=>{q(Or,[Qe,T,ce,W],[w,e],[1,64,2*w],qe[e]),q(Cr,[W,ce,p("istft.window"),f],[w],[1,64,2*w],qe[e]),q(Nr,[f,p("istft.env"),Pe,M,C],[w,h,e,t*2*h],pe(2*h),qe[e]),t<i.length-1&&ge(`out_${qe[e]}`,C,2*h*(t+1))}),ge("out",C,2*h*i.length);const Kr=await r.popErrorScope();if(Kr)throw S.forEach(e=>e.destroy()),new Error(`htdemucs graph rejected: ${Kr.message}`);const pt=new fr(r,xe,ne,C,S);return await r.queue.onSubmittedWorkDone(),pt}async run(r,a,l={}){const d=He;if(r.length!==d||a.length!==d)throw new Error(`htdemucs segment must be ${d} samples per channel, got ${r.length} and ${a.length}`);const{device:i}=this;i.queue.writeBuffer(this.mixBuffer,0,r.buffer,r.byteOffset,r.byteLength),i.queue.writeBuffer(this.mixBuffer,d*4,a.buffer,a.byteOffset,a.byteLength);let B=i.createCommandEncoder(),c=null;const g=[];let h=0,S=0;const u=l.slice??"none",x=async()=>{c?.end(),c=null;const M=performance.now();i.queue.submit([B.finish()]),await i.queue.onSubmittedWorkDone();const T=performance.now()-M;return h+=T,S+=1,B=i.createCommandEncoder(),T},z=l.budgetMs??8,p=[];let V="";u==="auto"&&++this.autoRuns%ft===0&&this.fineStages.clear();let G=0;const O=performance.now();for(const M of this.steps){if((u==="dispatch"||u==="auto"&&this.fineStages.has(G))&&c){const v=await x();l.timings&&p.push({label:V,ms:v})}if(M.kind==="dispatch"){V=M.label,c??=B.beginComputePass(),c.setPipeline(M.pipeline),c.setBindGroup(0,M.group),c.dispatchWorkgroups(...M.count);continue}if(M.kind==="copy"){c?.end(),c=null,B.copyBufferToBuffer(M.from,0,M.to,0,M.bytes);continue}if((u==="stage"||u==="auto"&&!this.fineStages.has(G))&&M.name!=="out"){const v=await x();u==="auto"&&v>z&&this.fineStages.add(G)}if(G+=1,!l.stages&&M.name!=="out")continue;c?.end(),c=null;const J=i.createBuffer({size:M.floats*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});B.copyBufferToBuffer(M.buffer,0,J,0,M.floats*4),g.push({name:M.name,buffer:J})}await x();const ce=performance.now()-O,$={};for(const{name:M,buffer:T}of g)await T.mapAsync(GPUMapMode.READ),$[M]=new Float32Array(T.getMappedRange().slice(0)),T.destroy();const ne=$.out;l.stages||delete $.out;const C=Array.from({length:ne.length/(2*d)},(M,T)=>({left:ne.subarray(T*2*d,T*2*d+d),right:ne.subarray(T*2*d+d,(T+1)*2*d)}));return{left:C[0].left,right:C[0].right,stems:C,gpuMs:h,wallMs:ce,slices:S,...l.stages?{stages:$}:{},...l.timings?{timings:p}:{}}}destroy(){this.owned.forEach(r=>r.destroy())}}const we=new Map;let he=null,Be=null,Ir="",lr="",Ye=!1,_e=null;const Fr=async()=>{if(Be)return Be;if(!navigator.gpu)throw new Error("no WebGPU in this worker");const o=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!o)throw new Error("no WebGPU adapter");Ye=o.features.has("shader-f16");const r=await o.requestDevice({requiredFeatures:Ye?["shader-f16"]:[]});return r.lost.then(a=>{_e=`device lost (${a.reason}): ${a.message}`,we.clear(),he=null}),lr=`${o.info.vendor} ${o.info.architecture}`,Ir=`${lr}${Ye?" f16":""}`,Be=r,r};self.onmessage=async o=>{const r=o.data;try{if(r.kind==="load"){let c;try{c=await Fr()}catch(g){self.postMessage({id:r.id,error:String(g?.message??g),scope:"device"});return}if(r.model==="htdemucs"){if(!he)try{he=await fr.create(c,r.weights,r.manifest,{sources:[0,1,2,3]})}catch(g){self.postMessage({id:r.id,error:String(g?.message??g),scope:"model"});return}self.postMessage({id:r.id,result:`${lr} f32`,bytes:he?.bytes});return}if(!we.has(r.model))try{we.set(r.model,await er.create(c,r.weights,r.manifest,{f16:Ye?"storage":void 0}))}catch(g){self.postMessage({id:r.id,error:String(g?.message??g),scope:"model"});return}self.postMessage({id:r.id,result:Ir,bytes:we.get(r.model)?.bytes});return}if(r.kind==="percussive"){let c;try{c=await Fr()}catch(h){self.postMessage({id:r.id,error:String(h?.message??h),scope:"device"});return}if(_e)throw new Error(_e);const g=await Ur(c,r.mel,r.frames);self.postMessage({id:r.id,result:g},{transfer:[g.percussive.buffer,g.total.buffer]});return}if(r.kind==="separate"){if(_e)throw new Error(_e);if(!he)throw new Error("htdemucs not loaded");const c=await he.run(r.left,r.right,{slice:"auto"}),{stems:g}=c;self.postMessage({id:r.id,result:{stems:g}},{transfer:[g[0].left.buffer]});return}if(r.kind==="unload"){r.model==="htdemucs"?(he?.destroy(),he=null):(we.get(r.model)?.destroy(),we.delete(r.model)),self.postMessage({id:r.id,result:!0});return}if(r.kind==="dispose"){for(const c of we.values())c.destroy();we.clear(),he?.destroy(),he=null,Be?.destroy(),self.postMessage({id:r.id,result:!0});return}const a=we.get(r.model),l=[],d=[];for(const c of r.chunks){if(_e)throw new Error(_e);if(!a)throw new Error(`${r.model} not loaded`);const g=await a.run(c,{slice:"auto"});l.push(g.beat.slice()),d.push(g.downbeat.slice())}let i;if(r.percussive&&Be&&!_e)try{i=await Ur(Be,r.percussive.mel,r.percussive.frames)}catch(c){console.warn(`[beat-this-gpu] percussive energy failed: ${c?.message??c}`)}const B=[...l,...d,...i?[i.percussive,i.total]:[]];self.postMessage({id:r.id,result:{beat:l,downbeat:d,percussive:i}},{transfer:B.map(c=>c.buffer)})}catch(a){self.postMessage({id:r.id,error:String(a?.message??a)})}}})();
