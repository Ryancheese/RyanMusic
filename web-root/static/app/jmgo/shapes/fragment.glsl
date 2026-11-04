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
uniform 	vec4 hlslcc_mtx4x4unity_MatrixInvV[4];
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(0) uniform UnityPerDraw {
#endif
	UNITY_UNIFORM vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
	UNITY_UNIFORM vec4 hlslcc_mtx4x4unity_WorldToObject[4];
	UNITY_UNIFORM vec4 unity_LODFade;
	UNITY_UNIFORM mediump vec4 unity_WorldTransformParams;
	UNITY_UNIFORM mediump vec4 unity_LightData;
	UNITY_UNIFORM mediump vec4 unity_LightIndices[2];
	UNITY_UNIFORM vec4 unity_ProbesOcclusion;
	UNITY_UNIFORM mediump vec4 unity_SpecCube0_HDR;
	UNITY_UNIFORM vec4 unity_LightmapST;
	UNITY_UNIFORM vec4 unity_DynamicLightmapST;
	UNITY_UNIFORM mediump vec4 unity_SHAr;
	UNITY_UNIFORM mediump vec4 unity_SHAg;
	UNITY_UNIFORM mediump vec4 unity_SHAb;
	UNITY_UNIFORM mediump vec4 unity_SHBr;
	UNITY_UNIFORM mediump vec4 unity_SHBg;
	UNITY_UNIFORM mediump vec4 unity_SHBb;
	UNITY_UNIFORM mediump vec4 unity_SHC;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(1) uniform UnityPerMaterial {
#endif
	UNITY_UNIFORM vec4 _FrontFace_Color;
	UNITY_UNIFORM vec4 _OutlineTex_ST;
	UNITY_UNIFORM vec4 _Outline_Color;
	UNITY_UNIFORM float _ExtrudeUpFaces;
	UNITY_UNIFORM float _Animation_speed;
	UNITY_UNIFORM float _PannerX;
	UNITY_UNIFORM float _PannerY;
	UNITY_UNIFORM float _Stretching;
	UNITY_UNIFORM float _TileX;
	UNITY_UNIFORM float _TileY;
	UNITY_UNIFORM float _NormalPush;
	UNITY_UNIFORM float _DefaultShrink;
	UNITY_UNIFORM float _Shrink_Faces_Amplitude;
	UNITY_UNIFORM float _FrontFace_Intensity;
	UNITY_UNIFORM float _DefaultOutlineOpacity;
	UNITY_UNIFORM float _Outline_Opacity;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _FrontFace_Diffuse_map;
UNITY_LOCATION(1) uniform mediump sampler2D _OutlineTex;
UNITY_LOCATION(2) uniform mediump sampler2D _DisplacementMask;
in highp vec3 vs_NORMAL0;
in highp vec4 vs_TEXCOORD3;
in highp vec4 vs_TEXCOORD4;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
mediump float u_xlat16_0;
bool u_xlatb0;
vec3 u_xlat1;
mediump vec4 u_xlat16_1;
vec3 u_xlat2;
vec3 u_xlat3;
mediump vec3 u_xlat16_3;
float u_xlat6;
float u_xlat9;
void main()
{
#ifdef UNITY_ADRENO_ES3
    u_xlatb0 = !!(vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_Stretching));
#else
    u_xlatb0 = vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_Stretching);
#endif
    u_xlat0.xy = (bool(u_xlatb0)) ? vs_TEXCOORD4.xy : vs_TEXCOORD3.zw;
    u_xlat0.xy = u_xlat0.xy * vec2(_TileX, _TileY);
    u_xlat6 = _TimeParameters.x * _Animation_speed;
    u_xlat0.xy = vec2(u_xlat6) * vec2(_PannerX, _PannerY) + u_xlat0.xy;
    u_xlat16_0 = texture(_DisplacementMask, u_xlat0.xy).x;
    u_xlat3.xy = vs_TEXCOORD3.xy * _OutlineTex_ST.xy + _OutlineTex_ST.zw;
    u_xlat16_3.xyz = texture(_OutlineTex, u_xlat3.xy).xyz;
    u_xlat3.xyz = u_xlat16_3.xyz * _Outline_Color.xyz;
    u_xlat3.xyz = u_xlat3.xyz * vec3(0.300000012, 0.300000012, 0.300000012);
    u_xlat1.xyz = vec3(u_xlat16_0) * u_xlat3.xyz;
    u_xlat1.xyz = u_xlat1.xyz * vec3(_Outline_Opacity);
    u_xlat0.xyz = u_xlat3.xyz * vec3(vec3(_DefaultOutlineOpacity, _DefaultOutlineOpacity, _DefaultOutlineOpacity)) + u_xlat1.xyz;
    u_xlat1.xyz = hlslcc_mtx4x4unity_MatrixInvV[2].yyy * hlslcc_mtx4x4unity_WorldToObject[1].xyz;
    u_xlat1.xyz = hlslcc_mtx4x4unity_WorldToObject[0].xyz * hlslcc_mtx4x4unity_MatrixInvV[2].xxx + u_xlat1.xyz;
    u_xlat1.xyz = hlslcc_mtx4x4unity_WorldToObject[2].xyz * hlslcc_mtx4x4unity_MatrixInvV[2].zzz + u_xlat1.xyz;
    u_xlat1.xyz = hlslcc_mtx4x4unity_WorldToObject[3].xyz * hlslcc_mtx4x4unity_MatrixInvV[2].www + u_xlat1.xyz;
    u_xlat1.z = dot(u_xlat1.xyz, vs_NORMAL0.xyz);
    u_xlat2.xyz = hlslcc_mtx4x4unity_MatrixInvV[0].yyy * hlslcc_mtx4x4unity_WorldToObject[1].xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_WorldToObject[0].xyz * hlslcc_mtx4x4unity_MatrixInvV[0].xxx + u_xlat2.xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_WorldToObject[2].xyz * hlslcc_mtx4x4unity_MatrixInvV[0].zzz + u_xlat2.xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_WorldToObject[3].xyz * hlslcc_mtx4x4unity_MatrixInvV[0].www + u_xlat2.xyz;
    u_xlat1.x = dot(u_xlat2.xyz, vs_NORMAL0.xyz);
    u_xlat2.xyz = hlslcc_mtx4x4unity_MatrixInvV[1].yyy * hlslcc_mtx4x4unity_WorldToObject[1].xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_WorldToObject[0].xyz * hlslcc_mtx4x4unity_MatrixInvV[1].xxx + u_xlat2.xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_WorldToObject[2].xyz * hlslcc_mtx4x4unity_MatrixInvV[1].zzz + u_xlat2.xyz;
    u_xlat2.xyz = hlslcc_mtx4x4unity_WorldToObject[3].xyz * hlslcc_mtx4x4unity_MatrixInvV[1].www + u_xlat2.xyz;
    u_xlat1.y = dot(u_xlat2.xyz, vs_NORMAL0.xyz);
    u_xlat9 = dot(u_xlat1.xyz, u_xlat1.xyz);
    u_xlat9 = inversesqrt(u_xlat9);
    u_xlat1.xy = vec2(u_xlat9) * u_xlat1.xy;
    u_xlat1.xy = u_xlat1.xy * vec2(0.5, 0.5) + vec2(0.5, 0.5);
    u_xlat16_1 = texture(_FrontFace_Diffuse_map, u_xlat1.xy);
    u_xlat9 = dot(u_xlat16_1, vec4(0.5, 0.5, 0.5, 0.5));
    u_xlat1.xyz = u_xlat16_1.xyz * vec3(vec3(_FrontFace_Intensity, _FrontFace_Intensity, _FrontFace_Intensity));
    u_xlat0.xyz = vec3(u_xlat9) * u_xlat0.xyz;
    u_xlat0.xyz = u_xlat1.xyz * _FrontFace_Color.xyz + u_xlat0.xyz;
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}

