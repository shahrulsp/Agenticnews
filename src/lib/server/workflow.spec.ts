import { describe, expect, it, vi } from 'vitest';

import { sendWorkflowReviewSignal } from './workflow';

describe('sendWorkflowReviewSignal', () => {
	it('sends the workflow signal when config and agent run ID are present', async () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

		const result = await sendWorkflowReviewSignal(
			{
				agentRunId: 'run-123',
				articleSlug: 'hello-world',
				status: 'approved'
			},
			{
				fetchImpl,
				apiKey: 'api-key',
				signalName: 'human_approval'
			}
		);

		expect(result).toEqual({ outcome: 'sent' });
		expect(fetchImpl).toHaveBeenCalledWith(
			'https://api.mistral.ai/v1/workflows/executions/run-123/signals',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer api-key'
				}),
				body: JSON.stringify({
					name: 'human_approval',
					input: {
						article_slug: 'hello-world',
						status: 'approved'
					}
				})
			})
		);
	});

	it('skips signaling when the article has no agent run ID', async () => {
		const result = await sendWorkflowReviewSignal({
			agentRunId: null,
			articleSlug: 'hello-world',
			status: 'approved'
		});

		expect(result.outcome).toBe('skipped');
	});

	it('skips signaling when API key config is missing', async () => {
		const result = await sendWorkflowReviewSignal(
			{
				agentRunId: 'run-123',
				articleSlug: 'hello-world',
				status: 'rejected'
			},
			{
				apiKey: ''
			}
		);

		expect(result.outcome).toBe('skipped');
	});

	it('returns a failed outcome when the callback response is not ok', async () => {
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: false,
			status: 502,
			text: vi.fn().mockResolvedValue('Temporary upstream outage')
		});

		const result = await sendWorkflowReviewSignal(
			{
				agentRunId: 'run-123',
				articleSlug: 'hello-world',
				status: 'rejected'
			},
			{
				fetchImpl,
				apiKey: 'api-key'
			}
		);

		expect(result.outcome).toBe('failed');
		expect(result.message).toContain('502');
		expect(result.message).toContain('Temporary upstream outage');
	});
});
