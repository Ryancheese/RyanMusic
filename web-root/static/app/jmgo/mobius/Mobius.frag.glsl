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
	UNITY_UNIFORM vec4 _ColorA;
	UNITY_UNIFORM vec4 _ColorB;
	UNITY_UNIFORM float _UVTime;
	UNITY_UNIFORM float _SpeedS;
	UNITY_UNIFORM float _ScanMaskRange;
	UNITY_UNIFORM float _ScanMaskIntensity;
	UNITY_UNIFORM float _ScanMaskSmoothness;
	UNITY_UNIFORM float _Push;
	UNITY_UNIFORM float _Amount;
	UNITY_UNIFORM float _mHDR;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _ScanMask;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
mediump float u_xlat16_0;
vec3 u_xlat1;
float u_xlat3;
void main()
{
    u_xlat0.x = _UVTime / _SpeedS;
    u_xlat0.x = fract(u_xlat0.x);
    u_xlat0.xy = u_xlat0.xx + vs_TEXCOORD3.xy;
    u_xlat16_0 = texture(_ScanMask, u_xlat0.xy).x;
    u_xlat0.x = u_xlat16_0 + (-_ScanMaskRange);
    u_xlat0.x = u_xlat0.x * _ScanMaskIntensity;
    u_xlat0.x = u_xlat0.x / _ScanMaskSmoothness;
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat1.xyz = (-_ColorA.xyz) + _ColorB.xyz;
    u_xlat0.xyz = u_xlat0.xxx * u_xlat1.xyz + _ColorA.xyz;
    u_xlat3 = vs_TEXCOORD3.x * _Amount;
    u_xlat3 = fract(u_xlat3);
    u_xlat3 = u_xlat3 * 0.5 + 0.5;
    u_xlat0.xyz = vec3(u_xlat3) * u_xlat0.xyz;
    u_xlat0.xyz = u_xlat0.xyz * vec3(vec3(_mHDR, _mHDR, _mHDR));
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}

