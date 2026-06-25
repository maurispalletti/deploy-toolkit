import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { pickFolder, getResumeConfig, getFirebaseProjects } from "../api.js";

export default function Welcome({ appDir, onAppDirChange, onNext, onScratch, onContinue }) {
  const [subStep, setSubStep] = useState(0);
  const [folder, setFolder] = useState(appDir || "");
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resumeInfo, setResumeInfo] = useState(null);
  const [checkedProject, setCheckedProject] = useState(null);

  async function browse() {
    setError(null);
    setPicking(true);
    try {
      const result = await pickFolder();
      if (result.path) setFolder(result.path);
      else if (result.error) setError(result.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setPicking(false);
    }
  }

  async function handleNext() {
    setChecking(true);
    try {
      const folderBase = folder.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? "";
      const [info, { projectIds }] = await Promise.all([
        getResumeConfig(folder).catch(() => ({})),
        getFirebaseProjects().catch(() => ({ projectIds: [] })),
      ]);
      const hasPriorWork = !!(info.firebaseProjectId || info.githubRepoUrl);
      setResumeInfo(hasPriorWork ? info : null);
      // Check if the folder name matches an existing Firebase project.
      const matchedProject = projectIds.some(id => id.toLowerCase() === folderBase.toLowerCase())
        ? folderBase
        : null;
      setCheckedProject(matchedProject);
    } catch {
      setResumeInfo(null);
      setCheckedProject(null);
    } finally {
      setChecking(false);
      setSubStep(1);
    }
  }

  const hasFolder = !!folder;

  if (subStep === 0) {
    return (
      <Card
        title="Let's get your app online"
        sub="Start by picking the folder you want to work with."
      >
        {hasFolder ? (
          <StatusRow
            state="ok"
            title="Folder selected"
            meta={<span className="codepath">{folder}</span>}
            action={<a className="link" onClick={browse} style={{ cursor: "pointer" }}>Change</a>}
          />
        ) : (
          <StatusRow
            state="pending"
            title="Which folder do you want to work with?"
            meta="This can be an existing app or any folder where you'd like to create a new project."
            action={
              <Button variant="secondary" onClick={browse} disabled={picking}>
                {picking ? "Opening picker…" : "Pick folder"}
              </Button>
            }
          />
        )}
        {error && (
          <div className="muted" style={{ marginTop: 12, fontSize: 13, color: "var(--red)" }}>
            {error}
          </div>
        )}
        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
          <Button onClick={handleNext} disabled={!hasFolder || checking}>
            {checking ? "Checking…" : "Next"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="What would you like to do?"
      sub={<span className="codepath">{folder}</span>}
    >
      <div className="choice-list">
        {resumeInfo && (
          <button
            className="choice-card recommended"
            onClick={() => {
              onAppDirChange(folder);
              onContinue(resumeInfo);
            }}
          >
            <div className="choice-icon">🔁</div>
            <div className="choice-body">
              <div className="choice-title">
                Continue this project
                <span className="choice-tag">{resumeInfo.hasConfig ? "Previously deployed" : "Existing project"}</span>
              </div>
              <div className="choice-meta">
                {resumeInfo.hasConfig
                  ? "Pick up where you left off — re-deploy or enable new Firebase services like Firestore and Auth."
                  : "We found an existing repo. Finish setting up deployment for this project."}
              </div>
            </div>
          </button>
        )}
        <button
          className="choice-card"
          onClick={() => {
            onAppDirChange(folder);
            onNext({ existingProject: !!checkedProject, existingProjectId: checkedProject });
          }}
        >
          <div className="choice-icon">🚀</div>
          <div className="choice-body">
            <div className="choice-title">Publish an existing app</div>
            <div className="choice-meta">
              {resumeInfo
                ? "Run the full wizard again from scratch."
                : "Your app is already built — let's put it on the internet."}
            </div>
          </div>
        </button>
        <button
          className="choice-card"
          onClick={() => onScratch(folder)}
        >
          <div className="choice-icon">✨</div>
          <div className="choice-body">
            <div className="choice-title">Start from scratch</div>
            <div className="choice-meta">Create a brand-new project with hosting, a database, and sign-in set up from day one.</div>
          </div>
        </button>
      </div>
      <div className="btn-row">
        <BackButton onClick={() => setSubStep(0)} />
      </div>
    </Card>
  );
}
