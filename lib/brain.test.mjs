import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runBrain } from "./brain.mjs";

test("if deploy-app.config.json exists, brain returns it without prompting", async () => {
  const tmp = "samples/.tmp-existing-config";
  await mkdir(tmp, { recursive: true });
  const existing = { appName: "saved", shape: "A", firebase: { projectId: "saved-1234" } };
  await writeFile(join(tmp, "deploy-app.config.json"), JSON.stringify(existing));

  const config = await runBrain(tmp, { interactive: false });
  assert.equal(config.appName, "saved");
  assert.equal(config.firebase.projectId, "saved-1234");

  await rm(tmp, { recursive: true });
});

test("non-interactive without existing config returns inspection-only plan", async () => {
  const config = await runBrain("samples/static-html", { interactive: false });
  assert.equal(config.shape, "A");
  // Cleanup written file
  await rm(join("samples/static-html", "deploy-app.config.json"));
});
