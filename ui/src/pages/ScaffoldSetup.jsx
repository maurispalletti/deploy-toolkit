import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runInitScaffold } from "../api.js";

function ErrorBanner({ errorInfo, onRetry }) {
  const message = errorInfo?.message || "Something went wrong — check the output above for details.";
  return (
    <div style={{ marginTop: 16 }}>
      <div className="warning-banner">
        <div className="warning-icon">✗</div>
        <div className="warning-body">
          <div className="warning-title">Scaffold failed</div>
          <div className="warning-text">{message}</div>
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <Button variant="secondary" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

function CmdRow({ label, cmd }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span className="muted" style={{ minWidth: 120 }}>{label}</span>
      <code className="codepath">{cmd}</code>
    </div>
  );
}

export default function ScaffoldSetup({ projectName, appDir, repoUrl, onDone }) {
  const [phase, setPhase] = useState("running"); // "running" | "done" | "error"
  const [lines, setLines] = useState([]);
  const [stageStatus, setStageStatus] = useState("running");
  const [errorInfo, setErrorInfo] = useState(null);

  async function run() {
    setPhase("running");
    setStageStatus("running");
    setLines([]);
    setErrorInfo(null);
    const { exitCode } = await runInitScaffold(appDir, projectName, {
      onLog: (line) => setLines(l => [...l, line]),
      onScaffoldDone: () => {},
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
    const authUrl = `https://console.firebase.google.com/project/${projectName}/authentication/providers`;
    const firebaseUrl = `https://console.firebase.google.com/project/${projectName}`;
    return (
      <Card title="Your app is ready">
        <p className="card-sub">
          Next.js 14, Firebase, Shadcn UI, and TanStack Query are all wired up.
          One manual step, then run <code className="codepath">npm run dev</code>.
        </p>

        <div className="warning-banner" style={{ marginTop: 16 }}>
          <div className="warning-icon">!</div>
          <div className="warning-body">
            <div className="warning-title">Enable Google Sign-In</div>
            <div className="warning-text">
              Open{" "}
              <a className="link" href={authUrl} target="_blank" rel="noreferrer">
                Firebase Console → Authentication → Sign-in method
              </a>
              , enable <strong>Google</strong>, and save. The app won't load until this is done.
            </div>
          </div>
        </div>

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
          <div>
            <span className="muted">Firebase:&nbsp;</span>
            <a className="link" href={firebaseUrl} target="_blank" rel="noreferrer">{firebaseUrl}</a>
          </div>
        </div>

        <div style={{
          background: "var(--surface-2, #f6f8fa)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          margin: "16px 0",
        }}>
          <CmdRow label="Run locally:" cmd="npm run dev" />
          <CmdRow label="Build + deploy:" cmd="npm run build" />
          <CmdRow label="Add UI components:" cmd="npx shadcn add <component>" />
        </div>

        <div className="btn-row">
          <Button onClick={() => onDone(appDir)}>Done</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Scaffolding your app…"
      sub="Creating Next.js 14 project, installing packages, and wiring up Firebase."
    >
      <StageCard
        name={`Scaffold — ${projectName}`}
        status={stageStatus}
        lines={lines}
        open
      />
      {phase === "error" && (
        <ErrorBanner errorInfo={errorInfo} onRetry={run} />
      )}
    </Card>
  );
}
