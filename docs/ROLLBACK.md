# Rollback guide

How to restore previous versions of `deploy-toolkit` if a new release misbehaves.

## Frozen versions

Each major shift in the toolkit is tagged and snapshotted.

| Version | Tagged | What's in it |
|---|---|---|
| **v0.1-cli** | 2026-05-11 | The CLI-only orchestrator. Last build before any UI wrapper work. End-to-end smoke test confirmed working on 2026-05-08. |

Snapshots also live as literal file copies under `docs/snapshots/<version>/` so you can recover by hand even without git knowledge.

## Restoring v0.1-cli

The CLI path keeps working in all later versions through `./deploy-app . --cli`. Use this rollback only if the bash entry script itself has broken.

### Option A — restore just the bash entry (fastest)

```bash
cp docs/snapshots/v0.1-cli/deploy-app deploy-app
```

Then run `./deploy-app .` as usual. Works only while `lib/` and `stages/` still exist in the tree.

### Option B — check out the tag

```bash
git checkout v0.1-cli      # detach to the tag
./deploy-app samples/static-html
git checkout master         # back to current work when done
```

### Option C — branch from the tag

For active hacking on the old version:

```bash
git checkout -b cli-recovery v0.1-cli
```
