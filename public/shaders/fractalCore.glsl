// Distance estimators for several classic 3D fractal families.
// Public literature (Mandelbulb, Mandelbox, KIFS, Apollonian, etc.).

float deMandelbulb(vec3 p, float power, int iters, float bail, vec3 c, int useJulia) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  gTrap = 1e10;
  for (int i = 0; i < 24; i++) {
    if (i >= iters) break;
    r = length(z);
    if (r > bail) break;
    float theta = acos(clamp(z.z / max(r, 1e-8), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(max(r, 1e-8), power - 1.0) * power * dr + 1.0;
    float zr = pow(max(r, 1e-8), power);
    theta *= power;
    phi *= power;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
    z += (useJulia == 1) ? c : p;
    gTrap = min(gTrap, r);
  }
  return 0.5 * log(max(r, 1e-8)) * r / max(dr, 1e-8);
}

float deAbsBulb(vec3 p, float power, int iters, float bail, vec3 c, int useJulia) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  gTrap = 1e10;
  for (int i = 0; i < 24; i++) {
    if (i >= iters) break;
    z = vec3(abs(z.x), abs(z.y), z.z);
    r = length(z);
    if (r > bail) break;
    float theta = acos(clamp(z.z / max(r, 1e-8), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(max(r, 1e-8), power - 1.0) * power * dr + 1.0;
    float zr = pow(max(r, 1e-8), power);
    theta *= power;
    phi *= power;
    z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
    z += (useJulia == 1) ? c : p;
    gTrap = min(gTrap, r);
  }
  return 0.5 * log(max(r, 1e-8)) * r / max(dr, 1e-8);
}

float deMandelbox(vec3 p, float scale, int iters, float fold, float minR, float fixedR) {
  vec3 z = p;
  float dr = 1.0;
  gTrap = 1e10;
  float minR2 = minR * minR;
  float fixR2 = fixedR * fixedR;
  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;
    z = clamp(z, -fold, fold) * 2.0 - z;
    float r2 = dot(z, z);
    gTrap = min(gTrap, r2);
    if (r2 < minR2) {
      float t = fixR2 / minR2;
      z *= t;
      dr *= t;
    } else if (r2 < fixR2) {
      float t = fixR2 / r2;
      z *= t;
      dr *= t;
    }
    z = z * scale + p;
    dr = dr * abs(scale) + 1.0;
  }
  return length(z) / max(abs(dr), 1e-8);
}

float deMenger(vec3 p, int iters, float scale) {
  gTrap = 1e10;
  float s = scale;
  for (int i = 0; i < 10; i++) {
    if (i >= iters) break;
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    p = p * s;
    p -= vec3(s - 1.0);
    if (p.z < -0.5 * (s - 1.0)) p.z += s - 1.0;
    gTrap = min(gTrap, length(p));
  }
  return sdBox(p, vec3(1.0)) / pow(s, float(iters));
}

float deSierpinski(vec3 p, int iters, float scale) {
  gTrap = 1e10;
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    if (p.x + p.y < 0.0) p.xy = -p.yx;
    if (p.x + p.z < 0.0) p.xz = -p.zx;
    if (p.y + p.z < 0.0) p.yz = -p.zy;
    p = p * scale - (scale - 1.0);
    gTrap = min(gTrap, length(p));
  }
  return (length(p) - 1.4) / pow(scale, float(iters));
}

float deOctaIFS(vec3 p, int iters, float scale) {
  gTrap = 1e10;
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    p = p * scale - vec3(1.0, 1.0, 1.0) * (scale - 1.0);
    gTrap = min(gTrap, dot(p, p));
  }
  return (length(p) - 1.2) / pow(scale, float(iters));
}

float deKIFS(vec3 p, int iters, float scale, float fold, float ang) {
  gTrap = 1e10;
  mat2 r = rot(ang);
  for (int i = 0; i < 16; i++) {
    if (i >= iters) break;
    p = abs(p);
    p.xy = r * p.xy;
    p -= fold;
    p = abs(p);
    p += fold * 0.35;
    p = p * scale - (scale - 1.0);
    gTrap = min(gTrap, length(p));
  }
  return (length(p) - 1.0) / pow(abs(scale), float(iters));
}

