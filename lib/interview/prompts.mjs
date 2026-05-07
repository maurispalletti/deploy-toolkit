// lib/interview/prompts.mjs
import { createInterface } from "node:readline";

function ask(question, { input = process.stdin, output = process.stdout } = {}) {
  const rl = createInterface({ input, output });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function askText(label, def, opts) {
  const suffix = def ? ` [${def}]` : "";
  const raw = await ask(`${label}${suffix}: `, opts);
  const trimmed = raw.trim();
  return trimmed === "" ? def : trimmed;
}

export async function askYesNo(label, def, opts) {
  const hint = def ? "Y/n" : "y/N";
  const raw = (await ask(`${label} (${hint}) `, opts)).trim().toLowerCase();
  if (raw === "") return def;
  return ["y", "yes", "true", "1"].includes(raw);
}
