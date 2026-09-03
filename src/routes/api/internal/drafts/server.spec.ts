import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { InternalDraftIngestResponse } from '$lib/types';

vi.mock('$env/dynamic/private', () => ({
	env: {
		INTERNAL_INGEST_TOKEN: 'secret-token'
	}
}));

vi.mock('$lib/server/db', () => ({
	hasDatabaseConfig: vi.fn()
}));

vi.mock('$lib/server/ingest', () => ({
	isAuthorizedIngestRequest: vi.fn(),
	parseDraftIngestPayload: vi.fn()
}));

vi.mock('$lib/server/queries', () => ({
	createDraftArticle: vi.fn()
}));

import { hasDatabaseConfig } from '$lib/server/db';
import { isAuthorizedIngestRequest, parseDraftIngestPayload } from '$lib/server/ingest';
import { createDraftArticle } from '$lib/server/queries';
import { POST } from './+server';

describe('POST /api/internal/drafts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns the normalized workflow execution ID in the success response', async () => {
		vi.mocked(isAuthorizedIngestRequest).mockReturnValue(true);
		vi.mocked(hasDatabaseConfig).mockReturnValue(true);
		vi.mocked(parseDraftIngestPayload).mockReturnValue({
			slug: 'hello-world',
			category: 'tech',
			region: 'global',
			hype_level: 'medium',
			agent_run_id: 'wf-execution-123',
			title_ms: 'Halo Dunia',
			body_ms: '<p>Isi BM</p>'
		});
		vi.mocked(createDraftArticle).mockResolvedValue({
			id: 'article-123',
			slug: 'hello-world',
			status: 'pending',
			category: 'tech',
			region: 'global',
			hype_level: 'medium',
			ai_generated: true,
			agent_run_id: 'wf-execution-123',
			tags: null,
			source_url: null,
			source_name: null,
			source_date: null,
			factcheck_verdict: 'pending',
			factcheck_confidence: 0,
			factcheck_summary: null,
			title_ms: 'Halo Dunia',
			body_ms: '<p>Isi BM</p>',
			reality_check_ms: null,
			takeaway_ms: null,
			prompt_question_ms: null,
			title_en: null,
			body_en: null,
			reality_check_en: null,
			takeaway_en: null,
			prompt_question_en: null,
			image_url: null,
			image_alt: null,
			image_caption: null,
			created_at: '2026-09-03T00:00:00.000Z',
			updated_at: '2026-09-03T00:00:00.000Z',
			published_at: null
		});

		const request = new Request('http://localhost/api/internal/drafts', {
			method: 'POST',
			headers: {
				authorization: 'Bearer secret-token',
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				article: {
					slug: 'hello-world'
				}
			})
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/api/internal/drafts')
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(201);
		const body = (await response.json()) as InternalDraftIngestResponse;

		expect(body).toMatchObject({
			id: 'article-123',
			slug: 'hello-world',
			status: 'pending',
			workflow_execution_id: 'wf-execution-123',
			admin_url: 'http://localhost/admin/article-123'
		});
	});

	it('rejects unauthorized requests before touching the database', async () => {
		vi.mocked(isAuthorizedIngestRequest).mockReturnValue(false);

		const request = new Request('http://localhost/api/internal/drafts', {
			method: 'POST',
			headers: {
				authorization: 'Bearer wrong-token',
				'content-type': 'application/json'
			},
			body: JSON.stringify({})
		});

		const response = await POST({
			request,
			url: new URL('http://localhost/api/internal/drafts')
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'Unauthorized'
		});
		expect(hasDatabaseConfig).not.toHaveBeenCalled();
		expect(parseDraftIngestPayload).not.toHaveBeenCalled();
		expect(createDraftArticle).not.toHaveBeenCalled();
	});
});
