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
uniform 	vec3 _WorldSpaceCameraPos;
uniform 	float MatrixAudio[17];
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(0) uniform UnityPerMaterial {
#endif
	UNITY_UNIFORM vec4 _OverlayColor;
	UNITY_UNIFORM float _LensDistortion;
	UNITY_UNIFORM float _FrequencyIntensity;
	UNITY_UNIFORM float _ColorIntensity;
	UNITY_UNIFORM float _Power;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
in highp vec3 vs_TEXCOORD0;
in highp vec4 vs_COLOR0;
in highp vec4 vs_TEXCOORD3;
in highp vec4 vs_TEXCOORD4;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
vec4 u_xlat1;
float u_xlat2;
bool u_xlatb2;
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
    u_xlat0.x = log2(u_xlat0.x);
    u_xlat0.x = u_xlat0.x * _Power;
    u_xlat0.x = exp2(u_xlat0.x);
    u_xlat0.x = (-u_xlat0.x) + 1.0;
    u_xlat2 = vs_TEXCOORD3.y * 6.0;
    u_xlat2 = floor(u_xlat2);
    u_xlat2 = u_xlat2 + 1.0;
#ifdef UNITY_ADRENO_ES3
    u_xlatb2 = !!(MatrixAudio[9]>=u_xlat2);
#else
    u_xlatb2 = MatrixAudio[9]>=u_xlat2;
#endif
    u_xlat2 = u_xlatb2 ? 1.0 : float(0.0);
    u_xlat2 = u_xlat2 * MatrixAudio[0];
#ifdef UNITY_ADRENO_ES3
    u_xlat2 = min(max(u_xlat2, 0.0), 1.0);
#else
    u_xlat2 = clamp(u_xlat2, 0.0, 1.0);
#endif
    u_xlat4 = u_xlat2 + vs_COLOR0.x;
#ifdef UNITY_ADRENO_ES3
    u_xlatb2 = !!(u_xlat2>=0.00999999978);
#else
    u_xlatb2 = u_xlat2>=0.00999999978;
#endif
    u_xlat2 = u_xlatb2 ? 1.0 : float(0.0);
    u_xlat4 = u_xlat4 + -0.829999983;
    u_xlat4 = u_xlat4 * 8.0;
#ifdef UNITY_ADRENO_ES3
    u_xlat4 = min(max(u_xlat4, 0.0), 1.0);
#else
    u_xlat4 = clamp(u_xlat4, 0.0, 1.0);
#endif
    u_xlat0.x = u_xlat0.x * u_xlat4;
    u_xlat1.xyz = vec3(u_xlat4) * _OverlayColor.xyz;
    u_xlat1.xyz = u_xlat1.xyz * vec3(vec3(_ColorIntensity, _ColorIntensity, _ColorIntensity));
    u_xlat0.x = max(u_xlat0.x, 0.0);
    u_xlat1.w = u_xlat0.x * u_xlat2;
    SV_Target0 = u_xlat1;
    return;
}

