/* The case log table: rendering saved cases, CSV export, and full-fidelity
 * JSON backup/restore.
 *
 * CSV export drops the checklist verdicts and can't be re-imported; the
 * JSON backup keeps a full copy of the case log (including ids, so
 * re-importing the same backup twice doesn't create duplicates).
 */
import { el, escapeHtml, csvCell, makeStatusSetter } from "./utils.js";
import { state, persistLog } from "./state.js";
import { FIELDS, CHECKLIST_ITEMS } from "./config.js";
import { normalizeChecklist } from "./checklist.js";
// See record.js for the note on this being a deliberate circular import.
import { editCaseFromLog, renderRecord } from "./record.js";

const logBody = el("logBody");
const logCount = el("logCount");
const setLogStatus = makeStatusSetter("logStatus");

export function renderLog() {
  logCount.textContent = `${state.log.length} case${state.log.length === 1 ? "" : "s"}`;
  if (state.log.length === 0) {
    logBody.innerHTML = `<tr><td colspan="12" style="color:var(--muted); text-align:center;">No cases logged yet.</td></tr>`;
    return;
  }
  logBody.innerHTML = "";
  state.log.forEach((rec, idx) => {
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
    const keys = FIELDS.map(f => f.key);
    const header = [...keys, "checklist_issues"].join(",");
    const rows = state.log.map(rec => {
      const base = keys.map(k => csvCell(rec[k] || "")).join(",");
      const issues = (rec.checklist || [])
        .filter(c => c.status === "Non-compliant" || c.status === "Missing")
        .map(c => {
          const item = CHECKLIST_ITEMS.find(i => i.id === c.id);
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
          withId.checklist = normalizeChecklist(withId.checklist);
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

export function initCaseLog() {
  initCsvExport();
  initJsonBackup();
}
