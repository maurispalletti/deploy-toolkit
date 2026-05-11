# v0.1-cli snapshot

Frozen on **2026-05-11**, before any UI wrapper work began.

This directory preserves the **CLI-only orchestrator** that worked end-to-end during smoke testing on 2026-05-08. The bash script in this folder is the **last orchestrator built purely around the terminal**.

## What's at this snapshot

- `deploy-app` — the bash entry point at the moment v0.1-cli was tagged. Calls `lib/brain.mjs` and the five scripts in `stages/`, all of which existed at the same point in the tree.
- The git tag **`v0.1-cli`** points to the same commit. The whole repo at that commit is the recoverable state.

## When you might want this

You shouldn't normally need to restore from this. The UI work in v1.x is purely additive — the CLI path keeps working through `./deploy-app . --cli`. But if something goes wrong and you want to fall back to the pure-CLI version:

### Quick file restore (just the orchestrator)

```bash
cp docs/snapshots/v0.1-cli/deploy-app deploy-app
```

This only works if `lib/` and `stages/` haven't been deleted from the tree.

### Full restore (every file at v0.1-cli)

```bash
git checkout v0.1-cli         # detaches HEAD to the tag
# inspect, copy what you need, then return to current work:
git checkout master
```

To create a branch at the snapshot for active work:

```bash
git checkout -b cli-recovery v0.1-cli
```

## State at this snapshot

- 33 tests passing (`npm test`)
- End-to-end smoke test passed against samples/static-html on 2026-05-08
- Idempotent re-run verified
- Live deployed test app: https://mauri-cli-test-0-7maa.web.app
- Known follow-ups tracked in `docs/REVISIT.md` (added separately as part of UI work)
