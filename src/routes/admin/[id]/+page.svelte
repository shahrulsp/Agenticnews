<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

        const LAST_OPENED_DRAFT_KEY = 'agenticnews:last-opened-draft';
        const EDITOR_FORM_ID = 'editorial-draft-form';

        type EditorialFormState = {
                reviewError?: string;
                editorValues?: {
                        title_ms: string;
                        body_ms: string;
                        title_en: string;
                        body_en: string;
                        source_name: string;
                        source_url: string;
                        source_date: string;
                        factcheck_verdict: string;
                        factcheck_confidence: string;
                        factcheck_summary: string;
                };
                imageValues?: {
                        image_direction: string;
                };
        };

        const factCheckOptions = [
                { value: 'verified', label: 'Verified' },
                { value: 'mostly-true', label: 'Mostly True' },
                { value: 'disputed', label: 'Disputed' },
                { value: 'unverifiable', label: 'Unverifiable' },
                { value: 'false', label: 'False' },
                { value: 'pending', label: 'Pending' }
        ] as const;

        let { data, form }: { data: PageData; form: EditorialFormState | null | undefined } = $props();
        let approveForm = $state<HTMLFormElement | null>(null);
        let rejectForm = $state<HTMLFormElement | null>(null);

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

        function buildEditorialCue(
                factcheckVerdict: string,
                factcheckConfidence: number,
                hypeLevel: string
        ): string {
                if (factcheckVerdict === 'pending' || factcheckConfidence < 50) {
                        return 'Verification is still thin. Treat this as a cautious draft and tighten sourcing before publication.';
                }

                if (hypeLevel === 'high' || hypeLevel === 'extreme') {
                        return 'This story has a stronger urgency profile. Check tone, framing, and headline restraint before pushing it live.';
                }

                return 'This draft looks structurally ready for a calm editorial pass. Focus on source clarity, precision, and final polish.';
        }

        function batchProgressPercent(total: number | undefined, reviewed: number): number {
                if (!total) {
                        return 0;
                }

                return Math.round((reviewed / total) * 100);
        }

        function navigateToPendingDraft(id: string | null | undefined): void {
                if (!id || typeof window === 'undefined') {
                        return;
                }

                window.location.assign(resolve('/admin/[id]', { id }));
        }

        function handleKeydown(event: KeyboardEvent): void {
                const target = event.target;

                if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.altKey ||
                        target instanceof HTMLInputElement ||
                        target instanceof HTMLTextAreaElement ||
                        (target instanceof HTMLElement && target.isContentEditable)
                ) {
                        return;
                }

                const key = event.key.toLowerCase();

                if (key === 'a') {
                        event.preventDefault();
                        approveForm?.requestSubmit();
                        return;
                }

                if (key === 'r') {
                        event.preventDefault();
                        rejectForm?.requestSubmit();
                        return;
                }

                if (key === 's') {
                        event.preventDefault();
                        const editorForm = document.getElementById(EDITOR_FORM_ID);

                        if (editorForm instanceof HTMLFormElement) {
                                editorForm.requestSubmit();
                        }

                        return;
                }

                if (key === 'j') {
                        event.preventDefault();
                        navigateToPendingDraft(data.navigator?.nextId);
                        return;
                }

                if (key === 'k') {
                        event.preventDefault();
                        navigateToPendingDraft(data.navigator?.previousId);
                }
        }

        $effect(() => {
                if (typeof window === 'undefined' || !data.article) {
                        return;
                }

                window.localStorage.setItem(
                        LAST_OPENED_DRAFT_KEY,
                        JSON.stringify({
                                id: data.article.id,
                                title: data.article.title_ms,
                                category: data.article.category,
                                updatedAt: data.article.updated_at
                        })
                );
        });
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="detail-page">
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

                <div class="masthead-card">
                        <div class="masthead-copy">
                                <a class="back-link" href={resolve('/admin')}>Back to morning queue</a>
                                <p class="eyebrow">Editorial workstation</p>
                                <h1>Review draft</h1>
                                <p class="masthead-note">
                                        Make the publishing call here, then head back to the queue for the next story in the batch.
                                </p>
			</div>
                        <div class="masthead-side">
                                <div class="masthead-chips">
                                        <span class="chip neutral-chip">{formatLabel(article.category)}</span>
                                        <span class="chip neutral-chip">{formatLabel(article.region)}</span>
                                        <span class="chip priority-chip">{formatLabel(article.hype_level)} priority</span>
                                </div>

                                {#if data.navigator}
                                        <div class="queue-nav-card">
                                                <p class="label">Queue position</p>
                                                <p class="queue-position">
                                                        Draft {data.navigator.position} of {data.navigator.total}
                                                </p>
                                                <div class="queue-nav-actions">
                                                        {#if data.navigator.previousId}
                                                                <a class="queue-link" href={resolve('/admin/[id]', { id: data.navigator.previousId })}>
                                                                        Newer draft
                                                                        <span class="shortcut-hint">K</span>
                                                                </a>
                                                        {/if}

                                                        {#if data.navigator.nextId}
                                                                <a class="queue-link" href={resolve('/admin/[id]', { id: data.navigator.nextId })}>
                                                                        Older draft
                                                                        <span class="shortcut-hint">J</span>
                                                                </a>
                                                        {/if}
                                                </div>
                                        </div>
                                {/if}
                        </div>
                </div>

                <div class="hero-grid">
                        <div class="hero-card">
                                <div class="hero-copy">
                                        <p class="kicker">{formatLabel(article.category)} desk · {formatLabel(article.region)}</p>
                                        <h2>{article.title_ms}</h2>
                                        {#if article.title_en}
                                                <p class="subtitle">{article.title_en}</p>
                                        {/if}
                                        <p class="editorial-cue">
                                                {buildEditorialCue(
                                                        article.factcheck_verdict,
                                                        article.factcheck_confidence,
                                                        article.hype_level
                                                )}
                                        </p>
                                </div>

                                <div class="meta-grid">
                                        <div class="meta-stat">
                                                <span class="meta-label">Fact check</span>
                                                <p>{formatLabel(article.factcheck_verdict)} ({article.factcheck_confidence}%)</p>
                                        </div>
                                        <div class="meta-stat">
                                                <span class="meta-label">Source</span>
                                                <p>{article.source_name ?? 'Unknown source'}</p>
                                        </div>
                                        <div class="meta-stat">
                                                <span class="meta-label">Created</span>
                                                <p>{formatDate(article.created_at)}</p>
                                        </div>
                                        <div class="meta-stat">
                                                <span class="meta-label">Slug</span>
                                                <p>{article.slug}</p>
                                        </div>
				</div>
			</div>

                        <aside class="action-panel">
                                <div class="action-copy-block">
                                        <p class="label">Editorial action</p>
                                        <p class="action-copy">
                                                Save your copy, source context, and fact-check notes here before making the publish call. Approve when framing, sourcing, and verification all feel ready.
                                        </p>
                                </div>

                                <div class="action-buttons">
                                        <button class="tertiary-button" type="submit" form={EDITOR_FORM_ID}>
                                                Save editorial draft
                                                <span class="button-hint">S</span>
                                        </button>

                                        <form bind:this={approveForm} method="POST" action="?/approve">
                                                <button class="primary-button" type="submit">
                                                        Approve and publish
                                                        <span class="button-hint">A</span>
                                                </button>
                                        </form>

                                        <form bind:this={rejectForm} method="POST" action="?/reject">
                                                <button class="secondary-button" type="submit">
                                                        Reject draft
                                                        <span class="button-hint">R</span>
                                                </button>
                                        </form>
                                </div>

                                <div class="review-snapshot">
                                        {#if data.batchProgress}
                                                {@const reviewed = data.batchProgress.published + data.batchProgress.rejected}
                                                <div>
                                                        <span class="meta-label">Morning run progress</span>
                                                        <p>
                                                                {reviewed}/{data.batchProgress.total} reviewed for {data.batchProgress.scheduledDate}
                                                                ({batchProgressPercent(data.batchProgress.total, reviewed)}%)
                                                        </p>
                                                        <p class="snapshot-note">
                                                                {data.batchProgress.pending} still waiting in the queue.
                                                        </p>
                                                </div>
                                        {/if}
                                        <div>
                                                <span class="meta-label">Keyboard flow</span>
                                                <p>`S` save, `A` approve, `R` reject, `J` older, `K` newer</p>
                                        </div>
                                        <div>
                                                <span class="meta-label">Workflow execution</span>
                                                <p>{article.agent_run_id ?? 'No workflow execution ID stored'}</p>
                                        </div>
                                        <div>
                                                <span class="meta-label">Source URL</span>
                                                {#if article.source_url}
                                                        <a class="resource-link" href={article.source_url} target="_blank" rel="noreferrer">
                                                                Open source reference
                                                        </a>
                                                {:else}
                                                        <p>No source URL set</p>
                                                {/if}
                                        </div>
                                </div>

                                {#if data.batchProgress}
                                        {@const reviewed = data.batchProgress.published + data.batchProgress.rejected}
                                        <div class="mini-progress">
                                                <div class="mini-progress-bar" aria-hidden="true">
                                                        <span
                                                                class="mini-progress-fill"
                                                                style={`width: ${batchProgressPercent(data.batchProgress.total, reviewed)}%`}
                                                        ></span>
                                                </div>
                                                <div class="mini-progress-foot">
                                                        <span>Published {data.batchProgress.published}</span>
                                                        <span>Rejected {data.batchProgress.rejected}</span>
                                                        <span>Remaining {data.batchProgress.pending}</span>
                                                </div>
                                        </div>
                                {/if}
                        </aside>
                </div>

		{#if form?.reviewError}
			<div class="message-card error-card">
				<p class="label">Review action failed</p>
				<p class="value">{form.reviewError}</p>
			</div>
		{/if}

                {#if data.reviewState === 'saved'}
                        <div class="message-card success-card">
                                <p class="label">Draft saved</p>
                                <p class="value">Your editorial edits are now stored on this pending draft.</p>
                        </div>
                {/if}

                {#if data.reviewState === 'image-refreshed'}
                        <div class="message-card success-card">
                                <p class="label">Image refreshed</p>
                                <p class="value">Lens generated a fresh image package for this pending draft.</p>
                        </div>
                {/if}

                <form id={EDITOR_FORM_ID} class="content-grid editor-grid" method="POST" action="?/save">
			<section class="content-card">
                                <div class="section-header">
                                        <div>
                                                <h3>Malay draft editor</h3>
                                                <p class="helper-text">Primary newsroom copy for review and last-mile polish.</p>
                                        </div>
                                        <span class="section-badge">BM</span>
                                </div>
                                <div class="editor-form">
                                        <label class="field-group">
                                                <span class="field-label">Malay headline</span>
                                                <input
                                                        class="editor-input"
                                                        name="title_ms"
                                                        type="text"
                                                        value={form?.editorValues?.title_ms ?? article.title_ms}
                                                        required
                                                />
                                        </label>

                                        <label class="field-group">
                                                <span class="field-label">Malay body</span>
                                                <textarea
                                                        class="editor-textarea"
                                                        name="body_ms"
                                                        rows="16"
                                                        required
                                                >{form?.editorValues?.body_ms ?? article.body_ms}</textarea>
                                        </label>

                                        <div class="editor-submit-row">
                                                <button class="tertiary-button inline-save-button" type="submit">
                                                        Save all editorial edits
                                                </button>
                                                <p class="helper-text">Rich text HTML is sanitized again when saved.</p>
                                        </div>
                                </div>
			</section>

			<section class="content-card">
                                <div class="section-header">
                                        <div>
                                                <h3>English draft editor</h3>
                                                <p class="helper-text">Supporting translation for bilingual publishing.</p>
                                        </div>
                                        <span class="section-badge">EN</span>
                                </div>
                                <div class="editor-form">
                                        <label class="field-group">
                                                <span class="field-label">English headline</span>
                                                <input
                                                        class="editor-input"
                                                        name="title_en"
                                                        type="text"
                                                        value={form?.editorValues?.title_en ?? article.title_en ?? ''}
                                                />
                                        </label>

                                        <label class="field-group">
                                                <span class="field-label">English body</span>
                                                <textarea
                                                        class="editor-textarea"
                                                        name="body_en"
                                                        rows="16"
                                                >{form?.editorValues?.body_en ?? article.body_en ?? ''}</textarea>
                                        </label>
                                        <p class="helper-text">
                                                Leave English blank if the desk only wants to publish the Malay version for now.
                                        </p>
                                </div>
			</section>

                        <section class="content-card">
                                <div class="section-header">
                                        <div>
                                                <h3>Source and verification editor</h3>
                                                <p class="helper-text">Tighten the original reporting context and desk note before publish.</p>
                                        </div>
                                        <span class="section-badge">Desk</span>
                                </div>
                                <div class="editor-form">
                                        <label class="field-group">
                                                <span class="field-label">Source name</span>
                                                <input
                                                        class="editor-input"
                                                        name="source_name"
                                                        type="text"
                                                        value={form?.editorValues?.source_name ?? article.source_name ?? ''}
                                                />
                                        </label>

                                        <label class="field-group">
                                                <span class="field-label">Source URL</span>
                                                <input
                                                        class="editor-input"
                                                        name="source_url"
                                                        type="url"
                                                        inputmode="url"
                                                        placeholder="https://example.com/story"
                                                        value={form?.editorValues?.source_url ?? article.source_url ?? ''}
                                                />
                                        </label>

                                        <label class="field-group">
                                                <span class="field-label">Source date</span>
                                                <input
                                                        class="editor-input"
                                                        name="source_date"
                                                        type="date"
                                                        value={form?.editorValues?.source_date ?? article.source_date ?? ''}
                                                />
                                        </label>

                                        <div class="verification-grid">
                                                <label class="field-group">
                                                        <span class="field-label">Fact-check verdict</span>
                                                        <select
                                                                class="editor-select"
                                                                name="factcheck_verdict"
                                                                value={form?.editorValues?.factcheck_verdict ?? article.factcheck_verdict}
                                                        >
                                                                {#each factCheckOptions as option}
                                                                        <option value={option.value}>{option.label}</option>
                                                                {/each}
                                                        </select>
                                                </label>

                                                <label class="field-group">
                                                        <span class="field-label">Confidence</span>
                                                        <input
                                                                class="editor-input"
                                                                name="factcheck_confidence"
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                step="1"
                                                                value={form?.editorValues?.factcheck_confidence ?? String(article.factcheck_confidence)}
                                                        />
                                                </label>
                                        </div>

                                        <label class="field-group">
                                                <span class="field-label">Fact-check summary</span>
                                                <textarea
                                                        class="editor-textarea compact-textarea"
                                                        name="factcheck_summary"
                                                        rows="8"
                                                >{form?.editorValues?.factcheck_summary ?? article.factcheck_summary ?? ''}</textarea>
                                        </label>
                                        <p class="helper-text">
                                                Keep this concise and evidence-led so the next editor can understand the verification posture quickly.
                                        </p>
                                </div>
                        </section>
                </form>

		<div class="content-grid">
			<section class="content-card">
                                <div class="section-header">
                                        <div>
                                                <h3>Editorial notes</h3>
                                                <p class="helper-text">Quick review prompts surfaced by the workflow output.</p>
                                        </div>
                                </div>
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
                                <div class="section-header">
                                        <div>
                                                <h3>Asset reference</h3>
                                                <p class="helper-text">Media pointers and Lens controls stay visible beside the editable draft fields.</p>
                                        </div>
                                </div>
				<dl class="notes">
                                        <div>
                                                <dt>Current image</dt>
                                                <dd>
                                                        {#if article.image_url}
                                                                <div class="asset-preview-stack">
                                                                        <img
                                                                                class="asset-preview"
                                                                                src={article.image_url}
                                                                                alt={article.image_alt ?? article.title_ms}
                                                                                loading="lazy"
                                                                        />
                                                                        <div class="asset-copy">
                                                                                <a class="resource-link" href={article.image_url} target="_blank" rel="noreferrer">
                                                                                        Open image asset
                                                                                </a>
                                                                                <p>{article.image_alt ?? 'No alt text saved yet'}</p>
                                                                                {#if article.image_caption}
                                                                                        <p>{article.image_caption}</p>
                                                                                {/if}
                                                                        </div>
                                                                </div>
                                                        {:else}
                                                                No image set
                                                        {/if}
                                                </dd>
                                        </div>
					<div>
                                                <dt>Lens strategy</dt>
                                                <dd>{article.image_strategy ?? 'Lens has not stored a strategy yet.'}</dd>
                                        </div>
                                        <div>
                                                <dt>Lens source recommendation</dt>
                                                <dd>{article.image_source_recommendation ?? 'No source recommendation saved yet.'}</dd>
                                        </div>
                                        <div>
                                                <dt>Lens notes</dt>
                                                <dd>{article.image_notes_for_human ?? 'No desk note from Lens yet.'}</dd>
					</div>
					<div>
                                                <dt>Stored source</dt>
                                                <dd>
                                                        {#if article.source_name || article.source_url || article.source_date}
                                                                <div class="source-reference-stack">
                                                                        <p>{article.source_name ?? 'Unknown source'}</p>
                                                                        {#if article.source_url}
                                                                                <a class="resource-link" href={article.source_url} target="_blank" rel="noreferrer">
                                                                                        Open source reference
                                                                                </a>
                                                                        {/if}
                                                                        {#if article.source_date}
                                                                                <p>Dated {article.source_date}</p>
                                                                        {/if}
                                                                </div>
                                                        {:else}
                                                                No source context saved yet
                                                        {/if}
                                                </dd>
					</div>
					<div>
						<dt>Workflow execution</dt>
						<dd>{article.agent_run_id ?? 'No workflow execution ID stored'}</dd>
					</div>
				</dl>
                                <form class="editor-form lens-refresh-form" method="POST" action="?/refreshImage">
                                        <label class="field-group">
                                                <span class="field-label">Replacement brief for Lens</span>
                                                <textarea
                                                        class="editor-textarea compact-textarea lens-direction-textarea"
                                                        name="image_direction"
                                                        rows="6"
                                                        placeholder="Example: keep the same story angle but avoid crowd chaos, use a cleaner courtside celebration shot."
                                                >{form?.imageValues?.image_direction ?? ''}</textarea>
                                        </label>
                                        <div class="editor-submit-row">
                                                <button class="tertiary-button inline-save-button" type="submit">
                                                        Ask Lens to regenerate image
                                                </button>
                                                <p class="helper-text">
                                                        Leave the note blank for a fresh default image, or describe how you want Lens to replace the current one.
                                                </p>
                                        </div>
                                </form>
			</section>
		</div>
	{/if}
</section>

<style>
	.detail-page {
		display: grid;
                gap: 1.1rem;
	}

        .masthead-card,
        .action-panel,
	.hero-card,
	.content-card,
	.message-card {
		border: 1px solid #dbe4f0;
                border-radius: 1.1rem;
                background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.97)),
                        #ffffff;
                padding: 1.3rem;
                box-shadow: 0 16px 36px rgba(15, 23, 42, 0.07);
	}

	.error-card {
		border-color: #fecaca;
		background: #fff7f7;
	}

        .success-card {
                border-color: #bbf7d0;
                background: #f0fdf4;
        }

        .masthead-card,
        .hero-grid,
        .section-header,
        .masthead-chips,
        .masthead-side,
        .queue-nav-actions {
                display: flex;
		gap: 1rem;
        }

        .masthead-card,
        .hero-grid {
                justify-content: space-between;
		align-items: center;
        }

        .hero-grid {
                align-items: stretch;
        }

        .hero-card {
                flex: 1 1 auto;
        }

        .action-panel {
                display: grid;
                gap: 1rem;
                align-content: start;
                width: min(22rem, 100%);
                position: sticky;
                top: 1rem;
	}

        .masthead-copy,
        .hero-copy,
        .action-copy-block {
                display: grid;
                gap: 0.45rem;
        }

        .masthead-side {
                flex-direction: column;
                align-items: flex-end;
        }

        .masthead-note,
        .action-copy,
        .editorial-cue,
        .snapshot-note {
                color: #475569;
                line-height: 1.65;
        }

        .editorial-cue {
                max-width: 52rem;
                font-size: 0.98rem;
        }

	.kicker,
        .eyebrow,
	.subtitle,
        .masthead-note,
	h2,
        h1,
	h3,
	p,
	dt,
	dd {
		margin: 0;
	}

	.kicker,
        .eyebrow,
	.label,
	.meta-label,
	dt {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
	}

        .back-link {
                width: fit-content;
                color: #334155;
                text-decoration: none;
                font-weight: 700;
        }

        h1 {
                font-size: clamp(1.8rem, 3.5vw, 2.4rem);
                line-height: 1.05;
                color: #0f172a;
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

        .masthead-chips {
                flex-wrap: wrap;
                justify-content: flex-end;
                align-items: flex-start;
        }

        .queue-nav-card {
                display: grid;
                gap: 0.55rem;
                min-width: 15rem;
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 1rem;
                background: rgba(248, 250, 252, 0.86);
                padding: 0.95rem 1rem;
        }

        .queue-position {
                font-weight: 700;
                color: #0f172a;
        }

        .queue-nav-actions {
                flex-wrap: wrap;
        }

        .queue-link {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.45rem;
                border-radius: 999px;
                border: 1px solid #cbd5e1;
                background: #ffffff;
                padding: 0.45rem 0.8rem;
                color: #0f172a;
                font-size: 0.84rem;
                font-weight: 700;
                text-decoration: none;
                transition:
                        transform 160ms ease,
                        border-color 160ms ease,
                        box-shadow 160ms ease;
        }

        .queue-link:hover {
                transform: translateY(-1px);
                border-color: #94a3b8;
                box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
        }

        .shortcut-hint,
        .button-hint {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 1.6rem;
                height: 1.6rem;
                border-radius: 999px;
                font-size: 0.74rem;
                font-weight: 800;
                letter-spacing: 0.04em;
                text-transform: uppercase;
        }

        .shortcut-hint {
                background: #e2e8f0;
                color: #0f172a;
        }

        .chip,
        .section-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                padding: 0.42rem 0.8rem;
                font-size: 0.78rem;
                font-weight: 800;
                letter-spacing: 0.04em;
                text-transform: uppercase;
        }

        .neutral-chip {
                background: #e2e8f0;
                color: #334155;
        }

        .priority-chip {
                background: #fef3c7;
                color: #92400e;
        }

	.value {
		margin-top: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: #0f172a;
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

        .meta-stat,
        .review-snapshot div {
                display: grid;
                gap: 0.22rem;
                padding-top: 0.85rem;
                border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .meta-stat p,
        .review-snapshot p {
                color: #0f172a;
                overflow-wrap: anywhere;
        }

	.content-grid {
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
	}

        .editor-grid {
                align-items: start;
        }

	.action-buttons {
		display: flex;
                flex-direction: column;
		gap: 0.75rem;
	}

        .action-buttons form {
                display: grid;
        }

        .primary-button,
        .secondary-button,
        .tertiary-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.55rem;
		border-radius: 999px;
                padding: 0.9rem 1.15rem;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
                transition:
                        transform 160ms ease,
                        box-shadow 160ms ease,
                        border-color 160ms ease;
	}

	.primary-button {
		border: none;
		background: #0f172a;
		color: #ffffff;
                box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
	}

        .primary-button .button-hint {
                background: rgba(255, 255, 255, 0.14);
                color: #ffffff;
        }

	.secondary-button {
		border: 1px solid #cbd5e1;
		background: #ffffff;
		color: #0f172a;
	}

        .tertiary-button {
                border: 1px solid #cbd5e1;
                background: #f8fafc;
                color: #0f172a;
        }

        .secondary-button .button-hint {
                background: #e2e8f0;
                color: #0f172a;
        }

        .tertiary-button .button-hint {
                background: #e2e8f0;
                color: #0f172a;
        }

        .primary-button:hover,
        .secondary-button:hover,
        .tertiary-button:hover {
                transform: translateY(-1px);
        }

	.helper-text {
		margin-top: 0.6rem;
		font-size: 0.92rem;
		color: #64748b;
	}

        .section-header {
                align-items: flex-start;
                justify-content: space-between;
        }

        .section-badge {
                background: #eef2ff;
                color: #4338ca;
        }

        .editor-form,
        .field-group {
                display: grid;
                gap: 0.7rem;
	}

        .editor-form {
                margin-top: 1rem;
	}

        .field-label {
                font-size: 0.8rem;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #64748b;
        }

        .editor-input,
        .editor-select,
        .editor-textarea {
                width: 100%;
                border: 1px solid #cbd5e1;
                border-radius: 0.9rem;
                background: #ffffff;
                padding: 0.85rem 0.95rem;
                font: inherit;
                color: #0f172a;
                box-sizing: border-box;
        }

        .editor-select {
                appearance: none;
                background-image:
                        linear-gradient(45deg, transparent 50%, #64748b 50%),
                        linear-gradient(135deg, #64748b 50%, transparent 50%);
                background-position:
                        calc(100% - 1.1rem) calc(50% - 0.12rem),
                        calc(100% - 0.8rem) calc(50% - 0.12rem);
                background-size: 0.35rem 0.35rem, 0.35rem 0.35rem;
                background-repeat: no-repeat;
                padding-right: 2.2rem;
        }

        .editor-textarea {
                resize: vertical;
                line-height: 1.65;
                min-height: 16rem;
        }

        .compact-textarea {
                min-height: 10rem;
        }

        .editor-input:focus,
        .editor-select:focus,
        .editor-textarea:focus {
                outline: none;
                border-color: #6366f1;
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }

        .verification-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.8rem;
        }

        .editor-submit-row {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.8rem;
	}

        .review-snapshot {
                display: grid;
                gap: 0.8rem;
        }

        .mini-progress {
                display: grid;
                gap: 0.7rem;
        }

        .mini-progress-bar {
                overflow: hidden;
                min-height: 0.72rem;
                border-radius: 999px;
                background: #e2e8f0;
        }

        .mini-progress-fill {
                display: block;
                height: 0.72rem;
                border-radius: 999px;
                background: linear-gradient(90deg, #0f766e, #6366f1);
        }

        .mini-progress-foot {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem 0.9rem;
                color: #475569;
                font-size: 0.88rem;
                font-weight: 600;
        }

	.rich-note :global(p),
        .rich-note :global(p + p),
	.rich-note :global(ul),
        .rich-note :global(ol),
        .rich-note :global(blockquote),
        .rich-note :global(pre),
        .rich-note :global(h2),
        .rich-note :global(h3) {
                margin-top: 1rem;
        }

        .rich-note :global(p),
        .rich-note :global(ul),
        .rich-note :global(ol) {
                margin-bottom: 0;
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

	dd,
	.meta-grid p {
		color: #334155;
	}

        .resource-link {
                color: #0f172a;
                font-weight: 600;
                text-decoration-color: rgba(15, 23, 42, 0.28);
                text-underline-offset: 0.16rem;
                overflow-wrap: anywhere;
        }

        .source-reference-stack {
                display: grid;
                gap: 0.35rem;
        }

        .asset-preview-stack,
        .asset-copy {
                display: grid;
                gap: 0.75rem;
        }

        .asset-preview {
                width: 100%;
                max-width: 24rem;
                border-radius: 1rem;
                border: 1px solid rgba(148, 163, 184, 0.24);
                background: #e2e8f0;
                box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
                object-fit: cover;
        }

        .lens-refresh-form {
                margin-top: 1.3rem;
                padding-top: 1rem;
                border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .lens-direction-textarea {
                min-height: 8.5rem;
        }

        @media (max-width: 920px) {
                .masthead-card,
                .hero-grid {
                        flex-direction: column;
                        align-items: stretch;
                }

                .action-panel {
                        width: 100%;
                        position: static;
                }

                 .masthead-side {
                        align-items: flex-start;
                }
        }

        @media (max-width: 720px) {
                .masthead-chips,
                .section-header {
                        justify-content: flex-start;
                }

                .section-header {
                        flex-direction: column;
                }

                .action-buttons form,
                .primary-button,
                .secondary-button,
                .tertiary-button,
                .inline-save-button {
                        width: 100%;
                }

                .editor-submit-row {
                        align-items: stretch;
                }

                .verification-grid {
                        grid-template-columns: 1fr;
                }
	}
</style>
