import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { pickFolder } from "../api.js";

export default function Welcome({ appDir, onAppDirChange, onNext, onScratch }) {
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);
  const [scratchMode, setScratchMode] = useState(false);
  const [parentDir, setParentDir] = useState("");

  async function browse() {
    setError(null);
    setPicking(true);
    try {
      const result = await pickFolder();
      if (result.path) {
        if (scratchMode) setParentDir(result.path);
        else onAppDirChange(result.path);
      } else if (result.error) setError(result.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setPicking(false);
    }
  }

  const hasAppDir = appDir && appDir.length > 0;
  const hasParentDir = parentDir && parentDir.length > 0;

  if (scratchMode) {
    return (
      <Card
        title="Start a new project"
        sub="Pick the folder where you'd like to create your project. We'll make a subfolder for it there."
      >
        {hasParentDir ? (
          <StatusRow
            state="ok"
            title="Got it — project folder will be created here"
            meta={<span className="codepath">{parentDir}</span>}
            action={<a className="link" onClick={browse}>Change</a>}
          />
        ) : (
          <StatusRow
            state="pending"
            title="Where do you want to create your project?"
            meta="Pick any folder on your computer (e.g. your Documents or Projects folder)."
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

        <div className="btn-row split">
          <Button variant="secondary" onClick={() => { setScratchMode(false); setParentDir(""); setError(null); }}>
            Back
          </Button>
          <Button onClick={() => onScratch(parentDir)} disabled={!hasParentDir}>
            Get started
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Let's get your app online"
      sub="We'll put your app on the internet using Firebase (Google's free hosting service). We ask a few quick questions, then handle all the setup for you."
    >

      {hasAppDir ? (
        <StatusRow
          state="ok"
          title="Got it — we'll deploy this folder"
          meta={<span className="codepath">{appDir}</span>}
          action={<a className="link" onClick={browse}>Change folder</a>}
        />
      ) : (
        <StatusRow
          state="pending"
          title="Which folder is your app in?"
          meta="Pick the folder where your app's code lives (the one with index.html or package.json inside)."
          action={
            <Button variant="secondary" onClick={browse} disabled={picking}>
              {picking ? "Opening picker…" : "Pick folder"}
            </Button>
          }
        />
      )}

      {error && (
        <div className="muted" style={{marginTop:12, fontSize:13, color:"var(--red)"}}>
          {error}
        </div>
      )}

      <div className="btn-row split">
        <span className="muted" style={{fontSize:13}}>
          Starting fresh?{" "}
          <a className="link" onClick={() => setScratchMode(true)} style={{cursor:"pointer"}}>
            Set up a new project
          </a>
          {" · "}
          CLI mode: <code className="codepath">./deploy-app /path --cli</code>
        </span>
        <Button onClick={onNext} disabled={!hasAppDir}>Get started</Button>
      </div>
    </Card>
  );
}
