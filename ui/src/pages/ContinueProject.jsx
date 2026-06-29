import { useState, useEffect } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { getResumeConfig } from "../api.js";

export default function ContinueProject({ appDir, plan: initialPlan, onBack, onQuickDeploy, onFullDeploy, onSetupDeploy }) {
  const [loading, setLoading] = useState(true);
  const [resumeInfo, setResumeInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    getResumeConfig(appDir)
      .then(info => { setResumeInfo(info); setLoading(false); })
      .catch(err => { setLoadError(err.message); setLoading(false); });
  }, [appDir]);

  if (loading) {
    return (
      <Card title="Loading project info…" sub="Reading your Firebase and GitHub setup." />
    );
  }

  if (loadError) {
    return (
      <Card title="Couldn't load project info" sub={loadError}>
        <div className="btn-row">
          <BackButton onClick={onBack} />
        </div>
      </Card>
    );
  }

  const plan = resumeInfo.plan ?? initialPlan;
  const projectId = resumeInfo.firebaseProjectId ?? plan?.firebase?.projectId;
  const githubUrl = resumeInfo.githubRepoUrl;
  const hasDeployConfig = !!plan;

  const consoleUrl = projectId
    ? `https://console.firebase.google.com/project/${projectId}/overview`
    : null;

  return (
    <Card
      title="Welcome back"
      sub={<span className="codepath">{appDir}</span>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {projectId ? (
          <StatusRow
            state="ok"
            title="Firebase project"
            meta={
              <a className="link" href={consoleUrl} target="_blank" rel="noreferrer">
                {projectId}
              </a>
            }
          />
        ) : (
          <StatusRow state="pending" title="Firebase project" meta="No .firebaserc found — run a full deploy to set it up" />
        )}

        {githubUrl ? (
          <StatusRow
            state="ok"
            title="GitHub repository"
            meta={
              <a className="link" href={githubUrl} target="_blank" rel="noreferrer">
                {githubUrl.replace("https://github.com/", "")}
              </a>
            }
          />
        ) : (
          <StatusRow state="pending" title="GitHub repository" meta="No git remote found" />
        )}
      </div>

      {hasDeployConfig ? (
        <>
          <div style={{ marginTop: 20 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              Enabled services
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <StatusRow state="ok" title="Firebase Hosting" meta="Your app is served from here" />
              <StatusRow state="ok" title="Firestore database" meta="Cloud NoSQL database" />
              <StatusRow state="ok" title="Google sign-in" meta="Firebase Authentication" />
            </div>
          </div>

          <div className="btn-row">
            <BackButton onClick={onBack} />
            <Button variant="secondary" onClick={() => onQuickDeploy(plan)}>
              Quick re-deploy
            </Button>
            <Button onClick={() => onFullDeploy(plan)}>
              Full re-deploy
            </Button>
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Quick re-deploy ensures services are enabled, then builds and publishes. It will not create a new Firebase project.
            Full re-deploy runs all setup steps from scratch.
          </p>
        </>
      ) : (
        <>
          <div style={{ marginTop: 20 }}>
            <StatusRow
              state="pending"
              title="Not yet deployed with Builders Toolkit"
              meta="This project has a repo but hasn't been deployed yet. Run the setup wizard to configure Firebase Hosting and publish it."
            />
          </div>
          <div className="btn-row">
            <BackButton onClick={onBack} />
            <Button onClick={onSetupDeploy}>
              Set up deployment →
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
