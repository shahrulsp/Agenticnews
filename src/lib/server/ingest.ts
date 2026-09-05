import type {
	ArticleDraftInput,
	ArticleCategory,
	ArticleRegion,
	FactCheckVerdict,
	HypeLevel,
	InternalDraftArticlePayload,
	InternalDraftIngestPayload,
	InternalDraftLocalePayload
} from '$lib/types';

const ARTICLE_CATEGORIES: ArticleCategory[] = [
	'breaking',
	'tech',
	'weird',
	'popculture',
	'viral',
	'business',
	'science',
        'offbeat',
        'crime',
        'politics',
        'entertainment',
        'sports'
];

const ARTICLE_REGIONS: ArticleRegion[] = [
	'malaysia',
	'indonesia',
	'thailand',
	'philippines',
	'singapore',
	'vietnam',
	'japan',
	'south-korea',
	'india',
        'taiwan',
        'bangladesh',
        'sri-lanka',
        'china',
	'other-asia',
	'global'
];

const HYPE_LEVELS: HypeLevel[] = ['low', 'medium', 'high', 'extreme'];
const FACTCHECK_VERDICTS: FactCheckVerdict[] = [
	'verified',
	'mostly-true',
        'partially-verified',
	'disputed',
	'unverifiable',
        'unverified',
	'false',
	'pending'
];

type DraftLocalePayload = InternalDraftLocalePayload & {
	title?: unknown;
	body?: unknown;
	reality_check?: unknown;
	takeaway?: unknown;
	prompt_question?: unknown;
};

type DraftArticlePayload = InternalDraftArticlePayload & {
	slug?: unknown;
	category?: unknown;
	region?: unknown;
	hype_level?: unknown;
	agent_run_id?: unknown;
	workflow_execution_id?: unknown;
	source_url?: unknown;
	source_name?: unknown;
	source_date?: unknown;
	factcheck_verdict?: unknown;
	factcheck_confidence?: unknown;
	factcheck_summary?: unknown;
	tags?: unknown;
	ms?: DraftLocalePayload;
	en?: DraftLocalePayload;
	image_url?: unknown;
	image_alt?: unknown;
	image_caption?: unknown;
        form?: unknown;
        summary?: unknown;
        why_viral?: unknown;
        key_claims?: unknown;
        claims_made?: unknown;
        secondary_sources?: unknown;
        sensitivity_notes?: unknown;
        is_sensitive?: unknown;
        scout_payload?: unknown;
        sentinel_payload?: unknown;
        lens_payload?: unknown;
        polyglot_payload?: unknown;
        glossary_notes?: unknown;
        quality_notes?: unknown;
        image_strategy?: unknown;
        image_source_recommendation?: unknown;
        image_notes_for_human?: unknown;
        source_recommendation?: unknown;
        notes_for_human?: unknown;
};

type DraftEnvelopePayload = InternalDraftIngestPayload & {
	article?: DraftArticlePayload;
};

