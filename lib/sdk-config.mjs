// SDK-config helper.
//
// Fetches the Firebase Web SDK config for a given project ID. This is
// the JSON payload the Firebase console hands you under "Add Firebase
// to your web app" — the same {apiKey, authDomain, projectId, …}
// object that's required for `initializeApp()` in any browser-side
// Firebase code.
//
// The Firebase CLI exposes this via `firebase apps:sdkconfig WEB`.
// If the project has no web app registered yet, that command fails;
// we detect the "no web apps" case and create one with
// `firebase apps:create WEB <name>` first, then retry.
//
// Why this lives outside `stages/`: it's pure JS, easier to unit-test,
// and we want both the inject-auth stage AND the refactor-prompt
// generator (the path-2 prompt) to share the same code so that the
// SDK config the prompt mentions matches what would actually be
// written on the auto-inject path.
//
// Public API:
//
//   fetchWebSdkConfig(projectId, opts?) → Promise<{
//     apiKey, authDomain, projectId, storageBucket,
//     messagingSenderId, appId
//   }>
//
//   opts.exec — for testing: a function that mimics `child_process.spawn`'s
//     "run-to-completion" semantics, returning { stdout, stderr, code }.
//     Production callers leave this unset; we default to running the real
//     `firebase` CLI via child_process.
//
//   opts.appNameHint — what to call the new Web App if we have to create
//     one. Defaults to `<projectId>-web`. Falls back to the CLI's
//     auto-generated name when the hint is rejected.
//
// Errors:
//   - Throws a tagged Error with `code` set to one of:
//     "FIREBASE_NOT_INSTALLED" — `firebase` binary not on PATH
//     "FIREBASE_NOT_LOGGED_IN" — CLI returned an auth-related error
//     "PROJECT_NOT_FOUND" — CLI says the project doesn't exist
//     "SDKCONFIG_FAILED" — anything else from `apps:sdkconfig`
//     "APP_CREATE_FAILED" — we tried to create a web app and that failed
//     "SDKCONFIG_PARSE_FAILED" — output isn't valid JSON / missing fields

import { spawn } from "node:child_process";

const REQUIRED_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];

// Default exec — runs the real `firebase` CLI and returns
// { stdout, stderr, code } once the process exits.
function defaultExec(argv) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn(argv[0], argv.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(err);
      return;
    }
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => { stdout += d.toString(); });
    proc.stderr.on("data", d => { stderr += d.toString(); });
    proc.on("error", err => {
      if (err.code === "ENOENT") {
        const e = new Error("Firebase CLI not found on PATH");
        e.code = "FIREBASE_NOT_INSTALLED";
        reject(e);
      } else {
        reject(err);
      }
    });
    proc.on("close", code => resolve({ stdout, stderr, code }));
  });
}

function looksLikeNoWebAppsError(streams) {
  // Firebase CLI phrasing varies between versions, AND --json mode emits
  // errors as JSON on stdout (not stderr). We concatenate both streams
  // and substring-match against the union.
  //   - "No matching apps"
  //   - "No apps found"
  //   - "no web app" / "no web apps" (the modern CLI says this)
  //   - "no WEB apps associated" (also modern CLI in --json mode)
  //   - "Need to register"
  const s = (streams.stderr + "\n" + streams.stdout).toLowerCase();
  return (
    s.includes("no matching apps") ||
    s.includes("no apps found") ||
    s.includes("no web app") ||
    s.includes("no web apps") ||
    s.includes("need to register")
  );
}

function looksLikeAuthError(streams) {
  const s = (streams.stderr + "\n" + streams.stdout).toLowerCase();
  return (
    s.includes("not authenticated") ||
    s.includes("please run firebase login") ||
    s.includes("not logged in") ||
    s.includes("re-authenticate")
  );
}

function looksLikeProjectMissing(streams) {
  const s = (streams.stderr + "\n" + streams.stdout).toLowerCase();
  return (
    s.includes("project not found") ||
    s.includes("does not exist") ||
    s.includes("permission denied")
  );
}

