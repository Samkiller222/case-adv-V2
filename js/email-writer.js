/* Email writer: drafts a document-revision request, either from a fixed
 * template built from the current case's checklist findings, or with an
 * AI-rewritten version of those findings via the selected extraction
 * engine (same engine used for document extraction).
 *
 * Ported from the standalone CVU Revision Email Writer, wired to read the
 * current case's extracted fields and checklist verdicts.
 */
import { el, makeStatusSetter } from "./utils.js";
import { state } from "./state.js";
import { CHECKLIST_LINKS } from "./config.js";
import { getEngineMode, getHomeUrl, getHomeToken, callGemini } from "./engine-settings.js";
import { getChecklistItems } from "./checklist.js";

const emailApplicantName = el("emailApplicantName");
const emailPassportNumber = el("emailPassportNumber");
const emailSalutation = el("emailSalutation");
const emailAppTypeRadios = document.querySelectorAll('input[name="emailAppType"]');
const emailBulletsContainer = el("emailBulletsContainer");
const emailAddBulletBtn = el("emailAddBulletBtn");
const emailSubjectReadout = el("emailSubjectReadout");
const emailOutput = el("emailOutput");
const emailCopySubjectBtn = el("emailCopySubjectBtn");
const emailCopyBodyBtn = el("emailCopyBodyBtn");
const emailCaseTag = el("emailCaseTag");
const emailLoadCaseBtn = el("emailLoadCaseBtn");
const emailGenerateFindingsBtn = el("emailGenerateFindingsBtn");
const setEmailStatus = makeStatusSetter("emailStatus");

function getEmailAppType() {
  return document.querySelector('input[name="emailAppType"]:checked').value;
}

function autoResizeTextarea(node) {
  node.style.height = "auto";
  node.style.height = node.scrollHeight + "px";
}

function createEmailBulletRow(value) {
  const row = document.createElement("div");
  row.className = "bullet-row";

  const input = document.createElement("textarea");
  input.rows = 1;
  input.placeholder = "Describe the issue found...";
  input.value = value || "";
  input.addEventListener("input", () => { autoResizeTextarea(input); renderEmail(); });

  const removeBtn = document.createElement("button");
  removeBtn.className = "icon-btn";
  removeBtn.type = "button";
  removeBtn.innerHTML = "&times;";
  removeBtn.title = "Remove";
  removeBtn.addEventListener("click", () => { row.remove(); renderEmail(); });

  row.appendChild(input);
  row.appendChild(removeBtn);
  requestAnimationFrame(() => autoResizeTextarea(input));
  return row;
}

function addEmailBullet(value) {
  emailBulletsContainer.appendChild(createEmailBulletRow(value));
}

function getEmailBulletValues() {
  return Array.from(emailBulletsContainer.querySelectorAll("textarea"))
    .map(i => i.value.trim())
    .filter(v => v.length > 0);
}

function buildEmailSubject() {
  const name = emailApplicantName.value.trim();
  const passport = emailPassportNumber.value.trim();
  if (!name && !passport) return "";
  let subj = "Visa Application Revision Required";
  if (name) subj += ` – ${name}`;
  if (passport) subj += ` (Passport No. ${passport})`;
  return subj;
}

function buildEmailBody() {
  const name = emailApplicantName.value.trim();
  const title = emailSalutation.value.trim();
  let greeting;
  if (title && name) greeting = `${title} ${name}`;
  else if (name) greeting = name;
  else if (title) greeting = title;
  else greeting = "XXXXXXXX";

  const bullets = getEmailBulletValues();
  const bulletText = bullets.length
    ? bullets.map(b => `* ${b}`).join("\n\n \n\n")
    : "* XXXXXXXX \n\n \n\n* XXXXXXXX \n\n \n\n* XXXXXXXX \n\n \n\n* XXXXXXXX";

  const appType = getEmailAppType();
  const link = CHECKLIST_LINKS[appType];
  const subjectReminder = appType === "employment"
    ? "\n\nAny correspondence should include name and passport number of applicant in the subject."
    : "";

  return `Dear ${greeting},

Whilst reviewing your application it was noted that:

${bulletText}

Kindly provide us with a revised document that meets CVU's checklist requirements as found on the following link ${link}

Your feedback is required within five working days from the date of this email. Kindly note that no reminders will be sent and that no further revisions will be allowed.

If you fail to provide the necessary requested information within this timeframe, your visa application outcome will be negatively impacted.${subjectReminder}

Kind Regards,`;
}

function renderEmail() {
  const subject = buildEmailSubject();
  emailSubjectReadout.textContent = subject || "Subject will appear here";
  emailOutput.value = buildEmailBody();
}

function flashCopied(btn) {
  const original = btn.textContent;
  btn.textContent = "Copied!";
  btn.classList.add("ok-flash");
  setTimeout(() => { btn.textContent = original; btn.classList.remove("ok-flash"); }, 1200);
}

function describeChecklistFinding(entry, criteriaId) {
  const item = getChecklistItems(criteriaId).find(i => i.id === entry.id);
  const label = item ? item.label : entry.id;
  if (entry.status === "Missing") {
    return `${label} was not included in the documents submitted.`;
  }
  return `${label}: ${entry.note || "does not meet the checklist requirements."}`;
}

