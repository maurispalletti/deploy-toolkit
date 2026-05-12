import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { generateDbRefactorPrompt, postInspect } from "../api.js";

// Block page shown after the Inspector step when the inspection flags
// the app as DB-incompatible. Mirrors the visual + interaction pattern
// of Bootstrap.jsx — a card with explanation, an evidence list, and
// three options the user can pick from.
//
// Options:
//   1. Generate refactor prompt: writes REFACTOR-FOR-FIREBASE.md into
//      the app folder, transitions to a "prompt generated" sub-state
//      with the path and a copy-to-clipboard helper plus a
//      "I've refactored — retry" button that re-inspects.
//   2. Deploy frontend only: bypass the block by setting a flag on
//      session state; the parent rewinds the wizard to the questions
//      page so the user can re-answer with the bypass applied.
//   3. Cancel: reset state and go back to Welcome.

export default function IncompatibleApp({
  appDir,
  inspection,
  onRefactor,             // called after a successful retry re-inspection
  onDeployFrontendOnly,   // called when user picks "deploy frontend only"
  onCancel                // called when user picks "cancel"
}) {
  const [stage, setStage] = useState("decide"); // "decide" | "generated" | "retrying"
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const details = inspection?.dbIncompatDetails ?? { drivers: [], evidence: [] };
  const drivers = details.drivers ?? [];
  const evidence = (details.evidence ?? []).slice(0, 5);

  async function handleGenerate() {
    setError("");
    try {
      const { path: outPath } = await generateDbRefactorPrompt(appDir, inspection);
      setPath(outPath);
      setStage("generated");
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(path);
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
      // Hand the new inspection back to the parent. App.jsx decides whether
      // to re-route to the Inspector preview (still incompatible — back here)
      // or forward (clean — onward to Questions).
      onRefactor?.(fresh);
    } catch (err) {
      setError(err.message || String(err));
      setStage("generated");
    }
  }

  if (stage === "generated" || stage === "retrying") {
    return (
      <Card title="Refactor prompt generated"
            sub="Hand this file to Claude Code (or any AI coding tool) to apply the migration.">
        <div className="status">
          <div className="status-icon ok">✓</div>
          <div>
            <div style={{fontWeight: 600}}>Written to your app folder</div>
            <code className="codepath" style={{display: "inline-block", marginTop: 4}}>{path}</code>
          </div>
        </div>
        <ol style={{paddingLeft: 20, lineHeight: 1.8, marginTop: 20}}>
          <li>Open <code className="codepath">{path}</code> (or copy it to your clipboard with the button below).</li>
          <li>Paste the entire file into Claude Code, Cursor, or another AI tool — point it at this app folder.</li>
          <li>Let the AI apply the refactor (replace the DB driver with Firestore via the storage-adapter pattern in the file).</li>
          <li>Come back here and click <strong>I've refactored — retry</strong> below.</li>
        </ol>
        {error && (
          <div className="warning-banner" style={{marginTop: 16}}>
            <div className="warning-icon">⚠️</div>
            <div className="warning-body">
              <div className="warning-title">Re-inspection failed</div>
              <div className="warning-text">{error}</div>
            </div>
          </div>
        )}
        <div className="btn-row split">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <div style={{display: "flex", gap: 12}}>
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy path"}
            </Button>
            <Button onClick={handleRetry} disabled={stage === "retrying"}>
              {stage === "retrying" ? "Re-inspecting…" : "I've refactored — retry"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="This app uses a database Firebase can't run"
          sub="Cloud Functions don't have a persistent filesystem and don't run sqlite, postgres, mysql, or mongodb. We can't deploy this app as-is, but here are your options.">
      <div className="warning-banner">
        <div className="warning-icon">⚠️</div>
        <div className="warning-body">
          <div className="warning-title">Detected drivers</div>
          <div className="warning-text">
            {drivers.length > 0
              ? drivers.map(d => (
                  <code key={d} className="codepath" style={{marginRight: 6}}>{d}</code>
                ))
              : "(none — surface scan only)"}
          </div>
          {evidence.length > 0 && (
            <ul style={{margin: "8px 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: 13, lineHeight: 1.6}}>
              {evidence.map((e, i) => (
                <li key={i}>
                  <code className="codepath">{e.file}:{e.line}</code> — {e.kind}: <span style={{fontFamily: "var(--font-mono)"}}>{e.excerpt}</span>
                </li>
              ))}
              {(details.evidence ?? []).length > evidence.length && (
                <li>…and {(details.evidence ?? []).length - evidence.length} more in the generated prompt.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: 12, marginTop: 24}}>
        <Button onClick={handleGenerate}>🪄 Generate refactor prompt</Button>
        <Button variant="secondary" onClick={onDeployFrontendOnly}>
          Deploy frontend only (skip backend)
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>

      {error && (
        <div className="warning-banner" style={{marginTop: 16}}>
          <div className="warning-icon">⚠️</div>
          <div className="warning-body">
            <div className="warning-title">Couldn't write the prompt</div>
            <div className="warning-text">{error}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
