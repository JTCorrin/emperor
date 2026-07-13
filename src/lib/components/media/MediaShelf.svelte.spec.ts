import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MediaCard from './MediaCard.svelte';
import MediaShelf from './MediaShelf.svelte';

describe('MediaCard', () => {
	it('activates the click handler', async () => {
		const onclick = vi.fn();
		render(MediaCard, {
			title: 'Song A',
			subtitle: 'Artist B',
			onclick
		});

		await page.getByRole('button', { name: /Song A/ }).click();
		expect(onclick).toHaveBeenCalled();
	});
});

describe('MediaShelf', () => {
	it('shows unavailable status copy', async () => {
		render(MediaShelf, {
			title: 'Favourites',
			status: 'unavailable',
			unavailableMessage: 'Needs a user database.'
		});

		await expect.element(page.getByRole('status')).toBeVisible();
		await expect.element(page.getByText('Needs a user database.')).toBeVisible();
	});

	it('renders ready children and scroll controls', async () => {
		render(MediaShelf, {
			title: 'Discover',
			status: 'ready',
			children: undefined
		});

		await expect.element(page.getByRole('heading', { name: 'Discover' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Scroll Discover left' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Scroll Discover right' })).toBeVisible();
	});
});
