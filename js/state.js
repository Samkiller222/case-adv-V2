/* The one piece of mutable state shared across the whole app: the current
 * in-progress draft record/files, and the saved case log. Every module that
 * needs to read or change it imports this same `state` object — it's a
 * single shared reference, not a copy, so mutations made in one module are
 * immediately visible to the others.
 */

export const state = {
  files: [],            // [{id, file}] — documents attached to the current draft
  record: null,         // last extracted record (object keyed by FIELDS[].key), plus .checklist
  editingCaseId: null,  // set while editing a saved case log entry, so Save updates it instead of adding a new one
  log: JSON.parse(localStorage.getItem("case_log") || "[]")
    .map(c => c.id ? c : { ...c, id: crypto.randomUUID() }), // backfill ids for entries saved before edit support existed
};

// Persists state.log as-is. Centralized so every save/delete/import path
// writes it the same way instead of repeating the localStorage call.
export function persistLog() {
  localStorage.setItem("case_log", JSON.stringify(state.log));
}

persistLog(); // write back any id-backfilled entries immediately
