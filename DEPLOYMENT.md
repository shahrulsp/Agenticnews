# Agenticnews Deployment Runbook

This document captures the production-shaped setup we validated locally and with the Railway-hosted Mistral worker.

## Architecture

- `Agenticnews`: SvelteKit web app, admin review UI, internal ingest endpoint, Neon database access
- `agenticnews-workflow`: Python Mistral workflow worker running continuously on Railway
- `Neon Postgres`: source of truth for articles and review state
- `Mistral Workflows`: orchestration layer for long-running review flows

## Services

### Web app

The SvelteKit app can run on your normal Node host or platform of choice.

Required environment variables:

- `NEON_DATABASE_URL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_COOKIE_SECRET`

Optional but recommended:

- `INTERNAL_INGEST_TOKEN`
- `MISTRAL_API_KEY`
- `MISTRAL_SIGNAL_NAME`
- `PUBLIC_DEFAULT_LOCALE`

### Worker

The sibling `agenticnews-workflow` project should run as a separate always-on worker service.

Current production target:

- Railway

Required worker environment variables:

- `MISTRAL_API_KEY`
- `DEPLOYMENT_NAME=agenticnews-review`

## Pre-deploy checklist

1. Confirm the database schema is applied with `db/001_init.sql`.
2. Confirm admin secrets are real values, not placeholders.
3. Confirm `ADMIN_PASSWORD_HASH` keeps escaped dollar signs in env files.
4. Confirm `INTERNAL_INGEST_TOKEN` is a real random bearer token.
5. Confirm the Railway worker has the same `MISTRAL_API_KEY` expected by the app.
6. Confirm the worker logs show `agenticnews-review` registered successfully.

## Release checklist

1. Deploy or restart the Railway worker first.
2. Check Railway logs for:
   - connection to the Mistral workflow scheduler
   - registration of `agenticnews-review`
   - worker startup on task queue `agenticnews-review`
3. Deploy the SvelteKit app.
4. Open `/admin/login` and confirm admin sign-in still works.
5. Trigger a small draft ingest using the internal endpoint.
6. Approve or reject the draft from `/admin`.
7. Confirm the app redirects with a `workflow=sent` banner.
8. Confirm the workflow execution moves to `COMPLETED`.

## Smoke test commands

From the app project:

```sh
npm run list:workflow-runs -- --limit 10
```

```sh
npm run smoke:workflow -- \
  --execution-id <real-execution-id> \
  --slug <article-slug> \
  --status approved
```

## Upstream contract

The ingest side should send:

- `workflow_execution_id`

The app stores that value in `articles.agent_run_id`, and the admin review callback uses it to signal Mistral via:

- `POST /v1/workflows/executions/{execution_id}/signals`

The execute endpoint for the worker expects this body shape:

```json
{
	"input": {
		"slug": "article-slug"
	}
}
```

## Cleanup

Smoke-test articles from local validation can be removed with:

```sh
psql "$NEON_DATABASE_URL" -f db/998_cleanup_smoke_articles.sql
```

Review the SQL first and keep it for local or explicit manual cleanup only.

## Rollback

### Web app rollback

1. Redeploy the previous known-good web build.
2. Keep the worker running unless the issue is clearly worker-specific.
3. Verify `/admin` still loads and the public homepage still renders.

### Worker rollback

1. Redeploy the previous known-good Railway release.
2. Confirm worker logs show successful registration.
3. Start one fresh workflow execution and send a test signal.

### Database rollback

For local reset only:

```sh
psql "$NEON_DATABASE_URL" -f db/999_reset_local.sql
psql "$NEON_DATABASE_URL" -f db/001_init.sql
psql "$NEON_DATABASE_URL" -f db/002_seed_sample_articles.sql
```

Do not run the full reset script against production data.

## Known operational lessons

- Do not shell-source `.env` directly when `NEON_DATABASE_URL` contains `&`; extract the exact line instead.
- Do not use placeholder values for `MISTRAL_API_KEY` or execution IDs when testing workflow callbacks.
- The Mistral worker runtime requires `mistralai-workflows` and Python 3.12+.
- The admin flow is non-blocking by design: article review should still succeed even if workflow signaling fails.
