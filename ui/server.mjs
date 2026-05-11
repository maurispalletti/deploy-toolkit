import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { findFreePort } from "./server/port.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = process.argv[2] || process.cwd();

async function main() {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, "dist")));

  app.get("/api/app-dir", (_req, res) => res.json({ appDir: APP_DIR }));

  // Catch-all for SPA routing
  app.get("*", (_req, res) => res.sendFile(join(__dirname, "dist", "index.html")));

  const port = await findFreePort();
  app.listen(port, () => {
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
