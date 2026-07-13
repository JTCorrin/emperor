import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LoadMoreButton from './LoadMoreButton.svelte';
import MediaGrid from './MediaGrid.svelte';
import TrackRow from './TrackRow.svelte';

describe('TrackRow', () => {
	it('activates the favourite handler', async () => {
		const onFavouriteClick = vi.fn();
		render(TrackRow, {
			title: 'Song Title',
			favourite: false,
			onFavouriteClick
		});

		await page.getByRole('button', { name: /Add Song Title to favourites/ }).click();
		expect(onFavouriteClick).toHaveBeenCalled();
	});

	it('activates the edit handler', async () => {
		const onEditClick = vi.fn();
		render(TrackRow, {
			title: 'Song Title',
			onEditClick
		});

		await page.getByRole('button', { name: 'Edit Song Title' }).click();
		expect(onEditClick).toHaveBeenCalled();
	});
});

describe('MediaGrid', () => {
	it('shows empty status copy', async () => {
		render(MediaGrid, {
			status: 'empty',
			emptyMessage: 'No albums yet.'
		});

		await expect.element(page.getByRole('status')).toBeVisible();
		await expect.element(page.getByText('No albums yet.')).toBeVisible();
	});

	it('shows error status with retry', async () => {
		const onretry = vi.fn();
		render(MediaGrid, {
			status: 'error',
			errorMessage: 'Network failed.',
			onretry
		});

		await expect.element(page.getByText('Network failed.')).toBeVisible();
		await page.getByRole('button', { name: 'Retry' }).click();
		expect(onretry).toHaveBeenCalled();
	});
});

describe('LoadMoreButton', () => {
	it('is hidden when there is no more to load', async () => {
		const onclick = vi.fn();
		render(LoadMoreButton, { hasMore: false, onclick });
		await expect.element(page.getByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
	});

	it('calls onclick when visible', async () => {
		const onclick = vi.fn();
		render(LoadMoreButton, { hasMore: true, onclick });
		await page.getByRole('button', { name: 'Load more' }).click();
		expect(onclick).toHaveBeenCalled();
	});
});
