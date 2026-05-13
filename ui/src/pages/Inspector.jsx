import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import { postInspect } from "../api.js";

export default function Inspector({ appDir, onBack, onConfirm }) {
  const [data, setData] = useState(null);
  useEffect(() => { postInspect(appDir).then(setData); }, [appDir]);

  if (!data) return <Card title="Taking a look at your app…" sub="One moment while we figure out what we're working with." />;

  const FRAMEWORK_LABEL = {
    "vite-react": "React app (built with Vite)",
    "cra": "React app (Create React App)",
    "nextjs": "Next.js app",
    "express": "Node.js + Express app",
    "unknown": "JavaScript app (framework we don't recognize)",
    "none": "Plain HTML/CSS/JS (no build step)"
  };
  const frameworkLabel = FRAMEWORK_LABEL[data.framework] ?? data.framework;

  const shapeLabel = data.suggestedShape === "C"
    ? "Has a server too — we'll deploy both pieces (Shape C)"
    : data.suggestedShape === "A"
      ? "Website only, no server — simplest setup (Shape A)"
      : "Website + optional Firebase features like sign-in or a database (Shape A or B)";

  const titleByFramework = data.framework === "none"
    ? "It's a plain web page"
    : `It looks like a ${frameworkLabel}`;

  return (
    <Card
      title={titleByFramework}
      sub="Here's what we figured out by peeking at your folder. If anything looks off, hit Back and we'll re-check. Otherwise, hit Yes and we'll move on."
    >
      <dl className="insp-grid">
        <dt>What it is</dt>
        <dd>{frameworkLabel}<div className="insp-hint">How your app is built — tells us how to package it.</div></dd>

        <dt>Where the built files go</dt>
        <dd>
          <code className="codepath">{data.outputDir || "(no build step needed)"}</code>
          <div className="insp-hint">The folder we'll upload to the internet.</div>
        </dd>

        <dt>Has a server?</dt>
        <dd>
          {data.hasBackend ? "Yes" : "No"}
          <div className="insp-hint">
            {data.hasBackend
              ? "We see backend code (Express or similar). We'll deploy it too."
              : "Your app runs entirely in the browser — no server needed."}
          </div>
        </dd>

        <dt>Best fit for Firebase</dt>
        <dd>{shapeLabel}<div className="insp-hint">Our recommendation for how to deploy this.</div></dd>

        {data.envKeys?.length > 0 && (
          <>
            <dt>Config values we noticed</dt>
            <dd>
              {data.envKeys.map(k => <code key={k} className="codepath" style={{marginRight:6}}>{k}</code>)}
              <div className="insp-hint">
                We found these in your <code className="codepath">.env.example</code>. They're variables your app reads at build time.
              </div>
            </dd>
          </>
        )}
      </dl>
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={() => onConfirm(data)}>Yes, that's right</Button>
      </div>
    </Card>
  );
}