function parseSdkConfig(stdout) {
  // The CLI's `--json` output is a wrapper around the actual config:
  //   { "status": "success", "result": { ... sdk config ... } }
  // In older versions it can also just emit the bare config. Handle both.
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const e = new Error("Failed to parse Firebase CLI sdkconfig JSON");
    e.code = "SDKCONFIG_PARSE_FAILED";
    throw e;
  }
  const config = parsed && parsed.result ? parsed.result : parsed;
  if (!config || typeof config !== "object") {
    const e = new Error("Firebase CLI sdkconfig returned no payload");
    e.code = "SDKCONFIG_PARSE_FAILED";
    throw e;
  }
  // Some CLI versions wrap the config inside a `sdkConfig` field too.
  const inner = config.sdkConfig && typeof config.sdkConfig === "object"
    ? config.sdkConfig
    : config;
  for (const k of REQUIRED_KEYS) {
    if (typeof inner[k] !== "string" || inner[k].length === 0) {
      const e = new Error(`Firebase CLI sdkconfig missing required field: ${k}`);
      e.code = "SDKCONFIG_PARSE_FAILED";
      throw e;
    }
  }
  // Return just the known-good keys (drop anything else the CLI sneaks in).
  const out = {};
  for (const k of REQUIRED_KEYS) out[k] = inner[k];
  return out;
}

export async function fetchWebSdkConfig(projectId, opts = {}) {
  if (!projectId || typeof projectId !== "string") {
    throw new Error("fetchWebSdkConfig: projectId is required");
  }
  const exec = opts.exec ?? defaultExec;
  const appNameHint = opts.appNameHint ?? `${projectId}-web`;

  async function runSdkConfig() {
    return exec([
      "firebase", "apps:sdkconfig", "WEB",
      "--project", projectId,
      "--json"
    ]);
  }

  let result = await runSdkConfig();
  if (result.code === 0) return parseSdkConfig(result.stdout);

  // First failure — figure out why and decide whether to retry.
  // We pass both streams because firebase --json mode emits errors as
  // JSON on stdout, not stderr.
  if (looksLikeAuthError(result)) {
    const e = new Error("Firebase CLI is not authenticated; run `firebase login`.");
    e.code = "FIREBASE_NOT_LOGGED_IN";
    throw e;
  }
  if (looksLikeProjectMissing(result)) {
    const e = new Error(`Firebase project not found: ${projectId}`);
    e.code = "PROJECT_NOT_FOUND";
    throw e;
  }
  if (looksLikeNoWebAppsError(result)) {
    // No Web App yet — try to create one, then retry sdkconfig.
    const create = await exec([
      "firebase", "apps:create", "WEB", appNameHint,
      "--project", projectId
    ]);
    if (create.code !== 0) {
      const e = new Error(
        `Failed to create Firebase Web App for project ${projectId}: ${create.stderr || create.stdout}`
      );
      e.code = "APP_CREATE_FAILED";
      throw e;
    }
    result = await runSdkConfig();
    if (result.code === 0) return parseSdkConfig(result.stdout);
  }

  const e = new Error(
    `firebase apps:sdkconfig failed (exit ${result.code}): ${result.stderr || result.stdout}`
  );
  e.code = "SDKCONFIG_FAILED";
  throw e;
}

// Render the SDK config as a JS module string. Vite-React imports this
// file via `import { firebaseConfig } from "./firebase-config.js";`.
// Centralised here so the inject-auth stage and any other writer agree
// on the exact rendered form (and a comment that explains why the
// file is checked-in-as-generated rather than typed by hand).
export function renderFirebaseConfigModule(sdkConfig, { projectId } = {}) {
  const pid = projectId ?? sdkConfig?.projectId ?? "(unknown)";
  const lines = [
    "// firebase-config.js — generated by deploy-toolkit.",
    "//",
    "// This file holds the Firebase Web SDK config for project: " + pid,
    "// These values are SAFE to commit and ship to the browser — Firebase",
    "// Web SDK config keys are public by design. Security on Firestore /",
    "// Storage / Auth is enforced via rules + sign-in, not via the apiKey.",
    "//",
    "// Re-running the deploy-toolkit wizard will overwrite this file with",
    "// the latest config for the same project.",
    "",
    "export const firebaseConfig = " + JSON.stringify(sdkConfig, null, 2) + ";",
    ""
  ];
  return lines.join("\n");
}
