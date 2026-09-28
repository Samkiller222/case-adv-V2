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

// Extracted-record form fields common to every case, split into the
// identity block shown first (name/surname/gender/passport) and the
// tracking block shown last (result/comments/uncertain) — everything in
// between is criteria-specific (see getFields below) (data/fields.json).
const COMMON_FIELDS = await loadJson("./data/fields.json");

// Every checklist the app can verify documents against — Malta CVU's
// "Documentation Required for ... Visa" series. Each entry is
// { id, label, title, version, fields, items }: items is the compliance
// checklist (id, display label, criteria text) used both on-screen and in
// the extraction prompt; fields are the extra draft-record boxes specific
// to that checklist (e.g. Sports Trials tracks a sports club and trial
// duration instead of Employment's AIP/flight dates and job details)
// (data/checklists.json). Which one applies to a given case is chosen via
// the intake panel's checklist dropdown (see js/criteria.js) and stored
// per-record, since a saved case always keeps the checklist — and field
// set — it was actually extracted with.
export const CHECKLISTS = await loadJson("./data/checklists.json");

// The full set of draft-record fields for a given checklist: the common
// identity fields, then that checklist's own fields, then the common
// tracking fields. Unknown/missing criteriaId falls back to the first
// checklist (Employment Visa), same as js/checklist.js's getChecklist —
// this reconstructs exactly the original fixed field list for records
// that predate multi-checklist support.
export function getFields(criteriaId) {
  const checklist = CHECKLISTS.find(c => c.id === criteriaId) || CHECKLISTS[0];
  return [...COMMON_FIELDS.prefix, ...checklist.fields, ...COMMON_FIELDS.suffix];
}

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
