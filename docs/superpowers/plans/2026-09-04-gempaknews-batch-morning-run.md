# Gempaknews Batch Morning Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 5-10 morning drafts per workflow run, support the new `crime` category, rename the batch slug base to `gempaknews-morning-run`, and make the `/admin` pending desk easier to triage in batches.

**Architecture:** Keep one scheduled workflow execution per morning, but change the worker to produce a structured list of drafts and ingest them one-by-one into Agenticnews. Each draft gets a deterministic indexed daily slug so reruns stay idempotent. The admin desk stays in SvelteKit, but shifts toward a compact newsroom board with batch visibility and easier triage.

**Tech Stack:** Python 3.12 + `mistralai-workflows`, SvelteKit, TypeScript, Neon Postgres, Vitest

---

### Task 1: Add `crime` Category Support End-to-End

**Files:**
- Create: `db/003_add_crime_category.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/server/ingest.ts`
- Test: `src/lib/server/ingest.spec.ts`

- [ ] Add a Neon migration that safely appends `crime` to the `article_category` enum.
- [ ] Update the shared `ArticleCategory` union and ingest allow-list so `crime` payloads are accepted.
- [ ] Add or adjust an ingest test to prove `crime` parses successfully.

### Task 2: Convert the Worker from One Draft to a Morning Batch

**Files:**
- Modify: `/Users/shahrulsp/Trae/agenticnews-workflow/src/agenticnews_workflow/review.py`
- Modify: `/Users/shahrulsp/Trae/agenticnews-workflow/README.md`

- [ ] Change the worker schema from a single article payload to a list payload with a default batch count in the 5-10 range.
- [ ] Rename the slug base to `gempaknews-morning-run`.
- [ ] Generate deterministic indexed slugs per day such as `gempaknews-morning-run-2026-09-04-01`.
- [ ] Ingest each generated draft sequentially and return a batch summary with created, refreshed, and already-published outcomes.

### Task 3: Keep Ingest Idempotent for Batch Reruns

**Files:**
- Modify: `src/lib/server/queries.ts`
- Test: `src/lib/server/queries.spec.ts`
- Test: `src/routes/api/internal/drafts/server.spec.ts`

- [ ] Reuse the existing upsert behavior for pending/rejected drafts during same-day reruns.
- [ ] Keep published stories protected.
- [ ] Ensure the endpoint continues returning a clean conflict response for published duplicates so the worker can classify them as already done.

### Task 4: Redesign the Pending Desk for 5-10 Drafts

**Files:**
- Modify: `src/routes/admin/+page.server.ts`
- Modify: `src/routes/admin/+page.svelte`
- Modify: `src/routes/admin/[id]/+page.svelte`

- [ ] Add batch-friendly queue context such as total pending, latest received time, and category counts.
- [ ] Redesign the pending list into a compact editorial board with clearer hierarchy and faster scanning.
- [ ] Add lightweight client-side category filtering for triage, including the new `crime` lane.
- [ ] Polish the detail page copy and navigation so the editor can move through a batch more comfortably.

### Task 5: Verify and Document the New Morning Run

**Files:**
- Modify: `README.md`
- Modify: `DEPLOYMENT.md`
- Modify: `/Users/shahrulsp/Trae/agenticnews-workflow/README.md`

- [ ] Update docs to describe the new batch run, the `crime` category, the `gempaknews-morning-run` slug base, and the required DB migration.
- [ ] Run focused tests plus full app checks and worker syntax validation.
- [ ] Note the deploy order: apply DB migration, redeploy Agenticnews, redeploy Railway worker, then trigger a fresh run.

