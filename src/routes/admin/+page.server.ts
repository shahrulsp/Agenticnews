import { getMorningBatchProgress, getPendingArticles, getPublishedArticles } from '$lib/server/queries';
import { hasDatabaseConfig } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const review = url.searchParams.get('review');

	if (!hasDatabaseConfig()) {
		return {
			articles: [],
                        publishedArticles: [],
			databaseReady: false,
			databaseError: null,
                        reviewStatus: null
		};
	}

	try {
		const articles = await getPendingArticles();
                const publishedArticles = await getPublishedArticles({ limit: 50 });
                const batchProgress = articles[0] ? await getMorningBatchProgress(articles[0].slug) : null;

		return {
			articles,
                        publishedArticles,
                        batchProgress,
			databaseReady: true,
			databaseError: null,
                        reviewStatus: review === 'approved' || review === 'rejected' ? review : null
		};
	} catch (error) {
		return {
			articles: [],
                        publishedArticles: [],
                        batchProgress: null,
			databaseReady: true,
			databaseError: error instanceof Error ? error.message : 'Unable to load pending articles.',
                        reviewStatus: null
		};
	}
};
