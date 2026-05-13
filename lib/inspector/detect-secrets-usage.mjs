// Detect secrets-related issues in the user's source.
//
// Three concerns, mirrored from REVISIT.md C6:
//
//   1. Hardcoded secrets in the source (e.g. `sk_live_...` from Stripe).
//      These end up in git AND in the deployed bundle, so anyone with a
//      browser can read them. The wizard MUST block on these.
//   2. `process.env.X` references in the source — list of env vars the app
//      reads at runtime. The wizard asks the user, per-key, whether each
//      one is browser-safe or server-only, then ingests appropriately.
//   3. `.env.example` keys — already extracted by read-env-example.mjs.
//      We surface them here too so the wizard can build a single unified
//      "classify these" UI from the union of envRefs + envExampleKeys.
//
// Pure source scan, no LLM, no network. Bounded scan: up to MAX_FILES total
// files, MAX_BYTES per file, skip the usual junk dirs.
//
// Returns:
//   {
//     hardcoded: [{ file, line, kind, prefix, redacted, excerpt }],
//     envRefs:        ["NAME", ...],   // process.env.X references
//     envExampleKeys: ["NAME", ...]    // .env.example
//   }
//
// We tune the patterns toward HIGH PRECISION (false positives are bad UX)
// at the cost of missing some long-tail secret formats. Better to deploy a
// real secret than to scare the user about a non-secret string we mis-flagged.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { readEnvExample } from "./read-env-example.mjs";

const MAX_FILES = 200;
const MAX_BYTES = 50 * 1024;

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".firebase",
  ".git"
]);

// Source extensions we scan. JSON gets a careful treatment — only top-level
// string values — to avoid noise from package-lock.json etc., which would
// otherwise produce floods of false positives on hashes that happen to
// match a prefix regex.
const SOURCE_EXTS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html"]);
const JSON_EXTS = new Set([".json"]);
// JSON files we deliberately skip even though their extension matches —
// they are guaranteed-noisy or auto-generated.
const JSON_SKIP_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "deploy-app.config.json"
]);

// Hardcoded-secret patterns. Each: { kind, re, label }.
//
// - `re` must be /g-flagged so we can find every match per line and call
//   `re.lastIndex = 0` between lines to reset (regex objects are shared
//   across calls).
// - The "kind" lets the UI render different copy / urgency per family.
// - The "google-api-key-maybe-firebase" kind exists because Firebase web
//   SDK keys legitimately start with `AIza` and are PUBLIC by design (the
//   security model relies on Firestore rules + Auth, not on hiding the
//   key). The detector flags them but the UI surfaces them as "we're not
//   sure — check yourself" instead of as a hard block.
const SECRET_PATTERNS = [
  // Stripe — live and test keys are both real secrets.
  { kind: "stripe-live",     re: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { kind: "stripe-test",     re: /\bsk_test_[A-Za-z0-9]{20,}\b/g },
  // AWS access key id — always starts with AKIA and is exactly 20 chars.
  { kind: "aws-access-key",  re: /\bAKIA[A-Z0-9]{16}\b/g },
  // GitHub personal-access-token / OAuth / user-server tokens.
  { kind: "github-pat",      re: /\bghp_[A-Za-z0-9]{36}\b/g },
  { kind: "github-oauth",    re: /\bgho_[A-Za-z0-9]{36}\b/g },
  { kind: "github-user",     re: /\bghu_[A-Za-z0-9]{36}\b/g },
  // Anthropic API key.
  { kind: "anthropic",       re: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/g },
  // OpenAI API keys. We deliberately exclude `sk-ant-` (handled above) and
  // anything starting with `sk-proj-` matches the same broad pattern too —
  // either way it's a real OpenAI/OpenAI-project key.
  { kind: "openai",          re: /\bsk-(?!ant-)[A-Za-z0-9_-]{40,}\b/g },
  // Slack tokens (bot, user, app).
  { kind: "slack-bot",       re: /\bxoxb-[A-Za-z0-9-]{20,}\b/g },
  { kind: "slack-user",      re: /\bxoxp-[A-Za-z0-9-]{20,}\b/g },
  // Google API key — exactly 35 chars after `AIza`. Surfaced with a
  // dedicated kind so the UI can render this as low-urgency (Firebase
  // SDK keys legitimately use this prefix).
  { kind: "google-api-key-maybe-firebase", re: /\bAIza[A-Za-z0-9_-]{35}\b/g }
];

// AWS secret access key — much lower-precision than the access key id.
// 40-char base64-ish strings happen often. So we only flag this pattern
// when the surrounding line clearly identifies the value as the secret
// key (i.e. a var name or property name like `aws_secret_access_key`).
const AWS_SECRET_RE = /(?:aws[_-]?secret[_-]?access[_-]?key|secretAccessKey)\s*[=:]\s*["']([A-Za-z0-9/+=]{40})["']/g;

// process.env.NAME and process.env["NAME"]. We deliberately only capture
// SCREAMING_SNAKE names (env var convention) to avoid catching things
// like `process.env.NODE_ENV` differently across casings.
const ENV_REF_RE = /process\.env(?:\.([A-Z_][A-Z0-9_]*)|\[\s*["']([A-Z_][A-Z0-9_]*)["']\s*\])/g;

// Heuristic: when an `AIza...` key appears in a clearly-Firebase-config
// context (e.g. a `firebase-config.js` file or an inline `apiKey:` next
// to other Firebase config keys), we still emit the kind but mark it
// `suppressed: true` so the UI can either hide it or de-emphasize.
//
// We keep this very conservative: filename match OR same-line "firebase"
// substring. Both are heuristics — a vibecoder might write `apiKey:` in
// a totally unrelated context, but in those cases the user wins by being
// told "we're not sure".
function isFirebaseContext(relPath, line) {
  if (/firebase[-_]?config\.(?:js|mjs|cjs|ts)$/i.test(relPath)) return true;
  if (/firebase/i.test(line)) return true;
  return false;
}

function redact(value) {
  if (!value || value.length <= 10) return value;
  return value.slice(0, 4) + "…" + value.slice(-4);
}

function prefixOf(value) {
  // First 8 chars are usually the "family marker" (sk_live_, sk-ant-, etc.)
  // We pull it off explicitly to surface in the UI without showing the key.
  if (!value) return "";
  // Use up to the first non-prefix character (digit/letter run after a
  // known boundary). Simpler: just first 8 chars.
  return value.slice(0, Math.min(8, value.length));
}

function makeExcerpt(line) {
  const trimmed = line.trim();
  if (trimmed.length <= 120) return trimmed;
  return trimmed.slice(0, 117) + "...";
}

async function listFiles(appDir) {
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
      // Skip hidden dirs (we'll still scan visible .env etc. by name on
      // the explicit env-example reader). For source scan, ignore dot-dirs.
      if (e.name.startsWith(".")) continue;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        await walk(join(dir, e.name));
        continue;
      }
      const dot = e.name.lastIndexOf(".");
      const ext = dot >= 0 ? e.name.slice(dot) : "";
      if (SOURCE_EXTS.has(ext)) {
        out.push({ path: join(dir, e.name), kind: "source" });
        continue;
      }
      if (JSON_EXTS.has(ext) && !JSON_SKIP_NAMES.has(e.name)) {
        out.push({ path: join(dir, e.name), kind: "json" });
        continue;
      }
    }
  }
  await walk(appDir);
  return out;
}

// Scan a single line for all known patterns and return the matched
// hardcoded-secret hits. Each hit is { kind, value }.
function scanLineForSecrets(line) {
  const hits = [];
  for (const { kind, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      hits.push({ kind, value: m[0] });
    }
  }
  // AWS secret key (lower precision; only fires with var-name context).
  AWS_SECRET_RE.lastIndex = 0;
  let m;
  while ((m = AWS_SECRET_RE.exec(line)) !== null) {
    hits.push({ kind: "aws-secret-key", value: m[1] });
  }
  return hits;
}

function scanLineForEnvRefs(line, seen) {
  ENV_REF_RE.lastIndex = 0;
  let m;
  while ((m = ENV_REF_RE.exec(line)) !== null) {
    const name = m[1] ?? m[2];
    if (name) seen.add(name);
  }
}

// For JSON files, we only walk top-level string values to avoid noisy
// matches on nested package-lock-like data. (We already skip the worst
// offenders by name above; this is a second line of defense.)
function jsonTopLevelStrings(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const out = [];
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val === "string") {
      out.push({ key, value: val });
    }
  }
  return out;
}

