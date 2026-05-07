import { stat } from "node:fs/promises";
import { join } from "node:path";

const BACKEND_FRAMEWORKS = new Set(["express"]);
const BACKEND_DIR_HINTS = ["functions", "api", "server"];

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export async function hasBackend(appDir, framework) {
  if (BACKEND_FRAMEWORKS.has(framework)) return true;
  for (const dir of BACKEND_DIR_HINTS) {
    if (await exists(join(appDir, dir))) return true;
  }
  if (await exists(join(appDir, "server.js"))) return true;
  return false;
}
