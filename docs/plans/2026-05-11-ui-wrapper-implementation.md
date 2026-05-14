# UI Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based wizard UI on top of the existing CLI orchestrator, sharing the same brain and stages, with the CLI preserved as an escape hatch.

**Architecture:** A new `ui/` directory containing an Express server (`server.mjs`) and a Vite-built React frontend. The bash orchestrator (`deploy-app`) is modified to detect a `--cli` flag — without it, the orchestrator spawns the UI server and opens the user's browser to it. The server exposes six REST/SSE endpoints that wrap the existing `lib/` brain and `stages/` scripts.

**Tech Stack:**
- Express 4 + Node 22+ (backend)
- Vite 5 + React 18 (frontend)
- Server-Sent Events for live stage progress
- Native `node:test` for backend tests (matches existing pattern)
- No frontend test framework in v1 — covered by the end-to-end smoke test

**Source spec:** historical — captured in commit messages and `docs/REVISIT.md`. The spec was deliberately external during early design and is not part of this repository.

**Working directory:** `/Users/mauriciospalletti/Documents/personal/deploy-toolkit/`

---

## File layout reference

This plan creates the following new files. Tasks reference these paths.

```
deploy-toolkit/
├── deploy-app                          ← MODIFY (Task 1)
├── ui/                                 ← NEW
│   ├── package.json                    (Task 2)
│   ├── vite.config.js                  (Task 2)
│   ├── index.html                      (Task 2)
│   ├── server.mjs                      (Task 4)
│   ├── server/
│   │   ├── port.mjs                   (Task 4)
│   │   ├── api/
│   │   │   ├── preflight.mjs          (Task 5)
│   │   │   ├── preflight.test.mjs     (Task 5)
│   │   │   ├── brain.mjs              (Task 6 — inspect + plan)
│   │   │   ├── brain.test.mjs         (Task 6)
│   │   │   ├── run-stage.mjs          (Task 7)
│   │   │   ├── run-stage.test.mjs     (Task 7)
│   │   │   └── auth.mjs               (Task 8 — login + quit)
│   └── src/
│       ├── main.jsx                    (Task 2)
│       ├── App.jsx                     (Tasks 2/19)
│       ├── api.js                      (Task 11)
│       ├── styles/
│       │   ├── tokens.css              (Task 3)
│       │   └── global.css              (Task 3)
│       ├── components/
│       │   ├── Card.jsx                (Task 9)
│       │   ├── Button.jsx              (Task 9)
│       │   ├── StepHeader.jsx          (Task 9)
│       │   ├── BackButton.jsx          (Task 9)
│       │   ├── RadioRow.jsx            (Task 9)
│       │   ├── StatusRow.jsx           (Task 10)
│       │   ├── LiveLog.jsx             (Task 10)
│       │   └── StageCard.jsx           (Task 10)
│       └── pages/
│           ├── Welcome.jsx             (Task 12)
│           ├── Preflight.jsx           (Task 13)
│           ├── Inspector.jsx           (Task 14)
│           ├── Questions.jsx           (Task 15)
│           ├── PlanSummary.jsx         (Task 16)
│           ├── Progress.jsx            (Task 17)
│           └── Done.jsx                (Task 18)
└── stages/provision.sh                 ← MODIFY (Task 21 — emit NEEDS_BOOTSTRAP)
```

---

## Task 1: Branch `deploy-app` to detect `--cli` and spawn the UI server

**Files:**
- Modify: `deploy-app`

- [ ] **Step 1: Replace `deploy-app` contents**

```bash
#!/usr/bin/env bash
# deploy-app — orchestrates the full deploy flow.
# By default opens the wizard UI in the user's browser.
# Pass --cli to run the existing terminal-only flow.
set -euo pipefail

USE_CLI=false
APP_DIR=""
for arg in "$@"; do
  case "$arg" in
    --cli) USE_CLI=true ;;
    -*) printf "Unknown flag: %s\n" "$arg" >&2; exit 1 ;;
    *) APP_DIR="$arg" ;;
  esac
done
APP_DIR="${APP_DIR:-.}"
APP_DIR="$(cd "$APP_DIR" && pwd)"
TOOLKIT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Auto-switch to the Node version pinned in .nvmrc, if nvm is available.
if [ -f "$TOOLKIT_DIR/.nvmrc" ]; then
  NVM_SH="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -s "$NVM_SH" ]; then
    # shellcheck disable=SC1090
    . "$NVM_SH"
    NVMRC_VERSION="$(cat "$TOOLKIT_DIR/.nvmrc")"
    if ! nvm use "$NVMRC_VERSION" >/dev/null 2>&1; then
      echo "▸ Node $NVMRC_VERSION not installed. Installing via nvm..."
      nvm install "$NVMRC_VERSION" >/dev/null
      nvm use "$NVMRC_VERSION" >/dev/null
    fi
  fi
fi

if [ "$USE_CLI" = "true" ]; then
  echo "Hi! Let's get this app on the internet."
  echo "App folder: $APP_DIR"
  echo
  "$TOOLKIT_DIR/stages/preflight.sh"
  echo
  echo "▸ Looking at your app..."
  node "$TOOLKIT_DIR/lib/brain.mjs" "$APP_DIR"
  echo
  "$TOOLKIT_DIR/stages/provision.sh" "$APP_DIR"
  echo
  "$TOOLKIT_DIR/stages/build.sh" "$APP_DIR"
  echo
  "$TOOLKIT_DIR/stages/deploy.sh" "$APP_DIR"
  "$TOOLKIT_DIR/stages/report.sh" "$APP_DIR"
  exit 0
fi

# Default: spawn UI server
cd "$TOOLKIT_DIR/ui"
if [ ! -d node_modules ]; then
  echo "▸ Installing UI dependencies (first run only)..."
  npm install
fi
if [ ! -d dist ]; then
  echo "▸ Building UI (first run only)..."
  npm run build
fi
exec node server.mjs "$APP_DIR"
```

- [ ] **Step 2: Manual check — `--cli` path still works**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit
./deploy-app samples/static-html --cli
# Should run the existing CLI flow exactly as before.
# You can Ctrl+C at the first prompt — we just want to verify the flag dispatch.
```

Expected: prints "Hi! Let's get this app on the internet." and asks the first interview question.

- [ ] **Step 3: Manual check — default branch reports missing `ui/`**

```bash
./deploy-app samples/static-html
```

Expected: fails because `ui/` doesn't exist yet (`cd: ui: No such file or directory` or similar). This is fine — Task 2 creates `ui/`.

- [ ] **Step 4: Commit**

```bash
git add deploy-app
git commit -m "feat(orchestrator): split CLI vs UI by --cli flag

