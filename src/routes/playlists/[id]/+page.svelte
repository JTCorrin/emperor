<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fromAction } from 'svelte/attachments';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import {
		createMediaServerClient,
		MediaServerRequestError,
		playlistNameBodySchema,
		type Playlist,
		type Track
	} from '$lib/api';
	import TrackRow from '$lib/components/media/TrackRow.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';
	import { loadAllPages } from '$lib/features/browse/loadAllPages';
	import { isFuzzySearchEligible, SEARCH_DEBOUNCE_MS } from '$lib/features/search/searchPolicy';
	import { getBackTarget, setNavTrailLabel } from '$lib/navigation/navTrail';
	import { getAddToPlaylist, getConnection, getFavourites, getPlayer } from '$lib/state/context';

	const connection = getConnection();
	const player = getPlayer();
	const favourites = getFavourites();
	const addToPlaylist = getAddToPlaylist();
	const playlistId = $derived(Number(page.params.id));
	const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
	const fallbackBack = { href: '/playlists', label: 'playlists' };
	let clientReady = $state(0);

	onMount(() => {
		clientReady = 1;
	});

	const backTarget = $derived.by(() => {
		void clientReady;
		return getBackTarget({
			fallbackHref: fallbackBack.href,
			fallbackLabel: fallbackBack.label,
			currentPath
		});
	});
	const backHref = $derived.by((): ResolvedPathname => {
		const href = backTarget.href;
		const q = href.indexOf('?');
		const pathname = (q >= 0 ? href.slice(0, q) : href) || '/';
		const search = q >= 0 ? href.slice(q) : '';
		return `${resolve(pathname as '/')}${search}` as ResolvedPathname;
	});

	let playlist = $state.raw<Playlist | null>(null);
	let tracks = $state.raw<Track[]>([]);
	let status = $state<'idle' | 'loading' | 'ready' | 'error' | 'unavailable'>('idle');
	let errorMessage = $state<string | null>(null);
	let editing = $state(false);
	let draftIds = $state.raw<number[]>([]);
	let draftTracks = $state.raw<Track[]>([]);
	let saving = $state(false);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let mutationError = $state<string | null>(null);
	let addQuery = $state('');
	let addResults = $state.raw<Track[]>([]);
	let addStatus = $state<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
	let loadAbort: AbortController | null = null;
	let loadToken = 0;
	let addTimer: ReturnType<typeof setTimeout> | null = null;
	let addAbort: AbortController | null = null;
	let addToken = 0;
	let draggedIndex = $state<number | null>(null);
	let dropTargetIndex = $state<number | null>(null);
	let reorderAnnouncement = $state('');

	const renameForm = superForm(defaults({ name: '' }, zod4(playlistNameBodySchema)), {
		SPA: true,
		validators: zod4(playlistNameBodySchema),
		resetForm: false,
		onUpdate: async ({ form: validated, cancel }) => {
			cancel();
			if (!validated.valid || !connection.baseUrl || !playlist) return;
			mutationError = null;
			try {
				const client = createMediaServerClient({ baseUrl: connection.baseUrl });
				playlist = await client.updatePlaylist(playlist.id, validated.data.name);
			} catch (cause) {
				mutationError = cause instanceof Error ? cause.message : 'Could not rename playlist.';
			}
		}
	});

	const {
		form: renameData,
		errors: renameErrors,
		enhance: renameEnhance,
		submitting: renameSubmitting
	} = renameForm;
	const renameAttachment = fromAction(renameEnhance);

	onDestroy(() => {
		loadAbort?.abort();
		addAbort?.abort();
		if (addTimer) clearTimeout(addTimer);
	});

	async function loadAll(id: number) {
		const baseUrl = connection.baseUrl;
		if (!baseUrl || !Number.isFinite(id) || id <= 0) {
			status = 'error';
			errorMessage = 'Invalid playlist.';
			return;
		}
		if (connection.hasUserDb === false) {
			status = 'unavailable';
			return;
		}

		loadAbort?.abort();
		const abort = new AbortController();
		loadAbort = abort;
		const token = ++loadToken;
		status = 'loading';
		errorMessage = null;
		mutationError = null;

		try {
			const client = createMediaServerClient({ baseUrl });
			const meta = await client.getPlaylist(id, abort.signal);
			const allTracks = await loadAllPages((offset) =>
				client.getPlaylistTracks(id, {
					limit: 200,
					offset,
					signal: abort.signal
				})
			);
			if (token !== loadToken) return;
			playlist = meta;
			tracks = allTracks;
			draftIds = allTracks.map((t) => t.id);
			draftTracks = allTracks;
			renameData.set({ name: meta.name });
			status = 'ready';
			editing = false;
			setNavTrailLabel(currentPath, meta.name);
		} catch (cause) {
			if (token !== loadToken) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'no_user_db') {
				status = 'unavailable';
				return;
			}
			status = 'error';
			if (cause instanceof MediaServerRequestError && cause.error.status === 404) {
				errorMessage = 'Playlist not found.';
			} else {
				errorMessage = cause instanceof Error ? cause.message : 'Could not load playlist.';
			}
		}
	}

	function startEdit() {
		draftIds = tracks.map((t) => t.id);
		draftTracks = [...tracks];
		editing = true;
		resetDragState();
		mutationError = null;
		addQuery = '';
		addResults = [];
		addStatus = 'idle';
	}

	function cancelEdit() {
		editing = false;
		draftIds = tracks.map((t) => t.id);
		draftTracks = [...tracks];
		resetDragState();
		mutationError = null;
		addQuery = '';
		addResults = [];
	}

	function removeDraftTrack(trackId: number) {
		draftIds = draftIds.filter((id) => id !== trackId);
		draftTracks = draftTracks.filter((t) => t.id !== trackId);
	}

	function addDraftTrack(track: Track) {
		if (draftIds.includes(track.id)) return;
		draftIds = [...draftIds, track.id];
		draftTracks = [...draftTracks, track];
	}

	function resetDragState() {
		draggedIndex = null;
		dropTargetIndex = null;
	}

	function moveDraftTrack(fromIndex: number, toIndex: number) {
		if (
			saving ||
			fromIndex === toIndex ||
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= draftTracks.length ||
			toIndex >= draftTracks.length
		) {
			return;
		}

		const reorderedTracks = [...draftTracks];
		const [movedTrack] = reorderedTracks.splice(fromIndex, 1);
		reorderedTracks.splice(toIndex, 0, movedTrack);
		draftTracks = reorderedTracks;
		draftIds = reorderedTracks.map((track) => track.id);
		reorderAnnouncement = `${movedTrack.title} moved to position ${toIndex + 1} of ${reorderedTracks.length}.`;
	}

	function handleDragStart(event: DragEvent, index: number) {
		if (saving) {
			event.preventDefault();
			return;
		}

		draggedIndex = index;
		dropTargetIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(draftTracks[index].id));
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		if (saving || draggedIndex === null) return;
		event.preventDefault();
		dropTargetIndex = index;
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(event: DragEvent, index: number) {
		event.preventDefault();
		if (draggedIndex !== null) moveDraftTrack(draggedIndex, index);
		resetDragState();
	}

	async function saveTracks() {
		if (!connection.baseUrl || !playlist || saving) return;
		saving = true;
		resetDragState();
		mutationError = null;
		try {
			const client = createMediaServerClient({ baseUrl: connection.baseUrl });
			await client.setPlaylistTracks(playlist.id, draftIds);
			await loadAll(playlist.id);
		} catch (cause) {
			mutationError = cause instanceof Error ? cause.message : 'Could not save playlist tracks.';
			if (playlist) await loadAll(playlist.id);
		} finally {
			saving = false;
		}
	}

	async function deletePlaylist() {
		if (!connection.baseUrl || !playlist || deleting) return;
		deleting = true;
		mutationError = null;
		try {
			const client = createMediaServerClient({ baseUrl: connection.baseUrl });
			await client.deletePlaylist(playlist.id);
			await goto(resolve('/playlists'));
		} catch (cause) {
			mutationError = cause instanceof Error ? cause.message : 'Could not delete playlist.';
			deleting = false;
		}
	}

	function scheduleAddSearch(query: string) {
		addQuery = query;
		if (addTimer) clearTimeout(addTimer);
		addTimer = setTimeout(() => {
			void runAddSearch(query.trim());
		}, SEARCH_DEBOUNCE_MS);
	}

	async function runAddSearch(q: string) {
		addAbort?.abort();
		const abort = new AbortController();
		addAbort = abort;
		const token = ++addToken;

		if (!connection.baseUrl || !q) {
			addResults = [];
			addStatus = 'idle';
			return;
		}

		if (!isFuzzySearchEligible(q)) {
			addResults = [];
			addStatus = 'idle';
			return;
		}

		addStatus = 'loading';
		try {
			const client = createMediaServerClient({ baseUrl: connection.baseUrl });
			const result = await client.search({ q, limit: 20, fuzzy: true, signal: abort.signal });
			if (token !== addToken) return;
			addResults = result.tracks.items;
			addStatus = result.tracks.items.length === 0 ? 'empty' : 'ready';
		} catch (cause) {
			if (token !== addToken) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') return;
			addStatus = 'error';
			addResults = [];
		}
	}

	function loadPlaylistWhenConnected() {
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		const id = playlistId;
		const hasUserDb = connection.hasUserDb;
		if (!connected) return;
		if (hasUserDb === false) {
			status = 'unavailable';
			return;
		}
		void loadAll(id);
	}
