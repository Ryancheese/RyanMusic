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
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(0) uniform UnityPerMaterial {
#endif
	UNITY_UNIFORM float _Shadow01X;
	UNITY_UNIFORM float _Shadow02X;
	UNITY_UNIFORM float _Shadow02Intensity;
	UNITY_UNIFORM float _Range;
	UNITY_UNIFORM float _Softness;
	UNITY_UNIFORM float _Intensity;
	UNITY_UNIFORM float _EdgeSoftness;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _Light;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
mediump float u_xlat16_0;
vec2 u_xlat1;
mediump float u_xlat16_1;
void main()
{
    u_xlat0.y = vs_TEXCOORD3.y + -0.00999999978;
    u_xlat0.xz = vs_TEXCOORD3.xx + vec2(_Shadow02X, _Shadow01X);
    u_xlat16_0 = texture(_Light, u_xlat0.xy).x;
    u_xlat0.x = u_xlat16_0 + (-_Shadow02Intensity);
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat0.w = vs_TEXCOORD3.y;
    u_xlat16_1 = texture(_Light, u_xlat0.zw).y;
    u_xlat0.x = max(u_xlat0.x, u_xlat16_1);
    u_xlat0.x = u_xlat0.x + (-_Range);
    u_xlat0.x = u_xlat0.x / _Softness;
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat0.x = u_xlat0.x * _Intensity;
    u_xlat1.xy = vs_TEXCOORD3.xy + vec2(-0.5, -0.5);
    u_xlat1.xy = u_xlat1.xy + u_xlat1.xy;
    u_xlat1.xy = -abs(u_xlat1.xy) + vec2(1.0, 1.0);
    u_xlat1.x = u_xlat1.x / _EdgeSoftness;
#ifdef UNITY_ADRENO_ES3
    u_xlat1.x = min(max(u_xlat1.x, 0.0), 1.0);
#else
    u_xlat1.x = clamp(u_xlat1.x, 0.0, 1.0);
#endif
    u_xlat0.x = u_xlat1.x * u_xlat0.x;
    u_xlat0.x = u_xlat1.y * u_xlat0.x;
    u_xlat0.xyz = vs_TEXCOORD3.yyy * (-u_xlat0.xxx) + u_xlat0.xxx;
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}

