const API_ORIGIN = "https://field-hours-api-staging.andres-san1404.workers.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const apiUrl = new URL(url);
      apiUrl.hostname = new URL(API_ORIGIN).hostname;
      return fetch(new Request(apiUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
