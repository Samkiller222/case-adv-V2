/* Gemini models selectable in Options, each { id, label, summary, pricing }.
 * Order matters: it's also the order tried when auto-fallback kicks in.
 * Kept in JS (not data/*.json) so the dropdown can never be out of step
 * with the code that renders it when a CDN serves a stale JSON file.
 * Prices are rough paid-tier figures; "per case" assumes ~20k tokens in
 * and ~2k out.
 */
export const GEMINI_MODELS = [
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash (default)",
    summary: "Best all-rounder: fast, accurate on scanned PDFs and checklist verdicts. Busiest model, so most prone to 503 \"high demand\" errors.",
    pricing: "$0.75 in / $3.75 out per 1M tokens (intro price to 31 Dec 2026, then $1.50 / $7.50) — roughly 2¢ per case",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    summary: "Previous Flash generation: near-identical extraction quality, usually less congested. Good first alternative when 3.6 is busy.",
    pricing: "$1.50 in / $9.00 out per 1M tokens — roughly 5¢ per case",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    summary: "Faster and cheaper. Still reads documents well, but checklist notes are terser and it's more likely to miss subtle non-compliance — double-check verdicts.",
    pricing: "$0.30 in / $2.50 out per 1M tokens — roughly 1¢ per case",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    summary: "Cheapest option and rarely overloaded. Fine for clear, typed documents; weakest on messy scans, handwriting and nuanced criteria.",
    pricing: "$0.25 in / $1.50 out per 1M tokens — under 1¢ per case",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    summary: "Most careful reasoning — best for complicated or borderline cases. Noticeably slower (can take 30s+), and preview models can have tighter rate limits.",
    pricing: "$2.00 in / $12.00 out per 1M tokens — roughly 8¢ per case (thinking tokens bill as output)",
  },
];
