import { describe, expect, it } from 'vitest';

import type { Article, ArticleDraftEditorInput, ArticleDraftInput, ArticleImageEditorInput } from '$lib/types';

import {
        sanitizeArticleDraftEditorInput,
	sanitizeArticleDraftInput,
        sanitizeArticleImageEditorInput,
	sanitizeArticleForRender,
	sanitizePlainText,
	sanitizeRichText
} from './sanitize';

describe('sanitizeRichText', () => {
	it('keeps allowed tags and strips dangerous content', () => {
		const value =
			'<p>Hello <strong>world</strong></p><script>alert(1)</script><a href="javascript:alert(1)" onclick="evil()">bad</a>';

		expect(sanitizeRichText(value)).toBe(
			'<p>Hello <strong>world</strong></p><a rel="noopener noreferrer">bad</a>'
		);
	});

	it('normalizes safe links', () => {
		const value = '<a href="https://example.com" target="_blank">Read more</a>';

		expect(sanitizeRichText(value)).toBe(
			'<a href="https://example.com" target="_blank" rel="noopener noreferrer">Read more</a>'
		);
	});
});

describe('sanitizePlainText', () => {
	it('removes HTML tags and normalizes whitespace', () => {
		expect(sanitizePlainText('  Hello <strong>there</strong>   world ')).toBe('Hello there world');
	});
});

describe('sanitizeArticleDraftInput', () => {
	it('sanitizes write-time draft content before persistence', () => {
		const input: ArticleDraftInput = {
			slug: 'hello-world',
			category: 'tech',
			region: 'global',
			hype_level: 'medium',
                        summary: ' Summary <strong>line</strong> ',
                        why_viral: ' Why <em>viral</em> ',
                        key_claims: [' Claim <strong>1</strong> ', 'Claim 2<script>bad()</script>'],
                        claims_made: [' Claim <em>A</em> '],
                        secondary_sources: [' https://example.com/secondary '],
                        sensitivity_notes: ' Handle <script>bad()</script>carefully ',
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
                                visual_angle: ' Wide <strong>shot</strong> '
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
			title_ms: 'Halo <strong>Dunia</strong>',
			body_ms: '<p>Isi</p><script>bad()</script>',
			title_en: 'Hello<script>bad()</script> World',
			body_en: '<p>English</p>',
			image_alt: ' Alt <em>text</em> ',
			image_caption: ' Caption <script>bad()</script>',
			factcheck_summary: '<p>Checked</p><script>bad()</script>'
		};

		const sanitized = sanitizeArticleDraftInput(input);

		expect(sanitized.title_ms).toBe('Halo Dunia');
		expect(sanitized.body_ms).toBe('<p>Isi</p>');
		expect(sanitized.title_en).toBe('Hello World');
		expect(sanitized.image_alt).toBe('Alt text');
		expect(sanitized.image_caption).toBe('Caption');
		expect(sanitized.factcheck_summary).toBe('<p>Checked</p>');
                expect(sanitized.summary).toBe('Summary line');
                expect(sanitized.why_viral).toBe('Why viral');
                expect(sanitized.key_claims).toEqual(['Claim 1', 'Claim 2']);
                expect(sanitized.claims_made).toEqual(['Claim A']);
                expect(sanitized.secondary_sources).toEqual(['https://example.com/secondary']);
                expect(sanitized.sensitivity_notes).toBe('Handle carefully');
                expect(sanitized.form).toBe('short');
                expect(sanitized.scout_payload).toEqual({
                        angle: 'Crowd reaction',
                        nested: {
                                note: 'Keep context'
                        }
                });
                expect(sanitized.sentinel_payload).toEqual({
                        risk_label: 'medium'
                });
                expect(sanitized.lens_payload).toEqual({
                        visual_angle: 'Wide shot'
                });
                expect(sanitized.polyglot_payload).toEqual({
                        translation_status: 'ready'
                });
                expect(sanitized.glossary_notes).toEqual([
                        {
                                'Term A': 'Note one'
                        }
                ]);
                expect(sanitized.quality_notes).toBe('Needs desk review');
                expect(sanitized.image_strategy).toBe('Use arena stills');
                expect(sanitized.image_source_recommendation).toBe('Getty editorial');
                expect(sanitized.image_notes_for_human).toBe('Avoid faces');
	});
});

describe('sanitizeArticleDraftEditorInput', () => {
        it('sanitizes editorial draft updates before persistence', () => {
                const input: ArticleDraftEditorInput = {
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
                };

                const sanitized = sanitizeArticleDraftEditorInput(input);

                expect(sanitized.title_ms).toBe('Halo Dunia');
                expect(sanitized.body_ms).toBe('<p>Isi</p>');
                expect(sanitized.title_en).toBe('Hello World');
                expect(sanitized.body_en).toBe('<p>English</p>');
                expect(sanitized.source_name).toBe('Example Desk');
                expect(sanitized.source_url).toBe('https://example.com/story');
                expect(sanitized.source_date).toBe('2026-09-05');
                expect(sanitized.factcheck_verdict).toBe('disputed');
                expect(sanitized.factcheck_confidence).toBe(42);
                expect(sanitized.factcheck_summary).toBe('<p>Checked</p>');
        });
});

