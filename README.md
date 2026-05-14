# deploy-toolkit

One command to deploy a small app to Firebase. Designed for non-technical users running a "vibecoded" app (Claude-generated, hackathon project, personal tool) who want it on the internet without learning gcloud or wrangling `firebase init`.

## Usage

From inside this folder:

```bash
./deploy-app /path/to/your/app
```

A browser tab opens with a wizard that walks you through everything — checking your tools, asking a few plain-language questions, and deploying. No terminal needed past the first command.

Power users can fall back to the terminal-only flow:

```bash
./deploy-app /path/to/your/app --cli
```

## Status

| Version | What it is | Tag |
|---|---|---|
| **v0.1** | Terminal-only orchestrator. Verified end-to-end against the `samples/static-html` fixture on 2026-05-08. | `v0.1-cli` |
| **v1.x** | Browser-based wizard UI on top of the same engine. CLI remains as `./deploy-app . --cli`. | *(in progress on `master`)* |

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
npm test          # Node tests covering the brain (inspector / interview / planner) + refactor-prompts
```

## Further reading

- **Full user guide:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **How it works (every stage):** [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)
- **Design backlog & open questions:** [docs/REVISIT.md](docs/REVISIT.md)
- **Roll back to a previous version:** [docs/ROLLBACK.md](docs/ROLLBACK.md)
- **Hand-off prompts for external AI agents:** [docs/prompts/](docs/prompts/)
