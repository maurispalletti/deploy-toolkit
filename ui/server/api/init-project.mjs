import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TOOLKIT_DIR = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

function sseEvent(stream, event, data) {
  stream.write(`event: ${event}\n`);
  stream.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function mountInitProject(app) {
  app.get("/api/init-project", async (req, res) => {
    const { parentDir, projectName } = req.query;
    if (!parentDir || !projectName) {
      return res.status(400).json({ error: "parentDir and projectName are required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const script = join(TOOLKIT_DIR, "stages/init-project.sh");
    const proc = spawn("bash", [script, parentDir, projectName], { cwd: TOOLKIT_DIR });
    let buf = "";

    function handleChunk(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.startsWith("DEPLOY_TOOLKIT_SCRATCH_DONE:")) {
          const parts = line.slice("DEPLOY_TOOLKIT_SCRATCH_DONE:".length).split("\t");
          sseEvent(res, "scratch-done", {
            projectName: parts[0] || projectName,
            appDir: parts[1] || "",
            repoUrl: parts[2] || "",
          });
          continue;
        }
        if (line.includes("DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP")) {
          sseEvent(res, "error", { code: "NEEDS_BOOTSTRAP", message: "Firebase TOS bootstrap required" });
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
