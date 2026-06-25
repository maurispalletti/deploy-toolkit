import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";

export default function Questions({ appDir, inspection, defaults, onBack, onNext }) {
  const folder = appDir
    ? appDir.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? ""
    : "";
  const [appName, setAppName] = useState((defaults?.appName ?? inspection?.pkgName ?? folder) || "my-app");

  function submit() {
    const shape = inspection.suggestedShape === "C" ? "C" : "B";
    onNext({ appName, needsAuth: true, needsDb: true, shape, secretKeys: inspection.envKeys || [] });
  }

  return (
    <Card
      title="What should we call your app?"
      sub="This becomes your Firebase project ID and web address."
    >
      <div className="field">
        {defaults?.existingProject ? (
          <>
            <input type="text" value={appName} readOnly style={{ opacity: 0.6, cursor: "default" }} />
            <div className="help">
              We found an existing Firebase project <code className="codepath">{appName}</code> that matches this folder. We'll deploy to it instead of creating a new one.
            </div>
          </>
        ) : (
          <>
            <input type="text" value={appName} onChange={e => setAppName(e.target.value)} />
            <div className="help">
              <code className="codepath">{appName || "my-app"}.web.app</code>
            </div>
          </>
        )}
      </div>

      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={submit}>Continue</Button>
      </div>
    </Card>
  );
}
