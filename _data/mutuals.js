// mutuals promotion: the ONE place for the product name, URL, and promo copy.
// (mutuals was called Cuento until October 2026.)
//
// Renaming again? Change `name` and `domain` below. Every promo block, the
// footer, the about page, the book clubs / social listings, and the blog
// mentions all read from this file.
//
// Markdown files can use {{ mutuals.name }}, {{ mutuals.domain }} and
// {{ mutuals.links.<key> }}. The categories collection and recentGroups.js run
// the same tokens through `expand()` so schema, search, and "Recently added"
// see the real values too.
//
// Brand rules (from the mutuals brand guide): write "mutuals" in lowercase,
// even at the start of a sentence. Say "book club" in public copy. State fees
// plainly: free to join, $15 when your group is ready, no subscription, one
// free rematch. Never invent stats, member counts, testimonials, or promise
// friendships. Link to the website only.

const name = "mutuals";
const domain = "mutuals.fm";
const url = "https://" + domain;

// Every mutuals.fm link carries these UTM params. `placement` becomes
// utm_campaign so each slot can be compared in mutuals' analytics.
function link(placement, path) {
  const params = new URLSearchParams({
    utm_source: "vancouvercommunities",
    utm_medium: "referral",
    utm_campaign: placement || "site",
  });
  return url + (path || "/") + "?" + params.toString();
}

const price = "Free to join · $15 when your group is ready · no subscription";
const pitch =
  name +
  " matches Vancouver readers into small neighbourhood book clubs: 4 to 8 people nearby who love the same kinds of books.";

// Contextual copy for category pages. Categories listed here get the large
// promo at the top of the page. Every other category gets the compact promo
// near the bottom.
// The approved mutuals headline and the three steps, from mutuals.fm.
const headline = "A Vancouver book club you'll look forward to.";
const steps = [
  "Tell it a few books you love.",
  "It matches you with 4 to 8 nearby readers who like the same books, from Kits to East Van.",
  "You get introduced by email and pick your first book together.",
];

// Contextual copy for category pages. Categories listed here get the large
// promo at the top of the page; every other category gets the compact promo.
// `heading` replaces the headline; `lead` is one optional sentence before the
// steps. Keep leads short and don't restate the steps.
const categories = {
  "book-clubs": {
    heading: "Want a book club close to home?",
    lead: "",
  },
  "social-friend-clubs": {
    heading: "Make friends through books",
    lead: "A small group that meets again and again is one of the easiest ways to get to know people.",
  },
  writing: {
    heading: "Read with your neighbours, too",
    lead: "Good writers read a lot.",
  },
  "philosophy-intellectual": {
    heading: "Prefer your big ideas in book form?",
    lead: "Big ideas are better with people to talk them through.",
  },
  "poetry-spoken-word": {
    heading: "A book club near you",
    lead: "",
  },
};

const mutuals = {
  name,
  domain,
  url,
  link,
  price,
  pitch,
  headline,
  steps,
  tagline: "Small neighbourhood book clubs in Vancouver",
  cta: "Find my book club",
  // Honest disclosure: mutuals is Patrick's own project.
  // Honest but short: say plainly that it is connected to this directory.
  label: "Our sister site",
  compactText:
    "Looking for a small, regular group? " +
    name +
    " matches Vancouver readers into neighbourhood book clubs of 4 to 8 people who love the same kinds of books.",
  categories,
  // Pre-built links for markdown content (keyed by placement).
  links: {
    listingBookClubs: link("listing-book-clubs"),
    listingSocial: link("listing-social-friend-clubs"),
    blogBookClubs: link("blog-best-book-clubs"),
  },
};

// Replace {{ mutuals.x }} / {{ mutuals.links.x }} tokens in raw markdown.
// Used where Eleventy reads content files directly (collections, recentGroups).
mutuals.expand = function (raw) {
  return String(raw).replace(/\{\{\s*mutuals\.([\w.]+)\s*\}\}/g, (match, key) => {
    const value = key.split(".").reduce((obj, k) => (obj == null ? obj : obj[k]), mutuals);
    return typeof value === "string" ? value : match;
  });
};

module.exports = mutuals;
