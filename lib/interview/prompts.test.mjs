// lib/interview/prompts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { askText, askYesNo } from "./prompts.mjs";

function fakeStdin(...lines) {
  return Readable.from(lines.map(l => l + "\n"));
}

test("askText returns trimmed input", async () => {
  const stdout = { write: () => {} };
  const ans = await askText("Name?", "default", { input: fakeStdin("  hello  "), output: stdout });
  assert.equal(ans, "hello");
});

test("askText returns default on empty input", async () => {
  const stdout = { write: () => {} };
  const ans = await askText("Name?", "default", { input: fakeStdin(""), output: stdout });
  assert.equal(ans, "default");
});

test("askYesNo accepts y, yes, true", async () => {
  const stdout = { write: () => {} };
  for (const yes of ["y", "yes", "Y", "YES"]) {
    assert.equal(
      await askYesNo("?", false, { input: fakeStdin(yes), output: stdout }),
      true
    );
  }
});

test("askYesNo returns default on empty", async () => {
  const stdout = { write: () => {} };
  assert.equal(
    await askYesNo("?", true, { input: fakeStdin(""), output: stdout }),
    true
  );
});
