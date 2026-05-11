# REVISIT

The canonical list of design topics, follow-ups, and known gaps that have come up while building `deploy-toolkit`. Anything not in the current scope but worth keeping on the radar lives here.

Items are tagged by area and rough priority. Priority is the writer's guess and not load-bearing — feel free to disagree.

| Priority | Meaning |
|---|---|
| **P1** | Real user-facing gap. Should land in the next release. |
| **P2** | Improves the product. Land when there's bandwidth. |
| **P3** | Nice-to-have. Land if it becomes worth it. |
| **research** | Open question, no decision yet. |

---

## A. Auth & sign-in

### A1 — Scaffold a sign-in component for known frameworks (option B) — **P1**

Today, when the wizard's "Will users sign in?" question is `yes`, the planner sets `auth.providers: ["google"]`, the report stage prints a deep-link to enable Google sign-in in the Firebase Console — and **the user's app code is never touched**. The deployed app still doesn't gate anything until the user adds Firebase Auth themselves.

For known frameworks (Vite-React, Next.js, plain HTML) we could scaffold a minimal `<SignInWithGoogle />` component and inject the Firebase config into the project automatically. The wizard would ask which page/route to gate.

Scope: per-framework templates, AST edits to inject imports into the entry component, generated `firebase-config.js` file populated from `firebase apps:sdkconfig`.

### A2 — Programmatic auth-provider enable — **research**

There is no clean Firebase CLI command to enable an auth provider. The Identity Toolkit REST API can do it but requires different OAuth scopes and admin setup. Investigate whether we can do this with the user's existing CLI login or whether we have to keep punting to the console UI.

### A3 — Other auth providers — **P3**

v1 only mentions Google. Apple, GitHub, email/password, anonymous, etc. all live behind the same Firebase Auth surface. Easy to extend the planner; harder is the UX for asking "which providers?" without overwhelming non-technical users.

## B. First-run friction

### B1 — Detect first-run 403 in CLI mode — **P2**

The UI wrapper (v1.x) handles the `addFirebase` 403 with a dedicated "First-time setup" page. The CLI mode still surfaces it as a cryptic stack trace dumped via `firebase-debug.log`. Mirror the UI's friendly handling in `stages/provision.sh`: detect the 403, print a plain-language message + console URL, exit cleanly, leave the orphan GCP project to be reused on retry.

### B2 — Auto-clean orphan GCP projects on retry — **P2**

When `addFirebase` fails the GCP project is left dangling. A retry currently creates yet another orphan. The provisioner should detect the orphan and `addFirebase` to it directly instead of creating a new one each retry, or delete it before retrying.

### B3 — `firebase login` flow — **P3**

Firebase CLI opens its own OAuth tab. In the UI, we'll poll for completion (spec §6.3 `/api/login`). Verify the polling interval and timeout feel right under real network conditions, not just on a fast laptop.

## C. App scaffolding & inputs

### C1 — GitHub starter clone — **P2**

The original meeting envisioned `./deploy-app https://github.com/foo/template` cloning a starter before deploying. Adds a fourth shape to the inspector: "no folder yet, clone first." Mostly useful once the toolkit ships beyond Mauricio.

### C2 — npx publishing — **P2**

Friendliest install for non-tech users: `npx deploy-toolkit`. Requires publishing to npm under a unique name, deciding on versioning, README polish, license, etc. Defer until the toolkit is stable enough to recommend to others.

### C3 — Folder picker in the UI — **P3**

The wizard currently confirms the folder the user passed on the CLI. Adding drag-and-drop or a native folder picker would let the user change the target mid-wizard. The browser File System Access API works in Chrome/Edge but not Firefox/Safari.

### C4 — GitHub persistence for the user's app — **P1**

A non-technical user with a vibecoded app on their laptop doesn't have version control. If they delete the folder, the app is gone. Offer a new optional wizard step between Plan and Build: "Would you like to save this code to GitHub?" — uses `gh` CLI with the same install-on-consent treatment we did for `firebase`. Asks for repo name + visibility (private default). Creates the repo and pushes the initial commit. Subsequent redeploys also push. Real feature, real value; should land before this tool sees external users.

### C5 — "I don't know what my app needs" path — **P2**

The inspector already detects framework/backend/secrets from code, so the user doesn't strictly need to know. The remaining gap is the wizard's plain-language questions ("Will users sign in?", "Does the app need a database?"). If the user can't answer, add an "I'm not sure" option per question that picks the safest default (no auth, no DB, Shape A) and shows a follow-up: "You can add this later by re-running the wizard." Cost: small UI change, one extra radio option per question.

## D. Shape support

### D1 — Cloud Functions scaffolding for Shape C — **P1**

When the planner picks Shape C it writes `hosting.rewrites` pointing at `function: "api"` and `functions.dir: "functions"`. But **no stage actually creates a `functions/` directory or an `api` export**. If a user picks Shape C without bringing their own functions scaffold, the deploy will fail. Options: scaffold a minimal `functions/index.js` with a hello-world export, or block the wizard with a clear warning, or detect existing functions and only offer Shape C when one is present.

### D2 — Postgres via Firebase Data Connect — **research**

The team meeting flagged Firebase's new Postgres support (Data Connect) as compelling because it auto-generates REST endpoints and SDKs. We chose Firestore as the v1 default for simplicity. Worth evaluating Data Connect once it's out of preview and the cost shape is clear.

### D3 — Vector DB support — **P3**

Mentioned in the original meeting as a longer-term need ("eventually a vector base for more efficient search"). No Firebase-native option today; would mean wiring Pinecone, Weaviate, or similar. Out of scope until a concrete use case lands.

