import { readFile, writeFile } from 'node:fs/promises';
import { loadAddresses, addressSource, addressSourceItem } from '../winter-command-preview/addresses.mjs';
const collection = JSON.parse(await readFile(new URL('../winter-command-preview/neighborhoods.geojson', import.meta.url), 'utf8'));
const results = [], queue = [...collection.features];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const feature = queue.shift(), name = feature.properties.FeatureName;
    try {
      const rows = await loadAddresses(feature.geometry);
      const result = { neighborhood: name, status: 'pass', homes: rows.filter(r => r.kind === 'home').length, commercial: rows.filter(r => r.kind === 'biz').length };
      results.push(result); console.log(JSON.stringify(result));
    } catch (error) { results.push({ neighborhood: name, status: 'fail', error: error.message }); }
  }
}));
results.sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));
await writeFile(new URL('../tests/results/addresses.json', import.meta.url), JSON.stringify({ checked_at: new Date().toISOString(), source: addressSource, source_item: addressSourceItem, method: 'Actual paginated HTTPS responses passed through the production loader; exact city polygon filtering including holes.', results }, null, 2) + '\n');
if (results.some(r => r.status !== 'pass')) { console.error(JSON.stringify(results.filter(r => r.status !== 'pass'))); process.exitCode = 1; }
