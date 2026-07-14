import { normalizeBaseUrl } from '$lib/api/url';

/** Default LAN media-server used when PUBLIC_MEDIA_SERVER_URL is unset. */
export const DEFAULT_DEV_BASE_URL = 'http://192.168.5.111:8080';

/**
 * Configured media-server base URL for normal boot.
 * Prefer PUBLIC_MEDIA_SERVER_URL; fall back to the documented LAN default.
 */
export function getMediaServerBaseUrl(): string {
	const fromEnv = import.meta.env.PUBLIC_MEDIA_SERVER_URL;
	const raw = typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : DEFAULT_DEV_BASE_URL;
	return normalizeBaseUrl(raw);
}
