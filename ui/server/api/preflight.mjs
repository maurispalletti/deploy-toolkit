import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function which(cmd) {
  try { await exec("which", [cmd]); return true; } catch { return false; }
}

async function nodeStatus() {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  return { version: process.versions.node, major, ok: major >= 22 };
}

async function firebaseStatus() {
  const installed = await which("firebase");
  return { installed, ok: installed };
}

async function loginStatus() {
  // Strategy: just grep for the first email-shaped token in `firebase login:list`
  // stdout. This is robust across older "User: <email>" format and newer
  // table-rendered output. If no email is present we treat it as logged out.
  try {
    const { stdout } = await exec("firebase", ["login:list"]);
    const match = stdout.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (match) return { ok: true, email: match[0] };
    return { ok: false, email: null };
  } catch {
    return { ok: false, email: null };
  }
}

export async function collectPreflight() {
  const [node, firebaseCli, login] = await Promise.all([
    nodeStatus(), firebaseStatus(), loginStatus()
  ]);
  return { node, firebaseCli, login };
}

export function mountPreflight(app) {
  app.get("/api/preflight", async (_req, res) => {
    try { res.json(await collectPreflight()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
}
