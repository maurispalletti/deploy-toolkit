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
        <h2>Your app is live</h2>
        <a className="done-url" href={url} target="_blank" rel="noreferrer">{url}</a>
        <div className="done-actions">
          <Button onClick={() => window.open(url, "_blank")}>Open site ↗</Button>
          {needsAuth && (
            <Button variant="secondary" onClick={() => window.open(authUrl, "_blank")}>
              🔐 Enable Google sign-in
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.open(consoleUrl, "_blank")}>View console</Button>
          <Button variant="secondary" onClick={onRedeploy}>Redeploy</Button>
          <Button variant="secondary" onClick={onAnother}>Deploy another app</Button>
        </div>
      </div>
    </Card>
  );
}
