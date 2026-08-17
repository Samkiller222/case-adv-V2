/* Entry point. Loaded as <script type="module">, so this (and every module
 * it imports) only runs after the document has been parsed — DOM lookups
 * throughout these modules don't need to wait for DOMContentLoaded.
 *
 * Import order below doesn't affect execution order for the init*() calls
 * (that's controlled explicitly, mirroring the original single-file app's
 * top-to-bottom layout); it only needs to be valid dependency order for the
 * module graph, which ES modules resolve on their own.
 */
import "./state.js"; // loading it is enough to run the log-id backfill + persist
import { initServiceWorker } from "./pwa.js";
import { initTheme } from "./theme.js";
import { initEngineSettings } from "./engine-settings.js";
import { initCriteria } from "./criteria.js";
import { initMenu, switchView } from "./menu.js";
import { initFileIntake, renderFileList } from "./file-intake.js";
import { initExtraction } from "./extraction.js";
import { initCaseLog, renderLog } from "./case-log.js";
import { initEmailWriter } from "./email-writer.js";
import { renderRecord } from "./record.js";
import { loadFilesFromDB } from "./files-db.js";
import { state } from "./state.js";
import { makeStatusSetter } from "./utils.js";

initServiceWorker();
initEngineSettings();
initCriteria();
initTheme();
initMenu();
initFileIntake();
initExtraction();
initCaseLog();
initEmailWriter();

// initial render
renderFileList();
renderRecord(false);
renderLog();
switchView("intake");

// Restore any documents still attached from before the last refresh.
loadFilesFromDB().then(restored => {
  if (!restored.length) return;
  state.files = restored;
  renderFileList();
  makeStatusSetter("status")(`Restored ${restored.length} document${restored.length === 1 ? "" : "s"} from before the page was refreshed.`);
});
