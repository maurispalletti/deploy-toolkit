import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRefactorPrompt, generateDbRefactorPrompt } from "./template.mjs";

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
