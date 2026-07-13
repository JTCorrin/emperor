<script lang="ts">
	import { untrack } from 'svelte';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { connectFormSchema } from '$lib/api/schemas';
	import { DEFAULT_DEV_BASE_URL } from '$lib/config';
	import { getConnection } from '$lib/state/context';

	interface Props {
		initialBaseUrl?: string;
	}

	let { initialBaseUrl = DEFAULT_DEV_BASE_URL }: Props = $props();

	const connection = getConnection();
	// Remounted via {#key} when the starting URL changes; capture once per mount.
	const startingBaseUrl = untrack(() => initialBaseUrl);

	const { form, errors, enhance, submitting } = superForm(
		defaults({ baseUrl: startingBaseUrl }, zod4(connectFormSchema)),
		{
			SPA: true,
			validators: zod4(connectFormSchema),
			resetForm: false,
			onUpdate: async ({ form: validated, cancel }) => {
				cancel();
				if (!validated.valid) return;
				await connection.connect(validated.data.baseUrl);
			}
		}
	);

	const errorText = $derived(
		$errors.baseUrl?.[0] ?? (connection.status === 'error' ? connection.error?.message : undefined)
	);
</script>

<form method="POST" use:enhance class="flex w-full max-w-2xl flex-col gap-5">
	<div class="flex flex-col gap-2">
		<label class="text-text text-lg font-medium" for="baseUrl">Media server URL</label>
		<input
			id="baseUrl"
			name="baseUrl"
			type="url"
			inputmode="url"
			autocomplete="url"
			spellcheck="false"
			placeholder={DEFAULT_DEV_BASE_URL}
			bind:value={$form.baseUrl}
			aria-invalid={errorText ? 'true' : undefined}
			aria-describedby={errorText ? 'baseUrl-error' : undefined}
			class="border-border bg-surface-muted text-text placeholder:text-text-muted focus:border-accent min-h-touch-lg rounded-card border px-4 text-lg"
		/>
		{#if errorText}
			<p id="baseUrl-error" class="text-danger text-base" role="alert">{errorText}</p>
		{/if}
	</div>

	<button
		type="submit"
		class="bg-accent text-text hover:bg-accent-strong min-h-touch-lg rounded-card px-6 text-lg font-semibold disabled:opacity-60"
		disabled={$submitting || connection.status === 'connecting'}
	>
		{#if $submitting || connection.status === 'connecting'}
			Connecting…
		{:else}
			Connect
		{/if}
	</button>
</form>
