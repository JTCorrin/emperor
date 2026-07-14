<script lang="ts">
	import { resolve } from '$app/paths';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import {
		createMediaServerClient,
		MediaServerRequestError,
		trackMetadataFormSchema,
		type Track,
		type TrackMetadataForm,
		type TrackMetadataPatch
	} from '$lib/api';
	import { createMusicBrainzClient } from '$lib/features/musicbrainz/client';
	import { lookupTrackMetadata } from '$lib/features/musicbrainz/lookup';
	import { loadMusicBrainzSettings } from '$lib/features/musicbrainz/settings';
	import { getConnection } from '$lib/state/context';
	import OverriddenFields from './OverriddenFields.svelte';
	import { buildTrackPatch, trackToFormValues } from './patchBuilders';

	interface Props {
		track: Track | null;
		onsaved?: (track: Track) => void;
		onclose?: () => void;
	}

	let { track, onsaved, onclose }: Props = $props();

	const connection = getConnection();

	let dialog: HTMLDialogElement | undefined = $state();
	let saveError = $state<string | null>(null);
	let lookupError = $state<string | null>(null);
	let lookupPending = $state(false);
	let cleared = $state<Partial<Record<keyof TrackMetadataPatch, boolean>>>({});
	let formTrackId = $state<number | null>(null);
	let mbContact = $state('');

	const { form, errors, enhance, submitting, reset } = superForm(
		defaults(emptyForm(), zod4(trackMetadataFormSchema)),
		{
			SPA: true,
			validators: zod4(trackMetadataFormSchema),
			resetForm: false,
			onUpdate: async ({ form: validated, cancel }) => {
				cancel();
				if (!validated.valid || !track || !connection.baseUrl) return;

				const patch = buildTrackPatch(track, validated.data, cleared);
				if (Object.keys(patch).length === 0) {
					saveError = 'Change a field or clear an override before saving.';
					return;
				}

				saveError = null;
				try {
					const client = createMediaServerClient({ baseUrl: connection.baseUrl });
					const updated = await client.updateTrack(track.id, patch);
					onsaved?.(updated);
					closeDialog();
				} catch (cause) {
					saveError =
						cause instanceof MediaServerRequestError
							? cause.error.message
							: cause instanceof Error
								? cause.message
								: 'Could not save track metadata.';
				}
			}
		}
	);

	function emptyForm(): TrackMetadataForm {
		return {
			title: '',
			artist: '',
			album: '',
			release_date: '',
			genre: '',
			track_number: '',
			disc_number: ''
		};
	}

	function closeDialog() {
		dialog?.close();
		saveError = null;
		lookupError = null;
		cleared = {};
		onclose?.();
	}

	function clearField(key: keyof TrackMetadataPatch) {
		cleared = { ...cleared, [key]: true };
		if (
			key === 'release_date' ||
			key === 'genre' ||
			key === 'track_number' ||
			key === 'disc_number'
		) {
			$form[key] = '';
		}
	}

	async function onLookupMusicBrainz() {
		lookupError = null;
		const settings = loadMusicBrainzSettings();
		mbContact = settings.contact;
		if (!settings.contact) {
			lookupError = 'Set a MusicBrainz contact in Settings before looking up.';
			return;
		}

		lookupPending = true;
		try {
			const mb = createMusicBrainzClient({ contact: settings.contact });
			const outcome = await lookupTrackMetadata(mb, {
				title: $form.title,
				artist: $form.artist,
				album: $form.album
			});
			if (outcome.kind === 'empty') {
				lookupError = 'No MusicBrainz recording matched the current fields.';
				return;
			}
			if (outcome.kind === 'error') {
				lookupError = outcome.message;
				return;
			}
			const next = outcome.result.form;
			cleared = {};
			$form.title = next.title ?? $form.title;
			$form.artist = next.artist ?? $form.artist;
			$form.album = next.album ?? $form.album;
			$form.release_date = next.release_date ?? $form.release_date;
			$form.genre = next.genre ?? $form.genre;
			$form.track_number = next.track_number ?? $form.track_number;
			$form.disc_number = next.disc_number ?? $form.disc_number;
		} finally {
			lookupPending = false;
		}
	}

	$effect(() => {
		const next = track;
		if (next) {
			if (formTrackId !== next.id) {
				formTrackId = next.id;
				cleared = {};
				saveError = null;
				lookupError = null;
				mbContact = loadMusicBrainzSettings().contact;
				reset({ data: trackToFormValues(next) });
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
	class="bg-surface-raised text-text border-border fixed inset-0 m-auto max-h-[min(90dvh,40rem)] w-[min(100%-2rem,32rem)] overflow-y-auto rounded-card border p-0 shadow-xl backdrop:bg-black/60 open:flex open:flex-col"
	aria-labelledby="track-metadata-title"
	onclose={() => {
		saveError = null;
		lookupError = null;
		cleared = {};
		onclose?.();
	}}
>
	{#if track}
		<form
			method="POST"
			use:enhance
			class="flex flex-col gap-4 p-6"
			onsubmit={(event) => event.stopPropagation()}
		>
			<h2 id="track-metadata-title" class="text-2xl font-semibold tracking-tight">Edit track</h2>
			<OverriddenFields fields={track.overridden_fields} />

			{#each [['title', 'Title'], ['artist', 'Artist'], ['album', 'Album'], ['release_date', 'Release date'], ['genre', 'Genre'], ['track_number', 'Track number'], ['disc_number', 'Disc number']] as [key, label] (key)}
				<div class="flex flex-col gap-2">
					<label class="text-base font-medium" for={`track-meta-${key}`}>{label}</label>
					<div class="flex gap-2">
						<input
							id={`track-meta-${key}`}
							name={key}
							type="text"
							bind:value={$form[key as keyof TrackMetadataForm]}
							class="border-border bg-surface-muted focus:border-accent min-h-touch w-full rounded-card border px-4 text-base font-normal"
							aria-invalid={$errors[key as keyof TrackMetadataForm] ? true : undefined}
						/>
						<button
							type="button"
							class="border-border bg-surface-muted hover:border-accent min-h-touch shrink-0 rounded-card border px-3 text-sm font-semibold"
							onclick={() => clearField(key as keyof TrackMetadataPatch)}
						>
							Clear
						</button>
					</div>
					{#if $errors[key as keyof TrackMetadataForm]?.[0]}
						<p class="text-danger text-sm" role="alert">
							{$errors[key as keyof TrackMetadataForm]?.[0]}
						</p>
					{/if}
					{#if cleared[key as keyof TrackMetadataPatch]}
						<p class="text-text-muted text-sm">Will clear override on save.</p>
					{/if}
				</div>
			{/each}

			{#if lookupError}
				<p class="text-danger text-base" role="alert">{lookupError}</p>
			{/if}
			{#if saveError}
				<p class="text-danger text-base" role="alert">{saveError}</p>
			{/if}

			<div class="flex flex-wrap gap-3">
				{#if mbContact}
					<button
						type="button"
						class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold disabled:opacity-60"
						disabled={$submitting || lookupPending}
						onclick={onLookupMusicBrainz}
					>
						{lookupPending ? 'Looking up…' : 'Lookup MusicBrainz'}
					</button>
				{:else}
					<a
						href={resolve('/settings')}
						class="border-border bg-surface-muted hover:border-accent inline-flex min-h-touch items-center rounded-card border px-5 text-base font-semibold"
					>
						Set MusicBrainz contact in Settings
					</a>
				{/if}
				<button
					type="submit"
					class="bg-accent text-text hover:bg-accent-strong min-h-touch rounded-card px-5 text-base font-semibold disabled:opacity-60"
					disabled={$submitting}
				>
					{$submitting ? 'Saving…' : 'Save'}
				</button>
				<button
					type="button"
					class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold"
					disabled={$submitting}
					onclick={closeDialog}
				>
					Cancel
				</button>
			</div>
		</form>
	{/if}
</dialog>
