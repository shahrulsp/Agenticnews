import { describe, expect, it } from 'vitest';

import { isAuthorizedIngestRequest, parseDraftIngestPayload } from './ingest';

describe('isAuthorizedIngestRequest', () => {
	it('accepts a matching bearer token', () => {
		expect(isAuthorizedIngestRequest('Bearer secret-token', 'secret-token')).toBe(true);
	});

	it('rejects a missing or mismatched token', () => {
		expect(isAuthorizedIngestRequest(null, 'secret-token')).toBe(false);
		expect(isAuthorizedIngestRequest('Bearer wrong-token', 'secret-token')).toBe(false);
		expect(isAuthorizedIngestRequest('Basic abc123', 'secret-token')).toBe(false);
	});
});

describe('parseDraftIngestPayload', () => {
	it('maps the workflow payload shape into a draft insert input', () => {
		const parsed = parseDraftIngestPayload({
			article: {
				slug: 'hello-world',
				category: 'tech',
				region: 'global',
				hype_level: 'medium',
				agent_run_id: 'run-123',
				source_url: 'https://example.com/story',
				source_name: 'Example News',
				source_date: '2026-09-03',
				factcheck_verdict: 'verified',
				factcheck_confidence: 88,
				factcheck_summary: '<p>Checked</p>',
				tags: ['ai', 'daily'],
				ms: {
					title: 'Halo Dunia',
					body: '<p>Isi BM</p>',
					reality_check: '<p>Semakan</p>',
					takeaway: '<p>Pengajaran</p>',
					prompt_question: '<p>Soalan</p>'
				},
				en: {
					title: 'Hello World',
					body: '<p>English body</p>'
				},
				image_url: 'https://example.com/image.jpg',
				image_alt: 'A descriptive alt',
				image_caption: 'A caption'
			}
		});

		expect(parsed).toMatchObject({
			slug: 'hello-world',
			category: 'tech',
			region: 'global',
			hype_level: 'medium',
			title_ms: 'Halo Dunia',
			body_ms: '<p>Isi BM</p>',
			title_en: 'Hello World',
			body_en: '<p>English body</p>',
			tags: ['ai', 'daily']
		});
	});

	it('accepts workflow_execution_id as the preferred execution field', () => {
		const parsed = parseDraftIngestPayload({
			article: {
				slug: 'hello-world',
				category: 'tech',
				region: 'global',
				hype_level: 'medium',
				workflow_execution_id: 'wf-execution-123',
				ms: {
					title: 'Halo Dunia',
					body: '<p>Isi BM</p>'
				}
			}
		});

		expect(parsed.agent_run_id).toBe('wf-execution-123');
	});

        it('accepts the crime category for batch editorial drafts', () => {
                const parsed = parseDraftIngestPayload({
                        article: {
                                slug: 'city-crime-watch',
                                category: 'crime',
                                region: 'malaysia',
                                hype_level: 'high',
                                workflow_execution_id: 'wf-execution-999',
                                ms: {
                                        title: 'Bandar dalam perhatian',
                                        body: '<p>Draf jenayah pagi.</p>'
                                }
                        }
                });

                expect(parsed.category).toBe('crime');
                expect(parsed.region).toBe('malaysia');
        });

        it('accepts Studio taxonomy categories and regions', () => {
                const parsed = parseDraftIngestPayload({
                        article: {
                                slug: 'asia-sports-upset',
                                category: 'sports',
                                region: 'taiwan',
                                hype_level: 'medium',
                                factcheck_verdict: 'partially-verified',
                                ms: {
                                        title: 'Kejutan besar sukan Asia',
                                        body: '<p>Isi BM</p>'
                                }
                        }
                });

                expect(parsed.category).toBe('sports');
                expect(parsed.region).toBe('taiwan');
                expect(parsed.factcheck_verdict).toBe('partially-verified');
        });

        it('maps expanded Studio metadata fields', () => {
                const parsed = parseDraftIngestPayload({
                        article: {
                                slug: 'asia-viral-story',
                                category: 'politics',
                                region: 'bangladesh',
                                hype_level: 'low',
                                summary: 'Short story summary',
                                why_viral: 'People are debating the public impact',
                                key_claims: ['Claim A'],
                                claims_made: ['Claim A', 'Claim B'],
                                secondary_sources: ['https://example.com/2'],
                                is_sensitive: true,
                                form: 'deep',
                                sensitivity_notes: 'Election-related sensitivity',
                                quality_notes: 'Needs editor review on attribution',
                                image_strategy: 'Use a crowd scene with polling visuals',
                                image_source_recommendation: 'Getty editorial archive',
                                image_notes_for_human: 'Avoid showing minors',
                                glossary_notes: [
                                        {
                                                term: 'caretaker government',
                                                note: 'Explain briefly in Malay'
                                        }
                                ],
                                scout_payload: {
                                        trend_score: 91
                                },
                                sentinel_payload: {
                                        risk_level: 'medium'
                                },
                                lens_payload: {
                                        visual_angle: 'polling-station'
                                },
                                polyglot_payload: {
                                        translation_status: 'ready'
                                },
                                factcheck_verdict: 'unverified',
                                ms: {
                                        title: 'Tajuk BM',
                                        body: '<p>Isi BM</p>'
                                }
                        }
                });

                expect(parsed.summary).toBe('Short story summary');
                expect(parsed.why_viral).toBe('People are debating the public impact');
                expect(parsed.key_claims).toEqual(['Claim A']);
                expect(parsed.claims_made).toEqual(['Claim A', 'Claim B']);
                expect(parsed.secondary_sources).toEqual(['https://example.com/2']);
                expect(parsed.is_sensitive).toBe(true);
                expect(parsed.form).toBe('deep');
                expect(parsed.sensitivity_notes).toBe('Election-related sensitivity');
                expect(parsed.quality_notes).toBe('Needs editor review on attribution');
                expect(parsed.image_strategy).toBe('Use a crowd scene with polling visuals');
                expect(parsed.image_source_recommendation).toBe('Getty editorial archive');
                expect(parsed.image_notes_for_human).toBe('Avoid showing minors');
                expect(parsed.glossary_notes).toEqual([
                        {
                                term: 'caretaker government',
                                note: 'Explain briefly in Malay'
                        }
                ]);
                expect(parsed.scout_payload).toEqual({
                        trend_score: 91
                });
                expect(parsed.sentinel_payload).toEqual({
                        risk_level: 'medium'
                });
                expect(parsed.lens_payload).toEqual({
                        visual_angle: 'polling-station'
                });
                expect(parsed.polyglot_payload).toEqual({
                        translation_status: 'ready'
                });
                expect(parsed.factcheck_verdict).toBe('unverified');
        });

	it('throws when required workflow fields are missing', () => {
		expect(() =>
			parseDraftIngestPayload({
				article: {
					category: 'tech',
					region: 'global',
					hype_level: 'medium',
					ms: {
						title: 'Halo Dunia'
					}
				}
			})
		).toThrow('article.slug is required');
	});
});
