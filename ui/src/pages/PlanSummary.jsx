import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import { postPlan } from "../api.js";

export default function PlanSummary({ appDir, answers, onBack, onDeploy }) {
  const [plan, setPlan] = useState(null);
  useEffect(() => { postPlan(appDir, answers).then(setPlan); }, [appDir, answers]);

  if (!plan) return <Card title="Preparing your plan…" sub="" />;

  const items = [];
  items.push({ title: "Create Firebase project", meta: plan.firebase.projectId });
  items.push({ title: "Configure Firebase Hosting", meta: <>Publishing <code className="codepath">{plan.hosting.publicDir}</code></> });
  if (plan.firestore) items.push({ title: "Set up Firestore", meta: "Locked-down default rules — authenticated users can read/write their own data" });
  if (plan.functions) items.push({ title: "Configure Cloud Functions", meta: `Functions dir: ${plan.functions.dir}` });
  if (plan.build.command) items.push({ title: "Build your app", meta: <code className="codepath">{plan.build.command}</code> });
  items.push({ title: "Deploy", meta: "Upload to Firebase Hosting and finalize" });

  const needsBlaze = plan.functions !== null;

  return (
    <Card title="Here's the plan" sub="Review before we deploy. Nothing has been created yet.">

      {needsBlaze && (
        <div className="warning-banner">
          <div className="warning-icon">⚠️</div>
          <div className="warning-body">
            <div className="warning-title">This app needs Firebase's Blaze plan</div>
            <div className="warning-text">
              Cloud Functions require pay-as-you-go billing. Small apps typically
              stay within the free quota and cost <strong>$0/month</strong>, but
              you'll need a credit card on Firebase before this deploys. We'll
              show the exact upgrade link mid-deploy when your project exists.
            </div>
            <a
              className="link"
              href="https://firebase.google.com/pricing"
              target="_blank"
              rel="noreferrer"
            >
              Learn about Blaze pricing ↗
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
