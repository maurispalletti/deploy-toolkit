import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWebSdkConfig, renderFirebaseConfigModule } from "./sdk-config.mjs";

// Helper: build an `exec` stub that records every invocation and returns
// pre-canned responses in order. Lets the tests assert both the resulting
// SDK config AND the exact CLI calls we made.
function makeExec(responses) {
  const calls = [];
  let i = 0;
  const exec = async (argv) => {
    calls.push(argv);
    if (i >= responses.length) {
      throw new Error("unexpected extra exec call: " + JSON.stringify(argv));
    }
    return responses[i++];
  };
  return { exec, calls };
}

const HAPPY_PAYLOAD = {
  status: "success",
  result: {
    projectId: "my-app-k3p9",
    appId: "1:1234567890:web:abcdef1234567890",
    apiKey: "AIzaSyD-FAKE-KEY-FOR-TESTS",
    authDomain: "my-app-k3p9.firebaseapp.com",
    storageBucket: "my-app-k3p9.appspot.com",
    messagingSenderId: "1234567890"
  }
};

test("fetchWebSdkConfig: success path returns the parsed config", async () => {
  const { exec, calls } = makeExec([
    { stdout: JSON.stringify(HAPPY_PAYLOAD), stderr: "", code: 0 }
  ]);

  const config = await fetchWebSdkConfig("my-app-k3p9", { exec });

  // The full config is returned with the canonical 6 keys.
  assert.equal(config.apiKey, "AIzaSyD-FAKE-KEY-FOR-TESTS");
  assert.equal(config.authDomain, "my-app-k3p9.firebaseapp.com");
  assert.equal(config.projectId, "my-app-k3p9");
  assert.equal(config.storageBucket, "my-app-k3p9.appspot.com");
  assert.equal(config.messagingSenderId, "1234567890");
  assert.equal(config.appId, "1:1234567890:web:abcdef1234567890");

  // Only one CLI call (apps:sdkconfig); no apps:create.
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    "firebase", "apps:sdkconfig", "WEB",
    "--project", "my-app-k3p9",
    "--json"
  ]);
});

test("fetchWebSdkConfig: retry-after-create when no web app exists", async () => {
  // First call: CLI fails with a "no web apps" stderr. We create one,
  // then retry, which succeeds.
  const { exec, calls } = makeExec([
    {
      stdout: "",
      stderr: "Error: No matching apps found for project my-app-k3p9. Run apps:create.",
      code: 1
    },
    { stdout: "App created.", stderr: "", code: 0 },
    { stdout: JSON.stringify(HAPPY_PAYLOAD), stderr: "", code: 0 }
  ]);

  const config = await fetchWebSdkConfig("my-app-k3p9", { exec });
  assert.equal(config.projectId, "my-app-k3p9");

  // Three calls in order: sdkconfig (fails) → apps:create → sdkconfig.
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], [
    "firebase", "apps:sdkconfig", "WEB",
    "--project", "my-app-k3p9", "--json"
  ]);
  assert.deepEqual(calls[1], [
    "firebase", "apps:create", "WEB", "my-app-k3p9-web",
    "--project", "my-app-k3p9"
  ]);
  assert.deepEqual(calls[2], [
    "firebase", "apps:sdkconfig", "WEB",
    "--project", "my-app-k3p9", "--json"
  ]);
});

test("fetchWebSdkConfig: surfaces FIREBASE_NOT_LOGGED_IN on auth errors", async () => {
  const { exec } = makeExec([
    {
      stdout: "",
      stderr: "Error: Not authenticated. Please run firebase login.",
      code: 1
    }
  ]);
  await assert.rejects(
    fetchWebSdkConfig("p1", { exec }),
    (err) => err.code === "FIREBASE_NOT_LOGGED_IN"
  );
});

test("fetchWebSdkConfig: surfaces PROJECT_NOT_FOUND on missing project", async () => {
  const { exec } = makeExec([
    {
      stdout: "",
      stderr: "Error: Project not found: bogus-project",
      code: 1
    }
  ]);
  await assert.rejects(
    fetchWebSdkConfig("bogus-project", { exec }),
    (err) => err.code === "PROJECT_NOT_FOUND"
  );
});

test("fetchWebSdkConfig: surfaces APP_CREATE_FAILED when apps:create fails", async () => {
  // sdkconfig fails with "no web apps", then apps:create itself fails.
  const { exec } = makeExec([
    { stdout: "", stderr: "No apps found.", code: 1 },
    { stdout: "", stderr: "Quota exceeded.", code: 1 }
  ]);
  await assert.rejects(
    fetchWebSdkConfig("p2", { exec }),
    (err) => err.code === "APP_CREATE_FAILED"
  );
});

test("fetchWebSdkConfig: surfaces SDKCONFIG_PARSE_FAILED on garbage output", async () => {
  const { exec } = makeExec([
    { stdout: "not-json", stderr: "", code: 0 }
  ]);
  await assert.rejects(
    fetchWebSdkConfig("p3", { exec }),
    (err) => err.code === "SDKCONFIG_PARSE_FAILED"
  );
});

test("fetchWebSdkConfig: handles older CLI shape (bare config, no `result` wrapper)", async () => {
  // Older CLI versions emit the config directly without { status, result }.
  const bare = HAPPY_PAYLOAD.result;
  const { exec } = makeExec([
    { stdout: JSON.stringify(bare), stderr: "", code: 0 }
  ]);
  const config = await fetchWebSdkConfig("p4", { exec });
  assert.equal(config.projectId, "my-app-k3p9");
});

test("renderFirebaseConfigModule produces a parseable JS module", () => {
  const config = {
    apiKey: "AIza-xyz",
    authDomain: "foo.firebaseapp.com",
    projectId: "foo",
    storageBucket: "foo.appspot.com",
    messagingSenderId: "1",
    appId: "1:1:web:x"
  };
  const out = renderFirebaseConfigModule(config);
  assert.match(out, /^\/\/ firebase-config\.js — generated by deploy-toolkit\./m);
  assert.match(out, /export const firebaseConfig = \{/);
  // The JSON inside should match exactly so re-runs are deterministic.
  assert.ok(out.includes('"projectId": "foo"'));
  assert.ok(out.includes('"apiKey": "AIza-xyz"'));
});
