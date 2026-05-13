// Refactor-prompt endpoints.
//
// When the wizard hits a block page (today: incompatible local DB; later: C6
// hardcoded secrets), the user can click "Generate refactor prompt" to drop a
// markdown file into their app folder. They paste the file into Claude Code
// (or any AI coding tool); the AI applies the refactor; the user re-runs
// `./deploy-app`.
//
// POST /api/refactor-prompt/db
//   body: { appDir, inspection }
//   writes: <appDir>/REFACTOR-FOR-FIREBASE.md (for reference)
//   returns: { path, content } — content is the full markdown so the
//     wizard can display it inline for one-click copy/paste into the
//     user's AI tool. Writing the file is still useful for users who
//     want to commit it or share it with a teammate.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateDbRefactorPrompt } from "../../../lib/refactor-prompts/template.mjs";

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
}
