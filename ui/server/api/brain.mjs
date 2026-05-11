import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { inspect } from "../../../lib/inspector/index.mjs";
import { plan } from "../../../lib/planner/index.mjs";

export async function inspectApp(appDir) {
  return inspect(appDir);
}

export async function planApp(appDir, answers) {
  const inspection = await inspect(appDir);
  const result = plan(inspection, answers);
  await writeFile(join(appDir, "deploy-app.config.json"), JSON.stringify(result, null, 2));
  return result;
}

export async function clearConfig(appDir) {
  try { await unlink(join(appDir, "deploy-app.config.json")); } catch {}
}

export function mountBrain(app) {
  app.post("/api/inspect", async (req, res) => {
    try { res.json(await inspectApp(req.body.appDir)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/plan", async (req, res) => {
    try { res.json(await planApp(req.body.appDir, req.body.answers)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
}
