#version 300 es

precision highp float;
precision highp int;
#define HLSLCC_ENABLE_UNIFORM_BUFFERS 0
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
#define UNITY_UNIFORM
#else
#define UNITY_UNIFORM uniform
#endif
#define UNITY_SUPPORTS_UNIFORM_LOCATION 1
#if UNITY_SUPPORTS_UNIFORM_LOCATION
#define UNITY_LOCATION(x) layout(location = x)
#define UNITY_BINDING(x) layout(binding = x, std140)
#else
#define UNITY_LOCATION(x)
#define UNITY_BINDING(x) layout(std140)
#endif
uniform 	float MatrixAudio[17];
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(0) uniform UnityPerMaterial {
#endif
	UNITY_UNIFORM vec4 _BackColor;
	UNITY_UNIFORM vec4 _OverlayColor;
	UNITY_UNIFORM float _LensDistortion;
	UNITY_UNIFORM float _FrequencyIntensity;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
in highp vec4 vs_COLOR0;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
bool u_xlatb0;
vec3 u_xlat1;
vec3 u_xlat2;
void main()
{
    u_xlat0.x = vs_TEXCOORD3.y * 6.0;
    u_xlat0.x = floor(u_xlat0.x);
    u_xlat0.x = u_xlat0.x + 1.0;
#ifdef UNITY_ADRENO_ES3
    u_xlatb0 = !!(MatrixAudio[16]>=u_xlat0.x);
#else
    u_xlatb0 = MatrixAudio[16]>=u_xlat0.x;
#endif
    u_xlat0.x = u_xlatb0 ? 1.0 : float(0.0);
    u_xlat0.x = u_xlat0.x * MatrixAudio[7];
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat0.x = u_xlat0.x + vs_COLOR0.x;
    u_xlat0.x = u_xlat0.x + -0.810000002;
    u_xlat0.x = u_xlat0.x + u_xlat0.x;
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat2.xyz = u_xlat0.xxx * _BackColor.xyz;
    u_xlat1.xyz = (-_BackColor.xyz) * u_xlat0.xxx + _OverlayColor.xyz;
    u_xlat0.xyz = u_xlat0.xxx * u_xlat1.xyz + u_xlat2.xyz;
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}

