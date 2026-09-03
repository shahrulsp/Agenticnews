# Architecture Guide

## Neon Postgres + SvelteKit + Mistral Workflows — No Strapi

This guide replaces the Strapi CMS with a lean stack: **Neon Postgres** for storage, **SvelteKit** for both the public site and a simple admin approval page, and **Mistral Workflows** for AI orchestration with HITL approval.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MISTRAL WORKFLOWS                      │
│                                                           │
│  Scout → Scribe → Sentinel → Lens → Polyglot             │
│                                      │                    │
│                                      ▼                    │
│                        ┌─────────────────────┐           │
│                        │  publish_to_neon     │           │
│                        │  (writes draft to    │           │
│                        │   Postgres, status   │           │
│                        │   = 'pending')       │           │
│                        └────────┬────────────┘           │
│                                 │                          │
│                                 ▼                          │
│                        ┌─────────────────────┐           │
│                        │  WAIT FOR SIGNAL     │           │
│                        │  (human_approval)    │           │
│                        └────────┬────────────┘           │
│                                 │                          │
│                        ┌────────▼─────────────┐          │
│                        │  on_approve          │           │
│                        │  (sets status=        │           │
│                        │   'published')        │           │
│                        └──────────────────────┘          │
└─────────────────────────────────────────────────────────┘
          │                                    ▲
          │ writes draft                        │ approval signal
          ▼                                     │
┌─────────────────────────────────────────────────────────┐
│                   NEON POSTGRES                           │
│                                                           │
│  articles table:                                         │
│  - id, slug, status, category, region, hype_level         │
│  - title_ms, body_ms, reality_check_ms, takeaway_ms,      │
│    prompt_question_ms                                     │
│  - title_en, body_en, reality_check_en, takeaway_en,      │
│    prompt_question_en                                     │
│  - image_url, image_alt, source_url, agent_run_id        │
│  - factcheck_verdict, factcheck_confidence,              │
│    factcheck_summary                                      │
│  - created_at, published_at                              │
└─────────────────────────────────────────────────────────┘
          │                                     │
          ▼                                     │
┌─────────────────────────────────────────────────────────┐
│                    SVELTEKIT APP                          │
│                                                           │
│  PUBLIC ROUTES (SSR):           ADMIN ROUTES (auth):      │
│  /                  → homepage  /admin          → pending  │
│  /article/[slug]    → article    /admin/[id]     → review   │
│  /category/[cat]    → category  /admin/approve  → POST     │
│  /en/...            → English    /admin/reject  → POST     │
│  toggle                           │                          │
└─────────────────────────────────────────────────────────┘
```

### Why this is better for your case

| Concern        | Strapi                              | No-CMS (this guide)                   |
| -------------- | ----------------------------------- | ------------------------------------- |
| Tools in stack | Strapi + Neon + SvelteKit + Mistral | Neon + SvelteKit + Mistral            |
| Infra to run   | Strapi server (always-on)           | SvelteKit only (already needed)       |
| Admin UI       | Full CMS (overkill)                 | One page: read draft → approve/reject |
| i18n           | Plugin config + per-field toggles   | Two column sets (`_ms`, `_en`)        |
| Schema changes | Content-Type Builder UI             | SQL migration (one file)              |
| API            | Auto-generated REST                 | Direct SQL in SvelteKit server load   |
| Cost           | +€4/mo VPS for Strapi               | €0 extra (SvelteKit already hosted)   |
| Complexity     | 5 tools, 3 services                 | 3 tools, 2 services                   |

---

## 2. Neon Postgres Schema

### 2a. Create the database

In Neon dashboard, create a database called `sprekayasa_news`. Note the connection string:

```
postgres://neondb_owner:password@ep-xxx.us-east-2.aws.neon.tech/sprekayasa_news?sslmode=require
```

### 2b. Schema SQL

```sql
-- ============================================================
-- Articles table — single table, bilingual columns
-- ============================================================

CREATE TYPE article_status AS ENUM (
  'pending',     -- draft from Mistral, awaiting human review
  'published',   -- human approved, visible on site
  'rejected',    -- human rejected, not visible
  'archived'     -- taken down after publishing
);

CREATE TYPE article_category AS ENUM (
  'breaking', 'tech', 'weird', 'popculture',
  'viral', 'business', 'science', 'offbeat'
);

CREATE TYPE article_region AS ENUM (
  'malaysia', 'indonesia', 'thailand', 'philippines',
  'singapore', 'vietnam', 'japan', 'south-korea',
  'china', 'india', 'other-asia', 'global'
);

CREATE TYPE hype_level AS ENUM (
  'low', 'medium', 'high', 'extreme'
);

CREATE TYPE factcheck_verdict AS ENUM (
  'verified', 'mostly-true', 'disputed',
  'unverifiable', 'false', 'pending'
);

