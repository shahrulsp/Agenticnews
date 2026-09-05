export type ArticleStatus = 'pending' | 'published' | 'rejected' | 'archived';

export type ArticleCategory =
        | 'breaking'
        | 'tech'
        | 'weird'
        | 'popculture'
        | 'viral'
        | 'business'
        | 'science'
        | 'offbeat'
        | 'crime'
        | 'politics'
        | 'entertainment'
        | 'sports';

export type ArticleRegion =
	| 'malaysia'
	| 'indonesia'
	| 'thailand'
	| 'philippines'
	| 'singapore'
	| 'vietnam'
	| 'japan'
	| 'south-korea'
	| 'india'
        | 'taiwan'
        | 'bangladesh'
        | 'sri-lanka'
        | 'china'
	| 'other-asia'
	| 'global';

export type HypeLevel = 'low' | 'medium' | 'high' | 'extreme';

export type FactCheckVerdict =
        | 'verified'
        | 'mostly-true'
        | 'partially-verified'
        | 'disputed'
        | 'unverifiable'
        | 'unverified'
        | 'false'
        | 'pending';

export type Locale = 'ms' | 'en';
export type AgentMetadataPayload = Record<string, unknown>;
export type GlossaryNote = Record<string, string>;

export interface Article {
	id: string;
	slug: string;
	status: ArticleStatus;
	category: ArticleCategory;
	region: ArticleRegion;
	hype_level: HypeLevel;
	ai_generated: boolean;
	agent_run_id: string | null;
	tags: string[] | null;
	source_url: string | null;
	source_name: string | null;
	source_date: string | null;
	factcheck_verdict: FactCheckVerdict;
	factcheck_confidence: number;
	factcheck_summary: string | null;
	title_ms: string;
	body_ms: string;
	reality_check_ms: string | null;
	takeaway_ms: string | null;
	prompt_question_ms: string | null;
	title_en: string | null;
	body_en: string | null;
	reality_check_en: string | null;
	takeaway_en: string | null;
	prompt_question_en: string | null;
	image_url: string | null;
	image_alt: string | null;
	image_caption: string | null;
        form?: string | null;
        summary?: string | null;
        why_viral?: string | null;
        key_claims?: string[] | null;
        claims_made?: string[] | null;
        secondary_sources?: string[] | null;
        sensitivity_notes?: string | null;
        is_sensitive?: boolean;
        scout_payload?: AgentMetadataPayload | null;
        sentinel_payload?: AgentMetadataPayload | null;
        lens_payload?: AgentMetadataPayload | null;
        polyglot_payload?: AgentMetadataPayload | null;
        glossary_notes?: GlossaryNote[] | null;
        quality_notes?: string | null;
        image_strategy?: string | null;
        image_source_recommendation?: string | null;
        image_notes_for_human?: string | null;
	created_at: string;
	updated_at: string;
	published_at: string | null;
}

export interface ArticleDraftInput {
	slug: string;
	category: ArticleCategory;
	region: ArticleRegion;
	hype_level: HypeLevel;
	ai_generated?: boolean;
	agent_run_id?: string | null;
	tags?: string[] | null;
	source_url?: string | null;
	source_name?: string | null;
	source_date?: string | null;
	factcheck_verdict?: FactCheckVerdict;
	factcheck_confidence?: number;
	factcheck_summary?: string | null;
	title_ms: string;
	body_ms: string;
	reality_check_ms?: string | null;
	takeaway_ms?: string | null;
	prompt_question_ms?: string | null;
	title_en?: string | null;
	body_en?: string | null;
	reality_check_en?: string | null;
	takeaway_en?: string | null;
	prompt_question_en?: string | null;
	image_url?: string | null;
	image_alt?: string | null;
	image_caption?: string | null;
        form?: string | null;
        summary?: string | null;
        why_viral?: string | null;
        key_claims?: string[] | null;
        claims_made?: string[] | null;
        secondary_sources?: string[] | null;
        sensitivity_notes?: string | null;
        is_sensitive?: boolean;
        scout_payload?: AgentMetadataPayload | null;
        sentinel_payload?: AgentMetadataPayload | null;
        lens_payload?: AgentMetadataPayload | null;
        polyglot_payload?: AgentMetadataPayload | null;
        glossary_notes?: GlossaryNote[] | null;
        quality_notes?: string | null;
        image_strategy?: string | null;
        image_source_recommendation?: string | null;
        image_notes_for_human?: string | null;
}

export interface ArticleDraftEditorInput {
        title_ms: string;
        body_ms: string;
        title_en?: string | null;
        body_en?: string | null;
        source_name?: string | null;
        source_url?: string | null;
        source_date?: string | null;
        factcheck_verdict?: FactCheckVerdict;
        factcheck_confidence?: number;
        factcheck_summary?: string | null;
}

export interface InternalDraftLocalePayload {
	title?: string;
	body?: string;
	reality_check?: string;
	takeaway?: string;
	prompt_question?: string;
}

export interface InternalDraftArticlePayload {
	slug?: string;
	category?: ArticleCategory;
	region?: ArticleRegion;
	hype_level?: HypeLevel;
	agent_run_id?: string | null;
	workflow_execution_id?: string | null;
	source_url?: string | null;
	source_name?: string | null;
	source_date?: string | null;
	factcheck_verdict?: FactCheckVerdict;
	factcheck_confidence?: number;
	factcheck_summary?: string | null;
	tags?: string[] | null;
	ms?: InternalDraftLocalePayload;
	en?: InternalDraftLocalePayload;
	image_url?: string | null;
	image_alt?: string | null;
	image_caption?: string | null;
        form?: string | null;
        summary?: string | null;
        why_viral?: string | null;
        key_claims?: string[] | null;
        claims_made?: string[] | null;
        secondary_sources?: string[] | null;
        sensitivity_notes?: string | null;
        is_sensitive?: boolean;
        scout_payload?: AgentMetadataPayload | null;
        sentinel_payload?: AgentMetadataPayload | null;
        lens_payload?: AgentMetadataPayload | null;
        polyglot_payload?: AgentMetadataPayload | null;
        glossary_notes?: GlossaryNote[] | null;
        quality_notes?: string | null;
        image_strategy?: string | null;
        image_source_recommendation?: string | null;
        image_notes_for_human?: string | null;
}

export interface InternalDraftIngestPayload {
	article?: InternalDraftArticlePayload;
}

export interface InternalDraftIngestResponse {
	id: string;
	slug: string;
	status: ArticleStatus;
	workflow_execution_id: string | null;
	admin_url: string;
}

export interface LocalizedArticleView {
	title: string;
	body: string;
	reality_check: string | null;
	takeaway: string | null;
	prompt_question: string | null;
	image_alt: string | null;
	locale_used: Locale;
}

export function localizeArticle(article: Article, locale: Locale): LocalizedArticleView {
	const hasEnglishContent = article.title_en !== null && article.body_en !== null;
	const useEnglish = locale === 'en' && hasEnglishContent;

	return {
		title: useEnglish ? article.title_en! : article.title_ms,
		body: useEnglish ? article.body_en! : article.body_ms,
		reality_check: useEnglish ? article.reality_check_en : article.reality_check_ms,
		takeaway: useEnglish ? article.takeaway_en : article.takeaway_ms,
		prompt_question: useEnglish ? article.prompt_question_en : article.prompt_question_ms,
		image_alt: article.image_alt,
		locale_used: useEnglish ? 'en' : 'ms'
	};
}
