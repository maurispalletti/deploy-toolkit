// Refactor-prompt endpoints.
//
// When the wizard hits a block page (today: incompatible local DB OR
// hardcoded secrets), the user can click "Generate refactor prompt" to
// drop a markdown file into their app folder. They paste the file into
// Claude Code (or any AI coding tool); the AI applies the refactor; the
// user re-runs `./deploy-app`.
//
// POST /api/refactor-prompt/db
//   body: { appDir, inspection }
//   writes: <appDir>/REFACTOR-FOR-FIREBASE.md (for reference)
//   returns: { path, content }
//
// POST /api/refactor-prompt/secrets
//   body: { appDir, inspection }
//   writes: <appDir>/REFACTOR-SECRETS.md (for reference)
//   returns: { path, content }
//
// POST /api/refactor-prompt/auth
//   body: { appDir, projectId, framework, sdkConfig?, scaffoldedConfigPath? }
//   writes: <appDir>/REFACTOR-FOR-AUTH.md (for reference)
//   returns: { path, content }
//
// Both endpoints return the full markdown so the wizard can display it
// inline for one-click copy/paste into the user's AI tool. Writing the
// file is still useful for users who want to commit it or share it
// with a teammate.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  generateDbRefactorPrompt,
  generateSecretsRefactorPrompt,
  generateAuthRefactorPrompt
} from "../../../lib/refactor-prompts/template.mjs";

export async function writeDbRefactorPrompt(appDir, inspection) {
  if (!appDir) throw new Error("appDir is required");
  if (!inspection) throw new Error("inspection is required");
  const details = inspection.dbIncompatDetails ?? {};
  const md = generateDbRefactorPrompt({
    appName: inspection.pkgName ?? "your-app",
    framework: inspection.framework,
    drivers: details.drivers ?? [],
    evidence: details.evidence ?? []
  });
  const outPath = join(appDir, "REFACTOR-FOR-FIREBASE.md");
  await writeFile(outPath, md);
  return { path: outPath, content: md };
}

export async function writeSecretsRefactorPrompt(appDir, inspection) {
  if (!appDir) throw new Error("appDir is required");
  if (!inspection) throw new Error("inspection is required");
  const secrets = inspection.secrets ?? {};
  const md = generateSecretsRefactorPrompt({
    appName: inspection.pkgName ?? "your-app",
    framework: inspection.framework,
    hardcoded: secrets.hardcoded ?? [],
    envRefs: secrets.envRefs ?? []
  });
  const outPath = join(appDir, "REFACTOR-SECRETS.md");
  await writeFile(outPath, md);
  return { path: outPath, content: md };
}

export function mountRefactor(app) {
  app.post("/api/refactor-prompt/db", async (req, res) => {
    try {
      const { appDir, inspection } = req.body ?? {};
      const result = await writeDbRefactorPrompt(appDir, inspection);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/refactor-prompt/secrets", async (req, res) => {
    try {
      const { appDir, inspection } = req.body ?? {};
      const result = await writeSecretsRefactorPrompt(appDir, inspection);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/refactor-prompt/auth", async (req, res) => {
    try {
      const { appDir, ...opts } = req.body ?? {};
      const result = await writeAuthRefactorPrompt(appDir, opts);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}


// A1: writes REFACTOR-FOR-AUTH.md when the user picks the "give me a
// prompt for my AI tool" path on the AuthScaffoldChoice page. Unlike
// the DB and secrets endpoints, this one doesn't take an `inspection`
// payload — instead the wizard hands us the framework + projectId so
// the prompt can name the right paths without re-running the
// inspector.
export async function writeAuthRefactorPrompt(appDir, opts = {}) {
  if (!appDir) throw new Error("appDir is required");
  const {
    appName = "your-app",
    framework = "unknown",
    projectId = "",
    sdkConfig = null,
    scaffoldedConfigPath = null
  } = opts;
  const md = generateAuthRefactorPrompt({
    appName,
    framework,
    projectId,
    sdkConfig,
    scaffoldedConfigPath
  });
  const outPath = join(appDir, "REFACTOR-FOR-AUTH.md");
  await writeFile(outPath, md);
  return { path: outPath, content: md };
}
