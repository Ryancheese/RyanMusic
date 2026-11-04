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
uniform 	vec4 hlslcc_mtx4x4unity_MatrixVP[4];
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
UNITY_LOCATION(2) uniform mediump sampler2D _DisplacementMask;
in highp vec4 in_POSITION0;
in highp vec3 in_NORMAL0;
in highp vec4 in_TEXCOORD1;
in highp vec4 in_TEXCOORD0;
in highp vec4 in_TEXCOORD3;
in highp vec4 in_TEXCOORD4;
in highp vec4 in_TEXCOORD2;
out highp vec3 vs_NORMAL0;
out highp vec4 vs_TEXCOORD3;
out highp vec4 vs_TEXCOORD4;
vec4 u_xlat0;
bool u_xlatb0;
vec4 u_xlat1;
vec3 u_xlat2;
vec3 u_xlat3;
float u_xlat6;
float u_xlat9;
bool u_xlatb9;
void main()
{
#ifdef UNITY_ADRENO_ES3
    u_xlatb0 = !!(vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_Stretching));
#else
    u_xlatb0 = vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_Stretching);
#endif
    u_xlat0.xy = (bool(u_xlatb0)) ? in_TEXCOORD0.xy : in_TEXCOORD1.xy;
    u_xlat0.xy = u_xlat0.xy * vec2(_TileX, _TileY);
    u_xlat6 = _TimeParameters.x * _Animation_speed;
    u_xlat0.xy = vec2(u_xlat6) * vec2(_PannerX, _PannerY) + u_xlat0.xy;
    u_xlat0.x = textureLod(_DisplacementMask, u_xlat0.xy, 0.0).x;
    u_xlat1.xy = in_TEXCOORD3.xy * vec2(-1.0, 1.0);
    u_xlat1.z = in_TEXCOORD4.x;
    u_xlat3.xyz = u_xlat1.xyz * vec3(vec3(_Shrink_Faces_Amplitude, _Shrink_Faces_Amplitude, _Shrink_Faces_Amplitude));
    u_xlat1.xyz = u_xlat1.xyz * vec3(_DefaultShrink);
    u_xlat3.xyz = u_xlat0.xxx * u_xlat3.xyz;
    u_xlat2.xyz = u_xlat0.xxx * in_NORMAL0.xyz;
    u_xlat0.xyz = u_xlat3.xyz * vec3(0.00999999978, 0.00999999978, 0.00999999978);
    u_xlat0.xyz = u_xlat1.xyz * vec3(0.00999999978, 0.00999999978, 0.00999999978) + u_xlat0.xyz;
    u_xlat9 = _NormalPush * 0.00999999978;
    u_xlat0.xyz = u_xlat2.xyz * vec3(u_xlat9) + u_xlat0.xyz;
    u_xlat1.xyz = u_xlat0.xyz * in_TEXCOORD4.yyy;
#ifdef UNITY_ADRENO_ES3
    u_xlatb9 = !!(vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_ExtrudeUpFaces));
#else
    u_xlatb9 = vec4(0.0, 0.0, 0.0, 0.0)!=vec4(_ExtrudeUpFaces);
#endif
    u_xlat0.xyz = (bool(u_xlatb9)) ? u_xlat1.xyz : u_xlat0.xyz;
    u_xlat0.xyz = u_xlat0.xyz + in_POSITION0.xyz;
    u_xlat1.xyz = u_xlat0.yyy * hlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    u_xlat0.xyw = hlslcc_mtx4x4unity_ObjectToWorld[0].xyz * u_xlat0.xxx + u_xlat1.xyz;
    u_xlat0.xyz = hlslcc_mtx4x4unity_ObjectToWorld[2].xyz * u_xlat0.zzz + u_xlat0.xyw;
    u_xlat0.xyz = u_xlat0.xyz + hlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
    u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
    u_xlat0 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
    gl_Position = u_xlat0 + hlslcc_mtx4x4unity_MatrixVP[3];
    vs_NORMAL0.xyz = in_NORMAL0.xyz;
    vs_TEXCOORD3.xy = in_TEXCOORD2.xy;
    vs_TEXCOORD3.zw = in_TEXCOORD1.xy;
    vs_TEXCOORD4.xy = in_TEXCOORD0.xy;
    vs_TEXCOORD4.zw = vec2(0.0, 0.0);
    return;
}

