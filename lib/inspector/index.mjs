import { readPackageJson } from "./read-package.mjs";
import { detectFramework } from "./detect-framework.mjs";
import { findOutputDir } from "./find-output-dir.mjs";
import { hasBackend } from "./has-backend.mjs";
import { readEnvExample } from "./read-env-example.mjs";

export async function inspect(appDir) {
  const pkg = await readPackageJson(appDir);
  const framework = detectFramework(pkg);
  const outputDir = await findOutputDir(appDir, framework);
  const backend = await hasBackend(appDir, framework);
  const envKeys = await readEnvExample(appDir);

  let suggestedShape;
  if (backend) suggestedShape = "C";
  else if (framework === "none") suggestedShape = "A";
  else suggestedShape = "A_or_B";

  return {
    appDir,
    framework,
    outputDir,
    hasBackend: backend,
    envKeys,
    suggestedShape,
    pkgName: pkg?.name ?? null
  };
}
