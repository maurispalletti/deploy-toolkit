import { execFile, spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const TOOLKIT_DIR = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const SETUP_SCRIPT = join(TOOLKIT_DIR, "stages/setup-dev-tools.sh");

let setupInFlight = false;

const TOOL_PATHS = {
  brew: ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"],
  git: ["/opt/homebrew/bin/git", "/usr/local/bin/git", "/usr/bin/git"],
  gh: ["/opt/homebrew/bin/gh", "/usr/local/bin/gh"],
  firebase: [],
};

async function pathExists(p) {
  try {
    await exec("test", ["-x", p]);
    return true;
  } catch {
    return false;
  }
}

async function isInstalled(cmd) {
  try {
    await exec("which", [cmd]);
    return true;
  } catch {
    for (const p of TOOL_PATHS[cmd] ?? []) {
      if (await pathExists(p)) return true;
    }
    return false;
  }
}

async function nodeStatus() {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  return { version: process.versions.node, major, ok: major >= 22 };
}

async function toolStatus(cmd, { required = true } = {}) {
  const installed = await isInstalled(cmd);
  return { installed, ok: !required || installed, required };
}

async function firebaseStatus() {
  const installed = await isInstalled("firebase");
  return { installed, ok: installed };
}

async function brewStatus() {
  const isDarwin = process.platform === "darwin";
  const installed = await isInstalled("brew");
  return { installed, ok: !isDarwin || installed, required: isDarwin };
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
  const [brew, git, gh, node, firebaseCli, login] = await Promise.all([
    brewStatus(),
    toolStatus("git"),
    toolStatus("gh"),
    nodeStatus(),
    firebaseStatus(),
    loginStatus(),
  ]);
  return { brew, git, gh, node, firebaseCli, login };
}

function devToolsSatisfied({ brew, git, gh }) {
  const isDarwin = process.platform === "darwin";
  if (isDarwin && !brew.ok) return false;
  if (!git.ok) return false;
  if (!gh.ok) return false;
  return true;
}

export function mountPreflight(app) {
  app.get("/api/preflight", async (_req, res) => {
    try { res.json(await collectPreflight()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/setup-dev-tools", async (_req, res) => {
    const preflight = await collectPreflight();
    if (devToolsSatisfied(preflight)) {
      return res.json({ started: false, reason: "already-installed" });
    }
    if (setupInFlight) {
      return res.json({ started: false, reason: "already-in-progress" });
    }
    setupInFlight = true;

    console.log("\n▸ Starting dev-tools setup (Homebrew → Git → GitHub CLI)... watch your terminal.");
    const proc = spawn("bash", [SETUP_SCRIPT], { cwd: TOOLKIT_DIR, stdio: "inherit" });
    proc.on("exit", (code) => {
      console.log(`▸ setup-dev-tools exited with code ${code}`);
      setupInFlight = false;
    });
    proc.on("error", () => { setupInFlight = false; });

    res.json({ started: true });
  });
}
