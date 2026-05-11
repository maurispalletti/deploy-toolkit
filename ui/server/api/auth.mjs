import { spawn } from "node:child_process";

export function mountAuth(app, serverRef) {
  app.post("/api/login", (_req, res) => {
    const proc = spawn("firebase", ["login"], { stdio: "ignore", detached: true });
    proc.unref();
    res.json({ started: true });
  });

  app.post("/api/quit", (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => {
      if (serverRef.current) serverRef.current.close(() => process.exit(0));
      else process.exit(0);
    }, 100);
  });
}
