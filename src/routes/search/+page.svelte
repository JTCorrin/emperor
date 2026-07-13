<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import MediaGrid from '$lib/components/media/MediaGrid.svelte';
	import TrackRow from '$lib/components/media/TrackRow.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';
	import { SearchResultsController } from '$lib/features/search/searchResults.svelte';
	import { getConnection, getPlayer } from '$lib/state/context';

	const connection = getConnection();
	const player = getPlayer();
	const search = new SearchResultsController({
		getBaseUrl: () => connection.baseUrl
	});

	const urlQuery = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	let draft = $derived(page.url.searchParams.get('q') ?? '');

	onDestroy(() => search.dispose());

	$effect(() => {
		const next = draft;
		const current = urlQuery;
		const handle = setTimeout(() => {
			const trimmed = next.trim();
			if (trimmed === current) return;
			if (trimmed) {
				void goto(resolve(`/search?q=${encodeURIComponent(trimmed)}`), {
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
			} else {
				void goto(resolve('/search'), {
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
			}
		}, 300);
		return () => clearTimeout(handle);
	});

	$effect(() => {
		const q = urlQuery;
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		if (!connected) return;
		untrack(() => {
			void search.search(q);
		});
	});
</script>

<section class="flex flex-1 flex-col gap-8 pb-4">
	<div class="flex flex-col gap-4">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Search</h1>
		<label class="flex flex-col gap-2">
			<span class="text-base font-medium">Query</span>
			<input
				type="search"
				bind:value={draft}
				placeholder="Search tracks, artists, albums"
				class="border-border bg-surface-muted text-text placeholder:text-text-muted focus:border-accent min-h-touch w-full max-w-xl rounded-card border px-4 text-base"
			/>
		</label>
	</div>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">Connect to a media server to search the library.</p>
			<a
				href={resolve('/connect')}
				class="bg-accent text-text hover:bg-accent-strong mt-4 inline-flex min-h-touch items-center rounded-card px-5 text-base font-semibold"
			>
				Connect to a server
			</a>
		</div>
	{:else if !urlQuery}
		<p class="text-text-muted text-lg">Enter a query to search tracks, artists, and albums.</p>
	{:else}
		<p class="text-text-muted text-lg">Results for “{urlQuery}”</p>

		<section class="flex flex-col gap-3" aria-labelledby="search-tracks-heading">
			<h2 id="search-tracks-heading" class="text-2xl font-semibold">Tracks</h2>
			{#if search.state.tracks.status === 'loading'}
				<p class="text-text-muted" aria-busy="true">Searching tracks…</p>
			{:else if search.state.tracks.status === 'empty'}
				<StatusPanel message="No matching tracks." />
			{:else if search.state.tracks.status === 'error'}
				<StatusPanel
					title="Error"
					message={search.state.tracks.errorMessage ?? 'Search failed.'}
					tone="danger"
					onretry={() => search.search(urlQuery)}
				/>
			{:else if search.state.tracks.status === 'ready'}
				<ul class="flex flex-col gap-2">
					{#each search.state.tracks.items as track, index (track.id)}
						<li>
							<TrackRow
								title={track.title}
								subtitle={`${track.artist} · ${track.album}`}
								onclick={() => player.playTracks(search.state.tracks.items, index)}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-3" aria-labelledby="search-artists-heading">
			<h2 id="search-artists-heading" class="text-2xl font-semibold">Artists</h2>
			<MediaGrid
				status={search.state.artists.status === 'idle' ? 'loading' : search.state.artists.status}
				emptyMessage="No matching artists."
				errorMessage={search.state.artists.errorMessage ?? 'Search failed.'}
				onretry={() => search.search(urlQuery)}
			>
				{#each search.state.artists.items as artist (artist.id)}
					<MediaCard
						layout="grid"
						title={artist.name}
						subtitle={`${artist.album_count} albums`}
						baseUrl={connection.baseUrl}
						onclick={() => goto(resolve(`/artists/${artist.id}`))}
					/>
				{/each}
			</MediaGrid>
		</section>

		<section class="flex flex-col gap-3" aria-labelledby="search-albums-heading">
			<h2 id="search-albums-heading" class="text-2xl font-semibold">Albums</h2>
			<MediaGrid
				status={search.state.albums.status === 'idle' ? 'loading' : search.state.albums.status}
				emptyMessage="No matching albums."
				errorMessage={search.state.albums.errorMessage ?? 'Search failed.'}
				onretry={() => search.search(urlQuery)}
			>
				{#each search.state.albums.items as album (album.id)}
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
		</section>
	{/if}
</section>
