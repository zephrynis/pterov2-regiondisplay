import { Button, type SdkServer } from '@pterodactyl/sdk';
import { useRegion, type Region } from './regions';

const flagFiles = import.meta.glob<string>('/generated/flags/*.svg', { eager: true, query: '?url', import: 'default' });

export function RegionBadge({ region }: { region: Region }) {
    const flag = flagFiles[`/generated/flags/${region.country_code.toLowerCase()}.svg`];
    return <span className="rd-badge" title={region.name}>
        {flag && <img src={flag} width={20} height={15} alt="" aria-hidden="true" />}
        <span>{region.name}</span>
    </span>;
}

function ServerRegion({ data, placement = 'row' }: { data: SdkServer; placement?: 'row' | 'inline' | 'console' }) {
    const query = useRegion(data.attributes.uuid);
    const consolePage = placement === 'console';
    const className = consolePage ? 'rd-console' : placement === 'inline' ? 'rd-server-inline' : 'rd-server';
    // A failed refresh must not keep displaying a region after access is revoked.
    if (query.isError) return <span className={`${className} rd-unavailable`}>
        <span role="status">Region unavailable</span>
        {consolePage ? <Button.Text type="button" size="xsmall" disabled={query.isFetching} onClick={event => {
            event.preventDefault(); event.stopPropagation(); void query.refetch();
        }}>Retry region</Button.Text> : <span className="rd-help" title="Reload the page to retry">(reload to retry)</span>}
    </span>;
    if (!query.data) return null;
    return <span className={className}><RegionBadge region={query.data} /></span>;
}

export function ServerListRegion({ data }: { data: SdkServer }) {
    return <ServerRegion data={data} />;
}

export function ServerInlineRegion({ data }: { data: SdkServer }) {
    return <ServerRegion data={data} placement="inline" />;
}

export function ServerConsoleRegion({ data }: { data: SdkServer }) {
    return <ServerRegion data={data} placement="console" />;
}
