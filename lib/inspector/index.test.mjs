import { test } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "./index.mjs";

test("vite-react sample classified as shape A or B with dist output", async () => {
  const result = await inspect("samples/vite-react");
  assert.equal(result.framework, "vite-react");
  assert.equal(result.outputDir, "dist");
  assert.equal(result.hasBackend, false);
  assert.deepEqual(result.envKeys.sort(), ["VITE_API_URL", "VITE_FEATURE_FLAG"]);
  assert.equal(result.suggestedShape, "A_or_B");
});

test("express sample classified as shape C", async () => {
  const result = await inspect("samples/express-backend");
  assert.equal(result.framework, "express");
  assert.equal(result.hasBackend, true);
  assert.equal(result.suggestedShape, "C");
});

test("static-html sample classified as shape A", async () => {
  const result = await inspect("samples/static-html");
  assert.equal(result.framework, "none");
  assert.equal(result.outputDir, ".");
  assert.equal(result.hasBackend, false);
  assert.equal(result.suggestedShape, "A");
});

test("express-real sample classified as shape C with public/ output", async () => {
  // The user's app ships with a Firebase-conventional layout:
  //   public/      → static frontend
  //   functions/   → backend with its own package.json declaring
  //                  firebase-functions as a dep
  // The inspector treats that as a first-class Shape C project.
  const result = await inspect("samples/express-real");
  assert.equal(result.hasBackend, true);
  assert.equal(result.suggestedShape, "C");
  assert.equal(result.outputDir, "public");
  // express-real does not use any incompatible DB driver.
  assert.equal(result.dbIncompat, false);
  assert.deepEqual(result.dbIncompatDetails.drivers, []);
});

test("express-sqlite sample is detected as DB-incompatible", async () => {
  // express-sqlite ships better-sqlite3 in functions/package.json and
  // opens `new Database(...)` in functions/index.js. The inspector
  // surfaces dbIncompat: true so the wizard can block the deploy.
  const result = await inspect("samples/express-sqlite");
  assert.equal(result.hasBackend, true);
  assert.equal(result.suggestedShape, "C");
  assert.equal(result.dbIncompat, true);
  assert.ok(result.dbIncompatDetails.drivers.includes("sqlite"));
  assert.ok(result.dbIncompatDetails.evidence.length > 0);
  const sqliteHit = result.dbIncompatDetails.evidence.find(e => e.kind === "sqlite");
  assert.ok(sqliteHit, "expected a sqlite evidence entry");
  assert.equal(sqliteHit.file, "functions/index.js");
});

test("express-with-secret sample is detected as having hardcoded secrets", async () => {
  // express-with-secret ships a Stripe test key hardcoded in
  // functions/index.js. The inspector surfaces hasHardcodedSecrets > 0
  // so the wizard can block the deploy with the C6 prompt page.
  const result = await inspect("samples/express-with-secret");
  assert.equal(result.hasBackend, true);
  assert.equal(result.suggestedShape, "C");
  // The DB scan should NOT flag this sample — it has no incompatible
  // driver, just hardcoded secrets.
  assert.equal(result.dbIncompat, false);
  // Hardcoded secrets should be > 0.
  assert.ok(result.hasHardcodedSecrets > 0, `expected > 0, got ${result.hasHardcodedSecrets}`);
  const stripeHit = result.secrets.hardcoded.find(h => h.kind === "stripe-test");
  assert.ok(stripeHit, "expected a stripe-test hit");
  assert.equal(stripeHit.file, "functions/index.js");
  assert.equal(stripeHit.suppressed, false);
});
