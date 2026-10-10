import { useQuery } from '@tanstack/react-query';
import { http, useCurrentUser } from '@pterodactyl/sdk';

export type Region = { country_code: string; display_name: string | null; name: string };
export type LocationRegion = { region: Region | null };
export const adminBase = '/api/admin/extensions/regiondisplay';
export const serverKey = ['regiondisplay', 'servers'] as const;
export const locationKey = (user: string, id: string) => ['regiondisplay', 'location', user, id] as const;

type Waiting = { uuid: string; resolve: (region: Region | null) => void; reject: (cause: unknown) => void };
// Mounting the native server rows starts independent queries. Coalesce queries from
// the same render into bounded requests, without replacing the native server list.
const batches = new Map<string, Waiting[]>();
function lookup(user: string, uuid: string): Promise<Region | null> {
    return new Promise((resolve, reject) => {
        const waiting = batches.get(user);
        if (waiting) {
            waiting.push({ uuid, resolve, reject });
            return;
        }
        batches.set(user, [{ uuid, resolve, reject }]);
        setTimeout(() => {
            const pending = batches.get(user)!;
            batches.delete(user);
            for (let offset = 0; offset < pending.length; offset += 100) {
                const chunk = pending.slice(offset, offset + 100);
                void http.post<{ regions: Record<string, Region | null> }>('/api/client/extensions/regiondisplay/regions', {
                    uuids: [...new Set(chunk.map(item => item.uuid))],
                }).then(response => {
                    for (const item of chunk) item.resolve(response.data.regions[item.uuid] ?? null);
                }).catch(cause => {
                    for (const item of chunk) item.reject(cause);
                });
            }
        }, 0);
    });
}

export function useRegion(uuid: string) {
    const user = useCurrentUser();
    return useQuery({
        queryKey: [...serverKey, user.uuid, uuid],
        queryFn: () => lookup(user.uuid, uuid),
        staleTime: 15_000,
        gcTime: 60_000,
        retry: false,
        refetchInterval: 60_000,
    });
}