function readRequiredString(value: unknown, fieldName: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${fieldName} is required`);
	}

	return value.trim();
}

function readOptionalString(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] | null {
	if (!Array.isArray(value)) {
		return null;
	}

	const normalized = value
		.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
		.map((entry) => entry.trim());

	return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEnumValue<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fieldName: string
): T {
	if (typeof value !== 'string' || !allowed.includes(value as T)) {
		throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
	}

	return value as T;
}

function readOptionalNumber(value: unknown): number | undefined {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return undefined;
	}

	return value;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
        return typeof value === 'boolean' ? value : undefined;
}

function readOptionalPayloadObject(value: unknown): Record<string, unknown> | null {
        return isRecord(value) ? value : null;
}

function readGlossaryNotes(value: unknown): Array<Record<string, string>> | null {
        if (!Array.isArray(value)) {
                return null;
        }

        const normalized = value.flatMap((entry) => {
                if (!isRecord(entry)) {
                        return [];
                }

                const pairs = Object.entries(entry).flatMap(([key, itemValue]) => {
                        if (typeof itemValue !== 'string') {
                                return [];
                        }

                        const normalizedValue = itemValue.trim();
                        return normalizedValue.length > 0 ? [[key, normalizedValue] as const] : [];
                });

                return pairs.length > 0 ? [Object.fromEntries(pairs)] : [];
        });

        return normalized.length > 0 ? normalized : null;
}

export function isAuthorizedIngestRequest(
	authorizationHeader: string | null,
	expectedToken: string | undefined
): boolean {
	if (!expectedToken || expectedToken.trim().length === 0) {
		return false;
	}

	if (!authorizationHeader?.startsWith('Bearer ')) {
		return false;
	}

	return authorizationHeader.slice('Bearer '.length) === expectedToken;
}

export function parseDraftIngestPayload(payload: unknown): ArticleDraftInput {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Request body must be a JSON object');
	}

	const envelope = payload as DraftEnvelopePayload;
	const article = envelope.article;

	if (!article || typeof article !== 'object') {
		throw new Error('article payload is required');
	}

	const ms = article.ms;
	if (!ms || typeof ms !== 'object') {
		throw new Error('article.ms payload is required');
	}

	const en = article.en;
	const workflowExecutionId =
		readOptionalString(article.workflow_execution_id) ?? readOptionalString(article.agent_run_id);

	return {
		slug: readRequiredString(article.slug, 'article.slug'),
		category: readEnumValue(article.category, ARTICLE_CATEGORIES, 'article.category'),
		region: readEnumValue(article.region, ARTICLE_REGIONS, 'article.region'),
		hype_level: readEnumValue(article.hype_level, HYPE_LEVELS, 'article.hype_level'),
		agent_run_id: workflowExecutionId,
		source_url: readOptionalString(article.source_url),
		source_name: readOptionalString(article.source_name),
		source_date: readOptionalString(article.source_date),
		factcheck_verdict:
			article.factcheck_verdict == null
				? 'pending'
				: readEnumValue(article.factcheck_verdict, FACTCHECK_VERDICTS, 'article.factcheck_verdict'),
		factcheck_confidence: readOptionalNumber(article.factcheck_confidence) ?? 0,
		factcheck_summary: readOptionalString(article.factcheck_summary),
		tags: readStringArray(article.tags),
		title_ms: readRequiredString(ms.title, 'article.ms.title'),
		body_ms: readRequiredString(ms.body, 'article.ms.body'),
		reality_check_ms: readOptionalString(ms.reality_check),
		takeaway_ms: readOptionalString(ms.takeaway),
		prompt_question_ms: readOptionalString(ms.prompt_question),
		title_en: en && typeof en === 'object' ? readOptionalString(en.title) : null,
		body_en: en && typeof en === 'object' ? readOptionalString(en.body) : null,
		reality_check_en: en && typeof en === 'object' ? readOptionalString(en.reality_check) : null,
		takeaway_en: en && typeof en === 'object' ? readOptionalString(en.takeaway) : null,
		prompt_question_en:
			en && typeof en === 'object' ? readOptionalString(en.prompt_question) : null,
		image_url: readOptionalString(article.image_url),
		image_alt: readOptionalString(article.image_alt),
                image_caption: readOptionalString(article.image_caption),
                form: readOptionalString(article.form),
                summary: readOptionalString(article.summary),
                why_viral: readOptionalString(article.why_viral),
                key_claims: readStringArray(article.key_claims),
                claims_made: readStringArray(article.claims_made),
                secondary_sources: readStringArray(article.secondary_sources),
                sensitivity_notes: readOptionalString(article.sensitivity_notes),
                is_sensitive: readOptionalBoolean(article.is_sensitive) ?? false,
                scout_payload: readOptionalPayloadObject(article.scout_payload),
                sentinel_payload: readOptionalPayloadObject(article.sentinel_payload),
                lens_payload: readOptionalPayloadObject(article.lens_payload),
                polyglot_payload: readOptionalPayloadObject(article.polyglot_payload),
                glossary_notes: readGlossaryNotes(article.glossary_notes),
                quality_notes: readOptionalString(article.quality_notes),
                image_strategy: readOptionalString(article.image_strategy),
                image_source_recommendation:
                        readOptionalString(article.image_source_recommendation) ??
                        readOptionalString(article.source_recommendation),
                image_notes_for_human:
                        readOptionalString(article.image_notes_for_human) ??
                        readOptionalString(article.notes_for_human)
	};
}
