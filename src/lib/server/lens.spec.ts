import { describe, expect, it, vi } from 'vitest';

import type { Article } from '$lib/types';

import { generateLensImageForArticle } from './lens';

function buildArticle(): Article {
        return {
                id: 'article-1',
                slug: 'taiwan-upset-final',
                status: 'pending',
                category: 'sports',
                region: 'taiwan',
                hype_level: 'medium',
                ai_generated: true,
                agent_run_id: 'run-1',
                tags: ['sports'],
                source_url: 'https://example.com/story',
                source_name: 'Example Sports Desk',
                source_date: '2026-09-06',
                factcheck_verdict: 'partially-verified',
                factcheck_confidence: 76,
                factcheck_summary: '<p>Result confirmed, side details still under review.</p>',
                title_ms: 'Final mengejut cetus perbualan',
                body_ms: '<p>Isi BM</p>',
                reality_check_ms: '<p>Semak butiran rasmi.</p>',
                takeaway_ms: '<p>Perlawanan ini menjadi bualan serantau.</p>',
                prompt_question_ms: '<p>Apa makna keputusan ini?</p>',
                title_en: 'Upset final sparks debate',
                body_en: '<p>English body</p>',
                reality_check_en: '<p>Check details</p>',
                takeaway_en: '<p>This result matters.</p>',
                prompt_question_en: '<p>What changes now?</p>',
                image_url: null,
                image_alt: null,
                image_caption: null,
                summary: 'Underdog victory becomes the talking point across the region.',
                why_viral: 'The unexpected result is dominating timelines.',
                key_claims: ['The underdog won in straight sets.'],
                claims_made: ['The underdog had never won this title before.'],
                secondary_sources: ['https://example.com/analysis'],
                sensitivity_notes: 'Avoid overstating crowd incidents until verified.',
                is_sensitive: false,
                scout_payload: {
                        title: 'Crowds pack arena for upset final'
                },
                sentinel_payload: {
                        verdict: 'partially-verified'
                },
                lens_payload: null,
                polyglot_payload: null,
                glossary_notes: null,
                quality_notes: 'Trim the unsupported crowd-size estimate.',
                image_strategy: null,
                image_source_recommendation: null,
                image_notes_for_human: null,
                created_at: '2026-09-06T00:00:00.000Z',
                updated_at: '2026-09-06T00:00:00.000Z',
                published_at: null,
                form: 'deep'
        };
}

describe('generateLensImageForArticle', () => {
        it('parses structured Lens output into stored image fields', async () => {
                const fetchImpl = vi.fn().mockResolvedValue({
                        ok: true,
                        json: async () => ({
                                choices: [
                                        {
                                                message: {
                                                        content: JSON.stringify({
                                                                image_strategy: 'Use a dramatic courtside celebration frame.',
                                                                image_source_recommendation:
                                                                        'Generate a photorealistic editorial hero image.',
                                                                image_notes_for_human:
                                                                        'Keep the arena signage generic and avoid brand logos.',
                                                                image_prompt:
                                                                        'photorealistic editorial sports arena, champion celebrating after upset final, documentary photography, natural light, no text, no watermark',
                                                                image_alt:
                                                                        'Champion celebrating after an upset final in Taiwan',
                                                                image_caption:
                                                                        'AI-generated editorial illustration of a post-match celebration.'
                                                        })
                                                }
                                        }
                                ]
                        })
                }) as typeof fetch;

                const result = await generateLensImageForArticle(buildArticle(), {
                        apiKey: 'test-key',
                        fetchImpl,
                        editorInstruction: 'Use a stronger sense of crowd atmosphere.'
                });

                expect(fetchImpl).toHaveBeenCalledOnce();
                expect(result.image_url).toContain('coresg-normal.trae.ai/api/ide/v1/text_to_image');
                expect(result.image_alt).toBe('Champion celebrating after an upset final in Taiwan');
                expect(result.image_caption).toBe(
                        'AI-generated editorial illustration of a post-match celebration.'
                );
                expect(result.image_strategy).toBe('Use a dramatic courtside celebration frame.');
                expect(result.lens_payload).toMatchObject({
                        image_prompt:
                                'photorealistic editorial sports arena, champion celebrating after upset final, documentary photography, natural light, no text, no watermark',
                        editor_instruction: 'Use a stronger sense of crowd atmosphere.',
                        refreshed_from_admin: true
                });
        });

        it('falls back to a generated prompt when Lens returns no structured content', async () => {
                const fetchImpl = vi.fn().mockResolvedValue({
                        ok: true,
                        json: async () => ({
                                choices: [{ message: { content: '' } }]
                        })
                }) as typeof fetch;

                const result = await generateLensImageForArticle(buildArticle(), {
                        apiKey: 'test-key',
                        fetchImpl
                });

                expect(result.image_url).toContain('image_size=landscape_16_9');
                expect(result.image_alt).toContain('illustration for Agenticnews');
                expect(result.lens_payload).toMatchObject({
                        refreshed_from_admin: true
                });
        });
});
