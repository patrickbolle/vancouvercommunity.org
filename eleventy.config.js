const markdownItAnchor = require("markdown-it-anchor");
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


  // --- Collection: blog posts ---
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi
      .getFilteredByTag("post")
      .sort((a, b) => b.date - a.date);
  });

  // --- Filter: format date for blog ---
  eleventyConfig.addFilter("readableDate", function (date) {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // --- Filter: strip the h1 line from rendered markdown content ---
  eleventyConfig.addFilter("stripH1", function (content) {
    if (!content) return content;
    return content.replace(/^<h1[^>]*>.*?<\/h1>\s*/i, "");
  });

  // --- Filter: transform h2+ul group entries into card layout ---
  eleventyConfig.addFilter("cardify", function (content) {
    if (!content) return content;

    return content.replace(
      /<h2 id="([^"]*)"[^>]*>((?:[^<]|<(?!\/h2>))*)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g,
      function (match, id, h2Inner, ulInner) {
        // Extract name (strip anchor link)
        var name = h2Inner.replace(/<a[\s\S]*?<\/a>/, "").trim();

        // Parse fields from list items
        var fields = {};
        ulInner.replace(
          /<li>\s*<strong>([\w\s]+):<\/strong>\s*([\s\S]*?)\s*<\/li>/g,
          function (_, key, val) {
            fields[key.trim().toLowerCase()] = val.trim();
          }
        );

        var desc = fields["what"] || "";
        var where = (fields["where"] || "").replace(/<[^>]+>/g, "");
        var cost = (fields["cost"] || "").replace(/<[^>]+>/g, "");
        var size = (fields["size"] || "").replace(/<[^>]+>/g, "");
        var findIt = fields["find it"] || "";
        var urlM = findIt.match(/href="([^"]+)"/);
        var url = urlM ? urlM[1] : "";

        // Detect "Free" from cost field or description
        var badge = cost;
        if (!badge) {
          var plainDesc = desc.replace(/<[^>]+>/g, "").toLowerCase();
          if (/\bfree\b/.test(plainDesc)) badge = "Free";
        }

        var c = '<div class="group-card" id="' + id + '">';
        c += '<div class="group-card-header">';
        c += "<h2>" + name + "</h2>";
        if (badge)
          c += '<span class="group-card-badge">' + badge + "</span>";
        c += "</div>";
        if (desc) c += '<p class="group-card-desc">' + desc + "</p>";
        var metas = [];
        if (where)
          metas.push(
            '<span class="group-card-where">\u{1F4CD} ' + where + "</span>"
          );
        if (size) metas.push('<span class="group-card-size">' + size + "</span>");
        if (metas.length)
          c += '<div class="group-card-meta">' + metas.join("") + "</div>";
        if (url)
          c +=
            '<a href="' +
            url +
            '" class="group-card-link" target="_blank" rel="noopener noreferrer" data-umami-event="outbound-link">Visit \u2192</a>';
        c += '<a class="anchor" href="#' + id + '">#</a>';
        c += "</div>";
        return c;
      }
    );
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
