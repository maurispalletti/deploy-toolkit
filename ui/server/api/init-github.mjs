import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TOOLKIT_DIR = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

function sseEvent(stream, event, data) {
  stream.write(`event: ${event}\n`);
  stream.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function mountInitGithub(app) {
  app.get("/api/init-github", async (req, res) => {
    const { appDir, projectName } = req.query;
    if (!appDir || !projectName) {
      return res.status(400).json({ error: "appDir and projectName are required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // init-github.sh was repurposed to run the Firebase project creation step
    const script = join(TOOLKIT_DIR, "stages/init-github.sh");
    const proc = spawn("bash", [script, appDir, projectName], { cwd: TOOLKIT_DIR });
    let buf = "";

    function handleChunk(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.startsWith("DEPLOY_TOOLKIT_FIREBASE_DONE:")) {
          sseEvent(res, "firebase-done", { appDir: line.slice("DEPLOY_TOOLKIT_FIREBASE_DONE:".length) || appDir });
          continue;
        }
        if (line.includes("DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP")) {
          sseEvent(res, "error", { code: "NEEDS_BOOTSTRAP", message: "Firebase TOS bootstrap required" });
          continue;
        }
        if (line.startsWith("DEPLOY_TOOLKIT_ERROR:")) {
          const rest = line.slice("DEPLOY_TOOLKIT_ERROR:".length);
          const sep = rest.indexOf(":");
          const code = sep >= 0 ? rest.slice(0, sep) : rest;
          const message = sep >= 0 ? rest.slice(sep + 1) : "An unexpected error occurred";
          sseEvent(res, "error", { code, message });
          continue;
        }
        sseEvent(res, "log", { line });
      }
    }

    proc.stdout.on("data", d => handleChunk(d.toString()));
    proc.stderr.on("data", d => handleChunk(d.toString()));
    proc.on("close", code => {
      if (buf) sseEvent(res, "log", { line: buf });
      sseEvent(res, "done", { exitCode: code });
      res.end();
    });
    proc.on("error", err => {
      sseEvent(res, "error", { message: err.message });
      res.end();
    });
  });
}
