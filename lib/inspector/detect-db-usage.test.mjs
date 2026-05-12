import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectDbUsage } from "./detect-db-usage.mjs";

test("express-real sample is NOT flagged as incompatible", async () => {
  const result = await detectDbUsage("samples/express-real");
  assert.equal(result.incompatible, false);
  assert.deepEqual(result.drivers, []);
  assert.deepEqual(result.evidence, []);
});

test("static-html sample is NOT flagged as incompatible", async () => {
  const result = await detectDbUsage("samples/static-html");
  assert.equal(result.incompatible, false);
  assert.deepEqual(result.drivers, []);
});

test("express-sqlite sample IS flagged as incompatible", async () => {
  const result = await detectDbUsage("samples/express-sqlite");
  assert.equal(result.incompatible, true);
  assert.ok(result.drivers.includes("sqlite"), "drivers should include sqlite");
  // The functions/index.js opens `new Database(...)` — make sure that
  // call site is captured in the evidence.
  const sqliteHit = result.evidence.find(e => e.kind === "sqlite");
  assert.ok(sqliteHit, "expected a sqlite evidence entry");
  assert.equal(sqliteHit.file, "functions/index.js");
  assert.match(sqliteHit.excerpt, /new Database/);
  assert.ok(typeof sqliteHit.line === "number" && sqliteHit.line > 0);
});

// Use a tmpdir-based fixture to exercise the source-level patterns
// (pg's `new Pool(`, mongodb, prisma, fs writes) without committing
// per-driver samples to the repo. Each fixture sets up a tiny app
// folder, runs the detector, asserts the expected drivers/evidence.

async function makeFixture(files) {
  const dir = await mkdtemp(join(tmpdir(), "detect-db-"));
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    const parent = abs.slice(0, abs.lastIndexOf("/"));
    if (parent && parent !== dir) await mkdir(parent, { recursive: true });
    await writeFile(abs, content);
  }
  return dir;
}

test("detects pg via package.json dep + new Pool(", async () => {
  const dir = await makeFixture({
    "package.json": JSON.stringify({
      name: "demo",
      dependencies: { express: "^4", pg: "^8" }
    }),
    "src/db.js": [
      "const { Pool } = require('pg');",
      "const pool = new Pool({ connectionString: process.env.DB });",
      "module.exports = pool;"
    ].join("\n")
  });
  const result = await detectDbUsage(dir);
  assert.equal(result.incompatible, true);
  assert.ok(result.drivers.includes("postgres"));
  const hit = result.evidence.find(e => e.kind === "postgres");
  assert.ok(hit, "expected a postgres evidence entry");
  assert.equal(hit.file, "src/db.js");
  assert.match(hit.excerpt, /new Pool/);
});

test("detects mongodb via mongoose.connect call site", async () => {
  const dir = await makeFixture({
    "package.json": JSON.stringify({ name: "demo", dependencies: { mongoose: "^8" } }),
    "server.js": [
      "const mongoose = require('mongoose');",
      "mongoose.connect('mongodb://localhost/app');"
    ].join("\n")
  });
  const result = await detectDbUsage(dir);
  assert.equal(result.incompatible, true);
  assert.ok(result.drivers.includes("mongodb"));
  const hit = result.evidence.find(e => e.kind === "mongodb");
  assert.ok(hit, "expected a mongodb evidence entry");
  assert.match(hit.excerpt, /mongoose\.connect/);
});

test("flags fs.writeFileSync to a non-tmp path", async () => {
  const dir = await makeFixture({
    "package.json": JSON.stringify({ name: "demo", dependencies: {} }),
    "save.js": [
      "const fs = require('fs');",
      "fs.writeFileSync('./data/log.json', JSON.stringify({hi:1}));"
    ].join("\n")
  });
  const result = await detectDbUsage(dir);
  assert.equal(result.incompatible, true);
  assert.ok(result.drivers.includes("fs-writes"));
  const hit = result.evidence.find(e => e.kind === "fs-writes");
  assert.ok(hit, "expected an fs-writes evidence entry");
  assert.equal(hit.file, "save.js");
});

test("does NOT flag fs.writeFileSync to /tmp/", async () => {
  const dir = await makeFixture({
    "package.json": JSON.stringify({ name: "demo", dependencies: {} }),
    "tmp.js": [
      "const fs = require('fs');",
      "fs.writeFileSync('/tmp/x.json', '{}');"
    ].join("\n")
  });
  const result = await detectDbUsage(dir);
  assert.equal(result.incompatible, false);
  assert.deepEqual(result.drivers, []);
});

test("ignores node_modules, dist, build, out, and hidden dirs", async () => {
  const dir = await makeFixture({
    "package.json": JSON.stringify({ name: "demo", dependencies: {} }),
    "node_modules/foo/index.js": "new Database('x');",
    "dist/bundle.js": "new Pool({});",
    "build/out.js": "mongoose.connect('mongodb://x');",
    "out/page.js": "fs.writeFileSync('./y', '');",
    ".firebase/cache.js": "new Database('z');",
    "src/clean.js": "// nothing interesting here"
  });
  const result = await detectDbUsage(dir);
  assert.equal(result.incompatible, false);
  assert.deepEqual(result.drivers, []);
  assert.deepEqual(result.evidence, []);
});

test("recognises prisma in functions/package.json (Shape C layout)", async () => {
  const dir = await makeFixture({
    "package.json": JSON.stringify({ name: "demo" }),
    "functions/package.json": JSON.stringify({
      name: "demo-functions",
      dependencies: { "firebase-functions": "^5", "@prisma/client": "^5" }
    }),
    "functions/index.js": "const { PrismaClient } = require('@prisma/client');"
  });
  const result = await detectDbUsage(dir);
  assert.equal(result.incompatible, true);
  assert.ok(result.drivers.includes("prisma"));
});
