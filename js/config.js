/* Loads every piece of static config/data the app needs from data/*.json.
 *
 * These fetches must resolve before any other module runs — importing
 * this module (from anywhere) transparently waits for that thanks to
 * top-level await: the ES module graph won't finish evaluating a module
 * that imports this one until these promises settle. That's why nothing
 * else in this app needs its own "wait for config" logic.
 *
 * Requires the page to be served over http(s) (e.g. GitHub Pages, or any
 * local static server) — fetch() of local files is blocked by browsers
 * when index.html is opened directly via file://.
 */

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  return res.json();
}

// The extracted-record form fields, in display order (data/fields.json).
export const FIELDS = await loadJson("./data/fields.json");

// Malta CVU "Documentation Required for Employment Visa" checklist items,
// each with an id, display label, and the compliance criteria text used
// both on-screen and in the extraction prompt (data/checklist-items.json).
export const CHECKLIST_ITEMS = await loadJson("./data/checklist-items.json");

// Accent color presets for the theme picker, each with light/dark variants
// (data/accent-presets.json).
export const ACCENT_PRESETS = await loadJson("./data/accent-presets.json");

// Per-view header text (eyebrow/title/subtitle) shown when switching
// between the intake/email/options views (data/view-meta.json).
export const VIEW_META = await loadJson("./data/view-meta.json");

// Central Visa Unit checklist PDF links, keyed by application type, used
// by the email writer (data/checklist-links.json).
export const CHECKLIST_LINKS = await loadJson("./data/checklist-links.json");

// Small standalone settings (data/app-config.json).
const APP_CONFIG = await loadJson("./data/app-config.json");
export const GEMINI_MODEL = APP_CONFIG.geminiModel;
export const CHECKLIST_STATUSES = APP_CONFIG.checklistStatuses;
