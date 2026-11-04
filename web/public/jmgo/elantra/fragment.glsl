#version 300 es

precision highp float;
precision highp int;
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
uniform 	vec4 hlslcc_mtx4x4unity_MatrixV[4];
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
UNITY_LOCATION(0) uniform mediump sampler2D _Ramp;
UNITY_LOCATION(1) uniform mediump sampler2D _Matcap;
UNITY_LOCATION(2) uniform mediump sampler2D _OutlineMap;
in highp vec4 vs_TEXCOORD3;
in highp vec4 vs_TEXCOORD4;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
vec4 u_xlat1;
mediump vec3 u_xlat16_1;
bool u_xlatb1;
float u_xlat2;
bool u_xlatb2;
vec4 u_xlat3;
vec3 u_xlat4;
float u_xlat5;
vec3 u_xlat6;
float u_xlat8;
float u_xlat12;
mediump float u_xlat16_12;
void main()
{
    u_xlat0.z = float(-1.0);
    u_xlat0.w = float(0.666666687);
    u_xlat1.z = float(1.0);
    u_xlat1.w = float(-1.0);
    u_xlat2 = (-_ColorScale) + 1.0;
    u_xlat6.xyz = vs_TEXCOORD4.xyw * _OutlineMap_ST.xyy + _OutlineMap_ST.zww;
    u_xlat3.x = u_xlat6.z * 5.0;
    u_xlat3.x = floor(u_xlat3.x);
    u_xlat3.x = u_xlat3.x * 0.200000003;
    u_xlat3.x = u_xlat3.x * u_xlat2 + _ColorScale;
    u_xlat3.y = 0.5;
    u_xlat3.xyw = texture(_Ramp, u_xlat3.xy).yzx;
#ifdef UNITY_ADRENO_ES3
    u_xlatb2 = !!(u_xlat3.x>=u_xlat3.y);
#else
    u_xlatb2 = u_xlat3.x>=u_xlat3.y;
#endif
    u_xlat2 = u_xlatb2 ? 1.0 : float(0.0);
    u_xlat0.xy = u_xlat3.yx;
    u_xlat1.xy = (-u_xlat0.xy) + u_xlat3.xy;
    u_xlat0 = vec4(u_xlat2) * u_xlat1 + u_xlat0;
#ifdef UNITY_ADRENO_ES3
    u_xlatb1 = !!(u_xlat3.w>=u_xlat0.x);
#else
    u_xlatb1 = u_xlat3.w>=u_xlat0.x;
#endif
    u_xlat1.x = u_xlatb1 ? 1.0 : float(0.0);
    u_xlat3.xyz = u_xlat0.xyw;
    u_xlat0.xyw = u_xlat3.wyx;
    u_xlat0 = (-u_xlat3) + u_xlat0;
    u_xlat0 = u_xlat1.xxxx * u_xlat0 + u_xlat3;
    u_xlat1.x = min(u_xlat0.y, u_xlat0.w);
    u_xlat1.x = u_xlat0.x + (-u_xlat1.x);
    u_xlat5 = u_xlat1.x * 6.0 + 1.00000001e-10;
    u_xlat4.x = (-u_xlat0.y) + u_xlat0.w;
    u_xlat4.x = u_xlat4.x / u_xlat5;
    u_xlat4.x = u_xlat4.x + u_xlat0.z;
    u_xlat8 = _TimeParameters.x * _RampSpeed;
    u_xlat8 = fract(u_xlat8);
    u_xlat4.x = u_xlat8 + abs(u_xlat4.x);
    u_xlat4.xyz = u_xlat4.xxx + vec3(1.0, 0.666666687, 0.333333343);
    u_xlat4.xyz = fract(u_xlat4.xyz);
    u_xlat4.xyz = u_xlat4.xyz * vec3(6.0, 6.0, 6.0) + vec3(-3.0, -3.0, -3.0);
    u_xlat4.xyz = abs(u_xlat4.xyz) + vec3(-1.0, -1.0, -1.0);
#ifdef UNITY_ADRENO_ES3
    u_xlat4.xyz = min(max(u_xlat4.xyz, 0.0), 1.0);
#else
    u_xlat4.xyz = clamp(u_xlat4.xyz, 0.0, 1.0);
#endif
    u_xlat4.xyz = u_xlat4.xyz + vec3(-1.0, -1.0, -1.0);
    u_xlat5 = u_xlat0.x + 1.00000001e-10;
    u_xlat1.x = u_xlat1.x / u_xlat5;
    u_xlat4.xyz = u_xlat1.xxx * u_xlat4.xyz + vec3(1.0, 1.0, 1.0);
    u_xlat0.xyz = u_xlat4.xyz * u_xlat0.xxx;
    u_xlat16_12 = texture(_OutlineMap, u_xlat6.xy).x;
    u_xlat0.xyz = u_xlat0.xyz * vec3(u_xlat16_12);
    u_xlat1.xy = vs_TEXCOORD3.yy * hlslcc_mtx4x4unity_MatrixV[1].xy;
    u_xlat1.xy = hlslcc_mtx4x4unity_MatrixV[0].xy * vs_TEXCOORD3.xx + u_xlat1.xy;
    u_xlat1.xy = hlslcc_mtx4x4unity_MatrixV[2].xy * vs_TEXCOORD3.zz + u_xlat1.xy;
    u_xlat1.xy = u_xlat1.xy * vec2(0.5, 0.5) + vec2(0.5, 0.5);
    u_xlat16_1.xyz = texture(_Matcap, u_xlat1.xy).xyz;
    u_xlat12 = _TimeParameters.x * _BlinkingSpeed.y;
    u_xlat12 = fract(u_xlat12);
    u_xlat12 = u_xlat6.z + u_xlat12;
    u_xlat12 = u_xlat12 + -0.5;
    u_xlat12 = (-u_xlat12) + 0.5;
    u_xlat12 = abs(u_xlat12) * 16.6666679;
    u_xlat12 = min(u_xlat12, 1.0);
    u_xlat12 = (-u_xlat12) + 1.0;
    u_xlat12 = u_xlat12 * 0.100000001;
    u_xlat0.xyz = u_xlat16_1.xyz * u_xlat0.xyz + vec3(u_xlat12);
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}

