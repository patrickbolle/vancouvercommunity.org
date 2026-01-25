#!/bin/bash
# Build script: converts markdown files to HTML with full sidebar on every page

set -e

SITE_DIR="site"
SITE_URL="https://vancouver-communities.pages.dev"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_DATE_HUMAN=$(date -u +"%B %Y")

# Category metadata
declare -A titles=(
  ["dinner-supper-clubs"]="Dinner & Supper Clubs"
  ["social-friend-clubs"]="Social & Friend Clubs"
  ["run-clubs"]="Run Clubs"
  ["board-games"]="Board Games"
  ["creative-art"]="Creative & Art"
  ["photography"]="Photography"
  ["film-cinema"]="Film & Cinema"
  ["writing"]="Writing"
  ["language-exchange"]="Language Exchange"
  ["hiking-outdoors"]="Hiking & Outdoors"
  ["cycling"]="Cycling"
  ["dance"]="Dance"
  ["improv-comedy"]="Improv & Comedy"
  ["music-open-mic"]="Music & Open Mic"
  ["climbing"]="Climbing"
  ["pickleball"]="Pickleball"
  ["pottery-ceramics"]="Pottery & Ceramics"
  ["yoga-wellness"]="Yoga & Wellness"
  ["sauna-cold-plunge"]="Sauna & Cold Plunge"
  ["mindfulness-meditation"]="Mindfulness & Meditation"
  ["mens-groups"]="Men's Groups"
  ["maker-spaces"]="Maker Spaces"
  ["philosophy-intellectual"]="Philosophy & Intellectual"
  ["book-clubs"]="Book Clubs"
  ["tech-startup"]="Tech & Startup"
  ["coworking"]="Coworking"
  ["volunteer"]="Volunteer"
  ["vinyl-listening-bars"]="Vinyl & Listening Bars"
  ["chess"]="Chess"
  ["underground-dj"]="Underground DJ"
  ["poetry-spoken-word"]="Poetry & Spoken Word"
  ["tarot-astrology"]="Tarot & Astrology"
  ["flea-markets-vintage"]="Flea Markets & Vintage"
  ["pub-trivia"]="Pub Trivia"
  ["zine-risograph"]="Zine & Risograph"
  ["astronomy-stargazing"]="Astronomy & Stargazing"
  ["foraging-nature"]="Foraging & Nature"
  ["birdwatching"]="Birdwatching"
  ["karaoke"]="Karaoke"
  ["resources"]="Resources"
)

