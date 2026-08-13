/* Statistics view: simple proportional bar breakdowns of the case log —
 * final decisions (the `result` field), employers, and job titles.
 *
 * Bars are drawn as a single accent-colored fill (never a rainbow of
 * per-category hues, since there's no legend here and hue would carry no
 * extra meaning beyond what the label text already says) with the bar
 * width set to that category's literal share of all logged cases, so the
 * bars are directly comparable to each other and sum to the total.
 */
import { el, escapeHtml } from "./utils.js";
import { state } from "./state.js";

const caseCountTag = el("statsCaseCount");
const decisionsBody = el("statsDecisions");
const employersBody = el("statsEmployers");
const jobTitlesBody = el("statsJobTitles");

// Groups records by a field, blank/missing values collapsed into one
// labeled bucket, sorted most common first.
function countBy(records, getValue, emptyLabel) {
  const counts = new Map();
  records.forEach(rec => {
    const raw = (getValue(rec) || "").toString().trim();
    const label = raw || emptyLabel;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function renderBreakdown(container, rows, total) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state"><img class="mark" src="icons/logo.png" alt="">Statistics will appear here once you've saved at least one case.</div>`;
    return;
  }

  const list = document.createElement("div");
  // A long tail of distinct employers/job titles shouldn't push the rest
  // of the page down — scroll internally once there are more than a
  // handful of rows.
  list.className = "stat-list" + (rows.length > 8 ? " scroll" : "");

  rows.forEach(([label, count]) => {
    const pct = total ? Math.round((count / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `
      <div class="stat-row-head">
        <span class="stat-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <span class="stat-count">${count} (${pct}%)</span>
      </div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
    `;
    list.appendChild(row);
  });

  container.innerHTML = "";
  container.appendChild(list);
}

// Recomputed on every visit to the Statistics view (see menu.js) rather
// than cached, since the case log can change between visits.
export function renderStatistics() {
  const total = state.log.length;
  caseCountTag.textContent = `${total} case${total === 1 ? "" : "s"}`;

  renderBreakdown(decisionsBody, countBy(state.log, rec => rec.result, "Pending / not set"), total);
  renderBreakdown(employersBody, countBy(state.log, rec => rec.employer, "Not specified"), total);
  renderBreakdown(jobTitlesBody, countBy(state.log, rec => rec.job_title, "Not specified"), total);
}
