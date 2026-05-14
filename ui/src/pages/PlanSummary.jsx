import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import { postPlan } from "../api.js";

export default function PlanSummary({ appDir, answers, secretsAnswers, onBack, onDeploy }) {
  const [plan, setPlan] = useState(null);
  useEffect(() => {
    // Fold the per-key classification answers into the payload so the
    // planner can include them in the saved plan.
    const payload = { ...answers, secrets: secretsAnswers ?? null };
    postPlan(appDir, payload).then(setPlan);
  }, [appDir, answers, secretsAnswers]);

  if (!plan) return <Card title="Putting together your plan…" sub="One moment." />;

  const items = [];
  items.push({
    title: "Create a space on Firebase for your app",
    meta: <>Project name: <code className="codepath">{plan.firebase.projectId}</code><div className="meta-hint">A private home on Google's servers, just for your app. Free.</div></>
  });
  items.push({
    title: "Set up the website hosting",
    meta: <>We'll publish from <code className="codepath">{plan.hosting.publicDir}</code><div className="meta-hint">So your URL works in any browser.</div></>
  });
  if (plan.firestore) items.push({
    title: "Set up the online database",
    meta: <>Firestore — Google's cloud database<div className="meta-hint">Locked down by default: only signed-in users can read/write their own data.</div></>
  });
  if (plan.functions) items.push({
    title: "Set up the server (Cloud Functions)",
    meta: <>Folder: <code className="codepath">{plan.functions.dir}</code><div className="meta-hint">For anything that needs to run on a server, not in the browser.</div></>
  });
  // Surface the secrets ingestion step only when there's anything to ingest.
  const perKey = plan.secrets?.perKey ?? [];
  const browserCount = perKey.filter(p => p.classification === "browser-safe").length;
  const serverCount = perKey.filter(p => p.classification === "server-only").length;
  if (perKey.length > 0) {
    const bits = [];
    if (browserCount > 0) bits.push(`${browserCount} into the build`);
    if (serverCount > 0) bits.push(`${serverCount} as Firebase secret${serverCount === 1 ? "" : "s"}`);
    items.push({
      title: "Set up your app's config values",
      meta: <>{bits.join(" + ")}<div className="meta-hint">We'll put browser-safe values into <code className="codepath">.env.production</code> and server-only values into Firebase Functions secrets.</div></>
    });
  }
  // A1: surface a "Wire up sign-in" step on the auto path. On the
  // prompt path the user does the wiring themselves before re-running,
  // so we leave it off the visual plan to avoid implying we'll touch
  // their code in that flow.
  if (plan.auth && plan.auth.scaffoldMode === "auto") {
    items.push({
      title: "Wire up sign-in",
      meta: <>Add a "Sign in with Google" button to your app<div className="meta-hint">We'll write firebase-config.js into <code className="codepath">src/</code>, drop a SignInWithGoogle.jsx component, and splice it into your App.jsx.</div></>
    });
  } else if (plan.auth && plan.auth.scaffoldMode === "prompt") {
    items.push({
      title: "Drop in your Firebase config",
      meta: <>Write <code className="codepath">firebase-config.js</code> into your source folder<div className="meta-hint">You'll wire the rest up yourself from REFACTOR-FOR-AUTH.md before re-running.</div></>
    });
  }

  if (plan.build.command) items.push({
    title: "Build your app",
    meta: <>Run <code className="codepath">{plan.build.command}</code><div className="meta-hint">Turn your source code into files browsers can use.</div></>
  });
  items.push({
    title: "Send everything to Firebase",
    meta: <>Upload and publish<div className="meta-hint">You'll get a live URL at the end.</div></>
  });

  const needsBlaze = plan.functions !== null;

  return (
    <Card
      title="Here's what we're going to do"
      sub="Have a quick look. Nothing has been created yet — clicking Deploy is what actually starts the work."
    >

      {needsBlaze && (
        <div className="warning-banner">
          <div className="warning-icon">⚠️</div>
          <div className="warning-body">
            <div className="warning-title">This app needs Firebase's pay-as-you-go plan (Blaze)</div>
            <div className="warning-text">
              Because your app has a server, Firebase requires you to be on
              their pay-as-you-go plan. Don't panic: small apps stay inside
              the free quota and cost <strong>$0/month</strong> in practice.
              You'll need a credit card on Firebase before this deploys —
              we'll show you the exact upgrade link as soon as your project
              is created.
            </div>
            <a
              className="link"
              href="https://firebase.google.com/pricing"
              target="_blank"
              rel="noreferrer"
            >
              Learn about Firebase pricing ↗
            </a>
          </div>
        </div>
      )}

      <ol className="plan-list">
        {items.map((it, i) => (
          <li key={i}>
            <div className="num">{i + 1}</div>
            <div>
              <div className="title">{it.title}</div>
              <div className="meta">{it.meta}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="btn-row split">
        <BackButton onClick={onBack} />
        <Button onClick={() => onDeploy(plan)}>Deploy</Button>
      </div>
    </Card>
  );
}
