import { describe, expect, it, vi } from 'vitest';
import { loadAllPages } from './loadAllPages';

describe('loadAllPages', () => {
	it('loads pages in order until the reported total is reached', async () => {
		const fetchPage = vi.fn(async (offset: number) => ({
			items: offset === 0 ? [1, 2] : [3],
			total: 3,
			limit: 2,
			offset
		}));

		await expect(loadAllPages(fetchPage)).resolves.toEqual([1, 2, 3]);
		expect(fetchPage).toHaveBeenNthCalledWith(1, 0);
		expect(fetchPage).toHaveBeenNthCalledWith(2, 2);
	});

	it('stops safely when a server returns an empty page before total', async () => {
		const fetchPage = vi.fn(async (offset: number) => ({
			items: [],
			total: 10,
			limit: 2,
			offset
		}));

		await expect(loadAllPages(fetchPage)).resolves.toEqual([]);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});
});
