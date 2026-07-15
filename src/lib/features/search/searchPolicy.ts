/** Debounce window for live search input (media-server guidance: 300–500 ms). */
export const SEARCH_DEBOUNCE_MS = 400;

/** Minimum trimmed query length before issuing a fuzzy search request. */
export const MIN_FUZZY_SEARCH_LENGTH = 3;

export function isFuzzySearchEligible(query: string): boolean {
	return query.trim().length >= MIN_FUZZY_SEARCH_LENGTH;
}

export function shouldRunFuzzySearch(query: string): boolean {
	return isFuzzySearchEligible(query);
}
