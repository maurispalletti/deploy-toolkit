import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFramework } from "./detect-framework.mjs";

test("detects vite + react", () => {
  const pkg = {
    dependencies: { react: "^18" },
    devDependencies: { vite: "^5" }
  };
  assert.equal(detectFramework(pkg), "vite-react");
});

test("detects next.js", () => {
  const pkg = { dependencies: { next: "^14", react: "^18" } };
  assert.equal(detectFramework(pkg), "nextjs");
});

test("detects express backend", () => {
  const pkg = { dependencies: { express: "^4" } };
  assert.equal(detectFramework(pkg), "express");
});

test("returns 'unknown' when nothing recognized", () => {
  assert.equal(detectFramework({ dependencies: { foo: "1.0" } }), "unknown");
});

test("returns 'none' when pkg is null", () => {
  assert.equal(detectFramework(null), "none");
});
