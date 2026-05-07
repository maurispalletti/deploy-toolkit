import { stat } from "node:fs/promises";
import { join } from "node:path";

const CANDIDATES_BY_FRAMEWORK = {
  "vite-react": ["dist"],
  "cra": ["build"],
  "nextjs": ["out", ".next"],
  "express": [],
  "unknown": ["dist", "build", "out", "public"],
  "none": ["."]
};

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export async function findOutputDir(appDir, framework) {
  const candidates = CANDIDATES_BY_FRAMEWORK[framework] ?? [];
  for (const c of candidates) {
    if (c === "." || await exists(join(appDir, c))) return c;
  }
  return null;
}
