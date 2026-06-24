import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { getPreflight, postLogin, postFirebaseLogout, postGhLogin, postSetupDevTools } from "../api.js";

const DEV_TOOLS = [
  {
    key: "brew",
    title: "Homebrew — installs developer tools on your Mac",
    missingDesc: "Not installed. We can install it for you (your password will be needed).",
    okDesc: "Installed — used to install Git and GitHub CLI.",
    optional: true,
  },
  {
    key: "git",
    title: "Git — tracks changes to your code",
    missingDesc: "Not installed. We'll install it via Homebrew.",
    okDesc: "Installed.",
  },
  {
    key: "gh",
    title: "GitHub CLI — creates your GitHub repository",
    missingDesc: "Not installed. We'll install it via Homebrew.",
    okDesc: "Installed.",
  },
];

function allDevToolsOk(state) {
  if (!state) return false;
  return DEV_TOOLS.every(({ key, optional }) => {
    const t = state[key];
    if (!t) return false;
    if (optional && t.required === false) return true;
    return t.ok;
  });
}

export default function Prerequisites({ onBack, onNext }) {
  const [state, setState] = useState(null);
  const [setupPolling, setSetupPolling] = useState(false);
  const [loginPolling, setLoginPolling] = useState(false);
  const [ghLoginPolling, setGhLoginPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await getPreflight();
        if (!cancelled) setState(data);
      } catch {}
    }
    poll();
    if (!setupPolling && !loginPolling && !ghLoginPolling) return () => { cancelled = true; };
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [setupPolling, loginPolling, ghLoginPolling]);

  async function check() {
    try {
      const data = await getPreflight();
      setState(data);
    } catch {}
  }

  const devOk = allDevToolsOk(state);
  const allOk = state && devOk && state.node?.ok && state.firebaseCli?.ok && state.login?.ok && state.ghLogin?.ok;
  const anyDevMissing = state && !devOk;

  return (
    <Card
      title="Before we begin — a quick check"
      sub="Your new project needs a few tools installed and your Google account connected. Check each item below, or install anything that's missing."
    >
      {DEV_TOOLS.map(({ key, title, missingDesc, okDesc, optional }) => {
        const t = state?.[key];
        if (optional && t && t.required === false) return null;
        const status = !t ? "pending" : (t.ok ? "ok" : "fail");
        return (
          <StatusRow
            key={key}
            state={status}
            title={title}
            meta={!t ? "checking…" : (t.ok ? okDesc : missingDesc)}
            action={
              status === "fail" ? (
                <Button variant="secondary" onClick={check}>Check</Button>
              ) : null
            }
          />
        );
      })}

      {anyDevMissing && !setupPolling && (
        <div className="btn-row" style={{ marginTop: 4, justifyContent: "flex-start" }}>
          <Button
            variant="secondary"
            onClick={async () => {
              await postSetupDevTools();
              setSetupPolling(true);
            }}
          >
            Install missing tools
          </Button>
        </div>
      )}
      {setupPolling && !devOk && (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Installing — follow any prompts in your terminal. This page updates automatically.
        </p>
      )}

      <StatusRow
        state={state?.node ? (state.node.ok ? "ok" : "fail") : "pending"}
        title="Node.js — runs your app's build step"
        meta={state?.node ? `Found v${state.node.version} (we need 22 or newer)` : "checking…"}
        action={
          state?.node && !state.node.ok ? (
            <Button variant="secondary" onClick={check}>Check</Button>
          ) : null
        }
      />

      <StatusRow
        state={state?.firebaseCli ? (state.firebaseCli.ok ? "ok" : "fail") : "pending"}
        title="Firebase command-line tool"
        meta={state?.firebaseCli
          ? (state.firebaseCli.ok
              ? "Installed — this is how we talk to Firebase."
              : "Not installed. Run npm install -g firebase-tools, then click Check.")
          : "checking…"}
        action={
          state?.firebaseCli && !state.firebaseCli.ok ? (
            <Button variant="secondary" onClick={check}>Check</Button>
          ) : null
        }
      />

      <StatusRow
        state={state?.login ? (state.login.ok ? "ok" : "fail") : "pending"}
        title="Signed in to Firebase"
        meta={
          state?.login?.email ||
          (loginPolling
            ? "Waiting for you to finish signing in (we opened a browser tab)…"
            : "Not signed in yet. We'll open a tab to sign in with Google.")
        }
        action={
          state?.login && !state.login.ok && !loginPolling ? (
            <a className="link" style={{ cursor: "pointer" }} onClick={async () => {
              await postLogin();
              setLoginPolling(true);
            }}>Sign in</a>
          ) : state?.login?.ok ? (
            <a className="link" style={{ cursor: "pointer" }} onClick={async () => {
              await postFirebaseLogout();
              await check();
            }}>Sign out</a>
          ) : null
        }
      />

      <StatusRow
        state={state?.ghLogin ? (state.ghLogin.ok ? "ok" : "fail") : "pending"}
        title="Signed in to GitHub"
        meta={
          state?.ghLogin?.user ? `Signed in as ${state.ghLogin.user}` :
          (ghLoginPolling
            ? "Waiting for you to finish signing in (we opened a browser tab)…"
            : "Not signed in yet. We'll open a browser tab to sign in.")
        }
        action={
          state?.ghLogin && !state.ghLogin.ok && !ghLoginPolling ? (
            <a className="link" style={{ cursor: "pointer" }} onClick={async () => {
              await postGhLogin();
              setGhLoginPolling(true);
            }}>Sign in</a>
          ) : state?.ghLogin?.ok ? (
            <a className="link" style={{ cursor: "pointer" }} onClick={async () => {
              await postGhLogin();
              setGhLoginPolling(true);
            }}>Change account</a>
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
