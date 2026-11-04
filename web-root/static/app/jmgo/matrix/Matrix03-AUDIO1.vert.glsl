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
uniform 	vec4 hlslcc_mtx4x4unity_MatrixVP[4];
uniform 	float MatrixAudio[17];
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
UNITY_BINDING(1) uniform UnityPerDraw {
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
UNITY_BINDING(0) uniform UnityPerMaterial {
#endif
	UNITY_UNIFORM vec4 _BackColor;
	UNITY_UNIFORM vec4 _OverlayColor;
	UNITY_UNIFORM float _LensDistortion;
	UNITY_UNIFORM float _FrequencyIntensity;
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
};
#endif
in highp vec4 in_POSITION0;
in highp vec3 in_NORMAL0;
in highp vec4 in_TEXCOORD1;
in highp vec4 in_COLOR0;
out highp vec4 vs_COLOR0;
out highp vec4 vs_TEXCOORD3;
vec4 u_xlat0;
bool u_xlatb0;
vec4 u_xlat1;
vec4 u_xlat2;
vec3 u_xlat3;
void main()
{
    u_xlat0.x = in_TEXCOORD1.y * 6.0;
    u_xlat0.x = floor(u_xlat0.x);
    u_xlat0.x = u_xlat0.x + 1.0;
#ifdef UNITY_ADRENO_ES3
    u_xlatb0 = !!(MatrixAudio[9]>=u_xlat0.x);
#else
    u_xlatb0 = MatrixAudio[9]>=u_xlat0.x;
#endif
    u_xlat0.x = u_xlatb0 ? 1.0 : float(0.0);
    u_xlat0.x = u_xlat0.x * MatrixAudio[0];
#ifdef UNITY_ADRENO_ES3
    u_xlat0.x = min(max(u_xlat0.x, 0.0), 1.0);
#else
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
#endif
    u_xlat0.x = u_xlat0.x * in_POSITION0.y;
    u_xlat3.x = in_POSITION0.y * _LensDistortion + (-u_xlat0.x);
    u_xlat0.x = in_COLOR0.x * u_xlat3.x + u_xlat0.x;
    u_xlat3.z = (-u_xlat0.x);
    u_xlat3.xy = in_POSITION0.xz;
    u_xlat1.xyz = u_xlat3.xzy + in_POSITION0.xyz;
    u_xlat0.xz = (-u_xlat3.xy);
    u_xlat3.x = MatrixAudio[8] * _FrequencyIntensity;
    u_xlat2.xyz = u_xlat3.xxx * in_NORMAL0.xyz;
    u_xlat0.w = u_xlat2.y;
    u_xlat0.xyz = u_xlat0.xwz + u_xlat1.xyz;
    u_xlat2.w = in_POSITION0.y;
    u_xlat0.xyz = u_xlat0.xyz + u_xlat2.xwz;
    u_xlat1.xyz = u_xlat0.yyy * hlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    u_xlat0.xyw = hlslcc_mtx4x4unity_ObjectToWorld[0].xyz * u_xlat0.xxx + u_xlat1.xyz;
    u_xlat0.xyz = hlslcc_mtx4x4unity_ObjectToWorld[2].xyz * u_xlat0.zzz + u_xlat0.xyw;
    u_xlat0.xyz = u_xlat0.xyz + hlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
    u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
    u_xlat0 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
    gl_Position = u_xlat0 + hlslcc_mtx4x4unity_MatrixVP[3];
    vs_COLOR0 = in_COLOR0;
    vs_TEXCOORD3.xy = in_TEXCOORD1.xy;
    vs_TEXCOORD3.zw = vec2(0.0, 0.0);
    return;
}

