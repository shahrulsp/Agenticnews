<script lang="ts">
	import { resolve } from '$app/paths';
	import { localizeArticle } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function stripHtml(value: string | null | undefined): string | null {
		if (!value) {
			return null;
		}

		return value
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

        function formatDate(value: string | null, locale: 'ms' | 'en'): string {
		if (!value) {
                        return locale === 'ms' ? 'Tarikh tidak diketahui' : 'Unknown date';
		}

                return new Intl.DateTimeFormat(locale === 'ms' ? 'ms-MY' : 'en-MY', {
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function formatLabel(value: string): string {
		return value
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function getImageAlt(
		imageAlt: string | null | undefined,
		fallbackTitle: string | null | undefined
	): string {
		return imageAlt?.trim() || fallbackTitle?.trim() || 'Article image';
	}

        function getUnknownSource(locale: 'ms' | 'en'): string {
                return locale === 'ms' ? 'Sumber tidak dinyatakan' : 'Unknown source';
        }
</script>

<svelte:head>
	{#if data.article}
		{@const view = localizeArticle(data.article, data.locale)}
		<title>{view.title} | Agenticnews</title>
		<meta name="description" content={stripHtml(view.takeaway) ?? view.title} />
	{:else}
                <title>{data.locale === 'ms' ? 'Artikel' : 'Article'} | Agenticnews</title>
	{/if}
</svelte:head>

<section class="article-page">
	<a class="back-link" href={resolve(`/?lang=${data.locale}`)}>
                {data.locale === 'ms' ? 'Kembali ke meja utama' : 'Back to homepage'}
	</a>

	{#if !data.databaseReady}
		<div class="message-card">
                        <p class="label">{data.locale === 'ms' ? 'Tetapan pangkalan data diperlukan' : 'Database setup needed'}</p>
			<p class="value">
                                {data.locale === 'ms'
                                        ? 'Tambahkan `NEON_DATABASE_URL` ke fail `.env` tempatan sebelum memuatkan halaman artikel.'
                                        : 'Add `NEON_DATABASE_URL` to your local `.env` before loading article detail.'}
			</p>
		</div>
	{:else if data.databaseError}
		<div class="message-card error-card">
                        <p class="label">{data.locale === 'ms' ? 'Masalah sambungan pangkalan data' : 'Database connection issue'}</p>
			<p class="value">{data.databaseError}</p>
		</div>
	{:else if data.article}
		{@const article = data.article}
		{@const view = localizeArticle(article, data.locale)}

		<div class="article-hero">
			<div class="hero-topline">
                                <p class="kicker">{formatLabel(article.category)} · {formatLabel(article.region)}</p>

				<div class="locale-switch">
					<a class:active={data.locale === 'ms'} href={resolve(`/article/${article.slug}?lang=ms`)}
						>BM</a
					>
					<a class:active={data.locale === 'en'} href={resolve(`/article/${article.slug}?lang=en`)}
						>EN</a
					>
				</div>
			</div>

			<div class="hero-copy">
				<h1>{view.title}</h1>
				<p class="lede">
					{stripHtml(view.takeaway) ??
                                                (data.locale === 'ms' ? 'Ringkasan editorial belum tersedia.' : 'Editorial summary not yet available.')}
				</p>
			</div>

			{#if article.image_url}
				<figure class="hero-figure">
					<img
						class="hero-image"
						src={article.image_url}
						alt={getImageAlt(article.image_alt, view.title)}
						loading="eager"
					/>
					{#if article.image_caption}
						<figcaption>{article.image_caption}</figcaption>
					{/if}
				</figure>
			{/if}

			<div class="hero-meta-strip">
				<div class="hero-stat">
                                                <span class="meta-label">{data.locale === 'ms' ? 'Disiarkan' : 'Published'}</span>
                                                <strong>{formatDate(article.published_at ?? article.created_at, data.locale)}</strong>
				</div>
				<div class="hero-stat">
                                                <span class="meta-label">{data.locale === 'ms' ? 'Status semakan' : 'Fact-check status'}</span>
					<strong>{formatLabel(article.factcheck_verdict)}</strong>
				</div>
				<div class="hero-stat">
                                                <span class="meta-label">{data.locale === 'ms' ? 'Sumber laporan' : 'Reporting source'}</span>
                                                <strong>{article.source_name ?? getUnknownSource(data.locale)}</strong>
				</div>
			</div>
		</div>

		<div class="meta-card">
			<div class="meta-panel">
                                <span class="meta-label">{data.locale === 'ms' ? 'Waktu terbitan penuh' : 'Full timestamp'}</span>
                                <p>{formatDate(article.published_at ?? article.created_at, data.locale)}</p>
			</div>
			<div class="meta-panel">
				<span class="meta-label">{data.locale === 'ms' ? 'Sumber' : 'Source'}</span>
                                <p>{article.source_name ?? getUnknownSource(data.locale)}</p>
			</div>
			<div class="meta-panel">
                                <span class="meta-label">{data.locale === 'ms' ? 'Semakan fakta' : 'Fact check'}</span>
				<p>{formatLabel(article.factcheck_verdict)} ({article.factcheck_confidence}%)</p>
			</div>
			<div class="meta-panel">
                                <span class="meta-label">{data.locale === 'ms' ? 'Tahap sensasi' : 'Hype level'}</span>
				<p>{formatLabel(article.hype_level)}</p>
			</div>
		</div>

		<section class="body-card">
                        <p class="section-eyebrow">{data.locale === 'ms' ? 'Laporan utama' : 'Main report'}</p>
                        <h2>{data.locale === 'ms' ? 'Liputan penuh' : 'Full report'}</h2>
			<p class="helper-text">
				{data.locale === 'ms'
                                        ? 'Kandungan ini telah dibersihkan di peringkat server sebelum dipaparkan.'
                                        : 'This content was sanitized on the server before rendering.'}
			</p>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="rich-content">{@html view.body}</div>
		</section>

		<div class="detail-grid">
			<section class="info-card">
				<p class="section-eyebrow">{data.locale === 'ms' ? 'Nota editorial' : 'Editorial note'}</p>
                                <h2>{data.locale === 'ms' ? 'Semakan realiti' : 'Reality check'}</h2>
				{#if view.reality_check}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="rich-content compact">{@html view.reality_check}</div>
				{:else}
                                        <p>{data.locale === 'ms' ? 'Belum ada nota editorial.' : 'No editorial note yet.'}</p>
				{/if}
			</section>

			<section class="info-card">
				<p class="section-eyebrow">
                                        {data.locale === 'ms' ? 'Sudut pembaca' : 'Audience prompt'}
				</p>
                                <h2>{data.locale === 'ms' ? 'Soalan untuk pembaca' : 'Reader prompt'}</h2>
				{#if view.prompt_question}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="rich-content compact">{@html view.prompt_question}</div>
				{:else}
                                        <p>{data.locale === 'ms' ? 'Belum ada soalan untuk pembaca.' : 'No reader prompt yet.'}</p>
				{/if}
			</section>

			<section class="info-card">
				<p class="section-eyebrow">{data.locale === 'ms' ? 'Fail cerita' : 'Story file'}</p>
                                <h2>{data.locale === 'ms' ? 'Butiran liputan' : 'Story details'}</h2>
				<div class="story-file">
					<div>
						<span class="meta-label">{data.locale === 'ms' ? 'Kategori' : 'Category'}</span>
						<p>{formatLabel(article.category)}</p>
					</div>
					<div>
						<span class="meta-label">{data.locale === 'ms' ? 'Wilayah' : 'Region'}</span>
						<p>{formatLabel(article.region)}</p>
					</div>
					{#if article.source_url}
						<div>
							<span class="meta-label"
								>{data.locale === 'ms' ? 'Pautan sumber' : 'Source link'}</span
							>
							<p>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a class="source-link" href={article.source_url} rel="noreferrer" target="_blank">
									{data.locale === 'ms' ? 'Buka sumber asal' : 'Open original source'}
								</a>
							</p>
						</div>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</section>

<style>
	.article-page {
		max-width: 64rem;
		margin: 0 auto;
		padding: 2rem;
		display: grid;
		gap: 1.15rem;
	}

	.back-link {
		width: fit-content;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 1rem;
		border: 1px solid #dbe4f0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		color: #334155;
		text-decoration: none;
		font-weight: 600;
		box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
	}

	.article-hero,
	.meta-card,
	.body-card,
	.info-card,
	.message-card {
		border: 1px solid #dbe4f0;
		border-radius: 1rem;
		background: #ffffff;
		padding: 1.25rem;
		box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
	}

	.article-hero {
		display: grid;
		gap: 1.5rem;
		padding: 1.5rem;
		background:
			radial-gradient(circle at top left, rgba(148, 163, 184, 0.14), transparent 35%),
			linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98)), #ffffff;
	}

	.hero-figure {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	.hero-image {
		display: block;
		width: 100%;
		height: clamp(240px, 34vw, 460px);
		object-fit: cover;
		border-radius: 1.1rem;
		border: 1px solid #dbe4f0;
		background: #e2e8f0;
		box-shadow: 0 18px 45px rgba(15, 23, 42, 0.09);
	}

	.hero-figure figcaption {
		font-size: 0.92rem;
		color: #475569;
		line-height: 1.6;
	}

	.error-card {
		border-color: #fecaca;
		background: #fff7f7;
	}

	.hero-topline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.hero-copy {
		display: grid;
		gap: 0.75rem;
		max-width: 48rem;
	}

	.kicker,
	.label,
	.meta-label,
	.section-eyebrow {
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #64748b;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2.2rem, 5vw, 3.5rem);
		line-height: 1.05;
		color: #0f172a;
		text-wrap: balance;
	}

	.lede,
	.value,
	.meta-card p,
	.info-card p {
		color: #334155;
		line-height: 1.7;
	}

	.locale-switch {
		display: inline-flex;
		padding: 0.25rem;
		border: 1px solid #cbd5e1;
		border-radius: 999px;
		background: #ffffff;
		width: fit-content;
	}

	.locale-switch a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.75rem 1rem;
		color: #334155;
		text-decoration: none;
		font-weight: 700;
	}

	.locale-switch a.active {
		background: #0f172a;
		color: #ffffff;
	}

	.hero-meta-strip,
	.meta-card,
	.detail-grid {
		display: grid;
		gap: 1rem;
	}

	.hero-meta-strip {
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	}

	.hero-stat,
	.meta-panel {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		border-radius: 0.85rem;
		background: rgba(248, 250, 252, 0.9);
		border: 1px solid #e2e8f0;
	}

	.hero-stat strong,
	.meta-panel p {
		color: #0f172a;
		font-weight: 600;
	}

	.meta-card {
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	.section-eyebrow {
		margin-bottom: 0.45rem;
	}

	.helper-text {
		margin-top: 0.65rem;
		font-size: 0.92rem;
		color: #64748b;
	}

	.rich-content {
		margin-top: 1rem;
		font-size: 1rem;
		color: #1e293b;
	}

	.rich-content.compact {
		margin-top: 0.75rem;
	}

	.rich-content :global(p + p),
	.rich-content :global(ul),
	.rich-content :global(ol),
	.rich-content :global(blockquote),
	.rich-content :global(pre),
	.rich-content :global(h2),
	.rich-content :global(h3) {
		margin-top: 1rem;
	}

	.rich-content :global(pre) {
		overflow-x: auto;
		border-radius: 0.75rem;
		background: #f8fafc;
		padding: 1rem;
	}

	.rich-content :global(blockquote) {
		margin-left: 0;
		padding-left: 1rem;
		border-left: 4px solid #cbd5e1;
		color: #475569;
	}

	.detail-grid {
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
	}

	.story-file {
		display: grid;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	.source-link {
		color: #0f172a;
		font-weight: 700;
		text-decoration-thickness: 0.08em;
		text-underline-offset: 0.16em;
	}

	@media (max-width: 640px) {
		.article-page {
			padding: 1rem;
		}

		.hero-topline {
			align-items: flex-start;
		}
	}
</style>
