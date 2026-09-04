import { env } from '$env/dynamic/private';
import type { InternalDraftIngestResponse } from '$lib/types';
import { hasDatabaseConfig } from '$lib/server/db';
import { isAuthorizedIngestRequest, parseDraftIngestPayload } from '$lib/server/ingest';
import { createDraftArticle } from '$lib/server/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	if (!env.INTERNAL_INGEST_TOKEN) {
		return json(
			{
				error: 'INTERNAL_INGEST_TOKEN is not configured'
			},
			{ status: 503 }
		);
	}

	if (!isAuthorizedIngestRequest(request.headers.get('authorization'), env.INTERNAL_INGEST_TOKEN)) {
		return json(
			{
				error: 'Unauthorized'
			},
			{ status: 401 }
		);
	}

	if (!hasDatabaseConfig()) {
		return json(
			{
				error: 'NEON_DATABASE_URL is not configured'
			},
			{ status: 503 }
		);
	}

	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json(
			{
				error: 'Request body must be valid JSON'
			},
			{ status: 400 }
		);
	}

	try {
		const draftInput = parseDraftIngestPayload(payload);
		const article = await createDraftArticle(draftInput);
		const responseBody: InternalDraftIngestResponse = {
			id: article.id,
			slug: article.slug,
			status: article.status,
			workflow_execution_id: article.agent_run_id,
			admin_url: new URL(`/admin/${article.id}`, url).toString()
		};

		return json(responseBody, { status: 201 });
	} catch (error) {
                const message =
                        error instanceof Error ? error.message : 'Unable to create draft article';
                const status = message.includes('published article already exists for slug') ? 409 : 400;

		return json(
			{
                                error: message
			},
                        { status }
		);
	}
};
