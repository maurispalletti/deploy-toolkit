import { writeFile, unlink, readFile, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { execSync, execFileSync } from "node:child_process";
import { inspect } from "../../../lib/inspector/index.mjs";
import { plan } from "../../../lib/planner/index.mjs";
import { fetchWebSdkConfig } from "../../../lib/sdk-config.mjs";

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

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function isNextJsProject(appDir) {
  if (await fileExists(join(appDir, "next.config.js"))) return true;
  if (await fileExists(join(appDir, "next.config.mjs"))) return true;
  if (await fileExists(join(appDir, "next.config.ts"))) return true;
  try {
    const pkg = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
    return "next" in { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch { return false; }
}

async function envLocalHasFirebaseKey(appDir) {
  try {
    const content = await readFile(join(appDir, ".env.local"), "utf8");
    return /^NEXT_PUBLIC_FIREBASE_API_KEY=.+$/m.test(content);
  } catch { return false; }
}

async function tryWriteEnvLocal(appDir, projectId) {
  try {
    const cfg = await fetchWebSdkConfig(projectId);
    const lines = [
      `NEXT_PUBLIC_FIREBASE_API_KEY=${cfg.apiKey}`,
      `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${cfg.authDomain}`,
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${cfg.projectId}`,
      `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${cfg.storageBucket}`,
      `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${cfg.messagingSenderId}`,
      `NEXT_PUBLIC_FIREBASE_APP_ID=${cfg.appId}`,
    ].join("\n") + "\n";
    await writeFile(join(appDir, ".env.local"), lines);
  } catch {
    // Non-fatal — deploy-time restore-env stage will retry
  }
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

  app.get("/api/firebase-projects", async (_req, res) => {
    try {
      const raw = execFileSync("firebase", ["projects:list", "--json"], { encoding: "utf8", timeout: 15000 });
      const parsed = JSON.parse(raw);
      const ids = (parsed.result ?? []).map(p => p.projectId).filter(Boolean);
      res.json({ projectIds: ids });
    } catch {
      res.json({ projectIds: [] });
    }
  });

  app.get("/api/existing-config", async (req, res) => {
    const appDir = req.query.appDir;
    if (!appDir) return res.status(400).json({ error: "appDir required" });
    try {
      const raw = await readFile(`${appDir}/deploy-app.config.json`, "utf8");
      res.json({ existing: true, plan: JSON.parse(raw) });
    } catch {
      res.json({ existing: false });
    }
  });

  app.get("/api/resume-config", async (req, res) => {
    const appDir = req.query.appDir;
    if (!appDir) return res.status(400).json({ error: "appDir required" });
    try {
      let plan = null;
      try {
        const raw = await readFile(join(appDir, "deploy-app.config.json"), "utf8");
        plan = JSON.parse(raw);
      } catch {}

      // Resolve project ID: .firebaserc (most authoritative) → folder name.
      // We intentionally ignore deploy-app.config.json's projectId here because
      // the planner appends a random suffix (e.g. "my-app-a1b2") which is wrong
      // for the continue flow — the user's Firebase project is named after the folder.
      let firebaseProjectId = null;
      try {
        const rc = JSON.parse(await readFile(join(appDir, ".firebaserc"), "utf8"));
        firebaseProjectId = rc?.projects?.default ?? null;
      } catch {}
      if (!firebaseProjectId) firebaseProjectId = basename(appDir);

      // If the saved config has a different (stale/random) project ID, correct it.
      if (plan?.firebase?.projectId && plan.firebase.projectId !== firebaseProjectId) {
        plan.firebase.projectId = firebaseProjectId;
        try {
          await writeFile(join(appDir, "deploy-app.config.json"), JSON.stringify(plan, null, 2) + "\n");
        } catch {}
      }

      let firebaseJson = null;
      try {
        firebaseJson = JSON.parse(await readFile(join(appDir, "firebase.json"), "utf8"));
      } catch {}

      let githubRepoUrl = null;
      try {
        const remote = execSync("git remote get-url origin", { cwd: appDir, encoding: "utf8" }).trim();
        if (remote.startsWith("git@github.com:")) {
          githubRepoUrl = "https://github.com/" + remote.replace("git@github.com:", "").replace(/\.git$/, "");
        } else if (remote.startsWith("https://github.com/")) {
          githubRepoUrl = remote.replace(/\.git$/, "");
        } else {
          githubRepoUrl = remote;
        }
      } catch {}

      // For Next.js projects, fetch SDK config now so .env.local is ready before deploy.
      const resolvedProjectId = firebaseProjectId;
      if (await isNextJsProject(appDir) && !(await envLocalHasFirebaseKey(appDir))) {
        await tryWriteEnvLocal(appDir, resolvedProjectId);
      }

      res.json({ hasConfig: plan !== null, firebaseProjectId, githubRepoUrl, plan, firebaseJson });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/update-plan-features", async (req, res) => {
    const { appDir, addFirestore, addAuth } = req.body;
    if (!appDir) return res.status(400).json({ error: "appDir required" });
    try {
      const raw = await readFile(join(appDir, "deploy-app.config.json"), "utf8");
      const updatedPlan = JSON.parse(raw);
      if (addFirestore && !updatedPlan.firestore) {
        updatedPlan.firestore = { rulesFile: "firestore.rules" };
      }
      if (addAuth && !updatedPlan.auth) {
        updatedPlan.auth = { providers: ["google"], scaffoldMode: "auto" };
      }
      await writeFile(join(appDir, "deploy-app.config.json"), JSON.stringify(updatedPlan, null, 2));
      res.json({ plan: updatedPlan });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
