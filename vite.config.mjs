import { defineExtensionConfig } from '@pterodactyl/sdk/vite';
const config = defineExtensionConfig({ entry: 'src/client/index.tsx' });
config.base = './';
// Keep the flag collection outside the entry bundle; load only the displayed flags.
config.build.assetsInlineLimit = 0;
export default config;
