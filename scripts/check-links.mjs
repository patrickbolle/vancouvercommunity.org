#!/usr/bin/env node
// Broken-link checker for the directory's outbound "Find it" links.
// Run locally:  node scripts/check-links.mjs
// In CI:        used by .github/workflows/link-check.yml (weekly)
//
// Classifies each link as ok / broken / skipped. Only HARD failures count
// as broken (404/410, DNS failure, connection refused, or a timeout on two
// attempts). Sites that block bots (401/403/405/429, LinkedIn's 999) are
// "skipped" — reported separately, never flagged as broken, to avoid noise.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT_DIR = join(process.cwd(), "content");
const CONCURRENCY = 8;
const TIMEOUT_MS = 12000;
const UA =
  "Mozilla/5.0 (compatible; VancouverCommunityLinkCheck/1.0; +https://vancouvercommunity.org)";

// ── Collect { category, group, url } from every "Find it" line ──────────

function collectLinks() {
  const out = [];
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const category = file.replace(/\.md$/, "");
    const raw = readFileSync(join(CONTENT_DIR, file), "utf-8").replace(
      /^---[\s\S]*?---\s*/,
      ""
    );
    const sections = raw.split(/^## /m).slice(1);
    for (const section of sections) {
      const group = section.split("\n")[0].trim();
      const m = section.match(
        /\*\*Find it:\*\*\s*\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/
      );
      if (m) out.push({ category, group, url: m[1] });
    }
  }
  // De-dupe identical URLs (check once, report against all their groups)
  const byUrl = new Map();
  for (const item of out) {
    if (!byUrl.has(item.url)) byUrl.set(item.url, []);
    byUrl.get(item.url).push(item);
  }
  return byUrl;
}

// ── Check a single URL ──────────────────────────────────────────────────

async function fetchOnce(url, method) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "*/*" },
    });
    return { status: res.status };
  } finally {
    clearTimeout(t);
  }
}

const BOT_BLOCKED = new Set([401, 403, 405, 406, 429, 999]);

// States:
//   ok          — 2xx/3xx
//   broken      — clean 404/410 (high confidence; safe to remove/fix)
//   unreachable — network error / timeout / odd 4xx (VERIFY by hand; a
//                 proxy hiccup or bot-hostile server can cause these)
//   skipped     — site blocks bots (401/403/405/429/999); not a signal
function classifyStatus(status, method) {
  if (typeof status === "number") {
    if (status >= 200 && status < 400) return { state: "ok", status };
    if (status === 404 || status === 410) return { state: "broken", status };
    if (BOT_BLOCKED.has(status)) return { state: "skipped", status };
    if (status >= 500) return { state: "skipped", status }; // transient
    // Other 4xx: only decide after GET; ambiguous otherwise.
    if (method === "GET") return { state: "unreachable", status };
  }
  return null;
}

async function checkUrl(url) {
  // Try HEAD first (cheap); fall back to GET if HEAD is rejected or errors.
  for (const method of ["HEAD", "GET"]) {
    try {
      const { status } = await fetchOnce(url, method);
      const c = classifyStatus(status, method);
      if (c) return c;
    } catch (e) {
      if (method === "GET") {
        // One more GET attempt before calling it unreachable.
        try {
          const { status } = await fetchOnce(url, "GET");
          const c = classifyStatus(status, "GET");
          if (c) return c;
          return { state: "unreachable", status };
        } catch (e2) {
          return { state: "unreachable", status: e2.name || "network-error" };
        }
      }
    }
  }
  return { state: "unreachable", status: "unknown" };
}

// ── Simple concurrency pool ─────────────────────────────────────────────

async function mapPool(items, worker, limit) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────

const byUrl = collectLinks();
const urls = [...byUrl.keys()];
console.error(`Checking ${urls.length} unique links…`);

let done = 0;
const checked = await mapPool(
  urls,
  async (url) => {
    const result = await checkUrl(url);
    done++;
    if (done % 25 === 0) console.error(`  …${done}/${urls.length}`);
    return { url, ...result, refs: byUrl.get(url) };
  },
  CONCURRENCY
);

const broken = checked.filter((c) => c.state === "broken");
const unreachable = checked.filter((c) => c.state === "unreachable");
const skipped = checked.filter((c) => c.state === "skipped");
const ok = checked.filter((c) => c.state === "ok");

console.error(
  `\nDone: ${ok.length} ok, ${broken.length} broken, ${unreachable.length} unreachable, ${skipped.length} skipped (bot-blocked)`
);

function section(title, list, note) {
  let s = `## ${title}\n\n`;
  const byCat = new Map();
  for (const c of list) {
    for (const ref of c.refs) {
      if (!byCat.has(ref.category)) byCat.set(ref.category, []);
      byCat.get(ref.category).push({ group: ref.group, url: c.url, status: c.status });
    }
  }
  for (const [cat, items] of [...byCat].sort()) {
    s += `**${cat}**\n`;
    for (const it of items)
      s += `- ${it.group} — [\`${it.url}\`](${it.url}) (${it.status})\n`;
    s += `\n`;
  }
  if (note) s += note + "\n\n";
  return s;
}

let report = `# Link check report\n\n`;
report += `_${ok.length} ok · **${broken.length} broken** · ${unreachable.length} unreachable · ${skipped.length} skipped (bot-blocked)_\n\n`;

if (!broken.length && !unreachable.length) {
  report += `All links resolved cleanly. 🎉\n`;
} else {
  if (broken.length) {
    report += section(
      "Broken — safe to fix or remove (clean 404/410)",
      broken,
      'These returned a definitive 404/410. Update the link, or remove the group per CLAUDE.md → "Removing a group".'
    );
  }
  if (unreachable.length) {
    report += section(
      "Unreachable — verify by hand before acting",
      unreachable,
      "A network error/timeout or ambiguous status. Could be a dead site OR a slow/bot-hostile server. Open the link yourself before removing anything."
    );
  }
  report += `_${skipped.length} links were skipped because the host blocks automated checks (Instagram, Meetup, LinkedIn, etc.). Not a problem signal._\n`;
}

writeFileSync("link-report.md", report);
console.error("Wrote link-report.md");

// Non-zero only for high-confidence broken links, so CI noise stays low.
process.exit(broken.length ? 1 : 0);
