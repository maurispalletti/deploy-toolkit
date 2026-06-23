import { test } from "node:test";
import assert from "node:assert/strict";
import { collectPreflight } from "./preflight.mjs";

test("collectPreflight returns dev tools, node, firebaseCli, login status", async () => {
  const result = await collectPreflight();
  for (const key of ["brew", "git", "gh"]) {
    assert.ok(typeof result[key].installed === "boolean");
    assert.ok(result[key].ok === true || result[key].ok === false);
  }
  assert.ok(result.node && typeof result.node.version === "string");
  assert.ok(result.node.ok === true || result.node.ok === false);
  assert.ok(typeof result.firebaseCli.installed === "boolean");
  assert.ok(typeof result.login.ok === "boolean");
  if (result.login.ok) assert.ok(typeof result.login.email === "string");
});
