/* Text extraction from PDFs, via pdf.js.
 *
 * pdf.js is loaded from a CDN via a plain <script> tag in index.html and
 * configured lazily here (rather than referencing the `pdfjsLib` global at
 * module-parse time) so that a blocked/failed CDN load (ad-blockers,
 * corporate proxies, a throttled background tab) only breaks PDF text
 * extraction when it's actually used — not the whole app at startup.
 */
export function extractPdfText(file) {
  if (typeof pdfjsLib === "undefined") {
    return Promise.reject(new Error("PDF reader (pdf.js) failed to load from its CDN — check your network/ad-blocker and reload the page. Image files still work."));
  }
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(reader.result) }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(it => it.str).join(" ") + "\n";
        }
        resolve(text);
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
