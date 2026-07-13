import { createContext } from 'svelte';
import type { FavouritesController } from '$lib/features/favourites/favourites.svelte';
import type { ConnectionController } from './connection.svelte';
import type { PlayerController } from './player.svelte';

export const [getConnection, setConnection] = createContext<ConnectionController>();
export const [getPlayer, setPlayer] = createContext<PlayerController>();
export const [getFavourites, setFavourites] = createContext<FavouritesController>();
