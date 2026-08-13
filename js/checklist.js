/* Checklist compliance: normalizing whatever the extraction engine returns
 * into a fixed shape, and rendering the expandable checklist panel with
 * manual status/reason overrides.
 */
import { el } from "./utils.js";
import { CHECKLIST_ITEMS, CHECKLIST_STATUSES } from "./config.js";

const checklistBody = el("checklistBody");
const checklistTag = el("checklistTag");

// The engine (home server or Gemini) returns a checklist array shaped
// however it likes — this pins it to exactly one entry per known item, in
// a known order, with a valid status, regardless of what came back.
export function normalizeChecklist(raw) {
  const byId = new Map((Array.isArray(raw) ? raw : []).map(c => [c && c.id, c]));
  return CHECKLIST_ITEMS.map(item => {
    const found = byId.get(item.id) || {};
    const status = CHECKLIST_STATUSES.includes(found.status) ? found.status : "Missing";
    return { id: item.id, status, note: (found.note || "").toString() };
  });
}

function checklistBadgeClass(status) {
  return { Compliant: "ok", "Non-compliant": "err", Missing: "warn", "Not applicable": "muted" }[status] || "muted";
}

export function renderChecklist(checklist) {
  if (!checklist || !checklist.length) {
    checklistTag.textContent = "Not checked";
    checklistTag.className = "tag";
    checklistBody.innerHTML = `<div class="empty-state"><img class="mark" src="icons/logo.png" alt="">Compliance against the Employment Visa document checklist will appear here after extraction.</div>`;
    return;
  }

  function updateChecklistTag() {
    const flagged = checklist.filter(c => c.status === "Non-compliant" || c.status === "Missing").length;
    checklistTag.textContent = flagged === 0 ? "All clear" : `${flagged} issue${flagged === 1 ? "" : "s"}`;
    checklistTag.className = "tag " + (flagged === 0 ? "ok" : "err");
  }
  updateChecklistTag();

  const list = document.createElement("div");
  list.className = "checklist-list";
  checklist.forEach(c => {
    const item = CHECKLIST_ITEMS.find(i => i.id === c.id);

    const row = document.createElement("div");
    row.className = "checklist-item expandable";

    const badge = document.createElement("span");
    badge.className = `badge ${checklistBadgeClass(c.status)}`;
    badge.textContent = c.status;

    const head = document.createElement("button");
    head.type = "button";
    head.className = "checklist-item-head";
    head.setAttribute("aria-expanded", "false");
    const label = document.createElement("span");
    label.className = "checklist-label";
    label.textContent = item ? item.label : c.id;
    const right = document.createElement("span");
    right.className = "checklist-item-right";
    right.appendChild(badge);
    right.insertAdjacentHTML("beforeend", `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`);
    head.appendChild(label);
    head.appendChild(right);
    head.addEventListener("click", () => {
      const expanded = row.classList.toggle("expanded");
      head.setAttribute("aria-expanded", String(expanded));
    });
    row.appendChild(head);

    const edit = document.createElement("div");
    edit.className = "checklist-edit";

    const statusLabel = document.createElement("label");
    statusLabel.className = "field-label";
    statusLabel.textContent = "Status — you can override this";
    const statusSelect = document.createElement("select");
    CHECKLIST_STATUSES.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = s;
      if (c.status === s) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener("change", () => {
      c.status = statusSelect.value;
      badge.className = `badge ${checklistBadgeClass(c.status)}`;
      badge.textContent = c.status;
      updateChecklistTag();
    });

    const noteLabel = document.createElement("label");
    noteLabel.className = "field-label";
    noteLabel.style.marginTop = "10px";
    noteLabel.textContent = "Reason";
    const noteInput = document.createElement("textarea");
    noteInput.placeholder = "Why? (e.g. what's missing or doesn't meet the requirement)";
    noteInput.value = c.note || "";
    noteInput.addEventListener("input", () => { c.note = noteInput.value; });

    edit.appendChild(statusLabel);
    edit.appendChild(statusSelect);
    edit.appendChild(noteLabel);
    edit.appendChild(noteInput);
    row.appendChild(edit);

    list.appendChild(row);
  });
  checklistBody.innerHTML = "";
  checklistBody.appendChild(list);
}
