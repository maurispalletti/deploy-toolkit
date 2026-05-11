import { test } from "node:test";
import assert from "node:assert/strict";
import { runStage } from "./run-stage.mjs";

test("runStage emits log lines and a done event", async () => {
  // Use the existing build.sh against a sample with no build command —
  // it should print 'skipping' and exit 0.
  const events = [];
  await new Promise((resolve, reject) => {
    runStage("build", "/Users/mauriciospalletti/Documents/personal/deploy-toolkit/samples/static-html", {
      write: (line) => events.push(line),
      end: () => resolve(),
    }).catch(reject);
  });
  const joined = events.join("\n");
  assert.match(joined, /event: log/);
  assert.match(joined, /event: done/);
});
