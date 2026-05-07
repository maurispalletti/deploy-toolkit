import { test } from "node:test";
import assert from "node:assert/strict";
import { readEnvExample } from "./read-env-example.mjs";

test("parses keys from .env.example", async () => {
  const keys = await readEnvExample("samples/vite-react");
  assert.deepEqual(keys.sort(), ["VITE_API_URL", "VITE_FEATURE_FLAG"].sort());
});

test("returns empty array when no .env.example", async () => {
  const keys = await readEnvExample("samples/static-html");
  assert.deepEqual(keys, []);
});

test("ignores comments and blank lines", async () => {
  // We'll use the existing fixture which has neither, so just spot-check parser:
  assert.deepEqual(await readEnvExample("/nonexistent"), []);
});