declare -A descriptions=(
  ["dinner-supper-clubs"]="Find dinner clubs and supper clubs in Vancouver. Meet new people over curated meals and social dining."
  ["social-friend-clubs"]="Vancouver social clubs and friend-making groups. Connect through organized meetups and community events."
  ["run-clubs"]="Vancouver running clubs and social runs. Find free group runs and running communities for all levels."
  ["board-games"]="Board game cafes and game nights in Vancouver. Weekly meetups, gaming cafes, and tabletop communities."
  ["creative-art"]="Vancouver art collectives and creative communities. Studios, workshops, and groups for artists."
  ["photography"]="Vancouver photography clubs and photo walks. Community shoots and photography meetups."
  ["film-cinema"]="Vancouver film clubs and cinema events. Independent screenings and film societies."
  ["writing"]="Vancouver writing groups and workshops. Critique circles and literary communities."
  ["language-exchange"]="Language exchange meetups in Vancouver. Practice languages with native speakers."
  ["hiking-outdoors"]="Vancouver hiking groups and outdoor clubs. Find trail buddies and adventure communities."
  ["cycling"]="Vancouver cycling clubs and group rides. Social rides and cycling communities."
  ["dance"]="Dance classes and social dancing in Vancouver. Salsa, bachata, swing, and more."
  ["improv-comedy"]="Vancouver improv classes and comedy shows. Learn improv and join funny communities."
  ["music-open-mic"]="Open mics and jam sessions in Vancouver. Find stages and musicians to collaborate with."
  ["climbing"]="Vancouver climbing gyms and communities. Find climbing partners and bouldering meetups."
  ["pickleball"]="Pickleball courts and clubs in Vancouver. Drop-in games and leagues."
  ["pottery-ceramics"]="Pottery studios and ceramics classes in Vancouver. Wheel throwing and clay communities."
  ["yoga-wellness"]="Free yoga and wellness events in Vancouver. Community classes and outdoor yoga."
  ["sauna-cold-plunge"]="Sauna clubs and cold plunge spots in Vancouver. Contrast therapy and recovery communities."
  ["mindfulness-meditation"]="Meditation groups in Vancouver. Sitting groups and mindfulness meetups."
  ["mens-groups"]="Men's circles and support groups in Vancouver. Brotherhood and personal growth."
  ["maker-spaces"]="Vancouver maker spaces and workshops. Access tools and join the maker community."
  ["philosophy-intellectual"]="Philosophy meetups and discussion groups in Vancouver. Deep conversations."
  ["book-clubs"]="Vancouver book clubs and reading groups. Find your literary community."
  ["tech-startup"]="Vancouver tech meetups and startup community. Founders and developers connecting."
  ["coworking"]="Coworking spaces in Vancouver. Find your workspace community."
  ["volunteer"]="Volunteer opportunities in Vancouver. Give back through community service."
  ["vinyl-listening-bars"]="Vinyl bars and listening rooms in Vancouver. Record shops and audiophile community."
  ["chess"]="Chess clubs and cafe meetups in Vancouver. Find games and tournaments."
  ["underground-dj"]="Underground parties and DJ events in Vancouver. Warehouse raves and electronic music."
  ["poetry-spoken-word"]="Poetry slams and spoken word in Vancouver. Open mics and poetry nights."
  ["tarot-astrology"]="Tarot and astrology communities in Vancouver. Spiritual groups and readings."
  ["flea-markets-vintage"]="Flea markets and vintage events in Vancouver. Thrift and collector communities."
  ["pub-trivia"]="Pub trivia nights in Vancouver. Test your knowledge and find your team."
  ["zine-risograph"]="Zine making and risograph printing in Vancouver. DIY publishing community."
  ["astronomy-stargazing"]="Astronomy clubs and stargazing in Vancouver. Star parties and telescope nights."
  ["foraging-nature"]="Foraging tours and nature walks in Vancouver. Learn wild foods."
  ["birdwatching"]="Birdwatching groups in Vancouver. Birding walks and nature community."
  ["karaoke"]="Karaoke bars and nights in Vancouver. Sing your heart out."
  ["resources"]="Vancouver community resources and directories."
)

declare -A emojis=(
  ["dinner-supper-clubs"]="🍽️"
  ["social-friend-clubs"]="🤝"
  ["run-clubs"]="🏃"
  ["board-games"]="🎲"
  ["creative-art"]="🎨"
  ["photography"]="📷"
  ["film-cinema"]="🎬"
  ["writing"]="✍️"
  ["language-exchange"]="🗣️"
  ["hiking-outdoors"]="🥾"
  ["cycling"]="🚴"
  ["dance"]="💃"
  ["improv-comedy"]="🎭"
  ["music-open-mic"]="🎵"
  ["climbing"]="🧗"
  ["pickleball"]="🏓"
  ["pottery-ceramics"]="🏺"
  ["yoga-wellness"]="🧘"
  ["sauna-cold-plunge"]="🧊"
  ["mindfulness-meditation"]="🧘"
  ["mens-groups"]="👔"
  ["maker-spaces"]="🔧"
  ["philosophy-intellectual"]="🤔"
  ["book-clubs"]="📚"
  ["tech-startup"]="💼"
  ["coworking"]="💻"
  ["volunteer"]="🌿"
  ["vinyl-listening-bars"]="🎵"
  ["chess"]="♟️"
  ["underground-dj"]="🎧"
  ["poetry-spoken-word"]="🎤"
  ["tarot-astrology"]="🔮"
  ["flea-markets-vintage"]="🛍️"
  ["pub-trivia"]="🧠"
  ["zine-risograph"]="📖"
  ["astronomy-stargazing"]="🔭"
  ["foraging-nature"]="🍄"
  ["birdwatching"]="🐦"
  ["karaoke"]="🎤"
  ["resources"]="🔗"
)

