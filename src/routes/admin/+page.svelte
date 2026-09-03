<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(value: string | null): string {
		if (!value) {
			return 'Unknown time';
		}

		return new Intl.DateTimeFormat('en-MY', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function formatLabel(value: string): string {
		return value
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}
</script>

<section class="panel">
	<div class="header-copy">
                <p class="eyebrow">Editorial desk</p>
                <h2>Pending stories</h2>
                <p>Review incoming drafts, check their workflow signals, and decide what goes live next.</p>
	</div>

	{#if data.reviewStatus}
		<div class="status-card success-card">
                        <p class="label">Review updated</p>
			<p class="value">
				{data.reviewStatus === 'approved'
                                        ? 'The story was approved and moved to the published desk.'
                                        : 'The story was rejected and cleared from the pending desk.'}
			</p>
			{#if data.workflowStatus === 'sent'}
                                <p class="note">Workflow resume signal sent successfully.</p>
			{:else if data.workflowStatus === 'skipped'}
				<p class="note">
					{data.workflowMessage ??
                                                'Workflow signal was skipped because this story has no stored Mistral execution ID, or `MISTRAL_API_KEY` is not configured yet.'}
				</p>
			{:else if data.workflowStatus === 'failed'}
				<p class="note warning-note">
					{data.workflowMessage ??
                                                'The story status changed, but the workflow callback failed and may need a retry.'}
				</p>
			{/if}

			<div class="status-footer">
				<span
                                        >{data.reviewStatus === 'approved' ? 'Published desk updated' : 'Pending desk updated'}</span
				>
				<span>
					{data.workflowStatus === 'sent'
						? 'Workflow resumed'
						: data.workflowStatus === 'failed'
							? 'Workflow retry may be needed'
							: data.workflowStatus === 'skipped'
								? 'Workflow step skipped'
								: 'No workflow update'}
				</span>
			</div>
		</div>
	{/if}

	{#if !data.databaseReady}
		<div class="status-card">
                        <p class="label">Database setup needed</p>
                        <p class="value">Add `NEON_DATABASE_URL` to your local `.env` to load the pending review desk.</p>
		</div>
	{:else if data.databaseError}
		<div class="status-card error-card">
                        <p class="label">Database connection issue</p>
			<p class="value">{data.databaseError}</p>
		</div>
	{:else if data.articles.length === 0}
		<div class="status-card">
                        <p class="label">Desk is clear</p>
                        <p class="value">No pending stories are waiting for review right now.</p>
		</div>
	{:else}
		<div class="list">
			{#each data.articles as article (article.id)}
				<a class="article-card" href={resolve('/admin/[id]', { id: article.id })}>
					<div class="card-topline">
						<p class="category">{formatLabel(article.category)}</p>
						<div class="card-chips">
							<span class="chip verdict-chip">{formatLabel(article.factcheck_verdict)}</span>
							<span class="chip neutral-chip">{formatLabel(article.region)}</span>
						</div>
					</div>

					<div class="card-header">
						<div class="title-block">
							<h3>{article.title_ms}</h3>
							{#if article.title_en}
								<p class="subtitle">{article.title_en}</p>
							{/if}
						</div>
                                                <span class="badge">{formatLabel(article.hype_level)} signal</span>
					</div>

					<div class="meta">
						<div class="meta-block">
							<span class="meta-label">Source</span>
							<strong>{article.source_name ?? 'Unknown source'}</strong>
						</div>
						<div class="meta-block">
                                                        <span class="meta-label">Received</span>
							<strong>{formatDate(article.created_at)}</strong>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</section>

<style>
	.panel {
		display: grid;
		gap: 1.25rem;
	}

	.header-copy {
		display: grid;
		gap: 0.5rem;
	}

	.eyebrow,
	.category,
	.label,
	.meta-label {
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
	}

	h2,
	p,
	h3 {
		margin: 0;
	}

	.status-card {
		border: 1px solid #dbe4f0;
		border-radius: 1.2rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96)), #ffffff;
		padding: 1.35rem;
		box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07);
	}

	.error-card {
		border-color: #fecaca;
		background: #fff7f7;
	}

	.success-card {
		border-color: #bbf7d0;
		background: #f0fdf4;
	}

	.value {
		margin-top: 0.5rem;
		font-size: 1.05rem;
		font-weight: 600;
		color: #0f172a;
	}

	.note {
		margin-top: 0.65rem;
		font-size: 0.95rem;
		color: #166534;
	}

	.warning-note {
		color: #9a3412;
	}

	.status-footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(148, 163, 184, 0.22);
		color: #475569;
		font-size: 0.88rem;
		font-weight: 600;
	}

	.list {
		display: grid;
		gap: 1rem;
	}

	.article-card {
		display: grid;
		gap: 1rem;
		border: 1px solid #dbe4f0;
		border-radius: 1.2rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98)), #ffffff;
		padding: 1.3rem;
		color: inherit;
		text-decoration: none;
		box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07);
		transition:
			transform 160ms ease,
			border-color 160ms ease,
			box-shadow 160ms ease;
	}

	.article-card:hover {
		transform: translateY(-3px);
		border-color: #94a3b8;
		box-shadow: 0 20px 45px rgba(15, 23, 42, 0.11);
	}

	.card-topline,
	.card-header {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		justify-content: space-between;
	}

	.card-chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.chip,
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.38rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.verdict-chip {
		background: #dcfce7;
		color: #166534;
	}

	.neutral-chip {
		background: #e2e8f0;
		color: #334155;
	}

	.title-block {
		display: grid;
		gap: 0.35rem;
		max-width: 42rem;
	}

	h3 {
		font-size: 1.18rem;
		line-height: 1.3;
		color: #0f172a;
		text-wrap: balance;
	}

	.subtitle {
		color: #475569;
		line-height: 1.55;
	}

	.badge {
		background: #fef3c7;
		color: #92400e;
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.85rem;
		padding-top: 0.25rem;
	}

	.meta-block {
		display: grid;
		gap: 0.2rem;
		padding-top: 0.85rem;
		border-top: 1px solid rgba(148, 163, 184, 0.16);
	}

	.meta-block strong {
		color: #0f172a;
		font-size: 0.96rem;
	}

	@media (max-width: 640px) {
		.card-topline,
		.card-header {
			flex-direction: column;
		}

		.card-chips {
			justify-content: flex-start;
		}

		.status-footer {
			flex-direction: column;
		}
	}
</style>
