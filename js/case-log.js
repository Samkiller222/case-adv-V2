/* The case log table: rendering saved cases, CSV export, and full-fidelity
 * JSON backup/restore.
 *
 * CSV export drops the checklist verdicts and can't be re-imported; the
 * JSON backup keeps a full copy of the case log (including ids, so
 * re-importing the same backup twice doesn't create duplicates).
 */
import { el, escapeHtml, csvCell, makeStatusSetter } from "./utils.js";
import { state, persistLog } from "./state.js";
import { CHECKLISTS, getFields } from "./config.js";
import { getChecklistItems, normalizeChecklist } from "./checklist.js";
// See record.js for the note on this being a deliberate circular import.
import { editCaseFromLog, renderRecord } from "./record.js";

const logBody = el("logBody");
const logCount = el("logCount");
const setLogStatus = makeStatusSetter("logStatus");

// Search/dropdown filter state for the case log table. These only affect
// what's rendered — state.log itself (the source of truth) is never
// filtered or reordered, so edit/remove always act on the real entry.
const filters = { query: "", result: "", checklist: "" };

function matchesFilters(rec) {
  if (filters.query) {
    // A few extra criteria-specific fields (employer/job_title for
    // Employment, sports_club for Sports Trials) — harmless to include
    // all of them regardless of which criteria rec actually has, since
    // .filter(Boolean) drops whichever ones are undefined on it.
    const haystack = [rec.name, rec.surname, rec.passport_number, rec.employer, rec.job_title, rec.sports_club]
      .filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(filters.query)) return false;
  }
  if (filters.result) {
    if (filters.result === "__blank__") {
      if ((rec.result || "").trim()) return false;
    } else if ((rec.result || "") !== filters.result) {
      return false;
    }
  }
  if (filters.checklist) {
    const list = rec.checklist || [];
    const flagged = list.filter(c => c.status === "Non-compliant" || c.status === "Missing").length;
    if (filters.checklist === "none" && list.length) return false;
    if (filters.checklist === "clear" && (!list.length || flagged !== 0)) return false;
    if (filters.checklist === "issues" && flagged === 0) return false;
  }
  return true;
}

export function renderLog() {
  // Keep each row's original state.log index alongside it — filtering
  // must never renumber rows, since the edit/remove buttons below act on
  // that index against the real (unfiltered) log.
  const filtered = state.log
    .map((rec, idx) => ({ rec, idx }))
    .filter(({ rec }) => matchesFilters(rec));
  const filtersActive = !!(filters.query || filters.result || filters.checklist);

  logCount.textContent = filtersActive
    ? `${filtered.length} of ${state.log.length} case${state.log.length === 1 ? "" : "s"}`
    : `${state.log.length} case${state.log.length === 1 ? "" : "s"}`;

  if (state.log.length === 0) {
    logBody.innerHTML = `<tr><td colspan="12" style="color:var(--muted); text-align:center;">No cases logged yet.</td></tr>`;
    return;
  }
  if (filtered.length === 0) {
    logBody.innerHTML = `<tr><td colspan="12" style="color:var(--muted); text-align:center;">No cases match these filters.</td></tr>`;
    return;
  }
  logBody.innerHTML = "";
  filtered.forEach(({ rec, idx }) => {
    const tr = document.createElement("tr");
    const flagged = (rec.checklist || []).filter(c => c.status === "Non-compliant" || c.status === "Missing").length;
    const checklistCell = !rec.checklist || !rec.checklist.length
      ? `<span class="badge muted">n/a</span>`
      : flagged === 0
        ? `<span class="badge ok">clear</span>`
        : `<span class="badge err">${flagged} issue${flagged === 1 ? "" : "s"}</span>`;
    tr.innerHTML = `
      <td>${escapeHtml(rec.name || "")}</td>
      <td>${escapeHtml(rec.surname || "")}</td>
      <td>${escapeHtml(rec.gender || "")}</td>
      <td>${escapeHtml(rec.passport_number || "")}</td>
      <td>${escapeHtml(rec.date_appointment || "")}</td>
      <td>${escapeHtml(rec.aip_date || "")}</td>
      <td>${escapeHtml(rec.flight_date || "")}</td>
      <td>${escapeHtml(rec.employer || "")}</td>
      <td>${escapeHtml(rec.job_title || "")}</td>
      <td>${escapeHtml(rec.result || "")}</td>
      <td>${checklistCell}</td>
      <td>
        <button class="row-edit" data-idx="${idx}">edit</button>
        <button class="row-del" data-idx="${idx}">remove</button>
      </td>
    `;
    logBody.appendChild(tr);
  });
  logBody.querySelectorAll(".row-edit").forEach(btn => {
    btn.addEventListener("click", () => editCaseFromLog(Number(btn.dataset.idx)));
  });
  logBody.querySelectorAll(".row-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      if (state.log[idx] && state.log[idx].id === state.editingCaseId) {
        state.record = null;
        state.editingCaseId = null;
        renderRecord(false);
      }
      state.log.splice(idx, 1);
      persistLog();
      renderLog();
    });
  });
}

