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

### A1 — Scaffold sign-in code in two ways (user picks) — **P1**

Today, when the wizard's "Will users sign in?" question is `yes`, the planner sets `auth.providers: ["google"]`, the report stage prints a deep-link to enable Google sign-in in the Firebase Console — and **the user's app code is never touched**. The deployed app still doesn't gate anything until the user adds Firebase Auth themselves.

**Design: the wizard offers the user two choices when auth is needed.** Both share the same SDK-config injection mechanism; only the code-writing step differs.

**Common to both paths:**

- After provision, the wizard runs a new helper (`lib/sdk-config.mjs`) that calls `firebase apps:sdkconfig WEB --project <id> --json`, creating a Web App on the project first if none exists.
- The fetched config object (apiKey, projectId, etc.) is written to the user's source. For Vite-React that's `<app>/src/firebase-config.js`; for Next.js `<app>/lib/firebase-config.js`; for plain HTML a root `firebase-config.js` + an inline `<script>` injection into `index.html`.
- This step happens whether the user picks auto-inject or refactor-prompt — the config file is harmless on its own and is required for any auth code (theirs or ours) to work.

**Path 1 — Auto-inject (the magic option)**

For known frameworks, the wizard scaffolds a working sign-in component AND wires it into the entry component idempotently:

- Templates under `templates/auth/<framework>/`.
- For Vite-React: copy `SignInWithGoogle.jsx` to `<app>/src/`, splice an import and a render into `<app>/src/App.jsx`.
- For Next.js: copy `SignInWithGoogle.tsx` (or `.jsx`) to `<app>/components/`, splice into `<app>/app/layout.tsx` (or `pages/_app.jsx` for older Next).
- For plain HTML: inject a `<button id="signin">` + a `<script type="module">` block into `<app>/index.html`.
- Run `npm install firebase` in the app dir if it's not in `package.json`.
- Idempotent: detect existing import/render and skip splicing.
- After deploy, the live URL shows a working Sign-in with Google button out of the box.

Fragility: AST manipulation for the splice. We can hand-roll regex-based "insert after the imports block" / "insert at the top of the returned JSX" — good-enough for vibecoded entry points, less reliable on heavily customized ones. Fallback when splicing fails: switch to Path 2 automatically.

**Path 2 — Generate a refactor prompt (the safe option)**

Mirrors the D5 incompat-DB flow:

- Wizard writes a `REFACTOR-FOR-AUTH.md` to the app folder containing: detected framework, generated `firebase-config.js` location, recipe for adding sign-in (component + entry-point splice + dep install), and re-run note.
- UI shows the prompt content inline (scrollable code block + Copy button, same as the IncompatibleApp page).
- User pastes into Claude Code / Cursor, the AI applies the refactor, user re-runs `./deploy-app`.

This path is honest about the limits of AST splicing and gives users with non-trivial entry points an out.

**Where the user picks:**

- A new wizard page after Questions (only shown when `needsAuth` is true): "How would you like sign-in added to your app?" with two big choice cards — "Add it for me (auto)" and "Give me a prompt for my AI tool". The Plan Summary reflects the choice as one of the steps.
- Default selection: auto-inject for known frameworks, refactor-prompt for unknown.

Scope: per-framework auto-inject templates (Vite-React first; Next.js + plain HTML follow-ups), the regex-splice helper, the new choice page, and `REFACTOR-FOR-AUTH.md` template reusing the shared `lib/refactor-prompts/template.mjs` helper from D5.

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

### C6 — Secrets handling (detect → block-and-prompt → ingest) — **~~P1 detect + block + ingest~~ / P2 server-only secret without a value**

Three concerns separated:

1. **Real secrets vs browser-safe values.** Firebase API keys are public by design; security is enforced via Firestore rules and Auth. Stripe live keys, AWS keys, OpenAI keys, etc. are real secrets. The wizard must distinguish.
2. **Hardcoded secrets in the source.** A common vibecoded mistake: `const STRIPE_KEY = "sk_live_..."`. These leak into git and into the deployed bundle.
3. **Real secrets at runtime.** Server-only secrets go to Firebase Functions secrets (Google Cloud Secret Manager). Cloud Functions read them via `process.env.NAME`.

**Detect → block → classify → ingest — landed 2026-05-13:**

