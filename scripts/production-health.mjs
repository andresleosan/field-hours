import { pathToFileURL } from "node:url";

const DEFAULT_APP_ORIGIN = "https://field-hours.vercel.app";
const DEFAULT_WORKER_ORIGIN = "https://field-hours-api.andres-san1404.workers.dev";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetries(url, retries, timeoutMs) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, {
        headers: { "User-Agent": "field-hours-production-monitor/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) await delay(500 * attempt);
    }
  }
  throw lastError;
}

async function checkResponse({ name, url, expectedStatus, validate }, options) {
  const startedAt = Date.now();
  try {
    const response = await fetchWithRetries(url, options.retries, options.timeoutMs);
    if (response.status !== expectedStatus) {
      throw new Error(`expected HTTP ${expectedStatus}, received ${response.status}`);
    }
    if (validate) await validate(response);
    return { name, ok: true, status: response.status, durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown monitor error",
    };
  }
}

export async function runProductionHealthChecks({
  appOrigin = process.env.FIELD_HOURS_APP_ORIGIN ?? DEFAULT_APP_ORIGIN,
  workerOrigin = process.env.FIELD_HOURS_WORKER_ORIGIN ?? DEFAULT_WORKER_ORIGIN,
  retries = 3,
  timeoutMs = 10_000,
} = {}) {
  const app = appOrigin.replace(/\/$/, "");
  const worker = workerOrigin.replace(/\/$/, "");
  const checks = [
    {
      name: "frontend",
      url: `${app}/`,
      expectedStatus: 200,
      validate: async (response) => {
        const csp = response.headers.get("content-security-policy") ?? "";
        const hsts = response.headers.get("strict-transport-security") ?? "";
        const nosniff = response.headers.get("x-content-type-options") ?? "";
        if (!csp.includes("default-src 'self'")) throw new Error("CSP is missing or incomplete");
        if (!hsts) throw new Error("HSTS header is missing");
        if (nosniff.toLowerCase() !== "nosniff") throw new Error("nosniff header is missing");
      },
    },
    {
      name: "proxy health",
      url: `${app}/api/health`,
      expectedStatus: 200,
      validate: async (response) => {
        const payload = await response.json();
        if (payload?.ok !== true || payload?.service !== "field-hours-api") {
          throw new Error("proxy health payload is invalid");
        }
      },
    },
    {
      name: "worker health",
      url: `${worker}/api/health`,
      expectedStatus: 200,
      validate: async (response) => {
        const payload = await response.json();
        if (payload?.ok !== true || payload?.service !== "field-hours-api") {
          throw new Error("worker health payload is invalid");
        }
      },
    },
    { name: "worker auth boundary", url: `${worker}/api/worker/today`, expectedStatus: 401 },
    { name: "proxy admin boundary", url: `${app}/api/admin/payroll-runs`, expectedStatus: 401 },
  ];

  const results = await Promise.all(checks.map((check) => checkResponse(check, { retries, timeoutMs })));
  return { ok: results.every((result) => result.ok), results };
}

export function formatHealthReport(report) {
  const lines = report.results.map((result) => {
    const marker = result.ok ? "PASS" : "FAIL";
    const detail = result.ok ? `HTTP ${result.status}` : result.error;
    return `${marker} ${result.name}: ${detail} (${result.durationMs} ms)`;
  });
  return [`Production monitor: ${report.ok ? "healthy" : "unhealthy"}`, ...lines].join("\n");
}

async function main() {
  const report = await runProductionHealthChecks();
  const formatted = formatHealthReport(report);
  console.log(formatted);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Field Hours production monitor\n\n\`\`\`text\n${formatted}\n\`\`\`\n`);
  }
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
