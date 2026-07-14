<script lang="ts">
	import { getMediaServerBaseUrl } from '$lib/config';
	import type { ConnectionController } from '$lib/state/connection.svelte';

	interface Props {
		connection: ConnectionController;
	}

	let { connection }: Props = $props();

	const show = $derived(connection.status !== 'connected');

	const label = $derived.by(() => {
		switch (connection.status) {
			case 'connecting':
				return 'Connecting…';
			case 'error':
				return 'Offline';
			case 'disconnected':
				return 'Offline';
			default:
				return 'Offline';
		}
	});

	const detail = $derived.by(() => {
		if (connection.status === 'connecting') {
			return 'Reaching the media server…';
		}
		if (connection.error) {
			return connection.error.message;
		}
		return 'Could not reach the media server.';
	});
</script>

{#if show}
	<section
		class="border-border bg-surface-raised flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 sm:px-6"
		aria-live="polite"
		data-testid="offline-banner"
	>
		<div class="min-w-0">
			<p class="text-sm font-semibold tracking-wide text-text uppercase">{label}</p>
			<p class="text-text-muted truncate text-base">{detail}</p>
		</div>
		<button
			type="button"
			class="bg-accent text-text hover:bg-accent-strong min-h-touch min-w-touch rounded-card px-5 text-base font-semibold"
			onclick={() => connection.connect(getMediaServerBaseUrl())}
		>
			Retry
		</button>
	</section>
{/if}
