import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { findFreePort } from "./server/port.mjs";
import { mountPreflight } from "./server/api/preflight.mjs";
import { mountBrain } from "./server/api/brain.mjs";
import { mountRunStage } from "./server/api/run-stage.mjs";
import { mountAuth } from "./server/api/auth.mjs";
import { mountPicker } from "./server/api/picker.mjs";
import { mountRefactor } from "./server/api/refactor.mjs";
import { mountInitProject } from "./server/api/init-project.mjs";
import { mountInitGithub } from "./server/api/init-github.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// APP_DIR may be empty — the wizard's Welcome page lets the user pick a folder
// via the native macOS dialog when no path was passed on the command line.
const APP_DIR = process.argv[2] || "";

async function main() {
  const app = express();
  app.use(express.json());
  const serverRef = { current: null };
  mountPreflight(app);
  mountBrain(app);
  mountRunStage(app);
  mountAuth(app, serverRef);
  mountPicker(app);
  mountRefactor(app);
  mountInitProject(app);
  mountInitGithub(app);
  app.use(express.static(join(__dirname, "dist")));

  app.get("/api/app-dir", (_req, res) => res.json({ appDir: APP_DIR }));

  // Catch-all for SPA routing
  app.get("*", (_req, res) => res.sendFile(join(__dirname, "dist", "index.html")));

  const port = await findFreePort();
  serverRef.current = app.listen(port, () => {
    const url = `http://localhost:${port}/`;
    console.log(`▸ deploy-toolkit UI: ${url}`);
    spawn("open", [url]).on("error", () => {
      console.log(`(Open ${url} manually if your browser didn't.)`);
    });
  });
}

main().catch(err => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
