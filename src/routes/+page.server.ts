import { hasDatabaseConfig } from '$lib/server/db';
import { getPublishedArticles } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!hasDatabaseConfig()) {
		return {
			articles: [],
			databaseReady: false,
			databaseError: null
		};
	}

	try {
		const articles = await getPublishedArticles();

		return {
			articles,
			databaseReady: true,
			databaseError: null
		};
	} catch (error) {
		return {
			articles: [],
			databaseReady: true,
			databaseError: error instanceof Error ? error.message : 'Unable to load published articles.'
		};
	}
};
