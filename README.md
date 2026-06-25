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

### Fresh laptop setup

Got a new Mac and want to get everything in one shot? There are two ways depending on how you're set up:

**Using Claude Code** — run `/setup` from inside this repo. It will install and/or update every tool you need, log you in to GitHub and Firebase, and clone the repo into `~/Documents/deploy-toolkit`.

**Using the terminal** — run this from anywhere:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/maurispalletti/deploy-toolkit/main/setup.sh)
```

Or if you already have the repo cloned:

```bash
./setup.sh
```

If you don't have Claude Code yet and prefer to use [Claude](https://claude.ai) on the web, paste the prompt below and it will walk you through the same steps interactively.

<details>
<summary>Click to expand the web Claude prompt</summary>

```
Check and install all required CLI tools, then ensure the user is authenticated with GitHub CLI and Firebase CLI.

Run each step below in sequence:

## 1. Install or update all tools

For each tool below, if it is **already installed** run the update command; if it is **not installed** run the install command:

- **homebrew** ⚠️ runs as sudo
  - check: `brew --version`
  - install: `sudo /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/homebrew/install/HEAD/install.sh)"`
  - update: `brew update && brew upgrade`

All remaining tools run with regular user permissions (no sudo):

- **git**
  - check: `git --version`
  - install: `brew install git`
  - update: `brew upgrade git`

- **gh**
  - check: `gh --version`
  - install: `brew install gh`
  - update: `brew upgrade gh`

- **node**
  - check: `node --version`
  - install: `brew install node`
  - update: `brew upgrade node`

- **firebase**
  - check: `firebase --version`
  - install: `npm install -g firebase-tools`
  - update: `npm update -g firebase-tools`

Report each tool's status (updated / freshly installed / failed) and the version after the operation.

## 2. Check GitHub CLI auth

Run `gh auth status`. If the user is not logged in (exit code non-zero or output says "not logged in"), tell them to run:
\`\`\`
gh auth login
\`\`\`
and wait for them to confirm before continuing.

## 3. Check Firebase CLI auth

Run `firebase projects:list` (a lightweight authenticated call). If it fails with an auth error, tell the user to run:
\`\`\`
firebase login
\`\`\`
and wait for them to confirm they've completed the login before continuing.

## 4. Clone the repository

Check if `~/Documents/deploy-toolkit` already exists:

- If it **does not exist**, clone it:
  \`\`\`
  git clone https://github.com/maurispalletti/deploy-toolkit ~/Documents/deploy-toolkit
  \`\`\`
- If it **already exists**, pull the latest changes instead:
  \`\`\`
  git -C ~/Documents/deploy-toolkit pull
  \`\`\`

Report whether the repo was freshly cloned or updated.

## 5. Summary

Print a table showing each tool's installed version, auth status, and whether the repo was cloned or updated.
```

</details>


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
