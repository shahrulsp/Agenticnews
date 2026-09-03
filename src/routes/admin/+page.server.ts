import { getPendingArticles } from '$lib/server/queries';
import { hasDatabaseConfig } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const review = url.searchParams.get('review');
	const workflow = url.searchParams.get('workflow');
	const workflowMessage = url.searchParams.get('workflowMessage');
	const workflowStatus =
		workflow === 'sent' || workflow === 'skipped' || workflow === 'failed' ? workflow : null;

	if (!hasDatabaseConfig()) {
		return {
			articles: [],
			databaseReady: false,
			databaseError: null,
			reviewStatus: null,
			workflowStatus,
			workflowMessage
		};
	}

	try {
		const articles = await getPendingArticles();

		return {
			articles,
			databaseReady: true,
			databaseError: null,
			reviewStatus: review === 'approved' || review === 'rejected' ? review : null,
			workflowStatus,
			workflowMessage
		};
	} catch (error) {
		return {
			articles: [],
			databaseReady: true,
			databaseError: error instanceof Error ? error.message : 'Unable to load pending articles.',
			reviewStatus: null,
			workflowStatus,
			workflowMessage
		};
	}
};
