# deploy-toolkit

**One command to put your app on the internet.**

Built for non-developers running small apps they didn't necessarily code by hand — Claude / Cursor / Cody-generated projects, weekend hackathon prototypes, personal tools — who want to share their app with a friend or the world without learning Google Cloud or fighting with config files.

> **Heads up:** this isn't a hosting service or a website you sign up for. It's a small tool you run on your own computer. It talks to Google's Firebase on your behalf — your code never goes through us.

```bash
./deploy-app /path/to/your/app
```

A browser tab opens with a wizard. You answer a few plain-language questions ("does your app need to remember things?", "will users sign in?"). The wizard handles the rest — creates a free workspace on Google's servers, sets up the database and sign-in if you need them, builds your app, and puts it on the internet. You end with a URL like `your-app.web.app` you can share with anyone.

After that first command, you don't need the terminal again.

---

## Will it work for my app?

If your app fits any of these, yes:

- **Just HTML + JavaScript + CSS?** Yes — totally free, forever.
- **React, Next.js, Vue, or any modern framework that builds to static files?** Yes — totally free.
- **App that needs sign-in and/or a database?** Yes — totally free for personal-scale traffic.
- **App with a Node.js server component?** Yes — but Google requires a credit card on file for these (usually still $0/month in practice for small apps).

**Won't work today** for apps that depend on a local database like sqlite, postgres, mysql, or mongodb — those don't run on Firebase. But the wizard catches this *before* trying to deploy and gives you a clear prompt you can paste into Claude Code or another AI tool to help migrate your app.

## What you'll need

- macOS (the wizard's folder picker is macOS-only today; Linux/Windows work too, but you pass the folder on the command line)
- A Google account
- A few minutes

Everything else (Node.js, Firebase tools) the wizard installs or sets up for you.

## Quick start

```bash
# Clone this repo
git clone https://github.com/maurispalletti/deploy-toolkit.git
cd deploy-toolkit

# Run the wizard
./deploy-app
```

That's it. A browser tab opens. Pick your app folder, answer the questions, watch the colored checkmarks. You'll have a live URL in about 2 minutes.

For the complete walkthrough — every wizard page, every question, every "what does this mean?", and what to do if anything goes wrong — see **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## Something not working?

1. **Check the [User Guide's troubleshooting section](docs/USER_GUIDE.md#9-troubleshooting) first** — most common issues have a quick answer there.
2. Still stuck? File an issue at https://github.com/maurispalletti/deploy-toolkit/issues. Include what you tried, what happened, and a screenshot if you have one.
3. Curious about something the tool doesn't do yet? Check [docs/REVISIT.md](docs/REVISIT.md) — it's a running list of design topics with priority tags. Many "what about X?" things are already on the radar.

## License

MIT — see [LICENSE](LICENSE).

---

## For developers

The rest of this section is for people who want to look inside the toolkit, contribute, or roll back a version.

### Current version

1.x — improving as colleagues use it. The `v0.1-cli` tag points at the original terminal-only version if you want to fall back.

### Inside this repo

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

### Running the tests

```bash
nvm use 24    # the test runner needs Node 22+ for glob expansion
npm test      # ~94 tests covering the brain + refactor-prompts + sdk-config
```

### Further developer docs

- **How every stage works internally** — [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)
- **Design backlog & open questions** — [docs/REVISIT.md](docs/REVISIT.md)
- **Roll back to a previous version** — [docs/ROLLBACK.md](docs/ROLLBACK.md)
- **Hand-off prompts for external AI agents** — [docs/prompts/](docs/prompts/)
