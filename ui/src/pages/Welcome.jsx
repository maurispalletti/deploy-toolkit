import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { pickFolder } from "../api.js";

export default function Welcome({ appDir, onAppDirChange, onNext }) {
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);

  async function browse() {
    setError(null);
    setPicking(true);
    try {
      const result = await pickFolder();
      if (result.path) onAppDirChange(result.path);
      else if (result.error) setError(result.error);
      // cancelled: just stay on this page
    } catch (err) {
      setError(err.message);
    } finally {
      setPicking(false);
    }
  }

  const hasAppDir = appDir && appDir.length > 0;

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
          Comfortable with a terminal? Try CLI mode: <code className="codepath">./deploy-app /path --cli</code>
        </span>
        <Button onClick={onNext} disabled={!hasAppDir}>Get started</Button>
      </div>
    </Card>
  );
}
