/* The intake panel's checklist-criteria dropdown: which Central Visa Unit
 * checklist new extractions get checked against (Employment Visa, Sports
 * Trials Visa, and whatever future checklists get added to
 * data/checklists.json — this module never hardcodes the list).
 *
 * Only affects extractions run *after* a change — an already-extracted
 * draft (or a saved case) keeps the checklist it was actually checked
 * against (see js/checklist.js's getChecklist), so switching this dropdown
 * never silently reinterprets an existing record.
 */
import { el } from "./utils.js";
import { CHECKLISTS } from "./config.js";
// record.js's renderRecord needs getCriteriaId() (to preview the selected
// checklist's name before anything has been extracted yet), and this
// module's change handler needs renderRecord() to refresh that preview —
// a deliberate circular import, safe for the same reason as the
// record.js/case-log.js one (see the comment there): both sides only call
// the other's export from inside an event handler, never at module load.
import { renderRecord } from "./record.js";

const criteriaSelect = el("criteriaSelect");

export function getCriteriaId() {
  return criteriaSelect.value;
}

export function initCriteria() {
  criteriaSelect.innerHTML = CHECKLISTS
    .map(c => `<option value="${c.id}">${c.label}</option>`)
    .join("");
  criteriaSelect.value = localStorage.getItem("case_register_criteria") || CHECKLISTS[0].id;

  criteriaSelect.addEventListener("change", () => {
    localStorage.setItem("case_register_criteria", getCriteriaId());
    // Only visible effect on a change: if there's no draft yet, the
    // checklist panel's "which checklist" preview tag should track the
    // new selection. renderRecord(false) is safe to call unconditionally
    // either way — it's a no-op re-render of whatever's already showing.
    renderRecord(false);
  });
}
