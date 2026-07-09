// Tests for the submission formatter. Run: node workers/submit/format.test.mjs
import assert from "node:assert";
import {
  sanitizeInline,
  sanitizeName,
  normalizeUrl,
  formatLink,
  formatSubmissionEntry,
  insertEntry,
  hasDuplicateName,
} from "./format.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
}

// Every generated entry must be structurally valid markdown:
// line 1 is "## Name", every other non-empty line is a "- **Key:** value"
// bullet, and no value contains a newline.
function assertValidEntry(md, label) {
  const lines = md.replace(/\n+$/, "").split("\n");
  assert.match(lines[0], /^## \S.*$/, `${label}: first line must be a heading`);
  assert.doesNotMatch(lines[0], /[\[\]]|^###/, `${label}: heading has bad chars`);
  for (let i = 1; i < lines.length; i++) {
    assert.match(
      lines[i],
      /^- \*\*[\w ]+:\*\* .+$/,
      `${label}: line ${i + 1} is not a valid bullet: "${lines[i]}"`
    );
  }
  // Balanced markdown links
  for (const m of md.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)) {
    assert.ok(m[1].length, `${label}: empty link label`);
    assert.ok(/^https?:\/\//.test(m[2]), `${label}: link href not http(s)`);
  }
}

// --- sanitizeInline ---
test("collapses newlines to single spaces", () => {
  assert.equal(sanitizeInline("a\nb\r\nc"), "a b c");
});
test("strips zero-width and control chars", () => {
  assert.equal(sanitizeInline("a​bc"), "ab c".replace("  ", " "));
});
test("converts nbsp and collapses runs", () => {
  assert.equal(sanitizeInline("a  b   c"), "a b c");
});
test("trims and caps length", () => {
  const out = sanitizeInline("x".repeat(1000), 50);
  assert.ok(out.length <= 50);
  assert.ok(out.endsWith("…"));
});
test("null/undefined -> empty", () => {
  assert.equal(sanitizeInline(undefined), "");
  assert.equal(sanitizeInline(null), "");
});

// --- sanitizeName ---
test("strips leading heading marks and brackets", () => {
  assert.equal(sanitizeName("## [My Group]"), "My Group");
});
test("keeps ampersands and normal punctuation", () => {
  assert.equal(sanitizeName("Fantasy & Sci-Fi Group"), "Fantasy & Sci-Fi Group");
});
test("multiline name becomes single line", () => {
  assert.equal(sanitizeName("Line one\nLine two"), "Line one Line two");
});

// --- normalizeUrl / formatLink ---
test("adds https to bare domain", () => {
  assert.equal(normalizeUrl("instagram.com/x")?.href, "https://instagram.com/x");
});
test("rejects javascript: and mailto:", () => {
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("mailto:a@b.com"), null);
});
test("rejects garbage", () => {
  assert.equal(normalizeUrl("not a url"), null);
  assert.equal(normalizeUrl(""), null);
});
test("formatLink escapes parens in href", () => {
  const link = formatLink("https://x.com/a(b)c");
  assert.ok(link.includes("%28") && link.includes("%29"));
  assert.doesNotMatch(link, /\([^)]*\([^)]*\)/); // no nested unescaped parens
});
test("formatLink strips protocol and www from label", () => {
  assert.equal(formatLink("https://www.socialrunclub.com/"), "[socialrunclub.com](https://www.socialrunclub.com/)");
});

// --- formatSubmissionEntry: the core hardening ---
test("multiline description stays one bullet", () => {
  const md = formatSubmissionEntry({
    name: "Test Club",
    description: "Line one.\nLine two.\n\nLine three.",
    link: "https://test.com",
  });
  assertValidEntry(md, "multiline desc");
  assert.ok(md.includes("- **What:** Line one. Line two. Line three."));
});
test("hostile input still valid", () => {
  const md = formatSubmissionEntry({
    name: "## Evil\n[hack]",
    description: "desc with ] bracket and\nnewline",
    link: "javascript:alert(1)",
    cost: "Free",
    additional: "notes\nwith\nnewlines",
  });
  assertValidEntry(md, "hostile");
  assert.ok(!md.includes("javascript"), "bad url dropped");
  assert.ok(md.includes("- **Cost:** Free"));
});
test("minimal entry (name + description only)", () => {
  const md = formatSubmissionEntry({ name: "A", description: "B" });
  assertValidEntry(md, "minimal");
  assert.equal(md, "## A\n- **What:** B\n");
});
test("cost 'Not sure' is omitted", () => {
  const md = formatSubmissionEntry({ name: "A", description: "B", cost: "Not sure" });
  assert.ok(!md.includes("Cost"));
});
test("emoji and unicode names survive", () => {
  const md = formatSubmissionEntry({ name: "Café Group 日本語", description: "hi" });
  assertValidEntry(md, "unicode");
});

// --- insertEntry ---
const withDivider = `# Cat\n\n## Existing\n- **What:** thing\n\n---\n\n## Venues & Spaces\n\n## A Venue\n- **What:** place\n`;
test("inserts above venues divider with single blank lines", () => {
  const entry = formatSubmissionEntry({ name: "New Group", description: "desc" });
  const out = insertEntry(withDivider, entry);
  assert.ok(out.indexOf("## New Group") < out.indexOf("## Venues"), "before venues");
  assert.ok(out.indexOf("## New Group") > out.indexOf("## Existing"), "after existing");
  assert.doesNotMatch(out, /\n\n\n/, "no triple blank lines");
});
test("appends when no divider", () => {
  const base = `# Cat\n\n## Existing\n- **What:** thing\n`;
  const out = insertEntry(base, formatSubmissionEntry({ name: "New", description: "d" }));
  assert.ok(out.trim().endsWith("- **What:** d"));
  assert.doesNotMatch(out, /\n\n\n/);
});

// --- hasDuplicateName ---
test("detects duplicate case-insensitively", () => {
  assert.ok(hasDuplicateName(withDivider, "existing"));
  assert.ok(hasDuplicateName(withDivider, "  EXISTING  "));
  assert.ok(!hasDuplicateName(withDivider, "Nonexistent"));
});

console.log(`\n${passed} passed`);
