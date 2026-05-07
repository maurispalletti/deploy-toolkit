import { test } from "node:test";
import assert from "node:assert/strict";
import { hasBackend } from "./has-backend.mjs";

test("express framework -> true", async () => {
  assert.equal(await hasBackend("samples/express-backend", "express"), true);
});

test("vite-react -> false", async () => {
  assert.equal(await hasBackend("samples/vite-react", "vite-react"), false);
});

test("static-html -> false", async () => {
  assert.equal(await hasBackend("samples/static-html", "none"), false);
});
