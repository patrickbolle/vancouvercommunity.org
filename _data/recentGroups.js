const fs = require("fs");
const path = require("path");

// Recently added groups — update this list when new groups are merged.
// The build enriches each entry with description and category title from the markdown.
const recent = [
  { name: "Vision Zero Vancouver", categorySlug: "volunteer" },
  { name: "Shoreline Rescue Club", categorySlug: "volunteer" },
  { name: "Vancouver Gaymers", categorySlug: "board-games" },
  { name: "Pitch n Putt Player's Club", categorySlug: "hiking-outdoors" },
  { name: "New West Improv", categorySlug: "improv-comedy" },
  { name: "Vancouver Pen Club", categorySlug: "writing" },
];

module.exports = function () {
  return recent.map((entry) => {
    const filePath = path.join("content", entry.categorySlug + ".md");
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");

    const frontmatter = raw.match(/^---[\s\S]*?---/);
    const titleMatch = frontmatter && frontmatter[0].match(/title:\s*"(.+?)"/);
    const categoryTitle = titleMatch ? titleMatch[1] : entry.categorySlug;

    const regex = new RegExp(
      "## " + entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "\\n([\\s\\S]*?)(?=\\n## |\\n---|$)"
    );
    const sectionMatch = raw.match(regex);
    if (!sectionMatch) return null;

    const whatMatch = sectionMatch[1].match(/\*\*What:\*\*\s*(.+)/);
    if (!whatMatch) return null;

    return {
      name: entry.name,
      categorySlug: entry.categorySlug,
      categoryTitle,
      description: whatMatch[1].trim(),
    };
  }).filter(Boolean);
};
