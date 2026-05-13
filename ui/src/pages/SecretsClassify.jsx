import { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";

// Phase 2 of the C6 secrets flow. Shown when the inspector finds env-var
// references (`process.env.X`) and/or `.env.example` keys but NO blocking
// hardcoded secrets. The user classifies each unique key as "browser-safe"
// (baked into the build) or "server-only" (Firebase Functions secret) and,
// for server-only keys, optionally types the value here so the deploy
// stage can ingest it automatically.
//
// The page is SKIPPED entirely by App.jsx when there are no env vars in
// either source — see the routing in App.jsx for the decision.

const BROWSER = "browser-safe";
const SERVER = "server-only";

// Best-guess default for whether a name is browser-safe:
//   - VITE_*       → browser-safe (Vite exposes these via import.meta.env)
//   - NEXT_PUBLIC_*→ browser-safe (Next.js bundles these into the client)
//   - everything else → server-only (safer default)
function inferDefault(name) {
  if (name.startsWith("VITE_")) return BROWSER;
  if (name.startsWith("NEXT_PUBLIC_")) return BROWSER;
  return SERVER;
}

function inferLabel(name) {
  return inferDefault(name) === BROWSER ? "Looks browser-safe" : "Looks server-only";
}

export default function SecretsClassify({ inspection, defaults, onBack, onNext }) {
  const secrets = inspection?.secrets ?? { envRefs: [], envExampleKeys: [] };

  // Union the two sources, deduped + sorted for stable UI.
  const allKeys = useMemo(() => {
    const set = new Set([
      ...(secrets.envRefs ?? []),
      ...(secrets.envExampleKeys ?? [])
    ]);
    return [...set].sort();
  }, [secrets.envRefs, secrets.envExampleKeys]);

  // Build initial state per-key. Honor any defaults the user picked
  // earlier (e.g. they went Back from PlanSummary).
  const [perKey, setPerKey] = useState(() => {
    const initial = {};
    for (const name of allKeys) {
      const prior = defaults?.perKey?.find?.(p => p.name === name);
      initial[name] = prior
        ? { classification: prior.classification, value: prior.value ?? "" }
        : { classification: inferDefault(name), value: "" };
    }
    return initial;
  });

  function setClass(name, classification) {
    setPerKey(s => ({ ...s, [name]: { ...s[name], classification } }));
  }
  function setValue(name, value) {
    setPerKey(s => ({ ...s, [name]: { ...s[name], value } }));
  }

  function submit() {
    const out = allKeys.map(name => ({
      name,
      classification: perKey[name].classification,
      value: perKey[name].value
    }));
    onNext({ perKey: out });
  }

  // For Shape A/B with any server-only classifications: warn the user.
  // There's no backend to read server-only secrets, so they'd have to
  // either flip to browser-safe (and accept it's public) or add a backend.
  const hasBackend = Boolean(inspection?.hasBackend);
  const serverOnlyCount = allKeys.filter(n => perKey[n].classification === SERVER).length;
  const showNoBackendWarning = !hasBackend && serverOnlyCount > 0;

  if (allKeys.length === 0) {
    // Defensive — should never render in practice because App.jsx skips
    // this page when there are no keys to classify.
    return (
      <Card
        title="No config values to classify"
        sub="We didn't find any environment variables in your code or .env.example — moving on."
      >
        <div className="btn-row split">
          <BackButton onClick={onBack} />
          <Button onClick={() => onNext({ perKey: [] })}>Continue</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Your app uses some config values — where should they live?"
      sub="For each one, tell us whether it's safe for anyone using your site to see, or whether it's a real secret that should stay on the server only. We'll set things up so each value ends up in the right place."
    >
      <div className="why-banner">
        <div className="why-title">A quick refresher</div>
        <p className="why-text">
          <strong>Browser-safe</strong> means the value is allowed to be public
          (e.g. a public API URL, an app title). We'll bake it into your
          built JavaScript so the browser can read it. <strong>Server-only</strong>{" "}
          means it's a real secret (Stripe key, OpenAI key, etc.); we'll
          keep it on Firebase's servers and your Cloud Functions read it
          at runtime.
        </p>
      </div>

      {showNoBackendWarning && (
        <div className="warning-banner" style={{marginBottom: 16}}>
          <div className="warning-icon">⚠️</div>
          <div className="warning-body">
            <div className="warning-title">Heads up — this app has no backend</div>
            <div className="warning-text">
              You've classified {serverOnlyCount} {serverOnlyCount === 1 ? "value" : "values"} as
              server-only, but this app doesn't have a backend (no <code className="codepath">functions/</code>{" "}
              folder). Server-only secrets have no safe home in a pure
              static deploy. You have two real options: change them to
              browser-safe (and accept that they'll be public), or go back
              and add a backend.
            </div>
          </div>
        </div>
      )}

      <div className="secrets-list">
        {allKeys.map(name => {
          const k = perKey[name];
          return (
            <div key={name} className="secret-row">
              <div className="secret-head">
                <code className="codepath secret-name">{name}</code>
                <span className="muted secret-hint">{inferLabel(name)}</span>
              </div>
              <div className="secret-options">
                <label className={k.classification === BROWSER ? "selected" : ""}>
                  <input
                    type="radio"
                    name={`cls-${name}`}
                    checked={k.classification === BROWSER}
                    onChange={() => setClass(name, BROWSER)}
                  />
                  <span>
                    <strong>Browser-safe</strong>
                    <span className="muted"> — safe for users to see</span>
                  </span>
                </label>
                <label className={k.classification === SERVER ? "selected" : ""}>
                  <input
                    type="radio"
                    name={`cls-${name}`}
                    checked={k.classification === SERVER}
                    onChange={() => setClass(name, SERVER)}
                  />
                  <span>
                    <strong>Server-only</strong>
                    <span className="muted"> — must stay secret</span>
                  </span>
                </label>
              </div>
              {(k.classification === BROWSER || (k.classification === SERVER && hasBackend)) && (
                <div className="secret-value">
                  <label>
                    <span className="muted secret-value-label">
                      {k.classification === BROWSER ? "Value to bake into the build" : "Value (we'll save it as a Firebase secret)"}
                    </span>
                    <input
                      type={k.classification === SERVER ? "password" : "text"}
                      placeholder={k.classification === BROWSER ? "(leave blank to keep the placeholder)" : "(leave blank and we'll prompt during deploy)"}
                      value={k.value}
                      onChange={e => setValue(name, e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={submit}>Continue</Button>
      </div>
    </Card>
  );
}
