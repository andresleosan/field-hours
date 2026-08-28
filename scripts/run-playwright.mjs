import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const playwrightCli = path.join(projectRoot, "node_modules", "@playwright", "test", "cli.js");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const browserCache = path.join(projectRoot, ".cache", "ms-playwright");
const baseURL = "http://127.0.0.1:4187";
const argumentsFromUser = process.argv.slice(2);
const installOnly = argumentsFromUser.includes("--install");
const listOnly = argumentsFromUser.includes("--list");
const crossBrowser = argumentsFromUser.includes("--cross-browser");
const playwrightArguments = argumentsFromUser.filter((argument) => argument !== "--cross-browser");

const testEnvironment = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: browserCache,
  E2E_EXTERNAL_SERVER: "1",
  E2E_CROSS_BROWSER: crossBrowser ? "1" : "0",
};

function run(commandArguments) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, commandArguments, {
      cwd: projectRoot,
      env: testEnvironment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function waitUntilReady(server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite stopped before becoming ready (exit ${server.exitCode}).`);
    }
    try {
      const response = await fetch(baseURL, { signal: AbortSignal.timeout(750) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite did not become ready at ${baseURL}.`);
}

function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  server.kill("SIGTERM");
  server.unref();
}

if (installOnly) {
  process.exitCode = await run([
    playwrightCli,
    "install",
    ...(crossBrowser ? ["chromium", "firefox", "webkit"] : ["chromium"]),
  ]);
} else if (listOnly) {
  process.exitCode = await run([playwrightCli, "test", ...playwrightArguments]);
} else {
  let server;
  try {
    server = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", "4187", "--strictPort"], {
      cwd: projectRoot,
      env: process.env,
      stdio: "ignore",
      windowsHide: true,
    });
    await waitUntilReady(server);
    process.exitCode = await run([playwrightCli, "test", ...playwrightArguments]);
  } finally {
    stopServer(server);
  }
}
