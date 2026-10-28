const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-D9deetuu.js","assets/index-CzSrVElt.js","assets/index-DnRXOYOC.css","assets/VividLightBlend-Dvj6MjLZ.js"])))=>i.map(i=>d[i]);
import{_ as H}from"./index-CzSrVElt.js";const J=async()=>{const t=await H(()=>import("./index-D9deetuu.js"),__vite__mapDeps([0,1,2,3]));return t.GlProgram.defaultOptions.preferredFragmentPrecision="highp",t},p=globalThis.devicePixelRatio|0,W=(102^p)+Math.imul(111^p,108^p)-((102^p)+Math.imul(111^p,108^p)),Y=`
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`,N=`
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
uniform vec4 uParams; // threshold, knee, prefilter(0/1), 0

vec4 tap(vec2 uv) {
    return texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw));
}

void main(void) {
    vec2 uv = vTextureCoord;
    vec2 hp = uInputPixel.zw;
    vec4 sum = tap(uv) * 4.0;
    sum += tap(uv - hp);
    sum += tap(uv + hp);
    sum += tap(uv + vec2(hp.x, -hp.y));
    sum += tap(uv - vec2(hp.x, -hp.y));
    vec4 c = sum / 8.0;
    if (uParams.z > 0.5) {
        float br = max(c.r, max(c.g, c.b));
        float knee = max(uParams.y, 1e-4);
        float soft = clamp(br - uParams.x + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee);
        float contrib = max(soft, br - uParams.x) / max(br, 1e-4);
        c *= clamp(contrib, 0.0, 1.0);
    }
    finalColor = c;
}
`,V=`
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uAdd;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
uniform vec4 uAddMap;   // uv 缩放 xy、同级权重、0
uniform vec4 uAddClamp;

vec4 tap(vec2 uv) {
    return texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw));
}

void main(void) {
    vec2 uv = vTextureCoord;
    vec2 hp = uInputPixel.zw;
    vec4 sum = tap(uv + vec2(-hp.x * 2.0, 0.0));
    sum += tap(uv + vec2(-hp.x, hp.y)) * 2.0;
    sum += tap(uv + vec2(0.0, hp.y * 2.0));
    sum += tap(uv + vec2(hp.x, hp.y)) * 2.0;
    sum += tap(uv + vec2(hp.x * 2.0, 0.0));
    sum += tap(uv + vec2(hp.x, -hp.y)) * 2.0;
    sum += tap(uv + vec2(0.0, -hp.y * 2.0));
    sum += tap(uv + vec2(-hp.x, -hp.y)) * 2.0;
    vec4 up = sum / 12.0;
    vec4 same = texture(uAdd, clamp(uv * uAddMap.xy, uAddClamp.xy, uAddClamp.zw));
    finalColor = up + same * uAddMap.z;
}
`,j=`
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uAdd;
uniform vec4 uInputClamp;
uniform vec4 uAddMap;   // uv 缩放 xy、强度、0
uniform vec4 uAddClamp;
uniform vec4 uTint;     // 乘在 bloom 上的颜色

void main(void) {
    vec4 base = texture(uTexture, clamp(vTextureCoord, uInputClamp.xy, uInputClamp.zw));
    vec4 glow = texture(uAdd, clamp(vTextureCoord * uAddMap.xy, uAddClamp.xy, uAddClamp.zw)) * uAddMap.z;
    vec3 g = glow.rgb * uTint.rgb;
    // 加上去的辉光也是光：预乘、alpha 取最大通道（与光场一致，近似 screen）。
    vec3 rgb = base.rgb + g * (1.0 - base.a * 0.5);
    // 超过 1 时按最大通道整体缩回（保持金色），只让一小部分变白；逐通道截断会把亮字烧成白块。
    float peak = max(max(rgb.r, rgb.g), rgb.b);
    if (peak > 1.0) rgb = mix(rgb / peak, vec3(1.0), 0.2 * (1.0 - 1.0 / peak));
    float a = base.a + max(max(g.r, g.g), g.b) * (1.0 - base.a);
    finalColor = vec4(rgb, min(max(a, max(max(rgb.r, rgb.g), rgb.b)), 1.0));
}
`,K=(t,_)=>{const{Filter:d,GlProgram:E,TexturePool:v,UniformGroup:g}=t,b=(c,e)=>E.from({vertex:Y,fragment:c,name:e}),y=new g({uParams:{value:new Float32Array(4),type:"vec4<f32>"}}),T=new d({glProgram:b(N,"lumiere-bloom-down"),resources:{bloomDown:y}}),x=new g({uAddMap:{value:new Float32Array(4),type:"vec4<f32>"},uAddClamp:{value:new Float32Array(4),type:"vec4<f32>"}}),h=new d({glProgram:b(V,"lumiere-bloom-up"),resources:{bloomUp:x,uAdd:t.Texture.EMPTY.source}}),o=new g({uAddMap:{value:new Float32Array(4),type:"vec4<f32>"},uAddClamp:{value:new Float32Array(4),type:"vec4<f32>"},uTint:{value:new Float32Array([1,1,1,1]),type:"vec4<f32>"}}),a=new d({glProgram:b(j,"lumiere-bloom-combine"),resources:{bloomCombine:o,uAdd:t.Texture.EMPTY.source}}),A=(c,e,u,n,f)=>{u[0]=c.source.width/e.source.width,u[1]=c.source.height/e.source.height,u[2]=f,n[0]=.5/e.source.pixelWidth,n[1]=.5/e.source.pixelHeight,n[2]=e.frame.width/e.source.width-.5/e.source.pixelWidth,n[3]=e.frame.height/e.source.height-.5/e.source.pixelHeight};class U extends d{options;constructor(e){super({resources:{},compatibleRenderers:t.RendererType.BOTH}),this.options={...e},this.padding=e.padding}apply(e,u,n,f){const{strength:z,threshold:D,knee:R,levels:L,spread:S,tint:w}=this.options,I=()=>{A(u,u,o.uniforms.uAddMap,o.uniforms.uAddClamp,0),o.update(),a.resources.uAdd=u.source,a.blendMode=this.blendMode,e.applyFilter(a,u,n,f)};if(z<=0){I();return}const C=u.frame.width,P=u.frame.height,B=u.source.resolution,s=[];let O=u;const G=Math.max(1,Math.min(8+W,Math.round(L)));for(let r=1;r<=G;r+=1){const i=B/2**r;if(Math.min(C,P)*i<2)break;const m=v.getOptimalTexture(C,P,i,!1),M=y.uniforms.uParams;M[0]=D,M[1]=R,M[2]=r===1?1:0,y.update(),T.blendMode="normal",e.applyFilter(T,O,m,!0),s.push(m),O=m}if(s.length===0){I();return}let l=s[s.length-1];const k=[];for(let r=s.length-2;r>=0;r-=1){const i=s[r],m=v.getOptimalTexture(C,P,i.source.resolution,!1);A(l,i,x.uniforms.uAddMap,x.uniforms.uAddClamp,S),x.update(),h.resources.uAdd=i.source,h.blendMode="normal",e.applyFilter(h,l,m,!0),k.push(m),l=m}A(u,l,o.uniforms.uAddMap,o.uniforms.uAddClamp,z);const F=o.uniforms.uTint;F[0]=w[0],F[1]=w[1],F[2]=w[2],o.update(),a.resources.uAdd=l.source,a.blendMode=this.blendMode,e.applyFilter(a,u,n,f),s.forEach(r=>v.returnTexture(r)),k.forEach(r=>v.returnTexture(r))}destroy(){T.destroy(),h.destroy(),a.destroy(),super.destroy()}}return new U(_)};export{K as c,J as l};
