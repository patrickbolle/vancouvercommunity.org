#!/usr/bin/env node
// Weekly newsletter generator — parses git history, builds HTML, creates Beehiiv draft

import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BEEHIIV_API = "https://api.beehiiv.com/v2";
const PUB_ID = process.env.BEEHIIV_PUB_ID || "pub_24114c6e-a7e2-4653-a26e-9411344f36aa";
const API_KEY = process.env.BEEHIIV_API_KEY;
const SITE_URL = "https://vancouvercommunity.org";
const CONTENT_DIR = join(process.cwd(), "content");

if (!API_KEY) {
  console.error("BEEHIIV_API_KEY is required");
  process.exit(1);
}

// ── Parse git log ──────────────────────────────────────────────

function getRecentChanges() {
  const log = execSync('git log --since="7 days ago" --format="%s" -- content/', {
    encoding: "utf-8",
  }).trim();

  if (!log) return { adds: [] };

  const lines = log.split("\n");
  const adds = new Map();

  for (const msg of lines) {
    const match = msg.match(/^Add (.+?) to ([a-z][\w-]+)$/);
    if (match && !adds.has(match[1])) {
      adds.set(match[1], match[2]);
    }
  }

  // Look up descriptions from content files
  const results = [];
  for (const [group, category] of adds) {
    let description = "";
    try {
      const content = readFileSync(join(CONTENT_DIR, `${category}.md`), "utf-8");
      const re = new RegExp(`^## ${group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n(?:[\\s\\S]*?)\\*\\*What:\\*\\* (.+?)$`, "m");
      const m = content.match(re);
      if (m) description = m[1];
    } catch {}
    results.push({ group, category, description });
  }

  return { adds: results };
}

// ── Category spotlight ─────────────────────────────────────────

function getSpotlightCategory() {
  const files = readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md") && f !== "resources.md");

  // Deterministic pick based on ISO week number
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  const file = files[week % files.length];

  const content = readFileSync(join(CONTENT_DIR, file), "utf-8");
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return null;

  const title = frontmatter[1].match(/title:\s*"(.+?)"/)?.[1];
  const emoji = frontmatter[1].match(/emoji:\s*"(.+?)"/)?.[1];
  const slug = file.replace(".md", "");

  // Extract first 3 community groups (skip utility sections like "Venues & Resources")
  const groups = [];
  const groupRegex = /^## (.+)\n(?:[\s\S]*?)\*\*What:\*\* (.+?)$/gm;
  let m;
  while ((m = groupRegex.exec(content)) && groups.length < 3) {
    if (/venue|resource/i.test(m[1])) continue;
    groups.push({ name: m[1], description: m[2] });
  }

  return { title, emoji, slug, groups };
}

// ── Pretty category name from slug ─────────────────────────────

function prettyCategory(slug) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Anchor slug (matches Eleventy's heading ID generation) ─────

function anchorSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

// ── Email HTML template ────────────────────────────────────────

function buildEmail(adds, spotlight) {
  let sections = "";

  // New additions
  if (adds.length > 0) {
    const items = adds
      .map(
        (a) =>
          `<tr>
            <td style="padding:12px 0;border-bottom:1px solid #F0ECE8;">
              <a href="${SITE_URL}/${a.category}#${anchorSlug(a.group)}" style="color:#A85A46;text-decoration:none;font-family:Georgia,serif;font-size:17px;font-weight:bold;">${a.group}</a>
              ${a.description ? `<br><span style="color:#5C5955;font-size:14px;">${a.description}</span>` : ""}
              <br><span style="color:#9C9890;font-size:13px;">${prettyCategory(a.category)}</span>
            </td>
          </tr>`
      )
      .join("");
    sections += `
      <h2 style="font-family:Georgia,serif;color:#2C2925;font-size:20px;margin:28px 0 12px;">Just added</h2>
      <p style="color:#5C5955;margin:0 0 16px;">New to the directory this week.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>`;
  }

  // Spotlight (always included)
  if (spotlight && spotlight.groups.length > 0) {
    const items = spotlight.groups
      .map(
        (g) =>
          `<tr>
            <td style="padding:12px 0;border-bottom:1px solid #F0ECE8;">
              <a href="${SITE_URL}/${spotlight.slug}#${anchorSlug(g.name)}" style="color:#2C2925;text-decoration:none;font-weight:bold;">${g.name}</a>
              <br><span style="color:#7C7870;font-size:14px;">${g.description}</span>
            </td>
          </tr>`
      )
      .join("");

    sections += `
      <h2 style="font-family:Georgia,serif;color:#2C2925;font-size:20px;margin:32px 0 12px;">${spotlight.emoji} ${spotlight.title}</h2>
      <p style="color:#5C5955;margin:0 0 16px;">In case you missed it — a few groups worth knowing about.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
      <p style="margin-top:16px;">
        <a href="${SITE_URL}/${spotlight.slug}" style="color:#A85A46;">All ${spotlight.title} &rarr;</a>
      </p>`;
  }

  return wrapEmail(sections);
}

function wrapEmail(sections) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vancouver Community Directory</title></head>
<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:-apple-system,system-ui,sans-serif;font-size:16px;line-height:1.6;color:#2C2925;">
<div style="display:none;max-height:0;overflow:hidden;">New groups, community picks, and what's happening around Vancouver.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

<tr><td style="padding-bottom:24px;text-align:center;">
  <a href="${SITE_URL}" style="font-family:Georgia,serif;font-size:22px;color:#2C2925;text-decoration:none;font-weight:bold;">Vancouver Community Directory</a>
</td></tr>

<tr><td style="background-color:#FFFFFF;border-radius:8px;padding:32px;">
  <p style="margin:0 0 20px;color:#2C2925;">The directory got a few updates this week. Here's what's new and something you might not have seen yet.</p>
  ${sections}
  <hr style="border:none;border-top:1px solid #E8E4E0;margin:28px 0;">
  <p style="text-align:center;">
    <a href="${SITE_URL}" style="display:inline-block;background-color:#A85A46;color:#FFFFFF;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Browse the directory</a>
  </p>
</td></tr>

<tr><td style="padding-top:24px;text-align:center;color:#9C9890;font-size:13px;">
  <p style="margin:0;">Made with care for this city.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Create Beehiiv draft ───────────────────────────────────────

async function createDraft(subject, html) {
  const res = await fetch(`${BEEHIIV_API}/publications/${PUB_ID}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: subject,
      subtitle: "New groups, community picks, and what's happening around Vancouver",
      status: "draft",
      content_html: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Beehiiv API error (${res.status}):`, err);
    process.exit(1);
  }

  const data = await res.json();
  const post = data.data;
  console.log(`Draft created: ${post.id}`);
  if (post.web_url) console.log(`Preview: ${post.web_url}`);
  return post;
}

// ── Main ───────────────────────────────────────────────────────

const changes = getRecentChanges();
const spotlight = getSpotlightCategory();

const datePart = new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" });

let subject;
if (changes.adds.length > 0) {
  console.log(`${changes.adds.length} new groups this week + spotlight: ${spotlight?.emoji} ${spotlight?.title}`);
  subject = `${changes.adds.length} new group${changes.adds.length > 1 ? "s" : ""} + ${spotlight?.emoji} ${spotlight?.title}`;
} else {
  console.log(`No new groups — spotlight only: ${spotlight?.emoji} ${spotlight?.title}`);
  subject = `${spotlight?.emoji} ${spotlight?.title} — groups you might not know about`;
}

const html = buildEmail(changes.adds, spotlight);
await createDraft(subject, html);
console.log("Done!");
