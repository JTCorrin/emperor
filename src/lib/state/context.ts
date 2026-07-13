import { createContext } from 'svelte';
import type { ConnectionController } from './connection.svelte';

export const [getConnection, setConnection] = createContext<ConnectionController>();
