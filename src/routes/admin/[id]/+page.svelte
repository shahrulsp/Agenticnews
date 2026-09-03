<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: { reviewError?: string } | null | undefined } =
		$props();

	function formatDate(value: string | null): string {
		if (!value) {
			return 'Unknown time';
		}

		return new Intl.DateTimeFormat('en-MY', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<section class="detail-page">
	<a class="back-link" href={resolve('/admin')}>Back to pending review</a>

	{#if !data.databaseReady}
		<div class="message-card">
			<p class="label">Database setup needed</p>
			<p class="value">
				Add `NEON_DATABASE_URL` to your local `.env` before loading article detail.
			</p>
		</div>
	{:else if data.databaseError}
		<div class="message-card error-card">
			<p class="label">Database connection issue</p>
			<p class="value">{data.databaseError}</p>
		</div>
	{:else if data.article}
		{@const article = data.article}

		<div class="hero-card">
			<div class="hero-copy">
				<p class="kicker">{article.category} · {article.region}</p>
				<h2>{article.title_ms}</h2>
				{#if article.title_en}
					<p class="subtitle">{article.title_en}</p>
				{/if}
			</div>

			<div class="meta-grid">
				<div>
					<span class="meta-label">Fact check</span>
					<p>{article.factcheck_verdict} ({article.factcheck_confidence}%)</p>
				</div>
				<div>
					<span class="meta-label">Source</span>
					<p>{article.source_name ?? 'Unknown source'}</p>
				</div>
				<div>
					<span class="meta-label">Created</span>
					<p>{formatDate(article.created_at)}</p>
				</div>
				<div>
					<span class="meta-label">Hype</span>
					<p>{article.hype_level}</p>
				</div>
			</div>
		</div>

		<div class="action-bar">
			<div>
				<p class="label">Editorial action</p>
				<p class="action-copy">
					Publish this draft or reject it and remove it from the pending queue.
				</p>
			</div>

			<div class="action-buttons">
				<form method="POST" action="?/reject">
					<button class="secondary-button" type="submit">Reject draft</button>
				</form>

				<form method="POST" action="?/approve">
					<button class="primary-button" type="submit">Approve and publish</button>
				</form>
			</div>
		</div>

		{#if form?.reviewError}
			<div class="message-card error-card">
				<p class="label">Review action failed</p>
				<p class="value">{form.reviewError}</p>
			</div>
		{/if}

		<div class="content-grid">
			<section class="content-card">
				<h3>Malay draft</h3>
				<p class="helper-text">Sanitized HTML preview rendered from stored content.</p>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="rich-content">{@html article.body_ms}</div>
			</section>

			<section class="content-card">
				<h3>English draft</h3>
				{#if article.body_en}
					<p class="helper-text">Sanitized HTML preview rendered from stored content.</p>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="rich-content">{@html article.body_en}</div>
				{:else}
					<p class="muted">No English translation has been stored yet.</p>
				{/if}
			</section>
		</div>

		<div class="content-grid">
			<section class="content-card">
				<h3>Editorial notes</h3>
				<dl class="notes">
					<div>
						<dt>Reality check</dt>
						{#if article.reality_check_ms}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<dd class="rich-note">{@html article.reality_check_ms}</dd>
						{:else}
							<dd>None yet</dd>
						{/if}
					</div>
					<div>
						<dt>Takeaway</dt>
						{#if article.takeaway_ms}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<dd class="rich-note">{@html article.takeaway_ms}</dd>
						{:else}
							<dd>None yet</dd>
						{/if}
					</div>
					<div>
						<dt>Prompt question</dt>
						{#if article.prompt_question_ms}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<dd class="rich-note">{@html article.prompt_question_ms}</dd>
						{:else}
							<dd>None yet</dd>
						{/if}
					</div>
				</dl>
			</section>

			<section class="content-card">
				<h3>Asset and source</h3>
				<dl class="notes">
					<div>
						<dt>Image URL</dt>
						<dd>{article.image_url ?? 'No image set'}</dd>
					</div>
					<div>
						<dt>Source URL</dt>
						<dd>{article.source_url ?? 'No source URL set'}</dd>
					</div>
					<div>
						<dt>Workflow execution</dt>
						<dd>{article.agent_run_id ?? 'No workflow execution ID stored'}</dd>
					</div>
				</dl>
			</section>
		</div>
	{/if}
</section>

<style>
	.detail-page {
		display: grid;
		gap: 1rem;
	}

	.back-link {
		width: fit-content;
		color: #334155;
		text-decoration: none;
		font-weight: 600;
	}

	.action-bar,
	.hero-card,
	.content-card,
	.message-card {
		border: 1px solid #dbe4f0;
		border-radius: 1rem;
		background: #ffffff;
		padding: 1.25rem;
		box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
	}

	.error-card {
		border-color: #fecaca;
		background: #fff7f7;
	}

	.action-bar {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}

	.kicker,
	.subtitle,
	h2,
	h3,
	p,
	dt,
	dd {
		margin: 0;
	}

	.kicker,
	.label,
	.meta-label,
	dt {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
	}

	h2 {
		margin-top: 0.4rem;
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		line-height: 1.1;
		color: #0f172a;
	}

	.subtitle {
		margin-top: 0.65rem;
		font-size: 1.05rem;
		color: #475569;
	}

	.value {
		margin-top: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: #0f172a;
	}

	.action-copy {
		margin-top: 0.4rem;
		color: #475569;
	}

	.meta-grid,
	.content-grid {
		display: grid;
		gap: 1rem;
	}

	.meta-grid {
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		margin-top: 1.25rem;
	}

	.content-grid {
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
	}

	.action-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.primary-button,
	.secondary-button {
		border-radius: 999px;
		padding: 0.85rem 1.1rem;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.primary-button {
		border: none;
		background: #0f172a;
		color: #ffffff;
	}

	.secondary-button {
		border: 1px solid #cbd5e1;
		background: #ffffff;
		color: #0f172a;
	}

	.helper-text {
		margin-top: 0.6rem;
		font-size: 0.92rem;
		color: #64748b;
	}

	.rich-content {
		margin-top: 1rem;
		line-height: 1.6;
		color: #1e293b;
	}

	.rich-content :global(p + p),
	.rich-content :global(ul),
	.rich-content :global(ol),
	.rich-content :global(blockquote),
	.rich-content :global(pre),
	.rich-content :global(h2),
	.rich-content :global(h3),
	.rich-note :global(p + p) {
		margin-top: 1rem;
	}

	.rich-content :global(pre) {
		overflow-x: auto;
		border-radius: 0.75rem;
		background: #f8fafc;
		padding: 1rem;
	}

	.rich-note :global(p),
	.rich-note :global(ul),
	.rich-note :global(ol) {
		margin: 0;
	}

	.notes {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	.notes div {
		display: grid;
		gap: 0.35rem;
	}

	.muted,
	dd,
	.meta-grid p {
		color: #334155;
	}

	@media (max-width: 720px) {
		.action-bar {
			align-items: stretch;
			flex-direction: column;
		}

		.action-buttons {
			width: 100%;
		}

		.action-buttons form,
		.primary-button,
		.secondary-button {
			width: 100%;
		}
	}
</style>
