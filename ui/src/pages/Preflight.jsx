import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { getPreflight, postLogin } from "../api.js";

export default function Preflight({ onBack, onNext }) {
  const [state, setState] = useState(null);
  const [loginPolling, setLoginPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await getPreflight();
        if (!cancelled) setState(data);
      } catch {}
    }
    poll();
    if (!loginPolling) return () => { cancelled = true; };
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [loginPolling]);

  const allOk = state && state.node.ok && state.firebaseCli.ok && state.login.ok;

  // Auto-advance once everything is green AND we were waiting for login.
  // Gives a brief moment to see the green checkmarks before moving on.
  useEffect(() => {
    if (loginPolling && allOk) {
      const id = setTimeout(() => onNext?.(), 800);
      return () => clearTimeout(id);
    }
  }, [loginPolling, allOk, onNext]);

  return (
    <Card title="Checking your tools"
          sub="Quick prerequisites check before we touch Firebase.">
      <StatusRow
        state={state?.node ? (state.node.ok ? "ok" : "fail") : "pending"}
        title="Node.js"
        meta={state?.node ? `v${state.node.version} — needs ≥ 22` : "checking…"}
      />
      <StatusRow
        state={state?.firebaseCli ? (state.firebaseCli.ok ? "ok" : "fail") : "pending"}
        title="Firebase CLI"
        meta={state?.firebaseCli ? (state.firebaseCli.installed ? "installed" : "not installed — install: npm install -g firebase-tools") : "checking…"}
      />
      <StatusRow
        state={state?.login ? (state.login.ok ? "ok" : "fail") : "pending"}
        title="Logged in to Firebase"
        meta={state?.login?.email || (loginPolling ? "waiting for login in the other tab…" : "not logged in")}
        action={
          state?.login && !state.login.ok && !loginPolling ? (
            <a className="link" onClick={async () => { await postLogin(); setLoginPolling(true); }}>Sign in</a>
          ) : state?.login?.ok ? (
            <a className="link" onClick={async () => { await postLogin(); setLoginPolling(true); }}>Switch account</a>
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
