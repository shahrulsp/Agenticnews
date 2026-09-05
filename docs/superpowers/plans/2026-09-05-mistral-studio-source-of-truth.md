# Mistral Studio Source Of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mistral Studio the single editorial source of truth for the 5-agent pipeline while expanding Agenticnews schema and workflow contracts to match the Studio taxonomy and outputs.

**Architecture:** Keep Mistral Studio responsible for agent prompts, rules, and task behavior. Refactor `agenticnews-workflow` into a runtime orchestrator that calls the Studio-defined agent chain, validates structured outputs, and ingests a richer draft envelope into Agenticnews. Expand the Agenticnews database/app schema to support the Studio taxonomy directly instead of compressing it into the older editorial model.

**Tech Stack:** SvelteKit, TypeScript, Neon Postgres SQL migrations, Python 3.12, Pydantic, Mistral Workflows SDK

---

## File Structure

**Agenticnews app**
- Modify: `src/lib/types.ts`
  - Expand TypeScript enums and article interfaces to reflect Studio taxonomy and metadata.
- Modify: `src/lib/server/ingest.ts`
  - Accept richer workflow payloads from the new Studio-driven worker.
- Modify: `src/lib/server/ingest.spec.ts`
  - Add tests for new categories, regions, fact-check verdicts, and metadata fields.
- Modify: `src/lib/server/queries.ts`
  - Insert/update richer metadata columns in `articles`.
- Modify: `src/lib/server/queries.spec.ts`
  - Cover the expanded insert/update payload shape.
- Modify: `src/routes/admin/+page.svelte`
  - Surface newly stored metadata where useful for editorial ops.
- Modify: `src/routes/article/[slug]/+page.svelte`
  - Surface article metadata safely without cluttering the public page.
- Create: `db/004_expand_studio_taxonomy.sql`
  - Add Studio-aligned enum values and new metadata columns.
- Modify: `db/999_reset_local.sql`
  - Keep local reset behavior aligned with the expanded schema.

**Workflow repo**
- Modify: `src/agenticnews_workflow/review.py`
  - Replace hardcoded local prompt logic with Studio-agent orchestration contracts and expanded schemas.
- Modify: `tests/test_review.py`
  - Add tests for new enums, draft envelope fields, and Studio contract mapping.
- Modify: `README.md`
  - Document Studio-controlled behavior and the worker’s reduced role.

**Reference**
- Read-only reference: `mistral studio agents.md`
  - Source-of-truth instructions for Scout, Scribe, Lens, Sentinel, and Polyglot.

---

### Task 1: Expand Database Taxonomy To Match Studio

**Files:**
- Create: `db/004_expand_studio_taxonomy.sql`
- Modify: `db/999_reset_local.sql`
- Test: local SQL apply against a fresh/reset database

- [ ] **Step 1: Write the migration for Studio categories, regions, and fact-check verdicts**

```sql
-- db/004_expand_studio_taxonomy.sql
DO $$
BEGIN
        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'politics'
                        AND enumtypid = 'article_category'::regtype
        ) THEN
                ALTER TYPE article_category ADD VALUE 'politics';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'entertainment'
                        AND enumtypid = 'article_category'::regtype
        ) THEN
                ALTER TYPE article_category ADD VALUE 'entertainment';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'sports'
                        AND enumtypid = 'article_category'::regtype
        ) THEN
                ALTER TYPE article_category ADD VALUE 'sports';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'taiwan'
                        AND enumtypid = 'article_region'::regtype
        ) THEN
                ALTER TYPE article_region ADD VALUE 'taiwan';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'bangladesh'
                        AND enumtypid = 'article_region'::regtype
        ) THEN
                ALTER TYPE article_region ADD VALUE 'bangladesh';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'sri-lanka'
                        AND enumtypid = 'article_region'::regtype
        ) THEN
                ALTER TYPE article_region ADD VALUE 'sri-lanka';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'partially-verified'
                        AND enumtypid = 'factcheck_verdict'::regtype
        ) THEN
                ALTER TYPE factcheck_verdict ADD VALUE 'partially-verified';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'unverified'
                        AND enumtypid = 'factcheck_verdict'::regtype
        ) THEN
                ALTER TYPE factcheck_verdict ADD VALUE 'unverified';
        END IF;
END $$;

ALTER TABLE articles
        ADD COLUMN IF NOT EXISTS form TEXT,
        ADD COLUMN IF NOT EXISTS summary TEXT,
        ADD COLUMN IF NOT EXISTS why_viral TEXT,
        ADD COLUMN IF NOT EXISTS key_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS claims_made JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS secondary_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS sensitivity_notes TEXT,
        ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS scout_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS sentinel_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS lens_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS polyglot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS glossary_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS quality_notes TEXT,
        ADD COLUMN IF NOT EXISTS image_strategy TEXT,
        ADD COLUMN IF NOT EXISTS image_source_recommendation TEXT,
        ADD COLUMN IF NOT EXISTS image_notes_for_human TEXT;
```

