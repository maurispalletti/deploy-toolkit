import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";

export default function Bootstrap({ onRetry }) {
  const url = "https://console.firebase.google.com/?createProject";
  return (
    <Card title="One-time Firebase setup needed"
          sub="Your Google account hasn't accepted Firebase's Terms of Service yet. Google requires the very first Firebase project on an account to be created through the console UI.">
      <ol style={{paddingLeft:20,lineHeight:1.8}}>
        <li>Click the button below — it opens the Firebase Console.</li>
        <li>Create any project (you can call it <code className="codepath">bootstrap</code>; you can delete it after).</li>
        <li>Accept the Firebase Terms of Service when prompted.</li>
        <li>Come back to this tab and click "I've finished — retry".</li>
      </ol>
      <div className="btn-row split">
        <Button variant="secondary" onClick={() => window.open(url, "_blank")}>Open Firebase Console ↗</Button>
        <Button onClick={onRetry}>I've finished — retry</Button>
      </div>
    </Card>
  );
}
