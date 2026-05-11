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
    <Card title="Let's get your app on the internet"
          sub="We'll set up Firebase Hosting, ask a few quick questions, and deploy.">

      {hasAppDir ? (
        <StatusRow
          state="ok"
          title="App folder selected"
          meta={<span className="codepath">{appDir}</span>}
          action={<a className="link" onClick={browse}>Choose different</a>}
        />
      ) : (
        <StatusRow
          state="pending"
          title="No app folder selected yet"
          meta="Pick the folder of the app you want to deploy."
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
          Or use the CLI: <code className="codepath">./deploy-app /path/to/app --cli</code>
        </span>
        <Button onClick={onNext} disabled={!hasAppDir}>Get started</Button>
      </div>
    </Card>
  );
}
