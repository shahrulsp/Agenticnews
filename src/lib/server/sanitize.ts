import sanitizeHtml from 'sanitize-html';

import type { Article, ArticleDraftInput } from '$lib/types';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'h2',
		'h3',
		'p',
		'strong',
		'em',
		'ul',
		'ol',
		'li',
		'blockquote',
		'br',
		'a',
		'code',
		'pre'
	],
	allowedAttributes: {
		a: ['href', 'target', 'rel']
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	transformTags: {
		a: (tagName, attribs) => {
			const href = attribs.href ?? '';
			const target = attribs.target === '_blank' ? '_blank' : undefined;

			return {
				tagName,
				attribs: {
					href,
					...(target ? { target } : {}),
					rel: 'noopener noreferrer'
				}
			};
		}
	}
};

const PLAIN_TEXT_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [],
	allowedAttributes: {}
};

export function sanitizePlainText(value: string | null | undefined): string | null {
	if (value == null) {
		return null;
	}

	const sanitized = sanitizeHtml(value, PLAIN_TEXT_OPTIONS).replace(/\s+/g, ' ').trim();

	return sanitized.length > 0 ? sanitized : null;
}

export function sanitizeRichText(value: string | null | undefined): string | null {
	if (value == null) {
		return null;
	}

	return sanitizeHtml(value, SANITIZE_OPTIONS);
}

export function sanitizeArticleDraftInput(input: ArticleDraftInput): ArticleDraftInput {
	return {
		...input,
		source_name: sanitizePlainText(input.source_name),
		factcheck_summary: sanitizeRichText(input.factcheck_summary),
		title_ms: sanitizePlainText(input.title_ms) ?? '',
		body_ms: sanitizeRichText(input.body_ms) ?? '',
		reality_check_ms: sanitizeRichText(input.reality_check_ms),
		takeaway_ms: sanitizeRichText(input.takeaway_ms),
		prompt_question_ms: sanitizeRichText(input.prompt_question_ms),
		title_en: sanitizePlainText(input.title_en),
		body_en: sanitizeRichText(input.body_en),
		reality_check_en: sanitizeRichText(input.reality_check_en),
		takeaway_en: sanitizeRichText(input.takeaway_en),
		prompt_question_en: sanitizeRichText(input.prompt_question_en),
		image_alt: sanitizePlainText(input.image_alt),
		image_caption: sanitizePlainText(input.image_caption)
	};
}

export function sanitizeArticleForRender(article: Article): Article {
	return {
		...article,
		body_ms: sanitizeRichText(article.body_ms) ?? '',
		body_en: sanitizeRichText(article.body_en),
		reality_check_ms: sanitizeRichText(article.reality_check_ms),
		takeaway_ms: sanitizeRichText(article.takeaway_ms),
		prompt_question_ms: sanitizeRichText(article.prompt_question_ms),
		reality_check_en: sanitizeRichText(article.reality_check_en),
		takeaway_en: sanitizeRichText(article.takeaway_en),
		prompt_question_en: sanitizeRichText(article.prompt_question_en),
		factcheck_summary: sanitizeRichText(article.factcheck_summary)
	};
}
