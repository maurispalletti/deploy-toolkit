import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspect } from "./inspector/index.mjs";
import { interview } from "./interview/index.mjs";
import { plan } from "./planner/index.mjs";

export async function runBrain(appDir, opts = { interactive: true }) {
  const configPath = join(appDir, "deploy-app.config.json");

  try {
    const existing = JSON.parse(await readFile(configPath, "utf8"));
    return existing;
  } catch { /* no existing config */ }

  const inspection = await inspect(appDir);

  let answers;
  if (opts.interactive) {
    answers = await interview(inspection);
  } else {
    answers = {
      appName: inspection.pkgName ?? "app",
      needsAuth: false,
      needsDb: false,
      shape: inspection.suggestedShape === "A_or_B" ? "A" : inspection.suggestedShape,
      acceptedBlaze: false,
      secretKeys: inspection.envKeys
    };
  }

  const config = plan(inspection, answers);
  await writeFile(configPath, JSON.stringify(config, null, 2));
  return config;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const appDir = process.argv[2] ?? ".";
  runBrain(appDir).then(c => {
    process.stderr.write(`✓ Config saved to ${join(appDir, "deploy-app.config.json")}\n`);
  });
}
