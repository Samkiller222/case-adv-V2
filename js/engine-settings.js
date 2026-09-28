/* Extraction-engine selection (home server vs. Gemini) and its credentials.
 * Owns the Options-panel fields and their localStorage persistence; other
 * modules that need to know the current engine/credentials (extraction.js,
 * email-writer.js) go through the getters below instead of touching the
 * DOM or localStorage directly.
 */
import { el } from "./utils.js";
import { GEMINI_MODEL, GEMINI_MODELS } from "./config.js";

const apiKeyInput = el("apiKey");
const engineModeEl = el("engineMode");
const homeUrlInput = el("homeUrl");
const homeTokenInput = el("homeToken");
const engineTagEl = el("engineTag");
const homeActiveTag = el("homeActiveTag");
const geminiActiveTag = el("geminiActiveTag");
const geminiModelEl = el("geminiModel");
const geminiModelInfo = el("geminiModelInfo");
const geminiFallbackEl = el("geminiFallback");

export function getEngineMode() { return engineModeEl.value; } // "home" | "gemini"
export function getApiKey() { return apiKeyInput.value.trim(); }
export function getHomeUrl() { return homeUrlInput.value.trim(); }
export function getHomeToken() { return homeTokenInput.value.trim(); }
export function getGeminiModel() { return geminiModelEl.value || GEMINI_MODEL; }

// Statuses meaning "the model is overloaded / rate-limited right now" —
// worth retrying on a different model rather than failing outright.
const BUSY_STATUSES = new Set([429, 500, 503, 504]);

/* POSTs a generateContent request to the selected Gemini model. If that
 * model is busy and auto-fallback is on, retries the same request on each
 * other configured model in order. Resolves to { data, model } where model
 * is the one that actually answered; throws the last error otherwise.
 */
export async function callGemini(body) {
  const key = getApiKey();
  if (!key) throw new Error("Enter your Gemini API key in Options first.");

  const primary = getGeminiModel();
  const models = [primary];
  if (geminiFallbackEl.checked) {
    for (const m of GEMINI_MODELS) if (m.id !== primary) models.push(m.id);
  }

  let lastErr;
  for (const model of models) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (resp.ok) return { data: await resp.json(), model };

    const errText = await resp.text();
    lastErr = new Error(`API error ${resp.status} (${model}): ${errText.slice(0, 300)}`);
    // Only busy/unavailable errors are worth trying elsewhere — a bad key
    // or malformed request would fail identically on every model. A 404
    // (model retired/renamed) also moves on to the next one.
    if (!BUSY_STATUSES.has(resp.status) && resp.status !== 404) break;
  }
  if (models.length > 1) lastErr.message += " — every model tried was unavailable; try again shortly.";
  throw lastErr;
}

function syncModelInfo() {
  const m = GEMINI_MODELS.find(x => x.id === geminiModelEl.value);
  geminiModelInfo.textContent = m ? `${m.summary} Cost: ${m.pricing}.` : "";
}

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

  for (const m of GEMINI_MODELS) geminiModelEl.add(new Option(m.label, m.id));
  const savedModel = localStorage.getItem("case_register_gemini_model");
  geminiModelEl.value = GEMINI_MODELS.some(m => m.id === savedModel) ? savedModel : GEMINI_MODEL;
  geminiModelEl.addEventListener("change", () => {
    localStorage.setItem("case_register_gemini_model", geminiModelEl.value);
    syncModelInfo();
  });
  geminiFallbackEl.checked = localStorage.getItem("case_register_gemini_fallback") !== "0";
  geminiFallbackEl.addEventListener("change", () => {
    localStorage.setItem("case_register_gemini_fallback", geminiFallbackEl.checked ? "1" : "0");
  });

  syncEngineRows();
  syncModelInfo();
}
