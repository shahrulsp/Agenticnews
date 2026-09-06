import { env } from '$env/dynamic/private';
import {
        approveArticle,
        getArticleById,
        getMorningBatchProgress,
        getPendingArticleNavigator,
        rejectArticle,
        updatePendingArticleDraft,
        updatePendingArticleImage
} from '$lib/server/queries';
import { hasDatabaseConfig } from '$lib/server/db';
import { generateLensImageForArticle } from '$lib/server/lens';
import { sanitizeArticleForRender } from '$lib/server/sanitize';
import { error, fail, redirect } from '@sveltejs/kit';
import type { FactCheckVerdict } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const FACT_CHECK_VERDICTS: FactCheckVerdict[] = [
        'verified',
        'mostly-true',
        'disputed',
        'unverifiable',
        'false',
        'pending'
];

type EditorValues = {
        title_ms: string;
        body_ms: string;
        title_en: string;
        body_en: string;
        source_name: string;
        source_url: string;
        source_date: string;
        factcheck_verdict: string;
        factcheck_confidence: string;
        factcheck_summary: string;
};

function readEditorValues(formData: FormData): EditorValues {
        return {
                title_ms: typeof formData.get('title_ms') === 'string' ? String(formData.get('title_ms')) : '',
                body_ms: typeof formData.get('body_ms') === 'string' ? String(formData.get('body_ms')) : '',
                title_en: typeof formData.get('title_en') === 'string' ? String(formData.get('title_en')) : '',
                body_en: typeof formData.get('body_en') === 'string' ? String(formData.get('body_en')) : '',
                source_name:
                        typeof formData.get('source_name') === 'string' ? String(formData.get('source_name')) : '',
                source_url:
                        typeof formData.get('source_url') === 'string' ? String(formData.get('source_url')) : '',
                source_date:
                        typeof formData.get('source_date') === 'string' ? String(formData.get('source_date')) : '',
                factcheck_verdict:
                        typeof formData.get('factcheck_verdict') === 'string'
                                ? String(formData.get('factcheck_verdict'))
                                : 'pending',
                factcheck_confidence:
                        typeof formData.get('factcheck_confidence') === 'string'
                                ? String(formData.get('factcheck_confidence'))
                                : '0',
                factcheck_summary:
                        typeof formData.get('factcheck_summary') === 'string'
                                ? String(formData.get('factcheck_summary'))
                                : ''
        };
}

function normalizeOptionalUrl(value: string): string | null {
        const trimmed = value.trim();

        if (!trimmed) {
                return null;
        }

        try {
                const parsed = new URL(trimmed);

                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                        return null;
                }

                return parsed.toString();
        } catch {
                return null;
        }
}

function normalizeOptionalDate(value: string): string | null {
        const trimmed = value.trim();

        if (!trimmed) {
                return null;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return null;
        }

        const parsed = new Date(`${trimmed}T00:00:00.000Z`);

        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
                return null;
        }

        return trimmed;
}

function normalizeFactCheckVerdict(value: string): FactCheckVerdict | null {
        return FACT_CHECK_VERDICTS.includes(value as FactCheckVerdict)
                ? (value as FactCheckVerdict)
                : null;
}

function normalizeFactCheckConfidence(value: string): number | null {
        const trimmed = value.trim();

        if (!/^\d+$/.test(trimmed)) {
                return null;
        }

        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
                return null;
        }

        return parsed;
}


export const load: PageServerLoad = async ({ params, url }) => {
        const reviewState = url.searchParams.get('review');

	if (!hasDatabaseConfig()) {
		return {
			article: null,
			databaseReady: false,
                        databaseError: null,
                        reviewState
		};
	}

	try {
		const article = await getArticleById(params.id);

		if (!article) {
			throw error(404, 'Article not found');
		}

                const navigator = await getPendingArticleNavigator(params.id);
                const batchProgress = await getMorningBatchProgress(article.slug);

		return {
			article: sanitizeArticleForRender(article),
                        batchProgress,
                        navigator,
			databaseReady: true,
                        databaseError: null,
                        reviewState
		};
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		return {
			article: null,
                        batchProgress: null,
                        navigator: null,
			databaseReady: true,
                        databaseError: err instanceof Error ? err.message : 'Unable to load the article.',
                        reviewState
		};
	}
};

