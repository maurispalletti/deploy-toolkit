import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";

// AuthScaffoldChoice (step 12). Shown when answers.needsAuth === true.
//
// Two choice cards modelled after IncompatibleApp.jsx / HardcodedSecretsBlock.jsx:
//
//   1. "Add it for me (automatic)" — recommended for known frameworks.
//      We auto-write firebase-config.js, drop SignInWithGoogle.jsx,
//      splice into App.jsx, and `npm install firebase`.
//   2. "Give me a prompt for my AI tool" — for non-trivial entry
//      points or non-supported frameworks. We write a
//      REFACTOR-FOR-AUTH.md the user pastes into Claude Code / Cursor.
//
// Default highlight follows the framework: vite-react → auto, anything
// else → prompt. The user can still pick either.

export default function AuthScaffoldChoice({ inspection, onBack, onPick }) {
  const framework = inspection?.framework ?? "unknown";
  const isKnownFramework = framework === "vite-react";

  // For now the only fully-supported framework is vite-react. We still
  // let users on other frameworks try the "auto" path — the inject-auth
  // stage will fall back gracefully (write firebase-config.js + print a
  // manual-setup notice) — but we surface the recommendation honestly.
  const recommendation = isKnownFramework ? "auto" : "prompt";

  function pick(choice) {
    onPick?.(choice);
  }

  return (
    <Card
      title="How would you like sign-in added to your app?"
      sub="You said your app needs Google sign-in. We can wire it up two ways — pick whichever fits your workflow."
    >
      <div className="why-banner">
        <div className="why-title">What this step does</div>
        <p className="why-text">
          Either way, the next deploy step writes a small{" "}
          <code className="codepath">firebase-config.js</code> file into your
          app so the Firebase Web SDK knows which project to talk to. The
          difference between the two paths is what happens to your{" "}
          <code className="codepath">App.jsx</code>.
        </p>
      </div>

      <div className="choice-list">
        <div className="choice-header">Pick a path</div>

        <button
          className={`choice-card ${recommendation === "auto" ? "recommended" : ""}`}
          onClick={() => pick("auto")}
        >
          <div className="choice-icon">🪄</div>
          <div className="choice-body">
            <div className="choice-title">Add it for me (automatic)</div>
            <div className="choice-meta">
              We'll drop a working "Sign in with Google" button into your
              app's code and wire it up. Works best on standard app
              structures.
              {recommendation === "auto" && (
                <strong className="choice-tag"> Recommended for {framework}.</strong>
              )}
            </div>
          </div>
        </button>

        <button
          className={`choice-card ${recommendation === "prompt" ? "recommended" : ""}`}
          onClick={() => pick("prompt")}
        >
          <div className="choice-icon">📋</div>
          <div className="choice-body">
            <div className="choice-title">Give me a prompt for my AI tool</div>
            <div className="choice-meta">
              We'll generate a clear "to-do list" you can paste into
              Claude Code, Cursor, or another AI assistant. The AI will
              add sign-in for you and you re-run this wizard when it's
              done.
              {recommendation === "prompt" && (
                <strong className="choice-tag"> Recommended for {framework}.</strong>
              )}
            </div>
          </div>
        </button>
      </div>

      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <span className="muted" style={{ fontSize: 12 }}>
          Not sure? Pick "Add it for me" — you can always re-run the wizard.
        </span>
      </div>
    </Card>
  );
}
