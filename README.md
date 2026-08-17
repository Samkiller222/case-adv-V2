# Case Register — Document Extractor

A single-page tool: upload supporting documents for a case (passport page, employer
letter, appointment/flight confirmation, insurance certificate), and it drafts a
case record matching the fields below for you to review, edit, and log.

The draft record's fields depend on which checklist is selected (see below) — Name,
Surname, Gender, Passport number, result, Comments, and Uncertain about are always
present; everything else is specific to the checklist:
- **Employment Visa**: Date appointment, AIP Date, Flight Date, Accommodation,
  Insurance, Insurance Expiry, Skills pass, Pre-Departure course, Job title, Employer.
- **Sports Trials Visa**: VFS Appointment Date, Sports Club / Federation, Planned
  Trial Duration, Accommodation, Insurance, Insurance Expiry, Proof of financial means.

No backend required. It's a static page (`index.html`, the ES modules under
`js/`, and the config data under `data/`) that:
- keeps whatever documents you've attached (`IndexedDB`, not
  `localStorage` — file contents are too big for that) so an accidental
  refresh before you hit "Extract" doesn't lose them; removing a file,
  clearing files, or saving the case cleans up its copy too,
- reads text directly out of text-based PDFs (`pdf.js`, loaded from a CDN),
- sends images, and scanned PDFs with no text layer, to whichever
  **extraction engine** you pick — your own **home server**, or the
  **Gemini API** as a cloud fallback (Gemini reads PDFs and images
  natively),
- checks the uploaded documents against a Malta Central Visa Unit
  "Documentation Required for ... Visa" checklist — **Employment Visa** (10
  items: visa form, passport validity, photo, AIP timing, VFS appointment,
  flight itinerary, insurance thresholds, accommodation proof, Skills
  Pass, fees) or **Sports Trials Visa** (10 items: visa form, passport
  validity, photo, VFS appointment, sports club invitation letter, sports
  club declaration, insurance thresholds, proof of financial means,
  accommodation proof, fees), picked from the **checklist dropdown** next
  to "Clear files" in the intake panel (more checklists can be added to
  `data/checklists.json` without touching any code) — and shows each item
  as Compliant / Non-compliant / Missing / Not applicable, with a one-line
  reason — click any item to expand it and **override the status and
  reason yourself**; the AI's verdict is a starting point, not the final
  word, and your edit flows through to the case log, CSV/JSON export, and
  the Email Writer's findings the same way an AI-determined one would.
  Each case remembers which checklist it was actually checked against, so
  switching the dropdown never reinterprets an already-extracted or
  already-saved case — it only affects the *next* extraction,
- shows you the draft so you can correct anything before it's saved,
- keeps a running case log in the browser (`localStorage`) with CSV export
  (including a `checklist_issues` column summarizing any flagged items) and
  a full-fidelity **JSON backup/restore** (see below),
- lets you **reopen and edit** any saved case — click "edit" on its case
  log row to load it back into the draft panel, change anything (e.g.
  update `result` as a case progresses from "email sent" to "passed"), and
  either "Update case" (saves in place, no duplicate row) or "Cancel edit"
  to leave the saved entry untouched,
- supports a **dark mode** toggle (top-right of the header) that remembers
  your choice,
- is **installable** (Add to Home Screen / desktop install) and keeps
  working offline once it's been opened online at least once (see below).

## Case log backup & restore

CSV export (in the Case log panel) is for spreadsheets, but it drops the
checklist verdicts and can't be re-imported. Next to it, **"Export JSON
backup"** downloads the full case log — every field plus each case's
checklist array — and **"Import JSON backup"** reads one back in. Import
merges by the case's internal id: re-importing the same backup, or one that
overlaps with your current log, adds only the cases you don't already have
and reports how many were skipped as duplicates, so it's safe to import
repeatedly without creating duplicate rows. Since the case log otherwise
lives only in this browser's `localStorage`, exporting a backup periodically
(and after any big batch of cases) is the way to protect against a cleared
cache or a browser switch.

## Installable / offline