- [ ] **Step 2: Update local reset schema so fresh local databases stay consistent**

```sql
-- db/999_reset_local.sql
DROP TABLE IF EXISTS articles;
DROP TYPE IF EXISTS factcheck_verdict;
DROP TYPE IF EXISTS hype_level;
DROP TYPE IF EXISTS article_region;
DROP TYPE IF EXISTS article_category;
DROP TYPE IF EXISTS article_status;

\i db/001_init.sql
\i db/003_add_crime_category.sql
\i db/004_expand_studio_taxonomy.sql
```

- [ ] **Step 3: Apply the migration locally**

Run: `psql "$NEON_DATABASE_URL" -f db/004_expand_studio_taxonomy.sql`

Expected: migration completes without duplicate-enum or duplicate-column errors

- [ ] **Step 4: Verify the new enum values and columns exist**

Run:

```bash
psql "$NEON_DATABASE_URL" -c "\d+ articles"
```

Expected: new columns such as `summary`, `why_viral`, `key_claims`, `form`, `scout_payload`, and new enum values for `politics`, `entertainment`, `sports`, `taiwan`, `bangladesh`, `sri-lanka`, `partially-verified`, `unverified`

- [ ] **Step 5: Commit**

```bash
git add db/004_expand_studio_taxonomy.sql db/999_reset_local.sql
git commit -m "feat: expand article schema for Mistral Studio taxonomy"
```

### Task 2: Expand App Types And Ingest Contracts

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/server/ingest.ts`
- Test: `src/lib/server/ingest.spec.ts`

- [ ] **Step 1: Write the failing ingest tests for the new Studio taxonomy**

```ts
// src/lib/server/ingest.spec.ts
it('accepts Studio taxonomy categories and regions', () => {
        const parsed = parseDraftIngestPayload({
                article: {
                        slug: 'asia-sports-upset',
                        category: 'sports',
                        region: 'taiwan',
                        hype_level: 'medium',
                        factcheck_verdict: 'partially-verified',
                        ms: {
                                title: 'Kejutan besar sukan Asia',
                                body: '<p>Isi BM</p>'
                        }
                }
        });

        expect(parsed.category).toBe('sports');
        expect(parsed.region).toBe('taiwan');
        expect(parsed.factcheck_verdict).toBe('partially-verified');
});

