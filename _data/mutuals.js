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

const price = "Free to join. $15 when your group is ready. No subscription.";
const pitch =
  name +
  " matches Vancouver readers into small neighbourhood book clubs: 4 to 8 people nearby who love the same kinds of books.";

// Contextual copy for category pages. Categories listed here get the large
// promo at the top of the page. Every other category gets the compact promo
// near the bottom.
const categories = {
  "book-clubs": {
    heading: "Want a book club close to home?",
    body:
      name +
      " matches you with 4 to 8 readers in your neighbourhood who love the same kinds of books, then introduces you by email.",
  },
  "social-friend-clubs": {
    heading: "Make friends through books",
    body:
      "A small group that meets again and again is one of the easiest ways to get to know people. " +
      name +
      " matches you with 4 to 8 neighbours who love the same kinds of books.",
  },
  writing: {
    heading: "Read with your neighbours, too",
    body:
      "Good writers read a lot. " +
      name +
      " matches you with 4 to 8 people nearby who love the same kinds of books.",
  },
  "philosophy-intellectual": {
    heading: "Prefer your big ideas in book form?",
    body:
      name +
      " matches you with 4 to 8 neighbours who love the same kinds of books, so you have people to talk them through with.",
  },
  "poetry-spoken-word": {
    heading: "A book club near you",
    body:
      name +
      " matches you with 4 to 8 neighbours who love the same kinds of books.",
  },
};

const mutuals = {
  name,
  domain,
  url,
  link,
  price,
  pitch,
  tagline: "Small neighbourhood book clubs in Vancouver",
  cta: "Find my book club",
  // Honest disclosure: mutuals is Patrick's own project.
  label: "From the maker of this directory",
  compactText:
    "Looking for a small, regular group? " +
    name +
    " matches Vancouver readers into neighbourhood book clubs of 4 to 8 people who love the same kinds of books.",
  categories,
  // Pre-built links for markdown content (keyed by placement).
  links: {
    listingBookClubs: link("listing-book-clubs", "/vancouver"),
    listingSocial: link("listing-social-friend-clubs", "/vancouver"),
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
