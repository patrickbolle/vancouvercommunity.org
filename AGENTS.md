# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A community directory for Vancouver, BC — a static site listing 40 categories of local groups, clubs, and meetups. Content lives in markdown files in `content/`; Eleventy (11ty) converts them to HTML pages in `site/` (gitignored).

## Build & Dev

```bash
npm run dev    # Dev server with hot reload at localhost:8080
npm run build  # Production build
```

The dev server watches all files (markdown, CSS, templates, JS) and auto-rebuilds on change.

## Architecture

**Content flow:** `content/*.md` → Eleventy → `site/*/index.html`

- `content/` has all category `.md` files and page `.njk` templates
- Each `.md` file has YAML frontmatter with `title`, `description`, `emoji`, `group`, and `order`
- `eleventy.config.js` is the build configuration
- `_includes/` contains Nunjucks layout templates
- `_data/` contains shared data: `site.json`, `groups.json` (sections, in display order), `sponsors.json`, `mutuals.js` (sister-site promo copy and links), `guides.json` (category → blog guide), `neighbourhoods.js`, `recentGroups.js`
- `_includes/partials/` holds shared pieces: `topbar.njk` (masthead + tabs), `footer.njk`, `sponsor-card.njk`, `mutuals-promo.njk`, `newsletter.njk`
- `src/style.css` is the external stylesheet → served at `/_build/style.css`
- `src/main.js` is shared JavaScript → served at `/_build/main.js`
- `static/` contains static assets (favicon, etc.) → copied to site root
- `site/` is the deploy directory (gitignored, built by Cloudflare Pages)

## Critical Rules

1. **Never manually edit HTML in `site/`** — always edit `content/*.md` files, templates, or CSS and rebuild
2. **External CSS only** — `src/style.css`, never inline `<style>` blocks
3. **Adding a new category** = create a `.md` file in `content/` with frontmatter. That's it. Example:
   ```yaml
   ---
   layout: category
   tags: category
   title: "Yoga & Wellness"
   description: "Free yoga and wellness events in Vancouver."
   emoji: "🧘"
   group: mind-body
   order: 1
   ---
   ```
4. **Group definitions** live in `_data/groups.json` (labels and ordering)

## Markdown Content Format

Each category `.md` file follows this structure:
```markdown
---
layout: category
tags: category
title: "Category Name"
description: "SEO description"
emoji: "🎯"
group: group-key
order: 1
---

# Emoji Category Name

## Group Name
- **What:** Description. Community feel
- **Where:** Location (optional)
- **Find it:** [link](url)

---

## Venues & Resources
- entries...
```

## Content Operations

Standard procedures for modifying community entries. Follow these exactly.

### Removing a group

1. Find the `## Group Name` heading in the category's `content/*.md` file
2. Delete from the `##` heading through all its bullet points (everything up to the next `##`, `---`, or end of file)
3. Clean up: no triple+ blank lines left behind. One blank line between entries is correct
4. Branch name: `Codex/remove-{group-slug}`
5. Commit message: `Remove {Group Name} from {category}`
6. PR title: `Remove {Group Name} (broken link)` or `Remove {Group Name} (closed)`

### Updating a link or detail

1. Find the group's `## heading` in the category file
2. Replace the specific line (e.g. the `**Find it:**` line for URL changes)
3. Keep the existing format — don't rewrite surrounding content
4. Branch name: `Codex/update-{group-slug}`
5. Commit message: `Update {Group Name} in {category}`
6. PR title: `Update {Group Name} — {what changed}`

### Adding a group

New entries go **above** the `---` / `## Venues` divider if one exists, otherwise at the end of the file. Format:

```markdown
## Group Name
- **What:** Description of what the group does. Community feel
- **Vibe:** Atmosphere description (optional, only if provided)
- **Where:** Location (optional, only if provided)
- **Find it:** [domain.com/path](https://domain.com/path)
- **Notes:** Additional info (optional, only if provided)
```

Omit optional fields entirely if not provided — don't leave blanks.

