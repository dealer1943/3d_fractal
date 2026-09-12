import "./style.css";
import { Renderer } from "./renderer.js";
import { mountUI } from "./ui.js";

const canvas = document.getElementById("gl");
const hudName = document.getElementById("hud-name");
const hint = document.getElementById("viewer-hint");

function status(msg, detail) {
  if (hudName) hudName.textContent = msg;
  if (detail && hint) hint.textContent = detail;
}

const renderer = new Renderer(canvas);

async function boot() {
  if (!renderer.ok) {
    status("WebGL2 is required", "Try Chrome or Edge with hardware acceleration on.");
    return;
  }
  try {
    status("Loading shaders…");
    await renderer.init();
    status("Building controls…");
    // Yield so the HUD can paint before a heavy compile/UI pass
    await new Promise((r) => requestAnimationFrame(() => r()));
    mountUI({ renderer });
    renderer.start();
    // HUD name will be set by mountUI / applyFractal
  } catch (err) {
    console.error(err);
    const detail = String(err && err.message ? err.message : err).slice(0, 280);
    status("Could not start the renderer", detail || "Shader load/compile failed. See the browser console.");
  }
}

boot();
