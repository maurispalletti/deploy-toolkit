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
});
