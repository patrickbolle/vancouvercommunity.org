// Neighbourhood guide definitions. Each renders a page at
// /neighbourhoods/{slug}/ that pairs editorial character with the real
// directory groups matching `aliases` (matched against each group's name,
// location, and description via the `neighbourhoodGroups` filter).
//
// Keep `aliases` specific enough to avoid false matches. `intro` and
// `character` are the editorial anchor — evergreen neighbourhood character,
// not claims about specific groups (the group list carries specifics).

module.exports = [
  {
    slug: "kitsilano",
    name: "Kitsilano",
    aliases: "kitsilano, kits, jericho, point grey, west 4th",
    tagline: "Beach mornings, run clubs, and a wellness streak a mile wide.",
    metaDescription:
      "Things to do and people to meet in Kitsilano — run clubs, beach volleyball, yoga and wellness communities, book clubs, and more, from Vancouver's community directory.",
    intro:
      "Kitsilano is the west-side neighbourhood that treats the outdoors as a lifestyle. Between the beach, the pool, the seawall, and West 4th's studios and cafés, it draws people who like to move — and, quietly, people who moved here and are trying to build a social life around all that motion.",
    character: [
      "If Vancouver has a wellness capital, it's Kits. The stereotype — beach yoga, a run before work, a smoothie after — is a stereotype because it's mostly true, and it makes the neighbourhood unusually easy to meet people in. Almost everything social here is built around an activity.",
      "Kits Beach is the anchor: volleyball courts, the outdoor pool, and a stretch of sand that turns into an impromptu social scene the moment the sun's out. Run clubs launch from here and from the running shops along West 4th. The seawall connects it all the way to Jericho, where the sailing and windsurfing crowd keeps a looser, saltier version of the same energy.",
      "It's a west-side neighbourhood, which means it skews a little older and a little more established than East Van — but the flip side is consistency. The groups that meet in Kits tend to have been meeting for years, which is exactly what you want when you're trying to become a regular somewhere.",
    ],
  },
  {
    slug: "east-vancouver",
    name: "East Vancouver",
    aliases:
      "east vancouver, east van, commercial drive, commercial-broadway, trout lake, strathcona, hastings-sunrise, grandview",
    tagline: "The city's community heart — diverse, bohemian, and joiner-friendly.",
    metaDescription:
      "Things to do and people to meet in East Vancouver — Commercial Drive, Trout Lake, and beyond. Community groups, clubs, and meetups from Vancouver's directory.",
    intro:
      "East Vancouver is where the city feels most like a collection of neighbourhoods rather than a skyline. Commercial Drive, Trout Lake, Strathcona — this is the part of town with the deepest community roots, and it shows in how many groups meet here.",
    character: [
      "If you're new to Vancouver and worried it's cold and hard to crack, East Van is the antidote. It's the most joiner-friendly part of the city: diverse, a little bohemian, and full of people who organize things — reading groups, dodgeball leagues, community dinners, art nights.",
      "Commercial Drive (\"the Drive\") is the spine — Italian cafés next to vegan spots next to co-ops, and a walkable density that makes running into people the default. Trout Lake / John Hendry Park is East Van's living room, with its farmers market, the community centre, and enough open field for any group meetup under fifty people. Strathcona and Hastings-Sunrise bring the maker and studio energy.",
      "The whole area rewards showing up. It's the kind of place where a book club becomes a friend group and a dodgeball team becomes a standing Friday. If you only explore one part of Vancouver's community scene, make it this one.",
    ],
  },
  {
    slug: "mount-pleasant",
    name: "Mount Pleasant",
    aliases:
      "mount pleasant, mt pleasant, main street, main st, brewery district, olympic village",
    tagline: "Breweries, makers, and the young creative middle of the city.",
    metaDescription:
      "Things to do and people to meet in Mount Pleasant — Main Street and the Brewery District. Maker spaces, art groups, run clubs, and community meetups in Vancouver.",
    intro:
      "Mount Pleasant is Vancouver's creative middle — geographically central, culturally young, and dense with the kind of places community actually forms in: breweries, maker spaces, studios, and the endless small businesses of Main Street.",
    character: [
      "This is the neighbourhood for people in their twenties and thirties trying to find their creative crowd. The Brewery District alone does a surprising amount of social heavy-lifting — run clubs that finish at a taproom, trivia nights, board-game meetups — because a brewery is just a community centre that sells beer.",
      "Main Street is the axis: vintage shops, indie coffee, galleries, and a steady supply of pop-ups and openings. Mount Pleasant and the neighbouring Brewery District/Olympic Village stretch is also where a lot of the city's makers work — pottery studios, print shops, and maker spaces cluster here, and most run classes that double as the easiest way to meet people with your hands busy.",
      "It's walkable, it's central, and it's the part of town where \"want to come to a thing on Main?\" is a complete sentence. If you want to be near everything and everyone, start here.",
    ],
  },
];
