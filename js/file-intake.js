/* Drag/drop + browse file intake: keeps state.files and its on-screen list
 * in sync, and persists each attachment to IndexedDB so it survives a
 * refresh (see files-db.js).
 */
import { el, escapeHtml } from "./utils.js";
import { state } from "./state.js";
import { saveFileToDB, deleteFileFromDB, clearFilesDB } from "./files-db.js";

const drop = el("drop");
const fileInput = el("fileInput");
const fileListEl = el("fileList");
const fileCountEl = el("fileCount");
const extractBtn = el("extractBtn");

function addFiles(fileListObj) {
  Array.from(fileListObj).forEach((file) => {
    const id = crypto.randomUUID();
    state.files.push({ id, file });
    saveFileToDB(id, file);
  });
  renderFileList();
}

export function renderFileList() {
  fileListEl.innerHTML = "";
  state.files.forEach(({ id, file }) => {
    const li = document.createElement("li");
    const kb = (file.size / 1024).toFixed(0);
    li.innerHTML = `<span class="name">${escapeHtml(file.name)}</span><span>${kb} kb</span>`;
    const rm = document.createElement("button");
    rm.textContent = "remove";
    rm.onclick = () => {
      state.files = state.files.filter(f => f.id !== id);
      deleteFileFromDB(id);
      renderFileList();
    };
    li.appendChild(rm);
    fileListEl.appendChild(li);
  });
  fileCountEl.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"}`;
  extractBtn.disabled = state.files.length === 0;
}

export function initFileIntake() {
  drop.addEventListener("click", () => fileInput.click());
  ["dragenter", "dragover"].forEach(evt =>
    drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.remove("drag"); })
  );
  drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  fileInput.addEventListener("change", (e) => addFiles(e.target.files));

  el("clearBtn").addEventListener("click", () => {
    state.files = [];
    clearFilesDB();
    renderFileList();
  });
}
