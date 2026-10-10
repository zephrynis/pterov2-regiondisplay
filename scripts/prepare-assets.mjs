import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dependency = new URL('node_modules/flag-icons/', root);
const entries = JSON.parse(await readFile(new URL('country.json', dependency), 'utf8'))
    .filter(country => country.iso).sort((a, b) => a.code.localeCompare(b.code));
if (entries.length !== 249) throw new Error('Review changes to the ISO country catalog before building.');
await mkdir(new URL('generated/flags/', root), { recursive: true });
await mkdir(new URL('resources/', root), { recursive: true });
const countries = {};
for (const country of entries) {
    countries[country.code.toUpperCase()] = country.name;
    await copyFile(new URL(country.flag_4x3, dependency), new URL(`generated/flags/${country.code}.svg`, root));
}
await writeFile(new URL('resources/countries.json', root), JSON.stringify(countries, null, 2) + '\n');
await copyFile(new URL('LICENSE', dependency), new URL('resources/flag-icons.LICENSE', root));
console.log(`Prepared ${entries.length} country names and local flags.`);
