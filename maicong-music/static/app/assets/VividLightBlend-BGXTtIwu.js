import{v as qe}from"./index-B-XkWRXw.js";var y=(n=>(n.Application="application",n.WebGLPipes="webgl-pipes",n.WebGLPipesAdaptor="webgl-pipes-adaptor",n.WebGLSystem="webgl-system",n.WebGPUPipes="webgpu-pipes",n.WebGPUPipesAdaptor="webgpu-pipes-adaptor",n.WebGPUSystem="webgpu-system",n.CanvasSystem="canvas-system",n.CanvasPipesAdaptor="canvas-pipes-adaptor",n.CanvasPipes="canvas-pipes",n.Asset="asset",n.LoadParser="load-parser",n.ResolveParser="resolve-parser",n.CacheParser="cache-parser",n.DetectionParser="detection-parser",n.MaskEffect="mask-effect",n.BlendMode="blend-mode",n.TextureSource="texture-source",n.TextureUploaderWebGL="texture-uploader-webgl",n.TextureUploaderWebGPU="texture-uploader-webgpu",n.Environment="environment",n.ShapeBuilder="shape-builder",n.Batcher="batcher",n))(y||{});const re=n=>{if(typeof n=="function"||typeof n=="object"&&n.extension){if(!n.extension)throw new Error("Extension class must have an extension object");n={...typeof n.extension!="object"?{type:n.extension}:n.extension,ref:n}}if(typeof n=="object")n={...n};else throw new Error("Invalid extension type");return typeof n.type=="string"&&(n.type=[n.type]),n},z=(n,e)=>re(n).priority??e,en={_addHandlers:{},_removeHandlers:{},_queue:{},remove(...n){return n.map(re).forEach(e=>{e.type.forEach(t=>this._removeHandlers[t]?.(e))}),this},add(...n){return n.map(re).forEach(e=>{e.type.forEach(t=>{const s=this._addHandlers,r=this._queue;s[t]?s[t]?.(e):(r[t]=r[t]||[],r[t]?.push(e))})}),this},handle(n,e,t){const s=this._addHandlers,r=this._removeHandlers;if(s[n]||r[n])throw new Error(`Extension type ${n} already has a handler`);s[n]=e,r[n]=t;const i=this._queue;return i[n]&&(i[n]?.forEach(a=>e(a)),delete i[n]),this},handleByMap(n,e){return this.handle(n,t=>{t.name&&(e[t.name]=t.ref)},t=>{t.name&&delete e[t.name]})},handleByNamedList(n,e,t=-1){return this.handle(n,s=>{e.findIndex(i=>i.name===s.name)>=0||(e.push({name:s.name,value:s.ref}),e.sort((i,a)=>z(a.value,t)-z(i.value,t)))},s=>{const r=e.findIndex(i=>i.name===s.name);r!==-1&&e.splice(r,1)})},handleByList(n,e,t=-1){return this.handle(n,s=>{e.includes(s.ref)||(e.push(s.ref),e.sort((r,i)=>z(i,t)-z(r,t)))},s=>{const r=e.indexOf(s.ref);r!==-1&&e.splice(r,1)})},mixin(n,...e){for(const t of e)Object.defineProperties(n.prototype,Object.getOwnPropertyDescriptors(t))}},j=Object.create(null),ve=Object.create(null);function de(n,e){let t=ve[n];return t===void 0&&(j[e]===void 0&&(j[e]=1),ve[n]=t=j[e]++),t}const Ye={createCanvas:(n,e)=>{const t=document.createElement("canvas");return t.width=n,t.height=e,t},createImage:()=>new Image,getCanvasRenderingContext2D:()=>CanvasRenderingContext2D,getWebGLRenderingContext:()=>WebGLRenderingContext,getNavigator:()=>navigator,getBaseUrl:()=>document.baseURI??window.location.href,getFontFaceSet:()=>document.fonts,fetch:(n,e)=>fetch(n,e),parseXML:n=>new DOMParser().parseFromString(n,"text/xml")};let xe=Ye;const Ke={get(){return xe},set(n){xe=n}};let N;function Xe(){return(!N||N?.isContextLost())&&(N=Ke.get().createCanvas().getContext("webgl",{})),N}let R;function Je(){if(!R){R="mediump";const n=Xe();n&&n.getShaderPrecisionFormat&&(R=n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision?"highp":"mediump")}return R}function Ze(n,e,t){return e?n:t?(n=n.replace("out vec4 finalColor;",""),`

        #ifdef GL_ES // This checks if it is WebGL1
        #define in varying
        #define finalColor gl_FragColor
        #define texture texture2D
        #endif
        ${n}
        `):`

        #ifdef GL_ES // This checks if it is WebGL1
        #define in attribute
        #define out varying
        #endif
        ${n}
        `}function Qe(n,e,t){const s=t?e.maxSupportedFragmentPrecision:e.maxSupportedVertexPrecision;if(n.substring(0,9)!=="precision"){let r=t?e.requestedFragmentPrecision:e.requestedVertexPrecision;return r==="highp"&&s!=="highp"&&(r="mediump"),`precision ${r} float;
${n}`}else if(s!=="highp"&&n.substring(0,15)==="precision highp")return n.replace("precision highp","precision mediump");return n}function et(n,e){return e?`#version 300 es
${n}`:n}const tt={},nt={};function st(n,{name:e="pixi-program"},t=!0){e=e.replace(/\s+/g,"-"),e+=t?"-fragment":"-vertex";const s=t?tt:nt;return s[e]?(s[e]++,e+=`-${s[e]}`):s[e]=1,n.indexOf("#define SHADER_NAME")!==-1?n:`${`#define SHADER_NAME ${e}`}
${n}`}function rt(n,e){return e?n.replace("#version 300 es",""):n}const q={stripVersion:rt,ensurePrecision:Qe,addProgramDefines:Ze,setProgramName:st,insertVersion:et},T=Object.create(null),Fe=class ie{constructor(e){e={...ie.defaultOptions,...e};const t=e.fragment.indexOf("#version 300 es")!==-1,s={stripVersion:t,ensurePrecision:{requestedFragmentPrecision:e.preferredFragmentPrecision,requestedVertexPrecision:e.preferredVertexPrecision,maxSupportedVertexPrecision:"highp",maxSupportedFragmentPrecision:Je()},setProgramName:{name:e.name},addProgramDefines:t,insertVersion:t};let r=e.fragment,i=e.vertex;Object.keys(q).forEach(a=>{const o=s[a];r=q[a](r,o,!0),i=q[a](i,o,!1)}),this.fragment=r,this.vertex=i,this.transformFeedbackVaryings=e.transformFeedbackVaryings,this._key=de(`${this.vertex}:${this.fragment}`,"gl-program")}destroy(){this.fragment=null,this.vertex=null,this._attributeData=null,this._uniformData=null,this._uniformBlockData=null,this.transformFeedbackVaryings=null,T[this._cacheKey]=null}static from(e){const t=`${e.vertex}:${e.fragment}`;return T[t]||(T[t]=new ie(e),T[t]._cacheKey=t),T[t]}};Fe.defaultOptions={preferredVertexPrecision:"highp",preferredFragmentPrecision:"mediump"};let ue=Fe;const Me={uint8x2:{size:2,stride:2,normalised:!1},uint8x4:{size:4,stride:4,normalised:!1},sint8x2:{size:2,stride:2,normalised:!1},sint8x4:{size:4,stride:4,normalised:!1},unorm8x2:{size:2,stride:2,normalised:!0},unorm8x4:{size:4,stride:4,normalised:!0},snorm8x2:{size:2,stride:2,normalised:!0},snorm8x4:{size:4,stride:4,normalised:!0},uint16x2:{size:2,stride:4,normalised:!1},uint16x4:{size:4,stride:8,normalised:!1},sint16x2:{size:2,stride:4,normalised:!1},sint16x4:{size:4,stride:8,normalised:!1},unorm16x2:{size:2,stride:4,normalised:!0},unorm16x4:{size:4,stride:8,normalised:!0},snorm16x2:{size:2,stride:4,normalised:!0},snorm16x4:{size:4,stride:8,normalised:!0},float16x2:{size:2,stride:4,normalised:!1},float16x4:{size:4,stride:8,normalised:!1},float32:{size:1,stride:4,normalised:!1},float32x2:{size:2,stride:8,normalised:!1},float32x3:{size:3,stride:12,normalised:!1},float32x4:{size:4,stride:16,normalised:!1},uint32:{size:1,stride:4,normalised:!1},uint32x2:{size:2,stride:8,normalised:!1},uint32x3:{size:3,stride:12,normalised:!1},uint32x4:{size:4,stride:16,normalised:!1},sint32:{size:1,stride:4,normalised:!1},sint32x2:{size:2,stride:8,normalised:!1},sint32x3:{size:3,stride:12,normalised:!1},sint32x4:{size:4,stride:16,normalised:!1}};function it(n){return Me[n]??Me.float32}const ot={f32:"float32","vec2<f32>":"float32x2","vec3<f32>":"float32x3","vec4<f32>":"float32x4",vec2f:"float32x2",vec3f:"float32x3",vec4f:"float32x4",i32:"sint32","vec2<i32>":"sint32x2","vec3<i32>":"sint32x3","vec4<i32>":"sint32x4",vec2i:"sint32x2",vec3i:"sint32x3",vec4i:"sint32x4",u32:"uint32","vec2<u32>":"uint32x2","vec3<u32>":"uint32x3","vec4<u32>":"uint32x4",vec2u:"uint32x2",vec3u:"uint32x3",vec4u:"uint32x4",bool:"uint32","vec2<bool>":"uint32x2","vec3<bool>":"uint32x3","vec4<bool>":"uint32x4"},_e=/@location\((\d+)\)\s+([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>]+)(?:,|\s|\)|$)/g;function we(n,e){let t;for(;(t=_e.exec(n))!==null;){const s=ot[t[3]]??"float32";e[t[2]]={location:parseInt(t[1],10),format:s,stride:it(s).stride,offset:0,instance:!1,start:0}}_e.lastIndex=0}function at(n){return n.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"")}function lt({source:n,entryPoint:e}){const t={},s=at(n),r=s.indexOf(`fn ${e}(`);if(r===-1)return t;const i=s.indexOf("->",r);if(i===-1)return t;const a=s.substring(r,i);if(we(a,t),Object.keys(t).length===0){const o=a.match(/\(\s*\w+\s*:\s*(\w+)/);if(o){const d=o[1],l=new RegExp(`struct\\s+${d}\\s*\\{([^}]+)\\}`,"s"),c=s.match(l);c&&we(c[1],t)}}return t}function Y(n){const e=/(^|[^/])@(group|binding)\(\d+\)[^;]+;/g,t=/@group\((\d+)\)/,s=/@binding\((\d+)\)/,r=/var(<[^>]+>)? (\w+)/,i=/:\s*([\w<>]+)/,a=/struct\s+(\w+)\s*{([^}]+)}/g,o=/(\w+)\s*:\s*([\w\<\>]+)/g,d=/struct\s+(\w+)/,l=n.match(e)?.map(u=>({group:parseInt(u.match(t)[1],10),binding:parseInt(u.match(s)[1],10),name:u.match(r)[2],isUniform:u.match(r)[1]==="<uniform>",type:u.match(i)[1]}));if(!l)return{groups:[],structs:[]};const c=n.match(a)?.map(u=>{const f=u.match(d)[1],b=u.match(o).reduce((g,x)=>{const[h,_]=x.split(":");return g[h.trim()]=_.trim(),g},{});return b?{name:f,members:b}:null}).filter(({name:u})=>l.some(f=>f.type===u||f.type.includes(`<${u}>`)))??[];return{groups:l,structs:c}}var S=(n=>(n[n.VERTEX=1]="VERTEX",n[n.FRAGMENT=2]="FRAGMENT",n[n.COMPUTE=4]="COMPUTE",n))(S||{});function ct({groups:n}){const e=[];for(let t=0;t<n.length;t++){const s=n[t];e[s.group]||(e[s.group]=[]),s.isUniform?e[s.group].push({binding:s.binding,visibility:S.VERTEX|S.FRAGMENT,buffer:{type:"uniform"}}):s.type==="sampler"?e[s.group].push({binding:s.binding,visibility:S.FRAGMENT,sampler:{type:"filtering"}}):s.type==="texture_2d"||s.type.startsWith("texture_2d<")?e[s.group].push({binding:s.binding,visibility:S.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}}):s.type==="texture_2d_array"||s.type.startsWith("texture_2d_array<")?e[s.group].push({binding:s.binding,visibility:S.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d-array",multisampled:!1}}):(s.type==="texture_cube"||s.type.startsWith("texture_cube<"))&&e[s.group].push({binding:s.binding,visibility:S.FRAGMENT,texture:{sampleType:"float",viewDimension:"cube",multisampled:!1}})}for(let t=0;t<e.length;t++)e[t]||(e[t]=[]);return e}function dt({groups:n}){const e=[];for(let t=0;t<n.length;t++){const s=n[t];e[s.group]||(e[s.group]={}),e[s.group][s.name]=s.binding}return e}function ut(n,e){const t=new Set,s=new Set,r=[...n.structs,...e.structs].filter(a=>t.has(a.name)?!1:(t.add(a.name),!0)),i=[...n.groups,...e.groups].filter(a=>{const o=`${a.name}-${a.binding}`;return s.has(o)?!1:(s.add(o),!0)});return{structs:r,groups:i}}const E=Object.create(null);class I{constructor(e){this._layoutKey=0,this._attributeLocationsKey=0;const{fragment:t,vertex:s,layout:r,gpuLayout:i,name:a}=e;if(this.name=a,this.fragment=t,this.vertex=s,t.source===s.source){const o=Y(t.source);this.structsAndGroups=o}else{const o=Y(s.source),d=Y(t.source);this.structsAndGroups=ut(o,d)}this.layout=r??dt(this.structsAndGroups),this.gpuLayout=i??ct(this.structsAndGroups),this.autoAssignGlobalUniforms=this.layout[0]?.globalUniforms!==void 0,this.autoAssignLocalUniforms=this.layout[1]?.localUniforms!==void 0,this._generateProgramKey()}_generateProgramKey(){const{vertex:e,fragment:t}=this,s=e.source+t.source+e.entryPoint+t.entryPoint;this._layoutKey=de(s,"program")}get attributeData(){return this._attributeData??(this._attributeData=lt(this.vertex)),this._attributeData}destroy(){this.gpuLayout=null,this.layout=null,this.structsAndGroups=null,this.fragment=null,this.vertex=null,E[this._cacheKey]=null}static from(e){const t=`${e.vertex.source}:${e.fragment.source}:${e.fragment.entryPoint}:${e.vertex.entryPoint}`;return E[t]||(E[t]=new I(e),E[t]._cacheKey=t),E[t]}}const U={default:-1};function w(n="default"){return U[n]===void 0&&(U[n]=-1),++U[n]}function tn(){for(const n in U)delete U[n]}const Oe=["f32","i32","vec2<f32>","vec3<f32>","vec4<f32>","mat2x2<f32>","mat3x3<f32>","mat4x4<f32>","mat3x2<f32>","mat4x2<f32>","mat2x3<f32>","mat4x3<f32>","mat2x4<f32>","mat3x4<f32>","vec2<i32>","vec3<i32>","vec4<i32>"],ht=Oe.reduce((n,e)=>(n[e]=!0,n),{});function ft(n,e){switch(n){case"f32":return 0;case"vec2<f32>":return new Float32Array(2*e);case"vec3<f32>":return new Float32Array(3*e);case"vec4<f32>":return new Float32Array(4*e);case"mat2x2<f32>":return new Float32Array([1,0,0,1]);case"mat3x3<f32>":return new Float32Array([1,0,0,0,1,0,0,0,1]);case"mat4x4<f32>":return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}return null}const ke=class De{constructor(e,t){this._touched=0,this.uid=w("uniform"),this._resourceType="uniformGroup",this._resourceId=w("resource"),this.isUniformGroup=!0,this._dirtyId=0,this.destroyed=!1,t={...De.defaultOptions,...t},this.uniformStructures=e;const s={};for(const r in e){const i=e[r];if(i.name=r,i.size=i.size??1,!ht[i.type]){const a=i.type.match(/^array<(\w+(?:<\w+>)?),\s*(\d+)>$/);if(a){const[,o,d]=a;throw new Error(`Uniform type ${i.type} is not supported. Use type: '${o}', size: ${d} instead.`)}throw new Error(`Uniform type ${i.type} is not supported. Supported uniform types are: ${Oe.join(", ")}`)}i.value??(i.value=ft(i.type,i.size)),s[r]=i.value}this.uniforms=s,this._dirtyId=1,this.ubo=t.ubo,this.isStatic=t.isStatic,this._signature=de(Object.keys(s).map(r=>`${r}-${e[r].type}`).join("-"),"uniform-group")}update(){this._dirtyId++}};ke.defaultOptions={ubo:!1,isStatic:!1};let Te=ke;var K={exports:{}},Le;function bt(){return Le||(Le=1,(function(n){var e=Object.prototype.hasOwnProperty,t="~";function s(){}Object.create&&(s.prototype=Object.create(null),new s().__proto__||(t=!1));function r(d,l,c){this.fn=d,this.context=l,this.once=c||!1}function i(d,l,c,u,f){if(typeof c!="function")throw new TypeError("The listener must be a function");var b=new r(c,u||d,f),g=t?t+l:l;return d._events[g]?d._events[g].fn?d._events[g]=[d._events[g],b]:d._events[g].push(b):(d._events[g]=b,d._eventsCount++),d}function a(d,l){--d._eventsCount===0?d._events=new s:delete d._events[l]}function o(){this._events=new s,this._eventsCount=0}o.prototype.eventNames=function(){var l=[],c,u;if(this._eventsCount===0)return l;for(u in c=this._events)e.call(c,u)&&l.push(t?u.slice(1):u);return Object.getOwnPropertySymbols?l.concat(Object.getOwnPropertySymbols(c)):l},o.prototype.listeners=function(l){var c=t?t+l:l,u=this._events[c];if(!u)return[];if(u.fn)return[u.fn];for(var f=0,b=u.length,g=new Array(b);f<b;f++)g[f]=u[f].fn;return g},o.prototype.listenerCount=function(l){var c=t?t+l:l,u=this._events[c];return u?u.fn?1:u.length:0},o.prototype.emit=function(l,c,u,f,b,g){var x=t?t+l:l;if(!this._events[x])return!1;var h=this._events[x],_=arguments.length,M,p;if(h.fn){switch(h.once&&this.removeListener(l,h.fn,void 0,!0),_){case 1:return h.fn.call(h.context),!0;case 2:return h.fn.call(h.context,c),!0;case 3:return h.fn.call(h.context,c,u),!0;case 4:return h.fn.call(h.context,c,u,f),!0;case 5:return h.fn.call(h.context,c,u,f,b),!0;case 6:return h.fn.call(h.context,c,u,f,b,g),!0}for(p=1,M=new Array(_-1);p<_;p++)M[p-1]=arguments[p];h.fn.apply(h.context,M)}else{var $=h.length,B;for(p=0;p<$;p++)switch(h[p].once&&this.removeListener(l,h[p].fn,void 0,!0),_){case 1:h[p].fn.call(h[p].context);break;case 2:h[p].fn.call(h[p].context,c);break;case 3:h[p].fn.call(h[p].context,c,u);break;case 4:h[p].fn.call(h[p].context,c,u,f);break;default:if(!M)for(B=1,M=new Array(_-1);B<_;B++)M[B-1]=arguments[B];h[p].fn.apply(h[p].context,M)}}return!0},o.prototype.on=function(l,c,u){return i(this,l,c,u,!1)},o.prototype.once=function(l,c,u){return i(this,l,c,u,!0)},o.prototype.removeListener=function(l,c,u,f){var b=t?t+l:l;if(!this._events[b])return this;if(!c)return a(this,b),this;var g=this._events[b];if(g.fn)g.fn===c&&(!f||g.once)&&(!u||g.context===u)&&a(this,b);else{for(var x=0,h=[],_=g.length;x<_;x++)(g[x].fn!==c||f&&!g[x].once||u&&g[x].context!==u)&&h.push(g[x]);h.length?this._events[b]=h.length===1?h[0]:h:a(this,b)}return this},o.prototype.removeAllListeners=function(l){var c;return l?(c=t?t+l:l,this._events[c]&&a(this,c)):(this._events=new s,this._eventsCount=0),this},o.prototype.off=o.prototype.removeListener,o.prototype.addListener=o.prototype.on,o.prefixed=t,o.EventEmitter=o,n.exports=o})(K)),K.exports}var gt=bt();const H=qe(gt),pt=Math.PI*2,nn=180/Math.PI,sn=Math.PI/180;class L{constructor(e=0,t=0){this.x=0,this.y=0,this.x=e,this.y=t}clone(){return new L(this.x,this.y)}copyFrom(e){return this.set(e.x,e.y),this}copyTo(e){return e.set(this.x,this.y),e}equals(e){return e.x===this.x&&e.y===this.y}set(e=0,t=e){return this.x=e,this.y=t,this}toString(){return`[pixi.js/math:Point x=${this.x} y=${this.y}]`}static get shared(){return X.x=0,X.y=0,X}}const X=new L;class k{constructor(e=1,t=0,s=0,r=1,i=0,a=0){this.array=null,this.a=e,this.b=t,this.c=s,this.d=r,this.tx=i,this.ty=a}fromArray(e){this.a=e[0],this.b=e[1],this.c=e[3],this.d=e[4],this.tx=e[2],this.ty=e[5]}set(e,t,s,r,i,a){return this.a=e,this.b=t,this.c=s,this.d=r,this.tx=i,this.ty=a,this}toArray(e,t){this.array||(this.array=new Float32Array(9));const s=t||this.array;return e?(s[0]=this.a,s[1]=this.b,s[2]=0,s[3]=this.c,s[4]=this.d,s[5]=0,s[6]=this.tx,s[7]=this.ty,s[8]=1):(s[0]=this.a,s[1]=this.c,s[2]=this.tx,s[3]=this.b,s[4]=this.d,s[5]=this.ty,s[6]=0,s[7]=0,s[8]=1),s}apply(e,t){t=t||new L;const s=e.x,r=e.y;return t.x=this.a*s+this.c*r+this.tx,t.y=this.b*s+this.d*r+this.ty,t}applyInverse(e,t){t=t||new L;const s=this.a,r=this.b,i=this.c,a=this.d,o=this.tx,d=this.ty,l=1/(s*a+i*-r),c=e.x,u=e.y;return t.x=a*l*c+-i*l*u+(d*i-o*a)*l,t.y=s*l*u+-r*l*c+(-d*s+o*r)*l,t}translate(e,t){return this.tx+=e,this.ty+=t,this}scale(e,t){return this.a*=e,this.d*=t,this.c*=e,this.b*=t,this.tx*=e,this.ty*=t,this}rotate(e){const t=Math.cos(e),s=Math.sin(e),r=this.a,i=this.c,a=this.tx;return this.a=r*t-this.b*s,this.b=r*s+this.b*t,this.c=i*t-this.d*s,this.d=i*s+this.d*t,this.tx=a*t-this.ty*s,this.ty=a*s+this.ty*t,this}append(e){const t=this.a,s=this.b,r=this.c,i=this.d;return this.a=e.a*t+e.b*r,this.b=e.a*s+e.b*i,this.c=e.c*t+e.d*r,this.d=e.c*s+e.d*i,this.tx=e.tx*t+e.ty*r+this.tx,this.ty=e.tx*s+e.ty*i+this.ty,this}appendFrom(e,t){const s=e.a,r=e.b,i=e.c,a=e.d,o=e.tx,d=e.ty,l=t.a,c=t.b,u=t.c,f=t.d;return this.a=s*l+r*u,this.b=s*c+r*f,this.c=i*l+a*u,this.d=i*c+a*f,this.tx=o*l+d*u+t.tx,this.ty=o*c+d*f+t.ty,this}setTransform(e,t,s,r,i,a,o,d,l){return this.a=Math.cos(o+l)*i,this.b=Math.sin(o+l)*i,this.c=-Math.sin(o-d)*a,this.d=Math.cos(o-d)*a,this.tx=e-(s*this.a+r*this.c),this.ty=t-(s*this.b+r*this.d),this}prepend(e){const t=this.tx;if(e.a!==1||e.b!==0||e.c!==0||e.d!==1){const s=this.a,r=this.c;this.a=s*e.a+this.b*e.c,this.b=s*e.b+this.b*e.d,this.c=r*e.a+this.d*e.c,this.d=r*e.b+this.d*e.d}return this.tx=t*e.a+this.ty*e.c+e.tx,this.ty=t*e.b+this.ty*e.d+e.ty,this}decompose(e){const t=this.a,s=this.b,r=this.c,i=this.d,a=e.pivot,o=-Math.atan2(-r,i),d=Math.atan2(s,t),l=Math.abs(o+d);return l<1e-5||Math.abs(pt-l)<1e-5?(e.rotation=d,e.skew.x=e.skew.y=0):(e.rotation=0,e.skew.x=o,e.skew.y=d),e.scale.x=Math.sqrt(t*t+s*s),e.scale.y=Math.sqrt(r*r+i*i),e.position.x=this.tx+(a.x*t+a.y*r),e.position.y=this.ty+(a.x*s+a.y*i),e}invert(){const e=this.a,t=this.b,s=this.c,r=this.d,i=this.tx,a=e*r-t*s;return this.a=r/a,this.b=-t/a,this.c=-s/a,this.d=e/a,this.tx=(s*this.ty-r*i)/a,this.ty=-(e*this.ty-t*i)/a,this}isIdentity(){return this.a===1&&this.b===0&&this.c===0&&this.d===1&&this.tx===0&&this.ty===0}identity(){return this.a=1,this.b=0,this.c=0,this.d=1,this.tx=0,this.ty=0,this}clone(){const e=new k;return e.a=this.a,e.b=this.b,e.c=this.c,e.d=this.d,e.tx=this.tx,e.ty=this.ty,e}copyTo(e){return e.a=this.a,e.b=this.b,e.c=this.c,e.d=this.d,e.tx=this.tx,e.ty=this.ty,e}copyFrom(e){return this.a=e.a,this.b=e.b,this.c=e.c,this.d=e.d,this.tx=e.tx,this.ty=e.ty,this}equals(e){return e.a===this.a&&e.b===this.b&&e.c===this.c&&e.d===this.d&&e.tx===this.tx&&e.ty===this.ty}toString(){return`[pixi.js:Matrix a=${this.a} b=${this.b} c=${this.c} d=${this.d} tx=${this.tx} ty=${this.ty}]`}static get IDENTITY(){return yt.identity()}static get shared(){return mt.identity()}}const mt=new k,yt=new k,A=[1,1,0,-1,-1,-1,0,1,1,1,0,-1,-1,-1,0,1],C=[0,1,1,1,0,-1,-1,-1,0,1,1,1,0,-1,-1,-1],P=[0,-1,-1,-1,0,1,1,1,0,1,1,1,0,-1,-1,-1],F=[1,1,0,-1,-1,-1,0,1,-1,-1,0,1,1,1,0,-1],oe=[],Ee=[],W=Math.sign;function vt(){for(let n=0;n<16;n++){const e=[];oe.push(e);for(let t=0;t<16;t++){const s=W(A[n]*A[t]+P[n]*C[t]),r=W(C[n]*A[t]+F[n]*C[t]),i=W(A[n]*P[t]+P[n]*F[t]),a=W(C[n]*P[t]+F[n]*F[t]);for(let o=0;o<16;o++)if(A[o]===s&&C[o]===r&&P[o]===i&&F[o]===a){e.push(o);break}}}for(let n=0;n<16;n++){const e=new k;e.set(A[n],C[n],P[n],F[n],0,0),Ee.push(e)}}vt();const m={E:0,SE:1,S:2,SW:3,W:4,NW:5,N:6,NE:7,MIRROR_VERTICAL:8,MAIN_DIAGONAL:10,MIRROR_HORIZONTAL:12,REVERSE_DIAGONAL:14,uX:n=>A[n],uY:n=>C[n],vX:n=>P[n],vY:n=>F[n],inv:n=>n&8?n&15:-n&7,add:(n,e)=>oe[n][e],sub:(n,e)=>oe[n][m.inv(e)],rotate180:n=>n^4,isVertical:n=>(n&3)===2,byDirection:(n,e)=>Math.abs(n)*2<=Math.abs(e)?e>=0?m.S:m.N:Math.abs(e)*2<=Math.abs(n)?n>0?m.E:m.W:e>0?n>0?m.SE:m.SW:n>0?m.NE:m.NW,matrixAppendRotationInv:(n,e,t=0,s=0,r=0,i=0)=>{const a=Ee[m.inv(e)],o=a.a,d=a.b,l=a.c,c=a.d,u=t-Math.min(0,o*r,l*i,o*r+l*i),f=s-Math.min(0,d*r,c*i,d*r+c*i),b=n.a,g=n.b,x=n.c,h=n.d;n.a=o*b+d*x,n.b=o*g+d*h,n.c=l*b+c*x,n.d=l*g+c*h,n.tx=u*b+f*x+n.tx,n.ty=u*g+f*h+n.ty},transformRectCoords:(n,e,t,s)=>{const{x:r,y:i,width:a,height:o}=n,{x:d,y:l,width:c,height:u}=e;return t===m.E?(s.set(r+d,i+l,a,o),s):t===m.S?s.set(c-i-o+d,r+l,o,a):t===m.W?s.set(c-r-a+d,u-i-o+l,a,o):t===m.N?s.set(i+d,u-r-a+l,o,a):s.set(r+d,i+l,a,o)}},V=[new L,new L,new L,new L];class G{constructor(e=0,t=0,s=0,r=0){this.type="rectangle",this.x=Number(e),this.y=Number(t),this.width=Number(s),this.height=Number(r)}get left(){return this.x}get right(){return this.x+this.width}get top(){return this.y}get bottom(){return this.y+this.height}isEmpty(){return this.left===this.right||this.top===this.bottom}static get EMPTY(){return new G(0,0,0,0)}clone(){return new G(this.x,this.y,this.width,this.height)}copyFromBounds(e){return this.x=e.minX,this.y=e.minY,this.width=e.maxX-e.minX,this.height=e.maxY-e.minY,this}copyFrom(e){return this.x=e.x,this.y=e.y,this.width=e.width,this.height=e.height,this}copyTo(e){return e.copyFrom(this),e}contains(e,t){return this.width<=0||this.height<=0?!1:e>=this.x&&e<this.x+this.width&&t>=this.y&&t<this.y+this.height}strokeContains(e,t,s,r=.5){const{width:i,height:a}=this;if(i<=0||a<=0)return!1;const o=this.x,d=this.y,l=s*(1-r),c=s-l,u=o-l,f=o+i+l,b=d-l,g=d+a+l,x=o+c,h=o+i-c,_=d+c,M=d+a-c;return e>=u&&e<=f&&t>=b&&t<=g&&!(e>x&&e<h&&t>_&&t<M)}intersects(e,t){if(!t){const He=this.x<e.x?e.x:this.x;if((this.right>e.right?e.right:this.right)<=He)return!1;const je=this.y<e.y?e.y:this.y;return(this.bottom>e.bottom?e.bottom:this.bottom)>je}const s=this.left,r=this.right,i=this.top,a=this.bottom;if(r<=s||a<=i)return!1;const o=V[0].set(e.left,e.top),d=V[1].set(e.left,e.bottom),l=V[2].set(e.right,e.top),c=V[3].set(e.right,e.bottom);if(l.x<=o.x||d.y<=o.y)return!1;const u=Math.sign(t.a*t.d-t.b*t.c);if(u===0||(t.apply(o,o),t.apply(d,d),t.apply(l,l),t.apply(c,c),Math.max(o.x,d.x,l.x,c.x)<=s||Math.min(o.x,d.x,l.x,c.x)>=r||Math.max(o.y,d.y,l.y,c.y)<=i||Math.min(o.y,d.y,l.y,c.y)>=a))return!1;const f=u*(d.y-o.y),b=u*(o.x-d.x),g=f*s+b*i,x=f*r+b*i,h=f*s+b*a,_=f*r+b*a;if(Math.max(g,x,h,_)<=f*o.x+b*o.y||Math.min(g,x,h,_)>=f*c.x+b*c.y)return!1;const M=u*(o.y-l.y),p=u*(l.x-o.x),$=M*s+p*i,B=M*r+p*i,me=M*s+p*a,ye=M*r+p*a;return!(Math.max($,B,me,ye)<=M*o.x+p*o.y||Math.min($,B,me,ye)>=M*c.x+p*c.y)}pad(e=0,t=e){return this.x-=e,this.y-=t,this.width+=e*2,this.height+=t*2,this}fit(e){const t=Math.max(this.x,e.x),s=Math.min(this.x+this.width,e.x+e.width),r=Math.max(this.y,e.y),i=Math.min(this.y+this.height,e.y+e.height);return this.x=t,this.width=Math.max(s-t,0),this.y=r,this.height=Math.max(i-r,0),this}ceil(e=1,t=.001){const s=Math.ceil((this.x+this.width-t)*e)/e,r=Math.ceil((this.y+this.height-t)*e)/e;return this.x=Math.floor((this.x+t)*e)/e,this.y=Math.floor((this.y+t)*e)/e,this.width=s-this.x,this.height=r-this.y,this}scale(e,t=e){return this.x*=e,this.y*=t,this.width*=e,this.height*=t,this}enlarge(e){const t=Math.min(this.x,e.x),s=Math.max(this.x+this.width,e.x+e.width),r=Math.min(this.y,e.y),i=Math.max(this.y+this.height,e.y+e.height);return this.x=t,this.width=s-t,this.y=r,this.height=i-r,this}getBounds(e){return e||(e=new G),e.copyFrom(this),e}containsRect(e){if(this.width<=0||this.height<=0)return!1;const t=e.x,s=e.y,r=e.x+e.width,i=e.y+e.height;return t>=this.x&&t<this.x+this.width&&s>=this.y&&s<this.y+this.height&&r>=this.x&&r<this.x+this.width&&i>=this.y&&i<this.y+this.height}set(e,t,s,r){return this.x=e,this.y=t,this.width=s,this.height=r,this}toString(){return`[pixi.js/math:Rectangle x=${this.x} y=${this.y} width=${this.width} height=${this.height}]`}}const Be=new Set,Ue="8.0.0",rn="8.3.4",D={quiet:!1,noColor:!1},he=((n,e,t=3)=>{if(D.quiet||Be.has(e))return;let s=new Error().stack;const r=`${e}
Deprecated since v${n}`,i=typeof console.groupCollapsed=="function"&&!D.noColor;typeof s>"u"?console.warn("PixiJS Deprecation Warning: ",r):(s=s.split(`
`).splice(t).join(`
`),i?(console.groupCollapsed("%cPixiJS Deprecation Warning: %c%s","color:#614108;background:#fffbe6","font-weight:normal;color:#614108;background:#fffbe6",r),console.warn(s),console.groupEnd()):(console.warn("PixiJS Deprecation Warning: ",r),console.warn(s))),Be.add(e)});Object.defineProperties(he,{quiet:{get:()=>D.quiet,set:n=>{D.quiet=n},enumerable:!0,configurable:!1},noColor:{get:()=>D.noColor,set:n=>{D.noColor=n},enumerable:!0,configurable:!1}});const Ge=()=>{};function on(n){return n+=n===0?1:0,--n,n|=n>>>1,n|=n>>>2,n|=n>>>4,n|=n>>>8,n|=n>>>16,n+1}function Se(n){return!(n&n-1)&&!!n}function an(n){let e=(n>65535?1:0)<<4;n>>>=e;let t=(n>255?1:0)<<3;return n>>>=t,e|=t,t=(n>15?1:0)<<2,n>>>=t,e|=t,t=(n>3?1:0)<<1,n>>>=t,e|=t,e|n>>1}function xt(n){const e={};for(const t in n)n[t]!==void 0&&(e[t]=n[t]);return e}const Ae=Object.create(null);function Mt(n){const e=Ae[n];return e===void 0&&(Ae[n]=w("resource")),e}const Ie=class $e extends H{constructor(e={}){super(),this._resourceType="textureSampler",this._touched=0,this._maxAnisotropy=1,this.destroyed=!1,e={...$e.defaultOptions,...e},this.addressMode=e.addressMode,this.addressModeU=e.addressModeU??this.addressModeU,this.addressModeV=e.addressModeV??this.addressModeV,this.addressModeW=e.addressModeW??this.addressModeW,this.scaleMode=e.scaleMode,this.magFilter=e.magFilter??this.magFilter,this.minFilter=e.minFilter??this.minFilter,this.mipmapFilter=e.mipmapFilter??this.mipmapFilter,this.lodMinClamp=e.lodMinClamp,this.lodMaxClamp=e.lodMaxClamp,this.compare=e.compare,this.maxAnisotropy=e.maxAnisotropy??1}set addressMode(e){this.addressModeU=e,this.addressModeV=e,this.addressModeW=e}get addressMode(){return this.addressModeU}set wrapMode(e){he(Ue,"TextureStyle.wrapMode is now TextureStyle.addressMode"),this.addressMode=e}get wrapMode(){return this.addressMode}set scaleMode(e){this.magFilter=e,this.minFilter=e,this.mipmapFilter=e}get scaleMode(){return this.magFilter}set maxAnisotropy(e){this._maxAnisotropy=Math.min(e,16),this._maxAnisotropy>1&&(this.scaleMode="linear")}get maxAnisotropy(){return this._maxAnisotropy}get _resourceId(){return this._sharedResourceId||this._generateResourceId()}update(){this._sharedResourceId=null,this.emit("change",this)}_generateResourceId(){const e=`${this.addressModeU}-${this.addressModeV}-${this.addressModeW}-${this.magFilter}-${this.minFilter}-${this.mipmapFilter}-${this.lodMinClamp}-${this.lodMaxClamp}-${this.compare}-${this._maxAnisotropy}`;return this._sharedResourceId=Mt(e),this._resourceId}destroy(){this.destroyed=!0,this.emit("destroy",this),this.emit("change",this),this.removeAllListeners()}};Ie.defaultOptions={addressMode:"clamp-to-edge",scaleMode:"linear"};let _t=Ie;const ze=class Ne extends H{constructor(e={}){super(),this.options=e,this._gpuData=Object.create(null),this._gcLastUsed=-1,this.uid=w("textureSource"),this._resourceType="textureSource",this._resourceId=w("resource"),this.uploadMethodId="unknown",this._resolution=1,this.pixelWidth=1,this.pixelHeight=1,this.width=1,this.height=1,this.sampleCount=1,this.mipLevelCount=1,this.autoGenerateMipmaps=!1,this.format="rgba8unorm",this.dimension="2d",this.viewDimension="2d",this.arrayLayerCount=1,this.antialias=!1,this.transient=!1,this._touched=0,this._batchTick=-1,this._textureBindLocation=-1,e={...Ne.defaultOptions,...e},this.label=e.label??"",this.resource=e.resource,this.autoGarbageCollect=e.autoGarbageCollect,this._resolution=e.resolution,e.width?this.pixelWidth=e.width*this._resolution:this.pixelWidth=this.resource?this.resourceWidth??1:1,e.height?this.pixelHeight=e.height*this._resolution:this.pixelHeight=this.resource?this.resourceHeight??1:1,this.width=this.pixelWidth/this._resolution,this.height=this.pixelHeight/this._resolution,this.format=e.format,this.dimension=e.dimensions,this.viewDimension=e.viewDimension??e.dimensions,this.arrayLayerCount=e.arrayLayerCount,this.mipLevelCount=e.mipLevelCount,this.autoGenerateMipmaps=e.autoGenerateMipmaps,this.sampleCount=e.sampleCount,this.antialias=e.antialias,this.transient=e.transient??!1,this.alphaMode=e.alphaMode,this.style=new _t(xt(e)),this.destroyed=!1,this._refreshPOT()}get source(){return this}get style(){return this._style}set style(e){this.style!==e&&(this._style?.off("change",this._onStyleChange,this),this._style=e,this._style?.on("change",this._onStyleChange,this),this._onStyleChange())}set maxAnisotropy(e){this._style.maxAnisotropy=e}get maxAnisotropy(){return this._style.maxAnisotropy}get addressMode(){return this._style.addressMode}set addressMode(e){this._style.addressMode=e}get repeatMode(){return this._style.addressMode}set repeatMode(e){this._style.addressMode=e}get magFilter(){return this._style.magFilter}set magFilter(e){this._style.magFilter=e}get minFilter(){return this._style.minFilter}set minFilter(e){this._style.minFilter=e}get mipmapFilter(){return this._style.mipmapFilter}set mipmapFilter(e){this._style.mipmapFilter=e}get lodMinClamp(){return this._style.lodMinClamp}set lodMinClamp(e){this._style.lodMinClamp=e}get lodMaxClamp(){return this._style.lodMaxClamp}set lodMaxClamp(e){this._style.lodMaxClamp=e}_onStyleChange(){this.emit("styleChange",this)}update(){if(this.resource){const e=this._resolution;if(this.resize(this.resourceWidth/e,this.resourceHeight/e))return}this.emit("update",this)}destroy(){this.destroyed=!0,this.unload(),this.emit("destroy",this),this._style&&(this._style.destroy(),this._style=null),this.uploadMethodId=null,this.resource=null,this.removeAllListeners()}unload(){this._resourceId=w("resource"),this.emit("change",this),this.emit("unload",this);for(const e in this._gpuData)this._gpuData[e]?.destroy?.();this._gpuData=Object.create(null)}get resourceWidth(){const{resource:e}=this;return e.naturalWidth||e.videoWidth||e.displayWidth||e.width}get resourceHeight(){const{resource:e}=this;return e.naturalHeight||e.videoHeight||e.displayHeight||e.height}get resolution(){return this._resolution}set resolution(e){this._resolution!==e&&(this._resolution=e,this.width=this.pixelWidth/e,this.height=this.pixelHeight/e)}resize(e,t,s){s||(s=this._resolution),e||(e=this.width),t||(t=this.height);const r=Math.round(e*s),i=Math.round(t*s);return this.width=r/s,this.height=i/s,this._resolution=s,this.pixelWidth===r&&this.pixelHeight===i?!1:(this._refreshPOT(),this.pixelWidth=r,this.pixelHeight=i,this.emit("resize",this),this._resourceId=w("resource"),this.emit("change",this),!0)}updateMipmaps(){this.autoGenerateMipmaps&&this.mipLevelCount>1&&this.emit("updateMipmaps",this)}set wrapMode(e){this._style.wrapMode=e}get wrapMode(){return this._style.wrapMode}set scaleMode(e){this._style.scaleMode=e}get scaleMode(){return this._style.scaleMode}_refreshPOT(){this.isPowerOfTwo=Se(this.pixelWidth)&&Se(this.pixelHeight)}static test(e){throw new Error("Unimplemented")}};ze.defaultOptions={resolution:1,format:"bgra8unorm",alphaMode:"premultiply-alpha-on-upload",dimensions:"2d",viewDimension:"2d",arrayLayerCount:1,mipLevelCount:1,autoGenerateMipmaps:!1,sampleCount:1,antialias:!1,autoGarbageCollect:!1};let fe=ze;class Re extends fe{constructor(e){const t=e.resource||new Float32Array(e.width*e.height*4);let s=e.format;s||(t instanceof Float32Array?s="rgba32float":t instanceof Int32Array||t instanceof Uint32Array?s="rgba32uint":t instanceof Int16Array||t instanceof Uint16Array?s="rgba16uint":(t instanceof Int8Array,s="bgra8unorm")),super({...e,resource:t,format:s}),this.uploadMethodId="buffer"}static test(e){return e instanceof Int8Array||e instanceof Uint8Array||e instanceof Uint8ClampedArray||e instanceof Int16Array||e instanceof Uint16Array||e instanceof Int32Array||e instanceof Uint32Array||e instanceof Float32Array}}Re.extension=y.TextureSource;const Ce=new k;class wt{constructor(e,t){this.mapCoord=new k,this.uClampFrame=new Float32Array(4),this.uClampOffset=new Float32Array(2),this._updateID=0,this.clampOffset=0,typeof t>"u"?this.clampMargin=e.width<10?0:.5:this.clampMargin=t,this.isSimple=!1,this.texture=e}get texture(){return this._texture}set texture(e){this._texture!==e&&(this._texture?.removeListener("update",this.update,this),this._texture=e,this._texture.addListener("update",this.update,this)),this.update()}multiplyUvs(e,t){t===void 0&&(t=e);const s=this.mapCoord;for(let r=0;r<e.length;r+=2){const i=e[r],a=e[r+1];t[r]=i*s.a+a*s.c+s.tx,t[r+1]=i*s.b+a*s.d+s.ty}return t}update(){const e=this._texture;this._updateID++;const t=e.uvs;this.mapCoord.set(t.x1-t.x0,t.y1-t.y0,t.x3-t.x0,t.y3-t.y0,t.x0,t.y0);const s=e.orig,r=e.trim;r&&(Ce.set(s.width/r.width,0,0,s.height/r.height,-r.x/r.width,-r.y/r.height),this.mapCoord.append(Ce));const i=e.source,a=this.uClampFrame,o=this.clampMargin/i._resolution,d=this.clampOffset/i._resolution;return a[0]=(e.frame.x+o+d)/i.width,a[1]=(e.frame.y+o+d)/i.height,a[2]=(e.frame.x+e.frame.width-o+d)/i.width,a[3]=(e.frame.y+e.frame.height-o+d)/i.height,this.uClampOffset[0]=this.clampOffset/i.pixelWidth,this.uClampOffset[1]=this.clampOffset/i.pixelHeight,this.isSimple=e.frame.width===i.width&&e.frame.height===i.height&&e.rotate===0,!0}}class O extends H{constructor({source:e,label:t,frame:s,orig:r,trim:i,defaultAnchor:a,defaultBorders:o,rotate:d,dynamic:l}={}){if(super(),this.uid=w("texture"),this.uvs={x0:0,y0:0,x1:0,y1:0,x2:0,y2:0,x3:0,y3:0},this.frame=new G,this.noFrame=!1,this.dynamic=!1,this.isTexture=!0,this.label=t,this.source=e?.source??new fe,this.noFrame=!s,s)this.frame.copyFrom(s);else{const{width:c,height:u}=this._source;this.frame.width=c,this.frame.height=u}this.orig=r||this.frame,this.trim=i,this.rotate=d??0,this.defaultAnchor=a,this.defaultBorders=o,this.destroyed=!1,this.dynamic=l||!1,this.updateUvs()}set source(e){this._source&&this._source.off("resize",this.update,this),this._source=e,e.on("resize",this.update,this),this.emit("update",this)}get source(){return this._source}get textureMatrix(){return this._textureMatrix||(this._textureMatrix=new wt(this)),this._textureMatrix}get width(){return this.orig.width}get height(){return this.orig.height}updateUvs(){const{uvs:e,frame:t}=this,{width:s,height:r}=this._source,i=t.x/s,a=t.y/r,o=t.width/s,d=t.height/r;let l=this.rotate;if(l){const c=o/2,u=d/2,f=i+c,b=a+u;l=m.add(l,m.NW),e.x0=f+c*m.uX(l),e.y0=b+u*m.uY(l),l=m.add(l,2),e.x1=f+c*m.uX(l),e.y1=b+u*m.uY(l),l=m.add(l,2),e.x2=f+c*m.uX(l),e.y2=b+u*m.uY(l),l=m.add(l,2),e.x3=f+c*m.uX(l),e.y3=b+u*m.uY(l)}else e.x0=i,e.y0=a,e.x1=i+o,e.y1=a,e.x2=i+o,e.y2=a+d,e.x3=i,e.y3=a+d}destroy(e=!1){this._source&&(this._source.off("resize",this.update,this),e&&(this._source.destroy(),this._source=null)),this._textureMatrix=null,this.destroyed=!0,this.emit("destroy",this),this.removeAllListeners()}update(){this.noFrame&&(this.frame.width=this._source.width,this.frame.height=this._source.height),this.updateUvs(),this.emit("update",this)}get baseTexture(){return he(Ue,"Texture.baseTexture is now Texture.source"),this._source}}O.EMPTY=new O({label:"EMPTY",source:new fe({label:"EMPTY"})});O.EMPTY.destroy=Ge;O.WHITE=new O({source:new Re({resource:new Uint8Array([255,255,255,255]),width:1,height:1,alphaMode:"premultiply-alpha-on-upload",label:"WHITE"}),label:"WHITE"});O.WHITE.destroy=Ge;class J{constructor(e){this.resources=Object.create(null),this._dirty=!0;let t=0;for(const s in e){const r=e[s];this.setResource(r,t++)}this._updateKey()}_updateKey(){if(!this._dirty)return;this._dirty=!1;const e=[];let t=0;for(const s in this.resources)e[t++]=this.resources[s]._resourceId;this._key=e.join("|")}setResource(e,t){const s=this.resources[t];e!==s&&(s?.off?.("change",this.onResourceChange,this),e.on?.("change",this.onResourceChange,this),this.resources[t]=e,this._dirty=!0)}getResource(e){return this.resources[e]}_touch(e,t){const s=this.resources;for(const r in s)s[r]._gcLastUsed=e,s[r]._touched=t}destroy(){const e=this.resources;for(const t in e)e[t]?.off?.("change",this.onResourceChange,this);this.resources=null}onResourceChange(e){this._dirty=!0,e.destroyed?this.destroy():this._updateKey()}}var ae=(n=>(n[n.WEBGL=1]="WEBGL",n[n.WEBGPU=2]="WEBGPU",n[n.CANVAS=4]="CANVAS",n[n.BOTH=3]="BOTH",n))(ae||{});class be extends H{constructor(e){super(),this.uid=w("shader"),this._uniformBindMap=Object.create(null),this._ownedBindGroups=[],this._destroyed=!1;let{gpuProgram:t,glProgram:s,groups:r,resources:i,compatibleRenderers:a,groupMap:o}=e;this.gpuProgram=t,this.glProgram=s,a===void 0&&(a=0,t&&(a|=ae.WEBGPU),s&&(a|=ae.WEBGL)),this.compatibleRenderers=a;const d={};if(!i&&!r&&(i={}),i&&r)throw new Error("[Shader] Cannot have both resources and groups");if(!t&&r&&!o)throw new Error("[Shader] No group map or WebGPU shader provided - consider using resources instead.");if(!t&&r&&o)for(const l in o)for(const c in o[l]){const u=o[l][c];d[u]={group:l,binding:c,name:u}}else if(t&&r&&!o){const l=t.structsAndGroups.groups;o={},l.forEach(c=>{o[c.group]=o[c.group]||{},o[c.group][c.binding]=c.name,d[c.name]=c})}else if(i){r={},o={},t&&t.structsAndGroups.groups.forEach(u=>{o[u.group]=o[u.group]||{},o[u.group][u.binding]=u.name,d[u.name]=u});let l=0;for(const c in i)d[c]||(r[99]||(r[99]=new J,this._ownedBindGroups.push(r[99])),d[c]={group:99,binding:l,name:c},o[99]=o[99]||{},o[99][l]=c,l++);for(const c in i){const u=c;let f=i[c];!f.source&&!f._resourceType&&(f=new Te(f));const b=d[u];b&&(r[b.group]||(r[b.group]=new J,this._ownedBindGroups.push(r[b.group])),r[b.group].setResource(f,b.binding))}}this.groups=r,this._uniformBindMap=o,this.resources=this._buildResourceAccessor(r,d)}addResource(e,t,s){var r,i;(r=this._uniformBindMap)[t]||(r[t]={}),(i=this._uniformBindMap[t])[s]||(i[s]=e),this.groups[t]||(this.groups[t]=new J,this._ownedBindGroups.push(this.groups[t]))}_buildResourceAccessor(e,t){const s={};for(const r in t){const i=t[r];Object.defineProperty(s,i.name,{get(){return e[i.group].getResource(i.binding)},set(a){e[i.group].setResource(a,i.binding)}})}return s}destroy(e=!1){this._destroyed||(this._destroyed=!0,this.emit("destroy",this),e&&(this.gpuProgram?.destroy(),this.glProgram?.destroy()),this.gpuProgram=null,this.glProgram=null,this.removeAllListeners(),this._uniformBindMap=null,this._ownedBindGroups.forEach(t=>{t.destroy()}),this._ownedBindGroups=null,this.resources=null,this.groups=null)}static from(e){const{gpu:t,gl:s,...r}=e;let i,a;return t&&(i=I.from(t)),s&&(a=ue.from(s)),new be({gpuProgram:i,glProgram:a,...r})}}const Lt={normal:0,add:1,multiply:2,screen:3,overlay:4,erase:5,"normal-npm":6,"add-npm":7,"screen-npm":8,min:9,max:10},Z=0,Q=1,ee=2,te=3,ne=4,se=5,le=class We{constructor(){this.data=0,this.blendMode="normal",this.polygonOffset=0,this.blend=!0,this.depthMask=!0}get blend(){return!!(this.data&1<<Z)}set blend(e){!!(this.data&1<<Z)!==e&&(this.data^=1<<Z)}get offsets(){return!!(this.data&1<<Q)}set offsets(e){!!(this.data&1<<Q)!==e&&(this.data^=1<<Q)}set cullMode(e){if(e==="none"){this.culling=!1;return}this.culling=!0,this.clockwiseFrontFace=e==="front"}get cullMode(){return this.culling?this.clockwiseFrontFace?"front":"back":"none"}get culling(){return!!(this.data&1<<ee)}set culling(e){!!(this.data&1<<ee)!==e&&(this.data^=1<<ee)}get depthTest(){return!!(this.data&1<<te)}set depthTest(e){!!(this.data&1<<te)!==e&&(this.data^=1<<te)}get depthMask(){return!!(this.data&1<<se)}set depthMask(e){!!(this.data&1<<se)!==e&&(this.data^=1<<se)}get clockwiseFrontFace(){return!!(this.data&1<<ne)}set clockwiseFrontFace(e){!!(this.data&1<<ne)!==e&&(this.data^=1<<ne)}get blendMode(){return this._blendMode}set blendMode(e){this.blend=e!=="none",this._blendMode=e,this._blendModeId=Lt[e]||0}get polygonOffset(){return this._polygonOffset}set polygonOffset(e){this.offsets=!!e,this._polygonOffset=e}toString(){return`[pixi.js/core:State blendMode=${this.blendMode} clockwiseFrontFace=${this.clockwiseFrontFace} culling=${this.culling} depthMask=${this.depthMask} polygonOffset=${this.polygonOffset}]`}static for2d(){const e=new We;return e.depthTest=!1,e.blend=!0,e}};le.default2d=le.for2d();let Bt=le;const Ve=class ce extends be{constructor(e){e={...ce.defaultOptions,...e},super(e),this.enabled=!0,this._state=Bt.for2d(),this.blendMode=e.blendMode,this.padding=e.padding,typeof e.antialias=="boolean"?this.antialias=e.antialias?"on":"off":this.antialias=e.antialias,this.resolution=e.resolution,this.blendRequired=e.blendRequired,this.clipToViewport=e.clipToViewport,this.addResource("uTexture",0,1),e.blendRequired&&this.addResource("uBackTexture",0,3)}apply(e,t,s,r){e.applyFilter(this,t,s,r)}get blendMode(){return this._state.blendMode}set blendMode(e){this._state.blendMode=e}static from(e){const{gpu:t,gl:s,...r}=e;let i,a;return t&&(i=I.from(t)),s&&(a=ue.from(s)),new ce({gpuProgram:i,glProgram:a,...r})}};Ve.defaultOptions={blendMode:"normal",resolution:1,padding:0,antialias:"off",blendRequired:!1,clipToViewport:!0};let St=Ve;var At=`
in vec2 vTextureCoord;
in vec4 vColor;

out vec4 finalColor;

uniform float uBlend;

uniform sampler2D uTexture;
uniform sampler2D uBackTexture;

{FUNCTIONS}

void main()
{ 
    vec4 back = texture(uBackTexture, vTextureCoord);
    vec4 front = texture(uTexture, vTextureCoord);
    float blendedAlpha = front.a + back.a * (1.0 - front.a);
    
    {MAIN}
}
`,Ct=`in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 backgroundUv;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`,Pt=`
struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

struct BlendUniforms {
  uBlend:f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler : sampler;
@group(0) @binding(3) var uBackTexture: texture_2d<f32>;

@group(1) @binding(0) var<uniform> blendUniforms : BlendUniforms;


struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>
  };

fn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>
{
    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

fn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);  
}
  
