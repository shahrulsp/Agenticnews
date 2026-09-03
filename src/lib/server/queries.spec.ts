import { describe, expect, it, vi } from 'vitest';

import type { DatabaseClient } from './db';
import {
	approveArticle,
	createDraftArticle,
	getArticleBySlug,
	getPendingArticles,
	getPublishedArticles,
	rejectArticle
} from './queries';

function createMockDatabase(rows: unknown[] = []) {
	return {
		query: vi.fn().mockResolvedValue(rows)
	} as unknown as DatabaseClient;
}

describe('query helpers', () => {
	it('clamps published article pagination arguments to sensible values', async () => {
		const database = createMockDatabase();

		await getPublishedArticles({
			database,
			limit: 1000,
			offset: -3
		});

		expect(database.query).toHaveBeenCalledWith(expect.stringContaining('FROM articles'), [100, 0]);
	});

	it('returns null when an article slug is not found', async () => {
		const database = createMockDatabase();

		await expect(getArticleBySlug('missing-slug', { database })).resolves.toBeNull();
	});

	it('uses the pending list defaults for admin review queries', async () => {
		const database = createMockDatabase();

		await getPendingArticles({ database });

		expect(database.query).toHaveBeenCalledWith(
			expect.stringContaining("WHERE status = 'pending'"),
			[50, 0]
		);
	});

	it('updates a pending article to published on approval', async () => {
		const database = createMockDatabase();

		await approveArticle('article-123', { database });

		expect(database.query).toHaveBeenCalledWith(
			expect.stringContaining("SET status = 'published'"),
			['article-123']
		);
	});

	it('updates a pending article to rejected on rejection', async () => {
		const database = createMockDatabase();

		await rejectArticle('article-456', { database });

		expect(database.query).toHaveBeenCalledWith(
			expect.stringContaining("SET status = 'rejected'"),
			['article-456']
		);
	});

	it('sanitizes draft content before insert', async () => {
		const database = createMockDatabase([
			{
				id: 'article-789',
				slug: 'draft-story'
			}
		]);

		await createDraftArticle(
			{
				slug: 'draft-story',
				category: 'tech',
				region: 'global',
				hype_level: 'medium',
				title_ms: 'Halo <strong>Dunia</strong>',
				body_ms: '<p>Isi</p><script>bad()</script>',
				title_en: 'Hello<script>bad()</script> World',
				body_en: '<p>English</p>',
				image_alt: ' Alt <em>text</em> ',
				image_caption: ' Caption <script>bad()</script>'
			},
			{ database }
		);

		expect(database.query).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO articles'),
			expect.arrayContaining([
				'Halo Dunia',
				'<p>Isi</p>',
				'Hello World',
				'<p>English</p>',
				'Alt text',
				'Caption'
			])
		);
	});
});