Default path now spawns the (not-yet-built) UI server. The existing CLI
flow is preserved verbatim and reachable via './deploy-app . --cli'."
```

---

## Task 2: Scaffold the `ui/` package

**Files:**
- Create: `ui/package.json`
- Create: `ui/vite.config.js`
- Create: `ui/index.html`
- Create: `ui/src/main.jsx`
- Create: `ui/src/App.jsx`

- [ ] **Step 1: Create `ui/package.json`**

```json
{
  "name": "deploy-toolkit-ui",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test 'server/**/*.test.mjs'"
  },
  "dependencies": {
    "express": "^4.19.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Create `ui/vite.config.js`**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: Create `ui/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>deploy-toolkit</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create `ui/src/main.jsx`**

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Create `ui/src/App.jsx` (placeholder)**

```jsx
export default function App() {
  return <div style={{ padding: 24 }}>deploy-toolkit UI — scaffolding</div>;
}
```

- [ ] **Step 6: Install deps and verify build**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit/ui
npm install
npm run build
ls dist/
```

Expected: `dist/index.html` and `dist/assets/` exist.

- [ ] **Step 7: Commit**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit
git add ui/package.json ui/vite.config.js ui/index.html ui/src/main.jsx ui/src/App.jsx
git commit -m "feat(ui): scaffold Vite + React package"
```

Add `ui/dist/` and `ui/node_modules/` to `.gitignore` if not already covered (they should be — `node_modules/` is wildcard).

- [ ] **Step 8: Update `.gitignore`**

```bash
echo "ui/dist/" >> /Users/mauriciospalletti/Documents/personal/deploy-toolkit/.gitignore
git add .gitignore
git commit -m "chore: ignore ui/dist build output"
```

---

## Task 3: Style tokens and global CSS

**Files:**
- Create: `ui/src/styles/tokens.css`
- Create: `ui/src/styles/global.css`

- [ ] **Step 1: Create `tokens.css`**

```css
:root {
  --bg: #0f0f0f;
  --bg-2: #161616;
  --card: #1a1a1a;
  --border: #2a2a2a;
  --border-strong: #3a3a3a;
  --text: #ededed;
  --muted: #8a8a8a;
  --orange: #ffa000;
  --orange-2: #ff8f00;
  --yellow: #ffca28;
  --blue: #669df6;
  --green: #34a853;
  --red: #ea4335;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 4px 12px rgba(0,0,0,.4);
  --radius-card: 14px;
  --radius-input: 8px;
  --radius-button: 999px;
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
}
```

- [ ] **Step 2: Create `global.css`**

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font: 15px/1.55 var(--font-sans);
  min-height: 100vh;
}
#root {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
}
.container { width: 100%; max-width: 720px; }
.codepath {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--bg-2);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}
.muted { color: var(--muted); }
.link { color: var(--blue); text-decoration: none; }
.link:hover { text-decoration: underline; }
.brand {
  display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
}
.brand-flame {
  width: 22px; height: 22px;
  background: linear-gradient(135deg, var(--orange) 0%, var(--yellow) 100%);
  border-radius: 4px 12px 4px 12px / 12px 4px 12px 4px;
  transform: rotate(-8deg);
}
.brand-name { font-weight: 600; }
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
.page-enter { animation: fade-in .25s; }
```

- [ ] **Step 3: Verify build still works**

```bash
cd ui && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit
git add ui/src/styles/
git commit -m "feat(ui): Firebase-flavored tokens + global styles"
```

---

## Task 4: Express server with port discovery + static serving

**Files:**
- Create: `ui/server.mjs`
- Create: `ui/server/port.mjs`

- [ ] **Step 1: Create `ui/server/port.mjs`**

```js
import { createServer } from "node:net";

export function findFreePort(start = 4242, end = 4299) {
  return new Promise((resolve, reject) => {
    function attempt(port) {
      if (port > end) return reject(new Error(`No free port in ${start}-${end}`));
      const srv = createServer();
      srv.once("error", () => attempt(port + 1));
      srv.once("listening", () => srv.close(() => resolve(port)));
      srv.listen(port);
    }
    attempt(start);
  });
}
```

- [ ] **Step 2: Create `ui/server.mjs`**

```js
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
```

- [ ] **Step 3: Manual check — start server**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit
./deploy-app samples/static-html
```

Expected: browser opens to `http://localhost:4242/` and shows "deploy-toolkit UI — scaffolding". Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add ui/server.mjs ui/server/port.mjs
git commit -m "feat(ui): express server with port discovery and static serving"
```

---

## Task 5: API `GET /api/preflight`

Runs the existing preflight checks and returns structured status.

**Files:**
- Create: `ui/server/api/preflight.mjs`
- Create: `ui/server/api/preflight.test.mjs`
- Modify: `ui/server.mjs`

- [ ] **Step 1: Write the failing test**

```js
// ui/server/api/preflight.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectPreflight } from "./preflight.mjs";

