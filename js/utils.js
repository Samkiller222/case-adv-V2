/* Small, dependency-free helpers shared across modules. */

export const el = (id) => document.getElementById(id);

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function csvCell(v) {
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Every panel has its own status line (intake, case log, email writer) that
// all behave the same way — plain text plus an optional error style. This
// factory replaces three near-identical setStatus/setLogStatus/setEmailStatus
// functions with one, bound to whichever element id you give it.
export function makeStatusSetter(elementId) {
  const node = el(elementId);
  return function setStatus(msg, isErr) {
    node.textContent = msg;
    node.className = "status" + (isErr ? " err" : "");
  };
}
