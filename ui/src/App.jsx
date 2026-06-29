import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Welcome from "./pages/Welcome.jsx";
import Preflight from "./pages/Preflight.jsx";
import Inspector from "./pages/Inspector.jsx";
import Questions from "./pages/Questions.jsx";
import PlanSummary from "./pages/PlanSummary.jsx";
import Progress from "./pages/Progress.jsx";
import Done from "./pages/Done.jsx";
import Bootstrap from "./pages/Bootstrap.jsx";
import ScratchSetup from "./pages/ScratchSetup.jsx";
import GitHubSetup from "./pages/GitHubSetup.jsx";
import ScaffoldSetup from "./pages/ScaffoldSetup.jsx";
import OpenInIDE from "./pages/OpenInIDE.jsx";
import Prerequisites from "./pages/Prerequisites.jsx";
import IncompatibleApp from "./pages/IncompatibleApp.jsx";
import HardcodedSecretsBlock from "./pages/HardcodedSecretsBlock.jsx";
import SecretsClassify from "./pages/SecretsClassify.jsx";
import AuthScaffoldChoice from "./pages/AuthScaffoldChoice.jsx";
import AuthRefactorPrompt from "./pages/AuthRefactorPrompt.jsx";
import ContinueProject from "./pages/ContinueProject.jsx";
import { getAppDir } from "./api.js";

// Wizard step ID map. The history of these numbers is sticky — earlier
// commits already wired up 1..9 — so we just keep appending for new
// pages rather than renumber.
//
//   1 Welcome
//   2 Preflight
//   3 Inspector
//   4 Questions
//   5 Plan Summary
//   6 Progress
//   7 Done
//   8 Bootstrap (off-the-happy-path 403 recovery)
//   9 IncompatibleApp (D5 block)
//  10 HardcodedSecretsBlock (C6 phase 1)
//  11 SecretsClassify (C6 phase 2)
//  12 AuthScaffoldChoice (A1 path picker — only shown when needsAuth)
//  13 AuthRefactorPrompt (A1 prompt-path content — only shown when authChoice=prompt)
//  14 ScratchSetup (start-from-scratch path: project name + git init + Firebase)
//  15 Prerequisites (scratch path: check/install required tools before ScratchSetup)
//  16 GitHubSetup (scratch path: Firebase project creation)
//  17 ScaffoldSetup (scratch path: Next.js + Shadcn + TanStack scaffold)
//  18 OpenInIDE (scratch path: open project in Cursor / VS Code / Antigravity / Devin)
//  20 ContinueProject (continue path: resume a previously deployed project)

// Routing helper: given an inspection result, pick the next step on the
// happy path. Used after Inspector confirm AND after re-inspections from
// the block pages (so e.g. once the user fixes their secrets, we still
// fall through to Classify if there are env vars to triage).
function nextStepFromInspection(inspection) {
  if (inspection?.dbIncompat) return 9;
  if ((inspection?.hasHardcodedSecrets ?? 0) > 0) return 10;
  const hasEnvKeys =
    (inspection?.secrets?.envRefs?.length ?? 0) > 0 ||
    (inspection?.secrets?.envExampleKeys?.length ?? 0) > 0;
  if (hasEnvKeys) return 11;
  return 4;
}

