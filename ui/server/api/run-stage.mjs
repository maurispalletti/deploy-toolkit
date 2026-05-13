import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TOOLKIT_DIR = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const STAGES = {
  preflight: "stages/preflight.sh",
  provision: "stages/provision.sh",
  "inject-secrets": "stages/inject-secrets.sh",
  build: "stages/build.sh",
  deploy: "stages/deploy.sh",
  report: "stages/report.sh",
};

function sseEvent(stream, event, data) {
  stream.write(`event: ${event}\n`);
  stream.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function runStage(stageName, appDir, stream) {
  const rel = STAGES[stageName];
  if (!rel) throw new Error(`Unknown stage: ${stageName}`);
  const script = join(TOOLKIT_DIR, rel);

  return new Promise((resolve, reject) => {
    const proc = spawn("bash", [script, appDir], { cwd: TOOLKIT_DIR });
    let buf = "";

    function handleChunk(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.includes("DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP")) {
          sseEvent(stream, "error", { code: "NEEDS_BOOTSTRAP", message: "Firebase TOS bootstrap required" });
          continue;
        }
        sseEvent(stream, "log", { line });
      }
    }

    proc.stdout.on("data", d => handleChunk(d.toString()));
    proc.stderr.on("data", d => handleChunk(d.toString()));

    proc.on("close", code => {
      if (buf) sseEvent(stream, "log", { line: buf });
      sseEvent(stream, "done", { exitCode: code });
      stream.end();
      code === 0 ? resolve(code) : resolve(code); // resolve even on non-zero so frontend handles it
    });
    proc.on("error", reject);
  });
}

export function mountRunStage(app) {
  app.get("/api/run-stage/:stage", async (req, res) => {
    const { stage } = req.params;
    const appDir = req.query.appDir;
    if (!appDir) return res.status(400).json({ error: "appDir is required" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      await runStage(stage, appDir, res);
    } catch (err) {
      sseEvent(res, "error", { message: err.message });
      res.end();
    }
  });
}
