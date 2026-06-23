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

export async function postSetupDevTools() {
  const r = await fetch("/api/setup-dev-tools", { method: "POST" });
  return r.json();
}

export async function postLogin() {
  const r = await fetch("/api/login", { method: "POST" });
  return r.json();
}

export async function pickFolder() {
  const r = await fetch("/api/pick-folder", { method: "POST" });
  return r.json();
}

export async function postQuit() {
  try { await fetch("/api/quit", { method: "POST" }); } catch {}
}

export async function getExistingConfig(appDir) {
  const r = await fetch(`/api/existing-config?appDir=${encodeURIComponent(appDir)}`);
  return r.json();
}

// Writes REFACTOR-FOR-FIREBASE.md into the app folder using the detection
// output from the most recent inspect() call. Returns { path } on success.
export async function generateDbRefactorPrompt(appDir, inspection) {
  const r = await fetch("/api/refactor-prompt/db", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appDir, inspection }),
  });
  if (!r.ok) throw new Error(`refactor-prompt ${r.status}`);
  return r.json();
}

// Writes REFACTOR-SECRETS.md into the app folder using the secrets
// detection output. Returns { path, content }.
export async function generateSecretsRefactorPrompt(appDir, inspection) {
  const r = await fetch("/api/refactor-prompt/secrets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appDir, inspection }),
  });
  if (!r.ok) throw new Error(`refactor-prompt ${r.status}`);
  return r.json();
}

// Writes REFACTOR-FOR-AUTH.md into the app folder using the wizard's
// known projectId + framework (and an optional SDK config). Returns
// { path, content }. The AuthRefactorPrompt page calls this with the
// minimum it knows about the app — there's no need to ship the full
// inspection because the prompt's content is bounded by the auth
// recipe, not by detected code.
export async function generateAuthRefactorPrompt(appDir, payload = {}) {
  const r = await fetch("/api/refactor-prompt/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appDir, ...payload }),
  });
  if (!r.ok) throw new Error(`refactor-prompt ${r.status}`);
  return r.json();
}

// Runs the init-project stage for "start from scratch" mode.
// Streams log lines, calls onScratchDone({ projectName, appDir, repoUrl }) on success.
export function runInitProject(parentDir, projectName, { onLog, onScratchDone, onError }) {
  return new Promise((resolve) => {
    const url = `/api/init-project?parentDir=${encodeURIComponent(parentDir)}&projectName=${encodeURIComponent(projectName)}`;
    const es = new EventSource(url);
    es.addEventListener("log", (e) => {
      const { line } = JSON.parse(e.data);
      onLog?.(line);
    });
    es.addEventListener("scratch-done", (e) => {
      onScratchDone?.(JSON.parse(e.data));
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
