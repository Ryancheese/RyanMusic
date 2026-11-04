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
uniform 	vec3 _WorldSpaceCameraPos;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(0) uniform UnityPerMaterial {
#endif
	UNITY_UNIFORM vec4 _ColorA;
	UNITY_UNIFORM vec4 _ColorB;
	UNITY_UNIFORM float _UVTime;
	UNITY_UNIFORM float _SpeedS;
	UNITY_UNIFORM float _ScanMaskRange;
	UNITY_UNIFORM float _ScanMaskIntensity;
	UNITY_UNIFORM float _ScanMaskSmoothness;
	UNITY_UNIFORM float _Push;
	UNITY_UNIFORM float _Scale;
	UNITY_UNIFORM float _Power;
	UNITY_UNIFORM float _AlphaIntensity;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _ScanMask;
in highp vec3 vs_TEXCOORD0;
in highp vec4 vs_TEXCOORD3;
in highp vec4 vs_TEXCOORD4;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
vec4 u_xlat1;
vec2 u_xlat2;
mediump float u_xlat16_2;
float u_xlat4;
float u_xlat6;
void main()
{
    u_xlat0.xyz = (-vs_TEXCOORD0.xyz) + _WorldSpaceCameraPos.xyz;
    u_xlat6 = dot(u_xlat0.xyz, u_xlat0.xyz);
    u_xlat6 = inversesqrt(u_xlat6);
    u_xlat0.xyz = vec3(u_xlat6) * u_xlat0.xyz;
    u_xlat0.x = dot(vs_TEXCOORD4.xyz, u_xlat0.xyz);
    u_xlat0.x = (-u_xlat0.x) + 1.0;
    u_xlat0.x = max(u_xlat0.x, 9.99999975e-05);
    u_xlat0.x = log2(u_xlat0.x);
    u_xlat0.x = u_xlat0.x * _Power;
    u_xlat0.x = exp2(u_xlat0.x);
    u_xlat0.x = (-_Scale) * u_xlat0.x + 1.0;
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat2.x = _UVTime / _SpeedS;
    u_xlat2.x = fract(u_xlat2.x);
    u_xlat2.xy = u_xlat2.xx + vs_TEXCOORD3.xy;
    u_xlat16_2 = texture(_ScanMask, u_xlat2.xy).x;
    u_xlat4 = u_xlat16_2 * 0.150000006 + _AlphaIntensity;
    u_xlat2.x = u_xlat16_2 + (-_ScanMaskRange);
    u_xlat2.x = u_xlat2.x * _ScanMaskIntensity;
    u_xlat2.x = u_xlat2.x / _ScanMaskSmoothness;
#ifdef UNITY_ADRENO_ES3
    u_xlat2.x = min(max(u_xlat2.x, 0.0), 1.0);
#else
    u_xlat2.x = clamp(u_xlat2.x, 0.0, 1.0);
#endif
    u_xlat1.w = u_xlat4 * u_xlat0.x;
#ifdef UNITY_ADRENO_ES3
    u_xlat1.w = min(max(u_xlat1.w, 0.0), 1.0);
#else
    u_xlat1.w = clamp(u_xlat1.w, 0.0, 1.0);
#endif
    u_xlat0.xzw = (-_ColorA.xyz) + _ColorB.xyz;
    u_xlat1.xyz = u_xlat2.xxx * u_xlat0.xzw + _ColorA.xyz;
    SV_Target0 = u_xlat1;
    return;
}

