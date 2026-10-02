# Apply stage 2 after milestone 1

The new deliverable, `readmove-stage2.patch`, is **incremental**: apply it to the milestone-1 files you already added. It does not assume a particular local commit SHA. A ZIP of the same patch is provided because the larger self-hosted geography increases the download size. Extract it first.

From your local readmove checkout:

```sh
git status --short
git apply --check /path/to/readmove-stage2.patch
git apply /path/to/readmove-stage2.patch
npm ci
npm test
npm run build
npm run dev
```

If the check reports conflicts, reconcile your local edits; do not force-overwrite them. This patch replaces the old central-area JSON files with a v2 manifest, building chunks, vector tiles and lazy search/index files. It also adds the sold-price import foundations and comparable filters. No real sales are bundled.

Suggested commit messages (run commits yourself):

```text
Build readmove 3D property research prototype
```

for milestone 1, then:

```text
Expand Reading map and add sold-price ingestion foundations
```

for this stage. No agent commit, push or deployment has been made. Continue using your existing `Zagitalc/readmove` remote and review staged files before you push.

---

# Original milestone-1 handoff

The deliverable is `readmove-milestone1.patch`, based on readmove's initial commit `2113e5f656e399bd4b771d215b884a82e0deac48`, which contains only `LICENSE`. It creates the new application files and does not change that licence. No commits or pushes were made by the agent.

Download the patch from the chat to your machine. Run the following **yourself** inside your local `readmove` folder, substituting the patch path:

```sh
cd /path/to/your/readmove
git status --short
git apply --check /path/to/readmove-milestone1.patch
git apply /path/to/readmove-milestone1.patch
npm ci
npm test
npm run build
npm run dev
```

Check existing local changes first. If `git apply --check` reports conflicts or files already exist, stop and reconcile those files; do not use a forced overwrite. The patch includes the lockfile and local geography, so you do not need the reference project or a data-download step to start.

## Connect your local folder to GitHub

If the folder is already your checkout of `Zagitalc/readmove`, keep its current remote. Verify with `git remote -v`; no remote change is needed.

If you have not created a local checkout yet, the simplest path is to clone **readmove** first, then apply the patch there:

```sh
git clone https://github.com/Zagitalc/readmove.git /path/to/your/readmove
cd /path/to/your/readmove
git apply --check /path/to/readmove-milestone1.patch
git apply /path/to/readmove-milestone1.patch
```

This clones the target repository, not Mini Reading. For an existing non-Git local folder, preserve its contents and use a separate fresh readmove checkout, then reconcile your own files there. Avoid creating unrelated history and force-pushing over the existing remote.

Once you have reviewed and tested the result, you can commit and push it:

```sh
git switch -c milestone-1
git add .
git diff --cached --stat
git commit -m "Build readmove property research prototype"
git push -u origin milestone-1
```

Inspect staged files before committing. `node_modules`, caches, generated builds, test outputs and secrets are ignored. The patch is also ignored if you save it inside the checkout. GitHub authentication is handled by your local Git setup; never paste credentials into source files or this chat.

The cloud agent cannot directly attach this remote workspace to an unprovided folder on your machine. Applying the patch in your local checkout makes that connection through your existing Git remote. Cloudflare publication is a separate action described in the README.
