import { test } from "node:test";
import assert from "node:assert/strict";
import { plan } from "./index.mjs";

test("Shape A plan: hosting only", () => {
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answers = { appName: "my-app", needsAuth: false, needsDb: false, shape: "A", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.shape, "A");
  assert.equal(result.hosting.publicDir, "dist");
  assert.equal(result.firestore, null);
  assert.equal(result.auth, null);
  assert.equal(result.functions, null);
});

test("Shape B plan: hosting + firestore + auth", () => {
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answers = { appName: "my-app", needsAuth: true, needsDb: true, shape: "B", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.shape, "B");
  assert.deepEqual(result.auth.providers, ["google"]);
  assert.equal(result.firestore.rulesFile, "firestore.rules");
});

test("Shape C plan: hosting + functions + secrets", () => {
  const inspection = { framework: "express", outputDir: null, hasBackend: true, envKeys: ["STRIPE_KEY"] };
  const answers = { appName: "billing", needsAuth: false, needsDb: true, shape: "C", secretKeys: ["STRIPE_KEY"] };
  const result = plan(inspection, answers);
  assert.equal(result.shape, "C");
  assert.equal(result.functions.dir, "functions");
  assert.deepEqual(result.functions.secrets, ["STRIPE_KEY"]);
});

test("Shape C plan: outputDir 'public' surfaces as hosting.publicDir 'public'", () => {
  // Firebase-conventional layout: app ships a public/ frontend and
  // functions/ backend. The planner must honor the inspector's
  // outputDir verbatim instead of falling back to the "dist" default
  // that's right for built frontends but wrong for static public/.
  const inspection = { framework: "unknown", outputDir: "public", hasBackend: true, envKeys: [] };
  const answers = { appName: "express-real", needsAuth: false, needsDb: false, shape: "C", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.hosting.publicDir, "public");
  assert.deepEqual(result.hosting.rewrites, [{ source: "/api/**", function: "api" }]);
  assert.equal(result.functions.dir, "functions");
});

test("project ID is slugified from app name", () => {
  const inspection = { framework: "none", outputDir: ".", hasBackend: false, envKeys: [] };
  const answers = { appName: "My Cool App!", needsAuth: false, needsDb: false, shape: "A", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.firebase.projectId, "my-cool-app");
});

test("plan.secrets payload reflects per-key classification (Shape A/B)", () => {
  // Shape A (or B) with envExampleKeys classified by the user. The plan
  // surfaces the full perKey list so inject-secrets can write the
  // browser-safe ones into .env.production. functions stays null.
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: ["VITE_APP_TITLE"] };
  const answers = {
    appName: "site", needsAuth: false, needsDb: false, shape: "A", secretKeys: [],
    secrets: {
      perKey: [
        { name: "VITE_APP_TITLE", classification: "browser-safe", value: "My Site" }
      ]
    }
  };
  const result = plan(inspection, answers);
  assert.ok(result.secrets, "plan.secrets should be present");
  assert.equal(result.secrets.perKey.length, 1);
  assert.equal(result.secrets.perKey[0].name, "VITE_APP_TITLE");
  assert.equal(result.secrets.perKey[0].classification, "browser-safe");
  assert.equal(result.secrets.perKey[0].value, "My Site");
  // Shape A → no functions block.
  assert.equal(result.functions, null);
});

test("plan.functions.secrets uses server-only names from perKey when present", () => {
  // Shape C with mixed classification. functions.secrets should only
  // include the server-only names (so the Cloud Functions runtime is
  // granted access to exactly the right Firebase Functions secrets).
  const inspection = { framework: "express", outputDir: "public", hasBackend: true, envKeys: ["STRIPE_KEY", "PUBLIC_URL"] };
  const answers = {
    appName: "billing", needsAuth: false, needsDb: false, shape: "C", secretKeys: ["STRIPE_KEY", "PUBLIC_URL"],
    secrets: {
      perKey: [
        { name: "STRIPE_KEY", classification: "server-only", value: "" },
        { name: "PUBLIC_URL", classification: "browser-safe", value: "https://example.com" }
      ]
    }
  };
  const result = plan(inspection, answers);
  assert.deepEqual(result.functions.secrets, ["STRIPE_KEY"]);
  assert.equal(result.secrets.perKey.length, 2);
});

test("plan.secrets is null when answers omit the secrets field", () => {
  // Backwards compat: callers that don't run the classify page (e.g.
  // the CLI brain, or pre-C6 frontends) get plan.secrets === null.
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answers = { appName: "x", needsAuth: false, needsDb: false, shape: "A", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.secrets, null);
});


test("plan.auth.scaffoldMode === 'auto' when answers.authChoice is 'auto' (or missing)", () => {
  // Default-path: needsAuth=true and authChoice is 'auto'. The planner
  // should record scaffoldMode='auto' so inject-auth performs the
  // full template + splice + npm install.
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answersAuto = {
    appName: "notes", needsAuth: true, needsDb: false, shape: "B",
    secretKeys: [], authChoice: "auto"
  };
  const planAuto = plan(inspection, answersAuto);
  assert.equal(planAuto.auth.scaffoldMode, "auto");
  assert.deepEqual(planAuto.auth.providers, ["google"]);

  // Backwards compat: CLI mode (no authChoice field) defaults to 'auto'.
  const answersDefault = {
    appName: "notes", needsAuth: true, needsDb: false, shape: "B",
    secretKeys: []
  };
  const planDefault = plan(inspection, answersDefault);
  assert.equal(planDefault.auth.scaffoldMode, "auto");
});

test("plan.auth.scaffoldMode === 'prompt' when answers.authChoice is 'prompt'", () => {
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answers = {
    appName: "notes", needsAuth: true, needsDb: false, shape: "B",
    secretKeys: [], authChoice: "prompt"
  };
  const result = plan(inspection, answers);
  assert.equal(result.auth.scaffoldMode, "prompt");
  assert.deepEqual(result.auth.providers, ["google"]);
});

test("plan.auth stays null when answers.needsAuth is false regardless of authChoice", () => {
  // Defensive: even if a stale authChoice ended up in answers, the
  // planner shouldn't synthesise an auth block when needsAuth is false.
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answers = {
    appName: "x", needsAuth: false, needsDb: false, shape: "A",
    secretKeys: [], authChoice: "auto"
  };
  assert.equal(plan(inspection, answers).auth, null);
});
