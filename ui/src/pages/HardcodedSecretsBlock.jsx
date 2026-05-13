import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { generateSecretsRefactorPrompt, postInspect } from "../api.js";

// Block page shown after the Inspector step when the inspection flags
// hardcoded secrets (`hasHardcodedSecrets > 0`). Mirrors IncompatibleApp.jsx
// — a card with a plain-language explanation, an evidence list with
// redacted previews, and three choice cards.
//
// The "Get help moving them to a safe place" path generates
// REFACTOR-SECRETS.md (via the refactor-prompts template) and shows it
// inline with a Copy button. The "I've already moved them" path
// re-inspects; if hardcoded secrets are still present, the page
// re-renders with fresh evidence; if clean, the parent advances to
// either the Classify page or Questions depending on what's left.

const KIND_LABELS = {
  "stripe-live": "Stripe live key",
  "stripe-test": "Stripe test key",
  "aws-access-key": "AWS access key",
  "aws-secret-key": "AWS secret access key",
  "github-pat": "GitHub personal access token",
  "github-oauth": "GitHub OAuth token",
  "github-user": "GitHub user token",
  "anthropic": "Anthropic API key",
  "openai": "OpenAI API key",
  "slack-bot": "Slack bot token",
  "slack-user": "Slack user token",
  "google-api-key-maybe-firebase": "Google API key (might be Firebase — please verify)"
};
function kindLabel(k) { return KIND_LABELS[k] ?? k; }

export default function HardcodedSecretsBlock({
  appDir,
  inspection,
  onRefactor,    // called with fresh inspection after a successful re-check
  onCancel       // called when user picks "cancel"
}) {
  const [stage, setStage] = useState("decide"); // "decide" | "generated" | "retrying"
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const allHits = inspection?.secrets?.hardcoded ?? [];
  // Only show non-suppressed hits — suppressed ones (e.g. Firebase web
  // SDK API keys) aren't blocking the deploy and shouldn't scare the user.
  const blocking = allHits.filter(h => !h.suppressed);
  const visible = blocking.slice(0, 5);
  const hidden = blocking.length - visible.length;

  async function handleGenerate() {
    setError("");
    try {
      const { path: outPath, content: md } = await generateSecretsRefactorPrompt(appDir, inspection);
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
        sub="The text below tells an AI coding assistant (Claude Code, Cursor, etc.) exactly how to move the keys we found into a safe place. Hit Copy, paste it into your tool's chat, and it'll do the work."
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
            <li>Come back here and click <strong>I've moved the keys — try again</strong>.</li>
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
            {stage === "retrying" ? "Checking…" : "I've moved the keys — try again"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="We found secrets in your code — let's fix that before deploying"
      sub="Your code has some passwords/keys written straight in. Once your app is on the internet, anyone who opens it can read those values from their browser. We need to move them somewhere safer first — and we'll write the to-do list for you."
    >
      <div className="why-banner">
        <div className="why-title">Why this matters</div>
        <p className="why-text">
          When your app gets published, the JavaScript files it runs become
          public — anyone with the URL can hit "View Source" and see what's
          in them. Real keys (Stripe, AWS, OpenAI, etc.) in those files
          mean anyone can drain your accounts. Even your server-side code
          ends up in git, which gets shared, forked, or accidentally
          published. The fix is the same for both: keep the keys in a
          separate file (<code className="codepath">.env</code>) that
          never leaves your computer.
        </p>

        {visible.length > 0 && (
          <details className="why-details" open={visible.length <= 5}>
            <summary>Show what we found in your code ({blocking.length} spot{blocking.length === 1 ? "" : "s"})</summary>
            <ul className="evidence-list">
              {visible.map((h, i) => (
                <li key={i}>
                  <code className="codepath">{h.file}:{h.line}</code> — {kindLabel(h.kind)}:
                  <code className="excerpt"> {h.redacted}</code>
                </li>
              ))}
              {hidden > 0 && (
                <li className="muted">…and {hidden} more (all listed in the generated prompt).</li>
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
            <div className="choice-title">Get help moving them to a safe place</div>
            <div className="choice-meta">
              We write a clear "to-do list" for an AI tool (Claude Code, Cursor, etc.).
              You paste it in, the AI moves the keys into a <code className="codepath">.env</code> file
              and updates your code. Then come back and continue.
              <strong className="choice-tag"> Recommended.</strong>
            </div>
          </div>
        </button>

        <button className="choice-card" onClick={handleRetry}>
          <div className="choice-icon">✅</div>
          <div className="choice-body">
            <div className="choice-title">I've already moved them — re-check</div>
            <div className="choice-meta">
              If you already cleaned this up (or used your AI tool to do it),
              click here to re-scan your code. If anything's still hardcoded
              we'll show you what's left.
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