CREATE TABLE articles (
  -- Identity
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  status          article_status NOT NULL DEFAULT 'pending',

  -- Classification (shared across locales)
  category        article_category NOT NULL,
  region          article_region NOT NULL,
  hype_level      hype_level NOT NULL DEFAULT 'medium',

  -- AI metadata
  ai_generated    BOOLEAN NOT NULL DEFAULT true,
  agent_run_id    TEXT,
  tags            TEXT[],

  -- Source attribution
  source_url      TEXT,
  source_name     TEXT,
  source_date     DATE,

  -- Fact-check (Sentinel)
  factcheck_verdict     factcheck_verdict NOT NULL DEFAULT 'pending',
  factcheck_confidence  INTEGER NOT NULL DEFAULT 0,
  factcheck_summary     TEXT,

  -- Malay content (default locale)
  title_ms              TEXT NOT NULL,
  body_ms               TEXT NOT NULL,
  reality_check_ms      TEXT,
  takeaway_ms           TEXT,
  prompt_question_ms    TEXT,

  -- English content (optional locale)
  title_en              TEXT,
  body_en               TEXT,
  reality_check_en      TEXT,
  takeaway_en           TEXT,
  prompt_question_en    TEXT,

  -- Visuals (Lens)
  image_url             TEXT,
  image_alt             TEXT,
  image_caption         TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at         TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published ON articles(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_articles_category ON articles(category) WHERE status = 'published';
CREATE INDEX idx_articles_slug ON articles(slug) WHERE status = 'published';
CREATE INDEX idx_articles_region ON articles(region) WHERE status = 'published';
CREATE INDEX idx_articles_agent_run ON articles(agent_run_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 2c. Why a single table with `_ms`/`_en` columns?

- Articles are always written in both languages by Polyglot — no partial translations
- Queries are simple `SELECT title_ms, body_ms FROM articles` — no JOINs
- If a translation is missing, the frontend falls back to Malay (default)
- Adding a 3rd language later = add 5 columns + one migration, not a schema redesign

### 2d. Seed data (optional, for testing)

```sql
INSERT INTO articles (
  slug, status, category, region, hype_level,
  title_ms, body_ms, reality_check_ms, takeaway_ms, prompt_question_ms,
  title_en, body_en, reality_check_en, takeaway_en, prompt_question_en,
  source_url, source_name, source_date,
  factcheck_verdict, factcheck_confidence, factcheck_summary,
  agent_run_id, tags, published_at
) VALUES (
  'test-crocodile-sepang-2026',
  'published',
  'weird', 'malaysia', 'high',
  'Buaya Liar Muncul di Air Pancut Plaza Sepang',
  '## Apa Berlaku

Pengunjung di Plaza Sepang terkejut apabila seekor buaya ditemui di kolam air pancut...',
  'Adakah ini benar? Ya — polis Sepang mengesahkan kejadian.',
  'Insiden ini peringatan tentang risiko kawasan berhampiran sungai.',
  'Pernahkah anda melihat haiwan liar di tempat awam?',
  'Wild Crocodile Appears in Sepang Mall Fountain',
  '## What Happened

Shoppers at Plaza Sepang were stunned when a crocodile was spotted in the mall fountain...',
  'Is this real? Yes — Sepang police confirmed the incident.',
  'This incident is a reminder about risks near river areas.',
  'Have you ever seen a wild animal in a public space?',
  'https://example.com/source', 'Sinar Harian', '2026-09-02',
  'mostly-true', 82, 'Cross-checked with Sepang Municipal Council.',
  'test-run-001',
  ARRAY['buaya', 'viral', 'sepang'],
  now()
);
```

---

## 3. SvelteKit Project Structure

```
news-site/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte                  # Global layout: header, language toggle
│   │   ├── +layout.server.ts               # Sets locale from cookie/URL
│   │   ├── +page.svelte                     # Homepage: latest articles
│   │   ├── +page.server.ts                  # Fetch latest published
│   │   ├── article/
│   │   │   └── [slug]/
│   │   │       ├── +page.svelte             # Article page
│   │   │       └── +page.server.ts          # Fetch single article by slug
│   │   ├── category/
│   │   │   └── [category]/
│   │   │       ├── +page.svelte             # Category listing
│   │   │       └── +page.server.ts
│   │   └── admin/
│   │       ├── +layout.svelte               # Admin layout (minimal nav)
│   │       ├── +layout.server.ts            # Auth guard
│   │       ├── +page.svelte                 # Pending articles list
│   │       ├── +page.server.ts              # Fetch pending
│   │       └── [id]/
│   │           ├── +page.svelte             # Review article (approve/reject)
│   │           └── +page.server.ts          # Fetch single pending + actions
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db.ts                        # Neon connection pool
│   │   │   ├── auth.ts                      # Simple session/bearer auth
│   │   │   └── queries.ts                   # Reusable SQL query functions
│   │   ├── components/
│   │   │   ├── ArticleCard.svelte
│   │   │   ├── LanguageToggle.svelte
│   │   │   ├── FactCheckBadge.svelte
│   │   │   └── HypeMeter.svelte
│   │   ├── stores/
│   │   │   └── locale.ts                    # Svelte store for current locale
│   │   └── types.ts                          # TypeScript types for Article
│   └── app.html
├── static/
├── .env                                     # NEON + MISTRAL + ADMIN secrets
├── package.json
├── svelte.config.js
└── vite.config.ts
```

---

## 4. Environment Variables

### `.env`

```bash
# Neon Postgres
NEON_DATABASE_URL="postgres://neondb_owner:password@ep-xxx.neon.tech/sprekayasa_news?sslmode=require"
DATABASE_POOL_MAX=5

# Admin auth
ADMIN_PASSWORD_HASH="$2a$10$your-bcrypt-hash-here"   # bcrypt hash of admin password
ADMIN_COOKIE_SECRET="your-32-char-random-secret"

# Mistral (for approval signal)
MISTRAL_API_KEY="your-mistral-api-key"
MISTRAL_WORKFLOW_ID="wf-approval-xxxxxx"

# Site
PUBLIC_SITE_URL="https://sprekayasa.com"
PUBLIC_DEFAULT_LOCALE="ms"
```

---

## 5. Neon Database Connection

### `src/lib/server/db.ts`

```typescript
import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';

neonConfig.ssl = true;

// Single connection — fine for low traffic.
// For higher traffic, use the pool import below.
export const sql = neon(env.NEON_DATABASE_URL);

// Optional: connection pool for higher concurrency
// import pg from 'pg';
// const { Pool } = pg;
// export const pool = new Pool({
//   connectionString: env.NEON_DATABASE_URL,
//   max: 5,
//   ssl: true
// });
```

Install the Neon serverless driver:

```bash
npm install @neondatabase/serverless
```

> The `@neondatabase/serverless` driver works in serverless (SvelteKit edge/serverless) and Node.js. If you're deploying to a VPS with a persistent Node process, you can also use `pg` (node-postgres) with a connection pool.

---

## 6. TypeScript Types

### `src/lib/types.ts`

```typescript
export type ArticleStatus = 'pending' | 'published' | 'rejected' | 'archived';
export type ArticleCategory =
	'breaking' | 'tech' | 'weird' | 'popculture' | 'viral' | 'business' | 'science' | 'offbeat';
export type ArticleRegion =
	| 'malaysia'
	| 'indonesia'
	| 'thailand'
	| 'philippines'
	| 'singapore'
	| 'vietnam'
	| 'japan'
	| 'south-korea'
	| 'china'
	| 'india'
	| 'other-asia'
	| 'global';
export type HypeLevel = 'low' | 'medium' | 'high' | 'extreme';
export type FactCheckVerdict =
	'verified' | 'mostly-true' | 'disputed' | 'unverifiable' | 'false' | 'pending';
export type Locale = 'ms' | 'en';

export interface Article {
	id: string;
	slug: string;
	status: ArticleStatus;
	category: ArticleCategory;
	region: ArticleRegion;
	hype_level: HypeLevel;
	ai_generated: boolean;
	agent_run_id: string | null;
	tags: string[] | null;

	source_url: string | null;
	source_name: string | null;
	source_date: string | null;

	factcheck_verdict: FactCheckVerdict;
	factcheck_confidence: number;
	factcheck_summary: string | null;

	// Malay
	title_ms: string;
	body_ms: string;
	reality_check_ms: string | null;
	takeaway_ms: string | null;
	prompt_question_ms: string | null;

	// English
	title_en: string | null;
	body_en: string | null;
	reality_check_en: string | null;
	takeaway_en: string | null;
	prompt_question_en: string | null;

	// Visuals
	image_url: string | null;
	image_alt: string | null;
	image_caption: string | null;

	created_at: string;
	updated_at: string;
	published_at: string | null;
}

// Helper: get localized fields based on locale, fallback to Malay
export function localize(article: Article, locale: Locale) {
	const isEn = locale === 'en';
	return {
		title: isEn && article.title_en ? article.title_en : article.title_ms,
		body: isEn && article.body_en ? article.body_en : article.body_ms,
		reality_check:
			isEn && article.reality_check_en ? article.reality_check_en : article.reality_check_ms,
		takeaway: isEn && article.takeaway_en ? article.takeaway_en : article.takeaway_ms,
		prompt_question:
			isEn && article.prompt_question_en ? article.prompt_question_en : article.prompt_question_ms,
		image_alt: isEn && article.image_alt ? article.image_alt : article.image_alt,
		locale_used: isEn && article.title_en ? 'en' : 'ms'
	};
}
```

---

## 7. Reusable Query Functions

### `src/lib/server/queries.ts`

```typescript
import { sql } from './db';

// ── Public queries (published only) ──

export async function getPublishedArticles(limit = 12, offset = 0) {
	return sql`
    SELECT * FROM articles
    WHERE status = 'published'
    ORDER BY published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getArticleBySlug(slug: string) {
	const rows = await sql`
    SELECT * FROM articles
    WHERE slug = ${slug} AND status = 'published'
    LIMIT 1
  `;
	return rows[0] ?? null;
}

export async function getArticlesByCategory(category: string, limit = 12, offset = 0) {
	return sql`
    SELECT * FROM articles
    WHERE status = 'published' AND category = ${category}::article_category
    ORDER BY published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getArticleCount() {
	const rows = await sql`SELECT count(*)::int as count FROM articles WHERE status = 'published'`;
	return rows[0]?.count ?? 0;
}

// ── Admin queries (all statuses) ──

export async function getPendingArticles() {
	return sql`
    SELECT id, slug, title_ms, title_en, category, region, hype_level,
           factcheck_verdict, factcheck_confidence, source_name,
           created_at, ai_generated, image_url
    FROM articles
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `;
}

export async function getArticleById(id: string) {
	const rows = await sql`SELECT * FROM articles WHERE id = ${id} LIMIT 1`;
	return rows[0] ?? null;
}

export async function approveArticle(id: string) {
	const rows = await sql`
    UPDATE articles
    SET status = 'published', published_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING agent_run_id, slug
  `;
	return rows[0] ?? null;
}

export async function rejectArticle(id: string) {
	const rows = await sql`
    UPDATE articles
    SET status = 'rejected'
    WHERE id = ${id} AND status = 'pending'
    RETURNING agent_run_id, slug
  `;
	return rows[0] ?? null;
}
```

---

## 8. Simple Admin Auth

### `src/lib/server/auth.ts`

```typescript
import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function verifyPassword(password: string): Promise<boolean> {
	return bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
}

export function createSession(cookies: Cookies) {
	const token = crypto.randomUUID();
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		maxAge: SESSION_MAX_AGE
	});
}

export function clearSession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function isAuthenticated(cookies: Cookies): boolean {
	return cookies.get(SESSION_COOKIE) !== undefined;
}
```

Install:

```bash
npm install bcryptjs
```

### Admin layout guard — `src/routes/admin/+layout.server.ts`

```typescript
import { isAuthenticated } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies, url }) => {
	if (!isAuthenticated(cookies) && url.pathname !== '/admin/login') {
		throw redirect(303, '/admin/login');
	}
	return {};
};
```

### Login route — `src/routes/admin/login/+page.server.ts`

```typescript
import { verifyPassword, createSession } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const password = data.get('password') as string;

		if (!password) return fail(400, { error: 'Password required' });

		const valid = await verifyPassword(password);
		if (!valid) return fail(401, { error: 'Wrong password' });

		createSession(cookies);
		throw redirect(303, '/admin');
	}
};
```

### Login page — `src/routes/admin/login/+page.svelte

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Admin Login — Sprekayasa</title></svelte:head>

<div class="login-wrap">
	<h1>Admin</h1>
	<form method="POST" use:enhance>
		<input type="password" name="password" placeholder="Password" required />
		<button type="submit">Log in</button>
	</form>
	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}
</div>

<style>
	.login-wrap {
		max-width: 300px;
		margin: 100px auto;
	}
	input {
		width: 100%;
		padding: 0.75rem;
		margin: 0.5rem 0;
		border: 1px solid #ccc;
		border-radius: 6px;
	}
	button {
		width: 100%;
		padding: 0.75rem;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}
	.error {
		color: #dc2626;
		margin-top: 0.5rem;
	}
</style>
```

> **Generate the bcrypt hash:**
>
> ```bash
> node -e "const b=require('bcryptjs'); console.log(b.hashSync('your-password', 10))"
> ```

---

## 9. Admin: Pending Articles List

### `src/routes/admin/+page.server.ts`

```typescript
import { getPendingArticles } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const articles = await getPendingArticles();
	return { articles };
};
```

### `src/routes/admin/+page.svelte`

```svelte
<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Pending Articles — Admin</title></svelte:head>

<h1>Pending Review ({data.articles.length})</h1>

{#if data.articles.length === 0}
	<p class="empty">No articles awaiting review. 🎉</p>
{/if}

<div class="article-list">
	{#each data.articles as article (article.id)}
		<a href="/admin/{article.id}" class="card">
			{#if article.image_url}
				<img src={article.image_url} alt="" />
			{/if}
			<div class="card-body">
				<h2>{article.title_ms}</h2>
				{#if article.title_en}
					<p class="en">{article.title_en}</p>
				{/if}
				<div class="meta">
					<span class="badge category">{article.category}</span>
					<span class="badge region">{article.region}</span>
					<span class="badge hype">{article.hype_level}</span>
					<span class="badge verdict {article.factcheck_verdict}">
						{article.factcheck_verdict} ({article.factcheck_confidence}%)
					</span>
				</div>
				<p class="source">Source: {article.source_name ?? 'Unknown'}</p>
			</div>
		</a>
	{/each}
</div>

<style>
	h1 {
		margin: 1rem 0;
	}
	.empty {
		color: #666;
		padding: 2rem;
		text-align: center;
	}
	.article-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
	}
	.card:hover {
		border-color: #2563eb;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}
	.card img {
		width: 120px;
		height: 80px;
		object-fit: cover;
		border-radius: 4px;
	}
	.card-body h2 {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
	}
	.en {
		color: #666;
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.badge {
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		font-size: 0.75rem;
		background: #f3f4f6;
	}
	.badge.verdict.verified {
		background: #d1fae5;
	}
	.badge.verdict.mostly-true {
		background: #dbeafe;
	}
	.badge.verdict.disputed {
		background: #fef3c7;
	}
	.badge.verdict.false {
		background: #fee2e2;
	}
	.source {
		font-size: 0.8rem;
		color: #999;
		margin: 0.5rem 0 0;
	}
</style>
```

---

## 10. Admin: Article Review & Approve/Reject

### `src/routes/admin/[id]/+page.server.ts`

```typescript
import { getArticleById, approveArticle, rejectArticle } from '$lib/server/queries';
import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const article = await getArticleById(params.id);
	if (!article) throw error(404, 'Article not found');
	return { article };
};

export const actions: Actions = {
	approve: async ({ params }) => {
		const result = await approveArticle(params.id);
		if (!result) return fail(404, { error: 'Article not found or not pending' });

		// Send approval signal to Mistral workflow
		if (result.agent_run_id) {
			try {
				await fetch(`https://api.mistral.ai/v1/workflows/${env.MISTRAL_WORKFLOW_ID}/signals`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						signal_name: 'human_approval',
						payload: {
							agent_run_id: result.agent_run_id,
							article_slug: result.slug,
							status: 'approved'
						}
					})
				});
			} catch (err) {
				console.error('Mistral signal failed:', err);
				// Don't block the approval — article is already published in DB
			}
		}

		throw redirect(303, '/admin?approved=1');
	},

	reject: async ({ params, request }) => {
		const formData = await request.formData();
		const reason = formData.get('reason') as string;

		const result = await rejectArticle(params.id);
		if (!result) return fail(404, { error: 'Article not found or not pending' });

		// Optional: send rejection signal to Mistral
		if (result.agent_run_id) {
			try {
				await fetch(`https://api.mistral.ai/v1/workflows/${env.MISTRAL_WORKFLOW_ID}/signals`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						signal_name: 'human_approval',
						payload: {
							agent_run_id: result.agent_run_id,
							article_slug: result.slug,
							status: 'rejected',
							reason
						}
					})
				});
			} catch (err) {
				console.error('Mistral signal failed:', err);
			}
		}

		throw redirect(303, '/admin?rejected=1');
	}
};
```

### `src/routes/admin/[id]/+page.svelte`

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();
	const a = data.article;
	let showRejectForm = $state(false);
</script>

<svelte:head><title>Review: {a.title_ms} — Admin</title></svelte:head>

<a href="/admin">← Back to pending</a>

<div class="review">
	<!-- Status badges -->
	<div class="badges">
		<span class="badge category">{a.category}</span>
		<span class="badge region">{a.region}</span>
		<span class="badge hype">Hype: {a.hype_level}</span>
		<span class="badge verdict {a.factcheck_verdict}">
			{a.factcheck_verdict} ({a.factcheck_confidence}%)
		</span>
	</div>

	<!-- Fact-check summary -->
	{#if a.factcheck_summary}
		<div class="factcheck-box">
			<h3>🔍 Sentinel Verdict</h3>
			<p>{a.factcheck_summary}</p>
		</div>
	{/if}

	<!-- Malay version -->
	<section class="locale">
		<h2>🇲🇾 Malay</h2>
		<h1>{a.title_ms}</h1>
		<div class="body-preview">{@html a.body_ms}</div>
		{#if a.reality_check_ms}
			<p class="field"><strong>Reality check:</strong> {a.reality_check_ms}</p>
		{/if}
		{#if a.takeaway_ms}
			<p class="field"><strong>Takeaway:</strong> {a.takeaway_ms}</p>
		{/if}
		{#if a.prompt_question_ms}
			<p class="field"><strong>Prompt question:</strong> {a.prompt_question_ms}</p>
		{/if}
	</section>

	<!-- English version -->
	{#if a.title_en}
		<section class="locale">
			<h2>🇬🇧 English</h2>
			<h1>{a.title_en}</h1>
			<div class="body-preview">{@html a.body_en}</div>
			{#if a.reality_check_en}
				<p class="field"><strong>Reality check:</strong> {a.reality_check_en}</p>
			{/if}
			{#if a.takeaway_en}
				<p class="field"><strong>Takeaway:</strong> {a.takeaway_en}</p>
			{/if}
			{#if a.prompt_question_en}
				<p class="field"><strong>Prompt question:</strong> {a.prompt_question_en}</p>
			{/if}
		</section>
	{:else}
		<p class="missing">⚠️ English translation missing</p>
	{/if}

	<!-- Image -->
	{#if a.image_url}
		<section class="image-section">
			<h3>Image</h3>
			<img src={a.image_url} alt={a.image_alt ?? ''} style="max-width: 100%; border-radius: 8px;" />
			{#if a.image_caption}<p>{a.image_caption}</p>{/if}
		</section>
	{/if}

	<!-- Source -->
	<section class="source">
		<h3>Source</h3>
		<p>{a.source_name} — {a.source_date}</p>
		{#if a.source_url}<p><a href={a.source_url} target="_blank">{a.source_url}</a></p>{/if}
	</section>

	<!-- Actions -->
	<div class="actions">
		<form method="POST" action="?/approve" use:enhance>
			<button type="submit" class="btn-approve">✓ Approve & Publish</button>
		</form>

		{#if !showRejectForm}
			<button on:click={() => (showRejectForm = true)} class="btn-reject-toggle">✗ Reject</button>
		{:else}
			<form method="POST" action="?/reject" use:enhance class="reject-form">
				<textarea name="reason" placeholder="Reason for rejection (optional)"></textarea>
				<button type="submit" class="btn-reject">Confirm Reject</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.review {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0;
	}
	.badge {
		padding: 0.3rem 0.8rem;
		border-radius: 4px;
		font-size: 0.8rem;
		background: #f3f4f6;
	}
	.badge.verdict.verified {
		background: #d1fae5;
	}
	.badge.verdict.mostly-true {
		background: #dbeafe;
	}
	.badge.verdict.disputed {
		background: #fef3c7;
	}
	.badge.verdict.false {
		background: #fee2e2;
	}
	.factcheck-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 0;
	}
	.factcheck-box h3 {
		margin-top: 0;
	}
	.locale {
		border-top: 2px solid #e5e7eb;
		padding-top: 1rem;
		margin-top: 1rem;
	}
	.body-preview {
		line-height: 1.6;
		margin: 1rem 0;
	}
	.field {
		margin: 0.5rem 0;
	}
	.field strong {
		color: #374151;
	}
	.missing {
		color: #dc2626;
	}
	.image-section {
		margin: 1rem 0;
	}
	.source {
		color: #666;
		font-size: 0.9rem;
	}
	.actions {
		position: sticky;
		bottom: 0;
		background: white;
		padding: 1rem 0;
		border-top: 2px solid #e5e7eb;
		display: flex;
		gap: 1rem;
	}
	.btn-approve {
		background: #16a34a;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
	}
	.btn-approve:hover {
		background: #15803d;
	}
	.btn-reject-toggle {
		background: transparent;
		color: #dc2626;
		border: 1px solid #dc2626;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
	}
	.reject-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}
	.reject-form textarea {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		min-height: 60px;
	}
	.btn-reject {
		background: #dc2626;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		align-self: flex-start;
	}
</style>
```