# Ordered list for sidebar
categories_ordered=(
  "dinner-supper-clubs"
  "social-friend-clubs"
  "run-clubs"
  "board-games"
  "creative-art"
  "photography"
  "film-cinema"
  "writing"
  "language-exchange"
  "hiking-outdoors"
  "cycling"
  "dance"
  "improv-comedy"
  "music-open-mic"
  "climbing"
  "pickleball"
  "pottery-ceramics"
  "yoga-wellness"
  "sauna-cold-plunge"
  "mindfulness-meditation"
  "mens-groups"
  "maker-spaces"
  "philosophy-intellectual"
  "book-clubs"
  "tech-startup"
  "coworking"
  "volunteer"
  "vinyl-listening-bars"
  "chess"
  "underground-dj"
  "poetry-spoken-word"
  "tarot-astrology"
  "flea-markets-vintage"
  "pub-trivia"
  "zine-risograph"
  "astronomy-stargazing"
  "foraging-nature"
  "birdwatching"
  "karaoke"
  "resources"
)

# Convert group name to anchor slug
slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//'
}

# Convert markdown to HTML with anchor links on h2
md_to_html() {
  cat "$1" | \
    sed 's/^# \(.*\)//' | \
    sed 's/^## \(.*\)/<h2 id="__ANCHOR__">\1<a href="#__ANCHOR__" class="anchor">#<\/a><\/h2>/' | \
    sed 's/^### \(.*\)/<h3>\1<\/h3>/' | \
    sed 's/\*\*\([^*]*\)\*\*/<strong>\1<\/strong>/g' | \
    sed 's/\[\([^]]*\)\](\([^)]*\))/<a href="\2">\1<\/a>/g' | \
    sed 's/^- \(.*\)/<li>\1<\/li>/' | \
    sed 's/^---$/<hr>/' | \
    grep -v '^$' | \
    while IFS= read -r line; do
      if [[ "$line" == *"__ANCHOR__"* ]]; then
        # Extract the h2 text and create anchor
        h2_text=$(echo "$line" | sed 's/.*<h2 id="__ANCHOR__">\([^<]*\)<a.*/\1/')
        anchor=$(slugify "$h2_text")
        echo "$line" | sed "s/__ANCHOR__/$anchor/g"
      else
        echo "$line"
      fi
    done
}

# Generate sidebar HTML
generate_sidebar() {
  local current_slug="$1"
  local base_path="$2"
  
  echo '<nav class="sidebar">'
  echo '  <div class="sidebar-header">'
  echo "    <h1><a href=\"${base_path}\">📍 Vancouver Community</a></h1>"
  echo '  </div>'
  echo '  <ul>'
  
  for slug in "${categories_ordered[@]}"; do
    local title="${titles[$slug]}"
    local emoji="${emojis[$slug]}"
    local active=""
    [ "$slug" = "$current_slug" ] && active=' class="active"'
    echo "    <li><a href=\"${base_path}${slug}/\"${active}><span class=\"emoji\">${emoji}</span> ${title}</a></li>"
  done
  
  echo '  </ul>'
  echo '  <div class="sidebar-footer">'
  echo "    <a href=\"${base_path}submit/\">+ Submit a group</a><br>"
  echo "    <a href=\"#\" onclick=\"goRandom()\">🎲 Random</a><br>"
  echo '    <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fvancouver-communities.pages.dev&count_bg=%23666666&title_bg=%23555555&icon=&title=visits&edge_flat=true" alt="visitor count" style="height: 16px; vertical-align: middle;"><br>'
  echo "    Updated ${BUILD_DATE_HUMAN}<br>"
  echo '    Created by <a href="https://bolle.co" target="_blank">Patrick Bolle</a>'
  echo '  </div>'
  echo '</nav>'
}

