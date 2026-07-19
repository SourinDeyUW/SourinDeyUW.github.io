// Cloudflare Worker: logs visitor IPs (+ geo/UA/referrer) to KV.
//
// Deployed at:  https://ip-logger.<your-subdomain>.workers.dev/
// Your site's page calls it via fetch(); the Worker reads the REAL visitor
// IP from the CF-Connecting-IP header (set by Cloudflare's edge).
//
// Endpoints:
//   POST /            -> logs a visit, returns { ok: true }
//   GET  /logs?key=X  -> dumps logged visits as JSON (X must equal ADMIN_KEY secret)

const ALLOWED_ORIGIN = "https://sourindeyuw.github.io";
const RETENTION_DAYS = 90;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // --- Admin: view what has been logged ---------------------------------
    if (url.pathname === "/logs") {
      if (url.searchParams.get("key") !== env.ADMIN_KEY) {
        return new Response("Forbidden", { status: 403 });
      }
      const list = await env.VISITS.list({ prefix: "visit:", limit: 1000 });
      const rows = [];
      for (const k of list.keys) {
        const v = await env.VISITS.get(k.name);
        if (v) rows.push(JSON.parse(v));
      }
      rows.sort((a, b) => (a.ts < b.ts ? 1 : -1)); // newest first
      return new Response(JSON.stringify(rows, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- Log a visit -------------------------------------------------------
    const ts = new Date().toISOString();
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const entry = {
      ts,
      ip,
      country: request.cf?.country || "",
      city: request.cf?.city || "",
      region: request.cf?.region || "",
      ua: request.headers.get("User-Agent") || "",
      ref: request.headers.get("Referer") || "",
      page: url.searchParams.get("p") || "",
    };

    // Key sorts chronologically; auto-expires after RETENTION_DAYS.
    await env.VISITS.put(`visit:${ts}:${ip}`, JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * RETENTION_DAYS,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
