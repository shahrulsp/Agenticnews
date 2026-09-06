import sanitizeHtml from 'sanitize-html';

import type {
        AgentMetadataPayload,
        Article,
        ArticleDraftEditorInput,
        ArticleImageEditorInput,
        ArticleDraftInput,
        GlossaryNote
} from '$lib/types';

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

function sanitizeStringArray(
        values: string[] | null | undefined
): string[] | null | undefined {
        if (values == null) {
                return values;
        }

        return values.flatMap((value) => {
                const sanitized = sanitizePlainText(value);
                return sanitized == null ? [] : [sanitized];
        });
}

function sanitizeOptionalUrl(value: string | null | undefined): string | null {
        if (value == null) {
                return null;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
}

function sanitizeMetadataValue(value: unknown): unknown {
        if (typeof value === 'string') {
                return sanitizePlainText(value) ?? '';
        }

        if (Array.isArray(value)) {
                return value.map((item) => sanitizeMetadataValue(item));
        }

        if (value && typeof value === 'object') {
                return Object.fromEntries(
                        Object.entries(value).flatMap(([key, entryValue]) => {
                                const sanitizedKey = sanitizePlainText(key);

                                if (sanitizedKey == null) {
                                        return [];
                                }

                                return [[sanitizedKey, sanitizeMetadataValue(entryValue)]];
                        })
                );
        }

        return value;
}

function sanitizeMetadataPayload(
        value: AgentMetadataPayload | null | undefined
): AgentMetadataPayload | null | undefined {
        if (value == null) {
                return value;
        }

        return sanitizeMetadataValue(value) as AgentMetadataPayload;
}

function sanitizeGlossaryNotes(
        notes: GlossaryNote[] | null | undefined
): GlossaryNote[] | null | undefined {
        if (notes == null) {
                return notes;
        }

        return notes.map((note) =>
                Object.fromEntries(
                        Object.entries(note).flatMap(([key, value]) => {
                                const sanitizedKey = sanitizePlainText(key);

                                if (sanitizedKey == null) {
                                        return [];
                                }

                                return [[sanitizedKey, sanitizePlainText(value) ?? '']];
                        })
                )
        );
}

export function sanitizeArticleDraftInput(input: ArticleDraftInput): ArticleDraftInput {
	return {
		...input,
		source_name: sanitizePlainText(input.source_name),
		factcheck_summary: sanitizeRichText(input.factcheck_summary),
                summary: sanitizePlainText(input.summary),
                why_viral: sanitizePlainText(input.why_viral),
                key_claims: sanitizeStringArray(input.key_claims),
                claims_made: sanitizeStringArray(input.claims_made),
                secondary_sources: sanitizeStringArray(input.secondary_sources),
                sensitivity_notes: sanitizePlainText(input.sensitivity_notes),
                form: sanitizePlainText(input.form),
                scout_payload: sanitizeMetadataPayload(input.scout_payload),
                sentinel_payload: sanitizeMetadataPayload(input.sentinel_payload),
                lens_payload: sanitizeMetadataPayload(input.lens_payload),
                polyglot_payload: sanitizeMetadataPayload(input.polyglot_payload),
                glossary_notes: sanitizeGlossaryNotes(input.glossary_notes),
                quality_notes: sanitizePlainText(input.quality_notes),
                image_strategy: sanitizePlainText(input.image_strategy),
                image_source_recommendation: sanitizePlainText(input.image_source_recommendation),
                image_notes_for_human: sanitizePlainText(input.image_notes_for_human),
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

export function sanitizeArticleDraftEditorInput(
        input: ArticleDraftEditorInput
): ArticleDraftEditorInput {
        return {
                title_ms: sanitizePlainText(input.title_ms) ?? '',
                body_ms: sanitizeRichText(input.body_ms) ?? '',
                title_en: sanitizePlainText(input.title_en),
                body_en: sanitizeRichText(input.body_en),
                source_name: sanitizePlainText(input.source_name),
                source_url: sanitizePlainText(input.source_url),
                source_date: sanitizePlainText(input.source_date),
                factcheck_verdict: input.factcheck_verdict,
                factcheck_confidence: input.factcheck_confidence,
                factcheck_summary: sanitizeRichText(input.factcheck_summary)
        };
}

export function sanitizeArticleImageEditorInput(
        input: ArticleImageEditorInput
): ArticleImageEditorInput {
        return {
                image_url: sanitizeOptionalUrl(input.image_url),
                image_alt: sanitizePlainText(input.image_alt),
                image_caption: sanitizePlainText(input.image_caption),
                lens_payload: sanitizeMetadataPayload(input.lens_payload),
                image_strategy: sanitizePlainText(input.image_strategy),
                image_source_recommendation: sanitizePlainText(input.image_source_recommendation),
                image_notes_for_human: sanitizePlainText(input.image_notes_for_human)
        };
}

export function sanitizeArticleForRender(article: Article): Article {
	return {
		...article,
                summary: sanitizePlainText(article.summary),
                why_viral: sanitizePlainText(article.why_viral),
                key_claims: sanitizeStringArray(article.key_claims),
                claims_made: sanitizeStringArray(article.claims_made),
                secondary_sources: sanitizeStringArray(article.secondary_sources),
                sensitivity_notes: sanitizePlainText(article.sensitivity_notes),
                form: sanitizePlainText(article.form),
                scout_payload: sanitizeMetadataPayload(article.scout_payload),
                sentinel_payload: sanitizeMetadataPayload(article.sentinel_payload),
                lens_payload: sanitizeMetadataPayload(article.lens_payload),
                polyglot_payload: sanitizeMetadataPayload(article.polyglot_payload),
                glossary_notes: sanitizeGlossaryNotes(article.glossary_notes),
                quality_notes: sanitizePlainText(article.quality_notes),
                image_strategy: sanitizePlainText(article.image_strategy),
                image_source_recommendation: sanitizePlainText(article.image_source_recommendation),
                image_notes_for_human: sanitizePlainText(article.image_notes_for_human),
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
