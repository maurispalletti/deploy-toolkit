import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";

export default function Bootstrap({ onRetry }) {
  const url = "https://console.firebase.google.com/?createProject";
  return (
    <Card
      title="First time on Firebase? Quick one-time setup"
      sub="Firebase needs you to accept their terms once before they'll let us create projects for you automatically. It takes about 30 seconds — you only ever do it once per Google account."
    >
      <div className="bootstrap-steps">
        <div className="bootstrap-step">
          <div className="bootstrap-num">1</div>
          <div>
            <div className="bootstrap-title">Open Firebase Console</div>
            <div className="bootstrap-meta">Use the button below — it opens in a new tab.</div>
          </div>
        </div>
        <div className="bootstrap-step">
          <div className="bootstrap-num">2</div>
          <div>
            <div className="bootstrap-title">Create any project there</div>
            <div className="bootstrap-meta">
              You can name it <code className="codepath">throwaway</code> or anything you like — it's
              only used to confirm you've accepted Firebase's terms. You can
              delete it right after.
            </div>
          </div>
        </div>
        <div className="bootstrap-step">
          <div className="bootstrap-num">3</div>
          <div>
            <div className="bootstrap-title">Accept the Firebase terms when asked</div>
            <div className="bootstrap-meta">This is the actual goal — Google needs your agreement to use Firebase.</div>
          </div>
        </div>
        <div className="bootstrap-step">
          <div className="bootstrap-num">4</div>
          <div>
            <div className="bootstrap-title">Come back here and try again</div>
            <div className="bootstrap-meta">We'll pick up where we left off and deploy your app for real this time.</div>
          </div>
        </div>
      </div>
      <div className="btn-row split">
        <Button variant="secondary" onClick={() => window.open(url, "_blank")}>Open Firebase Console ↗</Button>
        <Button onClick={onRetry}>I'm done — try again</Button>
      </div>
    </Card>
  );
}
