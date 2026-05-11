import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import StatusRow from "../components/StatusRow.jsx";

export default function Welcome({ appDir, onNext }) {
  return (
    <Card title="Let's get your app on the internet"
          sub="We'll set up Firebase Hosting, ask a few quick questions, and deploy.">
      <StatusRow
        state="ok"
        title="Detected app folder"
        meta={<span className="codepath">{appDir}</span>}
      />
      <div className="btn-row split">
        <span className="muted" style={{fontSize:13}}>
          Or use the CLI: <code className="codepath">./deploy-app . --cli</code>
        </span>
        <Button onClick={onNext}>Get started</Button>
      </div>
    </Card>
  );
}
