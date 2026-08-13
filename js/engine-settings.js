/* Extraction-engine selection (home server vs. Gemini) and its credentials.
 * Owns the Options-panel fields and their localStorage persistence; other
 * modules that need to know the current engine/credentials (extraction.js,
 * email-writer.js) go through the getters below instead of touching the
 * DOM or localStorage directly.
 */
import { el } from "./utils.js";

const apiKeyInput = el("apiKey");
const engineModeEl = el("engineMode");
const homeUrlInput = el("homeUrl");
const homeTokenInput = el("homeToken");
const engineTagEl = el("engineTag");
const homeActiveTag = el("homeActiveTag");
const geminiActiveTag = el("geminiActiveTag");

export function getEngineMode() { return engineModeEl.value; } // "home" | "gemini"
export function getApiKey() { return apiKeyInput.value.trim(); }
export function getHomeUrl() { return homeUrlInput.value.trim(); }
export function getHomeToken() { return homeTokenInput.value.trim(); }

// Both credential rows stay visible in Options at all times (so there's
// always somewhere to enter either one) — only the "Active" tag and the
// compact intake-panel tag reflect which engine is actually in use.
function syncEngineRows() {
  const isHome = getEngineMode() === "home";
  engineTagEl.textContent = isHome ? "Home server" : "Gemini";
  homeActiveTag.hidden = !isHome;
  geminiActiveTag.hidden = isHome;
}

export function initEngineSettings() {
  apiKeyInput.value = localStorage.getItem("case_register_gemini_key") || "";
  apiKeyInput.addEventListener("input", () => {
    localStorage.setItem("case_register_gemini_key", getApiKey());
  });

  engineModeEl.value = localStorage.getItem("case_register_engine") || "home";
  homeUrlInput.value = localStorage.getItem("case_register_home_url") || "";
  homeTokenInput.value = localStorage.getItem("case_register_home_token") || "";

  engineModeEl.addEventListener("change", () => {
    localStorage.setItem("case_register_engine", getEngineMode());
    syncEngineRows();
  });
  homeUrlInput.addEventListener("input", () => {
    localStorage.setItem("case_register_home_url", getHomeUrl());
  });
  homeTokenInput.addEventListener("input", () => {
    localStorage.setItem("case_register_home_token", getHomeToken());
  });

  syncEngineRows();
}
