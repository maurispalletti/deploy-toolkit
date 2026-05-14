import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { generateAuthRefactorPrompt } from "../api.js";

// AuthRefactorPrompt (step 13). Shown only when the user picks "prompt"
// on the AuthScaffoldChoice page.
//
// On mount we POST to /api/refactor-prompt/auth — the server writes
// REFACTOR-FOR-AUTH.md into the app folder and returns the markdown
// content so we can display it inline. The user copies it, applies the
// refactor in their AI tool, and clicks "I've added sign-in" to
// continue.
//
// Unlike the DB-incompat / hardcoded-secrets flows, we don't re-inspect
// after the user comes back — auth is intentionally code-driven by
// THEM, and re-detection would be fragile (was the AI's component
// recognised? did the splice match?). The honest UX is "trust the user;
// they say it's done, we'll deploy."

export default function AuthRefactorPrompt({
  appDir,
  inspection,
  answers,
  onContinue
}) {
  const [stage, setStage] = useState("loading"); // "loading" | "ready" | "error"
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = {
          appName: answers?.appName ?? inspection?.pkgName ?? "your-app",
          framework: inspection?.framework ?? "unknown",
          // The Firebase project hasn't been created yet at this point
          // in the wizard, so we don't know the final projectId. The
          // prompt still renders fine with an empty/placeholder ID; we
          // pass it through if the planner has already produced one.
          projectId: answers?.projectId ?? "",
          sdkConfig: null,
          // Same path the inject-auth stage will write to (vite-react
          // default — Next.js gets `lib/firebase-config.js`).
          scaffoldedConfigPath: inspection?.framework === "nextjs"
            ? "lib/firebase-config.js"
            : "src/firebase-config.js"
        };
        const result = await generateAuthRefactorPrompt(appDir, payload);
        if (cancelled) return;
        setPath(result.path);
        setContent(result.content);
        setStage("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err.message || String(err));
        setStage("error");
      }
    })();
    return () => { cancelled = true; };
  }, [appDir, answers, inspection]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable in insecure contexts — fall back silently.
    }
  }

  if (stage === "loading") {
    return <Card title="Generating your refactor prompt…" sub="One moment." />;
  }

  if (stage === "error") {
    return (
      <Card title="Couldn't generate the prompt" sub="Something went wrong on the server.">
        <div className="warning-banner">
          <div className="warning-icon">⚠️</div>
          <div className="warning-body">
            <div className="warning-title">Server returned an error</div>
            <div className="warning-text">{error}</div>
          </div>
        </div>
        <div className="btn-row">
          <Button onClick={onContinue}>Continue anyway →</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Here's your sign-in to-do list — paste it into your AI tool"
      sub="The text below tells an AI coding assistant exactly how to add Google sign-in to your app. Hit Copy, paste it into Claude Code (or Cursor, or ChatGPT), and the AI does the work. When it's done, click Continue."
    >
      <div className="prompt-actions">
        <Button onClick={handleCopy} variant="primary" className="copy-prompt-btn">
          {copied ? "✓ Copied to clipboard" : "📋 Copy the whole prompt"}
        </Button>
        <span className="muted" style={{ fontSize: 12 }}>
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
          <li>Run your app locally to make sure the Sign-in button shows up.</li>
          <li>Come back here and click <strong>I've added sign-in — continue</strong>.</li>
        </ol>
      </div>

      <div className="btn-row">
        <Button onClick={onContinue}>I've added sign-in — continue →</Button>
      </div>
    </Card>
  );
}
