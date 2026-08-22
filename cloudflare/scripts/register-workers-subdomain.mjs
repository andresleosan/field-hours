import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

function wranglerJson(args) {
  const result = spawnSync("npx", ["wrangler@latest", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error("Wrangler authentication is unavailable.");
  return JSON.parse(result.stdout);
}

const credentials = wranglerJson(["auth", "token", "--json"]);
const identity = wranglerJson(["whoami", "--json"]);
const accountId = identity.accounts?.[0]?.id;
if (typeof credentials.token !== "string" || typeof accountId !== "string") {
  throw new Error("Wrangler did not return usable OAuth account credentials.");
}

let registered = "";
for (let attempt = 0; attempt < 5 && !registered; attempt += 1) {
  const candidate = `field-hours-jedi-${randomBytes(3).toString("hex")}`;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subdomain: candidate }),
    },
  );
  if (response.ok) {
    const payload = await response.json();
    if (payload?.success === true) registered = candidate;
  } else if (response.status !== 409) {
    throw new Error(`Cloudflare rejected the subdomain registration with HTTP ${response.status}.`);
  }
}

if (!registered) throw new Error("Cloudflare could not reserve a unique workers.dev subdomain.");
console.log(`Registered workers.dev account subdomain: ${registered}`);
