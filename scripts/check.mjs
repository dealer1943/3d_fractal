import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CATALOG } from "../src/fractalCatalog.js";
import { compileEquation, EXAMPLES, injectCustomDE } from "../src/equation.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL", msg);
  } else {
    console.log("ok  ", msg);
  }
}

assert(CATALOG.length >= 100, `catalog size ${CATALOG.length} >= 100`);
const ids = CATALOG.map((f) => f.id);
assert(new Set(ids).size === ids.length, "catalog ids unique");
assert(CATALOG[0].id === "classic-bulb", "default fractal is classic-bulb");
assert(CATALOG.every((f) => f.name && f.blurb && typeof f.family === "number"), "entries have name/blurb/family");

const names = CATALOG.map((f) => f.name);
assert(new Set(names).size === names.length, "catalog names unique");

for (const ex of EXAMPLES) {
  const r = compileEquation(ex.code);
  assert(r.ok, `example "${ex.label}" compiles: ${r.ok ? r.mode : r.error}`);
}

const bad = compileEquation("alert(1)");
assert(!bad.ok, "rejects unknown identifier alert");
const evil = compileEquation("x; } void main(){");
assert(!evil.ok, "rejects semicolon / injection");
const hat = compileEquation("x^8");
assert(!hat.ok && /pow/.test(hat.error), "teaches pow instead of ^");

const core = readFileSync(join(root, "public/shaders/fractalCore.glsl"), "utf8");
const compiled = compileEquation("w - 1.0");
assert(compiled.ok, "sphere example ok");
const injected = injectCustomDE(core, compiled.glsl);
assert(injected.includes("w - 1.0") && injected.includes("float customDE"), "injects custom distance");
assert(!injected.includes("return 1e10;"), "replaces stub");

const files = [
  "package.json", "vite.config.js", "index.html", "README.md",
  "src/main.js", "src/ui.js", "src/renderer.js", "src/equation.js",
  "src/fractalCatalog.js", "src/style.css",
  "public/shaders/vert.glsl", "public/shaders/common.glsl", "public/shaders/fractalCore.glsl",
];
for (const f of files) {
  try {
    readFileSync(join(root, f));
    assert(true, `exists ${f}`);
  } catch {
    assert(false, `exists ${f}`);
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll checks passed. ${CATALOG.length} fractals.`);
