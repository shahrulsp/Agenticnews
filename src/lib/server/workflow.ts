import { env } from '$env/dynamic/private';

export type ReviewSignalStatus = 'approved' | 'rejected';
export type WorkflowSignalOutcome = 'sent' | 'skipped' | 'failed';

export interface ReviewSignalInput {
	agentRunId: string | null;
	articleSlug: string;
	status: ReviewSignalStatus;
	reason?: string | null;
}

export interface WorkflowSignalResult {
	outcome: WorkflowSignalOutcome;
	message?: string;
}

type WorkflowSignalOptions = {
	fetchImpl?: typeof fetch;
	apiKey?: string | undefined;
	signalName?: string | undefined;
};

export async function sendWorkflowReviewSignal(
	input: ReviewSignalInput,
	options: WorkflowSignalOptions = {}
): Promise<WorkflowSignalResult> {
	if (!input.agentRunId) {
		return {
			outcome: 'skipped',
			message: 'No workflow execution ID was stored for this article.'
		};
	}

	const apiKey = options.apiKey ?? env.MISTRAL_API_KEY;
	const signalName = options.signalName ?? env.MISTRAL_SIGNAL_NAME ?? 'human_approval';

	if (!apiKey) {
		return {
			outcome: 'skipped',
			message: 'Workflow signaling is not configured because MISTRAL_API_KEY is missing.'
		};
	}

	const fetchImpl = options.fetchImpl ?? fetch;

	try {
		const response = await fetchImpl(
			`https://api.mistral.ai/v1/workflows/executions/${input.agentRunId}/signals`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: signalName,
					input: {
						article_slug: input.articleSlug,
						status: input.status,
						...(input.reason ? { reason: input.reason } : {})
					}
				})
			}
		);

		if (!response.ok) {
			const responseBody =
				typeof response.text === 'function' ? (await response.text()).trim() : '';
			const responseDetail = responseBody
				? ` ${responseBody.replace(/\s+/g, ' ').slice(0, 200)}`
				: '';

			return {
				outcome: 'failed',
				message: `Workflow callback failed with status ${response.status}.${responseDetail}`
			};
		}

		return { outcome: 'sent' };
	} catch (error) {
		return {
			outcome: 'failed',
			message: error instanceof Error ? error.message : 'Workflow callback failed.'
		};
	}
}
