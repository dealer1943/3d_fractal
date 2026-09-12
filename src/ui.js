import {
  CATALOG,
  CATEGORIES,
  FAMILY_KNOBS,
  FAMILY,
  getById,
  filterCatalog,
} from "./fractalCatalog.js";
import { EXAMPLES, DIALECT_HELP, compileEquation } from "./equation.js";
import { defaultParams } from "./renderer.js";

const STORAGE_KEY = "fractal-playground-autosave";

export const PALETTES = [
  { id: 0, name: "Cosmic" },
  { id: 1, name: "Sunset" },
  { id: 2, name: "Ocean" },
  { id: 3, name: "Forest" },
  { id: 4, name: "Candy" },
  { id: 5, name: "Fire" },
  { id: 6, name: "Ice" },
  { id: 7, name: "Gold" },
  { id: 8, name: "Neon" },
  { id: 9, name: "Ink" },
];

const TIPS = {
  picker:
    "Pick a ready-made shape from the library. Search by name, or hop with Prev / Next.",
  search: "Type a word like bulb, box, ice, or star to filter the list.",
  category: "Show only one family of shapes, or All of them.",
  power:
    "How many times the shape folds over itself. Low power is puffy. High power grows spikes, like a star.",
  iterations:
    "How many times we repeat the recipe. More repeats add tiny details, but can slow the picture.",
  bailout:
    "When a point has wandered far enough we stop chasing it. Bigger numbers let outer shells grow.",
  scale:
    "Stretch or shrink the math. On boxes and stars this changes room size. On bulbs it packs details tighter.",
  offset:
    "Slide the whole recipe sideways. Uneven slides make lopsided, interesting shapes.",
  offsetX: "Slide the recipe left or right.",
  offsetY: "Slide the recipe up or down.",
  offsetZ: "Slide the recipe forward or back.",
  rotate: "Twist the shape. Helpful when you want a different face toward you.",
  julia:
    "A secret seed number that stays put while the shape grows. Nudge it and arms, islands, or needles appear.",
  juliaX: "Seed number in the left-right direction.",
  juliaY: "Seed number in the up-down direction.",
  juliaZ: "Seed number in the forward-back direction.",
  fold: "How far mirrors slap the space before shrinking it. Wide folds make big rooms. Tight folds make lace.",
  minRadius:
    "The smallest ball used in a sphere-fold. Tiny values keep sharp corners. Bigger values puff the rooms.",
  palette: "The color coat. Same sculpture, new outfit.",
  glow: "Extra light that leaks from cracks and edges. Turn it up for a neon look.",
  softShadow:
    "Soft shadows under the folds. Makes the shape feel solid. Turn down if the picture is slow.",
  ao: "Ambient occlusion: darkens tight corners so holes look deep instead of flat.",
  exposure: "Overall brightness, like a camera dial. Turn up if the shape is too dark.",
  maxSteps:
    "How many tiny steps each light ray may take. More steps find thinner details but cost speed.",
  camDist: "How far the camera sits. You can also scroll on the picture to zoom.",
  equation:
    "Write your own recipe. One line can be a distance (surface at 0). Three comma-separated lines are a new x, y, z each repeat.",
  apply: "Compile the recipe into GPU code. Only safe math words are allowed — no page scripts.",
  save: "Download every knob, the camera, and your recipe as a JSON file you can keep.",
  still: "Save a PNG photo of the fractal on the left — a still frame of what you see right now.",
  load: "Open a JSON file you saved earlier to restore the playground.",
  reset: "Put this shape back to its library defaults.",
  random: "Jump to a surprise shape from the library.",
};

