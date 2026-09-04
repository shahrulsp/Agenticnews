# Agenticnews

Agenticnews is a bilingual SvelteKit news site with a protected admin review flow, Neon Postgres storage, and an internal ingest endpoint for AI-generated article drafts.

## Current shape

- Public homepage and article pages backed by Neon
- Admin login, pending review queue, approve and reject actions
- Server-side sanitization on both write and render
- Internal draft ingest endpoint for workflow payloads
- Separate editorial review in `/admin` after workflow delivery

## Local setup

1. Install dependencies:

```sh
npm install
```

2. Create your local env file:

```sh
cp .env.example .env
```

3. Fill in at minimum:

- `NEON_DATABASE_URL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_COOKIE_SECRET`

Optional but useful for the full flow:

- `INTERNAL_INGEST_TOKEN`
- `MISTRAL_API_KEY`
- `PUBLIC_DEFAULT_LOCALE`

## Database bootstrap

Apply the initial schema in your Neon database:

```sh
psql "$NEON_DATABASE_URL" -f db/001_init.sql
```

Optional local seed:

```sh
psql "$NEON_DATABASE_URL" -f db/002_seed_sample_articles.sql
```

Local rollback/reset script:

```sh
psql "$NEON_DATABASE_URL" -f db/999_reset_local.sql
```

Optional local/manual smoke-data cleanup:

```sh
psql "$NEON_DATABASE_URL" -f db/998_cleanup_smoke_articles.sql
```

## Run the app

```sh
npm run dev
```

Useful checks:

```sh
npm run check
npm run test:unit -- --run
npm run lint
npm run build
```

Deployment and operations notes live in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Important routes

- `/` public homepage
- `/article/[slug]` public article detail
- `/admin/login` admin sign-in
- `/admin` pending review queue
- `/api/internal/drafts` internal draft ingest endpoint

## Internal ingest contract

Request:

```http
POST /api/internal/drafts
Authorization: Bearer <INTERNAL_INGEST_TOKEN>
Content-Type: application/json
```

Payload shape:

```json
{
	"article": {
		"slug": "hello-world",
		"category": "tech",
		"region": "global",
		"hype_level": "medium",
		"workflow_execution_id": "wf-execution-123",
		"tags": ["ai", "daily"],
		"source_url": "https://example.com/story",
		"source_name": "Example News",
		"source_date": "2026-09-03",
		"factcheck_verdict": "verified",
		"factcheck_confidence": 80,
		"factcheck_summary": "<p>Checked summary</p>",
		"ms": {
			"title": "Halo Dunia",
			"body": "<p>Isi BM</p>"
		},
		"en": {
			"title": "Hello World",
			"body": "<p>English body</p>"
		}
	}
}
```

Success response:

```json
{
	"id": "article-123",
	"slug": "hello-world",
	"status": "pending",
	"workflow_execution_id": "wf-execution-123",
	"admin_url": "http://localhost:5173/admin/article-123"
}
```

Example `curl` smoke test:

```sh
curl -X POST "http://127.0.0.1:4173/api/internal/drafts" \
  -H "Authorization: Bearer <INTERNAL_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{
  "article": {
    "slug": "live-mistral-smoke-test",
    "category": "tech",
    "region": "global",
    "hype_level": "medium",
    "workflow_execution_id": "wf-execution-live-smoke-001",
    "tags": ["ai", "smoke"],
    "source_url": "https://example.com/live-smoke",
    "source_name": "Live Smoke Source",
    "source_date": "2026-09-03",
    "factcheck_verdict": "verified",
    "factcheck_confidence": 87,
    "factcheck_summary": "<p>Checked during live smoke test.</p>",
    "ms": {
      "title": "Ujian asap Mistral langsung",
      "body": "<p>Draf ini dihantar untuk menguji aliran ingest langsung.</p>"
    },
    "en": {
      "title": "Live Mistral smoke test",
      "body": "<p>This draft was sent to verify the live ingest flow.</p>"
    }
  }
}
EOF
```

## Workflow run checks

List recent workflow runs to discover real execution IDs:

```sh
npm run list:workflow-runs -- --limit 10
```

You can also filter the list:

```sh
npm run list:workflow-runs -- --status RUNNING
npm run list:workflow-runs -- --search approval
```

## Starting a real Mistral workflow

Mistral Workflows runs in hybrid mode: Mistral hosts the orchestrator, and your workflow code runs in your environment through a worker process. The quickest path is:

1. Install Python 3.12+ and `uv`.
2. Scaffold a workflow project with `uvx mistralai-workflows-cli setup`.
3. Define a workflow that generates a draft and posts it into Agenticnews.
4. Start the worker locally so it auto-registers the workflow with Mistral.
5. Make sure the worker also knows `AGENTICNEWS_BASE_URL` and `INTERNAL_INGEST_TOKEN`.
6. Trigger one execution from the Mistral Console or API.
7. Confirm the worker inserts a pending article into Agenticnews, then approve or reject it from `/admin`.

Minimal example:

```python
from pydantic import BaseModel
import mistralai.workflows as workflows

class ReviewInput(BaseModel):
    slug: str = "agenticnews-morning-run"
    topic: str = "AI and technology trends shaping Asia today"

@workflows.workflow.define(
    name="agenticnews-review",
    workflow_display_name="Agenticnews Review",
    workflow_description="Generates a draft and posts it into Agenticnews for editorial review."
)
class AgenticnewsReviewWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: ReviewInput) -> dict:
        # Generate and ingest the draft here, then finish.
        return {"status": "draft_ingested"}
```

Start the worker:

```sh
MISTRAL_API_KEY="your-key" \
DEPLOYMENT_NAME="agenticnews-review" \
AGENTICNEWS_BASE_URL="https://your-app.example.com" \
INTERNAL_INGEST_TOKEN="same-token-as-agenticnews" \
uv run python src/worker.py
```

Trigger the workflow from the Mistral Console, or by API:

```sh
curl -X POST "https://api.mistral.ai/v1/workflows/agenticnews-review/execute" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"input":{"slug":"agenticnews-morning-run","topic":"AI and technology trends shaping Asia today"}}'
```

After that, list the runs and grab the real execution ID:

```sh
npm run list:workflow-runs -- --search agenticnews-review
```

The worker should now post the draft into Agenticnews automatically. Seeing the execution remain in `RUNNING` is expected until the admin sends approval or rejection from `/admin`.

Official references:

- [Build a workflow](https://docs.mistral.ai/getting-started/quickstarts/developer/build-a-workflow)
- [Workflows overview](https://docs.mistral.ai/studio-api/workflows/getting-started/overview)
- [Workers](https://docs.mistral.ai/studio/workflows/getting-started/core_concepts/workers)

## Notes

- The admin flow works without Mistral callback env vars; callbacks are skipped gracefully.
- Prefer `workflow_execution_id` in ingest payloads. It is stored in the existing `agent_run_id` column so approve or reject actions can signal the running Mistral workflow execution.
- Public and admin article HTML is sanitized on the server before rendering.
- Seed data includes one published article and one pending draft so both sides of the app are easy to test quickly.
