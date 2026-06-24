import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runInitGithub } from "../api.js";

const ERROR_GUIDANCE = {
  PROJECT_QUOTA_EXCEEDED: {
    action: "Delete unused projects",
    href: "https://console.cloud.google.com/iam-admin/projects",
    retryLabel: "Try again",
  },
  PROJECT_ID_TAKEN: {
    retryLabel: "Go back and pick a different name",
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
          <div className="warning-title">Firebase setup failed</div>
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

export default function GitHubSetup({ projectName, appDir, repoUrl, onBack, onDone }) {
  const [phase, setPhase] = useState("running"); // "running" | "done" | "error"
  const [lines, setLines] = useState([]);
  const [stageStatus, setStageStatus] = useState("running");
  const [errorInfo, setErrorInfo] = useState(null);

  async function run() {
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

  useEffect(() => { run(); }, []);

  if (phase === "done") {
    const firebaseUrl = `https://console.firebase.google.com/project/${projectName}`;
    return (
      <Card title="Your project is ready">
        <p className="card-sub">
          Git repository, GitHub repo, and Firebase project are all set up.
          Write your app in the folder below, then run{" "}
          <code className="codepath">./deploy-app</code> again to put it on the
          internet.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
          <div>
            <span className="muted">Folder:&nbsp;</span>
            <code className="codepath">{appDir}</code>
          </div>
          {repoUrl && (
            <div>
              <span className="muted">GitHub:&nbsp;</span>
              <a className="link" href={repoUrl} target="_blank" rel="noreferrer">
                {repoUrl}
              </a>
            </div>
          )}
          <div>
            <span className="muted">Firebase:&nbsp;</span>
            <a className="link" href={firebaseUrl} target="_blank" rel="noreferrer">
              {firebaseUrl}
            </a>
          </div>
        </div>

        <div className="btn-row">
          <Button onClick={() => onDone(appDir)}>Done</Button>
        </div>
      </Card>
    );
  }

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
      {(phase === "error") && (
        <ErrorBanner
          errorInfo={errorInfo}
          onRetry={run}
          onBack={onBack}
        />
      )}
    </Card>
  );
}
