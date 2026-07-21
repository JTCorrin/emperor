<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.png';
	import CompactPlayer from '$lib/components/player/CompactPlayer.svelte';
	import OfflineBanner from '$lib/components/ui/OfflineBanner.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import TabBar from '$lib/components/ui/TabBar.svelte';
	import { getMediaServerBaseUrl } from '$lib/config';
	import { FavouritesController } from '$lib/features/favourites/favourites.svelte';
	import { AddToPlaylistController } from '$lib/features/playlists/addToPlaylist.svelte';
	import AddToPlaylistDialog from '$lib/features/playlists/AddToPlaylistDialog.svelte';
	import { recordNavPath } from '$lib/navigation/navTrail';
	import { ConnectionController } from '$lib/state/connection.svelte';
	import { setAddToPlaylist, setConnection, setFavourites, setPlayer } from '$lib/state/context';
	import {
		bindMediaSessionActions,
		clearMediaSession,
		syncMediaSession
	} from '$lib/state/mediaSession';
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
	const addToPlaylist = new AddToPlaylistController();
	let playerWrapperHeight = $state(0);
	setConnection(connection);
	setPlayer(player);
	setFavourites(favourites);
	setAddToPlaylist(addToPlaylist);

	const documentTitle = $derived.by(() => {
		const track = player.currentTrack;
		if (!track) return 'Emperor';
		const title = track.title || track.filename || 'Unknown title';
		const artist = track.artist || 'Unknown artist';
		return `${title} — ${artist} · Emperor`;
	});

	afterNavigate((navigation) => {
		const to = navigation.to;
		if (!to) return;
		recordNavPath(`${to.url.pathname}${to.url.search}`);
	});

	onMount(() => {
		void connection.connect(getMediaServerBaseUrl());
		bindMediaSessionActions({
			play: () => {
				void player.play();
			},
			pause: () => player.pause(),
			next: () => player.next(),
			previous: () => player.previous(),
			seek: (seconds) => player.seek(seconds),
			seekBy: (delta) => player.seek(player.position + delta)
		});
	});

	onDestroy(() => {
		clearMediaSession();
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

	function syncMediaSessionEffect() {
		const track = player.currentTrack;
		const baseUrl = connection.baseUrl;
		const playbackStatus = player.playbackStatus;
		const position = player.position;
		const duration = player.duration;
		syncMediaSession({ track, baseUrl, playbackStatus, position, duration });
	}

	function onVisibilityChange() {
		if (document.visibilityState === 'visible') {
			player.resumeIfNeeded();
		}
	}

	$effect(loadFavouritesEffect);
	$effect(syncMediaSessionEffect);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{documentTitle}</title>
</svelte:head>

<svelte:document onvisibilitychange={onVisibilityChange} />

<div
	class="text-text flex min-h-dvh flex-col pt-[var(--spacing-safe-top)] pr-[var(--spacing-safe-right)] pl-[var(--spacing-safe-left)]"
>
	<header class="border-border bg-surface/90 sticky top-0 z-10 border-b backdrop-blur">
		<div
			class="flex flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-4"
		>
			<a href={resolve('/')} class="max-w-48 shrink-0 self-start">
				<img src={logo} alt="Emperor" class="h-auto max-h-8 max-w-full object-contain" />
			</a>
			<SearchField />
		</div>
		<TabBar />
		<OfflineBanner {connection} />
	</header>

	<main
		class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6 sm:px-6"
		style:padding-bottom={`calc(${playerWrapperHeight}px + 1.5rem)`}
	>
		{@render children()}
	</main>

	<audio {@attach attachAudio} playsinline preload="metadata" class="hidden"></audio>
	<AddToPlaylistDialog track={addToPlaylist.track} onclose={() => addToPlaylist.close()} />
	<div
		class="fixed inset-x-0 bottom-0 z-10 pr-[var(--spacing-safe-right)] pb-[var(--spacing-safe-bottom)] pl-[var(--spacing-safe-left)]"
		bind:clientHeight={playerWrapperHeight}
	>
		<CompactPlayer
			{player}
			baseUrl={connection.baseUrl}
			{favourites}
			hasUserDb={connection.hasUserDb}
			onAddToPlaylist={connection.hasUserDb === true
				? () => {
						const track = player.currentTrack;
						if (track) addToPlaylist.open(track);
					}
				: undefined}
		/>
	</div>
</div>
