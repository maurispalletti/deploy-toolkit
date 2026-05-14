import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";

// The Done page summarises a successful deploy AND surfaces any manual
// follow-ups the toolkit couldn't automate. Today: enabling the Google
// sign-in provider in Firebase Console. We model this as a small
// checklist so the user can see what's left and tick items off as they
// complete them. The ticks are local state — we trust the user when
// they say "done" rather than polling Firebase.

export default function Done({ plan, onRedeploy, onAnother }) {
  const projectId = plan?.firebase.projectId;
  const url = `https://${projectId}.web.app`;
  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/overview`;
  const authUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;

  const needsAuth = plan?.auth !== null;
  const hasFirestore = plan?.firestore !== null;

  // Track which checklist items the user has marked done. Each entry is
  // a stable item id; the renderer maps it to a label + action.
  const [done, setDone] = useState(() => ({}));
  const mark = (id) => setDone(d => ({ ...d, [id]: true }));

  const items = [];

  if (needsAuth) {
    items.push({
      id: "enable-google-signin",
      title: "Turn on Google sign-in",
      body: (
        <>
          Firebase has your project set up, but the Google sign-in provider
          itself needs to be flipped on in the console (no API for this —
          it's a 30-second click). Until you do this, the Sign-in button in
          your app will fail with <code className="codepath">auth/configuration-not-found</code>.
        </>
      ),
      action: {
        label: "Open sign-in settings",
        href: authUrl,
      },
    });
  }

  if (hasFirestore) {
    items.push({
      id: "firestore-database-ready",
      title: "Confirm your database is ready",
      body: (
        <>
          We've deployed the security rules, but a brand-new Firebase project
          sometimes needs the Firestore database itself to be initialized via
          the console (click "Create database" → pick a region). If your app
          can read and write data already, this is already done.
        </>
      ),
      action: {
        label: "Open Firestore",
        href: `https://console.firebase.google.com/project/${projectId}/firestore`,
      },
    });
  }

  const remaining = items.filter(it => !done[it.id]);
  const finished = items.filter(it => done[it.id]);

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

        {items.length > 0 && (
          <div className="done-checklist">
            <div className="done-checklist-title">
              {remaining.length > 0
                ? `What's left for you to do (${remaining.length})`
                : "All set!"}
            </div>

            {remaining.map(it => (
              <div key={it.id} className="checklist-item pending">
                <button
                  className="checklist-tick"
                  onClick={() => mark(it.id)}
                  aria-label={`Mark "${it.title}" as done`}
                />
                <div className="checklist-body">
                  <div className="checklist-item-title">{it.title}</div>
                  <div className="checklist-item-text">{it.body}</div>
                  <div className="checklist-item-actions">
                    <a
                      className="link"
                      href={it.action.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        // Don't auto-tick — only the manual tick counts as
                        // "user confirmed". But it's fine to open the page.
                      }}
                    >
                      {it.action.label} ↗
                    </a>
                    <button
                      className="checklist-done-btn"
                      onClick={() => mark(it.id)}
                    >
                      I've done it
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {finished.map(it => (
              <div key={it.id} className="checklist-item completed">
                <div className="checklist-tick checked">✓</div>
                <div className="checklist-body">
                  <div className="checklist-item-title">{it.title}</div>
                </div>
              </div>
            ))}
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
