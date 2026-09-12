/**
 * WebGL2 fractal renderer — fullscreen-triangle raymarching,
 * orbit camera, adaptive resolution. Craft notes from a prior
 * Quilez-inspired showcase: cheap soft shadow / AO, filmic tonemap.
 */

import { compileEquation, injectCustomDE } from "./equation.js";
import { FAMILY } from "./fractalCatalog.js";

const UNIFORM_NAMES = [
  "uResolution", "uTime", "uAspect",
  "uCamPos", "uCamTarget",
  "uQuality", "uMaxSteps",
  "uFamily", "uPower", "uIterations", "uBailout", "uScale",
  "uOffset", "uRotate", "uJulia",
  "uFold", "uMinRadius", "uFixedRadius",
  "uPalette", "uGlow", "uSoftShadow", "uAO", "uExposure", "uCamDist",
];

function shaderUrl(name) {
  const base = import.meta.env.BASE_URL || "./";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}shaders/${name}`;
}

export function defaultParams() {
  return {
    power: 8,
    iterations: 8,
    bailout: 2,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotate: 0,
    juliaX: 0,
    juliaY: 0,
    juliaZ: 0,
    fold: 1,
    minRadius: 0.5,
    fixedRadius: 1,
    palette: 0,
    glow: 0.35,
    softShadow: 0.85,
    ao: 0.8,
    exposure: 1.25,
    maxSteps: 90,
    camDist: 2.8,
  };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.ok = !!this.gl;
    this.program = null;
    this.uniforms = {};
    this.vertSrc = "";
    this.commonSrc = "";
    this.coreSrc = "";
    this.family = FAMILY.MANDELBULB;
    this.params = defaultParams();
    this.time = 0;
    this.lastTs = 0;
    this.quality = 1;
    this.targetQuality = 1;
    this.fps = 60;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.running = false;
    this.customEquation = "";
    this.useCustom = false;
    this.onHud = null;
    this.onError = null;
    this.cam = {
      azim: -0.45,
      elev: 0.28,
      dist: 2.8,
      target: [0, 0, 0],
      dragging: false,
      lastX: 0,
      lastY: 0,
    };
    this._bindInput();
  }

  async init() {
    if (!this.ok) {
      throw new Error("WebGL2 is required. Try a recent desktop browser.");
    }
    const names = ["vert.glsl", "common.glsl", "fractalCore.glsl"];
    const texts = await Promise.all(
      names.map(async (n) => {
        const res = await fetch(shaderUrl(n));
        if (!res.ok) throw new Error(`Could not load ${n} (${res.status})`);
        return res.text();
      })
    );
    this.vertSrc = texts[0];
    this.commonSrc = texts[1];
    this.coreSrc = texts[2];
    this._compile(this.coreSrc);
  }

  _header() {
    return `#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform float uAspect;
uniform vec3  uCamPos;
uniform vec3  uCamTarget;
uniform float uQuality;
uniform int   uMaxSteps;
uniform int   uFamily;
uniform float uPower;
uniform int   uIterations;
uniform float uBailout;
uniform float uScale;
uniform vec3  uOffset;
uniform float uRotate;
uniform vec3  uJulia;
uniform float uFold;
uniform float uMinRadius;
uniform float uFixedRadius;
uniform int   uPalette;
uniform float uGlow;
uniform float uSoftShadow;
uniform float uAO;
uniform float uExposure;
uniform float uCamDist;

