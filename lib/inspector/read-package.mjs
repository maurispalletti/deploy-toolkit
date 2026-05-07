import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readPackageJson(appDir) {
  try {
    const raw = await readFile(join(appDir, "package.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
