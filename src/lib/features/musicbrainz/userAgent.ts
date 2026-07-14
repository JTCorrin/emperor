/** App identity segment for MusicBrainz User-Agent. */
export const EMPEROR_MB_APP = 'Emperor/0.0.1';

/**
 * Build an identifying User-Agent per MusicBrainz etiquette:
 * `Application/version (contact)` where contact is an email or URL.
 *
 * Browsers forbid setting User-Agent on fetch; Node/tests can send it.
 * Contact is still required before enabling lookup UI.
 */
export function buildMusicBrainzUserAgent(contact: string): string {
	const trimmed = contact.trim();
	if (!trimmed) {
		throw new Error('MusicBrainz contact is required');
	}
	return `${EMPEROR_MB_APP} (${trimmed})`;
}
