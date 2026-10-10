import './styles.css';
import { definePterodactylExtension } from '@pterodactyl/sdk';
import LocationRegion from './LocationRegion';
import { ServerListRegion, ServerInlineRegion } from './RegionBadge';
import ConsoleRegion from './ConsoleRegion';

export default definePterodactylExtension({ setup({ slots }) {
    slots.register('panel.locations.detail.after', LocationRegion);
    slots.register('dashboard.serverRow.name.after', ServerInlineRegion);
    slots.register('dashboard.serverRow.after', ServerListRegion);
    slots.register('server.console.before', ConsoleRegion);
} });
