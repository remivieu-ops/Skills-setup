/**
 * Minimal CORS proxy for the 360Learning Skills Ontology Setup tool.
 *
 * Deploy this as a Cloudflare Worker (free tier is plenty). It forwards
 * whatever request the tool sends to the real 360Learning URL passed in the
 * `?url=` query param, adds permissive CORS headers to the response, and
 * hands it back to the browser.
 *
 * It does NOT store, log, or inspect your credentials or tokens — it's a
 * pure pass-through. You can read every line below; there's nothing hidden.
 *
 * ---- Deploy in ~5 minutes ----
 * 1. Go to https://dash.cloudflare.com/ → sign up free if needed.
 * 2. Workers & Pages → Create → "Create Worker".
 * 3. Give it a name (e.g. "360l-proxy"), click Deploy.
 * 4. Click "Edit code", delete the default contents, paste this whole file.
 * 5. Click "Save and deploy".
 * 6. Copy the worker's URL (looks like https://360l-proxy.YOUR-SUBDOMAIN.workers.dev).
 * 7. Paste that URL into the "Proxy base URL" field in Step 1 of the tool.
 *
 * ---- Recommended: lock it down to 360Learning only ----
 * The ALLOWED_HOST_SUFFIXES check below already restricts this proxy to only
 * forward requests to 360learning.com domains, so it can't be abused as an
 * open relay even if someone finds the URL.
 */

const ALLOWED_HOST_SUFFIXES = [
  ".360learning.com",
  "360learning.com" // covers apex, just in case
];

function isAllowedTarget(targetUrl) {
  try {
    const u = new URL(targetUrl);
    return ALLOWED_HOST_SUFFIXES.some(suffix => u.hostname.endsWith(suffix));
  } catch (e) {
    return false;
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Location, Content-Type"
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const incomingUrl = new URL(request.url);
    const targetUrl = incomingUrl.searchParams.get("url");

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing ?url= query parameter." }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    if (!isAllowedTarget(targetUrl)) {
      return new Response(
        JSON.stringify({ error: "Target host is not an allowed 360Learning domain." }),
        { status: 403, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // Forward method, headers (minus a few that don't make sense to forward), and body.
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete("host");
    forwardHeaders.delete("origin");
    forwardHeaders.delete("referer");
    forwardHeaders.delete("cf-connecting-ip");

    const init = {
      method: request.method,
      headers: forwardHeaders,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: "manual"
    };

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(targetUrl, init);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }),
        { status: 502, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));

    // 360Learning's bulk endpoints return an absolute Location URL for polling.
    // Rewrite it to go back through this same proxy so the browser can poll it too.
    const location = responseHeaders.get("Location");
    if (location) {
      responseHeaders.set(
        "Location",
        `${incomingUrl.origin}${incomingUrl.pathname}?url=${encodeURIComponent(location)}`
      );
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });
  }
};