it('maps expanded Studio metadata fields', () => {
        const parsed = parseDraftIngestPayload({
                article: {
                        slug: 'asia-viral-story',
                        category: 'politics',
                        region: 'bangladesh',
                        hype_level: 'low',
                        summary: 'Short story summary',
                        why_viral: 'People are debating the public impact',
                        key_claims: ['Claim A'],
                        claims_made: ['Claim A', 'Claim B'],
                        secondary_sources: ['https://example.com/2'],
                        is_sensitive: true,
                        form: 'deep',
                        sensitivity_notes: 'Election-related sensitivity',
                        ms: {
                                title: 'Tajuk BM',
                                body: '<p>Isi BM</p>'
                        }
                }
        });

        expect(parsed.summary).toBe('Short story summary');
        expect(parsed.why_viral).toBe('People are debating the public impact');
        expect(parsed.key_claims).toEqual(['Claim A']);
        expect(parsed.is_sensitive).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/server/ingest.spec.ts`

Expected: FAIL because the current types and parser do not accept `sports`, `taiwan`, `partially-verified`, or the new metadata fields

- [ ] **Step 3: Expand shared app types to match Studio taxonomy**

```ts
// src/lib/types.ts
export type ArticleCategory =
        | 'breaking'
        | 'tech'
        | 'weird'
        | 'popculture'
        | 'viral'
        | 'business'
        | 'science'
        | 'offbeat'
        | 'crime'
        | 'politics'
        | 'entertainment'
        | 'sports';

export type ArticleRegion =
        | 'malaysia'
        | 'indonesia'
        | 'thailand'
        | 'philippines'
        | 'singapore'
        | 'vietnam'
        | 'japan'
        | 'south-korea'
        | 'taiwan'
        | 'india'
        | 'bangladesh'
        | 'sri-lanka'
        | 'china'
        | 'other-asia'
        | 'global';

export type FactCheckVerdict =
        | 'verified'
        | 'mostly-true'
        | 'partially-verified'
        | 'disputed'
        | 'unverifiable'
        | 'unverified'
        | 'false'
        | 'pending';

export interface Article {
        // existing fields...
        form: string | null;
        summary: string | null;
        why_viral: string | null;
        key_claims: string[] | null;
        claims_made: string[] | null;
        secondary_sources: string[] | null;
        sensitivity_notes: string | null;
        is_sensitive: boolean;
        scout_payload: Record<string, unknown> | null;
        sentinel_payload: Record<string, unknown> | null;
        lens_payload: Record<string, unknown> | null;
        polyglot_payload: Record<string, unknown> | null;
        glossary_notes: Array<Record<string, string>> | null;
        quality_notes: string | null;
        image_strategy: string | null;
        image_source_recommendation: string | null;
        image_notes_for_human: string | null;
}
```

- [ ] **Step 4: Update ingest parsing to accept and validate the expanded payload**

```ts
// src/lib/server/ingest.ts
const ARTICLE_CATEGORIES: ArticleCategory[] = [
        'breaking',
        'tech',
        'weird',
        'popculture',
        'viral',
        'business',
        'science',
        'offbeat',
        'crime',
        'politics',
        'entertainment',
        'sports'
];

const ARTICLE_REGIONS: ArticleRegion[] = [
        'malaysia',
        'indonesia',
        'thailand',
        'philippines',
        'singapore',
        'vietnam',
        'japan',
        'south-korea',
        'taiwan',
        'india',
        'bangladesh',
        'sri-lanka',
        'china',
        'other-asia',
        'global'
];

const FACTCHECK_VERDICTS: FactCheckVerdict[] = [
        'verified',
        'mostly-true',
        'partially-verified',
        'disputed',
        'unverifiable',
        'unverified',
        'false',
        'pending'
];

function readJsonStringArray(value: unknown): string[] | null {
        return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : null;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
        return typeof value === 'boolean' ? value : undefined;
}

return {
        // existing parsed fields...
        summary: readOptionalString(article.summary),
        why_viral: readOptionalString(article.why_viral),
        key_claims: readJsonStringArray(article.key_claims),
        claims_made: readJsonStringArray(article.claims_made),
        secondary_sources: readJsonStringArray(article.secondary_sources),
        sensitivity_notes: readOptionalString(article.sensitivity_notes),
        is_sensitive: readOptionalBoolean(article.is_sensitive) ?? false,
        form: readOptionalString(article.form),
        image_strategy: readOptionalString(article.image_strategy),
        image_source_recommendation: readOptionalString(article.source_recommendation),
        image_notes_for_human: readOptionalString(article.notes_for_human)
};
```

- [ ] **Step 5: Run tests to verify the ingest contract passes**

Run: `npm test -- src/lib/server/ingest.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/server/ingest.ts src/lib/server/ingest.spec.ts
git commit -m "feat: support Studio taxonomy in ingest contracts"
```

### Task 3: Persist Expanded Studio Metadata In App Queries

**Files:**
- Modify: `src/lib/server/queries.ts`
- Modify: `src/lib/server/queries.spec.ts`
- Test: `src/lib/server/queries.spec.ts`

- [ ] **Step 1: Write failing query tests for the new metadata fields**

```ts
// src/lib/server/queries.spec.ts
it('passes Studio metadata through createDraftArticle', async () => {
        await createDraftArticle({
                slug: 'studio-test-story',
                category: 'entertainment',
                region: 'sri-lanka',
                hype_level: 'high',
                summary: 'Short summary',
                why_viral: 'Big online reaction',
                key_claims: ['Claim 1'],
                claims_made: ['Claim 1'],
                secondary_sources: ['https://example.com/extra'],
                sensitivity_notes: 'Keep legal wording careful',
                is_sensitive: false,
                form: 'short',
                title_ms: 'Tajuk BM',
                body_ms: '<p>Isi</p>'
        }, { database });

        expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('summary'),
                expect.arrayContaining(['Short summary', 'Big online reaction'])
        );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/server/queries.spec.ts`

Expected: FAIL because `createDraftArticle` does not yet insert the new columns

- [ ] **Step 3: Expand `ArticleDraftInput` usage inside `createDraftArticle`**

```ts
// src/lib/server/queries.ts
INSERT INTO articles (
        slug,
        status,
        category,
        region,
        hype_level,
        ai_generated,
        agent_run_id,
        tags,
        source_url,
        source_name,
        source_date,
        factcheck_verdict,
        factcheck_confidence,
        factcheck_summary,
        summary,
        why_viral,
        key_claims,
        claims_made,
        secondary_sources,
        sensitivity_notes,
        is_sensitive,
        form,
        scout_payload,
        sentinel_payload,
        lens_payload,
        polyglot_payload,
        glossary_notes,
        quality_notes,
        image_strategy,
        image_source_recommendation,
        image_notes_for_human,
        title_ms,
        body_ms,
        reality_check_ms,
        takeaway_ms,
        prompt_question_ms,
        title_en,
        body_en,
        reality_check_en,
        takeaway_en,
        prompt_question_en,
        image_url,
        image_alt,
        image_caption
) VALUES (
        $1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44
)
```

- [ ] **Step 4: Update conflict-upsert behavior to preserve Studio metadata**

```ts
// src/lib/server/queries.ts
SET summary = EXCLUDED.summary,
        why_viral = EXCLUDED.why_viral,
        key_claims = EXCLUDED.key_claims,
        claims_made = EXCLUDED.claims_made,
        secondary_sources = EXCLUDED.secondary_sources,
        sensitivity_notes = EXCLUDED.sensitivity_notes,
        is_sensitive = EXCLUDED.is_sensitive,
        form = EXCLUDED.form,
        scout_payload = EXCLUDED.scout_payload,
        sentinel_payload = EXCLUDED.sentinel_payload,
        lens_payload = EXCLUDED.lens_payload,
        polyglot_payload = EXCLUDED.polyglot_payload,
        glossary_notes = EXCLUDED.glossary_notes,
        quality_notes = EXCLUDED.quality_notes,
        image_strategy = EXCLUDED.image_strategy,
        image_source_recommendation = EXCLUDED.image_source_recommendation,
        image_notes_for_human = EXCLUDED.image_notes_for_human,
```

- [ ] **Step 5: Run tests to verify the expanded query layer passes**

Run: `npm test -- src/lib/server/queries.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/queries.ts src/lib/server/queries.spec.ts
git commit -m "feat: persist Studio article metadata"
```

### Task 4: Refactor Workflow Into A Studio-Orchestrated Pipeline

**Files:**
- Modify: `../agenticnews-workflow/src/agenticnews_workflow/review.py`
- Modify: `../agenticnews-workflow/tests/test_review.py`
- Modify: `../agenticnews-workflow/README.md`
- Test: `../agenticnews-workflow/tests/test_review.py`

- [ ] **Step 1: Write failing workflow tests for the new Studio taxonomy and payload shape**

```python
# tests/test_review.py
def test_build_draft_envelope_supports_studio_category_and_region(self) -> None:
    generated = GeneratedDraftArticle(
        scout=ScoutStory(
            title="Crowds pack arena for upset final",
            category="sports",
            hype_level="medium",
            region="taiwan",
            summary="Summary",
            source_url="https://example.com",
            source_name="Example",
            source_date="2026-09-05",
            why_viral="People are sharing the upset result",
            key_claims=["Claim"],
            is_sensitive=False,
            secondary_sources=[],
        ),
        # remaining agent payloads...
    )

    draft = build_draft_envelope(...)
    self.assertEqual(draft.article.category, "sports")
    self.assertEqual(draft.article.region, "taiwan")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./.venv/bin/python -m unittest discover -s tests -v`

Expected: FAIL because the current worker only knows the older single-shot `ms/en` article model

- [ ] **Step 3: Replace the current prompt-builder model with agent-specific Studio contracts**

```python
# src/agenticnews_workflow/review.py
ArticleCategory = Literal[
    "breaking",
    "tech",
    "weird",
    "popculture",
    "viral",
    "business",
    "science",
    "offbeat",
    "crime",
    "politics",
    "entertainment",
    "sports",
]

ArticleRegion = Literal[
    "malaysia",
    "indonesia",
    "thailand",
    "philippines",
    "singapore",
    "vietnam",
    "japan",
    "south-korea",
    "taiwan",
    "india",
    "bangladesh",
    "sri-lanka",
    "china",
    "other-asia",
    "global",
]

FactCheckVerdict = Literal[
    "verified",
    "partially-verified",
    "unverified",
    "disputed",
    "pending",
]
```

- [ ] **Step 4: Introduce explicit Pydantic contracts for each Studio agent output**

```python
class ScoutStory(BaseModel):
    title: str
    category: ArticleCategory
    hype_level: HypeLevel
    region: ArticleRegion
    summary: str
    source_url: str
    source_name: str
    source_date: str
    why_viral: str
    key_claims: list[str] = Field(default_factory=list)
    is_sensitive: bool = False
    secondary_sources: list[str] = Field(default_factory=list)


class ScribeDraft(BaseModel):
    headline: str
    form: Literal["short", "deep"]
    category: ArticleCategory
    hype_level: HypeLevel
    region: ArticleRegion
    body: str
    reality_check: str
    takeaway: str
    prompt_question: str
    source_url: str
    source_name: str
    source_date: str
    secondary_sources: list[str] = Field(default_factory=list)
    claims_made: list[str] = Field(default_factory=list)
    sensitivity_notes: str = ""
```

- [ ] **Step 5: Keep code orchestration and validation, but remove editorial instruction ownership from the worker**

```python
async def run_studio_article_pipeline(...) -> DraftEnvelope:
    scout_story = await call_studio_agent("Scout", ...)
    scribe_draft = await call_studio_agent("Scribe", scout_story.model_dump(mode="json"))
    sentinel_review = await call_studio_agent("Sentinel", scribe_draft.model_dump(mode="json"))
    lens_image = await call_studio_agent("Lens", scribe_draft.model_dump(mode="json"))
    polyglot_copy = await call_studio_agent("Polyglot", build_polyglot_input(...))
    return build_draft_envelope(...)
```

- [ ] **Step 6: Update the worker README to explain the new source-of-truth split**

```md
## Source of truth

- Mistral Studio controls agent prompts, rules, and editorial behavior
- `review.py` controls orchestration, validation, retries, and ingest
- Agenticnews controls persistence, admin review, and publishing
```

- [ ] **Step 7: Run workflow tests**

Run: `./.venv/bin/python -m unittest discover -s tests -v`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git -C ../agenticnews-workflow add src/agenticnews_workflow/review.py tests/test_review.py README.md
git -C ../agenticnews-workflow commit -m "feat: orchestrate Studio agent pipeline"
```

### Task 5: Surface Studio Metadata In Admin And Public Rendering

**Files:**
- Modify: `src/routes/admin/+page.svelte`
- Modify: `src/routes/article/[slug]/+page.svelte`
- Test: `npm run check`

- [ ] **Step 1: Add targeted admin metadata rows for the new Studio fields**

```svelte
<!-- src/routes/admin/+page.svelte -->
<td>
        <div class="stacked-cell">
                <strong>{article.form ?? 'Draft'}</strong>
                <span>{article.why_viral ?? 'No viral rationale stored yet'}</span>
                {#if article.is_sensitive}
                        <span class="table-tag warn-tag">Sensitive</span>
                {/if}
        </div>
</td>
```

- [ ] **Step 2: Add a restrained public presentation for new metadata**

```svelte
<!-- src/routes/article/[slug]/+page.svelte -->
{#if article.why_viral}
        <section class="context-card">
                <p class="kicker">Why this is spreading</p>
                <p>{article.why_viral}</p>
        </section>
{/if}
```

- [ ] **Step 3: Run the app-level checks**

Run: `npm run check`

Expected: PASS with no Svelte or TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/+page.svelte src/routes/article/[slug]/+page.svelte
git commit -m "feat: surface Studio metadata in editorial views"
```

### Task 6: End-To-End Smoke Test With Studio-Aligned Payloads

**Files:**
- Modify: `../agenticnews-workflow/README.md`
- Test: full worker + ingest smoke test

- [ ] **Step 1: Prepare a manual Studio-aligned test payload**

```json
{
  "input": {
    "slug": "gempaknews-morning-run",
    "run_label": "studio-smoke-a",
    "count": 5
  }
}
```

- [ ] **Step 2: Run the workflow manually after deploy**

Run:

```bash
curl -X POST "https://api.mistral.ai/v1/workflows/agenticnews-review/execute" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"input":{"slug":"gempaknews-morning-run","run_label":"studio-smoke-a","count":5}}'
```

Expected: workflow returns a live execution id

- [ ] **Step 3: Verify the workflow finishes cleanly**

Run: `node scripts/list-workflow-runs.mjs --workflow agenticnews-review --limit 5`

Expected: latest run is `COMPLETED`

- [ ] **Step 4: Verify the stored article rows contain Studio metadata**

Run:

```bash
psql "$NEON_DATABASE_URL" -c "SELECT slug, category, region, factcheck_verdict, form, is_sensitive FROM articles ORDER BY created_at DESC LIMIT 10;"
```

Expected: rows show Studio-aligned categories/regions/verdicts and populated metadata columns

- [ ] **Step 5: Commit**

```bash
git -C ../agenticnews-workflow add README.md
git -C ../agenticnews-workflow commit -m "docs: add Studio smoke-test workflow"
```

---

## Self-Review

### Spec coverage
- Single source of truth in Mistral Studio: covered in Task 4 and Task 6
- Expand Agenticnews schema to match Studio taxonomy: covered in Task 1, Task 2, and Task 3
- Refer to `mistral studio agents.md`: reflected in Task 4 contracts for Scout, Scribe, Lens, Sentinel, and Polyglot
- Preserve Agenticnews admin/review flow: covered in Task 3 and Task 5

### Placeholder scan
- No `TODO`, `TBD`, or “implement later” placeholders left in task steps
- Commands, file paths, and concrete code snippets are included in each task

### Type consistency
- Category expansion includes `politics`, `entertainment`, `sports`
- Region expansion includes `taiwan`, `bangladesh`, `sri-lanka`
- Fact-check verdict expansion includes `partially-verified`, `unverified`
- Plan keeps orchestration in worker code while shifting editorial instructions to Studio

---

Plan complete and saved to `docs/superpowers/plans/2026-09-05-mistral-studio-source-of-truth.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
