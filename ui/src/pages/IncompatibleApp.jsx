import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { generateDbRefactorPrompt, postInspect } from "../api.js";

// Block page shown after the Inspector step when the inspection flags
// the app as DB-incompatible. Mirrors the visual + interaction pattern
// of Bootstrap.jsx — a card with a plain-language explanation, an
// evidence list, and three options the user can pick from.
//
// The "Generate refactor prompt" path used to dump a file path + open
// instructions. It now shows the prompt body inline with a one-click
// Copy button so non-tech users can paste straight into their AI tool
// without ever opening the file.

const DRIVER_NAMES = {
  sqlite: "SQLite",
  postgres: "Postgres",
  mysql: "MySQL",
  mongodb: "MongoDB",
  mongoose: "MongoDB (via Mongoose)",
  prisma: "Prisma",
  "fs-writes": "local file writes",
};

function driverLabel(d) { return DRIVER_NAMES[d] ?? d; }

export default function IncompatibleApp({
  appDir,
  inspection,
  onRefactor,             // called after a successful retry re-inspection
  onDeployFrontendOnly,   // called when user picks "deploy frontend only"
  onCancel                // called when user picks "cancel"
}) {
  const [stage, setStage] = useState("decide"); // "decide" | "generated" | "retrying"
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const details = inspection?.dbIncompatDetails ?? { drivers: [], evidence: [] };
  const drivers = details.drivers ?? [];
  const evidence = (details.evidence ?? []).slice(0, 5);

  async function handleGenerate() {
    setError("");
    try {
      const { path: outPath, content: md } = await generateDbRefactorPrompt(appDir, inspection);
      setPath(outPath);
      setContent(md);
      setStage("generated");
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (e.g. insecure context) — fall back silently
    }
  }

  async function handleRetry() {
    setStage("retrying");
    setError("");
    try {
      const fresh = await postInspect(appDir);
      onRefactor?.(fresh);
    } catch (err) {
      setError(err.message || String(err));
      setStage("generated");
    }
  }

  if (stage === "generated" || stage === "retrying") {
    return (
      <Card
        title="Here's the upgrade plan — copy this into your AI tool"
        sub="The text below tells an AI coding assistant (Claude Code, Cursor, etc.) exactly how to update your app so Firebase can run it. Hit Copy, paste it into your tool's chat, and it'll do the work."
      >
        <div className="prompt-actions">
          <Button onClick={handleCopy} variant="primary" className="copy-prompt-btn">
            {copied ? "✓ Copied to clipboard" : "📋 Copy the whole prompt"}
          </Button>
          <span className="muted" style={{fontSize: 12}}>
            Also saved to <code className="codepath">{path}</code> in case you want to keep it.
          </span>
        </div>

        <pre className="prompt-preview">{content}</pre>

        <div className="incompat-instructions">
          <div className="instructions-title">When you're ready to come back</div>
          <ol>
            <li>Open your AI coding tool (Claude Code, Cursor, ChatGPT, etc.).</li>
            <li>Make sure it's pointed at this folder: <code className="codepath">{appDir}</code></li>
            <li>Paste the prompt and let it apply the changes.</li>
            <li>Come back here and click <strong>I've updated my app — try again</strong>.</li>
          </ol>
        </div>

        {error && (
          <div className="warning-banner" style={{marginTop: 16}}>
            <div className="warning-icon">⚠️</div>
            <div className="warning-body">
              <div className="warning-title">Something went wrong re-checking your app</div>
              <div className="warning-text">{error}</div>
            </div>
          </div>
        )}

        <div className="btn-row split">
          <Button variant="ghost" onClick={onCancel}>Start over</Button>
          <Button onClick={handleRetry} disabled={stage === "retrying"}>
            {stage === "retrying" ? "Checking…" : "I've updated my app — try again"}
          </Button>
        </div>
      </Card>
    );
  }

  // Friendly explanation of what was detected, in plain English.
  const driverList = drivers.length > 0
    ? drivers.map(driverLabel).join(", ")
    : "a local database";

  return (
    <Card
      title="Your app needs a different way to save data"
      sub={`Your app uses ${driverList} to remember things — that works great on your computer, but it can't work on the internet the same way. Don't worry: there's a clear path to fix it, and you don't have to write the fix yourself.`}
    >
      <div className="why-banner">
        <div className="why-title">Why it doesn't work as-is</div>
        <p className="why-text">
          When your app runs on Firebase, it runs on Google's servers — and those
          servers don't keep a permanent hard drive. Anything saved to {driverList}{" "}
          would disappear shortly after each visit. Apps on the internet need a
          different kind of database, one that lives in the cloud (Firebase
          gives you one for free called <strong>Firestore</strong>).
        </p>

        {evidence.length > 0 && (
          <details className="why-details">
            <summary>Show what we found in your code ({(details.evidence ?? []).length} spot{(details.evidence ?? []).length === 1 ? "" : "s"})</summary>
            <ul className="evidence-list">
              {evidence.map((e, i) => (
                <li key={i}>
                  <code className="codepath">{e.file}:{e.line}</code> — uses {driverLabel(e.kind)}:
                  <code className="excerpt"> {e.excerpt}</code>
                </li>
              ))}
              {(details.evidence ?? []).length > evidence.length && (
                <li className="muted">…and {(details.evidence ?? []).length - evidence.length} more (all listed in the generated prompt).</li>
              )}
            </ul>
          </details>
        )}
      </div>

      <div className="choice-list">
        <div className="choice-header">What would you like to do?</div>

        <button className="choice-card recommended" onClick={handleGenerate}>
          <div className="choice-icon">🪄</div>
          <div className="choice-body">
            <div className="choice-title">Get help from an AI to upgrade my app</div>
            <div className="choice-meta">
              We write a clear "to-do list" for an AI tool (Claude Code, Cursor, etc.).
              You paste it in, the AI updates your app for you, you come back and deploy.
              <strong className="choice-tag"> Recommended.</strong>
            </div>
          </div>
        </button>

        <button className="choice-card" onClick={onDeployFrontendOnly}>
          <div className="choice-icon">🖼️</div>
          <div className="choice-body">
            <div className="choice-title">Deploy just the visible part for now</div>
            <div className="choice-meta">
              We'll skip the server and database. Your app's pages will be on
              the internet, but anything that saves or loads data won't work yet.
              Good for showing screenshots; not for real use.
            </div>
          </div>
        </button>

        <button className="choice-card" onClick={onCancel}>
          <div className="choice-icon">↩️</div>
          <div className="choice-body">
            <div className="choice-title">Stop and decide later</div>
            <div className="choice-meta">
              Nothing has been created on Firebase yet. We'll exit and you can
              come back when you've decided.
            </div>
          </div>
        </button>
      </div>

      {error && (
        <div className="warning-banner" style={{marginTop: 16}}>
          <div className="warning-icon">⚠️</div>
          <div className="warning-body">
            <div className="warning-title">Couldn't generate the prompt</div>
            <div className="warning-text">{error}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
