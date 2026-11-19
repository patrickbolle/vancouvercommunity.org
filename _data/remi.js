// Remi promotion: the one place for Remi's name, URL and promo copy.
// Remi is the texting sister product (remi.fm): it texts people the best things
// to do in Vancouver, with reminders and people to go with. Lowercase "remi" in
// the wordmark, "Remi" in sentences. No invented stats or promises.

const name = "Remi";
const domain = "remi.fm";
const url = "https://" + domain;

// Every remi.fm link carries these UTM params; `placement` becomes utm_campaign.
function link(placement, path) {
  const params = new URLSearchParams({
    utm_source: "vancouvercommunities",
    utm_medium: "referral",
    utm_campaign: placement || "site",
  });
  return url + (path || "/") + "?" + params.toString();
}

module.exports = {
  name,
  domain,
  url,
  link,
  label: "Want someone to drag you along?",
  text: "Remi texts you the best of what's on, reminds you so you actually go, and finds you people to go with.",
  cta: "Text Remi",
};
