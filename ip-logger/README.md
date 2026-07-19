# ip-logger

A Cloudflare Worker that logs visitor IP addresses (plus country/city, user-agent,
referrer) to Cloudflare KV. Your GitHub Pages site calls it from the browser; the
Worker sees the real visitor IP via the `CF-Connecting-IP` header.

## Why a standalone Worker?

`SourinDeyUW.github.io` can't be proxied through Cloudflare (GitHub owns that DNS),
so Cloudflare can't see visitor IPs to the Pages site directly. Instead the page's
JavaScript `fetch()`es this Worker at `*.workers.dev`, which *is* on Cloudflare — so
the Worker gets the real client IP.

## One-time deploy (you must run these — they need your Cloudflare login)

```bash
cd ip-logger

# 1. Install the CLI (or prefix commands with `npx`)
npm install -g wrangler

# 2. Log into your Cloudflare account (opens a browser)
wrangler login

# 3. Create the KV namespace, then paste its id into wrangler.toml
wrangler kv namespace create VISITS
#   -> copy the printed id into the `id = "..."` field in wrangler.toml

# 4. Set the admin password used to read the logs (pick any string)
wrangler secret put ADMIN_KEY

# 5. Deploy
wrangler deploy
#   -> note the deployed URL, e.g. https://ip-logger.<subdomain>.workers.dev
```

## Wire it into the site

Add this before `</body>` in `index.html` (swap in your deployed URL):

```html
<script>
  fetch("https://ip-logger.<your-subdomain>.workers.dev/?p=home",
        { method: "POST", keepalive: true }).catch(() => {});
</script>
```

## View the logs

```
https://ip-logger.<your-subdomain>.workers.dev/logs?key=YOUR_ADMIN_KEY
```

Returns JSON, newest first. Entries auto-expire after 90 days (change
`RETENTION_DAYS` in `src/worker.js`).

## ⚠️ Privacy / legal

IP addresses are personal data under GDPR and similar laws. If real people (esp. in
the EU/UK) visit, you generally need a privacy notice and a lawful basis for storing
their IP. Consider whether aggregate analytics (Plausible, GA4) would meet your need
instead of storing raw IPs.
