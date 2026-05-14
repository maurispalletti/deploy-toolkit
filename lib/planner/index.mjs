function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 25);
}

function shortSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

// Build the plan.secrets payload from the user's per-key classification.
// We accept either:
//   answers.secrets = { perKey: [{name, classification, value}] }
// or:
//   answers.secrets = null / undefined (user skipped the classify page).
//
// Output shape on the plan:
//   plan.secrets = { perKey: [...] }  // normalized form so downstream
//                                     // stages have a predictable shape.
function buildSecretsPayload(answers) {
  const perKey = answers?.secrets?.perKey;
  if (!Array.isArray(perKey) || perKey.length === 0) return null;
  return {
    perKey: perKey.map(k => ({
      name: k.name,
      classification: k.classification,
      // We pass through whatever value the user typed (may be ""); the
      // inject-secrets stage decides what to do with empty values.
      value: typeof k.value === "string" ? k.value : ""
    }))
  };
}

export function plan(inspection, answers) {
  const projectId = `${slugify(answers.appName)}-${shortSuffix()}`;

  const hosting = {
    publicDir: inspection.outputDir ?? "dist",
    rewrites: answers.shape === "C"
      ? [{ source: "/api/**", function: "api" }]
      : []
  };

  // A1: plan.auth carries the user's scaffold-mode choice so the
  // inject-auth stage knows whether to auto-inject the component +
  // splice into App.jsx, or only write firebase-config.js and let the
  // user/AI wire the rest from REFACTOR-FOR-AUTH.md. Default to "auto"
  // when needsAuth is true but the wizard didn't capture a choice
  // (e.g. CLI mode, where there's no choice page).
  const auth = answers.needsAuth
    ? {
        providers: ["google"],
        scaffoldMode: answers.authChoice === "prompt" ? "prompt" : "auto"
      }
    : null;
  const firestore = answers.needsDb ? { rulesFile: "firestore.rules" } : null;

  const secrets = buildSecretsPayload(answers);

  // Cloud Functions `secrets` list = server-only keys (so the functions
  // runtime is granted access to them at deploy time). If the user
  // didn't run the classify page, fall back to the legacy
  // `answers.secretKeys` list (whole envKeys union — pre-C6 behavior).
  const serverOnlyKeys = secrets
    ? secrets.perKey.filter(k => k.classification === "server-only").map(k => k.name)
    : (answers.secretKeys ?? []);

  const functions = answers.shape === "C"
    ? { dir: "functions", region: "europe-west3", secrets: serverOnlyKeys }
    : null;

  return {
    appName: answers.appName,
    shape: answers.shape,
    firebase: { projectId },
    hosting,
    auth,
    firestore,
    functions,
    secrets,
    build: {
      command: inspection.framework === "none" ? null : "npm run build",
      outputDir: inspection.outputDir
    }
  };
}
