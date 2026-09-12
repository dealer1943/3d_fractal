/**
 * Safe expression dialect → GLSL snippet.
 * User text is tokenized and parsed. Nothing is eval()'d as JavaScript.
 */

const FNS = {
  sin: 1,
  cos: 1,
  tan: 1,
  abs: 1,
  floor: 1,
  fract: 1,
  sign: 1,
  sqrt: 1,
  exp: 1,
  log: 1,
  acos: 1,
  asin: 1,
  atan: [1, 2],
  length: [1, 2, 3],
  min: [2, 3, 4],
  max: [2, 3, 4],
  pow: 2,
  mod: 2,
  clamp: 3,
  mix: 3,
  step: 2,
  smoothstep: 3,
};

const VARS = new Set([
  "x", "y", "z", "w", "r",
  "pi", "e",
  "scale", "power", "bailout",
  "ox", "oy", "oz",
  "cx", "cy", "cz",
]);

const BLOCKED = new Set([
  "gl_FragColor", "gl_FragCoord", "texture", "uniform", "void", "main",
  "for", "while", "if", "else", "return", "int", "bool", "sampler2D",
]);

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = src.trim();
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ("+-*/(),".includes(ch)) {
      tokens.push({ t: "op", v: ch });
      i++;
      continue;
    }
    if (ch === "^") {
      throw new Error("Use pow(a, b) instead of a^b. Example: pow(x, 8.0)");
    }
    if (ch === "=") {
      throw new Error("No equals sign needed — just write the recipe, like sin(x) + y");
    }
    if ("{};#\\'\"`$?:[]<>!&|".includes(ch)) {
      throw new Error(`The character "${ch}" is not allowed. Stick to + - * / ( ) and names like sin, x, y.`);
    }
    if (ch === "." || (ch >= "0" && ch <= "9")) {
      const m = s.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!m) throw new Error("That number looks unfinished.");
      tokens.push({ t: "num", v: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const m = s.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      tokens.push({ t: "id", v: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    throw new Error(`I do not understand "${ch}". Try letters, numbers, and + - * / ( ).`);
  }
  return tokens;
}

function parseExpressions(src) {
  const tokens = tokenize(src);
  if (tokens.length === 0) throw new Error("Type a recipe first, then press Apply.");
  let pos = 0;

  const peek = () => tokens[pos] || null;
  const eat = (v) => {
    const tok = peek();
    if (!tok || tok.v !== v) throw new Error(`I expected "${v}" next.`);
    pos++;
    return tok;
  };

  function parseExpr() {
    let node = parseTerm();
    while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = peek().v;
      pos++;
      node = { k: "bin", op, a: node, b: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = peek().v;
      pos++;
      node = { k: "bin", op, a: node, b: parseUnary() };
    }
    return node;
  }

  function parseUnary() {
    if (peek() && peek().t === "op" && peek().v === "+") {
      pos++;
      return parseUnary();
    }
    if (peek() && peek().t === "op" && peek().v === "-") {
      pos++;
      return { k: "una", op: "-", a: parseUnary() };
    }
    return parseAtom();
  }

  function parseAtom() {
    const tok = peek();
    if (!tok) throw new Error("The recipe ended too soon. Check your parentheses.");
    if (tok.t === "num") {
      pos++;
      let n = tok.v;
      if (!n.includes(".") && !/[eE]/.test(n)) n += ".0";
      return { k: "num", v: n };
    }
    if (tok.t === "op" && tok.v === "(") {
      pos++;
      const inner = parseExpr();
      eat(")");
      return inner;
    }
    if (tok.t === "id") {
      pos++;
      const name = tok.v;
      if (BLOCKED.has(name)) {
        throw new Error(`"${name}" is not a allowed word in this playground.`);
      }
      if (peek() && peek().t === "op" && peek().v === "(") {
        pos++;
        const args = [];
        if (!(peek() && peek().t === "op" && peek().v === ")")) {
          args.push(parseExpr());
          while (peek() && peek().t === "op" && peek().v === ",") {
            pos++;
            args.push(parseExpr());
          }
        }
        eat(")");
        if (!FNS[name]) {
          const known = Object.keys(FNS).join(", ");
          throw new Error(`I do not know the function "${name}". Try: ${known}.`);
        }
        const spec = FNS[name];
        const ok = Array.isArray(spec) ? spec.includes(args.length) : spec === args.length;
        if (!ok) {
          const want = Array.isArray(spec) ? spec.join(" or ") : String(spec);
          throw new Error(`"${name}" wants ${want} input(s). You gave ${args.length}.`);
        }
        return { k: "call", name, args };
      }
      if (!VARS.has(name)) {
        if (FNS[name]) throw new Error(`"${name}" needs parentheses, like ${name}(x).`);
        throw new Error(`I do not know "${name}". Variables are x, y, z, w (or r), plus pi, e, scale, power.`);
      }
      return { k: "var", name };
    }
    throw new Error(`Unexpected "${tok.v}" in the recipe.`);
  }

  const exprs = [parseExpr()];
  while (peek() && peek().t === "op" && peek().v === ",") {
    pos++;
    exprs.push(parseExpr());
  }
  if (pos !== tokens.length) {
    throw new Error(`Extra bits after the recipe: "${tokens[pos].v}".`);
  }
  if (exprs.length !== 1 && exprs.length !== 3) {
    throw new Error("Write one recipe (a distance) or three recipes separated by commas (new x, y, z).");
  }
  return exprs;
}

function emit(node) {
  if (node.k === "num") return node.v;
  if (node.k === "var") {
    const map = {
      x: "x", y: "y", z: "z", w: "w", r: "w",
      pi: "3.14159265359", e: "2.71828182846",
      scale: "uScale", power: "uPower", bailout: "uBailout",
      ox: "uOffset.x", oy: "uOffset.y", oz: "uOffset.z",
      cx: "uJulia.x", cy: "uJulia.y", cz: "uJulia.z",
    };
    return map[node.name];
  }
  if (node.k === "una") return `(${node.op}${emit(node.a)})`;
  if (node.k === "bin") return `(${emit(node.a)} ${node.op} ${emit(node.b)})`;
  if (node.k === "call") {
    const args = node.args.map(emit);
    if (node.name === "length") {
      if (args.length === 1) return `abs(${args[0]})`;
      if (args.length === 2) return `length(vec2(${args[0]}, ${args[1]}))`;
      return `length(vec3(${args[0]}, ${args[1]}, ${args[2]}))`;
    }
    if (node.name === "min" || node.name === "max") {
      let out = `${node.name}(${args[0]}, ${args[1]})`;
      for (let i = 2; i < args.length; i++) out = `${node.name}(${out}, ${args[i]})`;
      return out;
    }
    if (node.name === "atan" && args.length === 2) return `atan(${args[0]}, ${args[1]})`;
    return `${node.name}(${args.join(", ")})`;
  }
  throw new Error("Internal parse error.");
}

export const EXAMPLES = [
  { label: "Sphere", code: "w - 1.0", tip: "A simple ball. w is the distance from the center." },
  { label: "Octahedron", code: "abs(x)+abs(y)+abs(z)-1.0", tip: "A diamond made of eight triangles." },
  { label: "Box", code: "max(abs(x)-0.8, abs(y)-0.8, abs(z)-0.8)", tip: "A cube. Raise the 0.8 to make it bigger." },
  { label: "Sine folds", code: "sin(x)*1.4, sin(y)*1.4, sin(z)*1.4", tip: "Wavy folds that grow a blobby crystal." },
  { label: "Quadratic", code: "x*x-y*y-z*z, 2.0*x*y, 2.0*x*z", tip: "A classic Julia-style square recipe." },
  { label: "Abs nest", code: "abs(x)*1.8-1.0, abs(y)*1.8-1.0, abs(z)*1.8-1.0", tip: "Mirror folds, like a 3D kaleidoscope." },
];

export const DIALECT_HELP = `
Variables: x y z  ·  w or r = distance from center
Also: pi, e, scale, power, bailout, ox oy oz (offset), cx cy cz (julia)
Functions: sin cos tan abs floor fract sign sqrt exp log acos asin atan
           length min max pow mod clamp mix step smoothstep
Operators: + - * /  ( )  and commas
One expression = a distance (shape surface where it equals 0).
Three expressions = new x, y, z each iteration (an escape-time fractal).
`.trim();

/**
 * Compile user text to a GLSL customDE(vec3 p) function body replacement.
 * @returns {{ ok: true, glsl: string, mode: 'distance'|'iterate' } | { ok: false, error: string }}
 */
export function compileEquation(src) {
  try {
    const exprs = parseExpressions(src);
    if (exprs.length === 1) {
      const body = emit(exprs[0]);
      return {
        ok: true,
        mode: "distance",
        glsl: customDistanceGLSL(body),
      };
    }
    return {
      ok: true,
      mode: "iterate",
      glsl: customIterateGLSL(emit(exprs[0]), emit(exprs[1]), emit(exprs[2])),
    };
  } catch (err) {
    return { ok: false, error: err.message || "Could not read that recipe." };
  }
}

function customDistanceGLSL(expr) {
  return `float customDE(vec3 p) {
  float x = p.x;
  float y = p.y;
  float z = p.z;
  float w = length(p);
  gTrap = w;
  return (${expr});
}`;
}

function customIterateGLSL(ex, ey, ez) {
  return `float customDE(vec3 p) {
  vec3 zpos = p;
  float dr = 1.0;
  float rr = 0.0;
  gTrap = 1e10;
  for (int i = 0; i < 24; i++) {
    if (i >= uIterations) break;
    rr = length(zpos);
    if (rr > uBailout) break;
    float x = zpos.x;
    float y = zpos.y;
    float z = zpos.z;
    float w = rr;
    float nx = ${ex};
    float ny = ${ey};
    float nz = ${ez};
    dr = dr * 2.0 + 1.0;
    zpos = vec3(nx, ny, nz) + uJulia;
    gTrap = min(gTrap, rr);
  }
  rr = length(zpos);
  return 0.5 * log(max(rr, 1e-6)) * rr / max(dr, 1e-6);
}`;
}

export function injectCustomDE(coreSrc, customFnSrc) {
  return coreSrc.replace(
    /\/\/ CUSTOM_DE_HOOK[\s\S]*?float customDE\(vec3 p\) \{\s*return 1e10;\s*\}/,
    `// CUSTOM_DE_HOOK\n${customFnSrc}`
  );
}
