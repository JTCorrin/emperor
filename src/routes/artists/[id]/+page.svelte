<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import LoadMoreButton from '$lib/components/media/LoadMoreButton.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import MediaGrid from '$lib/components/media/MediaGrid.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';
	import {
		createMediaServerClient,
		MediaServerRequestError,
		type Album,
		type Artist
	} from '$lib/api';
	import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
	import { getConnection } from '$lib/state/context';

	const connection = getConnection();
	const artistId = $derived(Number(page.params.id));

	let artist = $state.raw<Artist | null>(null);
	let artistStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let artistError = $state<string | null>(null);
	let artistAbort: AbortController | null = null;
	let artistToken = 0;

	const albums = new PaginatedListController<Album>({
		getBaseUrl: () => connection.baseUrl,
		fetchPage: (client, query) => client.getArtistAlbums(artistId, query)
	});

	onDestroy(() => {
		artistAbort?.abort();
		albums.dispose();
	});

	async function loadArtist(id: number) {
		const baseUrl = connection.baseUrl;
		if (!baseUrl || !Number.isFinite(id) || id <= 0) {
			artist = null;
			artistStatus = 'error';
			artistError = 'Invalid artist.';
			return;
		}

		artistAbort?.abort();
		const abort = new AbortController();
		artistAbort = abort;
		const token = ++artistToken;
		artistStatus = 'loading';
		artistError = null;

		try {
			const client = createMediaServerClient({ baseUrl });
			const next = await client.getArtist(id, abort.signal);
			if (token !== artistToken) return;
			artist = next;
			artistStatus = 'ready';
		} catch (cause) {
			if (token !== artistToken) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') return;
			artist = null;
			artistStatus = 'error';
			if (cause instanceof MediaServerRequestError && cause.error.status === 404) {
				artistError = 'Artist not found.';
			} else {
				artistError = cause instanceof Error ? cause.message : 'Could not load artist.';
			}
		}
	}

	$effect(() => {
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		const id = artistId;
		if (!connected) return;
		untrack(() => {
			void loadArtist(id);
			void albums.load();
		});
	});
</script>

<section class="flex flex-1 flex-col gap-6 pb-4">
	<a
		href={resolve('/artists')}
		class="text-text-muted hover:text-text min-h-touch inline-flex w-fit items-center text-base font-medium"
	>
		Back to artists
	</a>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">Connect to a media server to open artists.</p>
			<a
				href={resolve('/connect')}
				class="bg-accent text-text hover:bg-accent-strong mt-4 inline-flex min-h-touch items-center rounded-card px-5 text-base font-semibold"
			>
				Connect to a server
			</a>
		</div>
	{:else if artistStatus === 'loading' || artistStatus === 'idle'}
		<p class="text-text-muted text-lg" aria-busy="true">Loading artist…</p>
	{:else if artistStatus === 'error'}
		<StatusPanel
			title="Error"
			message={artistError ?? 'Could not load artist.'}
			tone="danger"
			onretry={() => loadArtist(artistId)}
		/>
	{:else if artist}
		<div class="flex flex-col gap-2">
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{artist.name}</h1>
			<p class="text-text-muted text-lg">
				{artist.album_count} albums · {artist.track_count} tracks
			</p>
		</div>

		<MediaGrid
			status={albums.status}
			emptyMessage="No albums for this artist."
			errorMessage={albums.errorMessage ?? 'Could not load albums.'}
			onretry={() => albums.load()}
		>
			{#each albums.items as album (album.id)}
				<MediaCard
					layout="grid"
					title={album.name}
					subtitle={album.artist}
					coverId={album.cover_id}
					baseUrl={connection.baseUrl}
					onclick={() => goto(resolve(`/albums/${album.id}`))}
				/>
			{/each}
		</MediaGrid>
		{#if albums.status === 'ready'}
			<LoadMoreButton
				hasMore={albums.hasMore}
				loading={albums.loadingMore}
				onclick={() => albums.loadMore()}
			/>
		{/if}
	{/if}
</section>