export const actions: Actions = {
        refreshImage: async ({ params, request }) => {
                const formData = await request.formData();
                const imageDirection =
                        typeof formData.get('image_direction') === 'string'
                                ? String(formData.get('image_direction'))
                                : '';

                if (!hasDatabaseConfig()) {
                        return fail(503, {
                                reviewError: 'Add NEON_DATABASE_URL to your local .env before refreshing images.',
                                imageValues: {
                                        image_direction: imageDirection
                                }
                        });
                }

                if (!env.MISTRAL_API_KEY?.trim()) {
                        return fail(503, {
                                reviewError: 'Add MISTRAL_API_KEY before asking Lens to refresh the image.',
                                imageValues: {
                                        image_direction: imageDirection
                                }
                        });
                }

                try {
                        const article = await getArticleById(params.id);

                        if (!article || article.status !== 'pending') {
                                return fail(404, {
                                        reviewError: 'This article is no longer pending review.',
                                        imageValues: {
                                                image_direction: imageDirection
                                        }
                                });
                        }

                        const imageUpdate = await generateLensImageForArticle(article, {
                                apiKey: env.MISTRAL_API_KEY,
                                model: env.MISTRAL_TEXT_MODEL,
                                editorInstruction: imageDirection
                        });
                        const result = await updatePendingArticleImage(params.id, imageUpdate);

                        if (!result) {
                                return fail(404, {
                                        reviewError: 'This article is no longer pending review.',
                                        imageValues: {
                                                image_direction: imageDirection
                                        }
                                });
                        }

                        throw redirect(303, `/admin/${params.id}?review=image-refreshed`);
                } catch (err) {
                        if (err && typeof err === 'object' && 'status' in err) {
                                throw err;
                        }

                        return fail(500, {
                                reviewError:
                                        err instanceof Error ? err.message : 'Unable to refresh the Lens image.',
                                imageValues: {
                                        image_direction: imageDirection
                                }
                        });
                }
        },

        save: async ({ params, request }) => {
                if (!hasDatabaseConfig()) {
                        return fail(503, {
                                reviewError: 'Add NEON_DATABASE_URL to your local .env before saving edits.'
                        });
                }

                const formData = await request.formData();
                const editorValues = readEditorValues(formData);

                if (editorValues.title_ms.trim().length === 0) {
                        return fail(400, {
                                reviewError: 'Malay headline is required before saving.',
                                editorValues: { ...editorValues, title_ms: '' }
                        });
                }

                if (editorValues.body_ms.trim().length === 0) {
                        return fail(400, {
                                reviewError: 'Malay body copy is required before saving.',
                                editorValues: { ...editorValues, body_ms: '' }
                        });
                }

                const normalizedSourceUrl = normalizeOptionalUrl(editorValues.source_url);

                if (editorValues.source_url.trim().length > 0 && !normalizedSourceUrl) {
                        return fail(400, {
                                reviewError: 'Source URL must be a valid http or https address.',
                                editorValues
                        });
                }

                const normalizedSourceDate = normalizeOptionalDate(editorValues.source_date);

                if (editorValues.source_date.trim().length > 0 && !normalizedSourceDate) {
                        return fail(400, {
                                reviewError: 'Source date must use the YYYY-MM-DD format.',
                                editorValues
                        });
                }

                const normalizedFactCheckVerdict = normalizeFactCheckVerdict(editorValues.factcheck_verdict);

                if (!normalizedFactCheckVerdict) {
                        return fail(400, {
                                reviewError: 'Pick a valid fact-check verdict before saving.',
                                editorValues
                        });
                }

                const normalizedFactCheckConfidence = normalizeFactCheckConfidence(
                        editorValues.factcheck_confidence
                );

                if (normalizedFactCheckConfidence === null) {
                        return fail(400, {
                                reviewError: 'Fact-check confidence must be a whole number between 0 and 100.',
                                editorValues
                        });
                }

                try {
                        const result = await updatePendingArticleDraft(params.id, {
                                title_ms: editorValues.title_ms,
                                body_ms: editorValues.body_ms,
                                title_en: editorValues.title_en,
                                body_en: editorValues.body_en,
                                source_name: editorValues.source_name,
                                source_url: normalizedSourceUrl,
                                source_date: normalizedSourceDate,
                                factcheck_verdict: normalizedFactCheckVerdict,
                                factcheck_confidence: normalizedFactCheckConfidence,
                                factcheck_summary: editorValues.factcheck_summary
                        });

                        if (!result) {
                                return fail(404, { reviewError: 'This article is no longer pending review.' });
                        }

                        throw redirect(303, `/admin/${params.id}?review=saved`);
                } catch (err) {
                        if (err && typeof err === 'object' && 'status' in err) {
                                throw err;
                        }

                        return fail(500, {
                                reviewError: err instanceof Error ? err.message : 'Unable to save draft edits.',
                                editorValues
                        });
                }
        },

	approve: async ({ params }) => {
		if (!hasDatabaseConfig()) {
			return fail(503, {
				reviewError: 'Add NEON_DATABASE_URL to your local .env before approving.'
			});
		}

		try {
                        const navigator = await getPendingArticleNavigator(params.id);
			const result = await approveArticle(params.id);

			if (!result) {
				return fail(404, { reviewError: 'This article is no longer pending review.' });
			}

                        const nextTarget = navigator?.nextId ?? navigator?.previousId;

                        if (nextTarget) {
                                throw redirect(303, `/admin/${nextTarget}?review=approved`);
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
                        const navigator = await getPendingArticleNavigator(params.id);
			const result = await rejectArticle(params.id);

			if (!result) {
				return fail(404, { reviewError: 'This article is no longer pending review.' });
			}

                        const nextTarget = navigator?.nextId ?? navigator?.previousId;

                        if (nextTarget) {
                                throw redirect(303, `/admin/${nextTarget}?review=rejected`);
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
