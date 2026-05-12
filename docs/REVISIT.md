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

### B4 — Mid-deploy Blaze upgrade prompt — **P1**

Plan Summary now warns upfront that Shape C needs Blaze, but it can only link to the general pricing page (per-project upgrade URL doesn't exist until provisioning runs). When the deploy stage fails with `Your project ... must be on the Blaze plan`, the wizard should detect that, surface a dedicated retry page with the now-resolvable upgrade URL (`https://console.firebase.google.com/project/<projectId>/usage/details`), and offer "I've upgraded — retry". Mirrors the bootstrap recovery pattern we built for the first-run 403. Without this, the user is stuck on a generic stage-failed error.

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

The inspector already detects framework/backend/secrets from code, so the user doesn't strictly need to know. The remaining gap is the wizard's plain-language questions ("Will users sign in?", "Does the app need a database?"). If the user can't answer:

- Add an "I'm not sure" option per question.
- On click, the inspector does a **deep-read pass** — pure pattern matching, no LLM. New sub-modules under `lib/inspector/`:
  - `detect-auth-usage.mjs` — looks for `firebase/auth` imports, `getAuth(`, `signInWith*`, `onAuthStateChanged`.
  - `detect-db-usage.mjs` — looks for `firebase/firestore`, `addDoc`, `getDocs`, plus incompat patterns (see D5).
  - `detect-secrets-usage.mjs` — looks for `process.env.*` references and hardcoded secret prefixes (see C6).
  - Each returns `{ likelyUsed: bool, confidence: "high"|"medium"|"low", evidence: ["src/X:line"] }`.
- Wizard shows the deep-read result with the evidence (clickable file paths). User confirms or overrides.
- **Default fallback** when user picks "I'm not sure" with no deep-read evidence: no auth, no DB, Shape A. The Done page surfaces a card: "If you need sign-in or a database later, re-run this wizard."

### C6 — Secrets handling (detect → block-and-prompt → ingest) — **P1**

Three concerns separated:

1. **Real secrets vs browser-safe values.** Firebase API keys are public by design; security is enforced via Firestore rules and Auth. Stripe live keys, AWS keys, OpenAI keys, etc. are real secrets. The wizard must distinguish.
2. **Hardcoded secrets in the source.** A common vibecoded mistake: `const STRIPE_KEY = "sk_live_..."`. These leak into git and into the deployed bundle.
3. **Real secrets at runtime.** Server-only secrets go to Firebase Functions secrets (Google Cloud Secret Manager). Cloud Functions read them via `process.env.NAME`.

The flow is the same pattern as D5 — **detect → block + generate prompt → user refactors → wizard re-detects → ingest**:

**Sub-step 1 — Detect** (`lib/inspector/detect-secrets-usage.mjs`):
- Source scan for known prefixes: `sk_live_*` / `sk_test_*` (Stripe), `AKIA*` (AWS), `xoxb-*` (Slack), `ghp_*` / `gho_*` (GitHub PAT), `sk-ant-*` (Anthropic), `sk-...` 40+ chars (OpenAI), `AIza*` (Google — but Firebase API keys legitimately use these, so context-check).
- Source scan for `process.env.*` references → list of expected env vars.
- `.env.example` parsing (already exists in inspector).
- Returns `{ hardcoded: [{file, line, prefix, redacted}], envRefs: [name], envExampleKeys: [name] }`.

**Sub-step 2 — Block + generate prompt** (only if hardcoded secrets found):
- New wizard page: "We found hardcoded secrets in your code". Lists detected locations with prefix + redacted preview.
- Generates `REFACTOR-SECRETS.md` in the app folder using a shared template helper (see D5):
  - Detected hardcoded secrets
  - Recommended `.env` structure with placeholders
  - Refactor recipe: replace each inline value with `process.env.X`
  - `.gitignore` entry for `.env`
  - Re-run instruction
- Buttons: `[Open REFACTOR-SECRETS.md]` `[Copy to clipboard]` `[Cancel]`.
- User pastes into Claude Code or their AI tool, applies the refactor, re-runs `./deploy-app`. Wizard re-detects, finds no hardcoded secrets, proceeds.

**Sub-step 3 — Per-key classification + ingestion** (once secrets are in `.env`):
- For each env var: "Is `STRIPE_KEY` something users should be able to read in their browser, or only your server?"
- **Browser-safe** → wizard writes value to `.env.production` so Vite/Next bakes it into the build.
- **Server-only** + Shape C → wizard runs `firebase functions:secrets:set NAME` with a masked input (never echoed, never persisted by us).
- **Server-only** + Shape A/B → block: "This app has no backend, so server-only secrets have no safe home. Either treat as browser-safe (accept it's public), upgrade to Shape C, or cancel."

**Placement in wizard:** new step between Questions (page 4) and Plan Summary (page 5). Plan needs to reflect which secrets are server-side so the deploy script can `firebase functions:secrets:set` them in advance.

**Scope:** ~400 lines total. Inspector module ~80, secrets page + per-key UI ~120, block page + prompt generator ~150, backend endpoints ~60.

**Shared template with D5:** the `REFACTOR-*.md` generation uses a common helper (`lib/refactor-prompts/template.mjs`) so the structure stays consistent across DB migration and secrets refactor prompts.

## D. Shape support

### D1 — Cloud Functions scaffolding for Shape C — **P2 (was P1)**

~~When the planner picks Shape C it writes `hosting.rewrites` pointing at `function: "api"` and `functions.dir: "functions"`. But no stage actually creates a `functions/` directory or an `api` export. If a user picks Shape C without bringing their own functions scaffold, the deploy will fail.~~

**Landed (2026-05-12):** the toolkit now supports the "user brings their own `functions/`" path end-to-end:

- The inspector detects `functions/package.json` declaring `firebase-functions` and marks the app Shape C with `outputDir: "public"` when a `public/` folder is present. (See `lib/inspector/index.mjs`.)
- The build stage runs `npm install --prefix functions` whenever a `functions/package.json` is on disk, so `firebase deploy --only functions` has its node_modules ready. (See `stages/build.sh`.)
- The planner already wires `hosting.rewrites: [{ source: "/api/**", function: "api" }]` and `functions.dir: "functions"` for Shape C; a new test locks in `hosting.publicDir === "public"` when the inspector reports the Firebase-conventional layout.
- A real end-to-end sample lives at `samples/express-real/` (HTML frontend in `public/`, Express app in `functions/` exposing `/hello` and `/time` via `onRequest`).

**Still open (P2):** auto-scaffolding `functions/` for arbitrary Shape C apps that don't bring their own (e.g. `samples/express-backend`-style apps where Express lives at the project root). Today the planner still picks Shape C for those, but no stage rewrites the Express entry into a `firebase-functions` export or generates a `functions/package.json`. Options: (a) scaffold a minimal `functions/index.js` that wraps `server.js`, (b) refuse Shape C with a clear "please move your code into functions/" message and a generated REFACTOR-* prompt (same pattern as C6/D5), or (c) keep Shape C gated to apps that already ship a `functions/` layout. Worth deciding before opening Shape C to non-technical users.

### D2 — Postgres via Firebase Data Connect — **research**

The team meeting flagged Firebase's new Postgres support (Data Connect) as compelling because it auto-generates REST endpoints and SDKs. We chose Firestore as the v1 default for simplicity. Worth evaluating Data Connect once it's out of preview and the cost shape is clear.

### D3 — Vector DB support — **P3**

Mentioned in the original meeting as a longer-term need ("eventually a vector base for more efficient search"). No Firebase-native option today; would mean wiring Pinecone, Weaviate, or similar. Out of scope until a concrete use case lands.

### D4 — Custom Firebase region — **P3**

`functions.region` is hardcoded to `europe-west3` in the planner. Fine for the current user; needs to be configurable (asked at interview time or read from env) before this ships beyond Mauricio.

### D5 — Detect incompatible local DB & offer refactor prompt — **P1 (detection + prompt) / P2 (automated migration)**

A vibecoded app may use a local persistence layer that Firebase can't run as-is: `fs.writeFileSync` to JSON/CSV, sqlite via `better-sqlite3`, postgres via `pg`, mysql, mongodb, etc. Cloud Functions have an ephemeral filesystem and no persistent local DB. Without intervention, the deploy "succeeds" but the app is silently broken.

**Detection (P1):** the inspector grows `lib/inspector/detect-db-usage.mjs`. Signals:

- `package.json` deps: `pg`, `mysql`, `mysql2`, `better-sqlite3`, `sqlite3`, `mongodb`, `mongoose`, `prisma`.
- Code-level usage of those deps (`new Database(`, `new Pool(`, `MongoClient.connect`, etc.) — excluding `node_modules`.
- `fs.writeFileSync` / `fs.appendFileSync` to non-`/tmp` paths.

Returns `{ likelyUsed: bool, drivers: ["sqlite", "fs-writes"], evidence: ["src/db.js:14"] }`.

**Options offered on the block page (P1 — same pattern as C6):**

1. **Deploy frontend only.** Skip the backend in the plan; user understands the deployed app won't persist anything until they migrate.
2. **🪄 Generate a refactor prompt.** Wizard writes `REFACTOR-FOR-FIREBASE.md` to the app folder, populated with detected facts. Uses the shared template helper (`lib/refactor-prompts/template.mjs`) that C6 also uses. Sections: what was detected, why it won't work on Firebase, recipe for migrating to Firestore (mirroring the storage-adapter pattern from the stock-monitor 2026-05-08 migration), re-run instructions. User pastes into Claude Code or their AI tool, applies the refactor, re-runs the wizard.
3. **Cancel.** Exit with no changes.

**Automated migration (P2):** the toolkit itself drives the Firestore migration without external AI help. Bigger scope — would mean templating the storage-adapter pattern, mapping detected schemas to Firestore document shapes, rewriting call sites. Defer.

**Shared template with C6:** `REFACTOR-FOR-FIREBASE.md` (D5) and `REFACTOR-SECRETS.md` (C6) both use the same generator structure (detected facts → why this matters → recipe → re-run note). One helper, two callers.

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
