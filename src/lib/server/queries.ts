import type { Article, ArticleDraftInput } from '$lib/types';

import { getDatabaseClient, type DatabaseClient } from './db';
import { sanitizeArticleDraftInput } from './sanitize';

type QueryOptions = {
	database?: DatabaseClient;
};

type PaginationOptions = QueryOptions & {
	limit?: number;
	offset?: number;
};

export type ArticleReviewMutationResult = Pick<Article, 'id' | 'slug' | 'status' | 'agent_run_id'>;

function normalizePageSize(value: number | undefined, fallback: number): number {
	if (!value || Number.isNaN(value)) {
		return fallback;
	}

	return Math.min(Math.max(Math.trunc(value), 1), 100);
}

function normalizeOffset(value: number | undefined): number {
	if (!value || Number.isNaN(value)) {
		return 0;
	}

	return Math.max(Math.trunc(value), 0);
}

export async function getPublishedArticles({
	database = getDatabaseClient(),
	limit = 12,
	offset = 0
}: PaginationOptions = {}): Promise<Article[]> {
	const rows = await database.query(
		`
			SELECT *
			FROM articles
			WHERE status = 'published'
			ORDER BY published_at DESC NULLS LAST, created_at DESC
			LIMIT $1 OFFSET $2
		`,
		[normalizePageSize(limit, 12), normalizeOffset(offset)]
	);

	return rows as Article[];
}

export async function getArticleBySlug(
	slug: string,
	{ database = getDatabaseClient() }: QueryOptions = {}
): Promise<Article | null> {
	const rows = await database.query(
		`
			SELECT *
			FROM articles
			WHERE slug = $1 AND status = 'published'
			LIMIT 1
		`,
		[slug]
	);

	return (rows[0] as Article | undefined) ?? null;
}

export async function getPendingArticles({
	database = getDatabaseClient(),
	limit = 50,
	offset = 0
}: PaginationOptions = {}): Promise<Article[]> {
	const rows = await database.query(
		`
			SELECT *
			FROM articles
			WHERE status = 'pending'
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2
		`,
		[normalizePageSize(limit, 50), normalizeOffset(offset)]
	);

	return rows as Article[];
}

export async function getArticleById(
	id: string,
	{ database = getDatabaseClient() }: QueryOptions = {}
): Promise<Article | null> {
	const rows = await database.query(
		`
			SELECT *
			FROM articles
			WHERE id = $1
			LIMIT 1
		`,
		[id]
	);

	return (rows[0] as Article | undefined) ?? null;
}

export async function approveArticle(
	id: string,
	{ database = getDatabaseClient() }: QueryOptions = {}
): Promise<ArticleReviewMutationResult | null> {
	const rows = await database.query(
		`
			UPDATE articles
			SET status = 'published',
				published_at = NOW(),
				updated_at = NOW()
			WHERE id = $1 AND status = 'pending'
			RETURNING id, slug, status, agent_run_id
		`,
		[id]
	);

	return (rows[0] as ArticleReviewMutationResult | undefined) ?? null;
}

export async function rejectArticle(
	id: string,
	{ database = getDatabaseClient() }: QueryOptions = {}
): Promise<ArticleReviewMutationResult | null> {
	const rows = await database.query(
		`
			UPDATE articles
			SET status = 'rejected',
				updated_at = NOW()
			WHERE id = $1 AND status = 'pending'
			RETURNING id, slug, status, agent_run_id
		`,
		[id]
	);

	return (rows[0] as ArticleReviewMutationResult | undefined) ?? null;
}

export async function createDraftArticle(
	input: ArticleDraftInput,
	{ database = getDatabaseClient() }: QueryOptions = {}
): Promise<Article> {
	const sanitized = sanitizeArticleDraftInput(input);
	const rows = await database.query(
		`
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
				$22, $23, $24, $25, $26
			)
			RETURNING *
		`,
		[
			sanitized.slug,
			sanitized.category,
			sanitized.region,
			sanitized.hype_level,
			sanitized.ai_generated ?? true,
			sanitized.agent_run_id ?? null,
			sanitized.tags ?? null,
			sanitized.source_url ?? null,
			sanitized.source_name ?? null,
			sanitized.source_date ?? null,
			sanitized.factcheck_verdict ?? 'pending',
			sanitized.factcheck_confidence ?? 0,
			sanitized.factcheck_summary ?? null,
			sanitized.title_ms,
			sanitized.body_ms,
			sanitized.reality_check_ms ?? null,
			sanitized.takeaway_ms ?? null,
			sanitized.prompt_question_ms ?? null,
			sanitized.title_en ?? null,
			sanitized.body_en ?? null,
			sanitized.reality_check_en ?? null,
			sanitized.takeaway_en ?? null,
			sanitized.prompt_question_en ?? null,
			sanitized.image_url ?? null,
			sanitized.image_alt ?? null,
			sanitized.image_caption ?? null
		]
	);

	const article = rows[0] as Article | undefined;

	if (!article) {
		throw new Error('Failed to create draft article');
	}

	return article;
}
