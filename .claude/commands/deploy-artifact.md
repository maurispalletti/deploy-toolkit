Deploy a Claude artifact to Firebase Hosting with its own GitHub repository.

Takes a Claude artifact URL, fetches its HTML, scaffolds a project directory, creates a private GitHub repo, provisions Firebase, and puts the artifact live at `https://your-project.web.app`.

ARGUMENTS: $ARGUMENTS

---

## Step 0 — Validate the input

`$ARGUMENTS` must be a Claude artifact URL. Valid formats:
- `https://claude.ai/code/artifact/{uuid}`
- `https://claude.site/artifacts/{uuid}`
- `https://preview.claude.ai/...`

If no URL was provided or the argument doesn't look like a Claude artifact URL, stop and ask the user to run the command again with a URL, e.g.:

```
/deploy-artifact https://claude.ai/code/artifact/your-uuid-here
```

---

## Step 1 — Check prerequisites

Run the preflight check to verify git, gh, node (≥22), and firebase CLIs are installed and authenticated:

```bash
bash ~/Documents/deploy-toolkit/stages/preflight.sh
```

If preflight fails, stop and tell the user which tool to install or which login to complete before continuing.

---

## Step 2 — Fetch the artifact

Use WebFetch to retrieve the artifact page from `$ARGUMENTS`. Extract the full HTML content — this is what will be deployed.

From the HTML, try to find a meaningful title by checking (in order):
1. The `<title>` tag
2. The first `<h1>` tag
3. If neither is useful, use "my-artifact"

---

## Step 3 — Propose a project name and confirm

Derive a candidate project name from the title found in Step 2:
- Lowercase everything
- Replace any character that isn't `a-z`, `0-9`, or `-` with a hyphen
- Collapse multiple consecutive hyphens into one
- Strip leading and trailing hyphens
- Truncate to 25 characters
- If the result is shorter than 6 characters, pad with `-app` or ask the user for a name

A valid project name must:
- Be 6–25 characters
- Start with a letter
- Contain only `a-z`, `0-9`, and `-`
- Be globally unique on Firebase (if it's taken the next step will fail with a clear error)

Show the candidate name to the user and ask them to confirm or type an alternative. Wait for their response before continuing.

---

## Step 4 — Create the project directory and GitHub repo

Use the confirmed project name as `PROJECT_NAME`. Run:

```bash
bash ~/Documents/deploy-toolkit/stages/init-project.sh ~/Documents PROJECT_NAME
```

This creates `~/Documents/PROJECT_NAME/`, initialises a git repo on `main`, and creates a private GitHub repository called `PROJECT_NAME` under the authenticated GitHub account.

If the GitHub repo already exists the stage links to it instead of creating a new one. If it fails for another reason (auth, name conflict), stop and show the error to the user.

Set `APP_DIR` to `~/Documents/PROJECT_NAME` for the remaining steps.

---

## Step 5 — Write the artifact as index.html

Create a `public/` subdirectory inside `APP_DIR` and write the full HTML content from Step 2 there:

Write the complete HTML string to `APP_DIR/public/index.html`.

---

## Step 6 — Write deploy-app.config.json

Write the following JSON to `APP_DIR/deploy-app.config.json`, substituting `PROJECT_NAME` for the confirmed name:

```json
{
  "appName": "PROJECT_NAME",
  "shape": "A",
  "firebase": { "projectId": "PROJECT_NAME" },
  "hosting": {
    "publicDir": "public",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "auth": null,
  "firestore": { "rulesFile": "firestore.rules" },
  "functions": null,
  "secrets": null,
  "build": {
    "command": null,
    "outputDir": "public"
  }
}
```

---

## Step 7 — Provision Firebase

Run:

```bash
bash ~/Documents/deploy-toolkit/stages/provision.sh "$APP_DIR"
```

This creates the Firebase project, writes `firebase.json` and `.firebaserc` into `APP_DIR`, and ensures the Firestore database exists. If the Firebase project ID is already taken globally, stop and ask the user to pick a different project name and re-run from Step 3.

If the output contains `DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP`, tell the user:

> Your Google account needs a one-time billing bootstrap before Firebase can create projects. Visit https://console.firebase.google.com and create a project manually (free tier is fine), then run `/deploy-artifact` again.

---

## Step 8 — Build (no-op for a static artifact)

Run:

```bash
bash ~/Documents/deploy-toolkit/stages/build.sh "$APP_DIR"
```

There is no build command for a plain HTML artifact so this will complete instantly.

---

## Step 9 — Deploy

Run:

```bash
bash ~/Documents/deploy-toolkit/stages/deploy.sh "$APP_DIR"
```

If deployment fails with the Firestore 403 error, the stage will print instructions to create the database via the Firebase Console. Show those instructions to the user, wait for them to confirm, then re-run this step.

---

## Step 10 — Report the live URL

Run:

```bash
bash ~/Documents/deploy-toolkit/stages/report.sh "$APP_DIR"
```

This prints the live URL (`https://PROJECT_NAME.web.app`) and next-step hints.

---

## Step 11 — Commit the scaffolding

Stage and commit everything that was added (index.html, config, Firebase files):

```bash
cd "$APP_DIR" && git add -A && git commit -m "feat: deploy artifact to Firebase Hosting" && git push origin main
```

---

## Done

Tell the user:
- The live URL where their artifact is now hosted
- The GitHub repo URL
- That future redeploys can be done by running `./deploy-app "$APP_DIR"` from the deploy-toolkit directory
