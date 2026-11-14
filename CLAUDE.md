# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A community directory for Vancouver, BC — a static site listing 45+ categories of local groups, clubs, and meetups. Content lives in markdown files in `content/`; Eleventy (11ty) converts them to HTML pages in `site/` (gitignored).

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
   Optional: `added: YYYY-MM-DD` (the day the category went live). For 21 days after that date, the homepage lists it in the "New lists" row at the top of the directory, newest first (6 at most). Set it on every new category.
4. **Group definitions** live in `_data/groups.json` (labels and ordering). The homepage directory shows each section's 5 biggest categories (by listing count). The rest sit behind a native `<details>` "+N more" toggle.

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
- **When:** Tuesdays 6:30pm (optional)
- **Cost:** $15 drop-in (optional)
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
4. Branch name: `claude/remove-{group-slug}`
5. Commit message: `Remove {Group Name} from {category}`
6. PR title: `Remove {Group Name} (broken link)` or `Remove {Group Name} (closed)`

### Updating a link or detail

1. Find the group's `## heading` in the category file
2. Replace the specific line (e.g. the `**Find it:**` line for URL changes)
3. Keep the existing format — don't rewrite surrounding content
4. Branch name: `claude/update-{group-slug}`
5. Commit message: `Update {Group Name} in {category}`
6. PR title: `Update {Group Name} — {what changed}`

### Adding a group

New entries go **above** the `---` / `## Venues` divider if one exists, otherwise at the end of the file. Format:

```markdown
## Group Name
- **What:** Description of what the group does. Community feel
- **Vibe:** Atmosphere description (optional, only if provided)
- **Where:** Location (optional, only if provided)
- **When:** Tuesdays 6:30pm (optional, only if provided)
- **Cost:** $15 drop-in (optional, only if provided)
- **Find it:** [domain.com/path](https://domain.com/path)
- **Notes:** Additional info (optional, only if provided)
```

Omit optional fields entirely if not provided — don't leave blanks.

**When** and **Cost** show as small tags on the group card, so keep them short: "Tuesdays 6:30pm", "First Saturday monthly", "$15 drop-in". Only use what the group itself states; never guess a time. A Cost with "free" in it shows the green Free badge. Any other Cost shows as written. With no Cost, "free" in the What line still gives the Free badge.

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
- Branch prefix: `claude/` for automated changes
- One change per PR (one group removed, one link updated, etc.)
- PR descriptions should be 1-3 sentences explaining what and why
- Link to the triggering issue in the PR body when applicable: `Resolves #123`

## Monetization

- **Sponsors** live in `_data/sponsors.json` (see `_docs`/`_example`). Every slot renders through `_includes/partials/sponsor-card.njk`: a "Community sponsor" panel with an **Ad** tag, `rel="sponsored"` on the link. An empty slot shows a dashed "Your business here" box linking to `/advertise/`.
  - `listings` — one sponsor per category. A paid sponsor sits at the top of the main column, above the listings, at every width (the advertise page promises "above the fold"). Open category slots sit in the sidebar, but only when no sidebar banner is set.
  - `homepage` — one partner on the homepage.
  - `pages` — one sponsor shown on the guide pages: Start here, Free, Neighbourhoods, the blog, About. No slots on Submit or Newsletter.
- **The example on `/advertise/` uses the same partial**, so it always matches what sponsors get.
- **Banners** live in `_data/banners.json` (see `_docs`), with images in `static/banners/`. They render through `_includes/partials/banner.njk`, labelled **Ad**, `rel="sponsored"`. Empty banner slots render nothing.
  - `category` — one image banner per category (1200×300), placed after the 4th listing on lists of 6 or more (`midBanner` filter).
  - `sidebar` — one site-wide image banner (600×500) in the right column of category pages, guides, the blog, the homepage, Start here and About.
