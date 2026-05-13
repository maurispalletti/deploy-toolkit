import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";

export default function Done({ plan, onRedeploy, onAnother }) {
  const projectId = plan?.firebase.projectId;
  const url = `https://${projectId}.web.app`;
  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/overview`;
  const authUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
  const needsAuth = plan?.auth !== null;

  return (
    <Card className="done">
      <div className="done-card">
        <div className="done-emoji">🎉</div>
        <h2>Your app is on the internet</h2>
        <p className="done-sub">
          Anyone with this link can open it from anywhere. Bookmark it, share it,
          or send it to yourself.
        </p>
        <a className="done-url" href={url} target="_blank" rel="noreferrer">{url}</a>

        {needsAuth && (
          <div className="done-note">
            <div className="done-note-title">🔐 One more thing for sign-in to work</div>
            <div className="done-note-text">
              You said users will sign in. Firebase has the project set up, but you
              still need to turn on Google sign-in in the Firebase console (a
              one-time click). After that, add a sign-in button to your app's code.
            </div>
            <Button variant="secondary" onClick={() => window.open(authUrl, "_blank")}>
              Open sign-in settings ↗
            </Button>
          </div>
        )}

        <div className="done-actions">
          <Button onClick={() => window.open(url, "_blank")}>Open my app ↗</Button>
          <Button variant="secondary" onClick={() => window.open(consoleUrl, "_blank")}>
            Manage on Firebase ↗
          </Button>
          <Button variant="secondary" onClick={onRedeploy}>Deploy a fresh build</Button>
          <Button variant="secondary" onClick={onAnother}>Deploy a different app</Button>
        </div>

        <p className="done-tip">
          Made changes to your app? Just run <code className="codepath">./deploy-app</code> again
          — we'll remember this folder and skip straight to the deploy.
        </p>
      </div>
    </Card>
  );
}
