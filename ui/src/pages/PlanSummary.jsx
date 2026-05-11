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

  return (
    <Card title="Here's the plan" sub="Review before we deploy. Nothing has been created yet.">
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
