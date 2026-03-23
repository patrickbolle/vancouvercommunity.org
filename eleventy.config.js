const markdownItAnchor = require("markdown-it-anchor");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {
  // --- Passthrough copies (preserves existing URL paths) ---
  eleventyConfig.addPassthroughCopy({ "src/style.css": "_build/style.css" });
  eleventyConfig.addPassthroughCopy({ "src/main.js": "_build/main.js" });
  eleventyConfig.addPassthroughCopy({ "static": "/" });

  // --- Markdown: add anchor links to h2 headings ---
  eleventyConfig.amendLibrary("md", (mdLib) => {
    mdLib.use(markdownItAnchor, {
      level: [2],
      permalink: markdownItAnchor.permalink.ariaHidden({
        placement: "after",
        symbol: "#",
        class: "anchor",
      }),
    });

    // Open external links in new tab with noopener noreferrer
    const defaultRender = mdLib.renderer.rules.link_open || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
    mdLib.renderer.rules.link_open = function(tokens, idx, options, env, self) {
      const href = tokens[idx].attrGet("href");
      if (href && href.startsWith("http")) {
        // Add referral parameter to external links
        try {
          const url = new URL(href);
          if (!url.searchParams.has("ref")) {
            url.searchParams.set("ref", "vancouvercommunity.org");
            tokens[idx].attrSet("href", url.toString());
          }
          const domain = url.hostname.replace("www.", "");
          tokens[idx].attrSet("data-umami-event", "outbound-link");
          tokens[idx].attrSet("data-umami-event-url", domain);
        } catch (e) {}
        tokens[idx].attrSet("target", "_blank");
        tokens[idx].attrSet("rel", "noopener noreferrer");
      }
      return defaultRender(tokens, idx, options, env, self);
    };
  });

  // --- Collection: categories (all .md files with tag: category) ---
  // Compute group counts from raw markdown (## headings before first ---)
  eleventyConfig.addCollection("categories", function (collectionApi) {
    const cats = collectionApi
      .getFilteredByTag("category")
      .sort((a, b) => (a.data.order || 999) - (b.data.order || 999));

    for (const cat of cats) {
      const raw = fs.readFileSync(cat.inputPath, "utf-8");
      // Strip frontmatter
      const body = raw.replace(/^---[\s\S]*?---\s*/, "");
      const beforeHr = body.split(/^---$/m)[0];
      const h2s = beforeHr.match(/^## /gm);
      cat.data.groupCount = h2s ? h2s.length : 0;

      // Extract structured group data for schema markup
      const sections = beforeHr.split(/^## /m).slice(1); // skip content before first h2
      cat.data.groupItems = sections.map((section) => {
        const lines = section.trim().split("\n");
        const name = lines[0].trim();
        const whatMatch = section.match(/\*\*What:\*\*\s*(.+)/);
        const findMatch = section.match(/\*\*Find it:\*\*\s*\[.*?\]\((https?:\/\/[^)]+)\)/);
        const whereMatch = section.match(/\*\*Where:\*\*\s*(.+)/);
        return {
          name,
          description: whatMatch ? whatMatch[1].trim() : "",
          url: findMatch ? findMatch[1] : "",
          location: whereMatch ? whereMatch[1].trim() : "",
        };
      }).filter((g) => g.name && g.description);
    }

    return cats;
  });

  // --- Global data: recently added groups (from git history) ---
  eleventyConfig.addGlobalData("recentGroups", () => {
    try {
      const log = execSync(
        'git log --pretty=format:"%ai|%s" --since="60 days ago" -- content/*.md',
        { encoding: "utf-8" }
      );
      const additions = log.split("\n")
        .filter((line) => line.includes("|Add ") || line.includes("|add "))
        .map((line) => {
          const [date, ...msgParts] = line.split("|");
          const msg = msgParts.join("|");
          const match = msg.match(/Add (.+?) to (.+)/i);
          if (!match) return null;
          return {
            name: match[1].trim(),
            categorySlug: match[2].trim(),
            date: date.trim().split(" ")[0], // YYYY-MM-DD
          };
        })
        .filter(Boolean);

      // Cross-reference with actual markdown content to get descriptions
      for (const entry of additions) {
        const filePath = path.join("content", entry.categorySlug + ".md");
        if (!fs.existsSync(filePath)) continue;
        const raw = fs.readFileSync(filePath, "utf-8");
        const frontmatter = raw.match(/^---[\s\S]*?---/);
        const titleMatch = frontmatter && frontmatter[0].match(/title:\s*"(.+?)"/);
        entry.categoryTitle = titleMatch ? titleMatch[1] : entry.categorySlug;

        // Find this group's section in the markdown
        const regex = new RegExp("## " + entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\n([\\s\\S]*?)(?=\\n## |\\n---|$)");
        const sectionMatch = raw.match(regex);
        if (sectionMatch) {
          const whatMatch = sectionMatch[1].match(/\*\*What:\*\*\s*(.+)/);
          const findMatch = sectionMatch[1].match(/\*\*Find it:\*\*\s*\[.*?\]\((https?:\/\/[^)]+)\)/);
          entry.description = whatMatch ? whatMatch[1].trim() : "";
          entry.url = findMatch ? findMatch[1] : "";
        }
      }

      return additions.filter((e) => e.description).slice(0, 8);
    } catch (e) {
      return [];
    }
  });

  // --- Filter: strip the h1 line from rendered markdown content ---
  eleventyConfig.addFilter("stripH1", function (content) {
    if (!content) return content;
    return content.replace(/^<h1[^>]*>.*?<\/h1>\s*/i, "");
  });

  // --- Filter: HTML-escape ampersands for sidebar labels ---
  eleventyConfig.addFilter("ampEscape", function (str) {
    return str ? str.replace(/&/g, "&amp;") : str;
  });

  // --- Shortcode: current build date ---
  eleventyConfig.addShortcode("buildDate", function () {
    return new Date().toISOString();
  });

  eleventyConfig.addShortcode("buildDateHuman", function () {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  });

  // --- Watch targets ---
  eleventyConfig.addWatchTarget("src/");

  return {
    dir: {
      input: "content",
      output: "site",
      includes: "../_includes",
      data: "../_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
