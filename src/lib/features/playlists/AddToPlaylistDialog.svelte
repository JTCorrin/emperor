<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		createMediaServerClient,
		MediaServerRequestError,
		type Playlist,
		type Track
	} from '$lib/api';
	import { loadAllPages } from '$lib/features/browse/loadAllPages';
	import { appendTrackToPlaylist } from '$lib/features/playlists/appendTrackToPlaylist';
	import { getConnection } from '$lib/state/context';

	interface Props {
		track: Track | null;
		onclose?: () => void;
		onsaved?: (playlist: Playlist) => void;
	}

	let { track, onclose, onsaved }: Props = $props();

	const connection = getConnection();

	let dialog: HTMLDialogElement | undefined = $state();
	let playlists = $state.raw<Playlist[]>([]);
	let loadStatus = $state<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
	let loadError = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let saveMessage = $state<string | null>(null);
	let pendingPlaylistId = $state<number | null>(null);
	let formTrackId = $state<number | null>(null);
	let loadAbort: AbortController | null = null;

	function closeDialog() {
		loadAbort?.abort();
		loadAbort = null;
		dialog?.close();
		saveError = null;
		saveMessage = null;
		pendingPlaylistId = null;
		onclose?.();
	}

	async function loadPlaylists() {
		const baseUrl = connection.baseUrl;
		if (!baseUrl || connection.hasUserDb !== true) {
			playlists = [];
			loadStatus = 'error';
			loadError = 'Playlists need a media-server user database.';
			return;
		}

		loadAbort?.abort();
		const abort = new AbortController();
		loadAbort = abort;
		loadStatus = 'loading';
		loadError = null;
		saveError = null;
		saveMessage = null;

		try {
			const client = createMediaServerClient({ baseUrl });
			const items = await loadAllPages((offset) =>
				client.getPlaylists({ limit: 200, offset, signal: abort.signal })
			);
			if (abort.signal.aborted) return;
			playlists = items;
			loadStatus = items.length === 0 ? 'empty' : 'ready';
		} catch (cause) {
			if (abort.signal.aborted) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') return;
			playlists = [];
			loadStatus = 'error';
			loadError =
				cause instanceof MediaServerRequestError
					? cause.error.message
					: cause instanceof Error
						? cause.message
						: 'Could not load playlists.';
		}
	}

	async function choosePlaylist(playlist: Playlist) {
		if (!track || !connection.baseUrl || pendingPlaylistId != null) return;
		pendingPlaylistId = playlist.id;
		saveError = null;
		saveMessage = null;

		try {
			const client = createMediaServerClient({ baseUrl: connection.baseUrl });
			const result = await appendTrackToPlaylist(client, playlist.id, track.id);
			if (result.kind === 'already_present') {
				saveMessage = `Already in “${playlist.name}”.`;
			} else {
				saveMessage = `Added to “${playlist.name}”.`;
				onsaved?.(playlist);
				queueMicrotask(() => closeDialog());
			}
		} catch (cause) {
			saveError =
				cause instanceof MediaServerRequestError
					? cause.error.message
					: cause instanceof Error
						? cause.message
						: 'Could not update playlist.';
		} finally {
			pendingPlaylistId = null;
		}
	}

	$effect(() => {
		const next = track;
		if (next) {
			if (formTrackId !== next.id) {
				formTrackId = next.id;
				void loadPlaylists();
			}
			queueMicrotask(() => {
				if (!dialog?.open) dialog?.showModal();
			});
		} else {
			formTrackId = null;
			if (dialog?.open) dialog.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	class="bg-surface-raised text-text border-border fixed inset-0 m-auto max-h-[min(90dvh,36rem)] w-[min(100%-2rem,28rem)] overflow-y-auto rounded-card border p-0 shadow-xl backdrop:bg-black/60 open:flex open:flex-col"
	aria-labelledby="add-to-playlist-title"
	onclose={() => {
		saveError = null;
		saveMessage = null;
		onclose?.();
	}}
>
	{#if track}
		<div class="flex flex-col gap-4 p-6">
			<h2 id="add-to-playlist-title" class="text-2xl font-semibold tracking-tight">
				Add to playlist
			</h2>
			<p class="text-text-muted text-base">
				Add <span class="text-text font-medium">{track.title}</span> to a playlist.
			</p>

			{#if loadStatus === 'loading' || loadStatus === 'idle'}
				<p class="text-text-muted text-base" aria-busy="true">Loading playlists…</p>
			{:else if loadStatus === 'error'}
				<p class="text-danger text-base" role="alert">{loadError}</p>
			{:else if loadStatus === 'empty'}
				<p class="text-text-muted text-base">
					No playlists yet. Create one on the
					<a class="text-accent-strong underline" href={resolve('/playlists')}>Playlists</a> tab.
				</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each playlists as playlist (playlist.id)}
						<li>
							<button
								type="button"
								class="border-border bg-surface-muted hover:border-accent min-h-touch w-full rounded-card border px-4 text-left text-base font-semibold disabled:opacity-60"
								disabled={pendingPlaylistId != null}
								onclick={() => void choosePlaylist(playlist)}
							>
								{pendingPlaylistId === playlist.id ? 'Adding…' : playlist.name}
								<span class="text-text-muted ml-2 font-normal">{playlist.track_count} tracks</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if saveError}
				<p class="text-danger text-base" role="alert">{saveError}</p>
			{/if}
			{#if saveMessage}
				<p class="text-success text-base" role="status">{saveMessage}</p>
			{/if}

			<button
				type="button"
				class="border-border bg-surface-muted hover:border-accent min-h-touch w-fit rounded-card border px-5 text-base font-semibold"
				disabled={pendingPlaylistId != null}
				onclick={closeDialog}
			>
				Cancel
			</button>
		</div>
	{/if}
</dialog>