@vertex
fn mainVertex(
  @location(0) aPosition : vec2<f32>, 
) -> VSOutput {
  return VSOutput(
   filterVertexPosition(aPosition),
   filterTextureCoord(aPosition)
  );
}

{FUNCTIONS}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {


   var back =  textureSample(uBackTexture, uSampler, uv);
   var front = textureSample(uTexture, uSampler, uv);
   var blendedAlpha = front.a + back.a * (1.0 - front.a);
   
   var out = vec4<f32>(0.0,0.0,0.0,0.0);

   {MAIN}

   return out;
}`;class v extends St{constructor(e){const t=e.gpu,s=Pe({source:Pt,...t}),r=I.from({vertex:{source:s,entryPoint:"mainVertex"},fragment:{source:s,entryPoint:"mainFragment"}}),i=e.gl,a=Pe({source:At,...i}),o=ue.from({vertex:Ct,fragment:a}),d=new Te({uBlend:{value:1,type:"f32"}});super({gpuProgram:r,glProgram:o,blendRequired:!0,resources:{blendUniforms:d,uBackTexture:O.EMPTY}})}}function Pe(n){const{source:e,functions:t,main:s}=n;return e.replace("{FUNCTIONS}",t).replace("{MAIN}",s)}const ge=`
	float getLuminosity(vec3 c) {
		return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
	}

	vec3 setLuminosity(vec3 c, float lum) {
		float modLum = lum - getLuminosity(c);
		vec3 color = c.rgb + vec3(modLum);

		// clip back into legal range
		modLum = getLuminosity(color);
		vec3 modLumVec = vec3(modLum);

		float cMin = min(color.r, min(color.g, color.b));
		float cMax = max(color.r, max(color.g, color.b));

		if(cMin < 0.0) {
			color = mix(modLumVec, color, modLum / (modLum - cMin));
		}

		if(cMax > 1.0) {
			color = mix(modLumVec, color, (1.0 - modLum) / (cMax - modLum));
		}

		return color;
	}

	float getSaturation(vec3 c) {
		return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
	}

	vec3 setSaturationMinMidMax(vec3 cSorted, float s) {
		vec3 colorSorted = cSorted;

		if(colorSorted.z > colorSorted.x) {
			colorSorted.y = (((colorSorted.y - colorSorted.x) * s) / (colorSorted.z - colorSorted.x));
			colorSorted.z = s;
		}
		else {
			colorSorted.y = 0.0;
			colorSorted.z = 0.0;
		}

		colorSorted.x = 0.0;

		return colorSorted;
	}

	vec3 setSaturation(vec3 c, float s) {
		vec3 color = c;

		if(color.r <= color.g && color.r <= color.b) {
			if(color.g <= color.b) {
				color = setSaturationMinMidMax(color.rgb, s).rgb;
			}
			else {
				color = setSaturationMinMidMax(color.rbg, s).rbg;
			}
		}
		else if(color.g <= color.r && color.g <= color.b) {
			if(color.r <= color.b) {
				color = setSaturationMinMidMax(color.grb, s).grb;
			}
			else {
				color = setSaturationMinMidMax(color.gbr, s).gbr;
			}
		}
		else {
			// Using bgr for both fixes part of hue
			if(color.r <= color.g) {
				color = setSaturationMinMidMax(color.brg, s).brg;
			}
			else {
				color = setSaturationMinMidMax(color.bgr, s).bgr;
			}
		}

		return color;
	}
    `,pe=`
	fn getLuminosity(c: vec3<f32>) -> f32
	{
		return 0.3*c.r + 0.59*c.g + 0.11*c.b;
	}

	fn setLuminosity(c: vec3<f32>, lum: f32) -> vec3<f32>
	{
		var modLum: f32 = lum - getLuminosity(c);
		var color: vec3<f32> = c.rgb + modLum;

		// clip back into legal range
		modLum = getLuminosity(color);
		let modLumVec = vec3<f32>(modLum);

		let cMin: f32 = min(color.r, min(color.g, color.b));
		let cMax: f32 = max(color.r, max(color.g, color.b));

		if(cMin < 0.0)
		{
			color = mix(modLumVec, color, modLum / (modLum - cMin));
		}

		if(cMax > 1.0)
		{
			color = mix(modLumVec, color, (1 - modLum) / (cMax - modLum));
		}

		return color;
	}

	fn getSaturation(c: vec3<f32>) -> f32
	{
		return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
	}

	fn setSaturationMinMidMax(cSorted: vec3<f32>, s: f32) -> vec3<f32>
	{
		var colorSorted = cSorted;

		if(colorSorted.z > colorSorted.x)
		{
			colorSorted.y = (((colorSorted.y - colorSorted.x) * s) / (colorSorted.z - colorSorted.x));
			colorSorted.z = s;
		}
		else
		{
			colorSorted.y = 0;
			colorSorted.z = 0;
		}

		colorSorted.x = 0;

		return colorSorted;
	}

	fn setSaturation(c: vec3<f32>, s: f32) -> vec3<f32>
	{
		var color = c;

		if (color.r <= color.g && color.r <= color.b)
		{
			if (color.g <= color.b)
			{
				color = vec3<f32>(setSaturationMinMidMax(color.rgb, s)).rgb;
			}
			else
			{
				color = vec3<f32>(setSaturationMinMidMax(color.rbg, s)).rbg;
			}
		}
		else if (color.g <= color.r && color.g <= color.b)
		{
			if (color.r <= color.b)
			{
				color = vec3<f32>(setSaturationMinMidMax(color.grb, s)).grb;
			}
			else
			{
				color = vec3<f32>(setSaturationMinMidMax(color.gbr, s)).gbr;
			}
		}
		else
		{
			// Using bgr for both fixes part of hue
			if (color.r <= color.g)
			{
				color = vec3<f32>(setSaturationMinMidMax(color.brg, s)).brg;
			}
			else
			{
				color  = vec3<f32>(setSaturationMinMidMax(color.bgr, s)).bgr;
			}
		}

		return color;
	}
	`;class Ft extends v{constructor(){super({gl:{functions:`
                ${ge}

                vec3 blendColor(vec3 base, vec3 blend,  float opacity)
                {
                    return (setLuminosity(blend, getLuminosity(base)) * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendColor(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                ${pe}

                fn blendColorOpacity(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    return (setLuminosity(blend, getLuminosity(base)) * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendColorOpacity(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}Ft.extension={name:"color",type:y.BlendMode};class Ot extends v{constructor(){super({gl:{functions:`
                float colorBurn(float base, float blend)
                {
                    return max((1.0 - ((1.0 - base) / blend)), 0.0);
                }

                vec3 blendColorBurn(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        colorBurn(base.r, blend.r),
                        colorBurn(base.g, blend.g),
                        colorBurn(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendColorBurn(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
            `},gpu:{functions:`
                fn colorBurn(base:f32, blend:f32) -> f32
                {
                    return max((1.0-((1.0-base)/blend)),0.0);
                }

                fn blendColorBurn(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        colorBurn(base.r, blend.r),
                        colorBurn(base.g, blend.g),
                        colorBurn(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendColorBurn(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Ot.extension={name:"color-burn",type:y.BlendMode};class kt extends v{constructor(){super({gl:{functions:`
                float colorDodge(float base, float blend)
                {
                    return base / (1.0 - blend);
                }

                vec3 blendColorDodge(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        colorDodge(base.r, blend.r),
                        colorDodge(base.g, blend.g),
                        colorDodge(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendColorDodge(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn colorDodge(base: f32, blend: f32) -> f32
                {
                    return base / (1.0 - blend);
                }

                fn blendColorDodge(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        colorDodge(base.r, blend.r),
                        colorDodge(base.g, blend.g),
                        colorDodge(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                    out = vec4<f32>(blendColorDodge(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}kt.extension={name:"color-dodge",type:y.BlendMode};class Dt extends v{constructor(){super({gl:{functions:`
                vec3 blendDarken(vec3 base, vec3 blend, float opacity)
                {
                    return (min(base, blend) * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendDarken(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn blendDarken(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    return (min(blend,base) * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendDarken(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}Dt.extension={name:"darken",type:y.BlendMode};class Tt extends v{constructor(){super({gl:{functions:`
                vec3 blendDifference(vec3 base, vec3 blend,  float opacity)
                {
                    return (abs(blend - base) * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendDifference(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
            `},gpu:{functions:`
                fn blendDifference(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    return (abs(blend - base) * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendDifference(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Tt.extension={name:"difference",type:y.BlendMode};class Et extends v{constructor(){super({gl:{functions:`
                float divide(float base, float blend)
                {
                    return (blend > 0.0) ? clamp(base / blend, 0.0, 1.0) : 1.0;
                }

                vec3 blendDivide(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        divide(base.r, blend.r),
                        divide(base.g, blend.g),
                        divide(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendDivide(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn divide(base: f32, blend: f32) -> f32
                {
                    return select(1.0, clamp(base / blend, 0.0, 1.0), blend > 0.0);
                }

                fn blendDivide(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        divide(base.r, blend.r),
                        divide(base.g, blend.g),
                        divide(base.b, blend.b)
                    );
                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendDivide(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Et.extension={name:"divide",type:y.BlendMode};class Ut extends v{constructor(){super({gl:{functions:`
                vec3 exclusion(vec3 base, vec3 blend)
                {
                    return base + blend - 2.0 * base * blend;
                }

                vec3 blendExclusion(vec3 base, vec3 blend, float opacity)
                {
                    return (exclusion(base, blend) * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendExclusion(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn exclusion(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32>
                {
                    return base+blend-2.0*base*blend;
                }

                fn blendExclusion(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    return (exclusion(base, blend) * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendExclusion(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Ut.extension={name:"exclusion",type:y.BlendMode};class Gt extends v{constructor(){super({gl:{functions:`
                float hardLight(float base, float blend)
                {
                    return (blend < 0.5) ? 2.0 * base * blend : 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
                }

                vec3 blendHardLight(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        hardLight(base.r, blend.r),
                        hardLight(base.g, blend.g),
                        hardLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendHardLight(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
            `},gpu:{functions:`
                fn hardLight(base: f32, blend: f32) -> f32
                {
                    return select(1.0 - 2.0 * (1.0 - base) * (1.0 - blend), 2.0 * base * blend, blend < 0.5);
                }

                fn blendHardLight(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        hardLight(base.r, blend.r),
                        hardLight(base.g, blend.g),
                        hardLight(base.b, blend.b)
                    );
                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendHardLight(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}Gt.extension={name:"hard-light",type:y.BlendMode};class It extends v{constructor(){super({gl:{functions:`
                float hardMix(float base, float blend)
                {
                    return (base + blend >= 1.0) ? 1.0 : 0.0;
                }

                vec3 blendHardMix(vec3 base, vec3 blend,  float opacity)
                {
                    vec3 blended = vec3(
                        hardMix(base.r, blend.r),
                        hardMix(base.g, blend.g),
                        hardMix(base.b, blend.b)
                    );
                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendHardMix(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
            `},gpu:{functions:`
                fn hardMix(base: f32, blend: f32) -> f32
                {
                    return select(0.0, 1.0, base + blend >= 1.0);
                }

                fn blendHardMix(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blended: vec3<f32> = vec3<f32>(
                        hardMix(base.r, blend.r),
                        hardMix(base.g, blend.g),
                        hardMix(base.b, blend.b)
                    );
                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendHardMix(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}It.extension={name:"hard-mix",type:y.BlendMode};class $t extends v{constructor(){super({gl:{functions:`
                vec3 blendLighten(vec3 base, vec3 blend, float opacity)
                {
                    return (max(base, blend) * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendLighten(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn blendLighten(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    return (max(base, blend) * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendLighten(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}$t.extension={name:"lighten",type:y.BlendMode};class zt extends v{constructor(){super({gl:{functions:`
                float linearBurn(float base, float blend)
                {
                    return max(0.0, base + blend - 1.0);
                }

                vec3 blendLinearBurn(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        linearBurn(base.r, blend.r),
                        linearBurn(base.g, blend.g),
                        linearBurn(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendLinearBurn(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn linearBurn(base: f32, blend: f32) -> f32
                {
                    return max(0.0, base + blend - 1.0);
                }

                fn blendLinearBurn(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        linearBurn(base.r, blend.r),
                        linearBurn(base.g, blend.g),
                        linearBurn(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendLinearBurn(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}zt.extension={name:"linear-burn",type:y.BlendMode};class Nt extends v{constructor(){super({gl:{functions:`
                float linearDodge(float base, float blend) {
                    return min(1.0, base + blend);
                }

                vec3 blendLinearDodge(vec3 base, vec3 blend, float opacity) {
                    vec3 blended = vec3(
                        linearDodge(base.r, blend.r),
                        linearDodge(base.g, blend.g),
                        linearDodge(base.b, blend.b)
                    );
                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendLinearDodge(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn linearDodge(base: f32, blend: f32) -> f32
                {
                    return min(1, base + blend);
                }

                fn blendLinearDodge(base:vec3<f32>, blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        linearDodge(base.r, blend.r),
                        linearDodge(base.g, blend.g),
                        linearDodge(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendLinearDodge(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Nt.extension={name:"linear-dodge",type:y.BlendMode};class Rt extends v{constructor(){super({gl:{functions:`
                float linearBurn(float base, float blend) {
                    return max(0.0, base + blend - 1.0);
                }

                float linearDodge(float base, float blend) {
                    return min(1.0, base + blend);
                }

                float linearLight(float base, float blend) {
                    return (blend <= 0.5) ? linearBurn(base,2.0*blend) : linearBurn(base,2.0*(blend-0.5));
                }

                vec3 blendLinearLight(vec3 base, vec3 blend, float opacity) {
                    vec3 blended = vec3(
                        linearLight(base.r, blend.r),
                        linearLight(base.g, blend.g),
                        linearLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendLinearLight(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn linearBurn(base: f32, blend: f32) -> f32
                {
                    return max(0.0, base + blend - 1.0);
                }

                fn linearDodge(base: f32, blend: f32) -> f32
                {
                    return min(1.0, base + blend);
                }

                fn linearLight(base: f32, blend: f32) -> f32
                {
                    return select(linearBurn(base,2.0*(blend-0.5)), linearBurn(base,2.0*blend), blend <= 0.5);
                }

                fn blendLinearLightOpacity(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        linearLight(base.r, blend.r),
                        linearLight(base.g, blend.g),
                        linearLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendLinearLightOpacity(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Rt.extension={name:"linear-light",type:y.BlendMode};class Wt extends v{constructor(){super({gl:{functions:`
                ${ge}

                vec3 blendLuminosity(vec3 base, vec3 blend,  float opacity)
                {
                    vec3 blendLuminosity = setLuminosity(base, getLuminosity(blend));
                    return (blendLuminosity * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendLuminosity(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                ${pe}

                fn blendLuminosity(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blendLuminosity: vec3<f32> = setLuminosity(base, getLuminosity(blend));
                    return (blendLuminosity * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendLuminosity(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Wt.extension={name:"luminosity",type:y.BlendMode};class Vt extends v{constructor(){super({gl:{functions:`
                vec3 negation(vec3 base, vec3 blend)
                {
                    return 1.0-abs(1.0-base-blend);
                }

                vec3 blendNegation(vec3 base, vec3 blend, float opacity)
                {
                    return (negation(base, blend) * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendNegation(back.rgb, front.rgb, front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn blendNegation(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32>
                {
                    return 1.0-abs(1.0-base-blend);
                }

                fn blendNegationOpacity(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    return (blendNegation(base, blend) * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendNegationOpacity(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}Vt.extension={name:"negation",type:y.BlendMode};class Ht extends v{constructor(){super({gl:{functions:`
                float overlay(float base, float blend)
                {
                    return (base < 0.5) ? (2.0*base*blend) : (1.0-2.0*(1.0-base)*(1.0-blend));
                }

                vec3 blendOverlay(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        overlay(base.r, blend.r),
                        overlay(base.g, blend.g),
                        overlay(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendOverlay(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn overlay(base: f32, blend: f32) -> f32
                {
                    return select((1.0-2.0*(1.0-base)*(1.0-blend)), (2.0*base*blend), base < 0.5);
                }

                fn blendOverlay(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        overlay(base.r, blend.r),
                        overlay(base.g, blend.g),
                        overlay(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendOverlay(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}Ht.extension={name:"overlay",type:y.BlendMode};class jt extends v{constructor(){super({gl:{functions:`
                float pinLight(float base, float blend)
                {
                    return (blend <= 0.5) ? min(base, 2.0 * blend) : max(base, 2.0 * (blend - 0.5));
                }

                vec3 blendPinLight(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        pinLight(base.r, blend.r),
                        pinLight(base.g, blend.g),
                        pinLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendPinLight(back.rgb, front.rgb, front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn pinLight(base: f32, blend: f32) -> f32
                {
                    return select(max(base,2.0*(blend-0.5)), min(base,2.0*blend), blend <= 0.5);
                }

                fn blendPinLight(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        pinLight(base.r, blend.r),
                        pinLight(base.g, blend.g),
                        pinLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendPinLight(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}jt.extension={name:"pin-light",type:y.BlendMode};class qt extends v{constructor(){super({gl:{functions:`
                ${ge}

                vec3 blendSaturation(vec3 base, vec3 blend,  float opacity)
                {
                    vec3 blendSaturation = setLuminosity(setSaturation(base, getSaturation(blend)), getLuminosity(base));
                    return (blendSaturation * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendSaturation(back.rgb, front.rgb, front.a), blendedAlpha) * uBlend;
            `},gpu:{functions:`
                ${pe}

                fn blendSaturation(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blendSaturation = setLuminosity(setSaturation(base, getSaturation(blend)), getLuminosity(base));
                    return (blendSaturation * opacity + base * (1.0 - opacity));
                }
            `,main:`
                out = vec4<f32>(blendSaturation(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `}})}}qt.extension={name:"saturation",type:y.BlendMode};class Yt extends v{constructor(){super({gl:{functions:`
                float softLight(float base, float blend)
                {
                    return (blend < 0.5) ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend)) : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));
                }

                vec3 blendSoftLight(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        softLight(base.r, blend.r),
                        softLight(base.g, blend.g),
                        softLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendSoftLight(back.rgb, front.rgb, front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn softLight(base: f32, blend: f32) -> f32
                {
                    return select(2.0 * base * blend + base * base * (1.0 - 2.0 * blend), sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend), blend < 0.5);
                }

                fn blendSoftLight(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blended: vec3<f32> = vec3<f32>(
                        softLight(base.r, blend.r),
                        softLight(base.g, blend.g),
                        softLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendSoftLight(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}Yt.extension={name:"soft-light",type:y.BlendMode};class Kt extends v{constructor(){super({gl:{functions:`
                float subtract(float base, float blend)
                {
                    return max(0.0, base - blend);
                }

                vec3 blendSubtract(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        subtract(base.r, blend.r),
                        subtract(base.g, blend.g),
                        subtract(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                finalColor = vec4(blendSubtract(back.rgb, front.rgb, front.a), blendedAlpha) * uBlend;
                `},gpu:{functions:`
                fn subtract(base: f32, blend: f32) -> f32
                {
                    return max(0, base - blend);
                }

                fn blendSubtract(base:vec3<f32>,  blend:vec3<f32>,  opacity:f32) -> vec3<f32>
                {
                    let blended = vec3<f32>(
                        subtract(base.r, blend.r),
                        subtract(base.g, blend.g),
                        subtract(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendSubtract(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}Kt.extension={name:"subtract",type:y.BlendMode};class Xt extends v{constructor(){super({gl:{functions:`
                float colorBurn(float base, float blend)
                {
                    return max((1.0-((1.0-base)/blend)),0.0);
                }

                float colorDodge(float base, float blend)
                {
                    return min(1.0, base / (1.0-blend));
                }

                float vividLight(float base, float blend)
                {
                    return (blend < 0.5) ? colorBurn(base,(2.0*blend)) : colorDodge(base,(2.0*(blend-0.5)));
                }

                vec3 blendVividLight(vec3 base, vec3 blend, float opacity)
                {
                    vec3 blended = vec3(
                        vividLight(base.r, blend.r),
                        vividLight(base.g, blend.g),
                        vividLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
            `,main:`
                finalColor = vec4(blendVividLight(back.rgb, front.rgb,front.a), blendedAlpha) * uBlend;
            `},gpu:{functions:`
                fn colorBurn(base:f32, blend:f32) -> f32
                {
                    return max((1.0-((1.0-base)/blend)),0.0);
                }

                fn colorDodge(base: f32, blend: f32) -> f32
                {
                    return min(1.0, base / (1.0-blend));
                }

                fn vividLight(base: f32, blend: f32) -> f32
                {
                    return select(colorDodge(base,(2.0*(blend-0.5))), colorBurn(base,(2.0*blend)), blend<0.5);
                }

                fn blendVividLight(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
                {
                    let blended: vec3<f32> = vec3<f32>(
                        vividLight(base.r, blend.r),
                        vividLight(base.g, blend.g),
                        vividLight(base.b, blend.b)
                    );

                    return (blended * opacity + base * (1.0 - opacity));
                }
                `,main:`
                out = vec4<f32>(blendVividLight(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
                `}})}}Xt.extension={name:"vivid-light",type:y.BlendMode};export{v as $,I as A,Re as B,Ft as C,Dt as D,Ut as E,be as F,ue as G,Gt as H,xt as I,rn as J,m as K,$t as L,k as M,Vt as N,Ht as O,jt as P,St as Q,G as R,qt as S,_t as T,Te as U,Xt as V,ae as W,wt as X,Bt as Y,it as Z,de as _,Ot as a,Ye as a0,Ge as a1,pt as a2,S as a3,ht as a4,Oe as a5,Ze as a6,At as a7,Ct as a8,Pt as a9,Qe as aa,lt as ab,Y as ac,ct as ad,dt as ae,ft as af,Je as ag,ge as ah,pe as ai,et as aj,Se as ak,an as al,z as am,ut as an,tn as ao,st as ap,rt as aq,kt as b,Tt as c,Et as d,en as e,It as f,zt as g,Rt as h,Nt as i,Wt as j,Yt as k,Kt as l,y as m,he as n,L as o,fe as p,O as q,on as r,H as s,nn as t,w as u,Ue as v,sn as w,Ke as x,J as y,Xe as z};
