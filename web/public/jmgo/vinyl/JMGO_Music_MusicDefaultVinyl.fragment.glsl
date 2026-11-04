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
	UNITY_UNIFORM vec4 _BaseColor;
	UNITY_UNIFORM float _AOSwitch;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _BaseMap;
UNITY_LOCATION(1) uniform mediump sampler2D _AO;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
mediump vec3 u_xlat16_0;
mediump vec3 u_xlat16_1;
vec3 u_xlat2;
float u_xlat9;
bool u_xlatb9;
void main()
{
    u_xlat16_0.xyz = texture(_BaseMap, vs_TEXCOORD3.xy).xyz;
    u_xlat16_1.xyz = texture(_AO, vs_TEXCOORD3.xy).xyz;
    u_xlat2.xyz = u_xlat16_0.xyz + u_xlat16_1.zzz;
    u_xlat2.xyz = u_xlat2.xyz + vec3(0.0700000003, 0.0700000003, 0.0700000003);
    u_xlat2.xyz = (-u_xlat16_0.xyz) + u_xlat2.xyz;
    u_xlat0.xyz = u_xlat16_1.zzz * u_xlat2.xyz + u_xlat16_0.xyz;
#ifdef UNITY_ADRENO_ES3
    u_xlatb9 = !!(vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_AOSwitch));
#else
    u_xlatb9 = vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_AOSwitch);
#endif
    u_xlat9 = (u_xlatb9) ? u_xlat16_1.y : u_xlat16_1.x;
    u_xlat0.xyz = vec3(u_xlat9) * u_xlat0.xyz;
    u_xlat9 = u_xlat9 * 0.100000001;
    u_xlat0.xyz = _BaseColor.xyz * u_xlat0.xyz + vec3(u_xlat9);
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}

