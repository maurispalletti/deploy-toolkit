import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runInitProject } from "../api.js";

const PROJECT_NAME_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

const ERROR_GUIDANCE = {
  GITHUB_REPO_EXISTS: {
    retryLabel: "Pick a different name",
  },
  GITHUB_AUTH_FAILED: {
    retryLabel: "Go back and sign in",
  },
};

function ErrorBanner({ errorInfo, onRetry }) {
  const message = errorInfo?.message || "Something went wrong — check the output above for details.";
  const guidance = ERROR_GUIDANCE[errorInfo?.code] ?? {};
  return (
    <div style={{ marginTop: 16 }}>
      <div className="warning-banner">
        <div className="warning-icon">✗</div>
        <div className="warning-body">
          <div className="warning-title">Setup failed</div>
          <div className="warning-text">
            {message}
            {guidance.href && (
              <>{" "}<a className="link" href={guidance.href} target="_blank" rel="noreferrer">{guidance.action}</a>, then try again.</>
            )}
          </div>
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <Button variant="secondary" onClick={onRetry}>
          {guidance.retryLabel ?? "Try again"}
        </Button>
      </div>
    </div>
  );
}

export default function ScratchSetup({ parentDir, onBack, onProjectCreated }) {
  const [projectName, setProjectName] = useState("");
  const [phase, setPhase] = useState("input"); // "input" | "running" | "done"
  const [lines, setLines] = useState([]);
  const [stageStatus, setStageStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);

  async function start() {
    setPhase("running");
    setStageStatus("running");
    setErrorInfo(null);
    let scratchResult = null;
    const { exitCode } = await runInitProject(parentDir, projectName, {
      onLog: (line) => setLines(l => [...l, line]),
      onScratchDone: (data) => { scratchResult = data; },
      onError: (err) => { setErrorInfo(err); setStageStatus("error"); },
    });
    if (exitCode === 0) {
      setStageStatus("done");
      setResult(scratchResult);
      setPhase("done");
    } else {
      setStageStatus("error");
    }
  }

  function handleNameChange(e) {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setProjectName(raw);
  }

  if (phase === "done") {
    const appDir = result?.appDir || `${parentDir}/${projectName}`;
    const repoUrl = result?.repoUrl || "";
    const resolvedName = result?.projectName || projectName;
    return (
      <Card title="GitHub repository created">
        <p className="card-sub">
          Your local git repo is initialised and the code is pushed to GitHub.
          Next we'll create the Firebase project.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
          <div>
            <span className="muted">Folder:&nbsp;</span>
            <code className="codepath">{appDir}</code>
          </div>
          {repoUrl && (
            <div>
              <span className="muted">GitHub:&nbsp;</span>
              <a className="link" href={repoUrl} target="_blank" rel="noreferrer">{repoUrl}</a>
            </div>
          )}
        </div>
        <div className="btn-row">
          <Button onClick={() => onProjectCreated(resolvedName, appDir, repoUrl)}>
            Continue to Firebase
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === "running") {
    return (
      <Card
        title="Setting up your project…"
        sub="Initializing git repository and creating GitHub repo."
      >
        <StageCard
          name={`Setting up ${projectName}`}
          status={stageStatus}
          lines={lines}
          open
        />
        {stageStatus === "error" && (
          <ErrorBanner errorInfo={errorInfo} onRetry={() => { setPhase("input"); setLines([]); setStageStatus("idle"); setErrorInfo(null); }} />
        )}
      </Card>
    );
  }

  const valid = PROJECT_NAME_RE.test(projectName);

  return (
    <Card
      title="Let's set up your project"
      sub="We'll create a local git repository and a private GitHub repo under this name. Firebase comes next."
    >
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
          Project name
        </label>
        <input
          type="text"
          value={projectName}
          onChange={handleNameChange}
          placeholder="my-cool-app"
          autoFocus
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Lowercase letters, numbers, and hyphens. 6–30 characters. Must be globally
          unique on Firebase (you'll see an error if it's taken).
        </p>
      </div>

      <div className="btn-row split">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={start} disabled={!valid}>Continue</Button>
      </div>
    </Card>
  );
}
