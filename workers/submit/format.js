// Pure helpers that turn submission form data into safe directory markdown.
// No side effects and no Worker globals — unit-tested by format.test.mjs.
//
// The directory's card renderer expects each entry to be exactly:
//   ## Name
//   - **What:** single line
//   - **Key:** single line   (optional, repeated)
// A newline inside any value, a stray heading mark, or an unbalanced
// markdown link breaks that structure and the card fails to render. These
// helpers guarantee valid single-line output for ANY input.

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u2060\u180E]/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Collapse arbitrary input to one clean line of text.
export function sanitizeInline(value, maxLen = 600) {
  if (value == null) return "";
  let s = String(value).normalize("NFC");
  s = s.replace(ZERO_WIDTH, "");
  s = s.replace(CONTROL, " ");
  s = s.replace(/\u00A0/g, " "); // non-breaking space -> space
  s = s.replace(/[\r\n\t\f\v]+/g, " "); // any vertical whitespace -> space
  s = s.replace(/\s{2,}/g, " ");
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + "…";
  return s;
}

// Multi-line allowed (issue bodies), but stripped of control chars and
// runaway blank lines, and length-capped.
export function sanitizeBlock(value, maxLen = 4000) {
  if (value == null) return "";
  let s = String(value).normalize("NFC");
  s = s.replace(ZERO_WIDTH, "");
  s = s.replace(CONTROL, "");
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + "…";
  return s;
}

// Sanitize a group name into a safe "## Name" heading: single line, no
// leading heading/list marks, no brackets (which corrupt the generated
// anchor id and any link label).
export function sanitizeName(value) {
  let s = sanitizeInline(value, 120);
  s = s.replace(/^#+\s*/, "");
  s = s.replace(/^[-*+]\s+/, "");
  s = s.replace(/[\[\]]/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

// Validate/normalize a URL, or return null. Adds https:// to a bare domain,
// rejects non-http(s) schemes (javascript:, mailto:, data:, …).
export function normalizeUrl(value) {
  let s = sanitizeInline(value, 500).replace(/\s+/g, "");
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s)) s = "https://" + s;
    else return null;
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname.includes(".")) return null;
  return u;
}

// Build a safe "[label](href)" markdown link, or null if the URL is invalid.
export function formatLink(value) {
  const u = normalizeUrl(value);
  if (!u) return null;
  const href = u.href
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/ /g, "%20");
  let label = (u.host + u.pathname + u.search + u.hash)
    .replace(/\/$/, "")
    .replace(/^www\./, "")
    .replace(/[\[\]()]/g, "");
  if (!label || label.length > 55) label = u.host.replace(/^www\./, "");
  return `[${label}](${href})`;
}

// Turn submission data into a validated markdown entry block (no surrounding
// blank lines — insertEntry handles spacing).
export function formatSubmissionEntry(data) {
  const name = sanitizeName(data.name);
  const what = sanitizeInline(data.description);
  const lines = [`## ${name}`, `- **What:** ${what}`];

  const vibe = sanitizeInline(data.vibe);
  if (vibe) lines.push(`- **Vibe:** ${vibe}`);

  const where = sanitizeInline(data.location, 160);
  if (where) lines.push(`- **Where:** ${where}`);

  const cost = sanitizeInline(data.cost, 60);
  if (cost && !/^(not sure|n\/a|none)$/i.test(cost)) {
    lines.push(`- **Cost:** ${cost}`);
  }

  const link = formatLink(data.link);
  if (link) lines.push(`- **Find it:** ${link}`);

  const notes = sanitizeInline(data.additional);
  if (notes) lines.push(`- **Notes:** ${notes}`);

  return lines.join("\n") + "\n";
}

// Insert an entry above the "---/## Venues" divider if present, else append.
// Guarantees exactly one blank line on each side — never triple blanks,
// never a heading glued to the previous entry.
export function insertEntry(content, entry) {
  const body = String(content).replace(/\s+$/, "");
  const block = entry.trim();
  const divider = /\n---\s*\n+##\s+(?:Venues?|Resources)\b/i;
  const match = body.match(divider);
  if (match) {
    const before = body.slice(0, match.index).replace(/\s+$/, "");
    const after = body.slice(match.index).replace(/^\s+/, "");
    return `${before}\n\n${block}\n\n${after}\n`;
  }
  return `${body}\n\n${block}\n`;
}

// True if a group with this name (case-insensitive) already appears.
export function hasDuplicateName(content, name) {
  const clean = sanitizeName(name).toLowerCase();
  if (!clean) return false;
  const re = new RegExp(
    "^##\\s+" + clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$",
    "im"
  );
  return re.test(String(content));
}
