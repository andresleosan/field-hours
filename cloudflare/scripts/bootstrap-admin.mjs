import { createHmac, pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const remote = process.argv.includes("--remote");
const credentialsArgument = process.argv.find((argument) => argument.startsWith("--credentials="));
const credentialsPath = credentialsArgument
  ? credentialsArgument.slice("--credentials=".length)
  : "/root/field-hours-admin-credentials.txt";
const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const configPath = join(scriptDirectory, "..", "wrangler.jsonc");
const sqlPath = join(tmpdir(), `field-hours-bootstrap-${randomUUID()}.sql`);

const email = "admin@field-hours.local";
const displayName = "Site Administrator";
const organizationName = "Field Hours";
const timezone = "UTC";
const password = randomBytes(24).toString("base64url");
const pepper = process.env.FIELD_HOURS_PASSWORD_PEPPER;
if (!pepper || pepper.length < 64 || pepper.length > 256) {
  throw new Error("FIELD_HOURS_PASSWORD_PEPPER must contain the Worker pepper.");
}
const salt = randomBytes(16);
const iterations = 100_000;
const passwordMaterial = createHmac("sha256", pepper).update(password).digest();
const passwordHash = pbkdf2Sync(passwordMaterial, salt, iterations, 32, "sha256");
const organizationId = randomUUID();
const userId = randomUUID();

const sql = `PRAGMA foreign_keys = ON;
INSERT INTO workforce_organizations (id, name, timezone)
VALUES ('${organizationId}', '${organizationName}', '${timezone}');
INSERT INTO workforce_users
  (id, email, password_salt, password_hash, password_iterations, must_change_password)
VALUES
  ('${userId}', '${email}', '${salt.toString("hex")}', '${passwordHash.toString("hex")}', ${iterations}, 1);
INSERT INTO workforce_memberships
  (organization_id, user_id, role, display_name)
VALUES
  ('${organizationId}', '${userId}', 'admin', '${displayName}');
INSERT INTO workforce_audit_events
  (organization_id, actor_user_id, action, subject_id, metadata_json)
VALUES
  ('${organizationId}', '${userId}', 'account.admin.bootstrapped', '${userId}', '{}');
`;

writeFileSync(sqlPath, sql, { encoding: "utf8", flag: "wx", mode: 0o600 });
try {
  const args = [
    "wrangler@latest",
    "d1",
    "execute",
    "field-hours-prod",
    remote ? "--remote" : "--local",
    "--config",
    configPath,
    "--file",
    sqlPath,
  ];
  const result = spawnSync("npx", args, {
    cwd: join(scriptDirectory, "..", ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error("D1 rejected the bootstrap transaction. An administrator may already exist.");
  }
  writeFileSync(
    credentialsPath,
    [
      "Field Hours administrator",
      `Email: ${email}`,
      `Temporary password: ${password}`,
      "URL: https://field-hours.vercel.app/",
      "The app will require a new password after the first sign-in.",
      "",
    ].join("\n"),
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
  console.log(`Administrator created. Credentials were written with mode 600 to ${credentialsPath}.`);
} finally {
  unlinkSync(sqlPath);
}
