import { hasDatabaseConfig } from '$lib/server/db';
import { getArticleBySlug } from '$lib/server/queries';
import { sanitizeArticleForRender } from '$lib/server/sanitize';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!hasDatabaseConfig()) {
		return {
			article: null,
			databaseReady: false,
			databaseError: null
		};
	}

	try {
		const article = await getArticleBySlug(params.slug);

		if (!article) {
			throw error(404, 'Article not found');
		}

		return {
			article: sanitizeArticleForRender(article),
			databaseReady: true,
			databaseError: null
		};
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		return {
			article: null,
			databaseReady: true,
			databaseError: err instanceof Error ? err.message : 'Unable to load the article.'
		};
	}
};
