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
	UNITY_UNIFORM vec4 _BaseMap_ST;
	UNITY_UNIFORM mediump vec4 _BaseColor;
	UNITY_UNIFORM mediump float _Cutoff;
	UNITY_UNIFORM mediump float _Surface;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _BaseMap;
in highp vec2 vs_TEXCOORD0;
layout(location = 0) out mediump vec4 SV_Target0;
bool u_xlatb0;
mediump vec4 u_xlat16_1;
mediump float u_xlat16_2;
void main()
{
#ifdef UNITY_ADRENO_ES3
    u_xlatb0 = !!(_Surface==1.0);
#else
    u_xlatb0 = _Surface==1.0;
#endif
    u_xlat16_1 = texture(_BaseMap, vs_TEXCOORD0.xy);
    u_xlat16_2 = u_xlat16_1.w * _BaseColor.w;
    SV_Target0.xyz = u_xlat16_1.xyz * _BaseColor.xyz;
    SV_Target0.w = (u_xlatb0) ? u_xlat16_2 : 1.0;
    return;
}

