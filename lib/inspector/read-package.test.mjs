import { test } from "node:test";
import assert from "node:assert/strict";
import { readPackageJson } from "./read-package.mjs";

test("returns parsed JSON when package.json exists", async () => {
  const pkg = await readPackageJson("samples/vite-react");
  assert.equal(pkg.name, "sample-vite-react");
});

test("returns null when package.json is missing", async () => {
  const pkg = await readPackageJson("samples/static-html");
  assert.equal(pkg, null);
});

test("returns null when package.json is malformed", async () => {
  const pkg = await readPackageJson("/nonexistent/path");
  assert.equal(pkg, null);
});
