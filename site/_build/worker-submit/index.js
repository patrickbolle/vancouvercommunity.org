// Cloudflare Worker for community submissions & edits -> GitHub Pull Requests

const GITHUB_REPO = "patrickbolle/vancouvercommunity.org";
const DEFAULT_BRANCH = "main";

// Map form categories to file names
const CATEGORY_FILES = {
  "dinner-supper-clubs": "dinner-supper-clubs.md",
  "social-friend-clubs": "social-friend-clubs.md",
  "run-clubs": "run-clubs.md",
  "board-games": "board-games.md",
  "creative-art": "creative-art.md",
  "photography": "photography.md",
  "film-cinema": "film-cinema.md",
  "writing": "writing.md",
  "language-exchange": "language-exchange.md",
  "hiking-outdoors": "hiking-outdoors.md",
  "cycling": "cycling.md",
  "dance": "dance.md",
  "improv-comedy": "improv-comedy.md",
  "music-open-mic": "music-open-mic.md",
  "climbing": "climbing.md",
  "pickleball": "pickleball.md",
  "pottery-ceramics": "pottery-ceramics.md",
  "yoga-wellness": "yoga-wellness.md",
  "sauna-cold-plunge": "sauna-cold-plunge.md",
  "mindfulness-meditation": "mindfulness-meditation.md",
  "mens-groups": "mens-groups.md",
  "maker-spaces": "maker-spaces.md",
  "philosophy-intellectual": "philosophy-intellectual.md",
  "book-clubs": "book-clubs.md",
  "tech-startup": "tech-startup.md",
  "coworking": "coworking.md",
  "volunteer": "volunteer.md",
  "vinyl-listening-bars": "vinyl-listening-bars.md",
  "chess": "chess.md",
  "underground-dj": "underground-dj.md",
  "poetry-spoken-word": "poetry-spoken-word.md",
  "tarot-astrology": "tarot-astrology.md",
  "pub-trivia": "pub-trivia.md",
  "zine-risograph": "zine-risograph.md",
  "astronomy-stargazing": "astronomy-stargazing.md",
  "foraging-nature": "foraging-nature.md",
  "birdwatching": "birdwatching.md",
  "karaoke": "karaoke.md",
  "resources": "resources.md"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

// --- Observability helpers ---

function requestId() {
  return crypto.randomUUID().slice(0, 8);
}

function log(rid, level, message, extra = {}) {
  const entry = {
    rid,
    level,
    message,
    ts: new Date().toISOString(),
    ...extra
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// --- GitHub API ---

async function githubApi(endpoint, env, options = {}, rid) {
  const method = options.method || "GET";
  log(rid, "info", `GitHub API ${method} ${endpoint}`);

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "Vancouver-Community-Bot",
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    log(rid, "error", `GitHub API error`, { status: response.status, endpoint, body: error.slice(0, 500) });
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// --- Base64 (chunk-safe for large files) ---

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64(base64) {
  const bytes = Uint8Array.from(atob(base64.replace(/\n/g, '')), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// --- Category key normalization ---

function normalizeCategoryKey(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// --- Formatting ---

function formatSubmissionEntry(data) {
  let entry = `\n## ${data.name}\n`;
  entry += `- **What:** ${data.description}\n`;

  if (data.vibe) {
    entry += `- **Vibe:** ${data.vibe}\n`;
  }
  if (data.location) {
    entry += `- **Where:** ${data.location}\n`;
  }
  if (data.link) {
    entry += `- **Find it:** [${data.link.replace(/^https?:\/\//, '')}](${data.link})\n`;
  }
  if (data.additional) {
    entry += `- **Notes:** ${data.additional}\n`;
  }

  return entry;
}

// --- Route handlers ---

// GET /content/:category - Fetch current content for editing
async function handleGetContent(category, env, rid) {
  const categoryKey = normalizeCategoryKey(category);
  const fileName = CATEGORY_FILES[categoryKey];

  if (!fileName) {
    log(rid, "warn", `Unknown category`, { category, categoryKey });
    return new Response(JSON.stringify({
      error: `Unknown category: ${category}`
    }), { status: 400, headers: corsHeaders });
  }

  const fileData = await githubApi(
    `/repos/${GITHUB_REPO}/contents/${fileName}?ref=${DEFAULT_BRANCH}`,
    env, {}, rid
  );

  const content = decodeBase64(fileData.content);

  return new Response(JSON.stringify({
    success: true,
    category: categoryKey,
    fileName,
    content,
    sha: fileData.sha
  }), { headers: corsHeaders });
}

// POST /submit - Add new entry
async function handleSubmit(data, env, rid) {
  if (!data.name || !data.category || !data.description) {
    log(rid, "warn", `Missing required fields`, { fields: { name: !!data.name, category: !!data.category, description: !!data.description } });
    return new Response(JSON.stringify({
      error: "Missing required fields: name, category, description"
    }), { status: 400, headers: corsHeaders });
  }

  const categoryKey = normalizeCategoryKey(data.category);
  const fileName = CATEGORY_FILES[categoryKey];

  if (!fileName) {
    log(rid, "warn", `Unknown category on submit`, { category: data.category, categoryKey });
    return new Response(JSON.stringify({
      error: `Unknown category: ${data.category}. Try selecting a different category or choose "Other".`
    }), { status: 400, headers: corsHeaders });
  }

  log(rid, "info", `Processing submission`, { name: data.name, category: categoryKey });

  const timestamp = Date.now();
  const safeName = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
  const branchName = `submission/${safeName}-${timestamp}`;

  // Get base branch SHA
  const refData = await githubApi(
    `/repos/${GITHUB_REPO}/git/refs/heads/${DEFAULT_BRANCH}`,
    env, {}, rid
  );
  const baseSha = refData.object.sha;

  // Get current file content
  let currentContent = "";
  let fileSha = null;

  try {
    const fileData = await githubApi(
      `/repos/${GITHUB_REPO}/contents/${fileName}?ref=${DEFAULT_BRANCH}`,
      env, {}, rid
    );
    currentContent = decodeBase64(fileData.content);
    fileSha = fileData.sha;
  } catch (e) {
    log(rid, "warn", `File not found, will create`, { fileName });
  }

  // Create branch
  await githubApi(`/repos/${GITHUB_REPO}/git/refs`, env, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
  }, rid);

  // Append new entry
  const newEntry = formatSubmissionEntry(data);
  const updatedContent = currentContent.trimEnd() + "\n" + newEntry;

  // Commit file
  await githubApi(`/repos/${GITHUB_REPO}/contents/${fileName}`, env, {
    method: "PUT",
    body: JSON.stringify({
      message: `Add ${data.name} to ${categoryKey}`,
      content: encodeBase64(updatedContent),
      branch: branchName,
      ...(fileSha && { sha: fileSha })
    })
  }, rid);

  // Create PR
  const prBody = `## New Community Submission

**Name:** ${data.name}
**Category:** ${data.category}

**Description:**
${data.description}

${data.vibe ? `**Vibe/Atmosphere:** ${data.vibe}` : ''}
${data.link ? `**Website/Link:** ${data.link}` : ''}
${data.location ? `**Location:** ${data.location}` : ''}
${data.additional ? `**Additional Info:** ${data.additional}` : ''}

---
*Submitted via vancouvercommunity.org*
`;

  const pr = await githubApi(`/repos/${GITHUB_REPO}/pulls`, env, {
    method: "POST",
    body: JSON.stringify({
      title: `Add ${data.name} to ${data.category}`,
      body: prBody,
      head: branchName,
      base: DEFAULT_BRANCH
    })
  }, rid);

  log(rid, "info", `Submission PR created`, { pr: pr.number, category: categoryKey });

  return new Response(JSON.stringify({
    success: true,
    message: "Thank you! Your submission has been received and is pending review.",
    prUrl: pr.html_url
  }), { headers: corsHeaders });
}

// POST /edit - Suggest edit (creates a GitHub issue, not a file replacement)
async function handleEdit(data, env, rid) {
  if (!data.category || !data.summary) {
    log(rid, "warn", `Missing required edit fields`, { fields: { category: !!data.category, summary: !!data.summary } });
    return new Response(JSON.stringify({
      error: "Missing required fields: category, summary"
    }), { status: 400, headers: corsHeaders });
  }

  const categoryKey = normalizeCategoryKey(data.category);
  const fileName = CATEGORY_FILES[categoryKey];

  if (!fileName) {
    log(rid, "warn", `Unknown category on edit`, { category: data.category, categoryKey });
    return new Response(JSON.stringify({
      error: `Unknown category: ${data.category}`
    }), { status: 400, headers: corsHeaders });
  }

  log(rid, "info", `Processing edit suggestion`, { category: categoryKey });

  // Create a GitHub issue instead of replacing the file
  const issueBody = `## Edit Suggestion

**Category:** [${data.category}](https://vancouvercommunity.org/${categoryKey}/)
**File:** \`${fileName}\`

### What should change
${data.summary}

${data.name ? `**Submitted by:** ${data.name}` : ''}

---
*Submitted via vancouvercommunity.org*
`;

  const issue = await githubApi(`/repos/${GITHUB_REPO}/issues`, env, {
    method: "POST",
    body: JSON.stringify({
      title: `Edit suggestion: ${categoryKey}`,
      body: issueBody,
      labels: ["edit-suggestion"]
    })
  }, rid);

  log(rid, "info", `Edit issue created`, { issue: issue.number, category: categoryKey });

  return new Response(JSON.stringify({
    success: true,
    message: "Thank you! Your suggested edit has been submitted for review.",
    issueUrl: issue.html_url
  }), { headers: corsHeaders });
}

// --- Main handler ---

export default {
  async fetch(request, env) {
    const rid = requestId();
    const url = new URL(request.url);
    const path = url.pathname;
    const start = Date.now();

    log(rid, "info", `${request.method} ${path}`, {
      cf: request.cf ? { country: request.cf.country, city: request.cf.city } : undefined
    });

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response;

      // GET /content/:category - Fetch content for editing
      if (request.method === "GET" && path.startsWith("/content/")) {
        const category = path.replace("/content/", "");
        response = await handleGetContent(category, env, rid);
      }
      // POST routes
      else if (request.method === "POST") {
        const data = await request.json();

        if (path === "/submit" || path === "/") {
          response = await handleSubmit(data, env, rid);
        } else if (path === "/edit") {
          response = await handleEdit(data, env, rid);
        }
      }

      if (!response) {
        response = new Response(JSON.stringify({
          error: "Not found",
          routes: {
            "GET /content/:category": "Fetch current content",
            "POST /submit": "Submit new entry",
            "POST /edit": "Suggest edit to existing content"
          }
        }), { status: 404, headers: corsHeaders });
      }

      log(rid, "info", `Response`, { status: response.status, duration_ms: Date.now() - start });
      return response;

    } catch (error) {
      log(rid, "error", `Unhandled error`, {
        error: error.message,
        stack: error.stack,
        duration_ms: Date.now() - start
      });
      return new Response(JSON.stringify({
        error: "Server error",
        message: "Something went wrong. Please try again or email hello@vancouvercommunity.org.",
        rid
      }), { status: 500, headers: corsHeaders });
    }
  }
};
