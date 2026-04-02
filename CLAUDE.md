# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A community directory for Vancouver, BC — a static site listing 35+ categories of local groups, clubs, and meetups. Content lives in markdown files in `content/`; Eleventy (11ty) converts them to HTML pages in `site/` (gitignored).

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
- `_data/` contains shared data (site config, group definitions)
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
- Branch prefix: `claude/` for automated changes
- One change per PR (one group removed, one link updated, etc.)
- PR descriptions should be 1-3 sentences explaining what and why
- Link to the triggering issue in the PR body when applicable: `Resolves #123`

## Deployment

Cloudflare Pages builds the site on push (`npm run build`) and deploys from `site/`. The `site/` directory is gitignored — never commit built output. The GitHub Action in `.github/workflows/build.yml` runs the build as a CI check only.

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

### Design Principles
1. **Feel made by a person, not a product team.** Personal voice, slight warmth in the details.
2. **Warmth before utility.** The emotional experience lands first.
3. **Cozy density.** Dense but delightful to browse.
4. **Old soul, modern hands.** Serif type, warm palette, but effortless navigation.
5. **Content is the hero.** Design should surface communities quickly and get out of the way.