### D4 — Custom Firebase region — **P3**

`functions.region` is hardcoded to `europe-west3` in the planner. Fine for the current user; needs to be configurable (asked at interview time or read from env) before this ships beyond Mauricio.

### D5 — Detect incompatible local DB & offer migration — **P1 (detection) / P2 (migration)**

A vibecoded app may use a local persistence layer that Firebase can't run as-is: `fs.writeFileSync` to JSON/CSV, sqlite via `better-sqlite3`, postgres via `pg`, mysql, etc. Cloud Functions have an ephemeral filesystem and no persistent local DB.

**Detection (P1):** the inspector grows new signals — `package.json` deps for `pg`, `mysql`, `mysql2`, `better-sqlite3`, `sqlite3`, `mongodb`, and code-level `fs.writeFileSync` / `fs.appendFileSync` usage in the project (excluding `node_modules`). When detected, the wizard pauses with a clear "your app uses X — Firebase doesn't run X natively" page.

**Options offered (P2):**

1. **Deploy frontend only.** Skip the backend in the plan; user understands the deployed app won't persist anything until they migrate.
2. **Walk through a Firestore migration.** A guided refactor — the same pattern as the stock-monitor 2026-05-08 migration: create a `storage.js` adapter, branch on `STORAGE_BACKEND=files|firestore`, migrate write sites. Could be Claude-driven via a launched conversation, or scripted for common patterns.
3. **Cancel.** Exit with no changes; user goes off and decides what they want.

The detection alone is high value because it removes the "I deployed it and now nothing works" surprise. The migration assistance is bigger scope but is where the toolkit becomes meaningfully useful for real apps.

## E. Wizard UX

### E1 — Manage view — **P3**

A "Manage" tab listing deployed apps with redeploy/rollback/delete actions. Separate product surface; not what v1.x is about. Captured here so we don't reinvent it on the fly.

### E2 — Redeploy/rollback history — **P3**

Firebase Hosting keeps version history per site. A UI that surfaces past releases with a one-click rollback button. Tied to E1.

### E3 — Auto-installing missing tools — **P3**

Today preflight asks before installing Firebase CLI ("Install it now via npm install -g firebase-tools? [Y/n]"). Originally agreed to "instruct, don't install." We made it "ask, then install." A future version could auto-install silently for true one-command UX, with a `--no-install` opt-out. Trade-off: invasive vs. friction.

### E4 — Chat interface for app description — **P3**

The original meeting envisioned a chat UI where a non-technical user describes the app they want, Claude (or similar) generates a setup script, and the user pastes that into the terminal. Our v1 took a different turn (assume the app already exists). Worth revisiting if the toolkit gets used by anyone whose pain point is "I don't even have an app yet."

## F. Stale code & cosmetics

### F1 — `provision.sh` dead reads — **P3**

`provision.sh` reads `SHAPE`, `PUBLIC_DIR`, and `NEEDS_FN` from the config but never uses them. The actual `firebase.json` composition happens via inline `node -e` reading the config directly. Strip the dead reads.

### F2 — `acceptedBlaze` field is captured but unused — **P3**

The interview asks for Blaze acceptance on Shape C and writes the boolean to the plan. No downstream stage reads it. The actual Blaze upgrade happens implicitly when `firebase deploy` prompts the user mid-deploy. Either honor the field (e.g., open the upgrade page before deploy) or remove it.

### F3 — README out of date — **P2**

The toolkit README still describes v0.1 behavior. Doesn't mention auto-nvm, install-on-consent, the active-account display, or the UI wrapper. Sync with `docs/HOW_IT_WORKS.md` and the new UI spec when the UI lands.

### F4 — `slugify` + `shortSuffix` edge case — **P3**

The planner's project-ID generator uses `Math.random().toString(36).slice(2, 6)`. For extremely small random values the suffix can be shorter than 4 characters and the project-ID-validity regex would fail. Probability is ~10⁻⁵; not user-visible in practice, but worth hardening (e.g., loop until length === 4).

## G. Stock-monitor specific (downstream consumer)

These came out of the 2026-05-08 Firestore migration. They live with the monitor codebase but are listed here so the toolkit's design can stay aware of real-app friction.

### G1 — Yahoo Finance egress from Cloud Functions — **research**

The scan calls `yahoo-finance2`. Outbound HTTP from Cloud Functions works by default but may hit rate limits or need VPC egress configuration. Not yet exercised against real Firestore deploy.

### G2 — Historical-data backfill — **P3**

The migration left the existing `data/*.json` and `output/*.json` untouched. Bringing them into Firestore is a one-shot import script, not a runtime concern. Optional.

### G3 — Firestore TTL for `daily_finds` — **P2**

File mode trims `daily_finds` to 90 days. Firestore mode keeps everything (cheap to store, slow to query). Add a TTL policy.

### G4 — `updateScanMemory` race — **P2**

The function is read-modify-write on a single `meta/scan_memory` document. Fine for a single daily cron, racy if scans ever run concurrently. Wrap in a Firestore transaction.

### G5 — In-memory cache for meta reads — **P3**

Every scan reads `meta/sp500_cache` and `meta/scan_memory` from Firestore. Cheap individually but accumulates if scans run frequently. Add a process-lifetime cache.

---

## How to use this doc

- When a new gap or design topic comes up that we're not addressing now, add a row here.
- When we close one out, leave the entry but cross it out and link to the commit/PR.
- Skim this before starting any new feature in the toolkit so we don't reinvent past discussions.
