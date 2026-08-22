import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const baseUrl = process.env.FIELD_HOURS_TEST_URL ?? "http://127.0.0.1:8787";
const credentialsPath = process.env.FIELD_HOURS_TEST_CREDENTIALS ?? "/tmp/field-hours-local-admin.txt";
const credentials = readFileSync(credentialsPath, "utf8");
const email = credentials.match(/^Email: (.+)$/m)?.[1];
const temporaryPassword = credentials.match(/^Temporary password: (.+)$/m)?.[1];
assert(email && temporaryPassword, "Local test credentials are missing");

function cookieJar() {
  return new Map();
}

function absorbCookies(response, jar) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  for (const value of values) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (cookieValue) jar.set(name, cookieValue);
    else jar.delete(name);
  }
}

async function api(path, { method = "GET", body, jar, csrf = false } = {}) {
  const headers = new Headers();
  if (method !== "GET") headers.set("Origin", "https://field-hours.vercel.app");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (jar?.size) {
    headers.set("Cookie", [...jar].map(([key, value]) => `${key}=${value}`).join("; "));
  }
  if (csrf) headers.set("X-CSRF-Token", jar?.get("fh_csrf") ?? "");
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (jar) absorbCookies(response, jar);
  const payload = await response.json();
  return { response, payload };
}

const health = await api("/api/health");
assert.equal(health.response.status, 200);
assert.equal(health.payload.ok, true);

const adminJar = cookieJar();
const login = await api("/api/auth/login", {
  method: "POST",
  jar: adminJar,
  body: { email, password: temporaryPassword },
});
assert.equal(login.response.status, 200);
assert.equal(login.payload.user.role, "admin");
assert.equal(login.payload.user.mustChangePassword, true);
assert(adminJar.has("fh_session") && adminJar.has("fh_csrf"));

const newAdminPassword = randomBytes(24).toString("base64url");
const passwordChange = await api("/api/auth/password", {
  method: "POST",
  jar: adminJar,
  csrf: true,
  body: { password: newAdminPassword },
});
assert.equal(passwordChange.response.status, 200);
assert.equal(passwordChange.payload.user.mustChangePassword, false);

const invitation = await api("/api/invitations", {
  method: "POST",
  jar: adminJar,
  csrf: true,
  body: {},
});
assert.equal(invitation.response.status, 201);
assert.match(invitation.payload.token, /^[a-f0-9]{64}$/);

const workerJar = cookieJar();
const workerEmail = `worker-${randomBytes(6).toString("hex")}@example.test`;
const workerPassword = randomBytes(24).toString("base64url");
const registration = await api("/api/auth/register", {
  method: "POST",
  jar: workerJar,
  body: {
    invitationToken: invitation.payload.token,
    email: workerEmail,
    password: workerPassword,
    displayName: "Smoke Test Worker",
  },
});
assert.equal(registration.response.status, 201);
assert.equal(registration.payload.user.role, "worker");

const location = { latitude: 51.5074, longitude: -0.1278, accuracy: 12 };
for (const action of ["clock_in", "start_break", "end_break", "clock_out"]) {
  const result = await api("/api/shift/action", {
    method: "POST",
    jar: workerJar,
    csrf: true,
    body: {
      action,
      location,
      idempotencyKey: `smoke-${action.replaceAll("_", "-")}-${randomBytes(8).toString("hex")}`,
    },
  });
  assert.equal(result.response.status, 200, `${action} failed: ${JSON.stringify(result.payload)}`);
}

const workerToday = await api("/api/worker/today", { jar: workerJar });
assert.equal(workerToday.response.status, 200);
assert.equal(workerToday.payload.state, "complete");
assert.equal(workerToday.payload.events.length, 4);

const adminToday = await api("/api/admin/today", { jar: adminJar });
assert.equal(adminToday.response.status, 200);
const worker = adminToday.payload.find((member) => member.display_name === "Smoke Test Worker");
assert(worker);
assert.equal(worker.state, "complete");
assert.equal(worker.events.length, 4);

const replayedInvitation = await api("/api/auth/register", {
  method: "POST",
  jar: cookieJar(),
  body: {
    invitationToken: invitation.payload.token,
    email: `replay-${randomBytes(4).toString("hex")}@example.test`,
    password: workerPassword,
    displayName: "Replay Attempt",
  },
});
assert.equal(replayedInvitation.response.status, 400);

console.log("Cloudflare Worker smoke test passed: auth, one-time invite, CSRF, four shift actions, locations, and admin dashboard.");
