import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StageCard from "../components/StageCard.jsx";
import { runStage } from "../api.js";

const ALL_STAGES = [
  { id: "provision", name: "Setting up your Firebase project" },
  { id: "inject-secrets", name: "Setting up your app's config values" },
  // inject-auth is a no-op when plan.auth === null, so it's safe to run
  // unconditionally — same pattern as inject-secrets.
  { id: "inject-auth", name: "Wiring up sign-in" },
  // restore-env is a no-op for non-Next.js projects and when .env.local
  // already has the Firebase keys.
  { id: "restore-env", name: "Restoring Firebase environment config" },
  { id: "build", name: "Building your app" },
  { id: "deploy", name: "Putting it on the internet" },
];

const STAGE_NAMES = {
  provision: "Setting up your Firebase project",
  "inject-secrets": "Setting up your app's config values",
  "inject-auth": "Wiring up sign-in",
  "restore-env": "Restoring Firebase environment config",
  build: "Building your app",
  deploy: "Putting it on the internet",
};

export default function Progress({ appDir, stages: stageIds, onDone, onError }) {
  const STAGES = stageIds
    ? stageIds.map(id => ({ id, name: STAGE_NAMES[id] ?? id }))
    : ALL_STAGES;

  const [stageState, setStageState] = useState(() =>
    STAGES.reduce((acc, s) => ({ ...acc, [s.id]: { status: "idle", lines: [] } }), {})
  );
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const stage of STAGES) {
        if (cancelled) return;
        setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "running" } }));
        const result = await runStage(stage.id, appDir, {
          onLog: (line) => setStageState(s => ({
            ...s,
            [stage.id]: { ...s[stage.id], lines: [...s[stage.id].lines, line] }
          })),
          onError: (data) => {
            setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "error" } }));
            onError?.({ stage: stage.id, ...data });
          },
        });
        if (result.exitCode !== 0) {
          setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "error" } }));
          onError?.({ stage: stage.id, exitCode: result.exitCode });
          return;
        }
        setStageState(s => ({ ...s, [stage.id]: { ...s[stage.id], status: "done" } }));
      }
      if (!cancelled) {
        setAllDone(true);
        onDone?.();
      }
    })();
    return () => { cancelled = true; };
  }, [appDir]);

  return (
    <Card
      title="Working on it…"
      sub="Each step might take 10–60 seconds. You can watch the details by clicking a step, or just wait for green checkmarks."
    >
      {STAGES.map((s, i) => (
        <StageCard
          key={s.id}
          name={s.name}
          status={stageState[s.id].status}
          lines={stageState[s.id].lines}
          open={stageState[s.id].status === "running" || stageState[s.id].status === "error"}
        />
      ))}
      {allDone && (
        <div className="btn-row">
          <Button onClick={onDone}>See your live app →</Button>
        </div>
      )}
    </Card>
  );
}
