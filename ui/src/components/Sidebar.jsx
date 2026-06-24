const EXISTING_STEPS = [
  {
    id: "setup",
    label: "Setup",
    desc: "Pick your app folder and choose a path",
    targetStep: 1,
    internalSteps: [1],
  },
  {
    id: "tools",
    label: "Tools check",
    desc: "Verify required CLI tools are installed",
    targetStep: 2,
    internalSteps: [2],
  },
  {
    id: "analyze",
    label: "Analyze app",
    desc: "Detect framework, backend, secrets and env vars",
    targetStep: 3,
    internalSteps: [3, 9, 10],
  },
  {
    id: "configure",
    label: "Configure",
    desc: "Name your app, pick auth and database options",
    targetStep: 4,
    internalSteps: [4, 11, 12, 13],
  },
  {
    id: "plan",
    label: "Review plan",
    desc: "See exactly what will be created on Firebase",
    targetStep: 5,
    internalSteps: [5],
  },
  {
    id: "deploy",
    label: "Deploy",
    desc: "Provision, build and publish your app",
    targetStep: 6,
    internalSteps: [6, 8],
  },
  {
    id: "done",
    label: "Done",
    desc: "Your app is live — grab the URL",
    targetStep: 7,
    internalSteps: [7],
  },
];

const SCRATCH_STEPS = [
  {
    id: "setup",
    label: "Setup",
    desc: "Pick a folder and choose your path",
    targetStep: 1,
    internalSteps: [1],
  },
  {
    id: "prerequisites",
    label: "Prerequisites",
    desc: "Install tools and connect your accounts",
    targetStep: 15,
    internalSteps: [15],
  },
  {
    id: "github",
    label: "GitHub",
    desc: "Init git repo and create GitHub repository",
    targetStep: 14,
    internalSteps: [14],
  },
  {
    id: "firebase",
    label: "Firebase",
    desc: "Create Firebase project",
    targetStep: 16,
    internalSteps: [16],
  },
  {
    id: "scaffold",
    label: "Scaffold",
    desc: "Generate Next.js app with Firebase and Shadcn",
    targetStep: 17,
    internalSteps: [17],
  },
];

export default function Sidebar({ flow, currentStep, onNavigate }) {
  // Always show the full list — default to existing-app path before the
  // user has chosen so the whole journey is visible from the start.
  const steps = flow === "scratch" ? SCRATCH_STEPS : EXISTING_STEPS;

  const activeIndex = steps.findIndex(s => s.internalSteps.includes(currentStep));
  const safeActive  = activeIndex >= 0 ? activeIndex : 0;
  const doneCount   = safeActive;
  const total       = steps.length;
  const overallPct  = Math.round((doneCount / total) * 100);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-flame" />
        <span className="brand-name">deploy-toolkit</span>
      </div>

      <div className="sidebar-meta">
        <span className="sidebar-meta-label">
          {doneCount} of {total} steps
        </span>
        <span className="sidebar-meta-pct">{overallPct}%</span>
      </div>
      <div className="sidebar-bar">
        <div className="sidebar-bar-fill" style={{ width: `${overallPct}%` }} />
      </div>

      <nav className="sidebar-steps">
        {steps.map((s, i) => {
          const isDone   = i < safeActive;
          const isActive = i === safeActive;
          const status   = isDone ? "done" : isActive ? "active" : "pending";
          return (
            <button
              key={s.id}
              className={`sidebar-step ${status}`}
              onClick={() => isDone && onNavigate(s.targetStep)}
              disabled={!isDone && !isActive}
              title={isDone ? `Go back to ${s.label}` : undefined}
            >
              <div className={`sidebar-num ${status}`}>
                {isDone ? "✓" : i + 1}
              </div>
              <div className="sidebar-step-text">
                <div className="sidebar-step-label">{s.label}</div>
                {(isActive || isDone) && (
                  <div className="sidebar-step-desc">{s.desc}</div>
                )}
              </div>
              {isDone && <span className="sidebar-step-pct">100%</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
