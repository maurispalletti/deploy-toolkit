import { useEffect, useState } from "react";
import StepHeader from "./components/StepHeader.jsx";
import Welcome from "./pages/Welcome.jsx";
import Preflight from "./pages/Preflight.jsx";
import Inspector from "./pages/Inspector.jsx";
import Questions from "./pages/Questions.jsx";
import PlanSummary from "./pages/PlanSummary.jsx";
import Progress from "./pages/Progress.jsx";
import Done from "./pages/Done.jsx";
import Bootstrap from "./pages/Bootstrap.jsx";
import { getAppDir } from "./api.js";

const PAGES = ["welcome", "preflight", "inspector", "questions", "plan", "progress", "done"];

export default function App() {
  const [appDir, setAppDir] = useState(null);
  const [step, setStep] = useState(1);
  const [inspection, setInspection] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => { getAppDir().then(setAppDir); }, []);

  useEffect(() => {
    if (!appDir) return;
    import("./api.js").then(({ getExistingConfig }) => {
      getExistingConfig(appDir).then(({ existing, plan }) => {
        if (existing) { setPlan(plan); setStep(7); }
      });
    });
  }, [appDir]);

  const next = () => setStep(s => Math.min(7, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  if (!appDir) return <div className="container">Loading…</div>;

  return (
    <div className="container page-enter" key={step}>
      <StepHeader current={step} />
      {step === 1 && <Welcome appDir={appDir} onNext={next} />}
      {step === 2 && <Preflight onBack={back} onNext={next} />}
      {step === 3 && <Inspector appDir={appDir} onBack={back} onConfirm={(i) => { setInspection(i); next(); }} />}
      {step === 4 && <Questions inspection={inspection} defaults={answers} onBack={back} onNext={(a) => { setAnswers(a); next(); }} />}
      {step === 5 && <PlanSummary appDir={appDir} answers={answers} onBack={back} onDeploy={(p) => { setPlan(p); next(); }} />}
      {step === 6 && <Progress appDir={appDir} onDone={next}
        onError={(err) => {
          if (err.code === "NEEDS_BOOTSTRAP") setStep(8);
          else alert(`Stage ${err.stage} failed (exit ${err.exitCode}).`);
        }} />}
      {step === 7 && <Done plan={plan} onRedeploy={() => setStep(6)} onAnother={() => { setStep(1); setInspection(null); setAnswers(null); setPlan(null); }} />}
      {step === 8 && <Bootstrap onRetry={() => setStep(6)} />}
    </div>
  );
}