float deHybrid(vec3 p, float power, int iters, float scale, float fold, vec3 c) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  gTrap = 1e10;
  float minR2 = 0.25;
  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;
    z = clamp(z, -fold, fold) * 2.0 - z;
    float r2 = dot(z, z);
    if (r2 < minR2) {
      float t = 1.0 / minR2;
      z *= t;
      dr *= t;
    } else if (r2 < 1.0) {
      float t = 1.0 / r2;
      z *= t;
      dr *= t;
    }
    r = length(z);
    if (r > 8.0) break;
    float theta = acos(clamp(z.z / max(r, 1e-8), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(max(r, 1e-8), power - 1.0) * power * dr + 1.0;
    float zr = pow(max(r, 1e-8), power);
    z = zr * vec3(sin(theta * power) * cos(phi * power),
                  sin(theta * power) * sin(phi * power),
                  cos(theta * power));
    z = z * scale + c;
    dr = dr * abs(scale) + 1.0;
    gTrap = min(gTrap, r);
  }
  r = length(z);
  return 0.5 * log(max(r, 1e-8)) * r / max(dr, 1e-8);
}

vec4 qmul(vec4 a, vec4 b) {
  return vec4(
    a.x * b.x - a.y * b.y - a.z * b.z - a.w * b.w,
    a.x * b.y + a.y * b.x + a.z * b.w - a.w * b.z,
    a.x * b.z - a.y * b.w + a.z * b.x + a.w * b.y,
    a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x
  );
}

float deQuatJulia(vec3 p, vec3 jc, int iters, float bail, float w0) {
  vec4 z = vec4(p, w0);
  vec4 c = vec4(jc, 0.12);
  float dr = 1.0;
  gTrap = 1e10;
  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;
    float r = length(z);
    if (r > bail) break;
    dr = 2.0 * r * dr + 1.0;
    z = qmul(z, z) + c;
    gTrap = min(gTrap, r);
  }
  float r = length(z);
  return 0.5 * log(max(r, 1e-8)) * r / max(dr, 1e-8);
}

float deApollonian(vec3 p, int iters, float scale, float fold) {
  gTrap = 1e10;
  float s = 1.0;
  float k;
  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;
    p = abs(p);
    p = 2.0 * clamp(p, 0.0, fold) - p;
    k = scale / max(dot(p, p), 1e-5);
    p *= k;
    s *= k;
    gTrap = min(gTrap, abs(k));
  }
  return 0.25 * abs(p.y) / max(s, 1e-5);
}

float deKlein(vec3 p, int iters, float scale, vec3 box, float minR) {
  gTrap = 1e10;
  float s = 1.0;
  for (int i = 0; i < 14; i++) {
    if (i >= iters) break;
    p = 2.0 * clamp(p, -box, box) - p;
    float r2 = dot(p, p);
    float k = max(minR / max(r2, 1e-6), 1.0);
    p *= k * scale;
    s *= k * scale;
    p += box * 0.15;
    gTrap = min(gTrap, r2);
  }
  return 0.18 * abs(p.y) / max(abs(s), 1e-5);
}

float deTetrabrot(vec3 p, float power, int iters, float bail) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  gTrap = 1e10;
  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;
    if (z.x + z.y < 0.0) z.xy = -z.yx;
    if (z.x + z.z < 0.0) z.xz = -z.zx;
    if (z.y + z.z < 0.0) z.yz = -z.zy;
    r = length(z);
    if (r > bail) break;
    float theta = acos(clamp(z.z / max(r, 1e-8), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(max(r, 1e-8), power - 1.0) * power * dr + 1.0;
    float zr = pow(max(r, 1e-8), power);
    z = zr * vec3(sin(theta * power) * cos(phi * power),
                  sin(theta * power) * sin(phi * power),
                  cos(theta * power));
    z += p;
    gTrap = min(gTrap, r);
  }
  return 0.5 * log(max(r, 1e-8)) * r / max(dr, 1e-8);
}

// CUSTOM_DE_HOOK
float customDE(vec3 p) {
  return 1e10;
}

