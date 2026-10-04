# Cloudflare delivery

Live site: https://readmove.reading-maps.workers.dev/

`wrangler.jsonc` targets the `readmove` Worker with static assets from `dist/`.
Mini Reading is a separate Worker and must not be modified.

## GitHub Actions

`.github/workflows/check.yml` checks every push and pull request: TypeScript tests,
Python coordinate-ingestion tests, production type-check/build, Wrangler dry run,
and desktop/mobile browser tests. Checks need no Cloudflare credentials.

A successful push to `main` additionally uploads the checked `dist/` and deploys
that same artifact using the lockfile-pinned Wrangler. Pull requests and other
branches cannot deploy. Deployment credentials exist only in the deploy step.
The `production` environment records deployments. A concurrency group prevents
overlapping deployments without interrupting an active upload; queued runs skip
commits that no longer match main. A homepage HTTP check follows deployment.
This HTTP check is not a full production browser test and does not auto-rollback.

## One-time activation

These settings must be configured in GitHub; adding the workflow does not create
credentials or enforce branch protection.

1. In Cloudflare, create a dedicated API token with Workers Scripts: Edit for
   the Readmove account only. Follow Cloudflare's Workers CI documentation for
   required account permissions. Do not use a global API key or copy local OAuth
   credentials. This token can affect Workers in the scoped account, so treat it
   as a deployment credential and rotate it if exposed.
2. In GitHub Settings → Environments, create `production`, allow deployments
   from `main` only, and add environment secrets `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`. Keep token values out of chat and source files.
   Required environment reviewers, if enabled, make deployment wait for approval.
3. Protect `main` with a branch rule/ruleset requiring pull requests, the `check`
   status from GitHub Actions, and an up-to-date branch. Disable force pushes and
   deletion. Do not require the `deploy` job before merging: it runs after merge.
4. Commit/push the workflow changes and merge through a pull request. Confirm
   `check` and `deploy` succeed in Actions and inspect the live map. Until then,
   the new delivery path is not active.

Use GitHub Actions as the deployment owner; check for any Cloudflare Builds Git
integration before activation to avoid a second deployment bypassing these tests.
Repository/environment settings and an actual Actions deployment must be verified
separately; local checks cannot establish that they are configured.

## Local checks and manual recovery

`npm run cf:check` builds and performs a credential-free deployment dry run.
For an intentional manual deployment, log in with `npx wrangler login` then run
`npm run cf:deploy`. Manual deployment bypasses the CI gate, so first run the
same tests against the exact checkout. No new national data downloads occur in CI.

Sources: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
and [GitHub deployment concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
