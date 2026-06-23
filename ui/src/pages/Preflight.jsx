import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { getPreflight, postLogin, postSetupDevTools } from "../api.js";

const DEV_TOOLS = [
  {
    key: "brew",
    title: "Homebrew — installs developer tools on your Mac",
    missing: "Not installed yet. We'll install it for you (needs your password).",
    ok: "Installed — we use this to install Git and GitHub CLI.",
    optional: true,
  },
  {
    key: "git",
    title: "Git — version control for your code",
    missing: "Not installed yet. We'll install it via Homebrew.",
    ok: "Installed.",
  },
  {
    key: "gh",
    title: "GitHub CLI (gh) — talks to GitHub from your terminal",
    missing: "Not installed yet. We'll install it via Homebrew.",
    ok: "Installed.",
  },
];

function devToolsOk(state) {
  if (!state) return false;
  return DEV_TOOLS.every(({ key, optional }) => {
    const tool = state[key];
    if (!tool) return false;
    if (optional && tool.required === false) return true;
    return tool.ok;
  });
}

export default function Preflight({ onBack, onNext }) {
  const [state, setState] = useState(null);
  const [loginPolling, setLoginPolling] = useState(false);
  const [setupPolling, setSetupPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await getPreflight();
        if (!cancelled) setState(data);
      } catch {}
    }
    poll();
    if (!loginPolling && !setupPolling) return () => { cancelled = true; };
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [loginPolling, setupPolling]);

  const devOk = devToolsOk(state);
  const allOk = state && devOk && state.node.ok && state.firebaseCli.ok && state.login.ok;
  const needsDevSetup = state && !devOk;

  // Auto-advance once everything is green AND we were waiting for login.
  // Gives a brief moment to see the green checkmarks before moving on.
  useEffect(() => {
    if (loginPolling && allOk) {
      const id = setTimeout(() => onNext?.(), 800);
      return () => clearTimeout(id);
    }
  }, [loginPolling, allOk, onNext]);

  return (
    <Card
      title="Quick check before we start"
      sub="We need a few tools on your computer and your Google account signed in. We'll check for you — if anything's missing we'll help fix it."
    >
      {DEV_TOOLS.map(({ key, title, missing, ok, optional }) => {
        const tool = state?.[key];
        if (optional && tool && tool.required === false) return null;
        return (
          <StatusRow
            key={key}
            state={tool ? (tool.ok ? "ok" : "fail") : "pending"}
            title={title}
            meta={tool ? (tool.installed ? ok : missing) : "checking…"}
          />
        );
      })}
      {needsDevSetup && !setupPolling && (
        <div className="btn-row">
          <Button onClick={async () => {
            await postSetupDevTools();
            setSetupPolling(true);
          }}>
            Install missing tools
          </Button>
        </div>
      )}
      {setupPolling && !devOk && (
        <p className="muted">Installing in your terminal — follow the prompts there, then we'll recheck automatically.</p>
      )}
      <StatusRow
        state={state?.node ? (state.node.ok ? "ok" : "fail") : "pending"}
        title="Node.js — runs your app's build step"
        meta={state?.node ? `Found v${state.node.version} (we need 22 or newer)` : "checking…"}
      />
      <StatusRow
        state={state?.firebaseCli ? (state.firebaseCli.ok ? "ok" : "fail") : "pending"}
        title="Firebase command-line tool"
        meta={state?.firebaseCli
          ? (state.firebaseCli.installed
              ? "Installed — this is how we talk to Firebase."
              : "Not installed yet. We'll install it for you (run: npm install -g firebase-tools).")
          : "checking…"}
      />
      <StatusRow
        state={state?.login ? (state.login.ok ? "ok" : "fail") : "pending"}
        title="Signed in to Firebase"
        meta={state?.login?.email
          || (loginPolling
              ? "Waiting for you to finish signing in (we opened a browser tab for it)..."
              : "Not signed in yet. We'll open a tab for you to sign in with Google.")}
        action={
          state?.login && !state.login.ok && !loginPolling ? (
            <a className="link" onClick={async () => { await postLogin(); setLoginPolling(true); }}>Sign in</a>
          ) : state?.login?.ok ? (
            <a className="link" onClick={async () => { await postLogin(); setLoginPolling(true); }}>Use a different account</a>
          ) : null
        }
      />
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={onNext} disabled={!allOk}>Continue</Button>
      </div>
    </Card>
  );
}
