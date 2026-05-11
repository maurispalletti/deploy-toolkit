import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectApp, planApp } from "./brain.mjs";

const STATIC_SAMPLE = new URL("../../../samples/static-html", import.meta.url).pathname;

test("inspectApp returns the inspector hypothesis", async () => {
  const out = await inspectApp(STATIC_SAMPLE);
  assert.equal(out.framework, "none");
  assert.equal(out.suggestedShape, "A");
});

test("planApp persists deploy-app.config.json and returns the plan", async () => {
  const answers = {
    appName: "ui-brain-test",
    needsAuth: false,
    needsDb: false,
    shape: "A",
    secretKeys: []
  };
  const plan = await planApp(STATIC_SAMPLE, answers);
  assert.equal(plan.appName, "ui-brain-test");
  assert.match(plan.firebase.projectId, /^ui-brain-test-[a-z0-9]{1,4}$/);
});
