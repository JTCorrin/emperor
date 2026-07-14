<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import {
		loadMusicBrainzSettings,
		saveMusicBrainzSettings
	} from '$lib/features/musicbrainz/settings';
	import { buildMusicBrainzUserAgent } from '$lib/features/musicbrainz/userAgent';

	const initial = browser ? loadMusicBrainzSettings() : { contact: '', applyCoverOnLookup: false };

	let contact = $state(initial.contact);
	let applyCoverOnLookup = $state(initial.applyCoverOnLookup);
	let savedNotice = $state<string | null>(null);
	let formError = $state<string | null>(null);

	const userAgentPreview = $derived.by(() => {
		const trimmed = contact.trim();
		if (!trimmed) return null;
		try {
			return buildMusicBrainzUserAgent(trimmed);
		} catch {
			return null;
		}
	});

	function onSubmit(event: Event) {
		event.preventDefault();
		formError = null;
		savedNotice = null;
		const trimmed = contact.trim();
		if (!trimmed) {
			formError = 'Enter an email or URL so MusicBrainz can identify this client.';
			return;
		}
		saveMusicBrainzSettings({ contact: trimmed, applyCoverOnLookup });
		contact = trimmed;
		savedNotice = 'Settings saved locally in this browser.';
	}
</script>

<section class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
		<p class="text-text-muted max-w-2xl text-lg">
			MusicBrainz does not use a secret API key. Public web service etiquette requires an
			identifying User-Agent with a contact email or URL. Values stay in this browser’s
			localStorage.
		</p>
		<p class="text-text-muted max-w-2xl text-base">
			Keep lookups infrequent (about one request per second). Do not hammer the live service from
			automated tests — Emperor stubs MusicBrainz and Cover Art Archive in CI.
		</p>
	</div>

	<form
		method="POST"
		class="border-border bg-surface-raised flex max-w-2xl flex-col gap-5 rounded-card border p-6"
		onsubmit={onSubmit}
	>
		<div class="flex flex-col gap-2">
			<label class="text-lg font-medium" for="mb-contact">MusicBrainz contact</label>
			<input
				id="mb-contact"
				name="contact"
				type="text"
				autocomplete="email"
				spellcheck="false"
				placeholder="you@example.com or https://example.com"
				bind:value={contact}
				aria-invalid={formError ? 'true' : undefined}
				aria-describedby={formError ? 'mb-contact-error' : 'mb-contact-hint'}
				class="border-border bg-surface-muted text-text placeholder:text-text-muted focus:border-accent min-h-touch-lg rounded-card border px-4 text-lg"
			/>
			<p id="mb-contact-hint" class="text-text-muted text-base">
				Used as <code class="text-text">Emperor/0.0.1 (contact)</code>. Browsers may send their own
				User-Agent; contact is still required before Lookup is enabled.
			</p>
			{#if formError}
				<p id="mb-contact-error" class="text-danger text-base" role="alert">{formError}</p>
			{/if}
		</div>

		{#if userAgentPreview}
			<p class="text-text-muted text-base">
				Preview: <code class="text-text">{userAgentPreview}</code>
			</p>
		{/if}

		<label class="flex min-h-touch cursor-pointer items-center gap-3 text-base font-medium">
			<input
				type="checkbox"
				class="border-border text-accent focus:ring-accent size-5 rounded"
				bind:checked={applyCoverOnLookup}
			/>
			Also apply Cover Art Archive front cover after album MusicBrainz lookup
		</label>

		{#if savedNotice}
			<p class="text-success text-base" role="status">{savedNotice}</p>
		{/if}

		<div class="flex flex-wrap gap-3">
			<button
				type="submit"
				class="bg-accent text-text hover:bg-accent-strong min-h-touch rounded-card px-5 text-base font-semibold"
			>
				Save settings
			</button>
			<a
				href={resolve('/connect')}
				class="border-border bg-surface-muted hover:border-accent inline-flex min-h-touch items-center rounded-card border px-5 text-base font-semibold"
			>
				Back to Connect
			</a>
		</div>
	</form>
</section>
