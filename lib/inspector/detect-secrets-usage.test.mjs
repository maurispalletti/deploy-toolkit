import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectSecretsUsage } from "./detect-secrets-usage.mjs";

// Use a tmpdir-based fixture to exercise the prefix patterns without
// committing real-looking-secret samples to the repo. Each test sets
// up a tiny app folder, runs the detector, asserts the expected hits.
async function makeFixture(files) {
  const dir = await mkdtemp(join(tmpdir(), "detect-secrets-"));
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    const parent = abs.slice(0, abs.lastIndexOf("/"));
    if (parent && parent !== dir) await mkdir(parent, { recursive: true });
    await writeFile(abs, content);
  }
  return dir;
}

test("detects Stripe sk_live_ keys", async () => {
  const dir = await makeFixture({
    "src/billing.js": [
      "const stripe = require('stripe');",
      "const client = stripe('sk_live_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEF');"
    ].join("\n")
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "stripe-live");
  assert.ok(hit, "expected stripe-live hit");
  assert.equal(hit.file, "src/billing.js");
  assert.equal(hit.line, 2);
  assert.match(hit.prefix, /^sk_live_/);
  assert.match(hit.redacted, /^sk_l.*…/);
  assert.equal(hit.suppressed, false);
});

test("detects Stripe sk_test_ keys", async () => {
  const dir = await makeFixture({
    "functions/index.js": [
      "const stripe = require('stripe')(",
      "  'sk_test_FakeKeyForTesting1234567890abcdefghij'",
      ");"
    ].join("\n")
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "stripe-test");
  assert.ok(hit, "expected stripe-test hit");
  assert.equal(hit.file, "functions/index.js");
  assert.match(hit.prefix, /^sk_test_/);
});

test("detects AWS access key id (AKIA...)", async () => {
  const dir = await makeFixture({
    "config.js": "const KEY = 'AKIAIOSFODNN7EXAMPLE';"
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "aws-access-key");
  assert.ok(hit, "expected aws-access-key hit");
  assert.match(hit.redacted, /^AKIA/);
});

test("detects GitHub personal access tokens (ghp_...)", async () => {
  const dir = await makeFixture({
    "deploy.js": "const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';"
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "github-pat");
  assert.ok(hit, "expected github-pat hit");
  assert.match(hit.prefix, /^ghp_/);
});

test("detects Anthropic API keys (sk-ant-...)", async () => {
  const dir = await makeFixture({
    // 40+ chars after the prefix.
    "src/llm.ts": "const ANTHROPIC = 'sk-ant-api03-AbCdEf012345-_AbCdEf012345-_AbCdEf012345-_xx';"
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "anthropic");
  assert.ok(hit, "expected anthropic hit");
  assert.match(hit.prefix, /^sk-ant-/);
});

test("detects OpenAI API keys (sk-...) without colliding with sk-ant-", async () => {
  const dir = await makeFixture({
    "openai.js": [
      "const OPENAI = 'sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDE';",
      "const ANTHROPIC = 'sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';"
    ].join("\n")
  });
  const result = await detectSecretsUsage(dir);
  const openai = result.hardcoded.find(h => h.kind === "openai");
  const anthropic = result.hardcoded.find(h => h.kind === "anthropic");
  assert.ok(openai, "expected openai hit");
  assert.ok(anthropic, "expected anthropic hit");
  // Crucial: the OpenAI regex must NOT also flag the Anthropic value.
  // i.e. there should be exactly one openai hit (line 1) and exactly one
  // anthropic hit (line 2).
  assert.equal(result.hardcoded.filter(h => h.kind === "openai").length, 1);
  assert.equal(result.hardcoded.filter(h => h.kind === "anthropic").length, 1);
  assert.equal(openai.line, 1);
  assert.equal(anthropic.line, 2);
});

test("detects Slack bot tokens (xoxb-...)", async () => {
  const dir = await makeFixture({
    "src/slack.js": "const SLACK = 'xoxb-1234567890-abcdefghij';"
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "slack-bot");
  assert.ok(hit, "expected slack-bot hit");
});

test("AIza Google API key in firebase-config.js is suppressed", async () => {
  // Firebase web SDK keys legitimately start with AIza and are public.
  // The detector still emits the hit (so a future check can audit) but
  // marks it suppressed so the UI doesn't block.
  const dir = await makeFixture({
    "src/firebase-config.js": [
      "export const firebaseConfig = {",
      "  apiKey: 'AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',",
      "  authDomain: 'my-app.firebaseapp.com',",
      "};"
    ].join("\n")
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "google-api-key-maybe-firebase");
  assert.ok(hit, "expected google-api-key-maybe-firebase hit");
  assert.equal(hit.suppressed, true, "should be suppressed inside firebase-config.js");
});

test("AIza Google API key outside a Firebase context is NOT suppressed", async () => {
  // A loose AIza in a random source file is more suspicious — it could
  // legitimately be a Firebase key the user just hasn't named clearly,
  // OR it could be a real Google Maps / Cloud API key. We let the user
  // decide. The detector marks it not-suppressed.
  const dir = await makeFixture({
    "src/maps.js": "const GOOGLE_MAPS = 'AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';"
  });
  const result = await detectSecretsUsage(dir);
  const hit = result.hardcoded.find(h => h.kind === "google-api-key-maybe-firebase");
  assert.ok(hit, "expected google-api-key-maybe-firebase hit");
  assert.equal(hit.suppressed, false);
});

test("express-real sample has NO hardcoded secrets (negative control)", async () => {
  const result = await detectSecretsUsage("samples/express-real");
  // Only count non-suppressed hits — the express-real frontend may have
  // a legitimate Firebase config but we don't want false positives.
  const blocking = result.hardcoded.filter(h => !h.suppressed);
  assert.deepEqual(blocking, [], `expected no blocking secrets, found ${JSON.stringify(blocking)}`);
});

test("captures process.env.X references", async () => {
  const dir = await makeFixture({
    "src/app.js": [
      "const a = process.env.STRIPE_KEY;",
      "const b = process.env['SLACK_TOKEN'];",
      "const c = process.env.GREETING_PREFIX;"
    ].join("\n")
  });
  const result = await detectSecretsUsage(dir);
  assert.deepEqual(result.envRefs, ["GREETING_PREFIX", "SLACK_TOKEN", "STRIPE_KEY"]);
});

test("includes envExampleKeys from .env.example", async () => {
  const dir = await makeFixture({
    ".env.example": [
      "API_URL=",
      "# a comment",
      "VITE_TITLE=My App",
      "",
      "STRIPE_KEY="
    ].join("\n"),
    "src/app.js": "// no env refs here"
  });
  const result = await detectSecretsUsage(dir);
  assert.deepEqual(result.envExampleKeys.sort(), ["API_URL", "STRIPE_KEY", "VITE_TITLE"]);
});

test("ignores node_modules, dist, build, out, .firebase, .git", async () => {
  const dir = await makeFixture({
    "package.json": JSON.stringify({ name: "demo" }),
    "node_modules/foo/bar.js": "const x = 'sk_live_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';",
    "dist/bundle.js": "const x = 'AKIAIOSFODNN7EXAMPLE';",
    "build/out.js": "const x = 'ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';",
    "out/page.js": "const x = 'sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';",
    ".firebase/cache.js": "const x = 'sk_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';",
    ".git/hooks/x.js": "const x = 'sk_test_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';",
    "src/clean.js": "// nothing interesting"
  });
  const result = await detectSecretsUsage(dir);
  assert.deepEqual(result.hardcoded, []);
});

test("hardcoded list is sorted by file then line", async () => {
  const dir = await makeFixture({
    "z/late.js": "const x = 'sk_live_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEF';",
    "a/early.js": [
      "// line 1",
      "const y = 'sk_test_FakeKeyForTesting1234567890abcdefghij';"
    ].join("\n")
  });
  const result = await detectSecretsUsage(dir);
  assert.ok(result.hardcoded.length >= 2);
  // First by lexical filename, then by line.
  assert.equal(result.hardcoded[0].file, "a/early.js");
  assert.equal(result.hardcoded[1].file, "z/late.js");
});
