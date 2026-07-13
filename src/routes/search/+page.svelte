<script lang="ts">
	import { page } from '$app/state';

	const query = $derived(page.url.searchParams.get('q')?.trim() ?? '');
</script>

<section class="flex flex-1 flex-col gap-4 pb-4">
	<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Search</h1>
	{#if query}
		<p class="text-text-muted text-lg">
			Results for “{query}” will appear here in Phase 4.
		</p>
	{:else}
		<p class="text-text-muted text-lg">
			Search results land in Phase 4. Enter a query in the top search field to continue.
		</p>
	{/if}
</section>
