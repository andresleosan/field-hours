import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
  ["run", "typecheck"],
  ["run", "typecheck:worker"],
  ["run", "lint"],
  ["run", "build"],
  ["run", "test:xlsx"],
  ["run", "test:worker"],
  ["run", "test:pdf"],
  ["run", "test:ops"],
  ["run", "test:e2e"],
  ["audit", "--audit-level=high"],
];

for (const args of checks) {
  console.log(`\n>>> ${npmCommand} ${args.join(" ")}`);
  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : npmCommand;
  const commandArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", npmCommand, ...args]
    : args;
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: { ...process.env, CI: process.env.CI ?? "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nVerification gate passed: typechecks, lint, build, SheetJS, Worker/PDF/operations regression tests, E2E and audit.");
