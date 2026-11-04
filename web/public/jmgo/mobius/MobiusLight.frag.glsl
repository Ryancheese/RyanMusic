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
	UNITY_UNIFORM vec4 _ColorB;
	UNITY_UNIFORM vec4 _ColorA;
	UNITY_UNIFORM float _ColorScale;
	UNITY_UNIFORM float _FlipX;
	UNITY_UNIFORM float _FlipY;
	UNITY_UNIFORM float _Smoothness;
	UNITY_UNIFORM float _Intensity;
	UNITY_UNIFORM float _Range;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _BaseMap;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
mediump vec2 u_xlat16_0;
vec4 u_xlat1;
vec2 u_xlat4;
bvec2 u_xlatb4;
float u_xlat6;
void main()
{
    u_xlat0.xy = (-vs_TEXCOORD3.xy) + vec2(1.0, 1.0);
    u_xlatb4.xy = notEqual(vec4(0.0, 0.0, 0.0, 0.0), vec4(_FlipX, _FlipY, _FlipX, _FlipY)).xy;
    u_xlat1.x = u_xlatb4.x ? float(1.0) : 0.0;
    u_xlat1.y = u_xlatb4.y ? float(1.0) : 0.0;
;
    u_xlat4.x = (u_xlatb4.x) ? float(0.0) : vs_TEXCOORD3.x;
    u_xlat4.y = (u_xlatb4.y) ? float(0.0) : vs_TEXCOORD3.y;
    u_xlat0.xy = u_xlat0.xy * u_xlat1.xy + u_xlat4.xy;
    u_xlat16_0.xy = texture(_BaseMap, u_xlat0.xy).xw;
    u_xlat4.x = float(1.0) / _ColorScale;
    u_xlat4.x = u_xlat4.x * u_xlat16_0.x;
#ifdef UNITY_ADRENO_ES3
    u_xlat4.x = min(max(u_xlat4.x, 0.0), 1.0);
#else
    u_xlat4.x = clamp(u_xlat4.x, 0.0, 1.0);
#endif
    u_xlat6 = u_xlat4.x * -2.0 + 3.0;
    u_xlat4.x = u_xlat4.x * u_xlat4.x;
    u_xlat4.x = u_xlat4.x * u_xlat6;
    u_xlat4.x = min(u_xlat4.x, 1.0);
    u_xlat1.xyz = (-_ColorB.xyz) + _ColorA.xyz;
    u_xlat1.xyz = u_xlat4.xxx * u_xlat1.xyz + _ColorB.xyz;
    u_xlat4.x = _Smoothness + 1.0;
    u_xlat4.x = max(u_xlat4.x, 0.0);
    u_xlat4.x = u_xlat4.x + 0.00100000005;
    u_xlat0.x = u_xlat16_0.x / u_xlat4.x;
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat0.xzw = u_xlat0.xxx * u_xlat1.xyz;
    u_xlat1.xyz = u_xlat0.xzw * vec3(_Intensity) + u_xlat1.xyz;
    u_xlat0.x = max(_Smoothness, 0.0);
    u_xlat0.x = u_xlat0.x + 0.00100000005;
    u_xlat0.x = u_xlat16_0.y / u_xlat0.x;
    u_xlat1.w = u_xlat0.x + (-_Range);
#ifdef UNITY_ADRENO_ES3
    u_xlat1.w = min(max(u_xlat1.w, 0.0), 1.0);
#else
    u_xlat1.w = clamp(u_xlat1.w, 0.0, 1.0);
#endif
    SV_Target0 = u_xlat1;
    return;
}

