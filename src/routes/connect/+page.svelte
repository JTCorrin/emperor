<script lang="ts">
	import { resolve } from '$app/paths';
	import ConnectForm from '$lib/features/connect/ConnectForm.svelte';
	import { DEFAULT_DEV_BASE_URL } from '$lib/config';
	import { getConnection } from '$lib/state/context';

	const connection = getConnection();
	const initialBaseUrl = $derived(connection.baseUrl ?? DEFAULT_DEV_BASE_URL);
</script>

<section class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Connect</h1>
		<p class="text-text-muted max-w-2xl text-lg">
			Enter the base URL of a trusted-LAN media-server. Development default:
			<code class="text-text">{DEFAULT_DEV_BASE_URL}</code>
		</p>
	</div>

	{#key initialBaseUrl}
		<ConnectForm {initialBaseUrl} />
	{/key}

	{#if connection.status === 'connected'}
		<p class="text-success text-lg" role="status">
			Connected to {connection.baseUrl}. You can return to
			<a class="text-accent-strong underline" href={resolve('/')}>Home</a>.
		</p>
	{/if}
</section>
