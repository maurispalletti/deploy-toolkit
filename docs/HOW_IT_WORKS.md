# How `deploy-app` Works

Plain-English walkthrough of every step the script takes when you run `./deploy-app <path-to-your-app>`. Skim the headings or read end to end.

## TL;DR

`deploy-app` is a thin bash orchestrator that runs six stages in order. The "brain" stage looks at your folder, asks a few questions, and writes a `deploy-app.config.json` that captures all the decisions. The remaining stages use that config to create a Firebase project, build your code, and deploy it. Re-running the script reuses the saved config and skips the questions.

## The 6 stages at a glance

| # | Stage | File | What it does |
|---|---|---|---|
| 1 | Preflight | `stages/preflight.sh` | Verify Node, Firebase CLI, and login |
| 2 | Brain | `lib/brain.mjs` | Inspect folder, interview, write config |
| 3 | Provision | `stages/provision.sh` | Create Firebase project, write Firebase files |
| 4 | Build | `stages/build.sh` | Run `npm install` + your build command |
| 5 | Deploy | `stages/deploy.sh` | Run `firebase deploy --only ...` |
| 6 | Report | `stages/report.sh` | Print the live URL |

The orchestrator (`deploy-app`) also does one thing before stage 1: if `nvm` is installed and your shell is on a Node version other than the one in `.nvmrc` (currently `22`), it sources `nvm.sh` and runs `nvm use 22`, installing it first if needed. That means you don't have to manually run `nvm use` before invoking the script.

## Stage 1 — Preflight (`stages/preflight.sh`)

Three checks, fail-fast:

1. **Node 22+.** Reads `process.versions.node` and exits if the major version is below 22. The orchestrator already tries to switch via nvm, so this is the safety net for users without nvm.
2. **Firebase CLI present.** Runs `command -v firebase`. If missing, it prompts: `Install it now via 'npm install -g firebase-tools'? [Y/n]`. Default is yes; on consent it runs the install for you.
3. **Firebase login.** Calls `firebase projects:list` and, if that fails, runs `firebase login` (which opens a browser).

Then it shows which Google account is currently active by parsing `firebase login:list`:

```
Logged in as: you@example.com
If this is the wrong account, run: firebase logout && firebase login
```

This catches the most common silent failure: being logged into a work account when you meant to deploy to a personal one.

## Stage 2 — Brain (`lib/brain.mjs`)

The brain decides everything about your app and writes the result to `deploy-app.config.json` in the app folder. It runs three sub-stages: **Inspector**, **Interview**, **Planner**.

**Idempotency:** If `deploy-app.config.json` already exists, `runBrain` reads it and returns immediately, skipping all three sub-stages. That's why subsequent runs are silent — to start fresh, delete the file.

### 2a — Inspector (`lib/inspector/`)

Pure file-system inspection — no questions, no network. Runs five small modules and combines their output:

- **`read-package.mjs`** — reads `package.json` if present.
- **`detect-framework.mjs`** — looks at deps to label the framework: `nextjs`, `vite-react`, `cra`, `express`, `unknown`, or `none` (no `package.json`).
- **`find-output-dir.mjs`** — based on framework, checks for the conventional build output folder. For `vite-react` it looks for `dist`; for `cra`, `build`; for `nextjs`, `out` then `.next`. For `none`, the output is `.` (the folder itself is what gets served).
- **`has-backend.mjs`** — returns `true` if the framework is `express`, or if the folder contains `functions/`, `api/`, `server/`, or `server.js`.
- **`read-env-example.mjs`** — parses `.env.example` and returns the list of variable names (the keys, not values).

It then suggests a "shape":

- `C` if there's a backend
- `A` if there's no `package.json`
- `A_or_B` otherwise (a JS frontend that might or might not need Firebase services)

The result looks like:

```js
{
  appDir: "/path/to/app",
  framework: "vite-react",
  outputDir: "dist",
  hasBackend: false,
  envKeys: ["VITE_API_KEY"],
  suggestedShape: "A_or_B",
  pkgName: "my-app"
}
```

### 2b — Interview (`lib/interview/`)

Three questions, asked via `readline` on stdin/stdout. These are visible to the user during the run:

1. `What name for this app? (used as Firebase project ID) [my-app]:` — defaults to `pkgName`.
2. `Will users need to log in? (y/N)` — defaults to no.
3. `Does the app need to remember things between visits? (Y/n)` — asks about Firestore.

How answers map to a shape:

- If the inspector already saw a backend (`suggestedShape === "C"`), shape stays **C** regardless of the answers.
- Else if the user said yes to either auth or "remember things", shape becomes **B**.
- Else shape is **A**.

For shape **C** only, the interview prints a Blaze warning and asks one more question:

```
This app has backend code. Cloud Functions require Firebase's pay-as-you-go (Blaze) plan.
There's still a free monthly quota — you only pay if usage exceeds it.
You'll need a credit card on file. Upgrade page: https://console.firebase.google.com/project/_/usage/details

Continue and upgrade later when prompted? (Y/n)
```

The answer is stored as `acceptedBlaze` but doesn't gate anything in v1 — the user just gets a heads-up before `firebase deploy` later asks them to upgrade.

### 2c — Planner (`lib/planner/`)

