import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readEnvExample(appDir) {
  let raw;
  try {
    raw = await readFile(join(appDir, ".env.example"), "utf8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => line.split("=")[0].trim())
    .filter(Boolean);
}
