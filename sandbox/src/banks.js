import { loadConfig } from './config.js';
import { ebFetch } from './api.js';
import { explainError } from './errors.js';

async function main() {
  const config = loadConfig();
  console.log('Fetching available ASPSPs from Enable Banking...\n');

  const data = await ebFetch(config, '/aspsps');
  const aspsps = data.aspsps || [];

  if (!aspsps.length) {
    console.log('No ASPSPs returned.');
    return;
  }

  const sorted = [...aspsps].sort(
    (a, b) => (a.country || '').localeCompare(b.country || '') || a.name.localeCompare(b.name)
  );
  for (const a of sorted) {
    console.log(`  ${(a.country || '??').padEnd(3)} ${a.name}`);
  }

  const mock = aspsps.filter((a) => /mock/i.test(a.name));
  const dutch = aspsps.filter((a) => a.country === 'NL');

  console.log(`\n${aspsps.length} ASPSP(s) total.\n`);
  console.log('--- Summary ---');
  console.log(
    mock.length
      ? `✓ Mock ASPSP present: ${mock.map((a) => a.name).join(', ')}`
      : '✗ No Mock ASPSP found in this list.'
  );
  console.log(
    dutch.length
      ? `✓ ${dutch.length} Dutch (NL) bank(s): ${dutch.map((a) => a.name).join(', ')}`
      : '✗ No Dutch (NL) banks found in this list.'
  );
}

main().catch((err) => {
  explainError(err);
  process.exit(1);
});
