import type { PageEnvelope } from '$lib/api';

export async function loadAllPages<T>(
	fetchPage: (offset: number) => Promise<PageEnvelope<T>>
): Promise<T[]> {
	const items: T[] = [];
	let total = Number.POSITIVE_INFINITY;

	while (items.length < total) {
		const page = await fetchPage(items.length);
		total = page.total;
		if (page.items.length === 0) break;
		items.push(...page.items);
	}

	return items;
}
