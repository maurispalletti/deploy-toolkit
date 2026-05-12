import { stat } from "node:fs/promises";
import { join } from "node:path";
import { readPackageJson } from "./read-package.mjs";
import { detectFramework } from "./detect-framework.mjs";
import { findOutputDir } from "./find-output-dir.mjs";
import { hasBackend } from "./has-backend.mjs";
import { readEnvExample } from "./read-env-example.mjs";
import { detectDbUsage } from "./detect-db-usage.mjs";

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

// Detect a Firebase-conventional Shape C layout:
//   <appDir>/functions/package.json declaring firebase-functions as a dep.
// When present, the user has already brought their own Cloud Functions
// scaffold; we treat it as a first-class Shape C project regardless of
// what the root package.json looks like.
async function hasFirebaseFunctionsDir(appDir) {
  const fnPkg = await readPackageJson(join(appDir, "functions"));
  if (!fnPkg) return false;
  const deps = { ...(fnPkg.dependencies ?? {}), ...(fnPkg.devDependencies ?? {}) };
  return Boolean(deps["firebase-functions"]);
}

export async function inspect(appDir) {
  const pkg = await readPackageJson(appDir);
  const framework = detectFramework(pkg);
  let outputDir = await findOutputDir(appDir, framework);
  let backend = await hasBackend(appDir, framework);
  const envKeys = await readEnvExample(appDir);

  // Firebase-conventional Shape C override: if the app ships a functions/
  // subdirectory whose package.json declares firebase-functions, treat
  // the app as Shape C even when the root package.json doesn't look like
  // a backend (e.g. it's just a wrapper with a public/ frontend).
  const fbFunctions = await hasFirebaseFunctionsDir(appDir);
  if (fbFunctions) {
    backend = true;
    // If a public/ frontend lives at the app root, that is the hosting
    // source — Firebase hosts it directly without a build step. This
    // wins over any framework-conventional outputDir (e.g. "dist")
    // because the user has explicitly opted into the Firebase layout.
    if (await exists(join(appDir, "public"))) {
      outputDir = "public";
    }
  }

  let suggestedShape;
  if (backend) suggestedShape = "C";
  else if (framework === "none") suggestedShape = "A";
  else suggestedShape = "A_or_B";

  // Scan for databases / persistence patterns Firebase can't run.
  // The detector is cheap (pure source scan, bounded by MAX_FILES/MAX_BYTES)
  // and returns a stable shape regardless of result. The wizard uses
  // `dbIncompat` to decide whether to surface the block page.
  const db = await detectDbUsage(appDir);

  return {
    appDir,
    framework,
    outputDir,
    hasBackend: backend,
    envKeys,
    suggestedShape,
    pkgName: pkg?.name ?? null,
    dbIncompat: db.incompatible,
    dbIncompatDetails: {
      drivers: db.drivers,
      evidence: db.evidence
    }
  };
}
