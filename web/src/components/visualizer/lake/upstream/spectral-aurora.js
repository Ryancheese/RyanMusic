// Universe Anthem spectral curtain retained from its pre-XtGGRt implementation.
// This default has no third-party triangle-noise or ray-stack implementation.
export const AURORA_GLSL = `vec3 curtain(float az, float el, float base, float fold, float phase, float k){
  float T = uT;
  float xs = az + fold * sin(az * 2. + phase + T * .021) + .5 * fold * sin(az * 5. - phase * 1.7 - T * .013);
  float u = fract(xs / 6.2831853), secs = (u - uNow) * uDur;
  float inSong = smoothstep(0., .008, u) * smoothstep(1., .992, u);
  float E = energy(u), H = .06 + .26 * pow(E, 1.1);
  // the hem hangs just over the horizon and never dips below it
  float b = base + .022 * (1. + sin(az * 2. + phase)) + .01 * (1. + sin(az * 4. - T * .03));
  float v = (el - b) / H;
  if (v < -.3 || v > 4.) return vec3(0.);
  float heard = smoothstep(.4, -.4, secs);
  float prof = smoothstep(-.1, .0, v) * (exp(-max(v, 0.) * 2.6) + .5 * exp(-max(v, 0.) * .8)) * smoothstep(4., 2., v) * (1. + 1.1 * exp(-abs(v) * 14.));
  float rays = .35 + .65 * pow(vnoise(xs * 95. + T * .25), 1.6) * (.5 + .5 * vnoise(xs * 23. - T * .15));
  float e = (.2 + 1.6 * E) * prof * rays * inSong; e = e / (1. + .55 * e);
  e *= mix(.34, 1., heard) * (1. + .45 * exp(-abs(secs) / .9));
  float edge = abs(cos(az * 2. + phase + T * .021));
  e *= .75 + .8 * pow(1. - edge, 6.);
  float band = spec(u, clamp(v * .8, 0., 1.));
  // (2026-10-07) colour: a gradient that flows through four of the song's colours along the curtain and slowly
  // upward, the loud bands pulling toward the light one
  float f = fract(xs * .19 + v * .11 - T * .012 + phase * .1) * 4.; int i0 = int(floor(f)); float fr = smoothstep(0., 1., fract(f));
  vec3 flow = mix(uAurP[i0], uAurP[(i0 + 1) - ((i0 + 1) / 4) * 4], fr);
  vec3 c = mix(flow, uAurHi, smoothstep(.2, 1.5, v) * (.25 + .6 * band));
  return c * e * k;
}
vec3 aurora(vec3 w){
  float az = atan(dot(w, uAurR), dot(w, uAurF)), el = asin(clamp(w.y, -1., 1.));
  if (el < -.01) return vec3(0.);
  return curtain(az, el, .012, .16, 0., 1.) + curtain(az + .35, el, .05, .22, 2.1, .5);
}
`;
