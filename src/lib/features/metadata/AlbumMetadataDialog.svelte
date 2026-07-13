<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fromAction } from 'svelte/attachments';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import {
		createMediaServerClient,
		MediaServerRequestError,
		albumMetadataFormSchema,
		type Album,
		type AlbumMetadataForm,
		type AlbumMetadataPatch
	} from '$lib/api';
	import { getConnection } from '$lib/state/context';
	import { refetchAlbumAfterPatch } from './albumRegroup';
	import { albumToFormValues, buildAlbumPatch } from './patchBuilders';

	interface Props {
		album: Album | null;
		onsaved?: (album: Album) => void;
		onclose?: () => void;
	}

	let { album, onsaved, onclose }: Props = $props();

	const connection = getConnection();

	let dialog: HTMLDialogElement | undefined;
	let saveError = $state<string | null>(null);
	let cleared = $state<Partial<Record<keyof AlbumMetadataPatch, boolean>>>({});
	let formAlbumId: number | null = null;

	const { form, errors, enhance, submitting, reset } = superForm(
		defaults(emptyForm(), zod4(albumMetadataFormSchema)),
		{
			SPA: true,
			validators: zod4(albumMetadataFormSchema),
			resetForm: false,
			onUpdate: async ({ form: validated, cancel }) => {
				cancel();
				if (!validated.valid || !album || !connection.baseUrl) return;

				const patch = buildAlbumPatch(album, validated.data, cleared);
				if (Object.keys(patch).length === 0) {
					saveError = 'Change a field or clear an override before saving.';
					return;
				}

				saveError = null;
				try {
					const client = createMediaServerClient({ baseUrl: connection.baseUrl });
					await client.updateAlbum(album.id, patch);
					const result = await refetchAlbumAfterPatch((id) => client.getAlbum(id), album.id);
					if (result.kind === 'regrouped') {
						closeDialog();
						if (typeof sessionStorage !== 'undefined') {
							sessionStorage.setItem('emperor:album-regroup-notice', 'true');
						}
						await goto(resolve('/albums'));
						return;
					}
					if (result.kind === 'error') {
						saveError = result.message;
						return;
					}
					onsaved?.(result.album);
					closeDialog();
				} catch (cause) {
					saveError =
						cause instanceof MediaServerRequestError
							? cause.error.message
							: cause instanceof Error
								? cause.message
								: 'Could not save album metadata.';
				}
			}
		}
	);
	const enhanceAttachment = fromAction(enhance);

	function emptyForm(): AlbumMetadataForm {
		return {
			name: '',
			artist: '',
			release_date: '',
			genre: ''
		};
	}

	function closeDialog() {
		dialog?.close();
		saveError = null;
		cleared = {};
		onclose?.();
	}

	function clearField(key: keyof AlbumMetadataPatch) {
		cleared = { ...cleared, [key]: true };
		if (key === 'release_date' || key === 'genre') {
			$form[key] = '';
		}
	}

	function syncDialog(element: HTMLDialogElement) {
		dialog = element;
		const next = album;
		if (next) {
			if (formAlbumId !== next.id) {
				formAlbumId = next.id;
				cleared = {};
				saveError = null;
				reset({ data: albumToFormValues(next) });
			}
			queueMicrotask(() => {
				if (!dialog?.open) dialog?.showModal();
			});
		} else {
			formAlbumId = null;
			if (dialog?.open) dialog.close();
		}
	}
</script>

<dialog
	{@attach syncDialog}
	class="bg-surface-raised text-text border-border fixed inset-0 m-auto max-h-[min(90dvh,36rem)] w-[min(100%-2rem,32rem)] overflow-y-auto rounded-card border p-0 shadow-xl backdrop:bg-black/60 open:flex open:flex-col"
	aria-labelledby="album-metadata-title"
	onclose={() => {
		saveError = null;
		cleared = {};
		onclose?.();
	}}
>
	{#if album}
		<form
			method="POST"
			{@attach enhanceAttachment}
			class="flex flex-col gap-4 p-6"
			onsubmit={(event) => event.stopPropagation()}
		>
			<h2 id="album-metadata-title" class="text-2xl font-semibold tracking-tight">Edit album</h2>
			<p class="text-text-muted text-base">
				Edits override metadata for all tracks on this album. Artist/album ids may change afterward.
			</p>

			{#each [['name', 'Name'], ['artist', 'Artist'], ['release_date', 'Release date'], ['genre', 'Genre']] as [key, label] (key)}
				<div class="flex flex-col gap-2">
					<label class="text-base font-medium" for={`album-meta-${key}`}>{label}</label>
					<div class="flex gap-2">
						<input
							id={`album-meta-${key}`}
							name={key}
							type="text"
							bind:value={$form[key as keyof AlbumMetadataForm]}
							class="border-border bg-surface-muted focus:border-accent min-h-touch w-full rounded-card border px-4 text-base font-normal"
							aria-invalid={$errors[key as keyof AlbumMetadataForm] ? true : undefined}
						/>
						<button
							type="button"
							class="border-border bg-surface-muted hover:border-accent min-h-touch shrink-0 rounded-card border px-3 text-sm font-semibold"
							onclick={() => clearField(key as keyof AlbumMetadataPatch)}
						>
							Clear
						</button>
					</div>
					{#if $errors[key as keyof AlbumMetadataForm]?.[0]}
						<p class="text-danger text-sm" role="alert">
							{$errors[key as keyof AlbumMetadataForm]?.[0]}
						</p>
					{/if}
					{#if cleared[key as keyof AlbumMetadataPatch]}
						<p class="text-text-muted text-sm">Will clear override on save.</p>
					{/if}
				</div>
			{/each}

			{#if saveError}
				<p class="text-danger text-base" role="alert">{saveError}</p>
			{/if}

			<div class="flex flex-wrap gap-3">
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
