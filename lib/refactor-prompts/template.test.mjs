import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateRefactorPrompt,
  generateDbRefactorPrompt,
  generateSecretsRefactorPrompt
} from "./template.mjs";

test("generateRefactorPrompt renders the expected section headings", () => {
  const md = generateRefactorPrompt({
    kind: "demo",
    title: "Demo refactor",
    appName: "test-app",
    summary: "A short summary.",
    detected: ["src/a.js:1 — kind: details"],
    whyItMatters: "Because Firebase.",
    recipe: "Do X.",
    steps: ["Step one.", "Step two."]
  });
  // Every section header must be present so the reader (and any AI tool
  // parsing the doc) knows where things live.
  assert.match(md, /^# Demo refactor/m);
  assert.match(md, /## What we detected/);
  assert.match(md, /## Why this matters/);
  assert.match(md, /## Recipe/);
  assert.match(md, /## Refactor steps/);
  assert.match(md, /## When you're done/);
  // App name and summary appear up top.
  assert.match(md, /test-app/);
  assert.match(md, /A short summary\./);
  // Detected and steps are bullet/numbered.
  assert.match(md, /- src\/a\.js:1 — kind: details/);
  assert.match(md, /1\. Step one\./);
  assert.match(md, /2\. Step two\./);
  // Default rerun command.
  assert.match(md, /```bash\n\.\/deploy-app\n```/);
});

test("generateDbRefactorPrompt embeds detected drivers and evidence", () => {
  const md = generateDbRefactorPrompt({
    appName: "notes",
    framework: "express",
    drivers: ["sqlite"],
    evidence: [
      { file: "functions/index.js", line: 14, kind: "sqlite", excerpt: "const db = new Database(\"notes.db\");" }
    ]
  });
  // Title is the D5-specific phrasing.
  assert.match(md, /^# Refactor for Firebase: replace incompatible local DB with Firestore/m);
  // App name and framework appear.
  assert.match(md, /`notes`/);
  assert.match(md, /`express`/);
  // Drivers list shows up.
  assert.match(md, /Detected drivers: sqlite/);
  // Evidence file:line appears verbatim.
  assert.match(md, /`functions\/index\.js:14`/);
  // The Firestore recipe is present (mentions the adapter and getFirestore).
  assert.match(md, /storage adapter/i);
  assert.match(md, /getFirestore/);
  // A concrete step generated from the evidence row.
  assert.match(md, /Migrate the call at `functions\/index\.js:14`/);
  // Stock-monitor cross-reference is preserved.
  assert.match(md, /personal\/monitor\/src\/storage\.js/);
  // Re-run instruction.
  assert.match(md, /```bash\n\.\/deploy-app\n```/);
});

test("generateDbRefactorPrompt handles fs-writes driver without removing it as a dep", () => {
  // fs-writes isn't a dep — it's a call-site pattern. We don't want
  // the prompt to tell the AI to delete "fs-writes" from package.json.
  const md = generateDbRefactorPrompt({
    appName: "loggy",
    framework: "express",
    drivers: ["fs-writes"],
    evidence: [
      { file: "save.js", line: 7, kind: "fs-writes", excerpt: "fs.writeFileSync('./log.json', ...)" }
    ]
  });
  assert.match(md, /Detected drivers: fs-writes/);
  // Should NOT instruct removal of "fs-writes" from package.json.
  assert.doesNotMatch(md, /Remove `fs-writes`/);
  // Should still have a migration step for the call site.
  assert.match(md, /Migrate the call at `save\.js:7`/);
});

test("generateDbRefactorPrompt handles empty evidence (deps-only detection) gracefully", () => {
  const md = generateDbRefactorPrompt({
    appName: "deps-only",
    framework: "express",
    drivers: ["postgres"],
    evidence: []
  });
  assert.match(md, /Detected drivers: postgres/);
  // No call-site bullets but the dep-removal step still fires.
  assert.match(md, /Remove `postgres`/);
});

test("generateSecretsRefactorPrompt embeds redacted hits and per-site steps", () => {
  const md = generateSecretsRefactorPrompt({
    appName: "billing",
    framework: "express",
    hardcoded: [
      {
        file: "functions/index.js",
        line: 4,
        kind: "stripe-live",
        prefix: "sk_live_",
        redacted: "sk_l…6789",
        excerpt: "const stripe = require('stripe')('sk_live_AAA…');",
        suppressed: false
      }
    ],
    envRefs: ["DATABASE_URL"]
  });
  // Title is the C6-specific phrasing.
  assert.match(md, /^# Refactor for Firebase: move hardcoded secrets/m);
  // App name and framework appear.
  assert.match(md, /`billing`/);
  assert.match(md, /`express`/);
  // Detected list shows the redacted form (NOT the raw secret).
  assert.match(md, /functions\/index\.js:4/);
  assert.match(md, /sk_l…6789/);
  // The recipe talks about .env + .gitignore.
  assert.match(md, /\.env/);
  assert.match(md, /\.gitignore/);
  // The Vite/Next instructions react to the framework. Express → server only,
  // so the prompt mentions process.env.
  assert.match(md, /process\.env/);
  // A concrete step per detected literal.
  assert.match(md, /Replace the literal at `functions\/index\.js:4`/);
  // The envRefs list lands in the steps.
  assert.match(md, /DATABASE_URL/);
  // Re-run instruction.
  assert.match(md, /```bash\n\.\/deploy-app\n```/);
});

test("generateSecretsRefactorPrompt excludes suppressed hits from the prompt", () => {
  const md = generateSecretsRefactorPrompt({
    appName: "site",
    framework: "vite-react",
    hardcoded: [
      // Suppressed — Firebase web SDK key in config; not a real leak.
      {
        file: "src/firebase-config.js",
        line: 2,
        kind: "google-api-key-maybe-firebase",
        prefix: "AIzaSyDx",
        redacted: "AIza…AAAA",
        excerpt: "apiKey: 'AIza…',",
        suppressed: true
      },
      // Not suppressed — real Stripe leak.
      {
        file: "src/billing.js",
        line: 3,
        kind: "stripe-live",
        prefix: "sk_live_",
        redacted: "sk_l…wxyz",
        excerpt: "const sk = 'sk_live_…';",
        suppressed: false
      }
    ],
    envRefs: []
  });
  // The suppressed line MUST NOT appear in the prompt — we don't want
  // the user to be asked to refactor a legitimate Firebase web key.
  assert.doesNotMatch(md, /firebase-config\.js:2/);
  // The non-suppressed Stripe leak DOES appear.
  assert.match(md, /src\/billing\.js:3/);
  // Framework is Vite → recipe mentions import.meta.env.
  assert.match(md, /import\.meta\.env/);
  // The summary says "1 hardcoded secret" (singular) — only the non-
  // suppressed entry counts toward the prompt's headline number.
  assert.match(md, /1 hardcoded secret\b/);
});

test("generateSecretsRefactorPrompt handles empty hardcoded list (envRefs-only case)", () => {
  const md = generateSecretsRefactorPrompt({
    appName: "envcheck",
    framework: "vite-react",
    hardcoded: [],
    envRefs: ["VITE_APP_TITLE", "API_BASE"]
  });
  // No detected literals — the placeholder explains that.
  assert.match(md, /No hardcoded secrets detected/);
  // Still has the recipe so the user can see the env-var hygiene steps.
  assert.match(md, /\.env/);
  // The env refs make it into the steps.
  assert.match(md, /VITE_APP_TITLE/);
});
