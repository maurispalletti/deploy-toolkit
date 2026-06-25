import { spawn } from "node:child_process";

let loginInFlight = false;

export function mountAuth(app, serverRef) {
  app.post("/api/login", (_req, res) => {
    if (loginInFlight) {
      return res.json({ started: false, reason: "already-in-progress" });
    }
    loginInFlight = true;

    // Inherit stdio so firebase can interact with the terminal where the
    // server was launched. The user sees firebase's "Visit this URL" output
    // in their terminal and the OAuth browser tab opens automatically.
    // With stdio: "ignore" (the previous behavior), firebase hangs forever
    // waiting on the telemetry prompt and never opens the browser.
    console.log("\n▸ Starting `firebase login`... watch your terminal AND browser.");
    const proc = spawn("firebase", ["login", "--reauth"], { stdio: "inherit" });
    proc.on("exit", (code) => {
      console.log(`▸ firebase login exited with code ${code}`);
      loginInFlight = false;
    });
    proc.on("error", () => { loginInFlight = false; });

    res.json({ started: true });
  });

  app.post("/api/firebase-logout", (_req, res) => {
    const proc = spawn("firebase", ["logout"], { stdio: "inherit" });
    proc.on("exit", (code) => {
      console.log(`▸ firebase logout exited with code ${code}`);
    });
    proc.on("error", () => {});
    res.json({ started: true });
  });

  app.post("/api/gh-login", (_req, res) => {
    console.log("\n▸ Starting `gh auth login`... watch your terminal AND browser.");
    const proc = spawn("gh", ["auth", "login", "--web", "--hostname", "github.com"], { stdio: "inherit" });
    proc.on("exit", (code) => {
      console.log(`▸ gh auth login exited with code ${code}`);
    });
    proc.on("error", () => {});
    res.json({ started: true });
  });

  app.post("/api/open-in-ide", (req, res) => {
    const { ide, appDir } = req.body;
    if (!appDir) return res.status(400).json({ error: "appDir is required" });

    const openApp = (name) => spawn("open", ["-a", name, appDir], { stdio: "ignore" });

    if (ide === "cursor") {
      const p = spawn("cursor", [appDir], { stdio: "ignore" });
      p.on("error", () => openApp("Cursor"));
    } else if (ide === "vscode") {
      const p = spawn("code", [appDir], { stdio: "ignore" });
      p.on("error", () => openApp("Visual Studio Code"));
    } else if (ide === "antigravity") {
      openApp("Antigravity");
    } else if (ide === "devin") {
      openApp("Devin");
    } else {
      return res.status(400).json({ error: "Unknown IDE" });
    }

    res.json({ ok: true });
  });

  app.post("/api/quit", (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => {
      if (serverRef.current) serverRef.current.close(() => process.exit(0));
      else process.exit(0);
    }, 100);
  });
}
