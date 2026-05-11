# deploy-toolkit

One command to deploy a small app to Firebase. Designed for non-technical users running a "vibecoded" app (Claude-generated, hackathon project, personal tool) who want it on the internet without learning gcloud or wrangling `firebase init`.

## Usage

From inside this folder:

```bash
./deploy-app /path/to/your/app
```

The orchestrator switches to Node 22 via nvm if needed, checks for the Firebase CLI (offers to install it on consent), runs `firebase login` if you aren't authenticated, and then asks a handful of plain-language questions. After that it provisions a Firebase project, builds your app, deploys it, and prints the live URL.

### Smoke test

```bash
./deploy-app samples/static-html
```

Answer the prompts with `n` for the simplest "static page only" path. You'll get a live URL on `*.web.app`.

## Status

| Version | What it is | Tag |
|---|---|---|
| **v0.1** | Terminal-only orchestrator. Verified end-to-end against the `samples/static-html` fixture on 2026-05-08. | `v0.1-cli` |
| **v1.x** | Browser-based wizard UI on top of the same engine. CLI remains as `./deploy-app . --cli`. | *(planned — see `docs/superpowers/specs/`)* |

## Repository layout

```
deploy-toolkit/
├── deploy-app                 ← bash orchestrator (entry point)
├── lib/                       ← Node "brain": inspector, interview, planner
├── stages/                    ← bash stages: preflight, provision, build, deploy, report
├── templates/                 ← default firestore.rules etc.
├── samples/                   ← test fixtures (static-html, vite-react, …)
├── docs/
│   ├── HOW_IT_WORKS.md        ← full stage-by-stage walkthrough
│   ├── REVISIT.md             ← backlog of design topics and open follow-ups
│   ├── ROLLBACK.md            ← how to restore a previous version
│   └── snapshots/             ← frozen copies of past releases
└── README.md                  ← this file
```

## Tests

```bash
npm test          # 33 Node tests covering the brain (inspector / interview / planner)
```

## Further reading

- **How it works (every stage):** [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)
- **Design backlog & open questions:** [docs/REVISIT.md](docs/REVISIT.md)
- **Roll back to a previous version:** [docs/ROLLBACK.md](docs/ROLLBACK.md)
- **Original spec (v0.1):** [../../docs/superpowers/specs/2026-04-15-deploy-small-apps-design.md](../../docs/superpowers/specs/2026-04-15-deploy-small-apps-design.md)
- **Implementation plan (v0.1):** [../../docs/superpowers/plans/2026-05-07-deploy-app-script.md](../../docs/superpowers/plans/2026-05-07-deploy-app-script.md)
