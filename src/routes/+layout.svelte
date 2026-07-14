<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import CompactPlayer from '$lib/components/player/CompactPlayer.svelte';
	import NowPlayingOverlay from '$lib/components/player/NowPlayingOverlay.svelte';
	import OfflineBanner from '$lib/components/ui/OfflineBanner.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import TabBar from '$lib/components/ui/TabBar.svelte';
	import { getMediaServerBaseUrl } from '$lib/config';
	import { FavouritesController } from '$lib/features/favourites/favourites.svelte';
	import { ConnectionController } from '$lib/state/connection.svelte';
	import { setConnection, setFavourites, setPlayer } from '$lib/state/context';
	import { PlayerController } from '$lib/state/player.svelte';

	let { children } = $props();

	const connection = new ConnectionController();
	const player = new PlayerController({
		getBaseUrl: () => connection.baseUrl
	});
	const favourites = new FavouritesController({
		getBaseUrl: () => connection.baseUrl,
		getHasUserDb: () => connection.hasUserDb
	});
	setConnection(connection);
	setPlayer(player);
	setFavourites(favourites);

	onMount(() => {
		void connection.connect(getMediaServerBaseUrl());
	});

	onDestroy(() => {
		favourites.dispose();
		player.dispose();
	});

	function attachAudio(audio: HTMLAudioElement) {
		player.attachAudio(audio);
	}

	function loadFavouritesEffect() {
		const hasUserDb = connection.hasUserDb;
		if (hasUserDb === true) {
			untrack(() => {
				void favourites.load();
			});
		}
	}

	$effect(loadFavouritesEffect);
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
		</div>
		<TabBar />
		<OfflineBanner {connection} />
	</header>

	<main
		class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6 sm:px-6"
		style="padding-bottom: calc(var(--spacing-player-height) + var(--spacing-safe-bottom) + 1.5rem)"
	>
		{@render children()}
	</main>

	<audio {@attach attachAudio} preload="metadata" class="hidden"></audio>
	<NowPlayingOverlay {player} baseUrl={connection.baseUrl} />
	<div
		class="fixed inset-x-0 bottom-0 z-10 pr-[var(--spacing-safe-right)] pb-[var(--spacing-safe-bottom)] pl-[var(--spacing-safe-left)]"
	>
		<CompactPlayer
			{player}
			baseUrl={connection.baseUrl}
			{favourites}
			hasUserDb={connection.hasUserDb}
		/>
	</div>
</div>
