import { approveArticle, getArticleById, rejectArticle } from '$lib/server/queries';
import { hasDatabaseConfig } from '$lib/server/db';
import { sanitizeArticleForRender } from '$lib/server/sanitize';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!hasDatabaseConfig()) {
		return {
			article: null,
			databaseReady: false,
			databaseError: null
		};
	}

	try {
		const article = await getArticleById(params.id);

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

export const actions: Actions = {
	approve: async ({ params }) => {
		if (!hasDatabaseConfig()) {
			return fail(503, {
				reviewError: 'Add NEON_DATABASE_URL to your local .env before approving.'
			});
		}

		try {
			const result = await approveArticle(params.id);

			if (!result) {
				return fail(404, { reviewError: 'This article is no longer pending review.' });
			}

                        throw redirect(303, '/admin?review=approved');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err) {
				throw err;
			}

			return fail(500, {
				reviewError: err instanceof Error ? err.message : 'Unable to approve the article.'
			});
		}
	},

        reject: async ({ params }) => {
		if (!hasDatabaseConfig()) {
			return fail(503, {
				reviewError: 'Add NEON_DATABASE_URL to your local .env before rejecting.'
			});
		}

		try {
			const result = await rejectArticle(params.id);

			if (!result) {
				return fail(404, { reviewError: 'This article is no longer pending review.' });
			}

                        throw redirect(303, '/admin?review=rejected');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err) {
				throw err;
			}

			return fail(500, {
				reviewError: err instanceof Error ? err.message : 'Unable to reject the article.'
			});
		}
	}
};
