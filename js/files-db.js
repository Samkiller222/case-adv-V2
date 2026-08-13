/* Persisted file attachments, via IndexedDB.
 *
 * File objects only live in memory, so attachments would vanish on any
 * page refresh unless their contents are stashed somewhere that survives
 * one. IndexedDB (not localStorage) because it stores Blobs directly and
 * isn't bound by localStorage's ~5-10MB string-only quota — a few scanned
 * PDFs or photos would blow past that fast.
 */
const FILES_DB_NAME = "case_register_files";
const FILES_STORE = "pending_files";

function openFilesDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("IndexedDB unavailable")); return; }
    const req = indexedDB.open(FILES_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(FILES_STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFileToDB(id, file) {
  try {
    const db = await openFilesDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).put({ id, name: file.name, type: file.type, blob: file });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.error("Couldn't persist attachment:", e); }
}

export async function deleteFileFromDB(id) {
  try {
    const db = await openFilesDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.error("Couldn't remove persisted attachment:", e); }
}

export async function clearFilesDB() {
  try {
    const db = await openFilesDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.error("Couldn't clear persisted attachments:", e); }
}

export async function loadFilesFromDB() {
  try {
    const db = await openFilesDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readonly");
      const req = tx.objectStore(FILES_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return records.map(r => ({ id: r.id, file: new File([r.blob], r.name, { type: r.type }) }));
  } catch (e) {
    console.error("Couldn't restore persisted attachments:", e);
    return [];
  }
}
