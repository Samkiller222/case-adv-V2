/* Runs document extraction against whichever engine is selected in
 * Options (home server or Gemini), and renders the result into the draft
 * record panel on success.
 */
import { el, fileToBase64, makeStatusSetter } from "./utils.js";
import { state } from "./state.js";
import { getFields } from "./config.js";
import { getEngineMode, getApiKey, getHomeUrl, getHomeToken, getGeminiModel, callGemini } from "./engine-settings.js";
import { getCriteriaId } from "./criteria.js";
import { extractPdfText } from "./pdf-extract.js";
import { getChecklist, getChecklistItems, normalizeChecklist } from "./checklist.js";
import { renderRecord } from "./record.js";

const extractBtn = el("extractBtn");
const setStatus = makeStatusSetter("status");

async function runExtraction() {
  if (getEngineMode() === "home") {
    return runExtractionViaHomeServer();
  }
  return runExtractionViaGemini();
}

async function runExtractionViaHomeServer() {
  const url = getHomeUrl();
  const token = getHomeToken();
  if (!url) {
    setStatus("Enter your home server URL first.", true);
    return;
  }
  if (!token) {
    setStatus("Enter your home server token first.", true);
    return;
  }
  const criteriaId = getCriteriaId();
  extractBtn.disabled = true;
  setStatus("Sending documents to home server…");

  try {
    const formData = new FormData();
    state.files.forEach(({ file }) => formData.append("files", file, file.name));
    // Forward-compatible hint for home servers that know how to use it —
    // an unmodified server just ignores an unknown field. Either way, the
    // response is normalized against this checklist client-side, so the
    // record is always labeled correctly regardless of what the server
    // actually checked.
    formData.append("criteria", criteriaId);

    const resp = await fetch(`${url.replace(/\/$/, "")}/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || `Home server error ${resp.status}`);
    }

    const parsed = await resp.json();
    parsed.criteriaId = criteriaId;
    parsed.checklist = normalizeChecklist(parsed.checklist, criteriaId);
    state.record = parsed;
    renderRecord(true);
    setStatus(`Extracted from ${state.files.length} document${state.files.length === 1 ? "" : "s"} (home server). Review before saving.`);
  } catch (err) {
    console.error(err);
    const msg = /Failed to fetch|NetworkError/i.test(err.message || "")
      ? "Can't reach the home server — check it's on and connected, or switch to Gemini fallback above."
      : (err.message || "Extraction failed.");
    setStatus(msg, true);
  } finally {
    extractBtn.disabled = state.files.length === 0;
  }
}

function buildExtractionInstruction(criteriaId) {
  const fields = getFields(criteriaId);
  const fieldKeys = fields.map(f => f.key).join(", ");
  const hasField = (key) => fields.some(f => f.key === key);
  const checklist = getChecklist(criteriaId);

  // Field-specific guidance only makes sense for fields this checklist
  // actually has — a Sports Trials extraction is never asked about
  // skills_pass, and an Employment one is never asked about sports_club.
  const bullets = ['- gender must be "Male", "Female", or "" if unclear.'];
  if (hasField("skills_pass") || hasField("pre_departure")) {
    bullets.push(`- skills_pass and pre_departure are TWO SEPARATE things that are easy to confuse — read carefully:
  - skills_pass = "Yes" if you see any "Skills Pass" branded certificate — the interlocking diamond/arrow Skills Pass logo and/or "Skills Pass" wording in the title (e.g. "Certificate of Skills Pass Achievement"). This can be issued by different bodies with different layouts (e.g. "Skills Pass Malta" with an ISSUE DATE/RECIPIENT/ISSUER layout, or "Institute of Tourism Studies - Malta" with a Full Name/Candidate Number/Job Family/Level layout, or others) — issuer and layout vary, the Skills Pass branding is the constant. Note: its batch or course name may itself contain the word "predeparture" (e.g. "Phase 2 predeparture batch 11") — that is just naming a training session/batch, it does NOT mean this document belongs to pre_departure. If the document has Skills Pass branding, set skills_pass, not pre_departure, regardless of that wording.
  - pre_departure = "Yes" only if you see a "PRE-DEPARTURE COURSE — Certificate of Achievement" issued by the Government of Malta (Ministry for Home Affairs, Security and Employment), listing specific course topics (e.g. language, hygiene, culture, transport). If you see this document type, set pre_departure, not skills_pass.
  - Each is "No" or "Not required" only if stated as such in a document; "" if neither document type is present at all.`);
  }
  if (hasField("financial_means")) {
    bullets.push('- financial_means = "Yes" if the documents show sufficient funds for the whole stay plus repatriation costs (at least 75% of the national minimum wage per month of stay), "No" if shown but insufficient, "Not required" only if stated as such, or "" if not addressed at all.');
  }
  bullets.push('- result must be one of "passed", "email sent", "email received", "refused", "sent to interview", or "" if not stated.');
  if (hasField("insurance")) {
    bullets.push('- insurance is the insurance policy START DATE (matches the format of a date field in the source form) — do NOT put the insurance company/provider name here, only a date.');
  }
  if (hasField("insurance_expiry")) {
    bullets.push('- insurance_expiry is the insurance policy EXPIRY date, same rule.');
  }
  if (hasField("sports_club")) {
    bullets.push('- sports_club is the name of the national sports club or federation issuing the invitation letter.');
  }
  if (hasField("trial_duration")) {
    bullets.push('- trial_duration is the planned duration and/or nature of the trial as stated in the invitation letter (e.g. specific dates, or a length like "2 weeks").');
  }
  bullets.push("- Dates: use whatever format appears in the source document; do not invent a date that isn't present.");
  bullets.push("- If a field is not present in any document, return an empty string for it — never guess or fabricate.");
  bullets.push("- comments: a short note on anything relevant you noticed (e.g. discrepancies, missing documents) — not a restatement of the other fields.");
  bullets.push('- uncertain: separate from comments. List each field you were NOT confident about and why — e.g. handwriting was hard to read, two documents gave conflicting dates, a value was inferred rather than directly stated. Leave this empty ("") only if you\'re confident in every field you filled in.');

  return `You are helping a visa case officer draft a case record from supporting documents.
Read all the documents provided (text and/or images — passport pages, employer letters, appointment or flight confirmations, insurance certificates, etc.).
Extract only what these documents actually state. Return ONLY a JSON object, no markdown fences, no commentary, with exactly these keys:
${fieldKeys}.
${bullets.join("\n")}

Additionally, check the uploaded documents against Malta's Central Visa Unit "${checklist.title}" checklist below. Return a "checklist" array in the JSON with exactly one entry per item, in this order, each an object with keys "id", "status", "note":
${getChecklistItems(criteriaId).map((c, i) => `${i + 1}. id="${c.id}" — ${c.label}: ${c.criteria}`).join("\n")}

For each item, set "status" to exactly one of:
- "Compliant": a document satisfying this item is present and meets the stated criteria.
- "Non-compliant": a relevant document is present but fails to meet the stated criteria — say specifically why in "note" (e.g. which figure, date, or detail falls short).
- "Missing": no document addressing this item was provided at all.
- "Not applicable": the item doesn't apply to this case (e.g. skills_pass when the applicant isn't in tourism/hospitality; the fees item, which is always "Not applicable" since it's a payment, not a document).
"note" should be one short sentence citing the specific shortfall for "Non-compliant", or a brief reason for "Missing"/"Not applicable". Leave it empty ("") for "Compliant" unless there's a minor caveat worth flagging. Base every verdict only on what the documents actually show — never assume compliance for a document that wasn't provided.`;
}

async function runExtractionViaGemini() {
  const key = getApiKey();
  if (!key) {
    setStatus("Enter your Gemini API key first.", true);
    return;
  }
  const criteriaId = getCriteriaId();
  extractBtn.disabled = true;
  setStatus("Reading documents…");

  try {
    const parts = [];
    for (const { file } of state.files) {
      if (file.type === "application/pdf") {
        const text = await extractPdfText(file);
        if (text.trim().length > 40) {
          parts.push({ text: `--- Document: ${file.name} (PDF text) ---\n${text}` });
        } else {
          // no embedded text layer (likely scanned) — send the PDF itself,
          // Gemini reads PDFs natively including scanned pages
          const base64 = await fileToBase64(file);
          parts.push({ text: `--- Document: ${file.name} (scanned PDF) ---` });
          parts.push({ inline_data: { mime_type: "application/pdf", data: base64 } });
        }
      } else if (file.type.startsWith("image/")) {
        const base64 = await fileToBase64(file);
        parts.push({ text: `--- Document: ${file.name} (image) ---` });
        parts.push({ inline_data: { mime_type: file.type, data: base64 } });
      }
    }

    setStatus(`Extracting fields with ${getGeminiModel()}…`);

    const body = {
      contents: [{ role: "user", parts: [{ text: buildExtractionInstruction(criteriaId) }, ...parts] }],
      generationConfig: { responseMimeType: "application/json" },
    };

    const { data, model } = await callGemini(body);
    const rawText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
    if (!rawText) throw new Error("No text in response — the model may have blocked the content or returned nothing.");

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    parsed.criteriaId = criteriaId;
    parsed.checklist = normalizeChecklist(parsed.checklist, criteriaId);

    state.record = parsed;
    renderRecord(true);
    setStatus(`Extracted from ${state.files.length} document${state.files.length === 1 ? "" : "s"}. Review before saving.${model !== getGeminiModel() ? ` (${getGeminiModel()} was busy — used ${model}.)` : ""}`);
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Extraction failed.", true);
  } finally {
    extractBtn.disabled = state.files.length === 0;
  }
}

export function initExtraction() {
  extractBtn.addEventListener("click", runExtraction);
}