</script>

<section class="flex flex-1 flex-col gap-6 pb-4" {@attach loadPlaylistWhenConnected}>
	<a
		href={backHref}
		class="text-text-muted hover:text-text min-h-touch inline-flex w-fit items-center text-base font-medium"
	>
		Back to {backTarget.label}
	</a>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">Connect to a media server to open playlists.</p>
			<a
				href={resolve('/connect')}
				class="bg-accent text-text hover:bg-accent-strong mt-4 inline-flex min-h-touch items-center rounded-card px-5 text-base font-semibold"
			>
				Connect to a server
			</a>
		</div>
	{:else if status === 'unavailable'}
		<StatusPanel title="Unavailable" message="Playlists need a media-server user database." />
	{:else if status === 'loading' || status === 'idle'}
		<p class="text-text-muted text-lg" aria-busy="true">Loading playlist…</p>
	{:else if status === 'error'}
		<StatusPanel
			title="Error"
			message={errorMessage ?? 'Could not load playlist.'}
			tone="danger"
			onretry={() => loadAll(playlistId)}
		/>
	{:else if playlist}
		<div class="flex flex-col gap-4">
			{#if editing}
				<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{playlist.name}</h1>
			{:else}
				<form method="POST" {@attach renameAttachment} class="flex flex-wrap items-end gap-3">
					<div class="flex min-w-0 flex-1 flex-col gap-2">
						<label class="text-base font-medium" for="rename-playlist">Name</label>
						<input
							id="rename-playlist"
							name="name"
							type="text"
							bind:value={$renameData.name}
							class="border-border bg-surface-muted focus:border-accent min-h-touch w-full max-w-xl rounded-card border px-4 text-lg font-semibold"
						/>
						{#if $renameErrors.name?.[0]}
							<p class="text-danger text-base" role="alert">{$renameErrors.name[0]}</p>
						{/if}
					</div>
					<button
						type="submit"
						class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold disabled:opacity-60"
						disabled={$renameSubmitting}
					>
						{$renameSubmitting ? 'Saving…' : 'Rename'}
					</button>
				</form>
			{/if}

			<p class="text-text-muted text-lg">{playlist.track_count} tracks</p>

			<div class="flex flex-wrap gap-3">
				{#if tracks.length > 0 && !editing}
					<button
						type="button"
						class="bg-accent text-text hover:bg-accent-strong min-h-touch rounded-card px-5 text-base font-semibold"
						onclick={() => player.playTracks(tracks, 0)}
					>
						Play all
					</button>
				{/if}
				{#if !editing}
					<button
						type="button"
						class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold"
						onclick={startEdit}
					>
						Edit tracks
					</button>
					{#if !confirmDelete}
						<button
							type="button"
							class="border-border text-danger hover:border-danger min-h-touch rounded-card border px-5 text-base font-semibold"
							onclick={() => (confirmDelete = true)}
						>
							Delete
						</button>
					{:else}
						<button
							type="button"
							class="bg-danger text-text min-h-touch rounded-card px-5 text-base font-semibold disabled:opacity-60"
							disabled={deleting}
							onclick={() => deletePlaylist()}
						>
							{deleting ? 'Deleting…' : 'Confirm delete'}
						</button>
						<button
							type="button"
							class="border-border bg-surface-muted min-h-touch rounded-card border px-5 text-base font-semibold"
							disabled={deleting}
							onclick={() => (confirmDelete = false)}
						>
							Cancel
						</button>
					{/if}
				{:else}
					<button
						type="button"
						class="bg-accent text-text hover:bg-accent-strong min-h-touch rounded-card px-5 text-base font-semibold disabled:opacity-60"
						disabled={saving}
						onclick={() => saveTracks()}
					>
						{saving ? 'Saving…' : 'Save'}
					</button>
					<button
						type="button"
						class="border-border bg-surface-muted min-h-touch rounded-card border px-5 text-base font-semibold disabled:opacity-60"
						disabled={saving}
						onclick={cancelEdit}
					>
						Cancel
					</button>
				{/if}
			</div>

			{#if mutationError}
				<p class="text-danger text-base" role="alert">{mutationError}</p>
			{/if}
		</div>

		{#if editing}
			<div class="border-border bg-surface-raised flex flex-col gap-3 rounded-card border p-4">
				<label class="text-base font-medium" for="add-songs">Add songs</label>
				<input
					id="add-songs"
					type="search"
					value={addQuery}
					disabled={saving}
					oninput={(e) => scheduleAddSearch(e.currentTarget.value)}
					placeholder="Search tracks to add"
					class="border-border bg-surface-muted focus:border-accent min-h-touch w-full max-w-xl rounded-card border px-4 text-base disabled:opacity-60"
				/>
				{#if addStatus === 'loading'}
					<p class="text-text-muted" aria-busy="true">Searching…</p>
				{:else if addStatus === 'empty'}
					<p class="text-text-muted">No matching tracks.</p>
				{:else if addStatus === 'error'}
					<p class="text-danger" role="alert">Search failed.</p>
				{:else if addStatus === 'ready'}
					<ul class="flex flex-col gap-2">
						{#each addResults as track (track.id)}
							<li>
								<button
									type="button"
									class="border-border bg-surface-muted hover:border-accent min-h-touch w-full rounded-card border px-4 py-3 text-left disabled:opacity-50"
									disabled={draftIds.includes(track.id) || saving}
									onclick={() => addDraftTrack(track)}
								>
									<span class="block font-semibold">{track.title}</span>
									<span class="text-text-muted text-sm">{track.artist}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		{#if (editing ? draftTracks : tracks).length === 0}
			<StatusPanel message={editing ? 'No tracks in this draft.' : 'This playlist is empty.'} />
		{:else}
			<p class="sr-only" aria-live="polite">{reorderAnnouncement}</p>
			<ul class="flex flex-col gap-2">
				{#each editing ? draftTracks : tracks as track, index (track.id)}
					<li
						class={[
							'flex items-center gap-2 rounded-card border border-transparent transition',
							draggedIndex === index && 'opacity-50',
							dropTargetIndex === index &&
								draggedIndex !== index &&
								'border-accent bg-surface-raised'
						]}
						ondragover={(event) => handleDragOver(event, index)}
						ondrop={(event) => handleDrop(event, index)}
					>
						{#if editing}
							<button
								type="button"
								draggable={!saving}
								class="border-border bg-surface-muted hover:border-accent min-h-touch min-w-touch cursor-grab touch-none shrink-0 rounded-card border text-xl font-semibold active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60"
								disabled={saving}
								aria-label={`Drag to reorder ${track.title}`}
								title="Drag to reorder"
								ondragstart={(event) => handleDragStart(event, index)}
								ondragend={resetDragState}
							>
								<span aria-hidden="true">⠿</span>
							</button>
						{/if}
						<div class="min-w-0 flex-1">
							<TrackRow
								title={track.title}
								subtitle={`${track.artist} · ${track.album}`}
								coverId={track.cover_id}
								baseUrl={connection.baseUrl}
								favourite={connection.hasUserDb === true ? favourites.isFavourite(track.id) : null}
								favouritePending={favourites.isPending(track.id)}
								onFavouriteClick={connection.hasUserDb === true
									? () => favourites.toggle(track)
									: undefined}
								onAddToPlaylist={connection.hasUserDb === true
									? () => addToPlaylist.open(track)
									: undefined}
								onclick={() => player.playTracks(editing ? draftTracks : tracks, index)}
							/>
						</div>
						{#if editing}
							<div class="flex shrink-0 flex-col gap-1">
								<button
									type="button"
									class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-3 text-sm font-semibold disabled:opacity-40"
									disabled={saving || index === 0}
									aria-label={`Move ${track.title} up`}
									onclick={() => moveDraftTrack(index, index - 1)}
								>
									Up
								</button>
								<button
									type="button"
									class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-3 text-sm font-semibold disabled:opacity-40"
									disabled={saving || index === draftTracks.length - 1}
									aria-label={`Move ${track.title} down`}
									onclick={() => moveDraftTrack(index, index + 1)}
								>
									Down
								</button>
							</div>
							<button
								type="button"
								class="border-border bg-surface-muted hover:border-accent min-h-touch min-w-touch shrink-0 rounded-card border text-sm font-semibold disabled:opacity-60"
								disabled={saving}
								aria-label={`Remove ${track.title}`}
								onclick={() => removeDraftTrack(track.id)}
							>
								Remove
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>
