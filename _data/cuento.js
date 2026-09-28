// Cuento promotion: the ONE place for the product name, URL, and promo copy.
//
// Renaming Cuento? Change `name` and `domain` below. Every promo block, the
// footer, the about page, the book clubs / social listings, and the blog
// mentions all read from this file.
//
// Markdown files can use {{ cuento.name }}, {{ cuento.domain }} and
// {{ cuento.links.<key> }}. The categories collection and recentGroups.js run
// the same tokens through `expand()` so schema, search, and "Recently added"
// see the real values too.
//
// Brand voice (from Cuento's CLAUDE.md): warm, unhurried, plain. No emoji, no
// exclamation points, no hype or urgency, nothing twee. Say "circle", not
// "club" ("book club" is fine as a search phrase). Never invent stats or
// member counts. Link to the website only (the text-number flow is not public).

const name = "Cuento";
const domain = "cuento.app";
const url = "https://" + domain;

// Every cuento.app link carries these UTM params. `placement` becomes
// utm_campaign so each slot can be compared in Cuento's analytics.
function link(placement, path) {
  const params = new URLSearchParams({
    utm_source: "vancouvercommunities",
    utm_medium: "referral",
    utm_campaign: placement || "site",
  });
  return url + (path || "/") + "?" + params.toString();
}

const price = "Free to join. $15 only when we find your circle.";
const pitch =
  name +
  " matches Vancouver neighbours into small reading circles: 4 to 8 people nearby who love the same books, meeting at a local café.";

// Contextual copy for category pages. Categories listed here get the large
// promo at the top of the page. Every other category gets the compact promo
// near the bottom.
const categories = {
  "book-clubs": {
    heading: "Want a book club close to home?",
    body:
      name +
      " matches you with 4 to 8 readers in your neighbourhood who love the same books. Your circle meets at a local café.",
  },
  "social-friend-clubs": {
    heading: "Make friends through books",
    body:
      "A small group that meets again and again is the easiest way to make friends. " +
      name +
      " matches you with 4 to 8 neighbours who love the same books, meeting at a café nearby.",
  },
  writing: {
    heading: "Read with your neighbours, too",
    body:
      "Good writers read a lot. " +
      name +
      " matches you with 4 to 8 people nearby who love the same books, meeting at a local café.",
  },
  "philosophy-intellectual": {
    heading: "Prefer your big ideas in book form?",
    body:
      name +
      " matches you with 4 to 8 neighbours who love the same books. Your circle meets at a local café to talk them through.",
  },
  "poetry-spoken-word": {
    heading: "A reading circle near you",
    body:
      name +
      " matches you with 4 to 8 neighbours who love the same books, meeting at a local café.",
  },
};

const cuento = {
  name,
  domain,
  url,
  link,
  price,
  pitch,
  tagline: "Small reading circles for Vancouver neighbours",
  cta: "Find your reading circle",
  // Honest disclosure: Cuento is Patrick's own project.
  label: "From the maker of this directory",
  compactText:
    "Looking for a small, regular group? " +
    name +
    " matches Vancouver neighbours into reading circles of 4 to 8 people who love the same books.",
  categories,
  // Pre-built links for markdown content (keyed by placement).
  links: {
    listingBookClubs: link("listing-book-clubs", "/vancouver"),
    listingSocial: link("listing-social-friend-clubs", "/vancouver"),
    blogBookClubs: link("blog-best-book-clubs"),
  },
};

// Replace {{ cuento.x }} / {{ cuento.links.x }} tokens in raw markdown.
// Used where Eleventy reads content files directly (collections, recentGroups).
cuento.expand = function (raw) {
  return String(raw).replace(/\{\{\s*cuento\.([\w.]+)\s*\}\}/g, (match, key) => {
    const value = key.split(".").reduce((obj, k) => (obj == null ? obj : obj[k]), cuento);
    return typeof value === "string" ? value : match;
  });
};

module.exports = cuento;