// Pulls the current case's applicant details and any Non-compliant/Missing
// checklist findings into the email form. Exported so menu.js can call it
// the first time the Email writer view is opened.
export function loadCaseIntoEmail() {
  const rec = state.record;
  const fullName = rec ? [rec.name, rec.surname].filter(Boolean).join(" ") : "";
  emailApplicantName.value = fullName;
  emailPassportNumber.value = rec ? (rec.passport_number || "") : "";
  emailSalutation.value = rec && rec.gender === "Male" ? "Mr." : rec && rec.gender === "Female" ? "Ms." : "";

  emailBulletsContainer.innerHTML = "";
  const issues = rec ? (rec.checklist || []).filter(c => c.status === "Non-compliant" || c.status === "Missing") : [];
  if (issues.length) {
    issues.forEach(entry => addEmailBullet(describeChecklistFinding(entry, rec.criteriaId)));
  } else {
    for (let i = 0; i < 4; i++) addEmailBullet();
  }

  if (rec) {
    const fileNote = state.files.length ? `, ${state.files.length} document${state.files.length === 1 ? "" : "s"} attached` : "";
    emailCaseTag.textContent = `${fullName || "Case"} loaded${fileNote}`;
    emailCaseTag.className = "tag ok";
  } else {
    emailCaseTag.textContent = "No case loaded";
    emailCaseTag.className = "tag";
  }

  renderEmail();
}

function getCurrentChecklistIssues() {
  const rec = state.record;
  return rec ? (rec.checklist || []).filter(c => c.status === "Non-compliant" || c.status === "Missing") : [];
}

function issuesForPrompt(issues, criteriaId) {
  const items = getChecklistItems(criteriaId);
  return issues.map(entry => {
    const item = items.find(i => i.id === entry.id);
    return { id: entry.id, label: item ? item.label : entry.id, status: entry.status, note: entry.note || "" };
  });
}

async function generateFindingsWithAI() {
  const issues = getCurrentChecklistIssues();
  if (!state.record) {
    setEmailStatus("Load a case first (or add findings manually).", true);
    return;
  }
  if (!issues.length) {
    setEmailStatus("No compliance issues on the current case — nothing to generate wording for.", true);
    return;
  }

  emailGenerateFindingsBtn.disabled = true;
  setEmailStatus("Generating findings…");

  try {
    const applicant = {
      name: emailApplicantName.value.trim(),
      passport_number: emailPassportNumber.value.trim(),
    };
    const promptIssues = issuesForPrompt(issues, state.record.criteriaId);
    let findings;

    if (getEngineMode() === "home") {
      const url = getHomeUrl();
      const token = getHomeToken();
      if (!url) throw new Error("Enter your home server URL in Options first.");
      if (!token) throw new Error("Enter your home server token in Options first.");

      const resp = await fetch(`${url.replace(/\/$/, "")}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ applicant, issues: promptIssues }),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `Home server error ${resp.status} (does it implement /findings?)`);
      }
      const data = await resp.json();
      findings = Array.isArray(data.findings) ? data.findings : [];
    } else {
      const issuesText = promptIssues
        .map((e, i) => `${i + 1}. ${e.label} — status: ${e.status}${e.note ? `; note: ${e.note}` : ""}`)
        .join("\n");
      const prompt = `You are drafting findings bullet points for a visa application revision-request email to the applicant${applicant.name ? ` (${applicant.name})` : ""}.
Below are compliance issues found against Malta's Central Visa Unit Employment Visa checklist. Rewrite each one as a single clear, polite, professional sentence telling the applicant what's wrong and, where the note gives specifics, what's needed to fix it. Do not invent details beyond what's given — no fabricated dates, amounts, or documents. Keep each bullet self-contained and concise (one sentence).

Issues:
${issuesText}

Return ONLY a JSON array of strings, no markdown fences, no commentary, with exactly ${promptIssues.length} entries in the same order as the issues above.`;

      const { data } = await callGemini({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const rawText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
      if (!rawText) throw new Error("No text in response — the model may have blocked the content or returned nothing.");
      findings = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    }

    if (!Array.isArray(findings) || !findings.length) {
      throw new Error("The engine didn't return any findings text.");
    }

    emailBulletsContainer.innerHTML = "";
    findings.forEach(text => addEmailBullet(String(text)));
    renderEmail();
    setEmailStatus(`Generated ${findings.length} finding${findings.length === 1 ? "" : "s"} with AI. Review before sending.`);
  } catch (err) {
    console.error(err);
    const msg = /Failed to fetch|NetworkError/i.test(err.message || "")
      ? "Can't reach the engine — check it's reachable, or switch engine in Options."
      : (err.message || "Couldn't generate findings.");
    setEmailStatus(msg, true);
  } finally {
    emailGenerateFindingsBtn.disabled = false;
  }
}

export function initEmailWriter() {
  emailAddBulletBtn.addEventListener("click", () => { addEmailBullet(); renderEmail(); });
  emailAppTypeRadios.forEach(r => r.addEventListener("change", renderEmail));
  [emailApplicantName, emailPassportNumber, emailSalutation].forEach(input =>
    input.addEventListener("input", renderEmail)
  );

  emailCopyBodyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(emailOutput.value).then(() => flashCopied(emailCopyBodyBtn));
  });
  emailCopySubjectBtn.addEventListener("click", () => {
    const subj = buildEmailSubject();
    if (!subj) return;
    navigator.clipboard.writeText(subj).then(() => flashCopied(emailCopySubjectBtn));
  });

  emailLoadCaseBtn.addEventListener("click", loadCaseIntoEmail);
  emailGenerateFindingsBtn.addEventListener("click", generateFindingsWithAI);
}
