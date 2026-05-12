# Build Shape B (real Firestore) + Auth Scaffolding for deploy-toolkit

> **Hand this file to an external agent** (Claude Code, etc.) to add the two features described below. The agent doesn't need any prior context on this project — everything they need is in this doc.

---

## TL;DR

Two features for `deploy-toolkit`, intentionally bundled because they share a mechanism (writing a generated `firebase-config.js` into the user's source tree):

1. **Shape B with real Firestore** — when the wizard's plan includes Firestore, generate a `firebase-config.js` populated with the deployed project's keys and write it into the user's app. Existing apps that import this config can read/write Firestore from the browser immediately after deploy.

2. **A1 auth scaffolding** — when the wizard's plan includes auth, scaffold a working `<SignInWithGoogle />` component into the user's app for known frameworks (Vite-React first; Next.js follow-up). Wire Google sign-in into their existing entry point if possible.

Build A1 only **after** Shape B works, because A1 depends on the same `firebase-config.js` injection.

---

## What deploy-toolkit is

A bash + Node + React orchestrator that takes any small "vibecoded" app folder on a non-technical user's laptop and deploys it to Firebase Hosting (and Functions, if Shape C). The entry point is `./deploy-app` which opens a wizard UI in the user's browser.

Repo layout:

```
deploy-toolkit/
├── deploy-app                 ← bash orchestrator (entry point)
├── lib/                       ← Node "brain" (Inspector, Interview, Planner, Brain)
├── stages/                    ← bash stages (preflight, provision, build, deploy, report)
├── templates/                 ← default firestore.rules etc.
├── samples/                   ← test apps (static-html, vite-react-real, express-real)
├── ui/                        ← React + Vite wizard + Express server
│   ├── server.mjs             ← Express; calls lib/ and stages/
│   ├── server/api/            ← endpoints: preflight, brain, run-stage, auth, picker
│   └── src/                   ← React app (pages/, components/)
└── docs/
    ├── HOW_IT_WORKS.md        ← stage-by-stage walkthrough
    ├── REVISIT.md             ← backlog of all open design topics
    └── prompts/               ← (this directory) prompts for external agents
```

Read `docs/HOW_IT_WORKS.md` before doing anything — it explains every stage. Read `docs/REVISIT.md` for the priority-tagged backlog; the two features here are **D2 (research)** as it intersects with Data Connect deferral, **A1 (P1)**, and the underlying mechanism is what unlocks several others.

## What's already working

| Shape | Status | Sample to verify |
|---|---|---|
| A (static only) | ✅ end-to-end | `samples/static-html`, `samples/vite-react-real` |
| B without auth/DB | ✅ end-to-end | (any A-shape sample answering "no" to both) |
| B with auth+DB in plan but NOT wired into app code | ⚠️ deploys, but app code can't talk to Firebase | (no sample yet) |
| C (frontend + Cloud Function) | ✅ as of recent D1 work | `samples/express-real` |

The wizard currently:
- Asks "Will users sign in?" → if yes, writes `auth: { providers: ["google"] }` to the plan and **report.sh prints a deep-link to enable Google sign-in in the Firebase Console** (the user clicks "Enable" manually). The Firebase project is configured, but the user's app code is untouched.
- Asks "Does the app need to remember things between visits?" → if yes, writes `firestore: { rulesFile: "firestore.rules" }` to the plan and provisions Firestore with locked-down default rules. Again, the user's app code is untouched.

**The gap:** the deployed app has no idea how to talk to Firebase, because no `firebase-config.js` is written and no SDK calls exist in the user's source.

## What you're building — Feature 1: Real Firestore (Shape B)

### Acceptance criteria

A non-technical user with a Vite-React app folder runs `./deploy-app`, answers "yes" to the database question, completes the wizard, and the deployed app can read/write a Firestore collection from the browser without the user touching any code.

### Mechanism

After the provision stage creates the Firebase project, fetch the project's web SDK config and write it into the user's source. Then any code that imports it gets a working Firebase client.

### Concrete changes

1. **New helper** at `lib/sdk-config.mjs`:
   - Exports an async function `fetchWebSdkConfig(projectId)` that runs `firebase apps:sdkconfig WEB --project <projectId> --json` and parses the result.
   - Returns the `{ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }` object.
   - Handles the "no web app exists yet" case: if `apps:sdkconfig` fails with "no apps found", create a web app first via `firebase apps:create WEB <name> --project <projectId>` and retry.
   - Has tests.

2. **New stage** at `stages/inject-config.sh` (called after `provision.sh`, before `build.sh`):
   - Reads the deploy-app.config.json for the project ID and the framework.
   - Calls `node -e` to use `lib/sdk-config.mjs` and fetch the SDK config.
   - Writes `firebase-config.js` into the user's app folder following the framework convention:
     - **Vite-React** → `src/firebase-config.js` exporting `export const firebaseConfig = {...}`
     - **Next.js** → `lib/firebase-config.js` same shape
     - **Plain HTML** → `firebase-config.js` at root, plus an inline script tag injection into `index.html` if needed
     - **Unknown** → skip with a warning (manual step required)
   - Idempotent: if the file already exists and matches the fetched config, don't rewrite.
   - Has a test using a mocked `firebase apps:sdkconfig` (use a fixture).

3. **Wire stage into orchestrator**:
   - `deploy-app` (CLI mode) — add `inject-config.sh` call between `provision.sh` and `build.sh`.
   - `ui/server.mjs` — add the new stage to the SSE-streamable stage map in `run-stage.mjs`.
   - `ui/src/pages/Progress.jsx` — add a `inject-config` stage card between provision and build.

4. **Planner update** at `lib/planner/index.mjs`:
   - When `answers.needsDb === true` OR `answers.needsAuth === true`, set a new field `plan.sdkConfig = { framework, destination: <path> }` so the inject stage knows where to write.
   - Test that planning a Vite-React app with `needsDb: true` produces the expected destination.

5. **Default Firestore rules update** at `templates/firestore.rules`:
   - Add a `users/{userId}/notes/{noteId}` collection rule (rw by owner) as a sensible "starter" pattern.
   - Optional: include a `public/{document=**}` read-only path as an example.

### What you do NOT need to do for Feature 1

- Don't write any Firebase Auth code. That's Feature 2.
- Don't migrate the user's existing storage. The user's app code will start using Firestore voluntarily once they import `firebase-config.js`.

---

## What you're building — Feature 2: A1 Auth Scaffolding (Vite-React first)

### Acceptance criteria

User answers "yes" to "Will users sign in?". The wizard:
1. Enables the Google provider (already happens via deep-link — preserve this behavior for now).
2. **NEW:** Generates a `<SignInWithGoogle />` component and wires it into the app's entry point.
3. On deploy, the user clicks "Enable Google sign-in" link in the report (existing behavior).
4. The deployed app shows a Sign-in button. Click → Google OAuth → user info appears in the page.

### Mechanism

Same `inject-config.sh` stage from Feature 1 also writes auth-related files when `plan.auth !== null`.

### Concrete changes

1. **Templates** at `templates/auth/`:
   - `vite-react/SignInWithGoogle.jsx` — A self-contained React component that:
     - Imports `firebaseConfig` from `../firebase-config.js`
     - Initializes Firebase Auth
     - Renders a button: signed-out → "Sign in with Google" + click triggers `signInWithPopup`; signed-in → shows email + "Sign out" button
     - Uses minimal inline styles (don't fight whatever the user's CSS looks like)
   - `vite-react/main.jsx.patch` — Instructions for splicing `<SignInWithGoogle />` into the user's root component. Probably easier as a literal helper that the inject script imports.

2. **Inject logic update** at `stages/inject-config.sh`:
   - When `plan.auth !== null` AND `framework === "vite-react"`:
     - Copy `templates/auth/vite-react/SignInWithGoogle.jsx` to `<app>/src/SignInWithGoogle.jsx` (don't overwrite if exists).
     - Edit `<app>/src/App.jsx` to import and render `<SignInWithGoogle />` at the top of its returned JSX, idempotently.
   - For other frameworks: print a clear "manual step required" message with a link to a doc, don't fail.

3. **Build/install update**:
   - The auth component imports `firebase/auth`. The user's `package.json` needs `firebase` as a dep.
   - In `stages/inject-config.sh` (or a new step): if `firebase` is missing from the user's `package.json` AND auth/firestore is in the plan, run `npm install firebase` in the app dir.
   - Idempotent.

4. **Tests**:
   - Test that running inject-config on a fresh Vite-React app produces a `SignInWithGoogle.jsx` and modifies `App.jsx` correctly.
   - Test idempotency: re-running doesn't duplicate the import or the JSX.

### What you do NOT need to do for Feature 2

- Don't handle other frameworks. Vite-React first; Next.js / plain HTML are separate follow-ups noted in REVISIT.
- Don't build a sign-out flow beyond the component. Don't add routing. Keep it minimal.
- Don't customize the styling. Default native-feeling button.

---

## Sample to add — `samples/vite-react-firestore-auth/`

Build a real working Vite-React sample that uses both features and serves as the validation target.

```
samples/vite-react-firestore-auth/
├── package.json               (vite, react, react-dom — no firebase, wizard adds it)
├── vite.config.js
├── index.html
├── .env.example               (single key: VITE_APP_TITLE)
└── src/
    ├── main.jsx
    ├── App.jsx                ← uses Firestore: lists "notes" from
                                  collection /users/<uid>/notes, "Add note"
                                  button writes a new doc
    ├── App.css
    └── index.css
```

`src/App.jsx` should:
- Import `firebaseConfig` from `./firebase-config.js` (which the wizard generates).
- Initialize Firebase + Firestore.
- Show a list of notes from `/users/<currentUser.uid>/notes` if signed in; show "Please sign in" if not.
- Button: "Add note" → writes a new doc with `{ text: "Note #N", at: serverTimestamp() }`.

The wizard will:
- Detect Vite-React.
- Ask the three questions; user answers yes/yes/no.
- Provision Firestore + write rules + write firebase-config.js + scaffold SignInWithGoogle.
- Build + deploy.

After deploy, opening the URL:
- Shows "Please sign in" + the auto-injected Sign-in button.
- Clicks sign-in → Google OAuth tab → returns signed in.
- Sees an empty list + "Add note" button.
- Click "Add note" three times → three notes appear.
- Refresh page → notes persist (they're in Firestore).

This is the validation criterion. If this sample deploys and works end-to-end, the features are done.

---

## Constraints (apply to both features)

1. **Don't push.** Local commits only.
2. **Don't break existing samples.** static-html, vite-react-real, express-real must all still deploy after these changes.
3. **Tests must pass after every commit.** Run `npm test` from project root (after `nvm use 24`).
4. **TDD where possible.** New helper modules (sdk-config, inject-config logic) get test files first.
5. **One concept per commit.** Conventional commits with scopes (e.g. `feat(inject-config):`, `feat(auth-template):`).
6. **Don't add heavy dependencies.** `firebase` for the user's app is fine; for the toolkit itself, avoid new runtime deps.
7. **Document everything**:
   - Update `docs/HOW_IT_WORKS.md` with the new stage.
   - Update `docs/REVISIT.md` — cross off A1 once landed; note any new follow-ups (e.g. "Next.js auth scaffolding still pending").
   - The README's status table should reflect the new validated shape.

## Where to start

1. Read `docs/HOW_IT_WORKS.md` end to end.
2. Read `docs/REVISIT.md` — especially A1, A2, A3, D2, C5, C6.
3. Read existing `lib/planner/index.mjs`, `stages/provision.sh`, `stages/build.sh`, `ui/src/pages/Progress.jsx` to understand the patterns.
4. Sketch a plan doc at `docs/plans/<date>-shape-b-and-auth.md` first. Get user buy-in before implementing.

## Out of scope (do NOT do these)

- Next.js auth scaffolding (leave for follow-up).
- Other auth providers (Apple, GitHub, anonymous, email/password).
- Server-side auth verification in Cloud Functions.
- Migrating existing apps' data structures to Firestore (that's REVISIT D5).
- Secret handling (REVISIT C6 — the secrets/.env work is a separate prompt).

## Done criteria

- All existing tests pass (currently 34, will grow with new tests).
- `samples/vite-react-firestore-auth/` deploys with the wizard and the live URL demonstrates: Google sign-in works, notes persist in Firestore, refresh preserves state.
- All four wizard paths still work: A (static-html), A+build (vite-react-real), B (vite-react-firestore-auth), C (express-real).
- README + HOW_IT_WORKS + REVISIT all reflect the new state.

---

## When you're done, report back with

- Files created/modified (count + a short list).
- Test count before and after.
- The full URL of the deployed sample (after the user verifies).
- Anything you flipped after seeing the code.
- Open follow-ups for the next iteration.
