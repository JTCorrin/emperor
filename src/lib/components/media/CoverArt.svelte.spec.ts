import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CoverArt from './CoverArt.svelte';

describe('CoverArt', () => {
	it('shows initials when no cover URL is available', async () => {
		render(CoverArt, { title: 'Album Name', artist: 'Artist Name' });

		await expect.element(page.getByText('AL')).toBeVisible();
		await expect.element(page.getByRole('img')).not.toBeInTheDocument();
	});

	it('describes displayed cover art', async () => {
		render(CoverArt, {
			title: 'Album Name',
			artist: 'Artist Name',
			coverId: 7,
			baseUrl: 'http://127.0.0.1:8080'
		});

		await expect
			.element(page.getByRole('img', { name: 'Cover art for Album Name by Artist Name' }))
			.toBeVisible();
	});

	it('adds a targeted revision only after a cover write', async () => {
		render(CoverArt, {
			title: 'Album Name',
			coverId: 7,
			coverRevision: 2,
			baseUrl: 'http://127.0.0.1:8080'
		});

		await expect
			.element(page.getByRole('img'))
			.toHaveAttribute('src', 'http://127.0.0.1:8080/cover/7?v=2');
	});
});