const SLIDERS = [
  { key: "power", label: "Power", min: 2, max: 16, step: 0.1, group: "shape" },
  { key: "iterations", label: "Iterations", min: 2, max: 16, step: 1, group: "shape" },
  { key: "bailout", label: "Bailout", min: 1.1, max: 16, step: 0.1, group: "shape" },
  { key: "scale", label: "Scale", min: -2.5, max: 3.2, step: 0.05, group: "shape" },
  { key: "rotate", label: "Rotate", min: -3.14, max: 3.14, step: 0.01, group: "shape" },
  { key: "offsetX", label: "Offset X", min: -1.5, max: 1.5, step: 0.01, group: "offset" },
  { key: "offsetY", label: "Offset Y", min: -1.5, max: 1.5, step: 0.01, group: "offset" },
  { key: "offsetZ", label: "Offset Z", min: -1.5, max: 1.5, step: 0.01, group: "offset" },
  { key: "juliaX", label: "Julia X", min: -1.2, max: 1.2, step: 0.01, group: "julia" },
  { key: "juliaY", label: "Julia Y", min: -1.2, max: 1.2, step: 0.01, group: "julia" },
  { key: "juliaZ", label: "Julia Z", min: -1.2, max: 1.2, step: 0.01, group: "julia" },
  { key: "fold", label: "Fold", min: 0.15, max: 2.2, step: 0.01, group: "shape" },
  { key: "minRadius", label: "Min radius", min: 0.05, max: 1.2, step: 0.01, group: "shape" },
  { key: "glow", label: "Glow", min: 0, max: 1.5, step: 0.01, group: "look" },
  { key: "softShadow", label: "Soft shadow", min: 0, max: 1, step: 0.01, group: "look" },
  { key: "ao", label: "AO", min: 0, max: 1, step: 0.01, group: "look" },
  { key: "exposure", label: "Exposure", min: 0.4, max: 2.4, step: 0.01, group: "look" },
  { key: "maxSteps", label: "Max steps", min: 32, max: 160, step: 1, group: "look" },
  { key: "camDist", label: "Cam distance", min: 0.8, max: 16, step: 0.05, group: "look" },
];

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, String(v));
  }
  for (const kid of kids) {
    if (kid) n.append(kid);
  }
  return n;
}

function tipButton(key) {
  const btn = el("button", {
    type: "button",
    class: "tip-btn",
    "aria-label": `What is ${key}?`,
    "data-tip": TIPS[key] || "This knob changes the picture.",
    text: "i",
  });
  return btn;
}

function wrapField(key, label, control, extraClass = "") {
  const box = el("div", { class: `field ${extraClass}`.trim(), "data-key": key });
  const top = el("div", { class: "field-top" });
  top.append(el("label", { for: `ctl-${key}`, text: label }));
  const val = el("span", { class: "field-val", id: `val-${key}`, text: "" });
  top.append(val);
  box.append(top);
  box.append(control);
  box.append(tipButton(key));
  return box;
}

