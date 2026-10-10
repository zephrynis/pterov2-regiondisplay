import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SdkServer } from '@pterodactyl/sdk';
import { ServerConsoleRegion as ConsoleBadge } from './RegionBadge';

export default function ConsoleRegion({ data }: { data: SdkServer }) {
    const anchor = useRef<HTMLSpanElement>(null);
    const [destination, setDestination] = useState<HTMLSpanElement | null>(null);
    const name = data.attributes.name;

    useLayoutEffect(() => {
        const scope = anchor.current?.parentElement;
        if (!scope) return;
        const host = document.createElement('span');
        host.className = 'rd-console-host';
        const observer = new MutationObserver(() => attach());
        const attach = () => {
            // The current SDK has no console-title slot. Add only our own host;
            // leave the native heading, description, and controls in React's care.
            const heading = [...scope.querySelectorAll('h1')].find(element =>
                element.textContent === name && !element.closest('.rd-console-mobile, .rd-console-fallback'));
            const target = heading?.parentElement;
            if (target) {
                if (host.parentElement !== target) target.append(host);
                setDestination(current => current === host ? current : host);
            } else {
                host.remove();
                setDestination(current => current === null ? current : null);
            }
            // Navigation can insert the heading later or replace an intermediate
            // wrapper. Discover it throughout the slot's scope until it exists,
            // then watch each ancestor without subscribing to terminal output.
            observer.disconnect();
            if (!target) {
                observer.observe(scope, { childList: true, subtree: true, characterData: true });
            } else {
                let ancestor: HTMLElement | null = target;
                while (ancestor) {
                    observer.observe(ancestor, { childList: true });
                    if (ancestor === scope) break;
                    ancestor = ancestor.parentElement;
                }
            }
        };
        attach();
        return () => { observer.disconnect(); host.remove(); };
    }, [data.attributes.uuid, name]);

    return <>
        <span ref={anchor} hidden />
        {destination && createPortal(<ConsoleBadge data={data} />, destination)}
        <div className={destination ? 'rd-console-mobile' : 'rd-console-fallback'}>
            <h1>{name}</h1><ConsoleBadge data={data} />
        </div>
    </>;
}
