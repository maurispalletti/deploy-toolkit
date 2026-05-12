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
import IncompatibleApp from "./pages/IncompatibleApp.jsx";
import { getAppDir } from "./api.js";

export default function App() {
  const [appDir, setAppDir] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(1);
  const [inspection, setInspection] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    getAppDir().then((d) => {
      setAppDir(d || "");
      setLoaded(true);
    });
  }, []);

  // If we have an appDir AND we're on the welcome page AND a saved config exists,
  // jump straight to Done. Only check when appDir changes — not after the user picks.
  useEffect(() => {
    if (!appDir || step !== 1) return;
    import("./api.js").then(({ getExistingConfig }) => {
      getExistingConfig(appDir).then(({ existing, plan: existingPlan }) => {
        if (existing) { setPlan(existingPlan); setStep(7); }
      });
    });
  }, [appDir]);

  const next = () => setStep(s => Math.min(7, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  if (!loaded) return <div className="container">Loading…</div>;

  return (
    <div className="container page-enter" key={step}>
      <StepHeader current={step} />
      {step === 1 && (
        <Welcome
          appDir={appDir}
          onAppDirChange={setAppDir}
          onNext={next}
        />
      )}
      {step === 2 && <Preflight onBack={back} onNext={next} />}
      {step === 3 && <Inspector appDir={appDir} onBack={back} onConfirm={(i) => {
        setInspection(i);
        // If the inspector flagged the app as DB-incompatible, jump to the
        // block page instead of forwarding to Questions. The user picks one
        // of three options (refactor prompt / frontend-only / cancel) and
        // we re-route from there.
        if (i.dbIncompat) setStep(9);
        else next();
      }} />}
      {step === 4 && <Questions inspection={inspection} defaults={answers} onBack={back} onNext={(a) => { setAnswers(a); next(); }} />}
      {step === 5 && <PlanSummary appDir={appDir} answers={answers} onBack={back} onDeploy={(p) => { setPlan(p); next(); }} />}
      {step === 6 && <Progress appDir={appDir} onDone={next}
        onError={(err) => {
          if (err.code === "NEEDS_BOOTSTRAP") setStep(8);
          else alert(`Stage ${err.stage} failed (exit ${err.exitCode}).`);
        }} />}
      {step === 7 && <Done plan={plan} onRedeploy={() => setStep(6)} onAnother={() => { setStep(1); setInspection(null); setAnswers(null); setPlan(null); }} />}
      {step === 8 && <Bootstrap onRetry={() => setStep(6)} />}
      {step === 9 && (
        <IncompatibleApp
          appDir={appDir}
          inspection={inspection}
          // After re-inspection: if the user resolved the incompat, forward
          // them to Questions with the fresh inspection. If they didn't,
          // stay on the block page with the fresh evidence.
          onRefactor={(fresh) => {
            setInspection(fresh);
            if (fresh.dbIncompat) {
              // Still incompatible — stay on this page. The page itself
              // resets back to the "decide" stage on the next render
              // because the inspection prop changed.
              setStep(9);
            } else {
              setStep(4);
            }
          }}
          onDeployFrontendOnly={() => {
            // Force shape A — drop the backend from the plan. The
            // Questions page recomputes shape on submit, so we still
            // need a way to communicate "user accepted the bypass".
            // We do it via answers: pre-seed with the bypass flag so
            // Questions can render the heads-up and the planner can
            // see the intent if it ever wants to gate on it.
            setAnswers({
              ...(answers ?? {}),
              dbIncompatBypass: "frontend-only",
              needsAuth: false,
              needsDb: false
            });
            // Pretend the inspector said no backend so Questions and
            // the planner generate a Shape A/B plan. Also clear the
            // dbIncompat flag so going Back from Questions doesn't
            // immediately re-trigger the block on the next confirm.
            setInspection({
              ...inspection,
              hasBackend: false,
              suggestedShape: inspection.framework === "none" ? "A" : "A_or_B",
              dbIncompat: false
            });
            setStep(4);
          }}
          onCancel={() => {
            setStep(1);
            setInspection(null);
            setAnswers(null);
            setPlan(null);
          }}
        />
      )}
    </div>
  );
}
