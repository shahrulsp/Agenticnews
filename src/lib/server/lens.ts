import type { AgentMetadataPayload, Article, ArticleImageEditorInput } from '$lib/types';

import { sanitizePlainText } from './sanitize';

const GENERATED_IMAGE_ENDPOINT = 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image';
const DEFAULT_GENERATED_IMAGE_SIZE = 'landscape_16_9';
const DEFAULT_MODEL = 'mistral-small-latest';
const MISTRAL_CHAT_COMPLETIONS_URL = 'https://api.mistral.ai/v1/chat/completions';

type LensCompletionResult = {
        image_strategy?: unknown;
        image_source_recommendation?: unknown;
        image_notes_for_human?: unknown;
        image_prompt?: unknown;
        image_alt?: unknown;
        image_caption?: unknown;
};

type LensGenerationOptions = {
        apiKey: string;
        model?: string;
        editorInstruction?: string | null;
        fetchImpl?: typeof fetch;
};

function buildJsonSchemaResponseFormat(name: string, schema: object): object {
        return {
                type: 'json_schema',
                json_schema: {
                        name,
                        schema,
                        strict: true
                }
        };
}

function buildLensSchema(): object {
        return {
                type: 'object',
                additionalProperties: false,
                properties: {
                        image_strategy: { type: 'string' },
                        image_source_recommendation: { type: 'string' },
                        image_notes_for_human: { type: 'string' },
                        image_prompt: { type: 'string' },
                        image_alt: { type: 'string' },
                        image_caption: { type: 'string' }
                },
                required: [
                        'image_strategy',
                        'image_source_recommendation',
                        'image_notes_for_human',
                        'image_prompt',
                        'image_alt',
                        'image_caption'
                ]
        };
}

function extractTextContent(content: unknown): string {
        if (typeof content === 'string') {
                return content.trim();
        }

        if (!Array.isArray(content)) {
                return '';
        }

        return content
                .flatMap((chunk) => {
                        if (!chunk || typeof chunk !== 'object') {
                                return [];
                        }

                        const text = 'text' in chunk ? chunk.text : null;
                        return typeof text === 'string' ? [text] : [];
                })
                .join('')
                .trim();
}

function extractJsonCandidate(rawText: string): string {
        const text = rawText.trim();

        if (!text) {
            return text;
        }

        const objectStart = text.indexOf('{');
        const arrayStart = text.indexOf('[');
        const starts = [objectStart, arrayStart].filter((value) => value >= 0);

        if (starts.length === 0) {
                return text;
        }

        const startIndex = Math.min(...starts);
        const closingChar = startIndex === arrayStart ? ']' : '}';
        const endIndex = text.lastIndexOf(closingChar);

        if (endIndex < startIndex) {
                return text;
        }

        return text.slice(startIndex, endIndex + 1).trim();
}

