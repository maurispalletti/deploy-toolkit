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

test("project ID is slugified and suffixed for global uniqueness", () => {
  const inspection = { framework: "none", outputDir: ".", hasBackend: false, envKeys: [] };
  const answers = { appName: "My Cool App!", needsAuth: false, needsDb: false, shape: "A", secretKeys: [] };
  const result = plan(inspection, answers);
  assert.match(result.firebase.projectId, /^my-cool-app-[a-z0-9]{4}$/);
});