- **Category sidebar** shows at most one ad slot. The order is: More in <section>, newsletter, the ad slot, then the compact mutuals promo (only when the category has no feature mutuals promo). The ad slot is the sidebar banner if one is set. If not, it is the open "Your business here" card, and only when the category has no paid sponsor.
- **Pricing** is on `/advertise/` (`content/advertise.njk`): sponsor card $39/mo or $350/yr per category, category banner $25/mo or $250/yr, sidebar banner $79/mo, $25/issue newsletter classified. Homepage and guide-page slots: "ask for pricing". Enquiries come in through the Tally form (tally.so/r/dbaRVr) or by email (vancouver@bolle.co).
- **Newsletter classifieds** live in `_data/classifieds.json` (see `_docs` in the file). The weekly newsletter script (`scripts/newsletter.mjs`) includes the first active listing per issue, clearly labeled as paid; entries expire via their `until` date. Preview with `node scripts/newsletter.mjs --dry-run`.
- Community groups are never charged — sponsorships are for businesses (studios, gyms, shops, venues) only, and must pass the same "can I find my people here?" test. Sponsorship never buys, changes, or removes a regular listing.
- **mutuals** (mutuals.fm, Patrick's neighbourhood book club site) is promoted as "Our sister site". All copy and links come from `_data/mutuals.js`; every link goes to the mutuals.fm homepage with a per-placement `utm_campaign`. Don't write "free" in its listing copy — the /free/ page would count it. On category pages, the large promo sits below the listings.

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

## Submissions

The submit form opens a PR on a `submission/*` branch. `.github/workflows/review-submissions.yml` reviews all open submission PRs with Claude every Monday (18:00 UTC), and you can run it by hand from the Actions tab. For each PR it:

- closes duplicates and clear fails (online-only, one-off events, transactional businesses, outside Metro Vancouver, spam) with a short, kind comment;
- rebuilds clear passes on top of main as one clean entry (plus `recentGroups.js`), runs the build, and merges;
- asks @patrickbolle one question on anything uncertain, then skips that PR until he replies. Its comments carry the `<!-- weekly-submission-review -->` marker.

The run's job summary lists what happened to each PR.

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
- **Every page uses the same parts**: `.frame.page`, `.page-title`/`.page-lede`, `.columns` (`.col-main` + `.col-side`), `.panel` with `.panel-title` and `.panel-body`, `.link-list`. Don't add one-off page components. The columns stack below 900px.
- **Landmarks**: the footer sits outside `<main>` (main.js swaps only `<main>`, so the footer stays put). Inside `.col-side` (an `<aside>`), use `<section aria-label>` for promos and ads, not another `<aside>`. Breadcrumbs are `<nav aria-label="Breadcrumb"><ol>` with `aria-current="page"` on the last item.
- **Four type sizes only**: `--fs-sm`, `--fs-base`, `--fs-lg`, `--fs-xl` (rem). Panel padding uses `--panel-pad`, page edges `--gutter`. One exception: on phones (≤760px) text fields use 1rem, so iOS Safari doesn't zoom the page when you tap into them.
- **Colours are tokens** in `:root` (`--hover-bg`, `--field-border`, `--bevel-*`, `--target-bg`, `--success-line`, `--shadow-overlay` and the rest). Use them; don't type new hex values.
- **Two button looks**: green bevel (`.form-submit` and friends) for the main action, cream bevel (`.search-btn`, `.sponsor-btn`, `.verify-btn`) for secondary ones. Both live in the "Buttons" block of `src/style.css`. Masthead "Surprise me" is a plain underlined link-button so it doesn't compete with Search.
- **Allowed early-web touches**: the 2px dither line (`--dither`) under homepage section headings, the "New lists" row and the footer top, and the footer's odometer hit counter. Keep them; don't add more.
- **Pixel art in three places only**: the logo (`static/favicon.svg`), the masthead treeline, the section icons (`static/icons/`). Hard 1px edges and 2px offset shadows elsewhere. No pixel fonts, and the pixel art stays still. Short fades on dialogs and toasts and quick (0.15–0.2s) hover/focus changes are fine; `prefers-reduced-motion` turns them all off. Don't add motion for its own sake.
- **Motion** (end of `src/style.css`): small and physical, like paper on a board. Surprise me pins its card (drop + push-pin), shared links sweep a highlighter over their card, the hit counter rolls, search results settle in once, "+N more" slides open, tab underlines grow on hover, copied labels turn green. Feedback 100–150ms, state 200–300ms, `--ease-out`, no bounce. Spatial motion goes inside `@media (prefers-reduced-motion: no-preference)`.
- **Accessibility helpers in `src/main.js`**: `a11yDialog.open/close` (makes the page inert and loops Tab — use it for any new modal) and `announce()` (one polite live region for status updates). A build transform adds "(opens in new tab)" to every `target="_blank"` link. Group card names are the exception: they use `aria-describedby="new-tab-note"` (one hidden note per category page), so the h3 text stays just the name. Keep visible focus (cream on the masthead), field borders at 3:1 or more, and links underlined.

### Design Principles
1. **Feel made by a person, not a product team.** Personal voice, slight warmth in the details.
2. **Warmth before utility.** The emotional experience lands first.
3. **Cozy density.** Dense but delightful to browse.
4. **Old soul, modern hands.** Serif type, warm palette, but effortless navigation.
5. **Content is the hero.** Design should surface communities quickly and get out of the way.
