#version 300 es

#define HLSLCC_ENABLE_UNIFORM_BUFFERS 0
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
#define UNITY_UNIFORM
#else
#define UNITY_UNIFORM uniform
#endif
#define UNITY_SUPPORTS_UNIFORM_LOCATION 0
#if UNITY_SUPPORTS_UNIFORM_LOCATION
#define UNITY_LOCATION(x) layout(location = x)
#define UNITY_BINDING(x) layout(binding = x, std140)
#else
#define UNITY_LOCATION(x)
#define UNITY_BINDING(x) layout(std140)
#endif
uniform 	vec4 _TimeParameters;
uniform 	vec4 hlslcc_mtx4x4unity_MatrixVP[4];
uniform 	float AudioStrength0;
uniform 	float AudioStrength1;
uniform 	float AudioStrength2;
uniform 	float AudioStrength3;
uniform 	float AudioStrength4;
uniform 	float AudioStrength5;
uniform 	float AudioStrength6;
uniform 	float AudioStrength7;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(1) uniform UnityPerDraw {
#endif
	UNITY_UNIFORM vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
	UNITY_UNIFORM vec4 hlslcc_mtx4x4unity_WorldToObject[4];
	UNITY_UNIFORM vec4 unity_LODFade;
	UNITY_UNIFORM mediump vec4 unity_WorldTransformParams;
	UNITY_UNIFORM mediump vec4 unity_LightData;
	UNITY_UNIFORM mediump vec4 unity_LightIndices[2];
	UNITY_UNIFORM vec4 unity_ProbesOcclusion;
	UNITY_UNIFORM mediump vec4 unity_SpecCube0_HDR;
	UNITY_UNIFORM vec4 unity_LightmapST;
	UNITY_UNIFORM vec4 unity_DynamicLightmapST;
	UNITY_UNIFORM mediump vec4 unity_SHAr;
	UNITY_UNIFORM mediump vec4 unity_SHAg;
	UNITY_UNIFORM mediump vec4 unity_SHAb;
	UNITY_UNIFORM mediump vec4 unity_SHBr;
	UNITY_UNIFORM mediump vec4 unity_SHBg;
	UNITY_UNIFORM mediump vec4 unity_SHBb;
	UNITY_UNIFORM mediump vec4 unity_SHC;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(0) uniform UnityPerMaterial {
#endif
	UNITY_UNIFORM vec4 _OutlineMap_ST;
	UNITY_UNIFORM vec2 _BlinkingSpeed;
	UNITY_UNIFORM float _LowDensity;
	UNITY_UNIFORM float _VertexNoiseTilling;
	UNITY_UNIFORM float _VertexNoiseSpeed;
	UNITY_UNIFORM float _LowIntensity;
	UNITY_UNIFORM float _MiddleDensity;
	UNITY_UNIFORM float _MiddleIntensity;
	UNITY_UNIFORM float _HighDensity;
	UNITY_UNIFORM float _HighIntensity;
	UNITY_UNIFORM float _Control;
	UNITY_UNIFORM float _ColorScale;
	UNITY_UNIFORM float _RampSpeed;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(3) uniform mediump sampler2D _VertexNoise;
in highp vec4 in_POSITION0;
in highp vec3 in_NORMAL0;
in highp vec4 in_TEXCOORD0;
in highp vec4 in_TEXCOORD1;
out highp vec4 vs_TEXCOORD3;
out highp vec4 vs_TEXCOORD4;
vec4 u_xlat0;
vec4 u_xlat1;
ivec3 u_xlati1;
vec3 u_xlat2;
ivec3 u_xlati2;
vec3 u_xlat3;
vec3 u_xlat4;
vec4 u_xlat5;
vec4 u_xlat6;
vec3 u_xlat7;
float u_xlat8;
vec3 u_xlat11;
vec2 u_xlat14;
float u_xlat15;
float u_xlat18;
float u_xlat21;
float u_xlat23;
float u_xlat24;
void main()
{
    u_xlat0.x = (-_MiddleDensity) + 1.0;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat7.xyz = in_NORMAL0.yyy * hlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    u_xlat7.xyz = hlslcc_mtx4x4unity_ObjectToWorld[0].xyz * in_NORMAL0.xxx + u_xlat7.xyz;
    u_xlat7.xyz = hlslcc_mtx4x4unity_ObjectToWorld[2].xyz * in_NORMAL0.zzz + u_xlat7.xyz;
    u_xlat1.x = dot(u_xlat7.xyz, u_xlat7.xyz);
    u_xlat1.x = max(u_xlat1.x, 1.17549435e-38);
    u_xlat1.x = inversesqrt(u_xlat1.x);
    u_xlat7.xyz = u_xlat7.xyz * u_xlat1.xxx;
    u_xlati1.xyz = ivec3(uvec3(lessThan(vec4(0.0, 0.0, 0.0, 0.0), u_xlat7.xyzx).xyz) * 0xFFFFFFFFu);
    u_xlati2.xyz = ivec3(uvec3(lessThan(u_xlat7.xyzx, vec4(0.0, 0.0, 0.0, 0.0)).xyz) * 0xFFFFFFFFu);
    u_xlati1.xyz = (-u_xlati1.xyz) + u_xlati2.xyz;
    u_xlat1.xyz = vec3(u_xlati1.xyz);
    u_xlat2.xyz = in_POSITION0.yyy * hlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_ObjectToWorld[0].xyz * in_POSITION0.xxx + u_xlat2.xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_ObjectToWorld[2].xyz * in_POSITION0.zzz + u_xlat2.xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_ObjectToWorld[3].xyz * in_POSITION0.www + u_xlat2.xyz;
    u_xlat2.xyz = u_xlat2.xyz + (-hlslcc_mtx4x4unity_ObjectToWorld[3].xyz);
    u_xlat3.xyz = u_xlat2.xyz * vec3(vec3(_VertexNoiseTilling, _VertexNoiseTilling, _VertexNoiseTilling));
    u_xlat23 = _TimeParameters.x * _VertexNoiseSpeed;
    u_xlat4.xyz = vec3(u_xlat23) * vec3(-1.5, -1.5, -1.5) + u_xlat3.xyz;
    u_xlat3.xyz = vec3(u_xlat23) * vec3(2.0, 2.0, 2.0) + u_xlat3.xyz;
    u_xlat2.xyz = u_xlat2.xyz * vec3(vec3(_VertexNoiseTilling, _VertexNoiseTilling, _VertexNoiseTilling)) + vec3(u_xlat23);
    u_xlat1.w = 1.0;
    u_xlat5 = u_xlat1.xwyw * u_xlat4.zyxz;
    u_xlat23 = textureLod(_VertexNoise, u_xlat5.xy, 0.0).x;
    u_xlat24 = textureLod(_VertexNoise, u_xlat5.zw, 0.0).x;
    u_xlat18 = abs(u_xlat7.y) + abs(u_xlat7.x);
    u_xlat18 = abs(u_xlat7.z) + u_xlat18;
    u_xlat18 = u_xlat18 + 9.99999975e-06;
    u_xlat5.xyz = abs(u_xlat7.xyz) / vec3(u_xlat18);
    vs_TEXCOORD3.xyz = u_xlat7.xyz;
    u_xlat7.x = u_xlat24 * u_xlat5.y;
    u_xlat7.x = u_xlat23 * u_xlat5.x + u_xlat7.x;
    u_xlat14.xy = u_xlat1.zw * vec2(-1.0, 1.0);
    u_xlat4.xy = u_xlat14.xy * u_xlat4.xy;
    u_xlat15 = textureLod(_VertexNoise, u_xlat4.xy, 0.0).x;
    u_xlat7.x = u_xlat15 * u_xlat5.z + u_xlat7.x;
    u_xlat7.x = u_xlat7.x + (-_MiddleDensity);
    u_xlat0.x = u_xlat0.x * u_xlat7.x;
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat7.x = u_xlat0.x * -2.0 + 3.0;
    u_xlat0.x = u_xlat0.x * u_xlat0.x;
    u_xlat0.x = u_xlat0.x * u_xlat7.x;
    u_xlat4.xy = vec2(AudioStrength1, AudioStrength3) + vec2(AudioStrength0, AudioStrength2);
    u_xlat7.x = u_xlat4.y + AudioStrength4;
    u_xlat0.x = u_xlat0.x * u_xlat7.x;
    u_xlat0.x = u_xlat0.x * _MiddleIntensity;
    u_xlat0.x = u_xlat0.x * 0.333333343;
    u_xlat11.xyz = u_xlat0.xxx * in_POSITION0.xyz;
    u_xlat6 = u_xlat1.xwyw * u_xlat2.zyxz;
    u_xlat1 = u_xlat1.xwyw * u_xlat3.zyxz;
    u_xlat0.xy = u_xlat14.xy * u_xlat3.xy;
    u_xlat14.xy = u_xlat14.xy * u_xlat2.xy;
    u_xlat14.x = textureLod(_VertexNoise, u_xlat14.xy, 0.0).x;
    u_xlat0.x = textureLod(_VertexNoise, u_xlat0.xy, 0.0).x;
    u_xlat7.x = textureLod(_VertexNoise, u_xlat6.xy, 0.0).x;
    u_xlat21 = textureLod(_VertexNoise, u_xlat6.zw, 0.0).x;
    u_xlat21 = u_xlat5.y * u_xlat21;
    u_xlat7.x = u_xlat7.x * u_xlat5.x + u_xlat21;
    u_xlat7.x = u_xlat14.x * u_xlat5.z + u_xlat7.x;
    u_xlat7.x = u_xlat7.x + (-_LowDensity);
    u_xlat14.x = (-_LowDensity) + 1.0;
    u_xlat14.x = float(1.0) / u_xlat14.x;
    u_xlat7.x = u_xlat14.x * u_xlat7.x;
#ifdef UNITY_ADRENO_ES3
    u_xlat7.x = min(max(u_xlat7.x, 0.0), 1.0);
#else
    u_xlat7.x = clamp(u_xlat7.x, 0.0, 1.0);
#endif
    u_xlat14.x = u_xlat7.x * -2.0 + 3.0;
    u_xlat7.x = u_xlat7.x * u_xlat7.x;
    u_xlat7.x = u_xlat7.x * u_xlat14.x;
    u_xlat7.x = u_xlat7.x * u_xlat4.x;
    u_xlat7.x = u_xlat7.x * _LowIntensity;
    u_xlat7.x = u_xlat7.x * 0.5;
    u_xlat7.xyz = u_xlat7.xxx * in_POSITION0.xyz + u_xlat11.xyz;
    u_xlat1.x = textureLod(_VertexNoise, u_xlat1.xy, 0.0).x;
    u_xlat8 = textureLod(_VertexNoise, u_xlat1.zw, 0.0).x;
    u_xlat8 = u_xlat5.y * u_xlat8;
    u_xlat1.x = u_xlat1.x * u_xlat5.x + u_xlat8;
    u_xlat0.x = u_xlat0.x * u_xlat5.z + u_xlat1.x;
    u_xlat0.x = u_xlat0.x + (-_HighDensity);
    u_xlat1.x = (-_HighDensity) + 1.0;
    u_xlat1.x = float(1.0) / u_xlat1.x;
    u_xlat0.x = u_xlat0.x * u_xlat1.x;
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat1.x = u_xlat0.x * -2.0 + 3.0;
    u_xlat0.x = u_xlat0.x * u_xlat0.x;
    u_xlat0.x = u_xlat0.x * u_xlat1.x;
    u_xlat1.x = AudioStrength6 + AudioStrength5;
    u_xlat1.x = u_xlat1.x + AudioStrength7;
    u_xlat0.x = u_xlat0.x * u_xlat1.x;
    u_xlat0.x = u_xlat0.x * _HighIntensity;
    u_xlat0.x = u_xlat0.x * 0.333333343;
    u_xlat0.xyz = in_POSITION0.xyz * u_xlat0.xxx + u_xlat7.xyz;
    u_xlat0.xyz = u_xlat0.xyz * vec3(vec3(_Control, _Control, _Control)) + in_POSITION0.xyz;
    u_xlat1.xyz = u_xlat0.yyy * hlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    u_xlat0.xyw = hlslcc_mtx4x4unity_ObjectToWorld[0].xyz * u_xlat0.xxx + u_xlat1.xyz;
    u_xlat0.xyz = hlslcc_mtx4x4unity_ObjectToWorld[2].xyz * u_xlat0.zzz + u_xlat0.xyw;
    u_xlat0.xyz = u_xlat0.xyz + hlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
    u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
    u_xlat0 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
    gl_Position = u_xlat0 + hlslcc_mtx4x4unity_MatrixVP[3];
    vs_TEXCOORD3.w = 0.0;
    vs_TEXCOORD4.xy = in_TEXCOORD0.xy;
    vs_TEXCOORD4.zw = in_TEXCOORD1.xy;
    return;
}

