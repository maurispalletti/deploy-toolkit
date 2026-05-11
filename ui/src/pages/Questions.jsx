import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import RadioRow from "../components/RadioRow.jsx";

const yesNo = [{value:"yes",label:"Yes"},{value:"no",label:"No"}];

export default function Questions({ inspection, defaults, onBack, onNext }) {
  const [appName, setAppName] = useState(defaults?.appName ?? inspection?.pkgName ?? "my-app");
  const [needsAuth, setNeedsAuth] = useState(defaults?.needsAuth ? "yes" : "no");
  const [needsDb, setNeedsDb] = useState(defaults?.needsDb ? "yes" : "no");

  function submit() {
    const shape = inspection.suggestedShape === "C"
      ? "C"
      : (needsAuth === "yes" || needsDb === "yes" ? "B" : "A");
    onNext({
      appName,
      needsAuth: needsAuth === "yes",
      needsDb: needsDb === "yes",
      shape,
      secretKeys: inspection.envKeys || [],
    });
  }

  return (
    <Card title="A few quick questions"
          sub="These help us pick the right Firebase setup for your app.">
      <div className="field">
        <label>What name for this app?</label>
        <input type="text" value={appName} onChange={e => setAppName(e.target.value)} />
        <div className="help">Used as your Firebase project ID. We'll add a small random suffix.</div>
      </div>
      <div className="field">
        <label>Will users need to sign in?</label>
        <RadioRow name="auth" value={needsAuth} onChange={setNeedsAuth} options={yesNo} />
        <div className="help">
          If yes, we'll enable Google sign-in for your project. You'll need to add Firebase Auth code to your app yourself — we'll link you to a guide on the Done page.
        </div>
      </div>
      <div className="field">
        <label>Does the app need to remember things between visits?</label>
        <RadioRow name="db" value={needsDb} onChange={setNeedsDb} options={yesNo} />
        <div className="help">If yes, we'll set up Firestore with locked-down default rules.</div>
      </div>
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={submit}>Continue</Button>
      </div>
    </Card>
  );
}