Also update `_data/recentGroups.js`: add the new group to the top of the `recent` array and remove the oldest entry (keep 6 total).

### Verifying a link

Check with: `curl -sL -o /dev/null -w "%{http_code}" "URL"` — run twice if first attempt times out.
- 200, 301, 302 to a valid page = **working**
- 404, 410, connection refused, timeout on both attempts = **broken**
- Meetup.com 404 pages or "this group is no longer active" = **broken**

### What belongs in this directory

Apply this test: *"If I'm interested in X, can I go here and find my people?"*

**Yes:** clubs, groups, meetups, studios with communities, venues hosting niche community events, classes where you'd meet like-minded people

**No:** generic event listings (concerts, festivals), transactional businesses, resource directories without community, broad city-life stuff (jobs, housing, food reviews)

### PR and branch conventions

- Always create PRs — never push directly to main
- Branch prefix: `Codex/` for automated changes
- One change per PR (one group removed, one link updated, etc.)
- PR descriptions should be 1-3 sentences explaining what and why
- Link to the triggering issue in the PR body when applicable: `Resolves #123`

## Monetization

- **Sponsors** live in `_data/sponsors.json` (see `_docs`/`_example`). Every slot renders through `_includes/partials/sponsor-card.njk`: a "Community sponsor" panel with an **Ad** tag, `rel="sponsored"` on the link. An empty slot shows a dashed "Your business here" box linking to `/advertise/`.
  - `listings` — one sponsor per category. A paid sponsor sits at the top of the main column, above the listings, at every width (the advertise page promises "above the fold"). Open category slots sit in the sidebar.
  - `homepage` — one partner on the homepage.
  - `pages` — one sponsor shown on the guide pages: Start here, Free, Neighbourhoods, the blog, About. No slots on Submit or Newsletter.
