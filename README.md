# deploy-toolkit

**One command to put a small app on the internet using Firebase.**

Built for non-technical people running "vibecoded" apps — Claude/Cursor/Cody-generated projects, hackathon prototypes, personal tools — who want to share their app with a friend or the world without learning `gcloud`, `firebase init`, or what a Cloud Function is.

```bash
./deploy-app /path/to/your/app
```

Your browser opens. You answer three plain-language questions ("does your app need a database?", "will users sign in?"). The wizard handles the rest: creates the Firebase project, sets up hosting + database + auth, builds your app, deploys it. You land on a page with a live URL you can share.

No terminal interaction past that one command.

---

## Who this is for

- You have an app folder on your laptop, and you want it on the internet.
- You're on macOS (Linux / Windows work in CLI mode; the wizard's folder picker is macOS-only today).
- You have a Google account.
- You don't want to learn cloud platforms before showing your app to someone.

## What apps it handles

The wizard recognizes three architectures and handles each end-to-end:

- **Static-only** — plain HTML, or a Vite/React/Next.js/CRA app that builds to static files. **Free forever on Firebase's Spark plan.**
- **Frontend + Firebase services** — same as above, but your app talks directly to Firestore + Google sign-in from the browser. The wizard scaffolds the sign-in code for Vite-React apps. **Free.**
- **Frontend + backend** — Express running as a Cloud Function. Requires Firebase's Blaze plan (credit card needed, but small apps typically cost $0/month).

If your app uses an incompatible local database (sqlite, postgres, mysql, mongodb, local file writes), the wizard detects this **before** deploying and generates a refactor prompt you can paste into Claude Code or another AI tool to migrate to Firestore.

## Quick start

```bash
# Clone the toolkit
git clone <repo-url> deploy-toolkit
cd deploy-toolkit

# Run the wizard
./deploy-app
```

That's it. The wizard handles Node version switching (via nvm), installs the Firebase CLI if missing, and walks you through Google sign-in for Firebase.

The terminal-only flow is `./deploy-app /path/to/app --cli` — same engine, no browser.

For the complete walkthrough — every wizard page, every prompt, every error and its recovery — see **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## Status

| Version | What it is | Tag |
|---|---|---|
| **v0.1** | Terminal-only orchestrator. Verified end-to-end on `samples/static-html`. | `v0.1-cli` |
| **v1.x** | Browser-based wizard UI. Auto-scaffolds Google sign-in into Vite-React apps. Detects incompatible databases and hardcoded secrets. CLI preserved as `./deploy-app . --cli`. | *(current `master`)* |

## Repository layout

```
deploy-toolkit/
├── deploy-app                 bash orchestrator (entry point)
├── lib/                       Node "brain": inspector, interview, planner, refactor prompts
├── stages/                    bash stages: preflight, provision, inject-secrets, inject-auth, build, deploy, report
├── templates/                 default firestore.rules + sign-in component
├── samples/                   working sample apps for end-to-end testing
├── ui/                        wizard server (Express) + React frontend
└── docs/                      user guide, how it works, design backlog
```

## Running the tests

```bash
nvm use 24    # the test runner needs Node 22+ for glob expansion
npm test      # ~94 tests covering the brain + refactor-prompts + sdk-config
```

## Further reading

- **Full user guide** — [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **How every stage works internally** — [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)
- **Design backlog & open questions** — [docs/REVISIT.md](docs/REVISIT.md)
- **Roll back to a previous version** — [docs/ROLLBACK.md](docs/ROLLBACK.md)
- **Hand-off prompts for external AI agents** — [docs/prompts/](docs/prompts/)

## License

MIT — see [LICENSE](LICENSE).
