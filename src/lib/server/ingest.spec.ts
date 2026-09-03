import { describe, expect, it } from 'vitest';

import { isAuthorizedIngestRequest, parseDraftIngestPayload } from './ingest';

describe('isAuthorizedIngestRequest', () => {
	it('accepts a matching bearer token', () => {
		expect(isAuthorizedIngestRequest('Bearer secret-token', 'secret-token')).toBe(true);
	});

	it('rejects a missing or mismatched token', () => {
		expect(isAuthorizedIngestRequest(null, 'secret-token')).toBe(false);
		expect(isAuthorizedIngestRequest('Bearer wrong-token', 'secret-token')).toBe(false);
		expect(isAuthorizedIngestRequest('Basic abc123', 'secret-token')).toBe(false);
	});
});

describe('parseDraftIngestPayload', () => {
	it('maps the workflow payload shape into a draft insert input', () => {
		const parsed = parseDraftIngestPayload({
			article: {
				slug: 'hello-world',
				category: 'tech',
				region: 'global',
				hype_level: 'medium',
				agent_run_id: 'run-123',
				source_url: 'https://example.com/story',
				source_name: 'Example News',
				source_date: '2026-09-03',
				factcheck_verdict: 'verified',
				factcheck_confidence: 88,
				factcheck_summary: '<p>Checked</p>',
				tags: ['ai', 'daily'],
				ms: {
					title: 'Halo Dunia',
					body: '<p>Isi BM</p>',
					reality_check: '<p>Semakan</p>',
					takeaway: '<p>Pengajaran</p>',
					prompt_question: '<p>Soalan</p>'
				},
				en: {
					title: 'Hello World',
					body: '<p>English body</p>'
				},
				image_url: 'https://example.com/image.jpg',
				image_alt: 'A descriptive alt',
				image_caption: 'A caption'
			}
		});

		expect(parsed).toMatchObject({
			slug: 'hello-world',
			category: 'tech',
			region: 'global',
			hype_level: 'medium',
			title_ms: 'Halo Dunia',
			body_ms: '<p>Isi BM</p>',
			title_en: 'Hello World',
			body_en: '<p>English body</p>',
			tags: ['ai', 'daily']
		});
	});

	it('accepts workflow_execution_id as the preferred execution field', () => {
		const parsed = parseDraftIngestPayload({
			article: {
				slug: 'hello-world',
				category: 'tech',
				region: 'global',
				hype_level: 'medium',
				workflow_execution_id: 'wf-execution-123',
				ms: {
					title: 'Halo Dunia',
					body: '<p>Isi BM</p>'
				}
			}
		});

		expect(parsed.agent_run_id).toBe('wf-execution-123');
	});

	it('throws when required workflow fields are missing', () => {
		expect(() =>
			parseDraftIngestPayload({
				article: {
					category: 'tech',
					region: 'global',
					hype_level: 'medium',
					ms: {
						title: 'Halo Dunia'
					}
				}
			})
		).toThrow('article.slug is required');
	});
});
