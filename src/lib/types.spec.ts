import { describe, expect, it } from 'vitest';

import { localizeArticle, type Article } from './types';

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
	factcheck_summary: 'Checked against the source.',
	title_ms: 'Halo Dunia',
	body_ms: '<p>Isi BM</p>',
	reality_check_ms: 'Disahkan benar.',
	takeaway_ms: 'Ini penting.',
	prompt_question_ms: 'Apa pendapat anda?',
	title_en: 'Hello World',
	body_en: '<p>English body</p>',
	reality_check_en: 'Verified as true.',
	takeaway_en: 'This matters.',
	prompt_question_en: 'What do you think?',
	image_url: 'https://example.com/image.jpg',
	image_alt: 'Headline image',
	image_caption: 'An example image',
	created_at: '2026-09-03T00:00:00.000Z',
	updated_at: '2026-09-03T00:00:00.000Z',
	published_at: '2026-09-03T00:00:00.000Z'
};

describe('localizeArticle', () => {
	it('returns English fields when an English translation exists', () => {
		expect(localizeArticle(article, 'en')).toMatchObject({
			title: 'Hello World',
			body: '<p>English body</p>',
			locale_used: 'en'
		});
	});

	it('falls back to Malay when English content is unavailable', () => {
		const withoutEnglish = {
			...article,
			title_en: null,
			body_en: null
		};

		expect(localizeArticle(withoutEnglish, 'en')).toMatchObject({
			title: 'Halo Dunia',
			body: '<p>Isi BM</p>',
			locale_used: 'ms'
		});
	});
});