float map(vec3 p) {
  float spin = uTime * 0.05;
  p.xy = rot(uRotate + spin) * p.xy;
  p -= uOffset;

  int fam = uFamily;
  if (fam == 0) {
    return deMandelbulb(p / max(uScale, 0.15), uPower, uIterations, uBailout, uJulia, 0);
  } else if (fam == 1) {
    return deMandelbulb(p / max(uScale, 0.15), uPower, uIterations, uBailout, uJulia, 1);
  } else if (fam == 2) {
    return deMandelbox(p, uScale, uIterations, uFold, uMinRadius, uFixedRadius);
  } else if (fam == 3) {
    return deMenger(p, uIterations, max(uScale, 1.2));
  } else if (fam == 4) {
    return deSierpinski(p, uIterations, max(uScale, 1.2));
  } else if (fam == 5) {
    return deKIFS(p, uIterations, max(uScale, 1.15), uFold, uJulia.x + uRotate);
  } else if (fam == 6) {
    return deHybrid(p, uPower, uIterations, uScale, uFold, uJulia);
  } else if (fam == 7) {
    return deQuatJulia(p / max(uScale, 0.15), uJulia, uIterations, uBailout, uMinRadius);
  } else if (fam == 8) {
    return deApollonian(p, uIterations, max(uScale, 1.1), max(uFold, 0.2));
  } else if (fam == 9) {
    return deOctaIFS(p, uIterations, max(uScale, 1.2));
  } else if (fam == 10) {
    return deAbsBulb(p / max(uScale, 0.15), uPower, uIterations, uBailout, uJulia, 1);
  } else if (fam == 11) {
    return deKlein(p, uIterations, uScale, vec3(uFold, uFold * 0.85, uFold * 1.1), uMinRadius);
  } else if (fam == 12) {
    return deTetrabrot(p / max(uScale, 0.15), uPower, uIterations, uBailout);
  } else if (fam == 13) {
    return customDE(p);
  }
  return deMandelbulb(p, 8.0, 8, 2.0, vec3(0.0), 0);
}

vec3 shade(vec3 pos, vec3 nor, vec3 rd, float tHit) {
  vec3 sunDir = normalize(vec3(0.55, 0.85, -0.35));
  float dif = max(dot(nor, sunDir), 0.0);
  float sha = 1.0;
  if (uSoftShadow > 0.01) {
    sha = mix(1.0, softShadow(pos + nor * 0.006, sunDir, 0.012, 5.0, 18.0), clamp(uSoftShadow, 0.0, 1.0));
  }
  float ao = 1.0;
  if (uAO > 0.01) {
    ao = mix(1.0, calcAO(pos, nor), clamp(uAO, 0.0, 1.0));
  }
  float fre = pow(1.0 - max(dot(nor, -rd), 0.0), 3.5);
  float spe = pow(max(dot(reflect(rd, nor), sunDir), 0.0), 48.0);

  float trap = clamp(gTrap * 0.35, 0.0, 2.0);
  vec3 base = paletteColor(trap + uTime * 0.03, uPalette);
  base = mix(base, vec3(0.08, 0.05, 0.16), 0.18);

  vec3 col = base * (0.12 + 0.88 * dif * sha) * ao;
  col += spe * sha * vec3(1.0, 0.94, 0.82) * 0.75;
  col += fre * base * 0.5;
  col += vec3(0.04, 0.06, 0.16) * ao;
  col += uGlow * exp(-trap * 2.4) * base * 0.55;

  float fogAmt = 1.0 - exp(-0.045 * tHit * tHit);
  col = mix(col, skyFog(rd, sunDir) * 0.65, fogAmt);
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  vec3 ro = uCamPos;
  mat3 ca = lookAt(ro, uCamTarget);
  vec3 rd = ca * normalize(vec3(uv, 1.7));

  float tmax = max(8.0, uCamDist * 3.8);
  float t = 0.0;
  float minD = 1e10;
  bool hit = false;
  int maxS = uMaxSteps;
  for (int i = 0; i < 200; i++) {
    if (i >= maxS) break;
    float d = map(ro + rd * t);
    minD = min(minD, d);
    if (d < 0.00055 * t || t > tmax) {
      hit = d < 0.0016 * (1.0 + t);
      break;
    }
    t += d * 0.82;
  }

  vec3 sunDir = normalize(vec3(0.55, 0.85, -0.35));
  vec3 col;
  if (hit) {
    vec3 pos = ro + rd * t;
    col = shade(pos, calcNormal(pos), rd, t);
  } else {
    col = skyFog(rd, sunDir) * 0.75;
    col += uGlow * exp(-max(minD, 0.0) * 18.0) * paletteColor(0.2 + uTime * 0.02, uPalette) * 0.65;
  }

  col = tonemap(col * uExposure);
  fragColor = vec4(pow(max(col, 0.0), vec3(0.92)), 1.0);
}
