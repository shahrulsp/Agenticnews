import { describe, expect, it, vi } from 'vitest';

import type { DatabaseClient } from './db';
import {
	approveArticle,
	createDraftArticle,
	getArticleBySlug,
        getMorningBatchProgress,
        getPendingArticleNavigator,
	getPendingArticles,
	getPublishedArticles,
        rejectArticle,
        updatePendingArticleDraft
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

        it('updates a pending draft with sanitized editorial edits', async () => {
                const database = createMockDatabase();

                await updatePendingArticleDraft(
                        'article-789',
                        {
                                title_ms: 'Halo <strong>Dunia</strong>',
                                body_ms: '<p>Isi</p><script>bad()</script>',
                                title_en: 'Hello<script>bad()</script> World',
                                body_en: '<p>English</p><script>bad()</script>',
                                source_name: ' Example <strong>Desk</strong> ',
                                source_url: ' https://example.com/story ',
                                source_date: ' 2026-09-05 ',
                                factcheck_verdict: 'disputed',
                                factcheck_confidence: 42,
                                factcheck_summary: '<p>Checked</p><script>bad()</script>'
                        },
                        { database }
                );

                expect(database.query).toHaveBeenCalledWith(
                        expect.stringContaining('UPDATE articles'),
                        [
                                'article-789',
                                'Halo Dunia',
                                '<p>Isi</p>',
                                'Hello World',
                                '<p>English</p>',
                                'Example Desk',
                                'https://example.com/story',
                                '2026-09-05',
                                'disputed',
                                42,
                                '<p>Checked</p>'
                        ]
                );
        });

        it('returns previous and next ids for pending queue navigation', async () => {
                const database = createMockDatabase([{ id: 'first' }, { id: 'second' }, { id: 'third' }]);

                const result = await getPendingArticleNavigator('second', { database });

                expect(result).toEqual({
                        previousId: 'first',
                        nextId: 'third',
                        position: 2,
                        total: 3
                });
        });

        it('summarizes batch progress for the current morning run', async () => {
                const database = createMockDatabase([
                        { slug: 'gempaknews-morning-run-2026-09-04-01', status: 'pending' },
                        { slug: 'gempaknews-morning-run-2026-09-04-02', status: 'published' },
                        { slug: 'gempaknews-morning-run-2026-09-04-03', status: 'rejected' }
                ]);

                const result = await getMorningBatchProgress('gempaknews-morning-run-2026-09-04-01', {
                        database
                });

                expect(result).toEqual({
                        batchSlugBase: 'gempaknews-morning-run-2026-09-04',
                        scheduledDate: '2026-09-04',
                        total: 3,
                        pending: 1,
                        published: 1,
                        rejected: 1
                });
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
                        expect.stringContaining('ON CONFLICT (slug) DO UPDATE'),
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

        it('passes sanitized Studio metadata through createDraftArticle', async () => {
                const database = createMockDatabase([
                        {
                                id: 'article-900',
                                slug: 'studio-test-story',
                                status: 'pending'
                        }
                ]);

                await createDraftArticle(
                        {
                                slug: 'studio-test-story',
                                category: 'entertainment',
                                region: 'sri-lanka',
                                hype_level: 'high',
                                summary: ' Short <strong>summary</strong> ',
                                why_viral: ' Big <em>online</em> reaction ',
                                key_claims: [' Claim <strong>1</strong> ', 'Claim 2<script>bad()</script>'],
                                claims_made: [' Claim <em>A</em> '],
                                secondary_sources: [' https://example.com/extra '],
                                sensitivity_notes: ' Keep <script>bad()</script>legal wording careful ',
                                is_sensitive: false,
                                form: ' short ',
                                scout_payload: {
                                        angle: ' Crowd <strong>reaction</strong> ',
                                        nested: {
                                                note: ' <em>Keep</em> context '
                                        }
                                },
                                sentinel_payload: {
                                        risk_label: '<script>bad()</script>medium'
                                },
                                lens_payload: {
                                        shot_list: [' Wide <strong>frame</strong> ']
                                },
                                polyglot_payload: {
                                        translation_status: ' ready '
                                },
                                glossary_notes: [
                                        {
                                                ' Term <strong>A</strong> ': ' Note <script>bad()</script>one '
                                        }
                                ],
                                quality_notes: ' Needs <em>desk</em> review ',
                                image_strategy: ' Use <strong>arena</strong> stills ',
                                image_source_recommendation: ' Getty <em>editorial</em> ',
                                image_notes_for_human: ' Avoid <script>bad()</script>faces ',
                                title_ms: 'Tajuk BM',
                                body_ms: '<p>Isi</p>'
                        },
                        { database }
                );

                const [sql, params] = vi.mocked(database.query).mock.calls[0]!;

                expect(sql).toContain('summary');
                expect(sql).toContain('summary = EXCLUDED.summary');
                expect(sql).toContain('image_notes_for_human = EXCLUDED.image_notes_for_human');
                expect(sql).toContain(
                        '$22::jsonb, $23::jsonb, $24::jsonb, $25::jsonb, $26::jsonb, $27, $28, $29, $30, $31, $32'
                );
                expect(params).toEqual(
                        expect.arrayContaining([
                                'Short summary',
                                'Big online reaction',
                                JSON.stringify(['Claim 1', 'Claim 2']),
                                JSON.stringify(['Claim A']),
                                JSON.stringify(['https://example.com/extra']),
                                'Keep legal wording careful',
                                false,
                                'short',
                                JSON.stringify({
                                        angle: 'Crowd reaction',
                                        nested: {
                                                note: 'Keep context'
                                        }
                                }),
                                JSON.stringify({
                                        risk_label: 'medium'
                                }),
                                JSON.stringify({
                                        shot_list: ['Wide frame']
                                }),
                                JSON.stringify({
                                        translation_status: 'ready'
                                }),
                                JSON.stringify([
                                        {
                                                'Term A': 'Note one'
                                        }
                                ]),
                                'Needs desk review',
                                'Use arena stills',
                                'Getty editorial',
                                'Avoid faces'
                        ])
                );
        });

        it('refreshes an existing pending draft when the same slug is ingested again', async () => {
                const database = createMockDatabase([
                        {
                                id: 'article-789',
                                slug: 'draft-story',
                                status: 'pending'
                        }
                ]);

                await createDraftArticle(
                        {
                                slug: 'draft-story',
                                category: 'tech',
                                region: 'global',
                                hype_level: 'medium',
                                title_ms: 'Updated title',
                                body_ms: '<p>Updated body</p>'
                        },
                        { database }
                );

                const [sql, params] = vi.mocked(database.query).mock.calls[0]!;

                expect(sql).toContain("WHERE articles.status IN ('pending', 'rejected')");
                expect(sql).toContain('summary = EXCLUDED.summary');
                expect(sql).toContain('scout_payload = EXCLUDED.scout_payload');
                expect(sql).toContain('glossary_notes = EXCLUDED.glossary_notes');
                expect(params).toEqual(expect.any(Array));
        });

        it('keeps a published slug protected when a duplicate draft is ingested', async () => {
                const database = {
                        query: vi
                                .fn()
                                .mockResolvedValueOnce([])
                                .mockResolvedValueOnce([{ status: 'published' }])
                } as unknown as DatabaseClient;

                await expect(
                        createDraftArticle(
                                {
                                        slug: 'draft-story',
                                        category: 'tech',
                                        region: 'global',
                                        hype_level: 'medium',
                                        title_ms: 'Updated title',
                                        body_ms: '<p>Updated body</p>'
                                },
                                { database }
                        )
                ).rejects.toThrow('A published article already exists for slug "draft-story".');
        });
});
