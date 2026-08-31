import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { verifyAgentSkills } from "./verify-agent-skills.mjs";

const skillText = `---
name: demo-skill
description: "Skill fixture for verification."
---

# Demo
`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "field-hours-skills-"));
  const skillPath = join(root, ".agents", "skills", "demo-skill", "SKILL.md");
  const noticesPath = join(root, ".agents", "THIRD_PARTY_NOTICES.md");
  const lockPath = join(root, ".agents", "skills-lock.json");

  mkdirSync(dirname(skillPath), { recursive: true });
  writeFileSync(skillPath, skillText, "utf8");
  writeFileSync(noticesPath, "# Notices\n\n## `demo-skill`\n", "utf8");

  const fileHash = sha256(Buffer.from(skillText, "utf8"));
  const bundleHash = sha256(Buffer.from(`SKILL.md\0${fileHash}\n`, "utf8"));
  const lock = {
    schema_version: 1,
    purpose: "fixture",
    bundle_hash_algorithm: "sha256(sorted(relative_path + \"\\0\" + lowercase_file_sha256 + \"\\n\"))",
    third_party_notices: ".agents/THIRD_PARTY_NOTICES.md",
    installed: [
      {
        name: "demo-skill",
        source: {
          repository: "example/demo-skill",
          path: "skills/demo-skill",
          ref: "0123456789abcdef0123456789abcdef01234567",
        },
        file_count: 1,
        byte_count: Buffer.byteLength(skillText),
        bundle_sha256: bundleHash,
        license: "MIT",
        review: "approved",
        constraints: [],
      },
    ],
    reviewed_not_installed: [],
  };
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

  return { lockPath, root, skillPath };
}

test("accepts a pinned skill whose files, bytes, hash and notice match", () => {
  const fixture = createFixture();
  try {
    assert.deepEqual(verifyAgentSkills(fixture.root), {
      installedCount: 1,
      reviewedNotInstalledCount: 0,
    });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects a bundle changed after the lock was written", () => {
  const fixture = createFixture();
  try {
    writeFileSync(fixture.skillPath, `${readFileSync(fixture.skillPath, "utf8")}tampered\n`, "utf8");
    assert.throws(() => verifyAgentSkills(fixture.root), /byte_count|bundle_sha256/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects duplicate installed entries", () => {
  const fixture = createFixture();
  try {
    const lock = JSON.parse(readFileSync(fixture.lockPath, "utf8"));
    lock.installed.push(structuredClone(lock.installed[0]));
    writeFileSync(fixture.lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
    assert.throws(() => verifyAgentSkills(fixture.root), /duplicate installed skill/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
