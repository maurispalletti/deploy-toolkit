import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runInitProject } from "../api.js";

const ERROR_GUIDANCE = {
  GITHUB_REPO_EXISTS: {
    retryLabel: "Go back and pick a different name",
    goBack: true,
  },
  GITHUB_AUTH_FAILED: {
    retryLabel: "Go back and sign in",
    goBack: true,
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
          <div className="warning-title">GitHub setup failed</div>
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
          <Button variant="secondary" onClick={onRetry}>{guidance?.retryLabel ?? "Try again"}</Button>
        )}
      </div>
    </div>
  );
}

export default function GitHubSetup({ projectName, parentDir, onBack, onDone }) {
  const [phase, setPhase] = useState("running"); // "running" | "done" | "error"
  const [lines, setLines] = useState([]);
  const [stageStatus, setStageStatus] = useState("running");
  const [errorInfo, setErrorInfo] = useState(null);
  const [result, setResult] = useState(null);

  async function run() {
    setPhase("running");
    setStageStatus("running");
    setLines([]);
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
      setPhase("error");
    }
  }

  useEffect(() => { run(); }, []);

  if (phase === "done") {
    const appDir = result?.appDir || `${parentDir}/${projectName}`;
    const repoUrl = result?.repoUrl || "";
    return (
      <Card title="GitHub repository created">
        <p className="card-sub">
          Your local git repo is initialised and the code is pushed to GitHub.
          Next we'll scaffold your app.
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
          <Button onClick={() => onDone(result?.projectName || projectName, appDir, repoUrl)}>
            Continue to scaffold
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Creating GitHub repository…"
      sub="Initialising git repository and pushing to GitHub."
    >
      <StageCard
        name={`GitHub — ${projectName}`}
        status={stageStatus}
        lines={lines}
        open
      />
      {phase === "error" && (
        <ErrorBanner
          errorInfo={errorInfo}
          onRetry={run}
          onBack={onBack}
        />
      )}
    </Card>
  );
}
