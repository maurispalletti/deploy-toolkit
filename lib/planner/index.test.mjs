import { test } from "node:test";
import assert from "node:assert/strict";
import { plan } from "./index.mjs";

test("plan always includes auth and firestore", () => {
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answers = { appName: "my-app", shape: "B", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.deepEqual(result.auth.providers, ["google"]);
  assert.equal(result.firestore.rulesFile, "firestore.rules");
  assert.equal(result.functions, null);
});

test("Shape C plan: hosting + functions + secrets", () => {
  const inspection = { framework: "express", outputDir: null, hasBackend: true, envKeys: ["STRIPE_KEY"] };
  const answers = { appName: "billing", shape: "C", secretKeys: ["STRIPE_KEY"] };
  const result = plan(inspection, answers);
  assert.equal(result.shape, "C");
  assert.equal(result.functions.dir, "functions");
  assert.deepEqual(result.functions.secrets, ["STRIPE_KEY"]);
});

test("Shape C plan: outputDir 'public' surfaces as hosting.publicDir 'public'", () => {
  const inspection = { framework: "unknown", outputDir: "public", hasBackend: true, envKeys: [] };
  const answers = { appName: "express-real", shape: "C", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.hosting.publicDir, "public");
  assert.deepEqual(result.hosting.rewrites, [{ source: "/api/**", function: "api" }]);
  assert.equal(result.functions.dir, "functions");
});

test("project ID is slugified from app name", () => {
  const inspection = { framework: "none", outputDir: ".", hasBackend: false, envKeys: [] };
  const answers = { appName: "My Cool App!", shape: "B", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.firebase.projectId, "my-cool-app");
});

test("plan.secrets payload reflects per-key classification", () => {
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: ["VITE_APP_TITLE"] };
  const answers = {
    appName: "site", shape: "B", secretKeys: [],
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
  assert.equal(result.functions, null);
});

test("plan.functions.secrets uses server-only names from perKey when present", () => {
  const inspection = { framework: "express", outputDir: "public", hasBackend: true, envKeys: ["STRIPE_KEY", "PUBLIC_URL"] };
  const answers = {
    appName: "billing", shape: "C", secretKeys: ["STRIPE_KEY", "PUBLIC_URL"],
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
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const answers = { appName: "x", shape: "B", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.equal(result.secrets, null);
});

test("plan.auth.scaffoldMode is 'auto' by default", () => {
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const result = plan(inspection, { appName: "notes", shape: "B", secretKeys: [] });
  assert.equal(result.auth.scaffoldMode, "auto");
  assert.deepEqual(result.auth.providers, ["google"]);
});

test("plan.auth.scaffoldMode is 'prompt' when authChoice is 'prompt'", () => {
  const inspection = { framework: "vite-react", outputDir: "dist", hasBackend: false, envKeys: [] };
  const result = plan(inspection, { appName: "notes", shape: "B", secretKeys: [], authChoice: "prompt" });
  assert.equal(result.auth.scaffoldMode, "prompt");
});