async function scanFile(appDir, fileEntry) {
  const { path: absPath, kind } = fileEntry;
  let raw;
  try {
    const st = await stat(absPath);
    if (st.size > MAX_BYTES) return { hardcoded: [], envRefs: new Set() };
    raw = await readFile(absPath, "utf8");
  } catch {
    return { hardcoded: [], envRefs: new Set() };
  }
  const rel = relative(appDir, absPath).split(sep).join("/");
  const hardcoded = [];
  const envRefs = new Set();

  if (kind === "source") {
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Hardcoded secrets.
      for (const hit of scanLineForSecrets(line)) {
        // Special-case the Google API key kind: if we're in a clearly-
        // Firebase context (filename or same-line "firebase"), we still
        // report the hit but tag it as suppressed so the UI can decide
        // not to escalate.
        const suppressed = hit.kind === "google-api-key-maybe-firebase"
          ? isFirebaseContext(rel, line)
          : false;
        hardcoded.push({
          file: rel,
          line: i + 1,
          kind: hit.kind,
          prefix: prefixOf(hit.value),
          redacted: redact(hit.value),
          excerpt: makeExcerpt(line),
          suppressed
        });
      }
      // process.env refs.
      scanLineForEnvRefs(line, envRefs);
    }
    return { hardcoded, envRefs };
  }

  // JSON path: only top-level string values.
  const items = jsonTopLevelStrings(raw);
  for (const { key, value } of items) {
    const hits = scanLineForSecrets(value);
    for (const hit of hits) {
      hardcoded.push({
        file: rel,
        line: 1,
        kind: hit.kind,
        prefix: prefixOf(hit.value),
        redacted: redact(hit.value),
        excerpt: makeExcerpt(`${key}: "${hit.value}"`),
        suppressed: false
      });
    }
  }
  return { hardcoded, envRefs };
}

export async function detectSecretsUsage(appDir) {
  const files = await listFiles(appDir);
  const allHardcoded = [];
  const allEnvRefs = new Set();

  for (const f of files) {
    const { hardcoded, envRefs } = await scanFile(appDir, f);
    for (const h of hardcoded) allHardcoded.push(h);
    for (const n of envRefs) allEnvRefs.add(n);
  }

  // Stable order for deterministic UI: file then line then kind.
  allHardcoded.sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
  });

  const envExampleKeys = await readEnvExample(appDir);

  return {
    hardcoded: allHardcoded,
    envRefs: [...allEnvRefs].sort(),
    envExampleKeys
  };
}