# Common styles
STYLES='<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Georgia, "Times New Roman", serif;
  background: #fffef8;
  color: #222;
  line-height: 1.5;
  display: flex;
  min-height: 100vh;
}
a { color: #0066cc; text-decoration: none; }
a:hover { text-decoration: underline; }
a:visited { color: #551a8b; }

.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100vh;
  position: sticky;
  top: 0;
  overflow-y: auto;
  border-right: 1px solid #ddd;
  padding: 15px 0;
  background: #fafaf5;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
}
.sidebar::-webkit-scrollbar { width: 6px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

.sidebar-header {
  padding: 0 15px 12px;
  border-bottom: 1px solid #ddd;
  margin-bottom: 8px;
}
.sidebar-header h1 { font-size: 1.1em; font-weight: normal; }
.sidebar-header h1 a { color: inherit; }
.sidebar-header h1 a:hover { color: #0066cc; text-decoration: none; }

.sidebar ul { list-style: none; flex: 1; }
.sidebar li a {
  display: block;
  padding: 6px 15px;
  font-size: 0.9em;
  border-left: 3px solid transparent;
  color: #222;
}
.sidebar li a:visited { color: #222; }
.sidebar li a:hover { background: #f0f0e8; border-left-color: #0066cc; text-decoration: none; }
.sidebar li a.active { background: #f0f0e8; border-left-color: #0066cc; }
.emoji { display: inline-block; width: 22px; }
.sidebar-footer {
  padding: 12px 15px;
  border-top: 1px solid #ddd;
  font-size: 0.75em;
  color: #666;
  line-height: 1.8;
}
.sidebar-footer a { color: #666; }
.counter { font-size: 0.9em; }

.content {
  flex: 1;
  padding: 20px 30px;
  max-width: 700px;
  overflow-y: auto;
}
.content h1 { font-size: 1.4em; font-weight: normal; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
.content h2 { font-size: 1.1em; font-weight: normal; margin-top: 20px; margin-bottom: 8px; color: #333; position: relative; }
.content h2 .anchor { color: #ccc; font-size: 0.8em; margin-left: 5px; }
.content h2 .anchor:hover { color: #0066cc; }
.content li { margin: 5px 0; list-style: none; }
.content hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
.content a { color: #0066cc; }
.content a:visited { color: #551a8b; }

.welcome p { margin-bottom: 10px; color: #444; }

@media (max-width: 700px) {
  body { flex-direction: column; }
  .sidebar {
    width: 100%;
    min-width: 100%;
    height: auto;
    max-height: 40vh;
    position: relative;
    border-right: none;
    border-bottom: 1px solid #ddd;
  }
  .content { padding: 20px; }
}
</style>'

# Random redirect and counter scripts
SCRIPTS='<script>
const categories = ['"$(printf '"%s",' "${categories_ordered[@]}" | sed 's/,$//')"'];
function goRandom() {
  const cat = categories[Math.floor(Math.random() * categories.length)];
  window.location.href = "/" + cat + "/";
}
// Visitor counter (using hits.seeyoufarm.com badge API)
fetch("https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fvancouver-communities.pages.dev&count_bg=%23555555&title_bg=%23555555&title=visitors&edge_flat=true", {mode: "no-cors"})
  .catch(() => {});
</script>'

echo "Building site..."

# Build index (home page)
cat > "$SITE_DIR/index.html" << HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vancouver Community Directory - Find Your People</title>
  <meta name="description" content="A comprehensive guide to groups, clubs, meetups, and events for connection and community in Vancouver, BC.">
  <meta property="og:title" content="Vancouver Community Directory">
  <meta property="og:description" content="Find groups, clubs, meetups, and events for connection and community in Vancouver, BC.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}/">
  <link rel="canonical" href="${SITE_URL}/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="Vancouver Community Directory" href="/feed.xml">
  ${STYLES}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Vancouver Community Directory",
    "url": "${SITE_URL}",
    "description": "A comprehensive guide to groups, clubs, meetups, and events for connection and community in Vancouver, BC.",
    "publisher": {
      "@type": "Person",
      "name": "Patrick Bolle",
      "url": "https://bolle.co"
    }
  }
  </script>
</head>
<body>
$(generate_sidebar "" "/")
<main class="content">
  <h1>Welcome 👋</h1>
  <div class="welcome">
    <p>Vancouver can feel like a hard city to make friends and find community.</p>
    <p>This directory collects social groups, clubs, meetups, and events in one place.</p>
    <p style="margin-top: 15px; color: #666;">← Pick a category to explore</p>
    <hr style="margin: 25px 0;">
    <p style="font-size: 0.9em; color: #666;">Created by <a href="https://bolle.co">Patrick Bolle</a> for the Vancouver community.</p>
  </div>
</main>
${SCRIPTS}
</body>
</html>
HTMLEOF
echo "  Built: index"

# Build submit page
mkdir -p "$SITE_DIR/submit"
cat > "$SITE_DIR/submit/index.html" << HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submit a Group | Vancouver Community Directory</title>
  <meta name="description" content="Submit a community group, club, or meetup to be added to the Vancouver Community Directory.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  ${STYLES}
</head>
<body>
$(generate_sidebar "submit" "/")
<main class="content">
  <h1>Submit a Group</h1>
  <p>Know a community, club, or meetup that should be listed? Submit it below!</p>
  <p style="margin: 20px 0;">
    <a href="https://github.com/patrickbolle/vancouver-communities/issues/new?template=submit-group.md&title=New+Group:+[Name]" target="_blank" style="background: #f0f0e8; padding: 10px 15px; border: 1px solid #ddd;">
      Submit via GitHub →
    </a>
  </p>
  <p style="color: #666; font-size: 0.9em;">
    You'll need a GitHub account. Just fill in the template with the group name, description, and link.
  </p>
  <hr>
  <p style="color: #666; font-size: 0.9em;">
    Or email: <a href="mailto:hello@bolle.co?subject=Vancouver%20Community%20Submission">hello@bolle.co</a>
  </p>
</main>
${SCRIPTS}
</body>
</html>
HTMLEOF
echo "  Built: submit"

# Build each category page
for mdfile in *.md; do
  [ "$mdfile" = "README.md" ] && continue
  [ ! -f "$mdfile" ] && continue
  
  slug="${mdfile%.md}"
  title="${titles[$slug]:-$slug}"
  desc="${descriptions[$slug]:-}"
  emoji="${emojis[$slug]:-}"
  
  mkdir -p "$SITE_DIR/$slug"
  
  content=$(md_to_html "$mdfile")
  
  cat > "$SITE_DIR/$slug/index.html" << HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} in Vancouver | Vancouver Community Directory</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title} in Vancouver">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}/${slug}/">
  <link rel="canonical" href="${SITE_URL}/${slug}/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="Vancouver Community Directory" href="/feed.xml">
  ${STYLES}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${title} in Vancouver",
    "description": "${desc}",
    "url": "${SITE_URL}/${slug}/",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Vancouver Community Directory",
      "url": "${SITE_URL}"
    }
  }
  </script>
</head>
<body>
$(generate_sidebar "$slug" "/")
<main class="content">
  <h1>${emoji} ${title}</h1>
${content}
</main>
${SCRIPTS}
</body>
</html>
HTMLEOF

  echo "  Built: $slug"
done

# Generate sitemap.xml
cat > "$SITE_DIR/sitemap.xml" << XMLEOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
XMLEOF

for slug in "${categories_ordered[@]}"; do
  cat >> "$SITE_DIR/sitemap.xml" << XMLEOF
  <url>
    <loc>${SITE_URL}/${slug}/</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
XMLEOF
done

echo "</urlset>" >> "$SITE_DIR/sitemap.xml"
echo "  Built: sitemap.xml"

# Generate robots.txt
cat > "$SITE_DIR/robots.txt" << TXTEOF
User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
TXTEOF
echo "  Built: robots.txt"

# Generate RSS feed
cat > "$SITE_DIR/feed.xml" << RSSEOF
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Vancouver Community Directory</title>
  <description>A comprehensive guide to groups, clubs, meetups, and events in Vancouver, BC.</description>
  <link>${SITE_URL}</link>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
  <lastBuildDate>$(date -R)</lastBuildDate>
RSSEOF

for slug in "${categories_ordered[@]}"; do
  title="${titles[$slug]}"
  desc="${descriptions[$slug]}"
  cat >> "$SITE_DIR/feed.xml" << RSSEOF
  <item>
    <title>${title}</title>
    <description>${desc}</description>
    <link>${SITE_URL}/${slug}/</link>
    <guid>${SITE_URL}/${slug}/</guid>
  </item>
RSSEOF
done

cat >> "$SITE_DIR/feed.xml" << RSSEOF
</channel>
</rss>
RSSEOF
echo "  Built: feed.xml"

echo "Done! Site built in $SITE_DIR/"