function sanitizeJsonCandidate(jsonCandidate: string): string {
        const sanitized: string[] = [];
        let inString = false;
        let escaping = false;

        for (const char of jsonCandidate) {
                if (escaping) {
                        sanitized.push(char);
                        escaping = false;
                        continue;
                }

                if (char === '\\') {
                        sanitized.push(char);
                        escaping = true;
                        continue;
                }

                if (char === '"') {
                        sanitized.push(char);
                        inString = !inString;
                        continue;
                }

                if (inString && char.charCodeAt(0) < 32) {
                        if (char === '\n') {
                                sanitized.push('\\n');
                        } else if (char === '\r') {
                                sanitized.push('\\r');
                        } else if (char === '\t') {
                                sanitized.push('\\t');
                        } else {
                                sanitized.push(`\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
                        }

                        continue;
                }

                sanitized.push(char);
        }

        return sanitized.join('');
}

function buildFallbackImagePrompt(article: Article, editorInstruction?: string | null): string {
        const headline = sanitizePlainText(article.title_en ?? article.title_ms) ?? 'Agenticnews story';
        const summary =
                sanitizePlainText(article.summary) ??
                sanitizePlainText(article.why_viral) ??
                sanitizePlainText(article.source_name) ??
                'editorial news scene';
        const direction = sanitizePlainText(editorInstruction) ?? 'credible documentary-style framing';

        return [
                'photorealistic editorial news image',
                headline,
                summary,
                `${article.category.replace('-', ' ')} story in ${article.region.replace('-', ' ')}`,
                direction,
                'realistic setting',
                'natural light',
                'documentary photography',
                'no text overlay',
                'no watermark'
        ].join(', ');
}

function buildFallbackImageAlt(article: Article): string {
        return `${article.title_ms} illustration for Agenticnews`;
}

function buildFallbackImageCaption(article: Article): string {
        return `AI-generated editorial illustration for ${article.source_name ?? 'Agenticnews editorial desk'}.`;
}

function buildGeneratedImageUrl(prompt: string, imageSize: string = DEFAULT_GENERATED_IMAGE_SIZE): string | null {
        const cleanedPrompt = prompt.trim().replace(/\s+/g, ' ');

        if (!cleanedPrompt) {
                return null;
        }

        return `${GENERATED_IMAGE_ENDPOINT}?prompt=${encodeURIComponent(cleanedPrompt)}&image_size=${imageSize}`;
}

function normalizeLensResult(
        article: Article,
        result: LensCompletionResult,
        editorInstruction?: string | null
): ArticleImageEditorInput {
        const imagePrompt =
                sanitizePlainText(typeof result.image_prompt === 'string' ? result.image_prompt : null) ??
                buildFallbackImagePrompt(article, editorInstruction);
        const imageAlt =
                sanitizePlainText(typeof result.image_alt === 'string' ? result.image_alt : null) ??
                buildFallbackImageAlt(article);
        const imageCaption =
                sanitizePlainText(typeof result.image_caption === 'string' ? result.image_caption : null) ??
                buildFallbackImageCaption(article);

        return {
                image_url: buildGeneratedImageUrl(imagePrompt),
                image_alt: imageAlt,
                image_caption: imageCaption,
                image_strategy:
                        sanitizePlainText(
                                typeof result.image_strategy === 'string' ? result.image_strategy : null
                        ) ?? 'Generated by Lens',
                image_source_recommendation:
                        sanitizePlainText(
                                typeof result.image_source_recommendation === 'string'
                                        ? result.image_source_recommendation
                                        : null
                        ) ?? 'AI-generated editorial illustration',
                image_notes_for_human:
                        sanitizePlainText(
                                typeof result.image_notes_for_human === 'string'
                                        ? result.image_notes_for_human
                                        : null
                        ) ?? 'Generated automatically from the latest Lens brief.',
                lens_payload: {
                        image_strategy:
                                sanitizePlainText(
                                        typeof result.image_strategy === 'string'
                                                ? result.image_strategy
                                                : null
                                ) ?? 'Generated by Lens',
                        image_source_recommendation:
                                sanitizePlainText(
                                        typeof result.image_source_recommendation === 'string'
                                                ? result.image_source_recommendation
                                                : null
                                ) ?? 'AI-generated editorial illustration',
                        image_notes_for_human:
                                sanitizePlainText(
                                        typeof result.image_notes_for_human === 'string'
                                                ? result.image_notes_for_human
                                                : null
                                ) ?? 'Generated automatically from the latest Lens brief.',
                        image_prompt: imagePrompt,
                        image_alt: imageAlt,
                        image_caption: imageCaption,
                        editor_instruction: sanitizePlainText(editorInstruction),
                        refreshed_from_admin: true
                } satisfies AgentMetadataPayload
        };
}

function buildLensMessages(article: Article, editorInstruction?: string | null): Array<{ role: 'system' | 'user'; content: string }> {
        const editorialInstruction = sanitizePlainText(editorInstruction);
        const scoutContext = article.scout_payload ?? {
                title: article.title_en ?? article.title_ms,
                category: article.category,
                region: article.region,
                summary: article.summary,
                source_name: article.source_name,
                source_date: article.source_date,
                why_viral: article.why_viral
        };
        const scribeContext = {
                headline: article.title_en ?? article.title_ms,
                title_ms: article.title_ms,
                body_excerpt: sanitizePlainText(article.body_en ?? article.body_ms)?.slice(0, 900) ?? '',
                form: article.form,
                claims_made: article.claims_made,
                sensitivity_notes: article.sensitivity_notes
        };
        const sentinelContext = article.sentinel_payload ?? {
                verdict: article.factcheck_verdict,
                confidence: article.factcheck_confidence,
                summary: article.factcheck_summary,
                quality_notes: article.quality_notes
        };
        const currentLensContext = article.lens_payload ?? null;

        return [
                {
                        role: 'system',
                        content:
                                'You are Lens for Agenticnews. Return strict JSON only. Produce a practical editorial image recommendation plus a photorealistic text-to-image prompt suitable for a newsroom story image. Avoid text overlays, logos, watermarks, and sensational or graphic framing.'
                },
                {
                        role: 'user',
                        content: [
                                'Recommend a replacement story image for this draft.',
                                `Scout:\n${JSON.stringify(scoutContext, null, 2)}`,
                                `Scribe:\n${JSON.stringify(scribeContext, null, 2)}`,
                                `Sentinel:\n${JSON.stringify(sentinelContext, null, 2)}`,
                                `Current Lens:\n${JSON.stringify(currentLensContext, null, 2)}`,
                                editorialInstruction
                                        ? `Editor request:\n${editorialInstruction}`
                                        : 'Editor request:\nRefresh the image with a stronger but still accurate editorial framing.'
                        ].join('\n\n')
                }
        ];
}

export async function generateLensImageForArticle(
        article: Article,
        { apiKey, model = DEFAULT_MODEL, editorInstruction, fetchImpl = fetch }: LensGenerationOptions
): Promise<ArticleImageEditorInput> {
        const response = await fetchImpl(MISTRAL_CHAT_COMPLETIONS_URL, {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        model,
                        temperature: 0.1,
                        max_tokens: 900,
                        messages: buildLensMessages(article, editorInstruction),
                        response_format: buildJsonSchemaResponseFormat('lens_recommendation', buildLensSchema())
                })
        });

        if (!response.ok) {
                throw new Error(`Lens refresh failed with HTTP ${response.status}.`);
        }

        const payload = (await response.json()) as {
                choices?: Array<{ message?: { content?: unknown } }>;
        };
        const rawText = extractTextContent(payload.choices?.[0]?.message?.content);

        if (!rawText) {
                return normalizeLensResult(article, {}, editorInstruction);
        }

        const sanitized = sanitizeJsonCandidate(extractJsonCandidate(rawText));
        const parsed = JSON.parse(sanitized) as LensCompletionResult | LensCompletionResult[];
        const normalized = Array.isArray(parsed) ? (parsed[0] ?? {}) : parsed;

        return normalizeLensResult(article, normalized, editorInstruction);
}
