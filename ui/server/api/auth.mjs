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

  app.post("/api/quit", (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => {
      if (serverRef.current) serverRef.current.close(() => process.exit(0));
      else process.exit(0);
    }, 100);
  });
}
