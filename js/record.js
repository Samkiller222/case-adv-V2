/* The draft record panel: rendering the extracted fields as an editable
 * form, and saving/loading them to and from the case log.
 */
import { el, makeStatusSetter } from "./utils.js";
import { state, persistLog } from "./state.js";
import { FIELDS } from "./config.js";
import { renderChecklist } from "./checklist.js";
import { renderFileList } from "./file-intake.js";
import { clearFilesDB } from "./files-db.js";
// renderLog lives in case-log.js, which in turn calls editCaseFromLog
// (exported below) for its "edit" buttons — a deliberate circular import.
// Both sides only reference the other's export from inside event handlers
// (never at module load time), which ES modules resolve safely.
import { renderLog } from "./case-log.js";
import { switchView } from "./menu.js";
// See criteria.js for the note on this being a deliberate circular import.
import { getCriteriaId } from "./criteria.js";

const recordBody = el("recordBody");
const recordTag = el("recordTag");
const setStatus = makeStatusSetter("status");

export function renderRecord(justExtracted) {
  // A record keeps the checklist it was actually extracted against; with
  // no record yet, preview whichever checklist is currently selected in
  // the intake dropdown so the panel always names what it's showing.
  renderChecklist(state.record ? state.record.checklist : null, state.record ? state.record.criteriaId : getCriteriaId());

  if (state.record) {
    recordTag.textContent = state.editingCaseId
      ? "Editing saved case"
      : (state.record.uncertain || "").trim() ? "Draft — check uncertainty notes" : "Draft — review";
  } else {
    recordTag.textContent = "Unverified";
  }
  if (!state.record) {
    recordBody.innerHTML = `<div class="empty-state"><img class="mark" src="icons/logo.png" alt="">Extracted fields will appear here for review once documents are processed.</div>`;
    return;
  }

  const wrap = document.createElement("div");
  if (justExtracted) wrap.className = "stamped";

  const grid = document.createElement("div");
  grid.className = "fields-grid";

  FIELDS.forEach(f => {
    const field = document.createElement("div");
    field.className = "field" + (f.full ? " full" : "");
    const label = document.createElement("label");
    label.textContent = f.label;
    field.appendChild(label);

    let input;
    if (f.type === "select") {
      input = document.createElement("select");
      f.options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt; o.textContent = opt || "—";
        if ((state.record[f.key] || "") === opt) o.selected = true;
        input.appendChild(o);
      });
    } else if (f.type === "textarea") {
      input = document.createElement("textarea");
      input.value = state.record[f.key] || "";
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = state.record[f.key] || "";
    }
    input.addEventListener("input", () => { state.record[f.key] = input.value; });
    field.appendChild(input);
    grid.appendChild(field);
  });

  wrap.appendChild(grid);

  const actions = document.createElement("div");
  actions.className = "actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = state.editingCaseId ? "Update case" : "Save to case log";
  saveBtn.onclick = saveToLog;
  const discardBtn = document.createElement("button");
  discardBtn.className = "btn secondary";
  discardBtn.textContent = state.editingCaseId ? "Cancel edit" : "Discard draft";
  discardBtn.onclick = () => { state.record = null; state.editingCaseId = null; renderRecord(false); };
  actions.appendChild(saveBtn);
  actions.appendChild(discardBtn);
  wrap.appendChild(actions);

  recordBody.innerHTML = "";
  recordBody.appendChild(wrap);
}

function saveToLog() {
  const wasEditing = !!state.editingCaseId;
  if (wasEditing) {
    const idx = state.log.findIndex(c => c.id === state.editingCaseId);
    if (idx !== -1) {
      state.log[idx] = { ...state.record, id: state.editingCaseId, savedAt: state.log[idx].savedAt, updatedAt: new Date().toISOString() };
    } else {
      // the entry was removed from the log while it was being edited — save it as a new one instead of losing the edits
      state.log.push({ ...state.record, id: crypto.randomUUID(), savedAt: new Date().toISOString() });
    }
  } else {
    state.log.push({ ...state.record, id: crypto.randomUUID(), savedAt: new Date().toISOString() });
  }
  persistLog();
  state.record = null;
  state.editingCaseId = null;
  state.files = [];
  clearFilesDB();
  renderFileList();
  renderRecord(false);
  renderLog();
  setStatus(wasEditing ? "Case updated." : "Saved to case log.");
}

export function editCaseFromLog(idx) {
  const entry = state.log[idx];
  if (!entry) return;
  const { id, savedAt, updatedAt, ...recordFields } = entry;
  state.record = recordFields;
  state.editingCaseId = id;
  state.files = [];
  renderFileList();
  renderRecord(false);
  switchView("intake");
  setStatus(`Editing ${(entry.name || entry.surname) ? `${entry.name || ""} ${entry.surname || ""}`.trim() : "case"} — make your changes, then "Update case" (or "Cancel edit" to leave it as-is).`);
}