describe('sanitizeArticleImageEditorInput', () => {
        it('sanitizes generated image metadata before persistence', () => {
                const input: ArticleImageEditorInput = {
                        image_url: ' https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=test&image_size=landscape_16_9 ',
                        image_alt: ' Crowd <strong>celebration</strong> image ',
                        image_caption: ' Caption <script>bad()</script>line ',
                        lens_payload: {
                                image_prompt: ' Arena <strong>scene</strong> ',
                                nested: {
                                        note: ' Avoid <script>bad()</script>faces '
                                }
                        },
                        image_strategy: ' Use <strong>wide</strong> angle ',
                        image_source_recommendation: ' AI <em>generated</em> editorial art ',
                        image_notes_for_human: ' Keep <script>bad()</script>branding out '
                };

                const sanitized = sanitizeArticleImageEditorInput(input);

                expect(sanitized.image_url).toBe(
                        'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=test&image_size=landscape_16_9'
                );
                expect(sanitized.image_alt).toBe('Crowd celebration image');
                expect(sanitized.image_caption).toBe('Caption line');
                expect(sanitized.lens_payload).toEqual({
                        image_prompt: 'Arena scene',
                        nested: {
                                note: 'Avoid faces'
                        }
                });
                expect(sanitized.image_strategy).toBe('Use wide angle');
                expect(sanitized.image_source_recommendation).toBe('AI generated editorial art');
                expect(sanitized.image_notes_for_human).toBe('Keep branding out');
        });
});

describe('sanitizeArticleForRender', () => {
	it('sanitizes all rich text article fields', () => {
		const article: Article = {
			id: 'article-1',
			slug: 'hello-world',
			status: 'published',
			category: 'tech',
			region: 'global',
			hype_level: 'medium',
			ai_generated: true,
			agent_run_id: 'run-1',
			tags: ['ai'],
			source_url: 'https://example.com/story',
			source_name: 'Example News',
			source_date: '2026-09-03',
			factcheck_verdict: 'verified',
			factcheck_confidence: 90,
			factcheck_summary: '<p>Checked<script>alert(1)</script></p>',
                        summary: ' Summary <strong>line</strong> ',
                        why_viral: ' Why <em>viral</em> ',
                        key_claims: [' Claim <strong>1</strong> '],
                        claims_made: [' Claim <em>A</em> '],
                        secondary_sources: [' https://example.com/secondary '],
                        sensitivity_notes: ' Handle <script>bad()</script>carefully ',
                        is_sensitive: true,
                        form: ' short ',
                        scout_payload: {
                                angle: ' Crowd <strong>reaction</strong> '
                        },
                        sentinel_payload: {
                                risk_label: '<script>bad()</script>medium'
                        },
                        lens_payload: {
                                visual_angle: ' Wide <strong>shot</strong> '
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
			title_ms: 'Halo Dunia',
			body_ms: '<p>Isi <strong>BM</strong></p><script>bad()</script>',
			reality_check_ms: '<p>Semakan</p>',
			takeaway_ms: '<p>Pengajaran</p>',
			prompt_question_ms: '<p>Soalan</p>',
			title_en: 'Hello World',
			body_en: '<p>English</p>',
			reality_check_en: '<p>Check</p>',
			takeaway_en: '<p>Takeaway</p>',
			prompt_question_en: '<p>Prompt</p>',
			image_url: 'https://example.com/image.jpg',
			image_alt: 'Headline image',
			image_caption: 'An example image',
			created_at: '2026-09-03T00:00:00.000Z',
			updated_at: '2026-09-03T00:00:00.000Z',
			published_at: '2026-09-03T00:00:00.000Z'
		};

		const sanitized = sanitizeArticleForRender(article);

		expect(sanitized.body_ms).toBe('<p>Isi <strong>BM</strong></p>');
		expect(sanitized.factcheck_summary).toBe('<p>Checked</p>');
		expect(sanitized.prompt_question_en).toBe('<p>Prompt</p>');
                expect(sanitized.summary).toBe('Summary line');
                expect(sanitized.why_viral).toBe('Why viral');
                expect(sanitized.key_claims).toEqual(['Claim 1']);
                expect(sanitized.claims_made).toEqual(['Claim A']);
                expect(sanitized.secondary_sources).toEqual(['https://example.com/secondary']);
                expect(sanitized.sensitivity_notes).toBe('Handle carefully');
                expect(sanitized.form).toBe('short');
                expect(sanitized.scout_payload).toEqual({
                        angle: 'Crowd reaction'
                });
                expect(sanitized.sentinel_payload).toEqual({
                        risk_label: 'medium'
                });
                expect(sanitized.lens_payload).toEqual({
                        visual_angle: 'Wide shot'
                });
                expect(sanitized.polyglot_payload).toEqual({
                        translation_status: 'ready'
                });
                expect(sanitized.glossary_notes).toEqual([
                        {
                                'Term A': 'Note one'
                        }
                ]);
                expect(sanitized.quality_notes).toBe('Needs desk review');
                expect(sanitized.image_strategy).toBe('Use arena stills');
                expect(sanitized.image_source_recommendation).toBe('Getty editorial');
                expect(sanitized.image_notes_for_human).toBe('Avoid faces');
	});
});
