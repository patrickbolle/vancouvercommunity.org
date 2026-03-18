// Cloudflare Worker for Vancouver Community stats (proxies Umami analytics)

const UMAMI_URL = "https://data.kwconcerts.ca";
const WEBSITE_ID = "ce0a9531-1032-4e43-a3a6-5c93cf9513f6";

let cachedToken = null;
let tokenExpiry = 0;

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

// --- Umami API ---

async function getToken(env, rid) {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  log(rid, "info", "Authenticating with Umami");

  const response = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.UMAMI_USERNAME,
      password: env.UMAMI_PASSWORD
    })
  });

  if (!response.ok) {
    const body = await response.text();
    log(rid, "error", "Umami auth failed", { status: response.status, body: body.slice(0, 300) });
    throw new Error("Failed to authenticate with Umami");
  }

  const data = await response.json();
  cachedToken = data.token;
  tokenExpiry = Date.now() + 3600 * 1000;
  return cachedToken;
}

async function getPageStats(token, rid) {
  const now = Date.now();
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000;

  const response = await fetch(
    `${UMAMI_URL}/api/websites/${WEBSITE_ID}/metrics?startAt=${yearAgo}&endAt=${now}&type=path`,
    { headers: { "Authorization": `Bearer ${token}` } }
  );

  if (!response.ok) {
    const body = await response.text();
    log(rid, "error", "Umami page stats failed", { status: response.status, body: body.slice(0, 300) });
    throw new Error("Failed to fetch page stats");
  }

  return response.json();
}

async function getTotalStats(token, rid) {
  const now = Date.now();
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000;

  const response = await fetch(
    `${UMAMI_URL}/api/websites/${WEBSITE_ID}/stats?startAt=${yearAgo}&endAt=${now}`,
    { headers: { "Authorization": `Bearer ${token}` } }
  );

  if (!response.ok) {
    const body = await response.text();
    log(rid, "error", "Umami total stats failed", { status: response.status, body: body.slice(0, 300) });
    throw new Error("Failed to fetch total stats");
  }

  return response.json();
}

// --- Main handler ---

export default {
  async fetch(request, env) {
    const rid = requestId();
    const url = new URL(request.url);
    const start = Date.now();

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
    };

    log(rid, "info", `${request.method} ${url.pathname}`, {
      cf: request.cf ? { country: request.cf.country, city: request.cf.city } : undefined
    });

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const token = await getToken(env, rid);

      if (url.pathname === "/stats") {
        const stats = await getTotalStats(token, rid);
        log(rid, "info", "Response", { status: 200, route: "/stats", duration_ms: Date.now() - start });
        return new Response(JSON.stringify(stats), { headers: corsHeaders });
      }

      if (url.pathname === "/pages") {
        const pages = await getPageStats(token, rid);
        const pageMap = {};
        for (const p of pages) {
          pageMap[p.x] = p.y;
        }
        log(rid, "info", "Response", { status: 200, route: "/pages", duration_ms: Date.now() - start });
        return new Response(JSON.stringify(pageMap), { headers: corsHeaders });
      }

      // Default: return both
      const [stats, pages] = await Promise.all([
        getTotalStats(token, rid),
        getPageStats(token, rid)
      ]);

      const pageMap = {};
      for (const p of pages) {
        pageMap[p.x] = p.y;
      }

      log(rid, "info", "Response", { status: 200, route: "/", page_count: Object.keys(pageMap).length, duration_ms: Date.now() - start });
      return new Response(JSON.stringify({
        total: stats,
        pages: pageMap
      }), { headers: corsHeaders });

    } catch (error) {
      log(rid, "error", "Unhandled error", {
        error: error.message,
        stack: error.stack,
        duration_ms: Date.now() - start
      });
      return new Response(JSON.stringify({ error: error.message, rid }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
