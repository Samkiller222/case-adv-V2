/* Light/dark theme toggle and the accent-color picker. Both persist to
 * localStorage and are applied via CSS custom properties on <html>, so the
 * rest of the app never needs to know which theme/accent is active — it
 * just reads the --accent/--accent-dark/--accent-bg variables in the
 * stylesheet.
 */
import { el } from "./utils.js";
import { ACCENT_PRESETS } from "./config.js";

const themeOptionRadios = document.querySelectorAll('input[name="themeOption"]');
const accentPickerBtn = el("accentPickerBtn");
const accentMenu = el("accentMenu");
const accentSwatchCurrent = el("accentSwatchCurrent");
const accentNameCurrent = el("accentNameCurrent");

let currentAccentId = localStorage.getItem("case_register_accent") || "red";

function applyAccent(id) {
  const preset = ACCENT_PRESETS.find(p => p.id === id) || ACCENT_PRESETS[0];
  currentAccentId = preset.id;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const vals = isDark ? preset.dark : preset.light;
  document.documentElement.style.setProperty("--accent", vals.accent);
  document.documentElement.style.setProperty("--accent-dark", vals.accentDark);
  document.documentElement.style.setProperty("--accent-bg", vals.accentBg);
  localStorage.setItem("case_register_accent", preset.id);
  renderAccentPicker();
}

function renderAccentPicker() {
  const preset = ACCENT_PRESETS.find(p => p.id === currentAccentId) || ACCENT_PRESETS[0];
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  accentSwatchCurrent.style.setProperty("--swatch-color", (isDark ? preset.dark : preset.light).accent);
  accentNameCurrent.textContent = preset.name;

  accentMenu.innerHTML = "";
  ACCENT_PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "accent-option" + (p.id === currentAccentId ? " active" : "");
    btn.setAttribute("role", "menuitem");
    const dot = document.createElement("span");
    dot.className = "swatch";
    dot.style.setProperty("--swatch-color", (isDark ? p.dark : p.light).accent);
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(" " + p.name));
    btn.addEventListener("click", () => {
      applyAccent(p.id);
      accentMenu.setAttribute("hidden", "");
      accentPickerBtn.setAttribute("aria-expanded", "false");
    });
    accentMenu.appendChild(btn);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("case_register_theme", theme);
  themeOptionRadios.forEach(r => { r.checked = r.value === theme; });
  applyAccent(currentAccentId);
}

export function initTheme() {
  accentPickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = accentMenu.hasAttribute("hidden");
    if (willOpen) accentMenu.removeAttribute("hidden"); else accentMenu.setAttribute("hidden", "");
    accentPickerBtn.setAttribute("aria-expanded", String(willOpen));
  });
  document.addEventListener("click", (e) => {
    if (!accentMenu.hasAttribute("hidden") && !accentMenu.contains(e.target) && !accentPickerBtn.contains(e.target)) {
      accentMenu.setAttribute("hidden", "");
      accentPickerBtn.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !accentMenu.hasAttribute("hidden")) {
      accentMenu.setAttribute("hidden", "");
      accentPickerBtn.setAttribute("aria-expanded", "false");
    }
  });

  el("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  themeOptionRadios.forEach(r => {
    r.addEventListener("change", () => { if (r.checked) applyTheme(r.value); });
  });

  // index.html's inline <head> script already set data-theme before first
  // paint (to avoid a flash) — this just brings the toggle UI and accent
  // variables in sync with whatever it picked.
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
}
