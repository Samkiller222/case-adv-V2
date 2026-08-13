/* Makes the page installable and caches its assets (including pdf.js) for
 * offline use, by registering sw.js.
 *
 * Registration silently fails on http/file:// or unsupported browsers —
 * extraction still works normally either way, this is a pure enhancement.
 */
export function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });

  // A new service worker taking control means a newer app build just
  // replaced what this tab is currently running on — reload once so the
  // tab actually gets it, instead of the fix silently sitting in the cache
  // until the user happens to close and reopen the page.
  let reloadedForNewSW = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForNewSW) return;
    reloadedForNewSW = true;
    window.location.reload();
  });
}