---

## 11. Public Site — SSR Routes

### 11a. Layout with language toggle — `src/routes/+layout.server.ts`

```typescript
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies }) => {
	// Read locale from cookie, default to Malay
	const locale = (cookies.get('locale') as 'ms' | 'en') ?? env.PUBLIC_DEFAULT_LOCALE ?? 'ms';
	return { locale };
};
```

### `src/routes/+layout.svelte`

```svelte
<script lang="ts">
	import { LanguageToggle } from '$lib/components/LanguageToggle.svelte';
	let { data, children } = $props();
</script>

<html lang={data.locale}>
	<body>
		<header>
			<a href="/" class="logo">Sprekayasa</a>
			<LanguageToggle current={data.locale} />
		</header>
		<main>
			{@render children()}
		</main>
		<footer>
			<p>© 2026 Sprekayasa Networks · Berita AI, disemak manusia</p>
		</footer>
	</body>
</html>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', system-ui, sans-serif;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		border-bottom: 1px solid #e5e7eb;
	}
	.logo {
		font-weight: 800;
		font-size: 1.25rem;
		text-decoration: none;
		color: #111;
	}
	footer {
		padding: 2rem;
		text-align: center;
		color: #999;
		font-size: 0.85rem;
		border-top: 1px solid #e5e7eb;
	}
</style>
```

