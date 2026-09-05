import type { Article, ArticleDraftEditorInput, ArticleDraftInput } from '$lib/types';

import { getDatabaseClient, type DatabaseClient } from './db';
import { sanitizeArticleDraftEditorInput, sanitizeArticleDraftInput } from './sanitize';

type QueryOptions = {
	database?: DatabaseClient;
};

type PaginationOptions = QueryOptions & {
	limit?: number;
	offset?: number;
};

export type ArticleReviewMutationResult = Pick<Article, 'id' | 'slug' | 'status' | 'agent_run_id'>;
export interface PendingArticleNavigator {
        previousId: string | null;
        nextId: string | null;
        position: number;
        total: number;
}
export interface MorningBatchProgress {
        batchSlugBase: string;
        scheduledDate: string;
        total: number;
        pending: number;
        published: number;
        rejected: number;
}

const MORNING_BATCH_SLUG_PATTERN = /^(gempaknews-morning-run-\d{4}-\d{2}-\d{2})-(\d{2})$/;

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

function toJsonbParam(value: unknown): string {
        return JSON.stringify(value);
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

export async function getPendingArticleNavigator(
        id: string,
        { database = getDatabaseClient() }: QueryOptions = {}
): Promise<PendingArticleNavigator | null> {
        const rows = await database.query(
                `
                        SELECT id
                        FROM articles
                        WHERE status = 'pending'
                        ORDER BY created_at DESC
                `
        );

        const ids = (rows as Array<Pick<Article, 'id'>>).map((row) => row.id);
        const index = ids.indexOf(id);

        if (index === -1) {
                return null;
        }

        return {
                previousId: ids[index - 1] ?? null,
                nextId: ids[index + 1] ?? null,
                position: index + 1,
                total: ids.length
        };
}

function extractMorningBatchSlugBase(slug: string): string | null {
        const match = MORNING_BATCH_SLUG_PATTERN.exec(slug);
        return match?.[1] ?? null;
}

export async function getMorningBatchProgress(
        slug: string,
        { database = getDatabaseClient() }: QueryOptions = {}
): Promise<MorningBatchProgress | null> {
        const batchSlugBase = extractMorningBatchSlugBase(slug);

        if (!batchSlugBase) {
                return null;
        }

        const rows = await database.query(
                `
                        SELECT slug, status
                        FROM articles
                        WHERE slug LIKE $1
                `,
                [`${batchSlugBase}-%`]
        );

        const batchRows = (rows as Array<Pick<Article, 'slug' | 'status'>>).filter((row) =>
                row.slug.startsWith(`${batchSlugBase}-`)
        );

        return {
                batchSlugBase,
                scheduledDate: batchSlugBase.replace('gempaknews-morning-run-', ''),
                total: batchRows.length,
                pending: batchRows.filter((row) => row.status === 'pending').length,
                published: batchRows.filter((row) => row.status === 'published').length,
                rejected: batchRows.filter((row) => row.status === 'rejected').length
        };
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

export async function updatePendingArticleDraft(
        id: string,
        input: ArticleDraftEditorInput,
        { database = getDatabaseClient() }: QueryOptions = {}
): Promise<Article | null> {
        const sanitized = sanitizeArticleDraftEditorInput(input);
        const rows = await database.query(
                `
                        UPDATE articles
                        SET title_ms = $2,
                                body_ms = $3,
                                title_en = $4,
                                body_en = $5,
                                source_name = $6,
                                source_url = $7,
                                source_date = $8,
                                factcheck_verdict = $9,
                                factcheck_confidence = $10,
                                factcheck_summary = $11,
                                updated_at = NOW()
                        WHERE id = $1 AND status = 'pending'
                        RETURNING *
                `,
                [
                        id,
                        sanitized.title_ms,
                        sanitized.body_ms,
                        sanitized.title_en ?? null,
                        sanitized.body_en ?? null,
                        sanitized.source_name ?? null,
                        sanitized.source_url ?? null,
                        sanitized.source_date ?? null,
                        sanitized.factcheck_verdict ?? 'pending',
                        sanitized.factcheck_confidence ?? 0,
                        sanitized.factcheck_summary ?? null
                ]
        );

        return (rows[0] as Article | undefined) ?? null;
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
                                $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20, $21,
                                $22, $23::jsonb, $24::jsonb, $25::jsonb, $26::jsonb, $27::jsonb, $28, $29, $30, $31, $32,
                                $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43
			)
                        ON CONFLICT (slug) DO UPDATE
                        SET status = 'pending',
                                category = EXCLUDED.category,
                                region = EXCLUDED.region,
                                hype_level = EXCLUDED.hype_level,
                                ai_generated = EXCLUDED.ai_generated,
                                agent_run_id = EXCLUDED.agent_run_id,
                                tags = EXCLUDED.tags,
                                source_url = EXCLUDED.source_url,
                                source_name = EXCLUDED.source_name,
                                source_date = EXCLUDED.source_date,
                                factcheck_verdict = EXCLUDED.factcheck_verdict,
                                factcheck_confidence = EXCLUDED.factcheck_confidence,
                                factcheck_summary = EXCLUDED.factcheck_summary,
                                summary = EXCLUDED.summary,
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
                                title_ms = EXCLUDED.title_ms,
                                body_ms = EXCLUDED.body_ms,
                                reality_check_ms = EXCLUDED.reality_check_ms,
                                takeaway_ms = EXCLUDED.takeaway_ms,
                                prompt_question_ms = EXCLUDED.prompt_question_ms,
                                title_en = EXCLUDED.title_en,
                                body_en = EXCLUDED.body_en,
                                reality_check_en = EXCLUDED.reality_check_en,
                                takeaway_en = EXCLUDED.takeaway_en,
                                prompt_question_en = EXCLUDED.prompt_question_en,
                                image_url = EXCLUDED.image_url,
                                image_alt = EXCLUDED.image_alt,
                                image_caption = EXCLUDED.image_caption,
                                published_at = NULL,
                                updated_at = NOW()
                        WHERE articles.status IN ('pending', 'rejected')
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
                        sanitized.summary ?? null,
                        sanitized.why_viral ?? null,
                        toJsonbParam(sanitized.key_claims ?? []),
                        toJsonbParam(sanitized.claims_made ?? []),
                        toJsonbParam(sanitized.secondary_sources ?? []),
                        sanitized.sensitivity_notes ?? null,
                        sanitized.is_sensitive ?? false,
                        sanitized.form ?? null,
                        toJsonbParam(sanitized.scout_payload ?? {}),
                        toJsonbParam(sanitized.sentinel_payload ?? {}),
                        toJsonbParam(sanitized.lens_payload ?? {}),
                        toJsonbParam(sanitized.polyglot_payload ?? {}),
                        toJsonbParam(sanitized.glossary_notes ?? []),
                        sanitized.quality_notes ?? null,
                        sanitized.image_strategy ?? null,
                        sanitized.image_source_recommendation ?? null,
                        sanitized.image_notes_for_human ?? null,
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
                const existingRows = await database.query(
                        `
                                SELECT status
                                FROM articles
                                WHERE slug = $1
                                LIMIT 1
                        `,
                        [sanitized.slug]
                );
                const existingStatus = (existingRows[0] as Pick<Article, 'status'> | undefined)?.status;

                if (existingStatus) {
                        throw new Error(
                                `A ${existingStatus} article already exists for slug "${sanitized.slug}".`
                        );
                }

                throw new Error('Failed to create draft article');
	}

	return article;
}
