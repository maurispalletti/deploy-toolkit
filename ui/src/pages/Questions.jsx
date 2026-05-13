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
    <Card
      title="A few quick questions about your app"
      sub="Three things to know so we set Firebase up the right way. There are no wrong answers — you can always come back and change them."
    >
      <div className="field">
        <label>What should we call your app?</label>
        <input type="text" value={appName} onChange={e => setAppName(e.target.value)} />
        <div className="help">
          This becomes part of your web address: <code className="codepath">{appName || "my-app"}-xxxx.web.app</code>.
          We add a few random letters at the end so it's unique on Firebase.
        </div>
      </div>

      <div className="field">
        <label>Do people need to sign in to use your app?</label>
        <RadioRow name="auth" value={needsAuth} onChange={setNeedsAuth} options={yesNo} />
        <div className="help">
          {needsAuth === "yes"
            ? <>Got it — we'll turn on Google sign-in for your Firebase project. <strong>Heads up:</strong> you'll need to add a sign-in button to your app's code yourself. We'll point you to a guide on the last screen.</>
            : "Pick this if anyone with the link should be able to use your app without logging in."}
        </div>
      </div>

      <div className="field">
        <label>Does your app need to save data between visits?</label>
        <RadioRow name="db" value={needsDb} onChange={setNeedsDb} options={yesNo} />
        <div className="help">
          {needsDb === "yes"
            ? "We'll set up Firestore — Firebase's online database — with safe defaults (only signed-in users can read and write their own data)."
            : "Pick this if your app doesn't need to remember anything (e.g. a calculator, a static landing page, a one-off form that emails you the answer)."}
        </div>
      </div>

      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={submit}>Continue</Button>
      </div>
    </Card>
  );
}
