import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runInitProject } from "../api.js";

const PROJECT_NAME_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export default function ScratchSetup({ parentDir, onBack, onDone }) {
  const [projectName, setProjectName] = useState("");
  const [phase, setPhase] = useState("input"); // "input" | "running" | "done"
  const [lines, setLines] = useState([]);
  const [stageStatus, setStageStatus] = useState("idle");
  const [result, setResult] = useState(null);

  async function start() {
    setPhase("running");
    setStageStatus("running");
    let scratchResult = null;
    const { exitCode } = await runInitProject(parentDir, projectName, {
      onLog: (line) => setLines(l => [...l, line]),
      onScratchDone: (data) => { scratchResult = data; },
      onError: () => setStageStatus("error"),
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
    const repoUrl = result?.repoUrl;
    const firebaseUrl = `https://console.firebase.google.com/project/${result?.projectName || projectName}`;
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

  if (phase === "running") {
    return (
      <Card
        title="Setting up your project…"
        sub="Initializing git, creating GitHub repo, and creating Firebase project."
      >
        <StageCard
          name={`Setting up ${projectName}`}
          status={stageStatus}
          lines={lines}
          open
        />
        {stageStatus === "error" && (
          <div className="btn-row" style={{ marginTop: 16 }}>
            <Button variant="secondary" onClick={() => { setPhase("input"); setLines([]); setStageStatus("idle"); }}>
              Try again
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const valid = PROJECT_NAME_RE.test(projectName);

  return (
    <Card
      title="Let's set up your project"
      sub="We'll create a git repository, a private GitHub repo, and a Firebase project — all under this name."
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
        <Button onClick={start} disabled={!valid}>Set up project</Button>
      </div>
    </Card>
  );
}
