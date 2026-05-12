import { test } from "node:test";
import assert from "node:assert/strict";
import { findOutputDir } from "./find-output-dir.mjs";

test("vite-react -> dist when present", async () => {
  const dir = await findOutputDir("samples/vite-react", "vite-react");
  assert.equal(dir, "dist");
});

test("vite-react -> dist even when dist/ does not exist yet", async () => {
  // Build stage will create dist/, so we return the convention regardless.
  const dir = await findOutputDir("/nonexistent/vite-react-app", "vite-react");
  assert.equal(dir, "dist");
});

test("nextjs -> out when present", async () => {
  const dir = await findOutputDir("samples/nextjs-static", "nextjs");
  assert.equal(dir, "out");
});

test("static-html -> '.' (root)", async () => {
  const dir = await findOutputDir("samples/static-html", "none");
  assert.equal(dir, ".");
});

test("returns null when no output dir found and not static", async () => {
  const dir = await findOutputDir("samples/express-backend", "express");
  assert.equal(dir, null);
});
