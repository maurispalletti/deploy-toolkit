import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";

const exec = promisify(execFile);

/**
 * Opens the native macOS folder picker via osascript.
 * Returns { path } on selection or { cancelled: true } if the user dismisses.
 * On non-macOS platforms returns { error } so the frontend can fall back to text input.
 */
async function pickFolder() {
  if (platform() !== "darwin") {
    return { error: `Native folder picker not supported on ${platform()}. Pass the path on the command line instead.` };
  }
  try {
    const { stdout } = await exec("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Pick the folder of the app you want to deploy")',
    ]);
    return { path: stdout.trim().replace(/\/$/, "") };
  } catch (err) {
    // osascript exits non-zero if the user cancels.
    if (/User cancel/i.test(err.stderr || "")) return { cancelled: true };
    return { error: err.message };
  }
}

export function mountPicker(app) {
  app.post("/api/pick-folder", async (_req, res) => {
    try {
      res.json(await pickFolder());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
