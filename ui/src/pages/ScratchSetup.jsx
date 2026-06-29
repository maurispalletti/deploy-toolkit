import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runInitGithub } from "../api.js";

const PROJECT_NAME_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

const ERROR_GUIDANCE = {
  PROJECT_QUOTA_EXCEEDED: {
    action: "Delete unused projects",
    href: "https://console.cloud.google.com/iam-admin/projects",
    retryLabel: "Try again",
  },
  PROJECT_ID_TAKEN: {
    retryLabel: "Pick a different name",
    goBack: true,
  },
  NEEDS_BOOTSTRAP: {
    retryLabel: "Try again",
  },
  FIREBASE_CREATE_FAILED: {
    retryLabel: "Try again",
  },
};

function ErrorBanner({ errorInfo, onRetry, onBack }) {
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
        {guidance.goBack ? (
          <Button variant="secondary" onClick={onBack}>{guidance.retryLabel}</Button>
        ) : (
          <Button variant="secondary" onClick={onRetry}>{guidance.retryLabel ?? "Try again"}</Button>
        )}
      </div>
    </div>
  );
}

export default function ScratchSetup({ parentDir, onBack, onProjectCreated }) {
  const [projectName, setProjectName] = useState("");
  const [phase, setPhase] = useState("input"); // "input" | "running" | "done" | "error"
  const [lines, setLines] = useState([]);
  const [stageStatus, setStageStatus] = useState("idle");
  const [errorInfo, setErrorInfo] = useState(null);

  const appDir = `${parentDir}/${projectName}`;

  async function start() {
    setPhase("running");
    setStageStatus("running");
    setLines([]);
    setErrorInfo(null);
    const { exitCode } = await runInitGithub(appDir, projectName, {
      onLog: (line) => setLines(l => [...l, line]),
      onFirebaseDone: () => {},
      onError: (err) => { setErrorInfo(err); setStageStatus("error"); },
    });
    if (exitCode === 0) {
      setStageStatus("done");
      setPhase("done");
    } else {
      setStageStatus("error");
      setPhase("error");
    }
  }

  function handleNameChange(e) {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setProjectName(raw);
  }

  if (phase === "done") {
    const firebaseUrl = `https://console.firebase.google.com/project/${projectName}`;
    return (
      <Card title="Firebase project created">
        <p className="card-sub">
          Firebase project is ready. Next we'll set up your GitHub repository.
        </p>
        <div style={{ margin: "12px 0" }}>
          <span className="muted">Firebase:&nbsp;</span>
          <a className="link" href={firebaseUrl} target="_blank" rel="noreferrer">{firebaseUrl}</a>
        </div>
        <div className="btn-row">
          <Button onClick={() => onProjectCreated(projectName, appDir)}>Continue to GitHub</Button>
        </div>
      </Card>
    );
  }

  if (phase === "running" || phase === "error") {
    return (
      <Card
        title="Creating Firebase project…"
        sub="Setting up your Firebase project for hosting and backend services."
      >
        <StageCard
          name={`Firebase — ${projectName}`}
          status={stageStatus}
          lines={lines}
          open
        />
        {phase === "error" && (
          <ErrorBanner
            errorInfo={errorInfo}
            onRetry={start}
            onBack={() => { setPhase("input"); setLines([]); setStageStatus("idle"); setErrorInfo(null); }}
          />
        )}
      </Card>
    );
  }

  const valid = PROJECT_NAME_RE.test(projectName);

  return (
    <Card
      title="Let's set up your project"
      sub="We'll create a Firebase project first to confirm the name is available, then set up your GitHub repository."
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