export default function App() {
  const [appDir, setAppDir] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(1);
  const [inspection, setInspection] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [plan, setPlan] = useState(null);
  // C6 phase-2 classification answers — stored separately from `answers`
  // so the Questions page doesn't need to know about per-key state.
  const [secretsAnswers, setSecretsAnswers] = useState(null);
  // "start from scratch" path: parentDir is where the project subfolder gets created.
  const [scratchParentDir, setScratchParentDir] = useState("");
  const [scratchProjectName, setScratchProjectName] = useState("");
  const [scratchAppDir, setScratchAppDir] = useState("");
  const [scratchRepoUrl, setScratchRepoUrl] = useState("");
  const [flow, setFlow] = useState("unknown"); // "unknown" | "existing" | "scratch" | "continue"
  // Tracks which step the user was on before jumping to step 18 mid-flow.
  // null means step 18 was reached naturally at the end of step 17.
  const [openInIDEFrom, setOpenInIDEFrom] = useState(null);
  // Subset of stage IDs to run in the Progress page. null = run all stages.
  const [progressStages, setProgressStages] = useState(null);

  useEffect(() => {
    getAppDir().then((d) => {
      setAppDir(d || "");
      setLoaded(true);
    });
  }, []);

  // If appDir is pre-set from the CLI and the folder looks like an existing
  // project (saved config, .firebaserc, or git remote), go straight to
  // ContinueProject so the user can re-deploy or add services without re-running
  // the full wizard.
  useEffect(() => {
    if (!appDir || step !== 1) return;
    import("./api.js").then(({ getResumeConfig }) => {
      getResumeConfig(appDir).then((info) => {
        if (info.firebaseProjectId || info.githubRepoUrl) {
          setPlan(info.plan ?? null);
          setFlow("continue");
          setStep(20);
        }
      }).catch(() => {});
    });
  }, [appDir]);

  const next = () => setStep(s => Math.min(7, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  function resetWizard() {
    setStep(1);
    setInspection(null);
    setAnswers(null);
    setPlan(null);
    setSecretsAnswers(null);
    setScratchParentDir("");
    setScratchProjectName("");
    setScratchAppDir("");
    setScratchRepoUrl("");
    setFlow("unknown");
    setOpenInIDEFrom(null);
    setProgressStages(null);
  }

  if (!loaded) return <div className="container">Loading…</div>;

  return (
    <div className="wizard-root">
      <Sidebar
        flow={flow}
        currentStep={step}
        folderReady={!!scratchAppDir}
        onNavigate={(targetStep) => {
          if (targetStep === 18 && step !== 17) setOpenInIDEFrom(step);
          else setOpenInIDEFrom(null);
          setStep(targetStep);
        }}
      />
      <div className="wizard-content page-enter" key={step}>
      {step === 1 && (
        <Welcome
          appDir={appDir}
          onAppDirChange={setAppDir}
          onNext={({ existingProject, existingProjectId } = {}) => {
        setFlow("existing");
        if (existingProject) {
          setAnswers(prev => ({ ...(prev ?? {}), existingProject: true, appName: existingProjectId }));
        }
        setStep(15);
      }}
          onScratch={(parentDir) => {
            setFlow("scratch");
            setScratchParentDir(parentDir);
            setStep(15);
          }}
          onContinue={(resumeInfo) => {
            setPlan(resumeInfo.plan ?? null);
            setFlow("continue");
            setStep(20);
          }}
        />
      )}
      {step === 2 && (
        <Preflight
          onBack={back}
          onNext={next}
        />
      )}
      {step === 3 && <Inspector appDir={appDir} onBack={() => setStep(15)} onConfirm={(i) => {
        setInspection(i);
        // Routing: prefer the block pages (DB incompat, then hardcoded
        // secrets) before the classify page, then Questions.
        setStep(nextStepFromInspection(i));
      }} />}
      {step === 4 && (
        <Questions
          appDir={appDir}
          inspection={inspection}
          defaults={answers}
          onBack={back}
          onNext={(a) => {
            setAnswers(a);
            // A1: if the user said "yes" to sign-in, branch into the
            // AuthScaffoldChoice page before Plan Summary. Otherwise
            // continue straight to step 5.
            if (a.needsAuth) setStep(12);
            else next();
          }}
        />
      )}
      {step === 5 && <PlanSummary appDir={appDir} answers={answers} secretsAnswers={secretsAnswers} onBack={back} onDeploy={(p) => { setPlan(p); next(); }} />}
      {step === 6 && <Progress appDir={appDir} stages={progressStages} onDone={next}
        onError={(err) => {
          if (err.code === "NEEDS_BOOTSTRAP") setStep(8);
          else alert(`Stage ${err.stage} failed (exit ${err.exitCode}).`);
        }} />}
      {step === 7 && <Done plan={plan} onRedeploy={() => { setProgressStages(null); setStep(6); }} onAnother={resetWizard} />}
      {step === 8 && <Bootstrap onRetry={() => setStep(6)} />}
      {step === 9 && (
        <IncompatibleApp
          appDir={appDir}
          inspection={inspection}
          // After re-inspection: route the same way Inspector does. If
          // the user resolved the incompat AND there are no secrets to
          // block on, that lands them on Classify or Questions; if any
          // block remains, they stay on the appropriate block page.
          onRefactor={(fresh) => {
            setInspection(fresh);
            setStep(nextStepFromInspection(fresh));
          }}
          onDeployFrontendOnly={() => {
            // Force shape A — drop the backend from the plan. Same
            // mutation as before: pretend the inspector said no backend
            // so Questions and the planner generate a Shape A/B plan.
            setAnswers({
              ...(answers ?? {}),
              dbIncompatBypass: "frontend-only",
              needsAuth: false,
              needsDb: false
            });
            const adjusted = {
              ...inspection,
              hasBackend: false,
              suggestedShape: inspection.framework === "none" ? "A" : "A_or_B",
              dbIncompat: false
            };
            setInspection(adjusted);
            // Even with the backend dropped, hardcoded secrets and env
            // vars still matter (the frontend bundle is public), so we
            // route through the same helper.
            setStep(nextStepFromInspection(adjusted));
          }}
          onCancel={resetWizard}
        />
      )}
      {step === 10 && (
        <HardcodedSecretsBlock
          appDir={appDir}
          inspection={inspection}
          onRefactor={(fresh) => {
            setInspection(fresh);
            setStep(nextStepFromInspection(fresh));
          }}
          onCancel={resetWizard}
        />
      )}
      {step === 11 && (
        <SecretsClassify
          inspection={inspection}
          defaults={secretsAnswers}
          onBack={() => {
            // Going Back from Classify: most users came from Inspector
            // (step 3), since there were no hardcoded secrets to block.
            // Some came from HardcodedSecretsBlock (step 10) after a
            // successful re-inspection. We send them back to step 3 in
            // either case — the inspector page re-runs the scan and
            // we re-route forward from there.
            setStep(3);
          }}
          onNext={(s) => {
            setSecretsAnswers(s);
            setStep(4);
          }}
        />
      )}
      {step === 12 && (
        <AuthScaffoldChoice
          inspection={inspection}
          onBack={() => setStep(4)}
          onPick={(choice) => {
            // Persist the choice into answers so the planner (called
            // on the Plan Summary step) sees authChoice and renders
            // plan.auth.scaffoldMode correctly.
            setAnswers(prev => ({ ...(prev ?? {}), authChoice: choice }));
            if (choice === "auto") setStep(5);
            else setStep(13);
          }}
        />
      )}
      {step === 13 && (
        <AuthRefactorPrompt
          appDir={appDir}
          inspection={inspection}
          answers={answers}
          onContinue={() => setStep(5)}
        />
      )}
      {step === 14 && (
        <ScratchSetup
          parentDir={scratchParentDir}
          onBack={() => setStep(15)}
          onProjectCreated={(name, dir) => {
            setScratchProjectName(name);
            setScratchAppDir(dir);
            setStep(16);
          }}
        />
      )}
      {step === 15 && (
        <Prerequisites
          onBack={() => setStep(1)}
          onNext={() => flow === "scratch" ? setStep(14) : setStep(3)}
        />
      )}
      {step === 16 && (
        <GitHubSetup
          projectName={scratchProjectName}
          parentDir={scratchParentDir}
          onBack={() => setStep(14)}
          onDone={(name, dir, repo) => {
            setScratchProjectName(name);
            setScratchAppDir(dir);
            setScratchRepoUrl(repo);
            setStep(17);
          }}
        />
      )}
      {step === 17 && (
        <ScaffoldSetup
          projectName={scratchProjectName}
          appDir={scratchAppDir}
          repoUrl={scratchRepoUrl}
          onDone={(newAppDir) => {
            setScratchAppDir(newAppDir);
            setStep(18);
          }}
        />
      )}
      {step === 18 && (
        <OpenInIDE
          appDir={scratchAppDir}
          onDone={() => {
            if (openInIDEFrom !== null) {
              setStep(openInIDEFrom);
              setOpenInIDEFrom(null);
            } else {
              setAppDir(scratchAppDir);
              resetWizard();
            }
          }}
        />
      )}
      {step === 20 && (
        <ContinueProject
          appDir={appDir}
          plan={plan}
          onBack={() => setStep(1)}
          onSetupDeploy={() => { setFlow("existing"); setStep(2); }}
          onQuickDeploy={(p) => {
            setPlan(p);
            setProgressStages(["provision", "restore-env", "build", "deploy"]);
            setStep(6);
          }}
          onFullDeploy={(p) => {
            setPlan(p);
            setProgressStages(null);
            setStep(6);
          }}
        />
      )}
      </div>
    </div>
  );
}
