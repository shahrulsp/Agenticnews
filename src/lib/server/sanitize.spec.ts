import { describe, expect, it } from 'vitest';

import type { Article, ArticleDraftInput } from '$lib/types';

import {
	sanitizeArticleDraftInput,
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
	});
});
