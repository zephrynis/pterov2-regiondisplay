import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Select, TitledGreyBox, http, httpErrorToHuman, useCurrentUser, useExtensionAction, type RouteSlotData } from '@pterodactyl/sdk';
import countries from '../../resources/countries.json';
import { RegionBadge } from './RegionBadge';
import { adminBase, locationKey, serverKey, type LocationRegion as LocationData } from './regions';

const countryNames: Record<string, string> = countries;
const options = Object.entries(countryNames).map(([value, label]) => ({ value, label, textLabel: `${label} ${value}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

function Editor({ id, initial }: { id: string; initial: LocationData }) {
    const user = useCurrentUser();
    const client = useQueryClient();
    const inputId = useId();
    const [country, setCountry] = useState(initial.region?.country_code ?? '');
    const [name, setName] = useState(initial.region?.display_name ?? '');
    const [saved, setSaved] = useState(initial.region);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const dirty = country !== (saved?.country_code ?? '') || name.trim() !== (saved?.display_name ?? '');
    const write = useExtensionAction('save location region', async (clear: boolean) => {
        if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const result = await http.request<LocationData>({
                method: clear ? 'delete' : 'put',
                url: `${adminBase}/locations/${id}`,
                data: clear ? undefined : { country_code: country, display_name: name.trim() || null },
            });
            setSaved(result.data.region);
            setCountry(result.data.region?.country_code ?? '');
            setName(result.data.region?.display_name ?? '');
            client.setQueryData(locationKey(user.uuid, id), result.data);
            await client.invalidateQueries({ queryKey: serverKey });
            setNotice(clear ? 'Region cleared.' : 'Region saved.');
        } catch (cause) {
            setError(httpErrorToHuman(cause));
        } finally { setBusy(false); }
    });

    return <form className="rd-form" onSubmit={event => { event.preventDefault(); void write(false); }}>
        <p className="rd-help">Servers on this location’s nodes inherit this region. Save region separately from the location details.</p>
        <div className="rd-fields">
            <div className="rd-field"><label htmlFor={`${inputId}-country`}>Country</label>
                <Select id={`${inputId}-country`} value={country || null} options={options} disabled={busy}
                    placeholder="Choose a country" searchPlaceholder="Search countries or codes…"
                    onChange={value => { setCountry(String(value)); setNotice(''); }} />
            </div>
            <div className="rd-field"><label htmlFor={`${inputId}-name`}>Display name <span className="rd-help">(optional)</span></label>
                <Input id={`${inputId}-name`} value={name} maxLength={64} disabled={busy} placeholder={countryNames[country] ?? 'e.g. US East'}
                    aria-describedby={`${inputId}-help`} onChange={event => { setName(event.target.value); setNotice(''); }} />
                <span id={`${inputId}-help`} className="rd-help">Leave blank to use the country name.</span>
            </div>
        </div>
        <div className="rd-footer"><div className="rd-preview"><span className="rd-help">Preview</span>
            {country ? <RegionBadge region={{ country_code: country, display_name: name.trim() || null, name: name.trim() || countryNames[country] }} /> : <span className="rd-help">No region assigned</span>}
        </div><div className="rd-actions">
            <Button.Text type="button" disabled={busy || !saved} onClick={() => void write(true)}>Clear region</Button.Text>
            <Button type="submit" disabled={busy || !country || !dirty} isLoading={busy}>Save region</Button>
        </div></div>
        {error && <p role="alert" className="rd-error">{error}</p>}
        {notice && <p role="status">{notice}</p>}
    </form>;
}

function LocationCard({ id }: { id: string }) {
    const user = useCurrentUser();
    const query = useQuery({
        queryKey: locationKey(user.uuid, id),
        queryFn: async ({ signal }) => (await http.get<LocationData>(`${adminBase}/locations/${id}`, { signal })).data,
        retry: false,
        gcTime: 0,
        refetchOnWindowFocus: false,
    });
    return <section className="rd-location mx-4 max-w-panel xl:mx-auto" aria-label="Region Display"><TitledGreyBox title="Region Display">
        {query.isPending ? <p role="status">Loading region…</p> : query.isError ? <div role="alert">
            <p>{httpErrorToHuman(query.error)}</p><Button type="button" onClick={() => void query.refetch()}>Retry region</Button>
        </div> : <Editor key={id} id={id} initial={query.data} />}
    </TitledGreyBox></section>;
}

export default function LocationRegion({ data }: { data: RouteSlotData }) {
    const user = useCurrentUser();
    const id = data.params.id;
    return user.rootAdmin && /^\d+$/.test(id ?? '') ? <LocationCard key={id} id={id} /> : null;
}
