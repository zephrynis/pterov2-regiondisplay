import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
    user: { uuid: 'admin', rootAdmin: true },
    get: vi.fn(), post: vi.fn(), request: vi.fn(),
}));
vi.mock('@pterodactyl/sdk', () => {
    const Button = ({ children, isLoading, size, ...props }: any) => <button {...props}>{children}</button>;
    Button.Text = Button;
    return {
        Button, Input: (props: any) => <input {...props} />,
        Select: ({ id, value, options, onChange, disabled }: any) => <select id={id} value={value ?? ''} disabled={disabled} onChange={event => onChange(event.target.value)}>
            <option value="">Choose a country</option>{options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>,
        TitledGreyBox: ({ title, children }: any) => <div><h2>{title}</h2>{children}</div>,
        useCurrentUser: () => mocks.user,
        useExtensionAction: (_name: string, fn: any) => fn,
        http: { get: mocks.get, post: mocks.post, request: mocks.request },
        httpErrorToHuman: (cause: Error) => cause.message,
    };
});
import LocationRegion from '../src/client/LocationRegion';
import { ServerListRegion, ServerConsoleRegion } from '../src/client/RegionBadge';
import ConsoleRegion from '../src/client/ConsoleRegion';
import type { SdkServer } from '@pterodactyl/sdk';

const japan = { country_code: 'JP', display_name: null, name: 'Japan' };
const us = { country_code: 'US', display_name: 'US East', name: 'US East' };
const server = (id: number) => ({ attributes: { uuid: `12345678-1234-4234-8234-${String(id).padStart(12, '0')}` } } as SdkServer);
const location = { pathname: '/panel/locations/1', search: {}, params: { id: '1' } };
let clients: QueryClient[] = [];
function mount(node: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    clients.push(client);
    return { ...render(<QueryClientProvider client={client}>{node}</QueryClientProvider>), client };
}
beforeEach(() => {
    mocks.user = { uuid: 'admin', rootAdmin: true };
    mocks.get.mockReset(); mocks.post.mockReset(); mocks.request.mockReset();
    mocks.get.mockResolvedValue({ data: { region: null } });
    mocks.post.mockImplementation(async (_url, { uuids }) => ({ data: { regions: Object.fromEntries(uuids.map((uuid: string) => [uuid, japan])) } }));
});
afterEach(() => { cleanup(); for (const client of clients) client.clear(); clients = []; });

describe('Location assignment', () => {
    it('restricts controls to administrators', () => {
        mocks.user.rootAdmin = false;
        const { container } = mount(<LocationRegion data={location} />);
        expect(container.textContent).toBe(''); expect(mocks.get).not.toHaveBeenCalled();
    });
    it('previews a country and saves a normalized custom label', async () => {
        mocks.request.mockResolvedValue({ data: { region: us } });
        mount(<LocationRegion data={location} />);
        fireEvent.change(await screen.findByLabelText('Country'), { target: { value: 'US' } });
        fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: ' US East ' } });
        expect(screen.getByText('US East')).toBeTruthy();
        expect(decodeURIComponent(screen.getByText('US East').closest('.rd-badge')?.querySelector('img')?.getAttribute('src') ?? '')).toContain('flag-icons-us');
        fireEvent.click(screen.getByRole('button', { name: 'Save region' }));
        await screen.findByText('Region saved.');
        expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'put', url: '/api/admin/extensions/regiondisplay/locations/1', data: { country_code: 'US', display_name: 'US East' } }));
        expect((screen.getByLabelText(/Display name/) as HTMLInputElement).value).toBe('US East');
        expect((screen.getByRole('button', { name: 'Save region' }) as HTMLButtonElement).disabled).toBe(true);
    });
    it('clears a saved assignment and preview', async () => {
        mocks.get.mockResolvedValue({ data: { region: japan } });
        mocks.request.mockResolvedValue({ data: { region: null } });
        mount(<LocationRegion data={location} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Clear region' }));
        await screen.findByText('Region cleared.');
        expect(screen.getByText('No region assigned')).toBeTruthy();
        expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'delete' }));
    });
    it('retains edits after failed save and retries successfully', async () => {
        mocks.request.mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue({ data: { region: japan } });
        mount(<LocationRegion data={location} />);
        fireEvent.change(await screen.findByLabelText('Country'), { target: { value: 'JP' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save region' }));
        expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Save failed');
        expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('JP');
        fireEvent.click(screen.getByRole('button', { name: 'Save region' }));
        await screen.findByText('Region saved.');
    });
    it('recovers from loading failure', async () => {
        mocks.get.mockRejectedValueOnce(new Error('Load failed')).mockResolvedValue({ data: { region: null } });
        mount(<LocationRegion data={location} />);
        await screen.findByText('Load failed');
        fireEvent.click(screen.getByRole('button', { name: 'Retry region' }));
        await screen.findByLabelText('Country');
    });
});

describe('Server region display', () => {
    it('mounts beside the native console heading and removes its host cleanly', async () => {
        const data = { ...server(1), attributes: { ...server(1).attributes, name: 'Example Server' } };
        function Fixture() {
            const [show, setShow] = useState(true);
            return <div>{show && <ConsoleRegion data={data} />}
                <div><h1>Example Server</h1><p>Native description</p></div>
                <button onClick={() => setShow(false)}>Hide extension</button>
            </div>;
        }
        const { container } = mount(<Fixture />);
        await waitFor(() => expect(container.querySelector('.rd-console-host')?.textContent).toBe('Japan'));
        const heading = screen.getAllByRole('heading', { name: 'Example Server' }).find(el => !el.closest('.rd-console-mobile'))!;
        expect(heading.innerHTML).toBe('Example Server');
        expect(heading.parentElement?.querySelector('.rd-console-host')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Hide extension' }));
        expect(container.querySelector('.rd-console-host')).toBeNull();
        expect(heading.innerHTML).toBe('Example Server');
        expect(screen.getByText('Native description')).toBeTruthy();
    });
    it('falls back to the console slot when a native heading is absent', async () => {
        const data = { ...server(1), attributes: { ...server(1).attributes, name: 'Example Server' } };
        const { container } = mount(<ConsoleRegion data={data} />);
        await screen.findByText('Japan');
        expect(container.querySelector('.rd-console-fallback')?.textContent).toBe('Example ServerJapan');
        expect(container.querySelector('.rd-console-host')).toBeNull();
    });
    it('attaches when navigation adds the heading inside an existing wrapper', async () => {
        const data = { ...server(1), attributes: { ...server(1).attributes, name: 'Example Server' } };
        function Fixture() {
            const [ready, setReady] = useState(false);
            return <div><ConsoleRegion data={data} />
                <section><div>{ready && <h1>Example Server</h1>}</div></section>
                <button onClick={() => setReady(true)}>Finish navigation</button>
            </div>;
        }
        const { container } = mount(<Fixture />);
        await screen.findByText('Japan');
        fireEvent.click(screen.getByRole('button', { name: 'Finish navigation' }));
        await waitFor(() => expect(container.querySelector('section h1')?.parentElement?.querySelector('.rd-console-host')?.textContent).toBe('Japan'));
        expect(container.querySelector('.rd-console-fallback')).toBeNull();
    });
    it('reattaches when navigation replaces a nested header without remounting the slot', async () => {
        const data = { ...server(1), attributes: { ...server(1).attributes, name: 'Example Server' } };
        function Fixture() {
            const [version, setVersion] = useState(0);
            return <div><ConsoleRegion data={data} />
                <section><div key={version}><h1>Example Server</h1></div></section>
                <button onClick={() => setVersion(value => value + 1)}>Replace header</button>
            </div>;
        }
        const { container } = mount(<Fixture />);
        await waitFor(() => expect(container.querySelector('.rd-console-host')?.textContent).toBe('Japan'));
        fireEvent.click(screen.getByRole('button', { name: 'Replace header' }));
        await waitFor(() => expect(container.querySelector('section h1')?.parentElement?.querySelector('.rd-console-host')?.textContent).toBe('Japan'));
        expect(container.querySelectorAll('.rd-console-host')).toHaveLength(1);
    });
    it('batches native row lookups and shares duplicate server queries', async () => {
        mount(<><ServerListRegion data={server(1)} /><ServerListRegion data={server(2)} /><ServerConsoleRegion data={server(1)} /></>);
        await waitFor(() => expect(screen.getAllByText('Japan')).toHaveLength(3));
        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][1].uuids).toEqual([server(1).attributes.uuid, server(2).attributes.uuid]);
    });
    it('splits batches into requests of at most 100 servers', async () => {
        mount(<>{Array.from({ length: 101 }, (_, id) => <ServerListRegion key={id} data={server(id)} />)}</>);
        await waitFor(() => expect(screen.getAllByText('Japan')).toHaveLength(101));
        expect(mocks.post.mock.calls.map(call => call[1].uuids.length)).toEqual([100, 1]);
    });
    it('hides unassigned regions', async () => {
        mocks.post.mockResolvedValue({ data: { regions: {} } });
        const { container } = mount(<ServerListRegion data={server(1)} />);
        await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
        expect(container.textContent).toBe('');
    });
    it('removes stale display after access changes and permits a console retry', async () => {
        const { client } = mount(<ServerConsoleRegion data={server(1)} />);
        await screen.findByText('Japan');
        mocks.post.mockRejectedValueOnce(new Error('Unavailable'));
        await client.invalidateQueries({ queryKey: ['regiondisplay', 'servers'] });
        await screen.findByText('Region unavailable');
        expect(screen.queryByText('Japan')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Retry region' }));
        await screen.findByText('Japan');
    });
    it('keeps dashboard failure content non-interactive inside the native card link', async () => {
        mocks.post.mockRejectedValue(new Error('Unavailable'));
        mount(<ServerListRegion data={server(1)} />);
        await screen.findByText('Region unavailable');
        expect(screen.queryByRole('button')).toBeNull();
    });
});