function initCsvExport() {
  el("exportBtn").addEventListener("click", () => {
    const setStatus = makeStatusSetter("status");
    if (state.log.length === 0) { setStatus("No cases to export yet.", true); return; }
    // The log can hold cases from more than one checklist, each with its
    // own field set — the CSV needs one fixed column set covering all of
    // them, so a given row just leaves criteria-specific columns it
    // doesn't have blank. Union preserves each checklist's field order,
    // Employment Visa's (the default, first-listed checklist) columns
    // appearing before any other checklist's own extra fields.
    const keys = [...new Set(CHECKLISTS.flatMap(c => getFields(c.id).map(f => f.key)))];
    const header = [...keys, "checklist_issues"].join(",");
    const rows = state.log.map(rec => {
      const base = keys.map(k => csvCell(rec[k] || "")).join(",");
      const items = getChecklistItems(rec.criteriaId);
      const issues = (rec.checklist || [])
        .filter(c => c.status === "Non-compliant" || c.status === "Missing")
        .map(c => {
          const item = items.find(i => i.id === c.id);
          const label = item ? item.label : c.id;
          return c.note ? `${label}: ${c.note}` : `${label} (${c.status})`;
        })
        .join("; ");
      return `${base},${csvCell(issues)}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `case-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function initJsonBackup() {
  el("exportJsonBtn").addEventListener("click", () => {
    if (state.log.length === 0) { setLogStatus("No cases to export yet.", true); return; }
    const payload = {
      format: "case-register-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      log: state.log,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `case-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLogStatus(`Exported ${state.log.length} case${state.log.length === 1 ? "" : "s"} as a JSON backup.`);
  });

  const importJsonInput = el("importJsonInput");
  el("importJsonBtn").addEventListener("click", () => importJsonInput.click());

  importJsonInput.addEventListener("change", () => {
    const file = importJsonInput.files[0];
    importJsonInput.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed.log) ? parsed.log : null;
        if (!incoming) throw new Error("This file doesn't look like a case log backup — expected a JSON array or an object with a \"log\" array.");

        const existingIds = new Set(state.log.map(c => c.id));
        let added = 0, skipped = 0;
        incoming.forEach(entry => {
          if (!entry || typeof entry !== "object") { skipped++; return; }
          const withId = entry.id ? entry : { ...entry, id: crypto.randomUUID() };
          if (existingIds.has(withId.id)) { skipped++; return; }
          // Older backups predate multi-checklist support and have no
          // criteriaId — normalizeChecklist falls back to the Employment
          // Visa checklist for those, matching what they were actually
          // checked against at the time.
          withId.checklist = normalizeChecklist(withId.checklist, withId.criteriaId);
          state.log.push(withId);
          existingIds.add(withId.id);
          added++;
        });

        persistLog();
        renderLog();
        setLogStatus(`Imported ${added} case${added === 1 ? "" : "s"}${skipped ? ` (${skipped} already present, skipped)` : ""}.`);
      } catch (err) {
        console.error(err);
        setLogStatus(err.message || "Couldn't read that file as a case log backup.", true);
      }
    };
    reader.onerror = () => setLogStatus("Couldn't read that file.", true);
    reader.readAsText(file);
  });
}

function initLogFilters() {
  const queryInput = el("logFilterQuery");
  const resultSelect = el("logFilterResult");
  const checklistSelect = el("logFilterChecklist");
  const clearBtn = el("logFilterClearBtn");

  // The result dropdown's options come from the same field config the
  // draft form uses, so it can never drift out of sync with real values.
  // "result" is a common field on every checklist, so any criteria's
  // field list has the same options — CHECKLISTS[0] (Employment Visa) is
  // just a convenient one to read it from.
  const resultField = getFields(CHECKLISTS[0].id).find(f => f.key === "result");
  const resultOptions = (resultField ? resultField.options : []).filter(Boolean);
  resultSelect.innerHTML = [
    '<option value="">All results</option>',
    '<option value="__blank__">Not set</option>',
    ...resultOptions.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`),
  ].join("");

  queryInput.addEventListener("input", () => {
    filters.query = queryInput.value.trim().toLowerCase();
    renderLog();
  });
  resultSelect.addEventListener("change", () => {
    filters.result = resultSelect.value;
    renderLog();
  });
  checklistSelect.addEventListener("change", () => {
    filters.checklist = checklistSelect.value;
    renderLog();
  });
  clearBtn.addEventListener("click", () => {
    filters.query = ""; filters.result = ""; filters.checklist = "";
    queryInput.value = ""; resultSelect.value = ""; checklistSelect.value = "";
    renderLog();
  });
}

export function initCaseLog() {
  initLogFilters();
  initCsvExport();
  initJsonBackup();
}
