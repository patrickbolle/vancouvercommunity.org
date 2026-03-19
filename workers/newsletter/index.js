// Cloudflare Worker for newsletter signups — proxies to Buttondown API
// Secret: BUTTONDOWN_API_KEY (set via wrangler secret put BUTTONDOWN_API_KEY)

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
          "https://api.buttondown.com/v1/subscribers",
          {
            method: "POST",
            headers: {
              "Authorization": `Token ${env.BUTTONDOWN_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email_address: email.toLowerCase().trim(),
              utm_source: source || "website",
              type: "regular"
            })
          }
        );

        if (!res.ok) {
          const err = await res.text();
          console.error("Buttondown error:", res.status, err);
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
