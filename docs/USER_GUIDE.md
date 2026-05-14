# User Guide

The complete guide to deploying your app with this toolkit. Read top-to-bottom, or skip to whatever you need.

> This is a living document. It reflects what the tool actually does. If anything in here disagrees with what you see on screen, the tool is right and this doc is wrong — please file an issue.

---

## What you'll end up with

After ~2-5 minutes you'll have:

- A **live URL** like `my-cool-app.web.app` that anyone can open from anywhere.
- Your app on **Google's Firebase servers**, set up for free or near-free.
- The ability to **redeploy in one click** when you change your code.

You don't need to learn anything new about cloud platforms. You don't sign up for any new service besides the Google account you probably already have.

---

## Table of contents

1. [What this tool does](#1-what-this-tool-does)
2. [Quick start (UI wizard)](#2-quick-start-ui-wizard)
3. [Quick start (CLI for developers)](#3-quick-start-cli-for-developers)
4. [What the tool creates for you behind the scenes](#4-what-the-tool-creates-for-you-behind-the-scenes)
5. [Three kinds of app this works for](#5-three-kinds-of-app-this-works-for)
6. [When the wizard pauses to ask you something](#6-when-the-wizard-pauses-to-ask-you-something)
7. [Costs (will you ever pay?)](#7-costs-will-you-ever-pay)
8. [What you'll still need to do yourself](#8-what-youll-still-need-to-do-yourself)
9. [Troubleshooting](#9-troubleshooting)
10. [First time on a brand-new project](#10-first-time-on-a-brand-new-project)
11. [Further reading](#11-further-reading)

---

## 1. What this tool does

You point `deploy-toolkit` at a folder on your computer. The tool **checks your setup**, **looks at your app**, **asks you a few short questions**, and then **publishes your app to the internet** on Google's free Firebase service. The result is a sharable web address.

By default everything happens in a browser tab the tool opens for you — you barely touch the terminal after the first command. There's a developer-only "CLI mode" that does the same thing entirely in the terminal.

## 2. Quick start (UI wizard)

You need:

- macOS (the wizard's folder picker is macOS-only today — Linux/Windows can still use the developer CLI mode below)
- A Google account
- A few minutes

Steps:

```bash
cd /path/to/deploy-toolkit   # wherever you cloned this repo
./deploy-app
```

A browser tab opens. From there:

| Page | What you do |
|---|---|
| **Welcome** | Click **Pick folder**, choose your app folder from the macOS dialog, click **Get started**. |
| **Quick check** | Wait for three green checkmarks. If anything's red, the wizard tells you exactly how to fix it (usually one click). |
| **What we found** | The tool shows what it thinks your app is. Click **Yes, that's right** if it looks correct. |
| **A few questions** | Two or three plain-language questions — what to call your app, whether users sign in, whether your app saves things. |
| **Here's what we'll do** | A bulleted preview of every step. Nothing has been created yet. Click **Deploy**. |
| **Working on it** | Steps run in real time. Watch the checkmarks turn green. |
| **🎉 Your app is live** | The web address appears. Click it. Done. |

### First time? Two minor things may pop up

- **Firebase asks to accept terms** — happens once per Google account, ever. 30 seconds, one click. The wizard handles it gracefully.
- **Sign-in needs one click in the console** — if your app uses Google sign-in, the wizard pre-opens a tab where you turn it on. The Done-page checklist reminds you.

Both are documented in detail in [§10](#10-first-time-on-a-brand-new-project).

### Re-running on the same app

After a successful deploy, run the same command again to update your app. The wizard remembers your previous answers and skips straight to the Done page — click **Deploy a fresh build** to push your new code.

## 3. Quick start (CLI for developers)

```bash
cd /path/to/deploy-toolkit
./deploy-app /path/to/your/app --cli
```

You answer the same questions at the terminal prompt. Same stages, same output. Error messages are plainer than in the wizard (no recovery pages — you read the error and act).

## 4. What the tool creates for you behind the scenes

You don't need to understand these to use the tool — but if you're curious:

The tool sets up a **workspace for your app on Google's servers** (a "Firebase project"), then publishes your code to it. Depending on your answers:

- **Always**: a public website at `your-app-name.web.app`.
- **If you said yes to "save data"**: an online database, locked down so only signed-in users can read or write their own data.
- **If you said yes to "users sign in"**: Google sign-in is enabled for your project, and (for Vite-React apps) the tool can write the sign-in code into your app for you.
- **If your app has server-side code (Cloud Functions)**: that gets deployed too, reachable at `/api/*` paths.

Everything lives in the Firebase Console at `https://console.firebase.google.com` where you can see, manage, or delete it.

<details>
<summary>The exact list of resources created (for developers)</summary>

| Resource | When | What it is |
|---|---|---|
| GCP project | Always | The underlying Google Cloud project. Firebase is a layer on top. |
| Firebase project | Always | Activated on the GCP project, same ID. |
| Firebase Hosting site | Always | Serves your static files at `https://<id>.web.app`. |
| `firebase.json` in your app folder | Always | Generated config describing the deploy. |
| `.firebaserc` | Always | Pins your folder to the Firebase project. |
| `firestore.rules` | Only if needed | Locked-down default — authenticated users can read/write only their own data under `/users/<uid>/`. |
| Cloud Functions deployment | Only when your folder has a `functions/` directory with `firebase-functions` as a dep | Reachable at `/api/*` via hosting rewrites. |
| Auth Google provider | Only if needed | Enabled in the project. You still flip it on in the console once. |

</details>

## 5. Three kinds of app this works for

### 1. Just a website (no server, no database)

A folder of HTML/CSS/JS, or a React/Vue/Svelte/Next.js project that builds to static files. **Free forever**, no credit card needed.

**Example apps:** a calculator, a portfolio, a static dashboard, a landing page, a side-scrolling browser game.

In this repo: [`samples/static-html/`](../samples/static-html/) and [`samples/vite-react-real/`](../samples/vite-react-real/).

### 2. Website + your own data (and optionally sign-in)

Same as above, but your app talks directly to a database (Firestore) and/or asks users to sign in with Google. **Free for personal-scale traffic** — no credit card.

**Example apps:** a notes app, a habit tracker, a tiny multi-user todo list, a friends-only photo wall.

In this repo: [`samples/vite-react-firestore-auth/`](../samples/vite-react-firestore-auth/) — a working notes app with sign-in.

For Vite-React, the wizard can **add the Sign-in button to your code for you** automatically. For other frameworks (Next.js, plain HTML), the wizard generates a step-by-step prompt you can paste into Claude Code or another AI tool to add the code itself.

### 3. Website + custom server code

Your app has a Node.js server piece (usually Express) that does work the browser can't — calling third-party APIs with secret keys, processing files, that kind of thing. **Google requires a credit card** for this (Firebase's Blaze plan), but the actual bill stays at $0/month for almost all personal apps.

**Example apps:** anything that calls Stripe, anything that uses an OpenAI / Anthropic API key, anything with backend logic users shouldn't see.

In this repo: [`samples/express-real/`](../samples/express-real/) — Express function + static frontend.

<details>
<summary>How the tool decides which kind your app is</summary>

The tool looks at your `package.json` and source files to figure out the framework (Vite, Next.js, CRA, plain HTML, Express, etc.) and whether you have a `functions/` directory with `firebase-functions` listed as a dependency. It also detects if your code uses a database that Firebase can't run (sqlite, postgres, mysql, mongodb) — see [§6](#6-when-the-wizard-pauses-to-ask-you-something).

</details>

## 6. When the wizard pauses to ask you something

The wizard tries to catch problems **before** they cause a failed deploy. When it does, it stops, explains what's going on in plain English, and gives you concrete options.

### "Wrong Google account"

You're signed into Firebase as someone else (e.g. your work account when you wanted your personal one). The Quick-check page shows the wrong email. Click **Switch account** and pick the right one.

### "First time using Firebase on this Google account"

Google requires you to accept Firebase's terms once per account, and they only let you do it through their console (not via this tool). The wizard pauses on a friendly page with a button that takes you to the right place. You make any throwaway project there, accept terms, come back, click "I'm done", continue. Takes 30 seconds, only ever happens once.

### "Your app needs a database we haven't set up yet"

Brand-new Firebase projects need you to create the actual database once (pick a region + click "Production mode"). The wizard pre-opens the right page during setup so you can do it while it works on other things. If the deploy hits this before you've finished, you get a clear retry message — finish creating the database, run the tool again, it picks up where it left off.

### "Your app uses a database Firebase can't run"

If your code uses sqlite, postgres, mysql, or MongoDB locally, Firebase can't run that. The wizard detects this and pauses with three big choice cards:

- **🪄 Get help moving to a Firebase database** — generates a structured prompt you copy and paste into Claude Code, Cursor, or another AI tool. The AI does the refactor. You re-run the wizard.
- **Skip the server part for now** — just deploy the website, the data-saving parts won't work yet.
- **Cancel** — exit, think about it.

The prompt content shows up right there in the wizard for one-click copy — no need to find files.

### "We found secrets hardcoded in your code"

If you have something like `const STRIPE_KEY = "sk_live_..."` typed directly into your code, the wizard catches it and stops you. Hardcoded secrets end up in your public app bundle — anyone with the URL could read them. The wizard shows what it found (just the first few characters of the key, not the whole thing) and offers:

- **🪄 Get help moving secrets to a safe place** — generates an AI prompt that walks the AI through moving keys into a `.env` file and reading them via environment variables.
- **I've already moved them** — re-checks your code.
- **Stop and decide later** — exits.

### "Are these config values safe to share?"

If your app reads from environment variables, the wizard asks for each one: is this safe for users to see, or does it need to stay server-only? The tool picks sensible defaults (anything starting with `VITE_` or `NEXT_PUBLIC_` is treated as safe by default).

### "How do you want sign-in added to your code?"

If you said yes to sign-in, the wizard offers two paths:

- **Add it for me (automatic)** — recommended if your app is Vite-React with a standard structure. The wizard writes the code and wires it up.
- **Give me a prompt for my AI tool** — recommended for other frameworks or complicated apps. The wizard generates a copy-pasteable prompt.

### "Your app needs Firebase's pay-as-you-go plan"

If your app has server code, Firebase requires you to be on their Blaze plan (credit card on file). The Plan-summary page warns you about this upfront, and links to Firebase's pricing page. Your credit card won't actually be charged for typical personal-scale traffic — see [§7](#7-costs-will-you-ever-pay).

## 7. Costs (will you ever pay?)

**Short answer: for ~99% of personal projects, no.** Even when you're on the pay-as-you-go plan, the free monthly quotas are generous enough that small apps cost $0/month in practice. The credit card requirement is Google being cautious, not them planning to bill you.

### Firebase has two pricing tiers

| Plan | Cost | What it includes | When you'd be on it |
|---|---|---|---|
| **Spark** | Free, no credit card | Hosting, database (Firestore), sign-in, file storage — within monthly free quotas. | Apps without server code (the first two kinds in §5). |
| **Blaze** | Pay-as-you-go | Everything above + Cloud Functions, advanced features. **Same free quotas as Spark; you only pay past them.** Credit card required. | Apps with custom server code (the third kind in §5). |

### What the free quotas look like

On Blaze you can do all of this every month before owing anything:

- 2 million Cloud Function calls
- 1 GB Firestore storage, 50,000 reads/day, 20,000 writes/day
- 10 GB hosting bandwidth/day

For a personal app shared with friends, you'd need to do something accidentally weird (like a bug causing an infinite loop) to ever blow past these.

### When you actually pay

- Your app gets unexpectedly popular and crosses the free thresholds.
- A bug causes your server code to call itself in a loop and burn invocations.

If you're worried, set a budget alert in Google Cloud Console — Google will email you when you cross any dollar threshold.

## 8. What you'll still need to do yourself

The tool automates almost everything but leaves a few things in your hands. Each of these is on the roadmap; see [`REVISIT.md`](REVISIT.md) for the tracking.

- **Click "Enable Google sign-in" in the Firebase Console** once per project if your app uses sign-in. The tool pre-opens the right page for you.
- **Click "Create database"** once per project if your app uses Firestore on a brand-new project. The tool pre-opens this too.
- **Write your app's data-saving code if it doesn't use Firestore yet.** The tool generates a clear "to-do list" you paste into Claude Code or another AI tool to do the migration.
- **Move hardcoded secrets out of your code.** Same approach — the tool generates an AI prompt to help.

That's it. Everything else (creating cloud projects, picking a region, configuring hosting, wiring up the database rules, scaffolding sign-in code for Vite-React) the tool does for you.

## 9. Troubleshooting

### Sign-in doesn't work after deploy

Most common cause: you haven't enabled Google sign-in in the Firebase Console yet. Open your deployed app's Done page, click **"Open sign-in settings"** in the checklist, toggle Google on, save. Refresh your app — sign-in should work.

### "Missing or insufficient permissions" when saving data

The default database rules only allow users to save data under their own user ID. If your app tries to save somewhere else, you'll see this error in the browser console. Fix: edit your app code to save under `/users/<your-user-id>/...`, or edit the `firestore.rules` file in your app folder to allow what you need, then redeploy.

### "Your project must be on the Blaze plan"

Click the upgrade URL in the error, add a billing account on Firebase, then re-run the tool. It'll pick up where it left off. (Note: this only happens for apps with server code.)

### "Failed to add Firebase to Google Cloud Platform project"

First-time-on-this-Google-account issue. Follow the wizard's recovery page — create any throwaway project in Firebase Console first, then retry. See [§10](#10-first-time-on-a-brand-new-project).

### "The project cannot be created because you have exceeded your allotted project quota"

Google caps personal accounts at ~12 projects (including soft-deleted ones for 30 days). You can either:

- **Restore an old soft-deleted project** at https://console.cloud.google.com/cloud-resource-manager → click "Show deleted projects" → restore one → reuse it.
- **Request a quota increase** at https://support.google.com/code/contact/project_quota_increase (usually approved within an hour for personal accounts).

### Browser doesn't open

The wizard prints `▸ deploy-toolkit UI: http://localhost:4242/` (or similar) in your terminal. Open that URL by hand.

### The wizard says my old project still exists

After a successful deploy, the wizard remembers your folder. If you want a clean slate, delete the saved config:

```bash
rm /path/to/your/app/deploy-app.config.json
```

Then run the wizard again — it'll start fresh.

### Still stuck?

Open an issue at https://github.com/maurispalletti/deploy-toolkit/issues with what you tried and what happened (a screenshot of the terminal helps).

## 10. First time on a brand-new project

When you deploy to a brand-new Firebase project, there are up to **three manual clicks** the tool can't automate. None take more than 30 seconds. The wizard surfaces them on the Done page as a checklist. Read this section if you want to know all of them up front.

### Click 1 — Accept Firebase Terms of Service (first project ever)

The very first Firebase project on your Google account.

Open Firebase Console → create any throwaway project → accept the terms when asked. The wizard pauses on a friendly page guiding you through this when it happens. Once-per-account, ever.

<details>
<summary>Why this can't be automated</summary>

Google requires the Firebase Terms of Service to be accepted via the Firebase Console UI before they let API tools create projects on your behalf. There's no programmatic equivalent. We've checked.

</details>

### Click 2 — Turn on Google sign-in (only when your app uses it)

Every new Firebase project where you said "yes" to sign-in.

The wizard pre-opens the right Firebase Console page during deploy. You click "Google" in the list of sign-in providers, toggle it on, pick a support email, save. Until you do this, the Sign-in button in your app will fail with `auth/configuration-not-found`.

<details>
<summary>Why this can't be automated</summary>

Firebase has no CLI command for auth provider settings. The underlying API exists (Identity Platform) but requires a Blaze upgrade and configuration of OAuth consent screens — Google deliberately gates this behind a manual click. Tracked as REVISIT A2.

</details>

### Click 3 — Initialize Firestore (sometimes — only on a brand-new project with a database)

Brand-new projects where you said "yes" to the database question. Existing projects where Firestore is already set up don't need this.

The wizard pre-opens the right Firebase Console page during deploy. You click "Create database", pick any region (eur3 or us-central1 are common), pick "Production mode", click Enable. Takes ~30 seconds.

<details>
<summary>Why this isn't yet automated</summary>

A Firebase CLI command for this exists (`firebase firestore:databases:create`), but it requires picking a region as a flag with no good default. We'll wire it up once we settle on a region strategy. Tracked as REVISIT B6.

</details>

### Cheat sheet

```
First time ever, no sign-in, no database  →  1 click  (accept Firebase terms)
First time ever, with sign-in            →  2 clicks (+ enable Google)
First time ever, with sign-in + database →  3 clicks (+ create Firestore database)
Existing project, just redeploying       →  0 clicks
```

## 11. Further reading

- **How every stage works internally:** [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — for developers wanting to understand or contribute.
- **Backlog of design topics and follow-ups:** [REVISIT.md](REVISIT.md) — running list of what's planned, what's deferred, and why.
- **Rolling back to a previous version:** [ROLLBACK.md](ROLLBACK.md) — how to go back to the v0.1-cli tag if a new release misbehaves.
- **Hand-off prompts for external AI agents:** [prompts/](prompts/) — briefs another AI can read to extend the toolkit.
