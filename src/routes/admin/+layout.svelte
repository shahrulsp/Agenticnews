<script lang="ts">
	let { data, children } = $props();
</script>

<svelte:head>
	<title>Admin | Agenticnews</title>
</svelte:head>

<div class="admin-shell">
	<header class="admin-header">
		<div>
			<p class="eyebrow">Agenticnews</p>
			<h1>Admin</h1>
		</div>

		{#if data.authenticated}
			<form method="POST" action="/admin/logout">
				<button type="submit" class="logout-button">Log out</button>
			</form>
		{/if}
	</header>

	<main class="admin-content">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, sans-serif;
		background: #f8fafc;
		color: #0f172a;
	}

	.admin-shell {
		min-height: 100vh;
	}

	.admin-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid #e2e8f0;
		background: #ffffff;
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #475569;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.admin-content {
                width: 100%;
                max-width: none;
                margin: 0;
                padding: 1.5rem;
                box-sizing: border-box;
                overflow-x: clip;
	}

	.logout-button {
		border: 1px solid #cbd5e1;
		border-radius: 999px;
		background: #ffffff;
		color: #0f172a;
		padding: 0.7rem 1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.logout-button:hover {
		border-color: #94a3b8;
	}

        @media (max-width: 720px) {
                .admin-header {
                        padding: 1rem;
                }

                .admin-content {
                        padding: 1rem;
                }
        }
</style>
