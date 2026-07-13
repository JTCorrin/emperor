<script lang="ts">
	import type { ConnectionController } from '$lib/state/connection.svelte';

	interface Props {
		connection: ConnectionController;
	}

	let { connection }: Props = $props();

	const label = $derived.by(() => {
		switch (connection.status) {
			case 'connected':
				return 'Connected';
			case 'connecting':
				return 'Connecting…';
			case 'disconnected':
				return 'Saved server offline';
			case 'error':
				return 'Connection error';
			default:
				return 'Not connected';
		}
	});

	const detail = $derived.by(() => {
		if (connection.status === 'connected' && connection.libraryStatus) {
			const status = connection.libraryStatus;
			const scanning = status.scanning ? ' · Scanning…' : '';
			return `${connection.baseUrl} · ${status.track_count} tracks${scanning}`;
		}
		if (connection.error) {
			return connection.error.message;
		}
		if (connection.baseUrl) {
			return connection.baseUrl;
		}
		return 'Enter a media-server base URL to get started';
	});
</script>

<section
	class="border-border bg-surface-raised flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3 sm:px-6"
	aria-live="polite"
>
	<div class="min-w-0">
		<p class="text-sm font-semibold tracking-wide text-text uppercase">{label}</p>
		<p class="text-text-muted truncate text-base">{detail}</p>
	</div>

	{#if connection.status === 'connected' || connection.status === 'disconnected' || connection.status === 'error'}
		<div class="flex flex-wrap gap-3">
			{#if connection.baseUrl}
				<button
					type="button"
					class="bg-surface-muted text-text border-border hover:border-accent min-h-touch min-w-touch rounded-card border px-5 text-base font-medium"
					onclick={() => connection.recheck()}
				>
					Recheck
				</button>
			{/if}
			<button
				type="button"
				class="bg-surface-muted text-text border-border hover:border-danger min-h-touch min-w-touch rounded-card border px-5 text-base font-medium"
				onclick={() => connection.disconnect()}
			>
				Disconnect
			</button>
		</div>
	{/if}
</section>
