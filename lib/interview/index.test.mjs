// lib/interview/index.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { interview } from "./index.mjs";

function fakeStdin(...lines) {
  return Readable.from(lines.map(l => l + "\n"));
}
const silent = { write: () => {} };

test("vite-react inspection: asks for name, auth, db, and confirms shape", async () => {
  const inspection = {
    framework: "vite-react",
    outputDir: "dist",
    hasBackend: false,
    envKeys: [],
    suggestedShape: "A_or_B",
    pkgName: "sample-vite-react"
  };
  const stdin = fakeStdin(
    "my-app",   // app name
    "yes",      // needs auth
    "yes"       // needs db
  );
  const answers = await interview(inspection, { input: stdin, output: silent });
  assert.equal(answers.appName, "my-app");
  assert.equal(answers.needsAuth, true);
  assert.equal(answers.needsDb, true);
  assert.equal(answers.shape, "B");
});

test("express inspection: skips auth/db questions, defaults shape C, asks about Blaze", async () => {
  const inspection = {
    framework: "express",
    outputDir: null,
    hasBackend: true,
    envKeys: ["STRIPE_KEY"],
    suggestedShape: "C",
    pkgName: "sample-express"
  };
  const stdin = fakeStdin(
    "tax-helper",   // name
    "no",           // auth
    "yes",          // db
    "yes"           // confirm Blaze
  );
  const answers = await interview(inspection, { input: stdin, output: silent });
  assert.equal(answers.shape, "C");
  assert.equal(answers.acceptedBlaze, true);
});
