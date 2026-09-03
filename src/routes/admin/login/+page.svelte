<script lang="ts">
	let { form } = $props();
</script>

<svelte:head>
	<title>Admin Login | Agenticnews</title>
</svelte:head>

<section class="login-card">
	<div class="intro">
		<p class="eyebrow">Protected area</p>
		<h2>Sign in to review drafts</h2>
		<p>Use the admin password from your local environment file.</p>
	</div>

	<form method="POST" class="login-form">
		<label for="password">Admin password</label>
		<input id="password" name="password" type="password" required autocomplete="current-password" />
		<button type="submit">Log in</button>
	</form>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}
</section>

<style>
	.login-card {
		max-width: 28rem;
		margin: 10vh auto 0;
		border: 1px solid #dbe4f0;
		border-radius: 1rem;
		background: #ffffff;
		padding: 1.5rem;
		box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
	}

	.intro,
	.login-form {
		display: grid;
		gap: 0.75rem;
	}

	.intro p,
	.intro h2,
	.error {
		margin: 0;
	}

	.eyebrow {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #475569;
	}

	h2 {
		font-size: 1.5rem;
		color: #0f172a;
	}

	.login-form {
		margin-top: 1.25rem;
	}

	label {
		font-weight: 600;
		color: #334155;
	}

	input {
		border: 1px solid #cbd5e1;
		border-radius: 0.85rem;
		padding: 0.85rem 1rem;
		font: inherit;
	}

	button {
		border: none;
		border-radius: 999px;
		background: #0f172a;
		color: #ffffff;
		padding: 0.85rem 1rem;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.error {
		margin-top: 1rem;
		color: #b91c1c;
		font-weight: 600;
	}
</style>
