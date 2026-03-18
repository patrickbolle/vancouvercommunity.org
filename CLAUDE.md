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