### `src/lib/components/LanguageToggle.svelte`

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { current }: { current: 'ms' | 'en' } = $props();

	function switchLocale(locale: 'ms' | 'en') {
		document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`;
		goto(page.url.pathname + page.url.search, { replaceState: false, invalidateAll: true });
	}
</script>

<div class="toggle">
	<button class:active={current === 'ms'} on:click={() => switchLocale('ms')}>BM</button>
	<button class:active={current === 'en'} on:click={() => switchLocale('en')}>EN</button>
</div>

<style>
	.toggle {
		display: inline-flex;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		overflow: hidden;
	}
	button {
		padding: 0.4rem 0.8rem;
		border: none;
		background: white;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.85rem;
	}
	button.active {
		background: #2563eb;
		color: white;
	}
</style>
```

### 11b. Homepage — `src/routes/+page.server.ts`

```typescript
import { getPublishedArticles } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const articles = await getPublishedArticles(12, 0);
	return { articles };
};
```

### `src/routes/+page.svelte`

```svelte
<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import { localize } from '$lib/types';
	let { data } = $props();
</script>

<svelte:head><title>Sprekayasa — Berita Viral AI</title></svelte:head>

<h1>Terkini</h1>

<div class="grid">
	{#each data.articles as article (article.id)}
		<ArticleCard {article} locale={data.locale} />
	{/each}
</div>

<style>
	h1 {
		padding: 0 2rem;
		margin: 1.5rem 0 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
		padding: 0 2rem 2rem;
	}
</style>
```

### 11c. Article page — `src/routes/article/[slug]/+page.server.ts`

```typescript
import { getArticleBySlug } from '$lib/server/queries';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { locale } = await parent();
	const article = await getArticleBySlug(params.slug);

	if (!article) throw error(404, 'Article not found');

	return { article, locale };
};

// Set SEO-friendly headers
export const prerender = true; // optional: pre-render published articles
```

### `src/routes/article/[slug]/+page.svelte`

```svelte
<script lang="ts">
	import { localize, type Article, type Locale } from '$lib/types';
	import FactCheckBadge from '$lib/components/FactCheckBadge.svelte';

	let { data } = $props();
	const a: Article = data.article;
	const locale: Locale = data.locale;
	const view = localize(a, locale);
</script>

<svelte:head>
	<title>{view.title} — Sprekayasa</title>
	<meta name="description" content={view.takeaway ?? view.title} />
	<meta property="og:title" content={view.title} />
	<meta property="og:image" content={a.image_url ?? ''} />
	<meta property="og:locale" content={locale === 'ms' ? 'ms_MY' : 'en_US'} />
</svelte:head>

<article>
	{#if a.image_url}
		<img src={a.image_url} alt={a.image_alt ?? ''} class="hero" />
		{#if a.image_caption}<p class="caption">{a.image_caption}</p>{/if}
	{/if}

	<div class="badges">
		<span class="badge">{a.category}</span>
		<span class="badge">{a.region}</span>
		<FactCheckBadge verdict={a.factcheck_verdict} confidence={a.factcheck_confidence} />
	</div>

	<h1>{view.title}</h1>

	<div class="body-content">
		{@html view.body}
	</div>

	{#if view.reality_check}
		<section class="reality-check">
			<h2>{locale === 'ms' ? 'Adakah Ini Benar?' : 'Is This Real?'}</h2>
			<p>{@html view.reality_check}</p>
		</section>
	{/if}

	{#if view.takeaway}
		<section class="takeaway">
			<h2>{locale === 'ms' ? 'Apa Maksudnya Untuk Anda' : 'What It Means For You'}</h2>
			<p>{@html view.takeaway}</p>
		</section>
	{/if}

	{#if view.prompt_question}
		<section class="prompt">
			<p>{view.prompt_question}</p>
		</section>
	{/if}

	<footer class="source-info">
		<p>{locale === 'ms' ? 'Sumber' : 'Source'}: {a.source_name} · {a.source_date}</p>
		{#if a.source_url}<a href={a.source_url} target="_blank" rel="noopener">{a.source_url}</a>{/if}
	</footer>
</article>

<style>
	article {
		max-width: 720px;
		margin: 0 auto;
		padding: 1rem 2rem 3rem;
	}
	.hero {
		width: 100%;
		max-height: 400px;
		object-fit: cover;
		border-radius: 12px;
	}
	.caption {
		font-size: 0.8rem;
		color: #999;
		margin-top: 0.25rem;
	}
	.badges {
		display: flex;
		gap: 0.5rem;
		margin: 1rem 0;
	}
	.badge {
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		font-size: 0.75rem;
		background: #f3f4f6;
	}
	h1 {
		font-size: 1.8rem;
		line-height: 1.2;
	}
	.body-content {
		line-height: 1.7;
		font-size: 1.05rem;
	}
	.reality-check {
		background: #ecfdf5;
		border-left: 4px solid #10b981;
		padding: 1rem 1.5rem;
		border-radius: 0 8px 8px 0;
		margin: 2rem 0;
	}
	.takeaway {
		background: #eff6ff;
		border-left: 4px solid #3b82f6;
		padding: 1rem 1.5rem;
		border-radius: 0 8px 8px 0;
		margin: 2rem 0;
	}
	.prompt {
		background: #fefce8;
		border-radius: 8px;
		padding: 1.5rem;
		text-align: center;
		font-size: 1.1rem;
		font-weight: 500;
	}
	.source-info {
		margin-top: 3rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
		font-size: 0.85rem;
		color: #999;
	}
</style>
```

### 11d. Article card component — `src/lib/components/ArticleCard.svelte`

```svelte
<script lang="ts">
	import { localize, type Article, type Locale } from '$lib/types';
	import FactCheckBadge from './FactCheckBadge.svelte';

	let { article, locale }: { article: Article; locale: Locale } = $props();
	const view = localize(article, locale);
</script>

<a href="/article/{article.slug}" class="card">
	{#if article.image_url}
		<img src={article.image_url} alt={article.image_alt ?? ''} />
	{/if}
	<div class="content">
		<div class="meta">
			<span class="category">{article.category}</span>
			<FactCheckBadge
				verdict={article.factcheck_verdict}
				confidence={article.factcheck_confidence}
				compact
			/>
		</div>
		<h2>{view.title}</h2>
		{#if view.takeaway}
			<p class="takeaway">{view.takeaway}</p>
		{/if}
	</div>
</a>

<style>
	.card {
		display: block;
		text-decoration: none;
		color: inherit;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
	}
	.card:hover {
		border-color: #2563eb;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}
	img {
		width: 100%;
		height: 200px;
		object-fit: cover;
	}
	.content {
		padding: 1rem;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.category {
		font-size: 0.7rem;
		text-transform: uppercase;
		font-weight: 700;
		color: #2563eb;
	}
	h2 {
		font-size: 1.1rem;
		line-height: 1.3;
		margin: 0.25rem 0;
	}
	.takeaway {
		font-size: 0.9rem;
		color: #666;
		margin: 0.5rem 0 0;
	}
</style>
```

### 11e. Fact-check badge — `src/lib/components/FactCheckBadge.svelte`

```svelte
<script lang="ts">
	import type { FactCheckVerdict } from '$lib/types';
	let {
		verdict,
		confidence,
		compact = false
	}: { verdict: FactCheckVerdict; confidence: number; compact?: boolean } = $props();

	const styles: Record<FactCheckVerdict, string> = {
		verified: 'bg-green',
		'mostly-true': 'bg-blue',
		disputed: 'bg-amber',
		unverifiable: 'bg-gray',
		false: 'bg-red',
		pending: 'bg-gray'
	};
	const labels: Record<FactCheckVerdict, string> = {
		verified: '✓ Verified',
		'mostly-true': '✓ Mostly True',
		disputed: '⚠ Disputed',
		unverifiable: '? Unverifiable',
		false: '✗ False',
		pending: '… Pending'
	};
</script>

<span class="badge {styles[verdict]}">
	{compact ? labels[verdict] : `${labels[verdict]} (${confidence}%)`}
</span>

<style>
	.badge {
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.bg-green {
		background: #d1fae5;
		color: #065f46;
	}
	.bg-blue {
		background: #dbeafe;
		color: #1e40af;
	}
	.bg-amber {
		background: #fef3c7;
		color: #92400e;
	}
	.bg-red {
		background: #fee2e2;
		color: #991b1b;
	}
	.bg-gray {
		background: #f3f4f6;
		color: #6b7280;
	}
</style>
```

---

## 12. Mistral Workflow — Write to Neon (No Strapi)

### `publish_to_neon.ts` — Final activity before HITL pause

```typescript
// publish_to_neon.ts
// Runs after Polyglot finishes. Writes the draft to Neon Postgres
// with status = 'pending', then the workflow pauses for human approval.

interface WorkflowInput {
	article: {
		slug: string;
		category: string;
		region: string;
		hype_level: string;
		agent_run_id: string;
		source_url: string;
		source_name: string;
		source_date: string;
		factcheck_verdict: string;
		factcheck_confidence: number;
		factcheck_summary: string;
		tags: string[];
		ms: {
			title: string;
			body: string;
			reality_check: string;
			takeaway: string;
			prompt_question: string;
		};
		en: {
			title: string;
			body: string;
			reality_check: string;
			takeaway: string;
			prompt_question: string;
		};
		image_url?: string;
		image_alt?: string;
		image_caption?: string;
	};
}

async function main(input: WorkflowInput) {
	const NEON_URL = process.env.NEON_DATABASE_URL;
	const a = input.article;

	// Insert draft into Neon Postgres
	// Using parameterized query via Neon serverless driver
	const query = `
    INSERT INTO articles (
      slug, status, category, region, hype_level,
      ai_generated, agent_run_id, tags,
      source_url, source_name, source_date,
      factcheck_verdict, factcheck_confidence, factcheck_summary,
      title_ms, body_ms, reality_check_ms, takeaway_ms, prompt_question_ms,
      title_en, body_en, reality_check_en, takeaway_en, prompt_question_en,
      image_url, image_alt, image_caption
    ) VALUES (
      $1, 'pending', $2, $3, $4,
      true, $5, $6,
      $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15, $16, $17,
      $18, $19, $20, $21, $22,
      $23, $24, $25
    )
    RETURNING id, slug
  `;

	const values = [
		a.slug,
		a.category,
		a.region,
		a.hype_level,
		a.agent_run_id,
		a.tags,
		a.source_url,
		a.source_name,
		a.source_date,
		a.factcheck_verdict,
		a.factcheck_confidence,
		a.factcheck_summary,
		a.ms.title,
		a.ms.body,
		a.ms.reality_check,
		a.ms.takeaway,
		a.ms.prompt_question,
		a.en.title,
		a.en.body,
		a.en.reality_check,
		a.en.takeaway,
		a.en.prompt_question,
		a.image_url,
		a.image_alt,
		a.image_caption
	];

	// In Mistral Workflows, you'd use the HTTP tool to call Neon's SQL API
	// or use a serverless function. Here's the pattern:

	const res = await fetch(`${NEON_URL.replace('postgres://', 'https://')}/sql`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, params: values })
	});

	const result = await res.json();

	return {
		status: 'draft_created',
		article_id: result[0]?.id,
		slug: result[0]?.slug,
		agent_run_id: a.agent_run_id,
		admin_url: `${process.env.PUBLIC_SITE_URL}/admin/${result[0]?.id}`
	};
}
```

> **Mistral Workflow tip:** In the workflow editor, the `publish_to_neon` activity would use a custom code block or HTTP request to Neon's [SQL API over HTTP](https://neon.tech/docs/guides/neon-sql-api). Alternatively, deploy a tiny serverless function (e.g., Vercel Edge, Cloudflare Worker) that accepts the article payload and writes to Neon, and call it from the workflow via HTTP.

### Approval signal flow

```
1. publish_to_neon     → writes draft (status='pending') → returns article_id
2. WAIT FOR SIGNAL      → workflow pauses, waits for 'human_approval' signal
3. Human visits /admin  → sees pending article → clicks Approve
4. /admin/[id] action   → UPDATE articles SET status='published', published_at=now()
                        → POST to Mistral /workflows/{id}/signals with {status:'approved'}
5. Workflow resumes     → (optional) post-publish tasks: regenerate sitemap, ping search engines
```

---

## 13. Alternative: Neon SQL over HTTP (No Driver Needed)

If you don't want to install a Postgres driver in Mistral Workflows, Neon has a [SQL API over HTTP](https://neon.tech/docs/guides/neon-sql-api):

```typescript
// Call Neon's HTTP SQL API directly — no driver, no connection pool
async function neonSQL(query: string, params: any[]) {
	const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID;
	const NEON_DATABASE = 'sprekayasa_news';
	const NEON_BRANCH = 'main';

	const res = await fetch(
		`https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${NEON_BRANCH}/databases/${NEON_DATABASE}/sql`,
		{
			method: 'POST',
			headers: {
				'Neon-Api-Key': process.env.NEON_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ query, params })
		}
	);

	return res.json();
}
```

---

## 14. Body Content Format (HTML vs Markdown)

The agents produce Markdown bodies (headings, bold, lists). SvelteKit renders these options:

### Option A: Render as HTML (simplest — recommended)

Polyglot outputs HTML directly. SvelteKit renders with `{@html view.body}`. No parsing needed.

Agent prompt instruction to Polyglot:

```
Output body as clean HTML. Use <h2>, <p>, <strong>, <ul>, <li> tags only.
No <script>, <style>, or inline styles.
```

### Option B: Markdown → HTML at runtime

Install a markdown parser:

```bash
npm install marked
```

In `+page.svelte`:

```svelte
<script lang="ts">
	import { marked } from 'marked';
	let { data } = $props();
	const bodyHtml = marked.parse(data.article.body_ms);
</script>

<div>{@html bodyHtml}</div>
```

### Option C: Markdown → HTML at build time (prerender)

In `+page.server.ts`:

```typescript
import { marked } from 'marked';

export const load = async ({ params }) => {
	const article = await getArticleBySlug(params.slug);
	return {
		article: {
			...article,
			body_ms_html: marked.parse(article.body_ms),
			body_en_html: article.body_en ? marked.parse(article.body_en) : null
		}
	};
};
```

---

## 15. SvelteKit Configuration

### `svelte.config.js`

```javascript
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$lib: './src/lib'
		}
	}
};
```

For VPS deployment, use the Node adapter:

```bash
npm install -D @sveltejs/adapter-node
```

```javascript
import adapter from '@sveltejs/adapter-node';

export default {
	kit: {
		adapter: adapter({
			out: 'build',
			precompress: true,
			envPrefix: 'PUBLIC_'
		})
	}
};
```

### `package.json` dependencies

```json
{
	"devDependencies": {
		"@sveltejs/adapter-node": "^5.0.0",
		"@sveltejs/kit": "^2.0.0",
		"@sveltejs/vite-plugin-svelte": "^4.0.0",
		"svelte": "^5.0.0",
		"typescript": "^5.0.0",
		"vite": "^5.0.0"
	},
	"dependencies": {
		"@neondatabase/serverless": "^0.9.0",
		"bcryptjs": "^2.4.3"
	}
}
```

---

## 16. Full Setup — Step by Step

### Step 1: Create SvelteKit project

```bash
npm create svelte@latest news-site
cd news-site
npm install
npm install @neondatabase/serverless bcryptjs
npm install -D @sveltejs/adapter-node
```

### Step 2: Configure Neon

1. Create a Neon project at [neon.tech](https://neon.tech)
2. Create database `sprekayasa_news`
3. Copy connection string
4. Run the schema SQL (Section 2b) in Neon's SQL editor

### Step 3: Add environment variables

Create `.env` with the values from Section 4.

### Step 4: Generate admin password hash

```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('your-password', 10))"
# Copy the hash into .env as ADMIN_PASSWORD_HASH
```

### Step 5: Create the file structure

Create all files from Sections 5–11:

- `src/lib/server/db.ts`
- `src/lib/server/auth.ts`
- `src/lib/server/queries.ts`
- `src/lib/types.ts`
- `src/lib/components/*.svelte`
- `src/routes/+layout.server.ts`
- `src/routes/+layout.svelte`
- `src/routes/+page.server.ts`
- `src/routes/+page.svelte`
- `src/routes/article/[slug]/+page.server.ts`
- `src/routes/article/[slug]/+page.svelte`
- `src/routes/admin/+layout.server.ts`
- `src/routes/admin/+layout.svelte`
- `src/routes/admin/+page.server.ts`
- `src/routes/admin/+page.svelte`
- `src/routes/admin/[id]/+page.server.ts`
- `src/routes/admin/[id]/+page.svelte`
- `src/routes/admin/login/+page.server.ts`
- `src/routes/admin/login/+page.svelte`

### Step 6: Configure SvelteKit adapter

Update `svelte.config.js` (Section 15).

### Step 7: Run dev server

```bash
npm run dev
```

### Step 8: Test the admin flow

1. Visit `http://localhost:5173/admin/login`
2. Enter your admin password
3. You should see the pending articles list (empty initially)
4. Insert a test draft via SQL or Mistral workflow
5. It appears in the pending list
6. Click it → review → approve
7. It appears on the public homepage

### Step 9: Deploy

#### VPS (Node adapter)

```bash
npm run build
node build/index.js  # or use pm2/systemd
```

#### Vercel/Netlify (auto adapter)

```bash
# Just push to git, connect to Vercel, set env vars
```

### Step 10: Set Mistral workflow env vars

In your Mistral workflow environment:

```
NEON_DATABASE_URL=postgres://...@neon.tech/sprekayasa_news?sslmode=require
PUBLIC_SITE_URL=https://sprekayasa.com
```

In your SvelteKit `.env`:

```
MISTRAL_API_KEY=your-key
MISTRAL_WORKFLOW_ID=your-workflow-id
```

---

## 17. Database Migration Management

As you add features, you'll need schema changes. Use a simple approach:

### Create a migrations folder

```
migrations/
├── 001_create_articles.sql        # The schema from Section 2b
├── 002_add_author_field.sql       # Future additions
└── 003_add_view_count.sql
```

### Apply migrations manually (or with a simple script)

```bash
#!/bin/bash
# migrate.sh — apply pending migrations to Neon
DATABASE_URL=$NEON_DATABASE_URL
for file in migrations/*.sql; do
  echo "Applying $file..."
  psql "$DATABASE_URL" -f "$file"
done
```

For a more robust setup, use [drizzle-kit](https://orm.drizzle.team) or [node-pg-migrate](https://github.com/salsita/node-pg-migrate).

---

## 18. Cost Breakdown (Updated — No Strapi)

| Component                             | Cost                                                  |
| ------------------------------------- | ----------------------------------------------------- |
| Neon Postgres (free tier)             | $0 (0.5 GB storage, enough for thousands of articles) |
| SvelteKit hosting (Vercel free / VPS) | $0 — €4/mo                                            |
| Domain (sprekayasa.com)               | ~$1/mo                                                |
| Mistral Workflows (5 agents)          | ~$10–30/mo (API usage)                                |
| Image generation (Lens)               | ~$2–5/mo                                              |
| **Total Phase 1**                     | **~$13–35/mo**                                        |

> Without Strapi, you save the €4/mo VPS it would have needed (if hosting SvelteKit on Vercel free tier) or the operational complexity of running a second always-on service. The database is now the only persistent infra, and Neon's free tier covers your needs for a long time.

---

## 19. Security Checklist

| Item                                                    | Status |
| ------------------------------------------------------- | ------ |
| Admin route protected by auth guard                     | ☐      |
| Password hashed with bcrypt                             | ☐      |
| Session cookie httpOnly + sameSite                      | ☐      |
| HTTPS enforced in production                            | ☐      |
| Neon connection uses SSL (`?sslmode=require`)           | ☐      |
| `body_ms`/`body_en` sanitized before rendering (no XSS) | ☐      |
| Admin password not in git (env var only)                | ☐      |
| Rate limiting on admin login (optional)                 | ☐      |
| CSP headers configured in `svelte.config.js`            | ☐      |

### XSS note

The article bodies are rendered with `{@html view.body}`. Since the content comes from your own AI pipeline (not user input), XSS risk is low. However, if you want extra safety:

```typescript
// src/lib/server/sanitize.ts
// Simple tag allowlist sanitizer — run before saving to DB
const ALLOWED_TAGS = ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'blockquote'];

export function sanitizeHtml(html: string): string {
	// Use DOMPurify (browser) or sanitize-html (server)
	// npm install sanitize-html
	import sanitizeHtml from 'sanitize-html';
	return sanitizeHtml(html, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: { a: ['href', 'target', 'rel'] }
	});
}
```

---

## 20. Complete Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  1. MISTRAL WORKFLOW RUNS                                        │
│     Scout → Scribe → Sentinel → Lens → Polyglot                 │
│                        │                                         │
│  2. publish_to_neon    │                                         │
│     INSERT INTO articles (status='pending') ──────────────────┐ │
│                        │                                        │ │
│  3. WORKFLOW PAUSES     ▼                                        │ │
│     WAIT FOR SIGNAL 'human_approval'                            │ │
│                                                                 │ │
│  4. HUMAN OPENS /admin                                          │ │
│     SELECT * WHERE status='pending' ◄────────────────────────────┘ │
│     Human reviews both ms + en versions                          │
│                                                                 │ │
│  5. HUMAN APPROVES                                               │ │
│     UPDATE articles SET status='published' ──────────────┐      │ │
│     POST /workflows/{id}/signals {status:'approved'}      │      │ │
│                        │                                  │      │ │
│  6. WORKFLOW RESUMES   ▼                                  │      │ │
│     (optional: ping search engines, regenerate sitemap)   │      │ │
│                                                           │      │ │
│  7. PUBLIC SITE                                          │      │ │
│     SELECT * WHERE status='published' ◄────────────────────┘      │
│     SvelteKit SSR renders with locale (ms/en)                    │
│     User reads article at /article/[slug]                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

With the no-CMS architecture fully scaffolded:

1. **SvelteKit public site polish** — homepage design, category pages, search, pagination, SEO meta tags, sitemap.xml, RSS feed.
2. **End-to-end integration testing** — trigger a Mistral workflow run → verify draft appears in admin → approve → verify it appears on public site.
3. **Production deployment** — VPS with systemd or Vercel + Neon + Mistral.