Combines the inspection + interview answers into the final `deploy-app.config.json`.

**Project ID generation.** The app name is slugified (lowercased, non-alphanumerics collapsed to `-`, trimmed to 25 chars) and a 4-character random suffix is appended:

```js
slugify("My Cool App") + "-" + shortSuffix()  // -> "my-cool-app-k3p9"
```

The suffix avoids collisions with existing Firebase project IDs (which must be globally unique).

Example output for a shape-B Vite/React app with auth + Firestore:

```json
{
  "appName": "my-app",
  "shape": "B",
  "firebase": { "projectId": "my-app-k3p9" },
  "hosting": {
    "publicDir": "dist",
    "rewrites": []
  },
  "auth": { "providers": ["google"] },
  "firestore": { "rulesFile": "firestore.rules" },
  "functions": null,
  "build": {
    "command": "npm run build",
    "outputDir": "dist"
  }
}
```

For shape **C**, `hosting.rewrites` gets `[{ source: "/api/**", function: "api" }]` and `functions` becomes `{ dir: "functions", region: "europe-west3", secrets: [...envKeys] }`.

For shape **A** (no `package.json`), `build.command` is `null` so the build stage is skipped.

## Stage 3 — Provision (`stages/provision.sh`)

Creates the cloud project and writes the Firebase config files into your app folder.

> A Firebase project is just a Google Cloud (GCP) project with Firebase services enabled on top of it. Hosting, Auth, Firestore, and Functions are all GCP services exposed through the Firebase CLI. So when this stage "creates a Firebase project," it's really creating a GCP project and registering it with Firebase.

What it does, in order:

1. **Reads** `deploy-app.config.json` to extract `projectId`, `shape`, `publicDir`, and whether Firestore/Functions are needed.
2. **Creates the project** if it doesn't already exist:
   ```
   firebase projects:create <projectId> --display-name <projectId>
   ```
   It first runs `firebase projects:list` and `grep`s for the ID to make this idempotent.
3. **Writes `.firebaserc`** with `{"projects":{"default":"<projectId>"}}` so subsequent `firebase` commands target the right project automatically.
4. **Writes `firebase.json`** by composing an object from the config — always includes `hosting`, optionally adds `firestore` and `functions` blocks.
5. **Copies `templates/firestore.rules`** to the app folder if Firestore is configured and no rules file exists yet. The default rules let an authenticated user read/write only their own `users/{uid}` document; everything else is denied.

## Stage 4 — Build (`stages/build.sh`)

Reads `build.command` from the config:

- If empty (shape A with no `package.json`), prints `No build command configured (static app); skipping` and exits cleanly.
- Otherwise, runs `npm install` if `node_modules/` is missing, then `eval`s the build command (currently always `npm run build`).

## Stage 5 — Deploy (`stages/deploy.sh`)

Builds a comma-separated `--only` target list based on what's in the config:

- `hosting` — always
- `firestore` — added when `firestore` is non-null
- `functions` — added when `functions` is non-null

Then runs:

```
firebase deploy --only hosting[,firestore][,functions]
```

The Firebase CLI uses the `.firebaserc` written in stage 3 to know which project to deploy to.

## Stage 6 — Report (`stages/report.sh`)

Prints a heredoc with:

- The live URL: `https://<projectId>.web.app`
- The Firebase Console link: `https://console.firebase.google.com/project/<projectId>/overview`
- A one-liner reminding them how to redeploy: `deploy-app <appDir>`
- The command for tailing function logs (only useful for shape C, but printed regardless)

## The three app shapes

| Shape | What it is | Firebase services | Plan |
|---|---|---|---|
| **A** | Pure static site (HTML/CSS/JS, no `package.json`, or a built frontend with no auth/db) | Hosting only | Free (Spark) |
| **B** | Frontend that talks to Firebase Auth and/or Firestore directly via the JS SDK — no custom backend code | Hosting + Auth + Firestore | Free (Spark) |
| **C** | Frontend plus your own backend code in `functions/` | Hosting + Cloud Functions (+ optional Auth/Firestore) | Blaze (pay-as-you-go) — has a free monthly quota |

The shape is chosen by the brain in stage 2: backend detection forces C; then the auth/db questions in the interview decide between A and B.

## Common failure modes and fixes

- **Wrong Firebase account active.** The preflight step prints the active account; if it's wrong, run `firebase logout && firebase login` and re-run.
- **First Firebase project on a brand-new Google account fails with `403 PERMISSION_DENIED` on the `addFirebase` call.** Google requires you to manually create one project via the Firebase Console UI first to bootstrap permissions and accept the TOS. After that, CLI project creation works.
- **Project ID conflicts.** Project IDs are globally unique across all of Google Cloud. The planner appends a random 4-character suffix, so collisions are rare; if one happens, delete `deploy-app.config.json` and re-run to generate a new ID.
- **Stale `deploy-app.config.json`.** Because the brain skips the interview when this file exists, edits to your app's structure won't be re-detected. Delete the file to start fresh.
- **Node version too old.** The orchestrator tries `nvm use 22` automatically; if you don't have nvm, install it (or upgrade Node to 22+) and re-run.

## Further reading

- Spec: `docs/superpowers/specs/2026-04-15-deploy-small-apps-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-07-deploy-app-script.md`