float map(vec3 p);
`;
  }

  _compile(coreSrc) {
    const gl = this.gl;
    const fragSrc = `${this._header()}\n${this.commonSrc}\n${coreSrc}\n`;
    const vs = this._makeShader(gl.VERTEX_SHADER, this.vertSrc, "vert");
    const fs = this._makeShader(gl.FRAGMENT_SHADER, fragSrc, "frag");
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || "link failed";
      gl.deleteProgram(prog);
      throw new Error(log);
    }
    if (this.program) gl.deleteProgram(this.program);
    this.program = prog;
    gl.useProgram(prog);
    this.uniforms = {};
    for (const name of UNIFORM_NAMES) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
  }

  _makeShader(type, src, label) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || "";
      gl.deleteShader(sh);
      throw new Error(`${label}: ${log}`);
    }
    return sh;
  }

  applyCustomEquation(src) {
    const compiled = compileEquation(src);
    if (!compiled.ok) return compiled;
    try {
      const injected = injectCustomDE(this.coreSrc, compiled.glsl);
      this._compile(injected);
      this.customEquation = src;
      this.useCustom = true;
      this.family = FAMILY.CUSTOM;
      return { ok: true, mode: compiled.mode };
    } catch (err) {
      return {
        ok: false,
        error: "The GPU did not like that recipe. Try a simpler one, or check commas and parentheses.",
        detail: String(err.message || err),
      };
    }
  }

  clearCustom() {
    if (!this.useCustom) return;
    this.useCustom = false;
    this._compile(this.coreSrc);
  }

  setFamily(id) {
    if (id !== FAMILY.CUSTOM && this.useCustom) {
      this.useCustom = false;
      try {
        this._compile(this.coreSrc);
      } catch (err) {
        console.error(err);
      }
    }
    this.family = id;
  }

  setParams(partial) {
    Object.assign(this.params, partial);
    if (typeof partial.camDist === "number") {
      this.cam.dist = clamp(partial.camDist, 0.8, 40);
    }
  }

  setCamera(cam) {
    if (!cam) return;
    if (typeof cam.azim === "number") this.cam.azim = cam.azim;
    if (typeof cam.elev === "number") this.cam.elev = cam.elev;
    if (typeof cam.dist === "number") {
      this.cam.dist = clamp(cam.dist, 0.8, 40);
      this.params.camDist = this.cam.dist;
    }
    if (Array.isArray(cam.target) && cam.target.length === 3) {
      this.cam.target = cam.target.slice();
    }
  }

  /** Draw one frame and return a PNG data URL of the canvas. */
  captureStill() {
    if (!this.ok || !this.program) {
      throw new Error("Renderer is not ready yet.");
    }
    this._draw();
    return this.canvas.toDataURL("image/png");
  }

  getState() {
    return {
      family: this.family,
      params: { ...this.params },
      camera: {
        azim: this.cam.azim,
        elev: this.cam.elev,
        dist: this.cam.dist,
        target: this.cam.target.slice(),
      },
      customEquation: this.customEquation,
      useCustom: this.useCustom,
    };
  }

  camPos() {
    const { elev, azim, dist, target } = this.cam;
    const ce = Math.cos(elev);
    return [
      target[0] + dist * ce * Math.sin(azim),
      target[1] + dist * Math.sin(elev),
      target[2] + dist * ce * Math.cos(azim),
    ];
  }

  _bindInput() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      this.cam.dragging = true;
      this.cam.lastX = e.clientX;
      this.cam.lastY = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointerup", () => {
      this.cam.dragging = false;
    });
    c.addEventListener("pointercancel", () => {
      this.cam.dragging = false;
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.cam.dragging) return;
      const dx = e.clientX - this.cam.lastX;
      const dy = e.clientY - this.cam.lastY;
      this.cam.lastX = e.clientX;
      this.cam.lastY = e.clientY;
      this.cam.azim -= dx * 0.005;
      this.cam.elev += dy * 0.005;
      this.cam.elev = clamp(this.cam.elev, -1.2, 1.4);
    });
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.cam.dist *= e.deltaY > 0 ? 1.08 : 0.92;
        this.cam.dist = clamp(this.cam.dist, 0.8, 40);
        this.params.camDist = this.cam.dist;
        if (this.onHud) this.onHud({ camDist: this.cam.dist });
      },
      { passive: false }
    );
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  _adapt(fps) {
    if (fps < 38 && this.targetQuality > 0.45) {
      this.targetQuality = Math.max(0.45, this.targetQuality - 0.06);
    } else if (fps > 56 && this.targetQuality < 1) {
      this.targetQuality = Math.min(1, this.targetQuality + 0.02);
    }
    this.quality += (this.targetQuality - this.quality) * 0.35;
  }

  start() {
    if (this.running || !this.ok) return;
    this.running = true;
    const loop = (ts) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0.016;
      this.lastTs = ts;
      this.time += dt;
      this.fpsAccum += dt;
      this.fpsFrames++;
      if (this.fpsAccum >= 0.45) {
        this.fps = this.fpsFrames / this.fpsAccum;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this._adapt(this.fps);
        if (this.onHud) {
          this.onHud({
            fps: this.fps,
            quality: this.quality,
            camDist: this.cam.dist,
          });
        }
      }
      this._draw();
    };
    requestAnimationFrame(loop);
  }

  _draw() {
    const gl = this.gl;
    if (!this.program) return;
    this._resize();
    const p = this.params;
    const pos = this.camPos();
    const maxSteps = Math.max(
      28,
      Math.floor(p.maxSteps * (0.62 + 0.38 * this.quality))
    );
    gl.useProgram(this.program);
    const u = this.uniforms;
    gl.uniform2f(u.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uAspect, this.canvas.width / Math.max(this.canvas.height, 1));
    gl.uniform3fv(u.uCamPos, pos);
    gl.uniform3fv(u.uCamTarget, this.cam.target);
    gl.uniform1f(u.uQuality, this.quality);
    gl.uniform1i(u.uMaxSteps, maxSteps);
    gl.uniform1i(u.uFamily, this.family);
    gl.uniform1f(u.uPower, p.power);
    gl.uniform1i(u.uIterations, Math.round(p.iterations));
    gl.uniform1f(u.uBailout, p.bailout);
    gl.uniform1f(u.uScale, p.scale);
    gl.uniform3f(u.uOffset, p.offsetX, p.offsetY, p.offsetZ);
    gl.uniform1f(u.uRotate, p.rotate);
    gl.uniform3f(u.uJulia, p.juliaX, p.juliaY, p.juliaZ);
    gl.uniform1f(u.uFold, p.fold);
    gl.uniform1f(u.uMinRadius, p.minRadius);
    gl.uniform1f(u.uFixedRadius, p.fixedRadius);
    gl.uniform1i(u.uPalette, Math.round(p.palette));
    gl.uniform1f(u.uGlow, p.glow);
    gl.uniform1f(u.uSoftShadow, p.softShadow);
    gl.uniform1f(u.uAO, p.ao);
    gl.uniform1f(u.uExposure, p.exposure);
    gl.uniform1f(u.uCamDist, this.cam.dist);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
