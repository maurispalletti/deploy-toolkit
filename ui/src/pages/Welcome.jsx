import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { pickFolder } from "../api.js";

export default function Welcome({ appDir, onAppDirChange, onNext, onScratch }) {
  const [subStep, setSubStep] = useState(0);
  const [folder, setFolder] = useState(appDir || "");
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);

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
          <Button onClick={() => setSubStep(1)} disabled={!hasFolder}>Next</Button>
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
        <button
          className="choice-card"
          onClick={() => {
            onAppDirChange(folder);
            onNext();
          }}
        >
          <div className="choice-icon">🚀</div>
          <div className="choice-body">
            <div className="choice-title">Publish an existing app</div>
            <div className="choice-meta">Your app is already built — let's put it on the internet.</div>
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
