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
const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;
// A real browser UA — a bot-identifying UA gets challenged/blocked far more
// often, which would produce false positives. We only READ status codes.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

// States:
//   ok          — 2xx/3xx
//   broken      — clean 404/410 confirmed on TWO GETs (safe to fix/remove)
//   unreachable — network error / odd 4xx (VERIFY by hand; a bot wall,
//                 proxy hiccup, or slow-but-live server causes these)
//   skipped     — bot-blocked (401/403/…), 5xx, or any other non-signal
// Deliberately biased to under-report: only double-confirmed clean 404/410
// ever counts as broken, so the auto-filed issue stays trustworthy.
const BOT_BLOCKED = new Set([401, 403, 405, 406, 408, 409, 429, 451, 999]);

async function getStatus(url) {
  // GET (not HEAD — many servers mishandle HEAD and 404 it falsely).
  try {
    const { status } = await fetchOnce(url, "GET");
    return status;
  } catch (e) {
    return e.name || "network-error";
  }
}

async function checkUrl(url) {
  let s = await getStatus(url);
  if (typeof s !== "number") s = await getStatus(url); // retry once
  if (typeof s !== "number") return { state: "unreachable", status: s };
  if (s >= 200 && s < 400) return { state: "ok", status: s };
  if (BOT_BLOCKED.has(s) || s >= 500) return { state: "skipped", status: s };
  if (s === 404 || s === 410) {
    // Confirm a dead link on a second GET before flagging it.
    const s2 = await getStatus(url);
    if (s2 === 404 || s2 === 410) return { state: "broken", status: s2 };
    if (typeof s2 === "number" && s2 >= 200 && s2 < 400)
      return { state: "ok", status: s2 };
    return { state: "unreachable", status: s2 };
  }
  return { state: "unreachable", status: s }; // other 4xx: ambiguous
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

const summary = `_${ok.length} ok · **${broken.length} broken** · ${unreachable.length} unreachable · ${skipped.length} skipped (bot-blocked)_`;

// Full report — for local runs and CI logs (all buckets).
let report = `# Link check report\n\n${summary}\n\n`;
if (!broken.length && !unreachable.length) {
  report += `All links resolved cleanly. 🎉\n`;
} else {
  if (broken.length)
    report += section(
      "Broken — clean 404/410, confirmed twice",
      broken,
      'Update the link, or remove the group per CLAUDE.md → "Removing a group".'
    );
  if (unreachable.length)
    report += section(
      "Unreachable — VERIFY BY HAND, do not auto-remove",
      unreachable,
      "A network error or ambiguous status — very often a bot wall or a slow-but-live site (this is expected for many hosts). Open the link yourself before touching the listing."
    );
  report += `_${skipped.length} links skipped: the host blocks automated checks (Instagram, Meetup, LinkedIn, etc.). Not a signal._\n`;
}
writeFileSync("link-report.md", report);

// Issue body — ONLY the high-confidence broken links, so the weekly issue
// never cries wolf. Unreachable/skipped are intentionally left out.
if (broken.length) {
  let issue = `${summary}\n\n`;
  issue += section("Broken links (clean 404/410, confirmed twice)", broken, "");
  issue += `_Also ${unreachable.length} unreachable and ${skipped.length} bot-blocked links were seen but left out — many sites block automated checks, so those aren't reliable. See the workflow logs for the full report._\n`;
  writeFileSync("link-issue.md", issue);
}

console.error("Wrote link-report.md" + (broken.length ? " + link-issue.md" : ""));
process.exit(broken.length ? 1 : 0);
