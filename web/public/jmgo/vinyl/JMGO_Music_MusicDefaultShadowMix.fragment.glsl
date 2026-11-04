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
	UNITY_UNIFORM float _Range;
	UNITY_UNIFORM float _Shadow02Intensity;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _Shadow;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
float u_xlat0;
vec4 u_xlat1;
float u_xlat2;
mediump float u_xlat16_2;
float u_xlat4;
mediump float u_xlat16_4;
float u_xlat6;
void main()
{
    u_xlat0 = (-_Range) + 1.0;
    u_xlat0 = float(1.0) / u_xlat0;
    u_xlat1.xz = vs_TEXCOORD3.xx + vec2(_Shadow01X, _Shadow02X);
    u_xlat1.yw = vs_TEXCOORD3.yy;
    u_xlat16_2 = texture(_Shadow, u_xlat1.zw).y;
    u_xlat16_4 = texture(_Shadow, u_xlat1.xy).x;
    u_xlat6 = u_xlat16_2 * _Shadow02Intensity;
    u_xlat2 = max(u_xlat16_2, u_xlat16_4);
    u_xlat4 = max(u_xlat6, u_xlat16_4);
    u_xlat0 = u_xlat0 * u_xlat4;
#ifdef UNITY_ADRENO_ES3
    u_xlat0 = min(max(u_xlat0, 0.0), 1.0);
#else
    u_xlat0 = clamp(u_xlat0, 0.0, 1.0);
#endif
    u_xlat2 = (-u_xlat2) + 1.0;
    u_xlat2 = u_xlat2 + (-_Range);
    u_xlat1.xyz = vec3(u_xlat2);
#ifdef UNITY_ADRENO_ES3
    u_xlat1.xyz = min(max(u_xlat1.xyz, 0.0), 1.0);
#else
    u_xlat1.xyz = clamp(u_xlat1.xyz, 0.0, 1.0);
#endif
    u_xlat2 = u_xlat0 * -2.0 + 3.0;
    u_xlat0 = u_xlat0 * u_xlat0;
    u_xlat0 = u_xlat0 * u_xlat2;
    u_xlat1.w = min(u_xlat0, 1.0);
    SV_Target0 = u_xlat1;
    return;
}