export function mountUI({ renderer }) {
  const controls = document.getElementById("controls");
  const eqBar = document.getElementById("equation-bar");
  const tipPop = document.getElementById("tip-pop");
  const hudName = document.getElementById("hud-name");
  const fpsEl = document.getElementById("fps");
  const qualityEl = document.getElementById("quality");

  const state = {
    fractalId: "classic-bulb",
    query: "",
    category: "all",
    inputs: {},
  };

  // ----- build controls -----
  const picker = el("section", { class: "panel-block" });
  picker.append(
    el("div", { class: "block-head" }, [
      el("h2", { text: "Library" }),
      tipButton("picker"),
    ])
  );

  const search = el("input", {
    type: "search",
    id: "ctl-search",
    class: "search",
    placeholder: "Search shapes…",
    "aria-label": "Search fractals",
  });
  const searchWrap = el("div", { class: "field" });
  searchWrap.append(search, tipButton("search"));

  const catRow = el("div", { class: "chips", role: "tablist", "aria-label": "Categories" });
  for (const c of CATEGORIES) {
    const b = el("button", {
      type: "button",
      class: "chip" + (c.id === "all" ? " active" : ""),
      "data-cat": c.id,
      text: c.label,
    });
    catRow.append(b);
  }
  const catWrap = el("div", { class: "field" });
  catWrap.append(catRow, tipButton("category"));

  const select = el("select", { id: "ctl-fractal", "aria-label": "Fractal preset" });
  const nav = el("div", { class: "nav-row" });
  const prevBtn = el("button", { type: "button", class: "btn", text: "◀ Prev" });
  const nextBtn = el("button", { type: "button", class: "btn", text: "Next ▶" });
  const countEl = el("span", { class: "count", id: "lib-count", text: "" });
  nav.append(prevBtn, countEl, nextBtn);

  const blurb = el("p", { class: "blurb", id: "fractal-blurb", text: "" });

  const actionRow = el("div", { class: "nav-row" });
  const randomBtn = el("button", { type: "button", class: "btn", text: "Surprise" });
  const resetBtn = el("button", { type: "button", class: "btn", text: "Reset" });
  const randWrap = el("div", { class: "field", style: "flex:1;margin:0;" });
  randWrap.append(randomBtn, tipButton("random"));
  const resetWrap = el("div", { class: "field", style: "flex:1;margin:0;" });
  resetWrap.append(resetBtn, tipButton("reset"));
  actionRow.append(randWrap, resetWrap);

  picker.append(searchWrap, catWrap, select, nav, blurb, actionRow);

  const shapeBox = el("section", { class: "panel-block", id: "shape-knobs" });
  shapeBox.append(el("h2", { text: "Shape knobs" }));
  const shapeMount = el("div", { id: "shape-mount" });
  shapeBox.append(shapeMount);

  const lookBox = el("section", { class: "panel-block" });
  lookBox.append(el("h2", { text: "Look knobs" }));

  const pal = el("select", { id: "ctl-palette", "aria-label": "Color palette" });
  for (const p of PALETTES) {
    pal.append(el("option", { value: String(p.id), text: p.name }));
  }
  lookBox.append(wrapField("palette", "Color palette", pal));

  for (const spec of SLIDERS.filter((s) => s.group === "look")) {
    const input = el("input", {
      type: "range",
      id: `ctl-${spec.key}`,
      min: String(spec.min),
      max: String(spec.max),
      step: String(spec.step),
      "aria-label": spec.label,
    });
    state.inputs[spec.key] = input;
    lookBox.append(wrapField(spec.key, spec.label, input));
  }

  const ioBox = el("section", { class: "panel-block" });
  ioBox.append(el("h2", { text: "Save / load" }));
  const ioRow = el("div", { class: "nav-row" });
  const saveBtn = el("button", { type: "button", class: "btn primary", text: "JSON" });
  const stillBtn = el("button", { type: "button", class: "btn primary", text: "Save still" });
  const loadLabel = el("label", { class: "btn file-btn", text: "Load" });
  const loadInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    "aria-label": "Load settings JSON",
  });
  loadLabel.append(loadInput);
  const saveWrap = el("div", { class: "field", style: "flex:1;margin:0;" });
  saveWrap.append(saveBtn, tipButton("save"));
  const stillWrap = el("div", { class: "field", style: "flex:1;margin:0;" });
  stillWrap.append(stillBtn, tipButton("still"));
  const loadWrap = el("div", { class: "field", style: "flex:1;margin:0;" });
  loadWrap.append(loadLabel, tipButton("load"));
  ioRow.append(stillWrap, saveWrap, loadWrap);
  const ioNote = el("p", {
    class: "fine",
    text: "Autosaves in this browser. Stills & JSON stay on your device.",
  });
  ioBox.append(ioRow, ioNote);

  controls.append(picker, shapeBox, lookBox, ioBox);

  // shape sliders (rebuilt per fractal)
  function rebuildShapeKnobs(showKeys) {
    shapeMount.replaceChildren();
    const keys = new Set(showKeys || []);
    const want = (k) => {
      if (k === "offsetX" || k === "offsetY" || k === "offsetZ") return keys.has("offset") || keys.has(k);
      if (k === "juliaX" || k === "juliaY" || k === "juliaZ") return keys.has("julia") || keys.has(k);
      return keys.has(k);
    };
    for (const spec of SLIDERS.filter((s) => s.group !== "look")) {
      if (!want(spec.key)) {
        delete state.inputs[spec.key];
        continue;
      }
      const input = el("input", {
        type: "range",
        id: `ctl-${spec.key}`,
        min: String(spec.min),
        max: String(spec.max),
        step: String(spec.step),
        "aria-label": spec.label,
      });
      state.inputs[spec.key] = input;
      input.value = String(renderer.params[spec.key] ?? spec.min);
      input.addEventListener("input", onSlider);
      shapeMount.append(wrapField(spec.key, spec.label, input));
      refreshVal(spec.key);
    }
  }

  function refreshVal(key) {
    const node = document.getElementById(`val-${key}`);
    if (!node) return;
    if (key === "palette") {
      const p = PALETTES.find((x) => x.id === Number(renderer.params.palette));
      node.textContent = p ? p.name : String(renderer.params.palette);
      return;
    }
    const v = renderer.params[key];
    if (typeof v !== "number") {
      node.textContent = "";
      return;
    }
    const spec = SLIDERS.find((s) => s.key === key);
    const step = spec ? Number(spec.step) : 0.01;
    const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
    node.textContent = Number(v).toFixed(digits);
  }

  function syncInputsFromRenderer() {
    pal.value = String(Math.round(renderer.params.palette));
    refreshVal("palette");
    for (const [key, input] of Object.entries(state.inputs)) {
      if (renderer.params[key] == null) continue;
      input.value = String(renderer.params[key]);
      refreshVal(key);
    }
  }

  function onSlider(ev) {
    const key = ev.target.id.replace(/^ctl-/, "");
    const spec = SLIDERS.find((s) => s.key === key);
    let v = Number(ev.target.value);
    if (spec && spec.step >= 1) v = Math.round(v);
    renderer.setParams({ [key]: v });
    refreshVal(key);
    scheduleSave();
  }

  pal.addEventListener("change", () => {
    renderer.setParams({ palette: Number(pal.value) });
    refreshVal("palette");
    scheduleSave();
  });

  for (const spec of SLIDERS.filter((s) => s.group === "look")) {
    state.inputs[spec.key].addEventListener("input", onSlider);
  }

  function fillSelect() {
    const list = filterCatalog(state.query, state.category);
    select.replaceChildren();
    for (const f of list) {
      select.append(el("option", { value: f.id, text: f.name }));
    }
    if (!list.find((f) => f.id === state.fractalId) && list[0]) {
      // keep current id in the box even if filtered out
      select.append(el("option", { value: state.fractalId, text: getById(state.fractalId).name + " (hidden by filter)" }));
    }
    select.value = state.fractalId;
    countEl.textContent = `${list.length} / ${CATALOG.length}`;
  }

  function applyFractal(id, { keepCamera = false, keepParams = false } = {}) {
    const f = getById(id);
    state.fractalId = f.id;
    renderer.setFamily(f.family);
    if (!keepParams) {
      renderer.setParams({ ...defaultParams(), ...f.params });
    }
    if (!keepCamera) {
      renderer.setCamera(f.cam);
    }
    const show = f.show && f.show.length ? f.show : FAMILY_KNOBS[f.family] || FAMILY_KNOBS[0];
    rebuildShapeKnobs(show);
    syncInputsFromRenderer();
    fillSelect();
    blurb.textContent = f.blurb;
    hudName.textContent = renderer.useCustom ? `Custom · ${f.name}` : f.name;
    document.title = `${f.name} — Fractal Playground`;
    scheduleSave();
  }

  search.addEventListener("input", () => {
    state.query = search.value;
    fillSelect();
  });
  catRow.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    state.category = b.getAttribute("data-cat");
    for (const c of catRow.querySelectorAll(".chip")) {
      c.classList.toggle("active", c === b);
    }
    fillSelect();
  });
  select.addEventListener("change", () => applyFractal(select.value));
  prevBtn.addEventListener("click", () => stepFractal(-1));
  nextBtn.addEventListener("click", () => stepFractal(1));
  randomBtn.addEventListener("click", () => {
    const list = filterCatalog(state.query, state.category);
    const pool = list.length ? list : CATALOG;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    applyFractal(pick.id);
  });
  resetBtn.addEventListener("click", () => applyFractal(state.fractalId));

  function stepFractal(dir) {
    const list = filterCatalog(state.query, state.category);
    const pool = list.length ? list : CATALOG;
    let i = pool.findIndex((f) => f.id === state.fractalId);
    if (i < 0) i = 0;
    const next = pool[(i + dir + pool.length) % pool.length];
    applyFractal(next.id);
  }

  // ----- equation bar -----
  const eqHead = el("div", { class: "eq-head" });
  eqHead.append(
    el("h2", { text: "Custom equation" }),
    tipButton("equation")
  );
  const eqRow = el("div", { class: "eq-row" });
  const textarea = el("textarea", {
    id: "ctl-equation",
    spellcheck: "false",
    autocomplete: "off",
    "aria-label": "Custom fractal equation",
    placeholder: "Example: w - 1.0     or     sin(x)*1.4, sin(y)*1.4, sin(z)*1.4",
  });
  const applyBtn = el("button", { type: "button", class: "btn primary compact", text: "Apply" });
  const eqErr = el("div", { class: "eq-err", id: "eq-err", role: "status", "aria-live": "polite" });
  const actions = el("div", { class: "eq-actions", "aria-label": "Equation actions" });
  const applyWrap = el("div", { class: "field" });
  applyWrap.append(applyBtn, tipButton("apply"));
  actions.append(applyWrap);
  for (const ex of EXAMPLES) {
    const b = el("button", {
      type: "button",
      class: "chip",
      "data-ex": ex.code,
      text: ex.label,
      title: ex.tip,
    });
    actions.append(b);
  }
  const help = el("details", { class: "eq-help" });
  help.append(el("summary", { text: "Dialect" }));
  help.append(el("pre", { text: DIALECT_HELP }));
  actions.append(help);
  eqRow.append(textarea, actions, eqErr);
  eqBar.append(eqHead, eqRow);

  actions.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ex]");
    if (!b) return;
    textarea.value = b.getAttribute("data-ex");
    applyEquation();
  });
  applyBtn.addEventListener("click", applyEquation);
  textarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      applyEquation();
    }
  });

  function applyEquation() {
    const src = textarea.value;
    const parsed = compileEquation(src);
    if (!parsed.ok) {
      eqErr.textContent = parsed.error;
      eqErr.classList.add("show");
      return;
    }
    const result = renderer.applyCustomEquation(src);
    if (!result.ok) {
      eqErr.textContent = result.error;
      eqErr.classList.add("show");
      return;
    }
    eqErr.textContent = result.mode === "distance"
      ? "Nice — that recipe is a distance shape (surface where it equals 0)."
      : "Nice — that recipe is an iterate fractal (new x, y, z each repeat). Try Iterations.";
    eqErr.classList.add("show", "ok");
    renderer.setFamily(FAMILY.CUSTOM);
    rebuildShapeKnobs(FAMILY_KNOBS[FAMILY.CUSTOM]);
    syncInputsFromRenderer();
    hudName.textContent = "Custom equation";
    scheduleSave();
    setTimeout(() => eqErr.classList.remove("show", "ok"), 4000);
  }

  // ----- tips -----
  function showTip(btn) {
    const text = btn.getAttribute("data-tip") || "";
    tipPop.textContent = text;
    tipPop.hidden = false;
    const r = btn.getBoundingClientRect();
    const pad = 8;
    let left = r.right - 260;
    let top = r.bottom + 6;
    if (left < pad) left = pad;
    if (left + 260 > window.innerWidth - pad) left = window.innerWidth - 260 - pad;
    if (top + 90 > window.innerHeight - pad) top = r.top - 8 - 80;
    tipPop.style.left = `${Math.max(pad, left)}px`;
    tipPop.style.top = `${Math.max(pad, top)}px`;
  }
  function hideTip() {
    tipPop.hidden = true;
  }
  document.addEventListener("pointerover", (e) => {
    const b = e.target.closest(".tip-btn");
    if (b) showTip(b);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest(".tip-btn") && !e.relatedTarget?.closest?.(".tip-btn")) hideTip();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".tip-btn");
    if (b) {
      e.preventDefault();
      e.stopPropagation();
      if (!tipPop.hidden && tipPop.textContent === b.getAttribute("data-tip")) hideTip();
      else showTip(b);
    } else if (!e.target.closest("#tip-pop")) {
      hideTip();
    }
  });
  document.addEventListener("focusin", (e) => {
    if (e.target.classList?.contains("tip-btn")) showTip(e.target);
  });
  document.addEventListener("focusout", (e) => {
    if (e.target.classList?.contains("tip-btn")) hideTip();
  });

  // ----- save / load -----
  function snapshot() {
    const r = renderer.getState();
    return {
      version: 1,
      app: "fractal-playground",
      fractalId: state.fractalId,
      useCustom: r.useCustom,
      customEquation: textarea.value || r.customEquation,
      params: r.params,
      camera: r.camera,
    };
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fractal-${state.fractalId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function applySnapshot(data) {
    if (!data || typeof data !== "object") throw new Error("Not a settings object.");
    const found = data.fractalId ? getById(data.fractalId) : null;
    const id = found && found.id === data.fractalId ? data.fractalId : "classic-bulb";
    applyFractal(id, { keepCamera: true, keepParams: true });
    if (data.params && typeof data.params === "object") {
      renderer.setParams(data.params);
    } else {
      renderer.setParams({ ...defaultParams(), ...getById(id).params });
    }
    if (data.camera) renderer.setCamera(data.camera);
    textarea.value = data.customEquation || "";
    if (data.useCustom && data.customEquation) {
      const result = renderer.applyCustomEquation(data.customEquation);
      if (result.ok) {
        renderer.setFamily(FAMILY.CUSTOM);
        rebuildShapeKnobs(FAMILY_KNOBS[FAMILY.CUSTOM]);
        hudName.textContent = "Custom equation";
      }
    }
    const f = getById(state.fractalId);
    const show = renderer.useCustom
      ? FAMILY_KNOBS[FAMILY.CUSTOM]
      : (f.show && f.show.length ? f.show : FAMILY_KNOBS[f.family]);
    rebuildShapeKnobs(show);
    syncInputsFromRenderer();
    blurb.textContent = f.blurb;
  }

  saveBtn.addEventListener("click", downloadJSON);
  stillBtn.addEventListener("click", () => {
    try {
      const url = renderer.captureStill();
      const a = document.createElement("a");
      a.href = url;
      a.download = `fractal-${state.fractalId}.png`;
      a.click();
    } catch (err) {
      console.error(err);
      eqErr.textContent = "Could not save a still yet — wait for the fractal to appear, then try again.";
      eqErr.classList.add("show");
      setTimeout(() => eqErr.classList.remove("show"), 3500);
    }
  });
  loadInput.addEventListener("change", async () => {
    const file = loadInput.files && loadInput.files[0];
    loadInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      applySnapshot(data);
      eqErr.textContent = "Loaded settings from file.";
      eqErr.classList.add("show", "ok");
    } catch (err) {
      eqErr.textContent = "Could not read that file. Need a JSON export from this playground.";
      eqErr.classList.add("show");
    }
  });

  let saveTimer = 0;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
      } catch {
        /* ignore quota / private mode */
      }
    }, 400);
  }

  function restoreAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      applySnapshot(JSON.parse(raw));
      return true;
    } catch {
      return false;
    }
  }

  renderer.onHud = ({ fps, quality, camDist }) => {
    if (typeof fps === "number") fpsEl.textContent = `${Math.round(fps)} fps`;
    if (typeof quality === "number") qualityEl.textContent = `Q ${Math.round(quality * 100)}%`;
    if (typeof camDist === "number" && state.inputs.camDist) {
      state.inputs.camDist.value = String(camDist);
      refreshVal("camDist");
    }
  };

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepFractal(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepFractal(1);
    }
  });

  // boot
  if (!restoreAutosave()) {
    applyFractal("classic-bulb");
  } else {
    fillSelect();
  }

  return { state, applyFractal, snapshot, applySnapshot };
}