- **The example on `/advertise/` uses the same partial**, so it always matches what sponsors get.
- **Pricing** is on `/advertise/` (`content/advertise.njk`): $39/mo or $350/yr per category, $25/issue newsletter classified. Homepage and guide-page slots: "ask for pricing". Sold by email (vancouver@bolle.co).
- **Newsletter classifieds** live in `_data/classifieds.json` (see `_docs` in the file). The weekly newsletter script (`scripts/newsletter.mjs`) includes the first active listing per issue, clearly labeled as paid; entries expire via their `until` date. Preview with `node scripts/newsletter.mjs --dry-run`.
- Community groups are never charged — sponsorships are for businesses (studios, gyms, shops, venues) only, and must pass the same "can I find my people here?" test. Sponsorship never buys, changes, or removes a regular listing.
- **mutuals** (mutuals.fm, Patrick's neighbourhood book club site) is promoted as "Our sister site". All copy and links come from `_data/mutuals.js`; every link goes to the mutuals.fm homepage with a per-placement `utm_campaign`. Don't write "free" in its listing copy — the free filter would count it.

## SEO

Titles and descriptions were matched to Search Console queries (Oct 2026). Keep these in place:

- **Category front matter overrides** (optional): `seoTitle`, `seoDescription`, `seoHeading` (the h1), `listNoun` (the listings panel label). `{n}` becomes the live listing count and `{year}` the build year. Write them in the words people search ("chess clubs", "coworking spaces"), not "groups".
- **Default titles** lead with the keyword ("18 Run Clubs in Vancouver (2026)") and add "| Vancouver Community" only when the title stays around 60 characters. Keep meta descriptions under ~155 characters.
- **Counts and dates are never typed by hand.** The leading number in a category `description` is rewritten from the real listings at build time (`liveCount` filter: "N things plus venues" counts groups only). The year and "Updated <month>" come from the build date.
- **Guides:** `_data/guides.json` maps a category to its blog guide; the category page links to it under the intro. The homepage lists a short, hand-picked set in `content/index.njk`.
- **Neighbourhood links:** a listing's location that matches a neighbourhood alias in `_data/neighbourhoods.js` links to that neighbourhood page automatically.
- **New guides** (`content/blog/*.md`): only facts from the directory's own listings or a checked official source; link groups to their exact anchors (copy the `id` from the built category page); include a `faq` list in front matter for FAQ schema.

## Deployment

Cloudflare Pages builds the site on push (`npm run build`) and deploys from `site/`. The `site/` directory is gitignored — never commit built output. The GitHub Action in `.github/workflows/build.yml` runs the build as a CI check only.

## Link maintenance

`scripts/check-links.mjs` verifies every group's `**Find it:**` URL. Run locally with `node scripts/check-links.mjs` (writes `link-report.md`, gitignored). It classifies each link: **broken** (clean 404/410 — safe to fix/remove), **unreachable** (network error/timeout — verify by hand; may be a slow or bot-hostile but live site), or **skipped** (host blocks bots — Instagram/Meetup/etc., not a signal). The `.github/workflows/link-check.yml` Action runs it weekly (Mondays) and opens/updates a single "Broken links report" issue when clean-404 links appear, closing it when they're all resolved.

## External Services

- Analytics: Umami at `data.kwconcerts.ca`
- Stats API: `vancouver-communities-stats.recipekit.workers.dev`
- Submit API: `vancouver-community-submit.recipekit.workers.dev`

## Design Context

### Users
People in Vancouver — both newcomers trying to build a social life from scratch, and established residents looking to expand their circle. They arrive with a mix of hope and low-level vulnerability; searching for community implies some loneliness. The site's job is to quickly answer: "yes, there's a lot going on here, and you belong in it."

### Brand Personality
Personal, warm, community-made. The origin story is a person building something out of genuine care for their city ("Vancouver can feel like a hard city to make friends. I built this directory to help."). That voice should persist throughout. Three words: **neighborly, cozy, honest**.

### Aesthetic Direction
**Warm, homemade, cozy — old soul with modern hands.** Not a slick product, not a government resource, not a corporate directory. Think: a well-loved neighborhood bulletin board, a hand-typeset zine, a good indie bookstore that's easy to navigate. Serif typography and warm off-whites honor the old-school; clean layout and fast, friction-free interaction honor the modern.

Anti-references (explicitly avoid):
- Meetup.com (event-commercial, account-prompt heavy)
- Slick SaaS (gradients, hero sections, "designed to convert")
- Reddit/forum UI (dense, cluttered)
- City government sites (cold, bureaucratic)

### Visual system (Oct 2026 redesign)
An early-web bulletin board: forest-green masthead with a pixel-art logo and treeline, plain tabs, boxed panels with title bars, dense underlined link lists, Georgia headings, Verdana text. No web fonts.
- **Every page uses the same parts**: `.frame.page`, `.page-title`/`.page-lede`, `.columns` (`.col-main` + `.col-side`), `.panel` with `.panel-title` and `.panel-body`, `.link-list`. Don't add one-off page components.
- **Four type sizes only**: `--fs-sm`, `--fs-base`, `--fs-lg`, `--fs-xl` (rem). Panel padding uses `--panel-pad`, page edges `--gutter`.
- **Pixel art in three places only**: the logo (`static/favicon.svg`), the masthead treeline, the section icons (`static/icons/`). Hard 1px edges and 2px offset shadows elsewhere; no pixel fonts, no animation.
- **Accessibility helpers in `src/main.js`**: `a11yDialog.open/close` (makes the page inert and loops Tab — use it for any new modal) and `announce()` (one polite live region for status updates). A build transform adds "(opens in new tab)" to every `target="_blank"` link. Keep visible focus (cream on the masthead), field borders at 3:1 or more, and links underlined.

### Design Principles
1. **Feel made by a person, not a product team.** Personal voice, slight warmth in the details.
2. **Warmth before utility.** The emotional experience lands first.
3. **Cozy density.** Dense but delightful to browse.
4. **Old soul, modern hands.** Serif type, warm palette, but effortless navigation.
5. **Content is the hero.** Design should surface communities quickly and get out of the way.
