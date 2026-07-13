<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import CompactPlayer from '$lib/components/player/CompactPlayer.svelte';
	import NowPlayingOverlay from '$lib/components/player/NowPlayingOverlay.svelte';
	import ConnectionStatusBar from '$lib/components/ui/ConnectionStatusBar.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import TabBar from '$lib/components/ui/TabBar.svelte';
	import { ConnectionController } from '$lib/state/connection.svelte';
	import { setConnection, setPlayer } from '$lib/state/context';
	import { PlayerController } from '$lib/state/player.svelte';

	let { children } = $props();

	const connection = new ConnectionController();
	const player = new PlayerController({
		getBaseUrl: () => connection.baseUrl
	});
	setConnection(connection);
	setPlayer(player);

	let audioEl: HTMLAudioElement | undefined = $state();

	onMount(() => {
		const restored = connection.restore();
		if (restored) {
			void connection.recheck();
		}
	});

	$effect(() => {
		if (audioEl) {
			player.attachAudio(audioEl);
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
		<div class="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
			<a href={resolve('/')} class="shrink-0 text-2xl font-semibold tracking-tight">Emperor</a>
			<SearchField />
			<a
				href={resolve('/connect')}
				class="border-border bg-surface-muted hover:border-accent min-h-touch inline-flex shrink-0 items-center rounded-card border px-4 text-base font-medium"
			>
				Server
			</a>
		</div>
		<ConnectionStatusBar {connection} />
	</header>

	<main class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
		{@render children()}
	</main>

	<audio bind:this={audioEl} preload="metadata" class="hidden"></audio>
	<CompactPlayer {player} baseUrl={connection.baseUrl} />
	<NowPlayingOverlay {player} baseUrl={connection.baseUrl} />
	<div class="sticky bottom-0 z-10">
		<TabBar />
	</div>
</div>
