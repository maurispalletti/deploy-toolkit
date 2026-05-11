import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import { postInspect } from "../api.js";

export default function Inspector({ appDir, onBack, onConfirm }) {
  const [data, setData] = useState(null);
  useEffect(() => { postInspect(appDir).then(setData); }, [appDir]);

  if (!data) return <Card title="Looking at your app…" sub="" />;

  const shapeLabel = data.suggestedShape === "C"
    ? "frontend + backend (Shape C)"
    : data.suggestedShape === "A"
      ? "static frontend only (Shape A)"
      : "frontend + optional Firebase services (Shape A or B)";

  return (
    <Card title={data.framework === "none" ? "Looks like a plain static app" : `Looks like a ${data.framework} app`}
          sub="Here's what I see in your folder. Adjust if anything's off.">
      <dl className="insp-grid">
        <dt>Framework</dt><dd>{data.framework}</dd>
        <dt>Build output</dt><dd><code className="codepath">{data.outputDir || "(none — won't build)"}</code></dd>
        <dt>Backend code</dt><dd>{data.hasBackend ? "Yes — Shape C" : "No"}</dd>
        <dt>Suggested shape</dt><dd>{shapeLabel}</dd>
        {data.envKeys?.length > 0 && (
          <>
            <dt>Detected secrets</dt>
            <dd>{data.envKeys.map(k => <code key={k} className="codepath" style={{marginRight:6}}>{k}</code>)}</dd>
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