A service worker (`sw.js`) makes the page installable — desktop Chrome/Edge
show an install icon in the address bar, mobile shows "Add to Home Screen".
Installed or not, it also caches pdf.js (the CDN library used for PDF text
extraction) the first time you load the page online, so a flaky or blocked
CDN — the failure mode that used to be able to take down the whole page,
see `extractPdfText()` in `js/pdf-extract.js` — stops mattering after that
first visit. The app shell (`index.html`, the `js/` modules, the `data/`
JSON config) is cached network-first, so
you always get the latest version when online and only fall back to the
cached copy when offline; extraction calls themselves (POST requests to
Gemini or your home server) are never intercepted or cached, only actual
GET requests for the app's own files and the pinned pdf.js CDN URLs.
Bumping `CACHE_VERSION` at the top of `sw.js` forces already-installed
users to drop old cached files on their next online visit — do that when
you ship a change that needs to reach them promptly.

## Apps menu

The hamburger icon (top-left) switches between the tools this page holds —
right now:

- **Case intake** — the document upload / extraction / checklist / case log
  flow described above.
- **Email writer** — drafts a document-revision request email. Hitting
  "Load from current case" (or opening the tab for the first time after an
  extraction) pulls the applicant's name, passport number, and a salutation
  guessed from gender straight from the current draft, and turns every
  Non-compliant/Missing checklist item into a findings bullet using a fixed
  template — instant, free, works offline. A second button, **"Generate
  findings with AI"**, is opt-in: it sends the same checklist issues to
  whichever extraction engine is currently selected (see below) and asks it
  to rewrite them as natural, professional prose, replacing the templated
  bullets. Findings are editable free text either way, and the tool works
  standalone (no case loaded, no AI call) if you just want to type an email
  from scratch. Application type (Sport / Student / Employment) picks which
  Central Visa Unit checklist link goes in the email body.
- **Options** — theme (also togglable from the header icon anytime), an
  accent-color picker, and the extraction engine / API key settings
  described below, moved out of the main intake panel to keep it focused
  on the current case.

## Accent color

Options → Appearance has an accent-color dropdown (5 presets, each with a
light/dark variant and a small swatch preview) that recolors primary
buttons, links, focus rings, and the active menu item. It's decoupled from
the checklist's semantic colors — Non-compliant/Missing badges and error
text always stay red, Compliant always stays green, regardless of which
accent you pick, so problem states remain visually unambiguous. Your
choice persists in `localStorage` alongside the light/dark theme setting.

## Extraction engine: home server vs. Gemini

The "Extraction engine" dropdown in **Options** switches between two ways of
processing documents and generating email findings — nothing else about the
page changes:

- **Home server (local model)** — your own server, reachable at a URL you
  provide. For extraction, the page `POST`s files as `multipart/form-data`
  to `<your-url>/extract` with `Authorization: Bearer <your-token>`, plus a
  `criteria` field naming the checklist selected in the intake dropdown
  (e.g. `employment`, `sport` — see `data/checklists.json` for the full
  list of ids); a server that doesn't look at that field is unaffected,
  since the response is normalized against that checklist client-side
  either way. Expects back a JSON body shaped like the extracted record
  (the same keys as the Gemini path, plus an optional `checklist` array —
  see `js/checklist.js`/`normalizeChecklist` for the exact shape). For the Email Writer's
  "Generate findings with AI", it `POST`s JSON to `<your-url>/findings`
  (same bearer-token auth) with body
  `{ "applicant": { "name", "passport_number" }, "issues": [{ "id", "label", "status", "note" }, ...] }`
  and expects back `{ "findings": ["...", ...] }` — one rewritten sentence
  per issue, same order. Doc-verify's reference home server only implements
  `/extract`; `/findings` is a new, optional contract — if your server
  doesn't have that route yet, the button just shows a clear error, nothing
  else breaks. Nothing reaches a third-party AI provider; documents go
  straight from your browser to your server over HTTPS. This mode is
  selected by default.
- **Gemini (cloud fallback)** — sends documents (and, for findings
  generation, just the checklist issue text — no documents) directly to
  Google's `generativelanguage.googleapis.com` using a Gemini API key you
  supply (free, no credit card — go to **aistudio.google.com**, **Get API
  key → Create API key**, and paste the key, which starts with `AIza...`,
  into the page).

Both the URL/token and the API key are kept only in your browser's
`localStorage` — **never** written to this repo or sent anywhere except
the destination you chose.

**Two caveats to know about the Gemini fallback's free tier:**
- Google's free tier terms allow prompts/documents sent through it to be used
  to improve their products. That's a real consideration here since you're
  sending passport numbers and personal case data — if that's a concern,
  switch to a paid Gemini key (same account, just enable billing), or use
  the home server engine instead.
