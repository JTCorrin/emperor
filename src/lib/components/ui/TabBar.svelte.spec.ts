import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TabBar from './TabBar.svelte';

describe('TabBar', () => {
	it('renders labelled primary tabs', async () => {
		render(TabBar);

		await expect.element(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Home' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Playlists' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Songs' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Albums' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Podcasts' })).not.toBeInTheDocument();
	});
});
