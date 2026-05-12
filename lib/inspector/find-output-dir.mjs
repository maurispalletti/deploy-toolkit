import { stat } from "node:fs/promises";
import { join } from "node:path";

// Frameworks with a conventional build output directory. We return this name
// even when the directory doesn't exist yet, because the Build stage runs
// `npm run build` and creates it. Checking for existence would falsely report
// "won't build" on a fresh checkout that hasn't been built.
const CONVENTIONAL_OUTPUT_BY_FRAMEWORK = {
  "vite-react": "dist",
  "cra": "build",
  "nextjs": "out", // static export — adequate default for non-SSR Next apps
};

// For "unknown" we probe these in order — find what the user has on disk.
const UNKNOWN_FALLBACKS = ["dist", "build", "out", "public"];

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export async function findOutputDir(appDir, framework) {
  if (framework === "none") return ".";
  if (framework === "express") return null; // no static output

  const known = CONVENTIONAL_OUTPUT_BY_FRAMEWORK[framework];
  if (known) return known;

  // Unknown framework — probe common dirs for an already-built bundle.
  for (const c of UNKNOWN_FALLBACKS) {
    if (await exists(join(appDir, c))) return c;
  }
  return null;
}
