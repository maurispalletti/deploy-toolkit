import { useState, useEffect } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import BackButton from "../components/BackButton.jsx";
import StatusRow from "../components/StatusRow.jsx";
import { getResumeConfig, updatePlanFeatures } from "../api.js";

export default function ContinueProject({ appDir, plan: initialPlan, onBack, onQuickDeploy, onFullDeploy, onSetupDeploy }) {
  const [loading, setLoading] = useState(true);
  const [resumeInfo, setResumeInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [addFirestore, setAddFirestore] = useState(false);
  const [addAuth, setAddAuth] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

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

  const hasFirestore = !!plan?.firestore;
  const hasAuth = !!plan?.auth;

  const hasNewFeatures = addFirestore || addAuth;

  async function handleDeploy(quick) {
    if (hasNewFeatures) {
      setUpdating(true);
      setUpdateError(null);
      try {
        const { plan: updatedPlan } = await updatePlanFeatures(appDir, { addFirestore, addAuth });
        onFullDeploy(updatedPlan);
      } catch (err) {
        setUpdateError(err.message);
        setUpdating(false);
      }
    } else if (quick) {
      onQuickDeploy(plan);
    } else {
      onFullDeploy(plan);
    }
  }

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
              {hasFirestore && (
                <StatusRow state="ok" title="Firestore database" meta="Cloud NoSQL database" />
              )}
              {hasAuth && (
                <StatusRow state="ok" title="Google sign-in" meta="Firebase Authentication" />
              )}
            </div>
          </div>

          {(!hasFirestore || !hasAuth) && (
            <div style={{ marginTop: 20 }}>
              <div className="muted" style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
                Add services
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!hasFirestore && (
                  <label className="feature-toggle">
                    <input
                      type="checkbox"
                      checked={addFirestore}
                      onChange={e => setAddFirestore(e.target.checked)}
                    />
                    <div className="feature-toggle-body">
                      <div className="feature-toggle-title">Firestore database</div>
                      <div className="feature-toggle-meta">
                        Add a cloud NoSQL database and deploy security rules.
                      </div>
                    </div>
                  </label>
                )}
                {!hasAuth && (
                  <label className="feature-toggle">
                    <input
                      type="checkbox"
                      checked={addAuth}
                      onChange={e => setAddAuth(e.target.checked)}
                    />
                    <div className="feature-toggle-body">
                      <div className="feature-toggle-title">Google sign-in</div>
                      <div className="feature-toggle-meta">
                        Wire up Firebase Authentication with a Google sign-in button.
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}

          {updateError && (
            <div className="muted" style={{ marginTop: 12, fontSize: 13, color: "var(--red)" }}>
              {updateError}
            </div>
          )}

          <div className="btn-row">
            <BackButton onClick={onBack} />
            {!hasNewFeatures && (
              <Button variant="secondary" onClick={() => handleDeploy(true)} disabled={updating}>
                Quick re-deploy
              </Button>
            )}
            <Button onClick={() => handleDeploy(false)} disabled={updating}>
              {updating
                ? "Saving…"
                : hasNewFeatures
                ? "Add & Deploy"
                : "Full re-deploy"}
            </Button>
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Quick re-deploy ensures Hosting and Firestore are enabled, then builds and publishes. It will not create a new Firebase project.
            Full re-deploy runs all setup steps from scratch and will create a new Firebase project if one isn't configured yet.
          </p>
        </>
      ) : (
        <>
          <div style={{ marginTop: 20 }}>
            <StatusRow
              state="pending"
              title="Not yet deployed with deploy-toolkit"
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