test("collectPreflight returns node, firebaseCli, login status", async () => {
  const result = await collectPreflight();
  assert.ok(result.node && typeof result.node.version === "string");
  assert.ok(result.node.ok === true || result.node.ok === false);
  assert.ok(typeof result.firebaseCli.installed === "boolean");
  assert.ok(typeof result.login.ok === "boolean");
  if (result.login.ok) assert.ok(typeof result.login.email === "string");
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit/ui
npm test
```

Expected: module not found.

- [ ] **Step 3: Implement `preflight.mjs`**

```js
// ui/server/api/preflight.mjs
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function which(cmd) {
  try { await exec("which", [cmd]); return true; } catch { return false; }
}

async function nodeStatus() {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  return { version: process.versions.node, major, ok: major >= 22 };
}

async function firebaseStatus() {
  const installed = await which("firebase");
  return { installed, ok: installed };
}

async function loginStatus() {
  try {
    const { stdout } = await exec("firebase", ["login:list"]);
    const match = stdout.match(/User:\s+(\S+)/);
    if (match) return { ok: true, email: match[1] };
    return { ok: false, email: null };
  } catch {
    return { ok: false, email: null };
  }
}

export async function collectPreflight() {
  const [node, firebaseCli, login] = await Promise.all([
    nodeStatus(), firebaseStatus(), loginStatus()
  ]);
  return { node, firebaseCli, login };
}

export function mountPreflight(app) {
  app.get("/api/preflight", async (_req, res) => {
    try { res.json(await collectPreflight()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
}
```

- [ ] **Step 4: Mount in `server.mjs`**

In `ui/server.mjs`, after `app.use(express.json());` and before the static handler:

```js
import { mountPreflight } from "./server/api/preflight.mjs";
// ...inside main(), after app.use(express.json()):
mountPreflight(app);
```

- [ ] **Step 5: Run tests + smoke check the endpoint**

```bash
npm test
# In another terminal:
./deploy-app samples/static-html
curl http://localhost:4242/api/preflight
```

Expected: tests PASS; curl returns JSON with node/firebaseCli/login keys.

- [ ] **Step 6: Commit**

```bash
git add ui/server/api/preflight.mjs ui/server/api/preflight.test.mjs ui/server.mjs
git commit -m "feat(ui-api): GET /api/preflight"
```

---

## Task 6: API `POST /api/inspect` and `POST /api/plan`

Wraps the existing inspector + planner.

**Files:**
- Create: `ui/server/api/brain.mjs`
- Create: `ui/server/api/brain.test.mjs`
- Modify: `ui/server.mjs`

- [ ] **Step 1: Write the failing test**

```js
// ui/server/api/brain.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectApp, planApp } from "./brain.mjs";

const STATIC_SAMPLE = new URL("../../../samples/static-html", import.meta.url).pathname;

test("inspectApp returns the inspector hypothesis", async () => {
  const out = await inspectApp(STATIC_SAMPLE);
  assert.equal(out.framework, "none");
  assert.equal(out.suggestedShape, "A");
});

test("planApp persists deploy-app.config.json and returns the plan", async () => {
  const answers = {
    appName: "ui-brain-test",
    needsAuth: false,
    needsDb: false,
    shape: "A",
    secretKeys: []
  };
  const plan = await planApp(STATIC_SAMPLE, answers);
  assert.equal(plan.appName, "ui-brain-test");
  assert.match(plan.firebase.projectId, /^ui-brain-test-[a-z0-9]{1,4}$/);
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test
```

- [ ] **Step 3: Implement `brain.mjs`**

```js
// ui/server/api/brain.mjs
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { inspect } from "../../../lib/inspector/index.mjs";
import { plan } from "../../../lib/planner/index.mjs";

export async function inspectApp(appDir) {
  return inspect(appDir);
}

export async function planApp(appDir, answers) {
  const inspection = await inspect(appDir);
  const result = plan(inspection, answers);
  await writeFile(join(appDir, "deploy-app.config.json"), JSON.stringify(result, null, 2));
  return result;
}

export async function clearConfig(appDir) {
  try { await unlink(join(appDir, "deploy-app.config.json")); } catch {}
}

export function mountBrain(app) {
  app.post("/api/inspect", async (req, res) => {
    try { res.json(await inspectApp(req.body.appDir)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/plan", async (req, res) => {
    try { res.json(await planApp(req.body.appDir, req.body.answers)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
}
```

- [ ] **Step 4: Mount in `server.mjs`** (same pattern as Task 5)

```js
import { mountBrain } from "./server/api/brain.mjs";
// inside main():
mountBrain(app);
```

- [ ] **Step 5: Run tests + smoke check**

```bash
npm test
```

Tests PASS. Then manually:

```bash
rm -f samples/static-html/deploy-app.config.json
./deploy-app samples/static-html
# In another terminal:
curl -X POST http://localhost:4242/api/inspect \
  -H "content-type: application/json" \
  -d '{"appDir":"/Users/mauriciospalletti/Documents/personal/deploy-toolkit/samples/static-html"}'
```

Expected: JSON inspection result with `framework: "none"`.

- [ ] **Step 6: Commit**

```bash
git add ui/server/api/brain.mjs ui/server/api/brain.test.mjs ui/server.mjs
git commit -m "feat(ui-api): POST /api/inspect and /api/plan"
```

---

## Task 7: API `GET /api/run-stage/:stage` (SSE)

Streams a bash stage's stdout/stderr line-by-line.

**Files:**
- Create: `ui/server/api/run-stage.mjs`
- Create: `ui/server/api/run-stage.test.mjs`
- Modify: `ui/server.mjs`

- [ ] **Step 1: Write the failing test**

```js
// ui/server/api/run-stage.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { runStage } from "./run-stage.mjs";

test("runStage emits log lines and a done event", async () => {
  // Use the existing build.sh against a sample with no build command —
  // it should print 'skipping' and exit 0.
  const events = [];
  await new Promise((resolve, reject) => {
    runStage("build", "/Users/mauriciospalletti/Documents/personal/deploy-toolkit/samples/static-html", {
      write: (line) => events.push(line),
      end: () => resolve(),
    }).catch(reject);
  });
  const joined = events.join("\n");
  assert.match(joined, /event: log/);
  assert.match(joined, /event: done/);
});
```

(Note: the static-html sample needs a `deploy-app.config.json`. If the test fails because of that, the test should call `planApp` first; defer to implementation.)

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test
```

- [ ] **Step 3: Implement `run-stage.mjs`**

```js
// ui/server/api/run-stage.mjs
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TOOLKIT_DIR = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const STAGES = {
  preflight: "stages/preflight.sh",
  provision: "stages/provision.sh",
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

function sseEvent(stream, event, data) {
  stream.write(`event: ${event}\n`);
  stream.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

- [ ] **Step 4: Mount in `server.mjs`**

```js
import { mountRunStage } from "./server/api/run-stage.mjs";
// inside main():
mountRunStage(app);
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/server/api/run-stage.mjs ui/server/api/run-stage.test.mjs ui/server.mjs
git commit -m "feat(ui-api): GET /api/run-stage/:stage with SSE streaming"
```

---

## Task 8: API `POST /api/login` and `POST /api/quit`

**Files:**
- Create: `ui/server/api/auth.mjs`
- Modify: `ui/server.mjs`

- [ ] **Step 1: Implement `auth.mjs`**

```js
// ui/server/api/auth.mjs
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
```

- [ ] **Step 2: Mount in `server.mjs` with server reference**

Modify the `main()` function to hold a server reference and pass it:

```js
import { mountAuth } from "./server/api/auth.mjs";
// inside main():
const serverRef = { current: null };
mountAuth(app, serverRef);
// ...
serverRef.current = app.listen(port, () => { ... });
```

- [ ] **Step 3: Smoke check**

```bash
./deploy-app samples/static-html
# In another terminal:
curl -X POST http://localhost:4242/api/quit
```

Expected: server exits cleanly.

- [ ] **Step 4: Commit**

```bash
git add ui/server/api/auth.mjs ui/server.mjs
git commit -m "feat(ui-api): POST /api/login and /api/quit"
```

---

## Task 9: Core React components — Card, Button, StepHeader, BackButton, RadioRow

**Files:**
- Create: `ui/src/components/Card.jsx`
- Create: `ui/src/components/Button.jsx`
- Create: `ui/src/components/StepHeader.jsx`
- Create: `ui/src/components/BackButton.jsx`
- Create: `ui/src/components/RadioRow.jsx`

- [ ] **Step 1: Card**

```jsx
// ui/src/components/Card.jsx
export default function Card({ title, sub, children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {title && <h1 className="card-title">{title}</h1>}
      {sub && <p className="card-sub">{sub}</p>}
      {children}
    </div>
  );
}
```

Add to `global.css`:

```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 32px;
  box-shadow: var(--shadow);
}
.card-title { margin: 0 0 6px; font-size: 24px; font-weight: 600; letter-spacing: -.2px; }
.card-sub { margin: 0 0 24px; color: var(--muted); font-size: 14px; }
.btn-row { margin-top: 28px; display: flex; gap: 12px; align-items: center; justify-content: flex-end; }
.btn-row.split { justify-content: space-between; }
```

- [ ] **Step 2: Button**

```jsx
// ui/src/components/Button.jsx
export default function Button({ variant = "primary", children, ...rest }) {
  return <button className={`btn btn-${variant}`} {...rest}>{children}</button>;
}
```

Add to `global.css`:

```css
.btn {
  padding: 10px 20px;
  border-radius: var(--radius-button);
  border: none;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, transform .05s;
}
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-primary { background: var(--orange); color: #1a1300; }
.btn-primary:hover { background: var(--yellow); }
.btn-secondary { background: transparent; color: var(--text); border: 1px solid var(--border-strong); }
.btn-secondary:hover { background: var(--bg-2); }
.btn-ghost { background: transparent; color: var(--muted); padding: 10px 12px; }
.btn-ghost:hover { color: var(--text); }
```

- [ ] **Step 3: StepHeader**

```jsx
// ui/src/components/StepHeader.jsx
export default function StepHeader({ current, total = 7 }) {
  return (
    <>
      <div className="brand">
        <div className="brand-flame" />
        <div className="brand-name">deploy-toolkit</div>
      </div>
      <div className="steps">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`step-dot ${i < current - 1 ? "done" : ""} ${i === current - 1 ? "active" : ""}`} />
        ))}
      </div>
    </>
  );
}
```

Add to `global.css`:

```css
.steps { display: flex; gap: 8px; margin-bottom: 20px; }
.step-dot {
  width: 24px; height: 4px; border-radius: 2px;
  background: #262626; transition: background .2s;
}
.step-dot.active { background: var(--orange); }
.step-dot.done { background: var(--orange-2); opacity: .6; }
```

- [ ] **Step 4: BackButton**

```jsx
// ui/src/components/BackButton.jsx
import Button from "./Button.jsx";

export default function BackButton({ onClick }) {
  return <Button variant="ghost" onClick={onClick}>← Back</Button>;
}
```

- [ ] **Step 5: RadioRow**

```jsx
// ui/src/components/RadioRow.jsx
export default function RadioRow({ name, value, onChange, options }) {
  return (
    <div className="radio-row">
      {options.map(opt => (
        <label key={opt.value} className={value === opt.value ? "selected" : ""}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
```

Add to `global.css`:

```css
.radio-row { display: flex; gap: 10px; }
.radio-row label {
  flex: 1; padding: 10px 16px; text-align: center;
  background: var(--bg-2); border: 1px solid var(--border-strong);
  border-radius: var(--radius-input); cursor: pointer;
  font-size: 14px; transition: border-color .15s, color .15s;
}
.radio-row label.selected { border-color: var(--orange); color: var(--orange); }
.radio-row input { display: none; }
```

- [ ] **Step 6: Verify build**

```bash
cd ui && npm run build
```

- [ ] **Step 7: Commit**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit
git add ui/src/components/Card.jsx ui/src/components/Button.jsx ui/src/components/StepHeader.jsx ui/src/components/BackButton.jsx ui/src/components/RadioRow.jsx ui/src/styles/global.css
git commit -m "feat(ui-components): Card, Button, StepHeader, BackButton, RadioRow"
```

---

## Task 10: Domain React components — StatusRow, LiveLog, StageCard

**Files:**
- Create: `ui/src/components/StatusRow.jsx`
- Create: `ui/src/components/LiveLog.jsx`
- Create: `ui/src/components/StageCard.jsx`

- [ ] **Step 1: StatusRow**

```jsx
// ui/src/components/StatusRow.jsx
export default function StatusRow({ state, title, meta, action }) {
  // state: "ok" | "fail" | "pending"
  return (
    <div className="status">
      <div className={`status-icon ${state}`}>
        {state === "ok" && "✓"}
        {state === "fail" && "✕"}
        {state === "pending" && "…"}
      </div>
      <div className="status-body">
        <div className="status-title">{title}</div>
        {meta && <div className="status-meta">{meta}</div>}
      </div>
      {action && <div className="status-action">{action}</div>}
    </div>
  );
}
```

Add to `global.css`:

```css
.status {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 10px;
  background: var(--bg-2); border: 1px solid var(--border);
}
.status + .status { margin-top: 8px; }
.status-icon {
  width: 18px; height: 18px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
  color: white;
}
.status-icon.ok { background: var(--green); }
.status-icon.fail { background: var(--red); }
.status-icon.pending { background: #444; color: var(--muted); }
.status-body { flex: 1; }
.status-title { font-size: 14px; font-weight: 500; }
.status-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
```

- [ ] **Step 2: LiveLog**

```jsx
// ui/src/components/LiveLog.jsx
import { useEffect, useRef } from "react";

export default function LiveLog({ lines }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div ref={ref} className="live-log">
      {lines.map((line, i) => <div key={i} className="log-line">{line}</div>)}
    </div>
  );
}
```

Add to `global.css`:

```css
.live-log {
  font-family: var(--font-mono);
  font-size: 12px; color: var(--muted);
  max-height: 280px; overflow-y: auto;
  padding: 8px 0;
}
.log-line { padding: 2px 0; white-space: pre-wrap; }
```

- [ ] **Step 3: StageCard**

```jsx
// ui/src/components/StageCard.jsx
import LiveLog from "./LiveLog.jsx";

export default function StageCard({ name, status, lines, open }) {
  // status: "idle" | "running" | "done" | "error"
  return (
    <div className={`stage ${open ? "open" : ""}`}>
      <div className="stage-head">
        <div className={`stage-dot ${status}`} />
        <div className="stage-name">{name}</div>
      </div>
      {open && (
        <div className="stage-log-wrap">
          <LiveLog lines={lines} />
        </div>
      )}
    </div>
  );
}
```

Add to `global.css`:

```css
.stage {
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg-2); margin-bottom: 10px; overflow: hidden;
}
.stage-head {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
}
.stage-name { flex: 1; font-size: 14px; font-weight: 500; }
.stage-dot { width: 10px; height: 10px; border-radius: 50%; background: #444; }
.stage-dot.running { background: var(--orange); animation: stage-pulse 1s infinite; }
.stage-dot.done { background: var(--green); }
.stage-dot.error { background: var(--red); }
@keyframes stage-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.stage-log-wrap { padding: 0 14px 12px; }
```

- [ ] **Step 4: Verify build**

```bash
cd ui && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit
git add ui/src/components/StatusRow.jsx ui/src/components/LiveLog.jsx ui/src/components/StageCard.jsx ui/src/styles/global.css
git commit -m "feat(ui-components): StatusRow, LiveLog, StageCard"
```

---

## Task 11: API client + SSE consumer

**Files:**
- Create: `ui/src/api.js`

- [ ] **Step 1: Create `api.js`**

```js
// ui/src/api.js
export async function getAppDir() {
  const r = await fetch("/api/app-dir");
  return (await r.json()).appDir;
}

export async function getPreflight() {
  const r = await fetch("/api/preflight");
  if (!r.ok) throw new Error(`preflight ${r.status}`);
  return r.json();
}

export async function postInspect(appDir) {
  const r = await fetch("/api/inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appDir }),
  });
  if (!r.ok) throw new Error(`inspect ${r.status}`);
  return r.json();
}

export async function postPlan(appDir, answers) {
  const r = await fetch("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appDir, answers }),
  });
  if (!r.ok) throw new Error(`plan ${r.status}`);
  return r.json();
}

export async function postLogin() {
  const r = await fetch("/api/login", { method: "POST" });
  return r.json();
}

export async function postQuit() {
  try { await fetch("/api/quit", { method: "POST" }); } catch {}
}

// Runs a stage, calls onLog(line) per log line, returns { exitCode, error? }
export function runStage(stage, appDir, { onLog, onError }) {
  return new Promise((resolve) => {
    const url = `/api/run-stage/${stage}?appDir=${encodeURIComponent(appDir)}`;
    const es = new EventSource(url);
    es.addEventListener("log", (e) => {
      const { line } = JSON.parse(e.data);
      onLog?.(line);
    });
    es.addEventListener("done", (e) => {
      es.close();
      resolve(JSON.parse(e.data));
    });
    es.addEventListener("error", (e) => {
      const data = e.data ? JSON.parse(e.data) : { message: "stream error" };
      onError?.(data);
      es.close();
      resolve({ exitCode: -1, error: data });
    });
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd ui && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/api.js
git commit -m "feat(ui-client): typed API helpers + SSE consumer"
```

---

## Task 12: Welcome page

**Files:**
- Create: `ui/src/pages/Welcome.jsx`

- [ ] **Step 1: Create `Welcome.jsx`**

```jsx
// ui/src/pages/Welcome.jsx
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StatusRow from "../components/StatusRow.jsx";

export default function Welcome({ appDir, onNext }) {
  return (
    <Card title="Let's get your app on the internet"
          sub="We'll set up Firebase Hosting, ask a few quick questions, and deploy.">
      <StatusRow
        state="ok"
        title="Detected app folder"
        meta={<span className="codepath">{appDir}</span>}
      />
      <div className="btn-row split">
        <span className="muted" style={{fontSize:13}}>
          Or use the CLI: <code className="codepath">./deploy-app . --cli</code>
        </span>
        <Button onClick={onNext}>Get started</Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/Welcome.jsx
git commit -m "feat(ui-page): Welcome"
```

---

## Task 13: Preflight page

**Files:**
- Create: `ui/src/pages/Preflight.jsx`

- [ ] **Step 1: Create `Preflight.jsx`**

```jsx
// ui/src/pages/Preflight.jsx
import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { getPreflight, postLogin } from "../api.js";

export default function Preflight({ onBack, onNext }) {
  const [state, setState] = useState(null);
  const [loginPolling, setLoginPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await getPreflight();
        if (!cancelled) setState(data);
      } catch {}
    }
    poll();
    const id = setInterval(poll, loginPolling ? 2000 : 0);
    return () => { cancelled = true; clearInterval(id); };
  }, [loginPolling]);

  const allOk = state && state.node.ok && state.firebaseCli.ok && state.login.ok;

  return (
    <Card title="Checking your tools"
          sub="Quick prerequisites check before we touch Firebase.">
      <StatusRow
        state={state?.node ? (state.node.ok ? "ok" : "fail") : "pending"}
        title="Node.js"
        meta={state?.node ? `v${state.node.version} — needs ≥ 22` : "checking…"}
      />
      <StatusRow
        state={state?.firebaseCli ? (state.firebaseCli.ok ? "ok" : "fail") : "pending"}
        title="Firebase CLI"
        meta={state?.firebaseCli ? (state.firebaseCli.installed ? "installed" : "not installed — install: npm install -g firebase-tools") : "checking…"}
      />
      <StatusRow
        state={state?.login ? (state.login.ok ? "ok" : "fail") : "pending"}
        title="Logged in to Firebase"
        meta={state?.login?.email || (loginPolling ? "waiting for login in the other tab…" : "not logged in")}
        action={
          state?.login && !state.login.ok && !loginPolling ? (
            <a className="link" onClick={async () => { await postLogin(); setLoginPolling(true); }}>Sign in</a>
          ) : state?.login?.ok ? (
            <a className="link" onClick={async () => { await postLogin(); setLoginPolling(true); }}>Switch account</a>
          ) : null
        }
      />
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={onNext} disabled={!allOk}>Continue</Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/Preflight.jsx
git commit -m "feat(ui-page): Preflight with live polling and sign-in trigger"
```

---

## Task 14: Inspector preview page

**Files:**
- Create: `ui/src/pages/Inspector.jsx`

- [ ] **Step 1: Create `Inspector.jsx`**

```jsx
// ui/src/pages/Inspector.jsx
import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import { postInspect } from "../api.js";

export default function Inspector({ appDir, onBack, onConfirm }) {
  const [data, setData] = useState(null);
  useEffect(() => { postInspect(appDir).then(setData); }, [appDir]);

  if (!data) return <Card title="Looking at your app…" sub="" />;

  const shapeLabel = data.suggestedShape === "C"
    ? "frontend + backend (Shape C)"
    : data.suggestedShape === "A"
      ? "static frontend only (Shape A)"
      : "frontend + optional Firebase services (Shape A or B)";

  return (
    <Card title={data.framework === "none" ? "Looks like a plain static app" : `Looks like a ${data.framework} app`}
          sub="Here's what I see in your folder. Adjust if anything's off.">
      <dl className="insp-grid">
        <dt>Framework</dt><dd>{data.framework}</dd>
        <dt>Build output</dt><dd><code className="codepath">{data.outputDir || "(none — won't build)"}</code></dd>
        <dt>Backend code</dt><dd>{data.hasBackend ? "Yes — Shape C" : "No"}</dd>
        <dt>Suggested shape</dt><dd>{shapeLabel}</dd>
        {data.envKeys?.length > 0 && (
          <>
            <dt>Detected secrets</dt>
            <dd>{data.envKeys.map(k => <code key={k} className="codepath" style={{marginRight:6}}>{k}</code>)}</dd>
          </>
        )}
      </dl>
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={() => onConfirm(data)}>Yes, that's right</Button>
      </div>
    </Card>
  );
}
```

Add to `global.css`:

```css
.insp-grid {
  display: grid; grid-template-columns: 140px 1fr; gap: 8px 16px;
  padding: 14px 16px; border: 1px solid var(--border);
  background: var(--bg-2); border-radius: 10px; font-size: 14px;
}
.insp-grid dt { color: var(--muted); }
.insp-grid dd { margin: 0; color: var(--text); }
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/Inspector.jsx ui/src/styles/global.css
git commit -m "feat(ui-page): Inspector preview with hypothesis card"
```

---

## Task 15: Questions page

**Files:**
- Create: `ui/src/pages/Questions.jsx`

- [ ] **Step 1: Create `Questions.jsx`**

```jsx
// ui/src/pages/Questions.jsx
import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import RadioRow from "../components/RadioRow.jsx";

const yesNo = [{value:"yes",label:"Yes"},{value:"no",label:"No"}];

export default function Questions({ inspection, defaults, onBack, onNext }) {
  const [appName, setAppName] = useState(defaults?.appName ?? inspection?.pkgName ?? "my-app");
  const [needsAuth, setNeedsAuth] = useState(defaults?.needsAuth ? "yes" : "no");
  const [needsDb, setNeedsDb] = useState(defaults?.needsDb ? "yes" : "no");

  function submit() {
    const shape = inspection.suggestedShape === "C"
      ? "C"
      : (needsAuth === "yes" || needsDb === "yes" ? "B" : "A");
    onNext({
      appName,
      needsAuth: needsAuth === "yes",
      needsDb: needsDb === "yes",
      shape,
      secretKeys: inspection.envKeys || [],
    });
  }

  return (
    <Card title="A few quick questions"
          sub="These help us pick the right Firebase setup for your app.">
      <div className="field">
        <label>What name for this app?</label>
        <input type="text" value={appName} onChange={e => setAppName(e.target.value)} />
        <div className="help">Used as your Firebase project ID. We'll add a small random suffix.</div>
      </div>
      <div className="field">
        <label>Will users need to sign in?</label>
        <RadioRow name="auth" value={needsAuth} onChange={setNeedsAuth} options={yesNo} />
        <div className="help">
          If yes, we'll enable Google sign-in for your project. You'll need to add Firebase Auth code to your app yourself — we'll link you to a guide on the Done page.
        </div>
      </div>
      <div className="field">
        <label>Does the app need to remember things between visits?</label>
        <RadioRow name="db" value={needsDb} onChange={setNeedsDb} options={yesNo} />
        <div className="help">If yes, we'll set up Firestore with locked-down default rules.</div>
      </div>
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={submit}>Continue</Button>
      </div>
    </Card>
  );
}
```

Add to `global.css`:

```css
.field { margin-bottom: 18px; }
.field label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.field input[type=text] {
  width: 100%; padding: 10px 14px;
  background: var(--bg-2); color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-input);
  font: inherit;
}
.field input[type=text]:focus { outline: none; border-color: var(--orange); }
.help { font-size: 12px; color: var(--muted); margin-top: 6px; }
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/Questions.jsx ui/src/styles/global.css
git commit -m "feat(ui-page): Questions with three plain-language inputs"
```

---

## Task 16: Plan summary page

**Files:**
- Create: `ui/src/pages/PlanSummary.jsx`

- [ ] **Step 1: Create `PlanSummary.jsx`**

```jsx
// ui/src/pages/PlanSummary.jsx
import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import { postPlan } from "../api.js";

export default function PlanSummary({ appDir, answers, onBack, onDeploy }) {
  const [plan, setPlan] = useState(null);
  useEffect(() => { postPlan(appDir, answers).then(setPlan); }, [appDir, answers]);

  if (!plan) return <Card title="Preparing your plan…" sub="" />;

  const items = [];
  items.push({ title: "Create Firebase project", meta: plan.firebase.projectId });
  items.push({ title: "Configure Firebase Hosting", meta: <>Publishing <code className="codepath">{plan.hosting.publicDir}</code></> });
  if (plan.firestore) items.push({ title: "Set up Firestore", meta: "Locked-down default rules — authenticated users can read/write their own data" });
  if (plan.functions) items.push({ title: "Configure Cloud Functions", meta: `Functions dir: ${plan.functions.dir}` });
  if (plan.build.command) items.push({ title: "Build your app", meta: <code className="codepath">{plan.build.command}</code> });
  items.push({ title: "Deploy", meta: "Upload to Firebase Hosting and finalize" });

  return (
    <Card title="Here's the plan" sub="Review before we deploy. Nothing has been created yet.">
      <ol className="plan-list">
        {items.map((it, i) => (
          <li key={i}>
            <div className="num">{i + 1}</div>
            <div>
              <div className="title">{it.title}</div>
              <div className="meta">{it.meta}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={() => onDeploy(plan)}>Deploy</Button>
      </div>
    </Card>
  );
}
```

Add to `global.css`:

```css
.plan-list { list-style: none; padding: 0; margin: 0; }
.plan-list li {
  padding: 10px 0; display: flex; gap: 12px; align-items: flex-start;
  border-bottom: 1px solid var(--border);
}
.plan-list li:last-child { border-bottom: none; }
.plan-list .num {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(255,160,0,.15); color: var(--orange);
  font-weight: 600; font-size: 12px;
  display: grid; place-items: center; flex-shrink: 0; margin-top: 1px;
}
.plan-list .title { font-size: 14px; }
.plan-list .meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/PlanSummary.jsx ui/src/styles/global.css
git commit -m "feat(ui-page): PlanSummary"
```

---

## Task 17: Progress page (streams stages via SSE)

**Files:**
- Create: `ui/src/pages/Progress.jsx`

- [ ] **Step 1: Create `Progress.jsx`**

```jsx
// ui/src/pages/Progress.jsx
import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runStage } from "../api.js";

const STAGES = [
  { id: "provision", name: "Provisioning Firebase project" },
  { id: "build", name: "Building your app" },
  { id: "deploy", name: "Deploying to Firebase Hosting" },
];

export default function Progress({ appDir, onDone, onError }) {
  const [stageState, setStageState] = useState(() =>
    STAGES.reduce((acc, s) => ({ ...acc, [s.id]: { status: "idle", lines: [] } }), {})
  );
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const stage of STAGES) {
        if (cancelled) return;
        setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "running" } }));
        const result = await runStage(stage.id, appDir, {
          onLog: (line) => setStageState(s => ({
            ...s,
            [stage.id]: { ...s[stage.id], lines: [...s[stage.id].lines, line] }
          })),
        });
        if (result.exitCode !== 0) {
          setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "error" } }));
          onError?.({ stage: stage.id, exitCode: result.exitCode });
          return;
        }
        setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "done" } }));
      }
      if (!cancelled) {
        setAllDone(true);
        onDone?.();
      }
    })();
    return () => { cancelled = true; };
  }, [appDir]);

  return (
    <Card title="Deploying…" sub="Live output from each stage. Click a stage to expand.">
      {STAGES.map((s, i) => (
        <StageCard
          key={s.id}
          name={s.name}
          status={stageState[s.id].status}
          lines={stageState[s.id].lines}
          open={stageState[s.id].status === "running" || stageState[s.id].status === "error"}
        />
      ))}
      {allDone && (
        <div className="btn-row">
          <Button onClick={onDone}>See your live app →</Button>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/Progress.jsx
git commit -m "feat(ui-page): Progress with SSE stage streaming"
```

---

## Task 18: Done page

**Files:**
- Create: `ui/src/pages/Done.jsx`

- [ ] **Step 1: Create `Done.jsx`**

```jsx
// ui/src/pages/Done.jsx
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";

export default function Done({ plan, onRedeploy, onAnother }) {
  const projectId = plan?.firebase.projectId;
  const url = `https://${projectId}.web.app`;
  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/overview`;
  const authUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
  const needsAuth = plan?.auth !== null;

  return (
    <Card className="done">
      <div className="done-card">
        <div className="done-emoji">🎉</div>
        <h2>Your app is live</h2>
        <a className="done-url" href={url} target="_blank" rel="noreferrer">{url}</a>
        <div className="done-actions">
          <Button onClick={() => window.open(url, "_blank")}>Open site ↗</Button>
          {needsAuth && (
            <Button variant="secondary" onClick={() => window.open(authUrl, "_blank")}>
              🔐 Enable Google sign-in
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.open(consoleUrl, "_blank")}>View console</Button>
          <Button variant="secondary" onClick={onRedeploy}>Redeploy</Button>
          <Button variant="secondary" onClick={onAnother}>Deploy another app</Button>
        </div>
      </div>
    </Card>
  );
}
```

Add to `global.css`:

```css
.done-card {
  padding: 32px; border: 1px solid var(--border); border-radius: var(--radius-card);
  background: linear-gradient(135deg, rgba(255,160,0,.06), rgba(255,202,40,.04));
  text-align: center;
}
.done-emoji { font-size: 48px; margin-bottom: 8px; }
.done-card h2 { margin: 0 0 8px; font-size: 22px; }
.done-url {
  display: inline-block; margin: 16px 0 8px;
  font-family: var(--font-mono); font-size: 16px; color: var(--blue);
  padding: 10px 18px; border-radius: 10px;
  background: var(--bg-2); border: 1px solid var(--border);
  text-decoration: none;
}
.done-url:hover { background: #1f1f1f; }
.done-actions {
  display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;
  margin-top: 24px;
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/Done.jsx ui/src/styles/global.css
git commit -m "feat(ui-page): Done with URL + post-deploy actions"
```

---

## Task 19: App shell + state machine + page routing

**Files:**
- Modify: `ui/src/App.jsx`

- [ ] **Step 1: Replace `App.jsx`**

```jsx
// ui/src/App.jsx
import { useEffect, useState } from "react";
import StepHeader from "./components/StepHeader.jsx";
import Welcome from "./pages/Welcome.jsx";
import Preflight from "./pages/Preflight.jsx";
import Inspector from "./pages/Inspector.jsx";
import Questions from "./pages/Questions.jsx";
import PlanSummary from "./pages/PlanSummary.jsx";
import Progress from "./pages/Progress.jsx";
import Done from "./pages/Done.jsx";
import { getAppDir } from "./api.js";

const PAGES = ["welcome", "preflight", "inspector", "questions", "plan", "progress", "done"];

export default function App() {
  const [appDir, setAppDir] = useState(null);
  const [step, setStep] = useState(1);
  const [inspection, setInspection] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => { getAppDir().then(setAppDir); }, []);

  const next = () => setStep(s => Math.min(7, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  if (!appDir) return <div className="container">Loading…</div>;

  return (
    <div className="container page-enter" key={step}>
      <StepHeader current={step} />
      {step === 1 && <Welcome appDir={appDir} onNext={next} />}
      {step === 2 && <Preflight onBack={back} onNext={next} />}
      {step === 3 && <Inspector appDir={appDir} onBack={back} onConfirm={(i) => { setInspection(i); next(); }} />}
      {step === 4 && <Questions inspection={inspection} defaults={answers} onBack={back} onNext={(a) => { setAnswers(a); next(); }} />}
      {step === 5 && <PlanSummary appDir={appDir} answers={answers} onBack={back} onDeploy={(p) => { setPlan(p); next(); }} />}
      {step === 6 && <Progress appDir={appDir} onDone={next} onError={(err) => alert(`Stage ${err.stage} failed (exit ${err.exitCode}). Check the live log for details.`)} />}
      {step === 7 && <Done plan={plan} onRedeploy={() => setStep(6)} onAnother={() => { setStep(1); setInspection(null); setAnswers(null); setPlan(null); }} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build and run**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit/ui
npm run build
cd ..
./deploy-app samples/static-html
```

Click through the wizard. Should reach the Done page (or fail at provision since Firebase calls are real — that's OK for now).

- [ ] **Step 3: Commit**

```bash
git add ui/src/App.jsx
git commit -m "feat(ui): App shell, state machine, page routing"
```

---

## Task 20: Idempotent re-run — jump to Done if config exists

**Files:**
- Modify: `ui/src/App.jsx`
- Modify: `ui/server/api/brain.mjs`

- [ ] **Step 1: Add `GET /api/existing-config` endpoint to `brain.mjs`**

Add inside `mountBrain`:

```js
import { readFile } from "node:fs/promises";

app.get("/api/existing-config", async (req, res) => {
  const appDir = req.query.appDir;
  if (!appDir) return res.status(400).json({ error: "appDir required" });
  try {
    const raw = await readFile(`${appDir}/deploy-app.config.json`, "utf8");
    res.json({ existing: true, plan: JSON.parse(raw) });
  } catch {
    res.json({ existing: false });
  }
});
```

Also add to `api.js`:

```js
export async function getExistingConfig(appDir) {
  const r = await fetch(`/api/existing-config?appDir=${encodeURIComponent(appDir)}`);
  return r.json();
}
```

- [ ] **Step 2: Modify `App.jsx` to check on load**

After the `useEffect` that fetches `appDir`, add another effect:

```js
useEffect(() => {
  if (!appDir) return;
  import("./api.js").then(({ getExistingConfig }) => {
    getExistingConfig(appDir).then(({ existing, plan }) => {
      if (existing) { setPlan(plan); setStep(7); }
    });
  });
}, [appDir]);
```

- [ ] **Step 3: Verify idempotency**

```bash
./deploy-app samples/static-html
# Should jump straight to Done if config exists.
# Delete the config to start fresh:
rm samples/static-html/deploy-app.config.json
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/App.jsx ui/src/api.js ui/server/api/brain.mjs
git commit -m "feat(ui): idempotent re-run jumps to Done when config exists"
```

---

## Task 21: First-run 403 bootstrap UI flow

Detect 403 from `addFirebase` in provision and surface a bootstrap page.

**Files:**
- Modify: `stages/provision.sh`
- Modify: `ui/server/api/run-stage.mjs`
- Create: `ui/src/pages/Bootstrap.jsx`
- Modify: `ui/src/App.jsx`

- [ ] **Step 1: Modify `stages/provision.sh` to emit a structured sentinel on 403**

Find the `firebase projects:create` invocation. Wrap it:

```bash
if [ "$PROJECT_EXISTS" = "yes" ]; then
  echo "▸ Project $PROJECT_ID already exists; reusing"
else
  echo "▸ Creating Firebase project: $PROJECT_ID"
  set +e
  CREATE_OUTPUT=$(firebase projects:create "$PROJECT_ID" --display-name "$PROJECT_ID" 2>&1)
  CREATE_EXIT=$?
  set -e
  echo "$CREATE_OUTPUT"
  if [ $CREATE_EXIT -ne 0 ]; then
    if echo "$CREATE_OUTPUT" | grep -q "PERMISSION_DENIED\|caller does not have permission"; then
      echo "DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP"
    fi
    exit $CREATE_EXIT
  fi
fi
```

- [ ] **Step 2: Modify `ui/server/api/run-stage.mjs` to recognize sentinel**

Inside `runStage`, after `handleChunk` reads a line, also scan for the sentinel:

```js
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
```

- [ ] **Step 3: Create `Bootstrap.jsx`**

```jsx
// ui/src/pages/Bootstrap.jsx
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";

export default function Bootstrap({ onRetry }) {
  const url = "https://console.firebase.google.com/?createProject";
  return (
    <Card title="One-time Firebase setup needed"
          sub="Your Google account hasn't accepted Firebase's Terms of Service yet. Google requires the very first Firebase project on an account to be created through the console UI.">
      <ol style={{paddingLeft:20,lineHeight:1.8}}>
        <li>Click the button below — it opens the Firebase Console.</li>
        <li>Create any project (you can call it <code className="codepath">bootstrap</code>; you can delete it after).</li>
        <li>Accept the Firebase Terms of Service when prompted.</li>
        <li>Come back to this tab and click "I've finished — retry".</li>
      </ol>
      <div className="btn-row split">
        <Button variant="secondary" onClick={() => window.open(url, "_blank")}>Open Firebase Console ↗</Button>
        <Button onClick={onRetry}>I've finished — retry</Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Modify `App.jsx` to handle NEEDS_BOOTSTRAP**

Update `onError` handler on the Progress page:

```jsx
{step === 6 && <Progress appDir={appDir} onDone={next}
  onError={(err) => {
    if (err.code === "NEEDS_BOOTSTRAP") setStep(8);
    else alert(`Stage ${err.stage} failed (exit ${err.exitCode}).`);
  }} />}
{step === 8 && <Bootstrap onRetry={() => setStep(6)} />}
```

Also pass `code` through from `runStage` to `onError`:

In `api.js`'s `runStage`, the `error` event already carries `{ code, message }`. Verify it's reaching the page.

In `Progress.jsx`, update the `onError` call from the stage loop:

```js
const result = await runStage(stage.id, appDir, {
  onLog: (line) => /* ... */,
  onError: (data) => {
    setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "error" } }));
    onError?.({ stage: stage.id, ...data });
  },
});
if (result.exitCode !== 0) return;
```

- [ ] **Step 5: Commit**

```bash
git add stages/provision.sh ui/server/api/run-stage.mjs ui/src/pages/Bootstrap.jsx ui/src/pages/Progress.jsx ui/src/App.jsx
git commit -m "feat: detect first-run 403 and surface bootstrap page"
```

---

## Task 22: Update toolkit README to mention the UI

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README Usage section**

Replace the Usage section with:

```markdown
## Usage

From inside this folder:

```bash
./deploy-app /path/to/your/app
```

A browser tab opens with a wizard that walks you through everything — checking your tools, asking a few plain-language questions, and deploying. No terminal needed past the first command.

Power users can fall back to the terminal-only flow:

```bash
./deploy-app /path/to/your/app --cli
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): describe wizard UI as default usage"
```

---

## Task 23: End-to-end smoke test (manual)

- [ ] **Step 1: Clean any prior state**

```bash
cd /Users/mauriciospalletti/Documents/personal/deploy-toolkit
rm -f samples/static-html/{deploy-app.config.json,firebase-debug.log,firebase.json,.firebaserc}
rm -rf samples/static-html/.firebase
```

- [ ] **Step 2: Run the UI wizard**

```bash
./deploy-app samples/static-html
```

Browser opens. Click through:
- Welcome → Get started
- Preflight (all green)
- Inspector → Yes, that's right
- Questions: name `ui-smoke-test`, both radios `No`
- Plan summary → Deploy
- Progress (watch all three stages green)
- Done — click the URL, confirm "Hi" appears

- [ ] **Step 3: Verify idempotency**

```bash
./deploy-app samples/static-html
```

Should jump straight to Done page with the same URL.

- [ ] **Step 4: Verify CLI still works**

```bash
rm -f samples/static-html/{deploy-app.config.json,firebase-debug.log,firebase.json,.firebaserc}
./deploy-app samples/static-html --cli
```

Should run the existing terminal flow.

- [ ] **Step 5: Document the smoke result**

Update `docs/HOW_IT_WORKS.md` "Common failure modes" with anything you hit. Note the live URL of the smoke deploy.

```bash
git add docs/HOW_IT_WORKS.md
git commit -m "docs: smoke-test results for UI wizard end-to-end"
```

---

## Self-Review

Spec coverage check (§ refers to UI spec):

- §6.1 directory layout — Tasks 2, 4, 5-8 cover server; Tasks 3, 9-19 cover frontend ✅
- §6.2 request flow (bash → UI server → browser) — Task 1, Task 4 ✅
- §6.3 six API endpoints — Tasks 5, 6, 7, 8 (preflight, inspect, plan, run-stage, login, quit) ✅
- §6.4 session state (single in-memory, no persistence) — Task 19 (App shell) implicitly; idempotent reload Task 20 ✅
- §7 seven wizard pages — Tasks 12-18 ✅
- §8 edge cases — first-run 403 Task 21, wrong account Task 13, login flow Task 13, error mid-deploy Task 17/19, port conflict Task 4 ✅
- §9 aesthetic + components — Tasks 3, 9, 10 ✅
- §10 validation criteria — Task 23 ✅

Placeholder scan: every code step has full code. No TBD / "add tests for the above" / similar.

Type consistency:
- `inspection` shape (`framework`, `outputDir`, `hasBackend`, `envKeys`, `suggestedShape`, `pkgName`) — consistent across `brain.mjs` (Task 6), `Inspector.jsx` (Task 14), `Questions.jsx` (Task 15) ✅
- `answers` shape (`appName`, `needsAuth`, `needsDb`, `shape`, `secretKeys`) — consistent across `Questions.jsx` (Task 15), `brain.mjs` (Task 6) ✅
- `plan` shape (`appName`, `shape`, `firebase.projectId`, `hosting.publicDir`, `auth`, `firestore`, `functions`, `build`) — consistent across `brain.mjs` (Task 6), `PlanSummary.jsx` (Task 16), `Done.jsx` (Task 18), `App.jsx` (Task 19) ✅
- SSE event shape (`log` with `{line}`, `done` with `{exitCode}`, `error` with `{code, message}`) — consistent across `run-stage.mjs` (Task 7), `api.js` (Task 11), `Progress.jsx` (Task 17), `App.jsx` (Task 21) ✅
