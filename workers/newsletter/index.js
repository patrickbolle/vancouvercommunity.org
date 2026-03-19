// Cloudflare Worker for newsletter signups — proxies to beehiiv API
// Secret: BEEHIIV_API_KEY (set via wrangler secret put BEEHIIV_API_KEY)

const BEEHIIV_PUBLICATION_ID = "pub_24114c6e-a7e2-4653-a26e-9411344f36aa";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "POST" && url.pathname === "/subscribe") {
      try {
        const { email, source } = await request.json();

        if (!email || !isValidEmail(email)) {
          return new Response(JSON.stringify({ error: "Valid email required" }), {
            status: 400, headers: corsHeaders
          });
        }

        const res = await fetch(
          `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.BEEHIIV_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: email.toLowerCase().trim(),
              utm_source: source || "website",
              reactivate_existing: true,
              send_welcome_email: true
            })
          }
        );

        if (!res.ok) {
          const err = await res.text();
          console.error("beehiiv error:", res.status, err);
          return new Response(JSON.stringify({ error: "Could not subscribe" }), {
            status: 502, headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (err) {
        console.error("Subscribe error:", err.message);
        return new Response(JSON.stringify({ error: "Something went wrong" }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: corsHeaders
    });
  }
};
