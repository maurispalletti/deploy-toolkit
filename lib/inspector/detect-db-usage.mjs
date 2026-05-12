// Detect uses of databases / persistence layers that Firebase Cloud Functions
// cannot run as-is:
//   - sqlite (better-sqlite3, sqlite3)
//   - postgres (pg)
//   - mysql (mysql, mysql2)
//   - mongodb (mongodb, mongoose)
//   - prisma (any provider)
//   - fs writes to non-/tmp paths (Cloud Functions filesystem is read-only
//     outside /tmp/ and the /tmp/ contents are lost on cold start)
//
// Pure source scan, no LLM, no network. Two signal sources:
//
//   1. package.json deps — fast, definitive.
//   2. source-level regex over .js/.mjs/.ts/.tsx — catches the call sites
//      (and helps the generated refactor prompt point at exact file:line).
//
// Limits to keep the scan bounded:
//   - up to MAX_FILES total
//   - up to MAX_BYTES per file
//   - skip hidden dirs (.git, .firebase, etc.), node_modules, dist, build, out
//
// Returns:
//   {
//     incompatible: boolean,
//     drivers: string[],              // unique kinds, e.g. ["sqlite", "fs-writes"]
//     evidence: [{file, line, kind, excerpt}]
//   }

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { readPackageJson } from "./read-package.mjs";

const MAX_FILES = 200;
const MAX_BYTES = 50 * 1024;

// package.json dep names that imply an incompatible driver.
// Maps the dep name to the canonical "driver" label we surface upstream.
const DEP_TO_DRIVER = {
  "better-sqlite3": "sqlite",
  "sqlite3": "sqlite",
  "pg": "postgres",
  "mysql": "mysql",
  "mysql2": "mysql",
  "mongodb": "mongodb",
  "mongoose": "mongodb",
  "prisma": "prisma",
  "@prisma/client": "prisma"
};

// Source-level regex patterns. Each entry: { kind, re, label }.
// `re` MUST be a /g-flagged regex so we can find every match per line.
// `label` is the short human-facing tag (used in evidence excerpts).
const SOURCE_PATTERNS = [
  { kind: "sqlite",   re: /\bnew\s+Database\s*\(/g },
  { kind: "postgres", re: /\bnew\s+Pool\s*\(/g },
  { kind: "mongodb",  re: /\bmongoose\.connect\s*\(/g },
  { kind: "mongodb",  re: /\bMongoClient\.connect\s*\(/g }
];

// fs writes are handled separately because we want to filter on the path
// argument (writes to /tmp/* are fine on Cloud Functions).
const FS_WRITE_RE = /\bfs\.(?:writeFileSync|appendFileSync)\s*\(\s*([^,)]+)/g;

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next"
]);

const SOURCE_EXTS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);

function getDeps(pkg) {
  if (!pkg) return {};
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {})
  };
}

async function listSourceFiles(appDir) {
  const out = [];
  async function walk(dir) {
    if (out.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return;
      // Skip hidden dirs/files (.git, .firebase, .DS_Store, etc.).
      if (e.name.startsWith(".")) continue;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        await walk(join(dir, e.name));
        continue;
      }
      const dot = e.name.lastIndexOf(".");
      const ext = dot >= 0 ? e.name.slice(dot) : "";
      if (!SOURCE_EXTS.has(ext)) continue;
      out.push(join(dir, e.name));
    }
  }
  await walk(appDir);
  return out;
}

function makeExcerpt(line) {
  const trimmed = line.trim();
  if (trimmed.length <= 120) return trimmed;
  return trimmed.slice(0, 117) + "...";
}

// Heuristic: a /tmp/ path is fine on Cloud Functions, so we don't flag it.
// We deliberately keep this loose — string literals, path.join("/tmp", ...),
// or os.tmpdir() all count as "tmp-ish".
function looksLikeTmpPath(argSnippet) {
  if (!argSnippet) return false;
  const s = argSnippet.toLowerCase();
  return s.includes("/tmp/") || s.includes("'/tmp'") || s.includes('"/tmp"') ||
         s.includes("tmpdir(") || s.includes("os.tmpdir");
}

async function scanFile(appDir, absPath) {
  let raw;
  try {
    const st = await stat(absPath);
    if (st.size > MAX_BYTES) return [];
    raw = await readFile(absPath, "utf8");
  } catch {
    return [];
  }
  const rel = relative(appDir, absPath).split(sep).join("/");
  const lines = raw.split(/\r?\n/);
  const evidence = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { kind, re } of SOURCE_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) {
        evidence.push({
          file: rel,
          line: i + 1,
          kind,
          excerpt: makeExcerpt(line)
        });
      }
    }
    // fs writes — only flag non-/tmp paths.
    FS_WRITE_RE.lastIndex = 0;
    let m;
    while ((m = FS_WRITE_RE.exec(line)) !== null) {
      const arg = m[1] ?? "";
      if (looksLikeTmpPath(arg)) continue;
      evidence.push({
        file: rel,
        line: i + 1,
        kind: "fs-writes",
        excerpt: makeExcerpt(line)
      });
    }
  }

  return evidence;
}

// Walk the app root + functions/ together — Shape C apps keep their backend
// in functions/, so we treat both package.jsons as authoritative for deps.
async function collectDepDrivers(appDir) {
  const drivers = new Set();
  const sources = [appDir, join(appDir, "functions")];
  for (const dir of sources) {
    const pkg = await readPackageJson(dir);
    if (!pkg) continue;
    const deps = getDeps(pkg);
    for (const [name, driver] of Object.entries(DEP_TO_DRIVER)) {
      if (deps[name]) drivers.add(driver);
    }
  }
  return drivers;
}

export async function detectDbUsage(appDir) {
  const depDrivers = await collectDepDrivers(appDir);

  const files = await listSourceFiles(appDir);
  const evidence = [];
  for (const f of files) {
    const hits = await scanFile(appDir, f);
    for (const h of hits) evidence.push(h);
  }

  const sourceDrivers = new Set(evidence.map(e => e.kind));
  const drivers = [...new Set([...depDrivers, ...sourceDrivers])].sort();

  return {
    incompatible: drivers.length > 0,
    drivers,
    evidence
  };
}
