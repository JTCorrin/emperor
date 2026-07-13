<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import ConnectionStatusBar from '$lib/components/ui/ConnectionStatusBar.svelte';
	import { ConnectionController } from '$lib/state/connection.svelte';
	import { setConnection } from '$lib/state/context';

	let { children } = $props();

	const connection = new ConnectionController();
	setConnection(connection);

	onMount(() => {
		const restored = connection.restore();
		if (restored) {
			void connection.recheck();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Emperor</title>
</svelte:head>

<div
	class="text-text flex min-h-dvh flex-col pt-[var(--spacing-safe-top)] pr-[var(--spacing-safe-right)] pb-[var(--spacing-safe-bottom)] pl-[var(--spacing-safe-left)]"
>
	<header class="border-border bg-surface/90 sticky top-0 z-10 border-b backdrop-blur">
		<div class="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
			<a href={resolve('/')} class="text-2xl font-semibold tracking-tight">Emperor</a>
			<a
				href={resolve('/connect')}
				class="border-border bg-surface-muted hover:border-accent min-h-touch inline-flex items-center rounded-card border px-4 text-base font-medium"
			>
				Server
			</a>
		</div>
		<ConnectionStatusBar {connection} />
	</header>

	<main class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
		{@render children()}
	</main>
</div>
