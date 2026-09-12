// Shared raymarch helpers. Techniques inspired by public DE / SDF literature
// (including write-ups at iquilezles.org). Original GLSL for this playground.

#define PI 3.14159265359
#define TAU 6.28318530718

float gTrap;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdSphere(vec3 p, float r) { return length(p) - r; }

mat3 lookAt(vec3 ro, vec3 ta) {
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  if (dot(uu, uu) < 1e-8) uu = vec3(1.0, 0.0, 0.0);
  vec3 vv = cross(uu, ww);
  return mat3(uu, vv, ww);
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 32; i++) {
    if (t >= maxt) break;
    float h = map(ro + rd * t);
    if (h < 0.0005) return 0.0;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.5);
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 pos, vec3 nor) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i) / 4.0;
    float d = map(pos + nor * h);
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}

vec3 calcNormal(vec3 p) {
  const float e = 0.0008;
  vec2 h = vec2(e, 0.0);
  return normalize(vec3(
    map(p + h.xyy) - map(p - h.xyy),
    map(p + h.yxy) - map(p - h.yxy),
    map(p + h.yyx) - map(p - h.yyx)
  ));
}

vec3 tonemap(vec3 x) {
  x = max(x, 0.0);
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 skyFog(vec3 rd, vec3 sunDir) {
  float sun = pow(max(dot(rd, sunDir), 0.0), 16.0);
  float hemi = max(rd.y * 0.55 + 0.45, 0.0);
  vec3 col = mix(vec3(0.012, 0.016, 0.04), vec3(0.18, 0.28, 0.48), hemi);
  col += vec3(1.0, 0.72, 0.38) * sun * 0.55;
  col += vec3(0.25, 0.15, 0.45) * pow(max(-rd.y, 0.0), 2.0) * 0.25;
  return col;
}

vec3 paletteColor(float t, int id) {
  t = fract(t);
  vec3 a, b, c, d;
  if (id == 1) {
    a = vec3(0.50, 0.35, 0.25); b = vec3(0.50, 0.35, 0.20); c = vec3(1.0, 0.80, 0.40); d = vec3(0.00, 0.15, 0.25);
  } else if (id == 2) {
    a = vec3(0.15, 0.35, 0.45); b = vec3(0.25, 0.40, 0.40); c = vec3(1.0, 0.90, 0.70); d = vec3(0.20, 0.40, 0.70);
  } else if (id == 3) {
    a = vec3(0.20, 0.40, 0.18); b = vec3(0.30, 0.40, 0.20); c = vec3(0.80, 1.0, 0.50); d = vec3(0.10, 0.30, 0.05);
  } else if (id == 4) {
    a = vec3(0.55, 0.35, 0.55); b = vec3(0.45, 0.35, 0.40); c = vec3(1.0, 0.90, 1.0); d = vec3(0.00, 0.33, 0.67);
  } else if (id == 5) {
    a = vec3(0.50, 0.22, 0.08); b = vec3(0.50, 0.30, 0.10); c = vec3(1.0, 0.70, 0.30); d = vec3(0.00, 0.15, 0.20);
  } else if (id == 6) {
    a = vec3(0.40, 0.55, 0.65); b = vec3(0.35, 0.35, 0.30); c = vec3(0.80, 1.0, 1.0); d = vec3(0.55, 0.40, 0.20);
  } else if (id == 7) {
    a = vec3(0.45, 0.38, 0.18); b = vec3(0.40, 0.32, 0.12); c = vec3(1.0, 0.85, 0.40); d = vec3(0.15, 0.20, 0.05);
  } else if (id == 8) {
    a = vec3(0.35, 0.20, 0.50); b = vec3(0.45, 0.40, 0.45); c = vec3(1.0, 1.0, 1.0); d = vec3(0.00, 0.33, 0.67);
  } else if (id == 9) {
    a = vec3(0.42); b = vec3(0.38); c = vec3(1.0); d = vec3(0.20, 0.33, 0.55);
  } else {
    a = vec3(0.50); b = vec3(0.50); c = vec3(1.00); d = vec3(0.00, 0.33, 0.67);
  }
  return a + b * cos(TAU * (c * t + d));
}