- `lib/inspector/detect-secrets-usage.mjs` does the source scan (pure JS, no LLM, no network). Pattern families: Stripe `sk_live_*`/`sk_test_*`, AWS `AKIA*` + `aws_secret_access_key=...`, GitHub `ghp_*`/`gho_*`/`ghu_*`, Anthropic `sk-ant-*`, OpenAI `sk-*` (40+ chars, excludes `sk-ant-`), Slack `xoxb-*`/`xoxp-*`, Google `AIza*` (always emitted with `kind: "google-api-key-maybe-firebase"` and `suppressed: true` when the surrounding context — filename or same-line `firebase` — looks like a legitimate Firebase Web SDK config). Bounded to 200 files × 50 KB, skips `node_modules`/`dist`/`build`/`out`/`.firebase`/`.git`. Returns `{ hardcoded: [{file, line, kind, prefix, redacted, excerpt, suppressed}], envRefs, envExampleKeys }`.
- `inspect()` surfaces the result as `secrets` plus a derived `hasHardcodedSecrets` (count of non-suppressed hits).
- `lib/refactor-prompts/template.mjs` gains `generateSecretsRefactorPrompt({ appName, framework, hardcoded, envRefs })`. Walks the user through (1) creating `.env`, (2) adding it to `.gitignore`, (3) replacing each inline literal with `process.env.X` (server) or `import.meta.env.VITE_X` / `process.env.NEXT_PUBLIC_X` (client) depending on framework, (4) re-running the wizard. Suppressed hits are excluded from the prompt body.
- `POST /api/refactor-prompt/secrets` (`ui/server/api/refactor.mjs`) writes `REFACTOR-SECRETS.md` into the app folder.
- New wizard steps:
  - **HardcodedSecretsBlock** (step 10) — block page mirroring `IncompatibleApp.jsx`. Lists redacted hits, three choice cards (generate prompt / I've fixed it — re-check / cancel). Inline prompt preview + Copy button after generation.
  - **SecretsClassify** (step 11) — per-key classification page. For every unique key (union of `envRefs` and `envExampleKeys`, deduped) the user picks browser-safe vs server-only and optionally types the value. Inferred default: VITE_*/NEXT_PUBLIC_* → browser-safe, everything else → server-only. Renders a warning when a Shape A/B app has any server-only classifications.
- `stages/inject-secrets.sh` runs between provision and build. Browser-safe values are appended (idempotently) to `<app>/.env.production`. Server-only values with a value provided are piped into `firebase functions:secrets:set <NAME> --project <projectId>`; missing-value keys print a manual-setup hint and don't fail the stage. No-op when `plan.secrets` is null/empty.
- Planner: `plan.secrets.perKey` carries the user's classification + value. `plan.functions.secrets` (the Cloud Functions runtime allow-list) is filtered to server-only keys only.
- Negative-test fixture for the detector lives at [`samples/express-with-secret/`](../samples/express-with-secret/) (Stripe test key hardcoded in `functions/index.js`). The positive control is [`samples/express-real/`](../samples/express-real/) (zero secrets).

**Still open (P2):**

- **Server-only key without a value provided in the wizard.** Today the inject-secrets stage prints a manual `firebase functions:secrets:set NAME` hint and continues. A dedicated UI prompt (masked input, never echoed, never persisted) would close the gap so the deploy is fully hands-off.
- **Wizard-side detection of secrets that LIVE in `.env`/`.env.production` already.** The detector inspects source, not the env file itself; if a user puts a real Stripe key in `.env.production` (and that file is committed), we wouldn't flag it. A second pass over `.env*` looking for the same prefix families would catch the leak.

**Shared template with D5:** `REFACTOR-FOR-FIREBASE.md` (D5) and `REFACTOR-SECRETS.md` (C6) both use the same generator structure (detected facts → why this matters → recipe → re-run note). One helper (`generateRefactorPrompt`), two domain-specific callers.

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

### D5 — Detect incompatible local DB & offer refactor prompt — **~~P1 detection + prompt~~ / P2 (automated migration)**

A vibecoded app may use a local persistence layer that Firebase can't run as-is: `fs.writeFileSync` to JSON/CSV, sqlite via `better-sqlite3`, postgres via `pg`, mysql, mongodb, etc. Cloud Functions have an ephemeral filesystem and no persistent local DB. Without intervention, the deploy "succeeds" but the app is silently broken.

**Detection + prompt — landed 2026-05-12:**

- `lib/inspector/detect-db-usage.mjs` does the source scan (pure JS, no LLM, no network). Scans for `pg`/`mysql`/`mysql2`/`better-sqlite3`/`sqlite3`/`mongodb`/`mongoose`/`prisma`/`@prisma/client` in `package.json` deps (root + `functions/`), plus regex over `.js/.mjs/.cjs/.ts/.tsx/.jsx` for `new Database(`, `new Pool(`, `mongoose.connect(`, `MongoClient.connect(`, and `fs.writeFileSync`/`fs.appendFileSync` to non-`/tmp` paths. Scan is bounded to 200 files and 50 KB/file and skips `node_modules`/`dist`/`build`/`out`/`coverage`/`.next`/hidden dirs.
- Returns `{ incompatible, drivers, evidence: [{ file, line, kind, excerpt }] }`.
- `inspect()` surfaces the result as two new fields: `dbIncompat` and `dbIncompatDetails`.
- `lib/refactor-prompts/template.mjs` is the shared markdown generator. `generateDbRefactorPrompt({ appName, framework, drivers, evidence })` returns a `REFACTOR-FOR-FIREBASE.md` with the storage-adapter recipe (mirroring the stock-monitor 2026-05-08 migration, referenced inline) and a per-call-site numbered step list.
- `POST /api/refactor-prompt/db` (`ui/server/api/refactor.mjs`) writes the markdown into the app folder.
- New wizard step `IncompatibleApp` (step 9) blocks between Inspector confirm and Questions. Three options: generate the refactor prompt, deploy frontend-only (mutates session inspection to drop the backend), or cancel.
- Negative-test fixture: [`samples/express-sqlite/`](../samples/express-sqlite/). Reference for the positive control: [`samples/express-real/`](../samples/express-real/).

**Still open (P2 — automated migration):** the toolkit itself drives the Firestore migration without external AI help. Bigger scope — would mean templating the storage-adapter pattern, mapping detected schemas to Firestore document shapes, rewriting call sites. Defer.

**Shared template with C6:** `REFACTOR-FOR-FIREBASE.md` (D5) and `REFACTOR-SECRETS.md` (C6, still pending) both use the same generator structure (detected facts → why this matters → recipe → re-run note). One helper (`generateRefactorPrompt`), two callers.

## E. Wizard UX

### E1 — Manage view — **P3**

A "Manage" tab listing deployed apps with redeploy/rollback/delete actions. Separate product surface; not what v1.x is about. Captured here so we don't reinvent it on the fly.

### E2 — Redeploy/rollback history — **P3**

Firebase Hosting keeps version history per site. A UI that surfaces past releases with a one-click rollback button. Tied to E1.

### E3 — Auto-installing missing tools — **P3**

Today preflight asks before installing Firebase CLI ("Install it now via npm install -g firebase-tools? [Y/n]"). Originally agreed to "instruct, don't install." We made it "ask, then install." A future version could auto-install silently for true one-command UX, with a `--no-install` opt-out. Trade-off: invasive vs. friction.

### E6 — Redeploy button should re-run new-detection pages — **P2**

The Done page's "Redeploy" button jumps straight to Progress, bypassing Inspector, Classify (C6), and the block pages (D5 / C6). For users who edit their app between deploys and add new env vars or new hardcoded secrets, the wizard silently skips the classification / block steps. The current model assumes "if the config exists, the user has already answered everything" — true at v1 but breaks down once the source can drift.

Two possible fixes:

1. **Re-run inspector on Redeploy** and only skip Classify / block if the new inspection matches what's already in the saved plan.
2. **Add a "Review answers" button next to Redeploy** that takes the user back through Inspector + Classify + Questions, then Plan, then Deploy.

(1) is more magical, (2) is more honest. Pick whichever feels right after seeing real usage.

### E4 — Chat interface for app description — **P3**

The original meeting envisioned a chat UI where a non-technical user describes the app they want, Claude (or similar) generates a setup script, and the user pastes that into the terminal. Our v1 took a different turn (assume the app already exists). Worth revisiting if the toolkit gets used by anyone whose pain point is "I don't even have an app yet."

### E5 — Frictionless distribution (no terminal) — **research / P1 once we want external users**

The current entry point still requires a terminal. Even with everything the wizard automates, opening Terminal and typing `./deploy-app` is the wall for many non-technical users. To truly ship beyond Mauricio + his immediate team, the toolkit needs a friction-free installer story. Three paths considered:

**Path A — Native desktop app (Electron) — most practical**

Bundle the existing wizard (Express + React) as a `.app` (macOS) / `.exe` (Windows) / `.AppImage` (Linux). User downloads one file, double-clicks, the wizard opens in their default browser or in a built-in window.

- Bundled Node runtime — no nvm needed
- Bundled or auto-downloaded Firebase CLI on first run
- Bash stages stay as-is, called from Electron's main process
- Code-signed for macOS (Apple Developer cert, ~$99/year) so Gatekeeper doesn't scare users
- Auto-updates via electron-updater
- The wizard UI doesn't change at all; only the orchestrator is replaced

Cost: ~1 week focused work for a v1 plus Apple Developer cert. Windows code-signing adds ~$300 one-time + $200/year for an Authenticode cert.

**Path B — One-click installer (.pkg / .msi) — intermediate**

A traditional installer that:
1. Installs Node 22+ if missing
2. Installs Firebase CLI globally
3. Drops deploy-toolkit into /Applications/ or %AppData%
4. Creates a Finder / Start Menu shortcut that runs `./deploy-app`

User downloads, double-clicks installer, then double-clicks the shortcut. Terminal still exists, but user never types into it.

Cost: ~3 days. Less polished than Electron — a brief terminal flash on launch.

**Path C — Hosted web app — most ambitious**

Run a hosted version of the wizard at e.g. deploy-toolkit.example.com. User signs in with Google, drags their app folder (or pastes a GitHub repo URL), we run the orchestrator on our infra and deploy to *their* Firebase account using their OAuth token.

Cost: ~2 weeks + ongoing infra. Real security model needed (we'd briefly hold user source + a Firebase token). Worth it only after the tool has clear external demand. Probably never the first version — but the right long-term answer for users who refuse any local install.

**Caveat about "fully frictionless":**

Even with Path A, the first Firebase project on a new Google account still hits the 403 TOS bootstrap. The wizard handles it cleanly (Bootstrap page) but it's still 30 seconds of "click here, come back." Google constraint, not us — no public API to accept Firebase TOS programmatically.

**Decision:** Revisit after A1 ships and after the colleague-share round surfaces real friction. Default expected next step: Path A (Electron), unless the colleague feedback says hosted is more important.

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