- Because this is a static page with no server of its own, the Gemini key
  lives in your browser and every request is made directly from it — fine
  for personal/local use, but don't host this on a shared machine without
  clearing the key, and never commit a key into the repo.

Passport numbers and personal case data are sensitive — treat the case log
(and any exported CSV) the same way you'd treat a paper case file.

## Running it locally

The app's config (field lists, checklist criteria, etc.) lives in `data/*.json`
and is loaded with `fetch()` at startup, so the page needs to be served over
http(s) — most browsers block `fetch()` of local files when you open
`index.html` directly (`file://`). No build step either way, just a static
file server. From this folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Any other static server (`npx serve`, VS Code's Live Server, etc.) works
too. Hosting it on GitHub Pages (below) serves it over https and needs no
extra setup.

## Hosting it on GitHub Pages

1. Create a **new** GitHub repository (don't reuse an existing one) —
   e.g. `case-register`.
2. Push this folder to it (see commands below).
3. In the repo: **Settings → Pages → Source → Deploy from branch → main → / (root)**.
4. GitHub gives you a URL like `https://<your-username>.github.io/case-register/`.

## Pushing this to your GitHub

This folder is already a local git repo with one commit. To push it to a new
repo of your own **without touching any existing repo or data**:

```bash
# 1. Create a new, empty repository on github.com first (no README/license),
#    then copy its URL, e.g.:
#    https://github.com/samkiller222/case-register.git

# 2. From inside this folder:
git remote add origin https://github.com/samkiller222/case-register.git
git branch -M main
git push -u origin main
```

That's it — this only touches the new repo you just created; it never reads
from or writes to any other repository.

## Code layout

- `index.html` — markup, styles, and the pre-first-paint theme script.
- `data/*.json` — static config data, editable without touching any logic:
  - `fields.json` — the draft-record fields common to every checklist: `prefix`
    (name/surname/gender/passport, shown first) and `suffix` (result/comments/
    uncertain, shown last).
  - `checklists.json` — every CVU checklist the app can verify against (Employment
    Visa, Sports Trials Visa, ...), each with its own compliance `items` and its
    own extra draft-record `fields` (the boxes between the common prefix/suffix
    above — e.g. Sports Trials tracks a sports club and trial duration instead of
    Employment's AIP/flight dates and job details). Add a new entry here to
    support another checklist — no code changes needed.
  - `accent-presets.json` — theme accent-color options.
  - `view-meta.json` — per-view header text (intake/case-log/statistics/email/options).
  - `checklist-links.json` — CVU checklist PDF links, by application type.
  - `app-config.json` — the Gemini model id and checklist status list.
- `js/*.js` — ES modules, one per piece of functionality:
  - `config.js` — fetches and exports everything in `data/`.
  - `main.js` — entry point; wires up every other module in order.
  - `state.js` — the shared app state (draft record, files, case log).
  - `utils.js` — small shared helpers (DOM lookup, escaping, status-line setter).
  - `pwa.js` — service worker registration.
  - `theme.js` — light/dark theme + accent color picker.
  - `engine-settings.js` — extraction engine (home server / Gemini) settings.
  - `criteria.js` — the intake panel's checklist dropdown (which checklist new
    extractions are checked against).
  - `menu.js` — the apps menu and view switching.
  - `files-db.js` — IndexedDB persistence for in-progress attachments.
  - `file-intake.js` — drag/drop file intake and the file list.
  - `pdf-extract.js` — PDF text extraction via pdf.js.
  - `checklist.js` — resolving a record's checklist, normalization, and the
    compliance panel.
  - `extraction.js` — runs extraction against the selected engine and checklist.
  - `record.js` — the draft record form, and saving/loading it to the case log.
  - `case-log.js` — the case log table, filters, CSV export, JSON backup/restore.
  - `statistics.js` — final-decision/employer/job-title breakdowns of the case log.
  - `email-writer.js` — the revision-request email drafting tool.
- `sw.js` — the service worker (offline caching); bump `CACHE_VERSION` here
  when you change any file listed in its `SHELL_ASSETS`.

## Known limitations (v1)

- Extraction quality depends on document clarity — always check the draft
  before saving to the log, especially the passport number and dates.
- Free-tier Gemini has daily/per-minute request caps (generous for individual
  use, but if you hit a 429 error, wait a minute and retry).
- The case log lives in one browser's `localStorage` — it won't sync across
  devices. Export to CSV regularly if you want a durable copy.
