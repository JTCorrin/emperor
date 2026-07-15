import { describe, expect, it } from 'vitest';
import {
	isFuzzySearchEligible,
	MIN_FUZZY_SEARCH_LENGTH,
	SEARCH_DEBOUNCE_MS,
	shouldRunFuzzySearch
} from './searchPolicy';

describe('searchPolicy', () => {
	it('uses recommended debounce and minimum length constants', () => {
		expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);
		expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(500);
		expect(MIN_FUZZY_SEARCH_LENGTH).toBe(3);
	});

	it('requires at least three trimmed characters for fuzzy search', () => {
		expect(isFuzzySearchEligible('')).toBe(false);
		expect(isFuzzySearchEligible('  ab  ')).toBe(false);
		expect(isFuzzySearchEligible('abc')).toBe(true);
		expect(shouldRunFuzzySearch('abc')).toBe(true);
	});
});
