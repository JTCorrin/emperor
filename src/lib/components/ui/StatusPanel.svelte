<script lang="ts">
	interface Props {
		title?: string;
		message: string;
		tone?: 'muted' | 'danger';
		onretry?: () => void;
	}

	let { title, message, tone = 'muted', onretry }: Props = $props();
</script>

<div
	class="border-border bg-surface-raised rounded-card flex min-h-32 flex-col justify-center gap-3 border p-4"
	role="status"
>
	{#if title}
		<p class="text-base font-semibold">{title}</p>
	{/if}
	<p class={tone === 'danger' ? 'text-danger text-base' : 'text-text-muted text-base'}>{message}</p>
	{#if onretry}
		<button
			type="button"
			class="border-border bg-surface-muted hover:border-accent min-h-touch w-fit rounded-card border px-4 text-base font-medium"
			onclick={onretry}
		>
			Retry
		</button>
	{/if}
</div>
