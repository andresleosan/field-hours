import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_SCHEMA_VERSION = 1;
const EXPECTED_HASH_ALGORITHM =
  'sha256(sorted(relative_path + "\\0" + lowercase_file_sha256 + "\\n"))';
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function comparePaths(left, right) {
  return left.localeCompare(right, "en-US", {
    numeric: false,
    sensitivity: "variant",
    usage: "sort",
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertWithin(parentPath, candidatePath, label) {
  const rel = relative(parentPath, candidatePath);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) {
    return;
  }
  throw new Error(`${label} escapes its allowed root: ${candidatePath}`);
}

function collectRegularFiles(rootPath, currentPath = rootPath) {
  const files = [];
  const entries = readdirSync(currentPath, { withFileTypes: true }).sort((left, right) =>
    comparePaths(left.name, right.name),
  );

  for (const entry of entries) {
    const fullPath = join(currentPath, entry.name);
    const stats = lstatSync(fullPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`skill bundle contains a symbolic link: ${fullPath}`);
    }
    if (stats.isDirectory()) {
      files.push(...collectRegularFiles(rootPath, fullPath));
      continue;
    }
    if (!stats.isFile()) {
      throw new Error(`skill bundle contains a non-regular file: ${fullPath}`);
    }
    files.push(fullPath);
  }

  return files;
}

export function computeSkillBundle(skillPath) {
  const resolvedSkillPath = realpathSync(skillPath);
  const rows = collectRegularFiles(resolvedSkillPath)
    .map((fullPath) => {
      const relativePath = relative(resolvedSkillPath, fullPath).split(sep).join("/");
      const bytes = readFileSync(fullPath);
      return {
        relativePath,
        fileHash: sha256(bytes),
        byteCount: bytes.byteLength,
      };
    })
    .sort((left, right) => comparePaths(left.relativePath, right.relativePath));

  const manifest = rows
    .map(({ relativePath, fileHash }) => `${relativePath}\0${fileHash}\n`)
    .join("");

  return {
    fileCount: rows.length,
    byteCount: rows.reduce((total, row) => total + row.byteCount, 0),
    bundleSha256: sha256(Buffer.from(manifest, "utf8")),
  };
}

function parseSkillFrontmatter(skillPath) {
  const text = readFileSync(skillPath, "utf8").replace(/^\uFEFF/, "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`${skillPath} is missing YAML frontmatter`);
  }

  const field = (name) => {
    const fieldMatch = match[1].match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m"));
    if (!fieldMatch) return "";
    const value = fieldMatch[1].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      return value.slice(1, -1);
    }
    return value;
  };

  return { name: field("name"), description: field("description") };
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertSource(entry, label) {
  assertObject(entry.source, `${label}.source`);
  for (const field of ["repository", "path", "ref"]) {
    if (typeof entry.source[field] !== "string" || entry.source[field].trim() === "") {
      throw new Error(`${label}.source.${field} must be a non-empty string`);
    }
  }
  if (!COMMIT_PATTERN.test(entry.source.ref)) {
    throw new Error(`${label}.source.ref must be a lowercase 40-character commit SHA`);
  }
}

function assertUniqueName(name, seen, label) {
  if (typeof name !== "string" || !SKILL_NAME_PATTERN.test(name)) {
    throw new Error(`${label} has an invalid skill name: ${String(name)}`);
  }
  if (seen.has(name)) {
    throw new Error(`duplicate installed skill or review entry: ${name}`);
  }
  seen.add(name);
}

export function verifyAgentSkills(repoRoot = process.cwd()) {
  const resolvedRoot = realpathSync(repoRoot);
  const lockPath = join(resolvedRoot, ".agents", "skills-lock.json");
  const skillsRoot = realpathSync(join(resolvedRoot, ".agents", "skills"));
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));

  assertObject(lock, "skills lock");
  if (lock.schema_version !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(`unsupported skills lock schema_version: ${String(lock.schema_version)}`);
  }
  if (lock.bundle_hash_algorithm !== EXPECTED_HASH_ALGORITHM) {
    throw new Error("bundle_hash_algorithm does not match the verifier contract");
  }
  if (!Array.isArray(lock.installed) || !Array.isArray(lock.reviewed_not_installed)) {
    throw new Error("installed and reviewed_not_installed must be arrays");
  }
  if (typeof lock.third_party_notices !== "string" || lock.third_party_notices === "") {
    throw new Error("third_party_notices must be a repository-relative path");
  }

  const noticesPath = resolve(resolvedRoot, lock.third_party_notices);
  assertWithin(resolvedRoot, noticesPath, "third_party_notices");
  const notices = readFileSync(noticesPath, "utf8");
  const seenNames = new Set();

  for (const entry of lock.installed) {
    assertObject(entry, "installed entry");
    assertUniqueName(entry.name, seenNames, "installed entry");
    assertSource(entry, `installed[${entry.name}]`);

    const skillPath = resolve(skillsRoot, entry.name);
    assertWithin(skillsRoot, skillPath, `installed[${entry.name}]`);
    if (!existsSync(skillPath) || !lstatSync(skillPath).isDirectory()) {
      throw new Error(`installed skill directory is missing: ${entry.name}`);
    }
    if (lstatSync(skillPath).isSymbolicLink()) {
      throw new Error(`installed skill directory cannot be a symbolic link: ${entry.name}`);
    }
    assertWithin(skillsRoot, realpathSync(skillPath), `installed[${entry.name}] real path`);

    const skillEntrypoint = join(skillPath, "SKILL.md");
    if (!existsSync(skillEntrypoint)) {
      throw new Error(`installed skill is missing SKILL.md: ${entry.name}`);
    }
    const frontmatter = parseSkillFrontmatter(skillEntrypoint);
    if (frontmatter.name !== entry.name) {
      throw new Error(`SKILL.md name does not match lock entry ${entry.name}`);
    }
    if (!frontmatter.description) {
      throw new Error(`SKILL.md description is missing for ${entry.name}`);
    }

    if (!Number.isInteger(entry.file_count) || entry.file_count < 1) {
      throw new Error(`file_count must be a positive integer for ${entry.name}`);
    }
    if (!Number.isInteger(entry.byte_count) || entry.byte_count < 1) {
      throw new Error(`byte_count must be a positive integer for ${entry.name}`);
    }
    if (typeof entry.bundle_sha256 !== "string" || !SHA256_PATTERN.test(entry.bundle_sha256)) {
      throw new Error(`bundle_sha256 must be lowercase SHA-256 for ${entry.name}`);
    }
    if (typeof entry.license !== "string" || entry.license.trim() === "") {
      throw new Error(`license must be recorded for ${entry.name}`);
    }

    const actual = computeSkillBundle(skillPath);
    if (entry.file_count !== actual.fileCount) {
      throw new Error(
        `file_count mismatch for ${entry.name}: lock=${entry.file_count} actual=${actual.fileCount}`,
      );
    }
    if (entry.byte_count !== actual.byteCount) {
      throw new Error(
        `byte_count mismatch for ${entry.name}: lock=${entry.byte_count} actual=${actual.byteCount}`,
      );
    }
    if (entry.bundle_sha256 !== actual.bundleSha256) {
      throw new Error(
        `bundle_sha256 mismatch for ${entry.name}: lock=${entry.bundle_sha256} actual=${actual.bundleSha256}`,
      );
    }
    if (!notices.includes(`## \`${entry.name}\``)) {
      throw new Error(`third-party notice is missing for ${entry.name}`);
    }
  }

  for (const entry of lock.reviewed_not_installed) {
    assertObject(entry, "reviewed_not_installed entry");
    assertUniqueName(entry.name, seenNames, "reviewed_not_installed entry");
    assertSource(entry, `reviewed_not_installed[${entry.name}]`);
    if (typeof entry.review !== "string" || entry.review.trim() === "") {
      throw new Error(`review status is missing for ${entry.name}`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      throw new Error(`review reason is missing for ${entry.name}`);
    }
  }

  return {
    installedCount: lock.installed.length,
    reviewedNotInstalledCount: lock.reviewed_not_installed.length,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyAgentSkills(process.cwd());
    console.log(
      `Agent skills verified: ${result.installedCount} installed, ${result.reviewedNotInstalledCount} reviewed but not installed.`,
    );
  } catch (error) {
    console.error(`Agent skill verification failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
