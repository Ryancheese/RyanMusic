#version 300 es
precision highp float;
precision highp int;
uniform vec4 _TimeParameters;
uniform vec2 audioStrength;
uniform vec4 _TwistMap_ST;
uniform float _Mid;
uniform float _Step;
uniform float _low;
uniform float _DetailMapBrightIntensity;
uniform float _HightLightIntensity;
uniform mediump sampler2D _TwistMap;
uniform mediump sampler2D _DetailMap;
uniform mediump sampler2D _BaseMap;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
mediump vec3 u_xlat16_0;
bool u_xlatb0;
vec4 u_xlat1;
mediump vec4 u_xlat16_1;
vec2 u_xlat2;
mediump vec4 u_xlat16_2;
mediump vec3 u_xlat16_3;
vec3 u_xlat4;
vec3 u_xlat5;
vec2 u_xlat6;
bool u_xlatb6;
mediump float u_xlat16_15;
float u_xlat18;
void main()
{
    u_xlat0.x = audioStrength.y * audioStrength.y;
    u_xlat0.x = u_xlat0.x * _Mid;
    u_xlat6.xy = vs_TEXCOORD3.xy * vec2(30.0, 0.200000003);
    u_xlat6.x = floor(u_xlat6.x);
    u_xlat6.x = u_xlat6.x + 19.2000008;
    u_xlat16_1.x = u_xlat6.x * 12.0;
    u_xlat16_1.x = sin(u_xlat16_1.x);
    u_xlat16_1.x = u_xlat16_1.x * 28.6800003;
    u_xlat16_1.x = fract(u_xlat16_1.x);
#ifdef UNITY_ADRENO_ES3
    u_xlatb6 = !!(_Step>=u_xlat16_1.x);
#else
    u_xlatb6 = _Step>=u_xlat16_1.x;
#endif
    u_xlat18 = (u_xlatb6) ? 0.0 : 1.0;
    u_xlat6.x = u_xlatb6 ? 1.0 : float(0.0);
    u_xlat18 = u_xlat18 * u_xlat16_1.x;
    u_xlat2.x = u_xlat6.x * u_xlat16_1.x;
    u_xlat1.y = (-u_xlat0.x) * u_xlat18 + vs_TEXCOORD3.y;
    u_xlat0.x = audioStrength.x * _low;
    u_xlat1.w = (-u_xlat0.x) * u_xlat2.x + vs_TEXCOORD3.y;
    u_xlat1.xz = vs_TEXCOORD3.xx;
    u_xlat0.xw = (-u_xlat1.xy) + u_xlat1.zw;
    u_xlat0.xy = u_xlat6.xx * u_xlat0.xw + u_xlat1.xy;
    u_xlat2.y = _TimeParameters.x * 0.100000001 + vs_TEXCOORD3.y;
    u_xlat2.x = vs_TEXCOORD3.x;
    u_xlat16_2.xyz = texture(_DetailMap, u_xlat2.xy).xyz;
    u_xlat16_1 = u_xlat16_2.zzxy * vec4(2.0, 2.0, 2.0, 2.0) + vec4(-1.0, -1.0, -1.0, -1.0);
    u_xlat2.xy = vs_TEXCOORD3.xy * _TwistMap_ST.xy + _TwistMap_ST.zw;
    u_xlat16_2.xyz = texture(_TwistMap, u_xlat2.xy).xyz;
    u_xlat16_2 = u_xlat16_2.xyzz * vec4(2.0, 2.0, 2.0, 2.0) + vec4(-1.0, -1.0, -1.0, -1.0);
    u_xlat16_3.z = u_xlat16_1.y * u_xlat16_2.w;
    u_xlat16_1 = u_xlat16_1 * u_xlat16_2;
    u_xlat18 = u_xlat16_2.x * 0.645161331;
#ifdef UNITY_ADRENO_ES3
    u_xlat18 = min(max(u_xlat18, 0.0), 1.0);
#else
    u_xlat18 = clamp(u_xlat18, 0.0, 1.0);
#endif
    u_xlat16_3.xy = u_xlat16_1.zw + u_xlat16_1.xy;
    u_xlat16_15 = dot(u_xlat16_3.xyz, u_xlat16_3.xyz);
    u_xlat16_15 = inversesqrt(u_xlat16_15);
    u_xlat16_3.xy = vec2(u_xlat16_15) * u_xlat16_3.xy;
    u_xlat0.xy = u_xlat6.yy * u_xlat16_3.xy + u_xlat0.xy;
    u_xlat16_0.xyz = texture(_BaseMap, u_xlat0.xy).xyz;
    u_xlat4.x = u_xlat18 * -2.0 + 3.0;
    u_xlat18 = u_xlat18 * u_xlat18;
    u_xlat18 = u_xlat18 * u_xlat4.x;
    u_xlat4.xyz = vec3(u_xlat18) * u_xlat16_0.xyz;
    u_xlat5.xyz = u_xlat16_0.xyz * u_xlat16_0.xyz;
    u_xlat0.xyz = u_xlat16_0.xyz * vec3(vec3(_DetailMapBrightIntensity, _DetailMapBrightIntensity, _DetailMapBrightIntensity)) + u_xlat5.xyz;
    u_xlat0.xyz = u_xlat4.xyz * vec3(_HightLightIntensity) + u_xlat0.xyz;
    u_xlat4.x = u_xlat0.y + u_xlat0.x;
    u_xlat0.w = u_xlat0.z + u_xlat4.x;
    SV_Target0 = u_xlat0;
    u_xlat0.x = u_xlat0.w + -0.100000001;
#ifdef UNITY_ADRENO_ES3
    u_xlatb0 = !!(u_xlat0.x<0.0);
#else
    u_xlatb0 = u_xlat0.x<0.0;
#endif
    if(u_xlatb0){discard;}
    return;
}

