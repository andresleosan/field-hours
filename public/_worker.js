const API_ORIGIN = "https://field-hours-api-staging.andres-san1404.workers.dev";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.workers.dev https://*.openstreetmap.org; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:; manifest-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function withSecurityHeaders(response) {
  const securedResponse = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    securedResponse.headers.set(name, value);
  }
  return securedResponse;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const apiUrl = new URL(url);
      apiUrl.hostname = new URL(API_ORIGIN).hostname;
      return fetch(new Request(apiUrl, request));
    }

    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response);
  },
};
