import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadConfig } from './config.js';
import { ebFetch } from './api.js';
import { explainError } from './errors.js';

async function pickAspsp(config) {
  console.log('Fetching ASPSP list to choose from...\n');
  const data = await ebFetch(config, '/aspsps');
  const aspsps = data.aspsps || [];
  if (!aspsps.length) throw new Error('No ASPSPs returned from /aspsps - cannot continue.');

  const mockDefault = aspsps.find((a) => /mock/i.test(a.name)) || aspsps[0];

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = (
    await rl.question(
      `Type an ASPSP name to search for, or press Enter for the default [${mockDefault.name}]: `
    )
  ).trim();
  rl.close();

  if (!answer) return mockDefault;

  const matches = aspsps.filter((a) => a.name.toLowerCase().includes(answer.toLowerCase()));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    console.log(`No ASPSP matched "${answer}". Falling back to default: ${mockDefault.name}`);
    return mockDefault;
  }

  console.log(`Multiple matches for "${answer}":`);
  matches.forEach((a, i) => console.log(`  ${i + 1}. ${a.name} (${a.country})`));
  const rl2 = readline.createInterface({ input: stdin, output: stdout });
  const idxAnswer = (await rl2.question('Pick a number: ')).trim();
  rl2.close();
  const idx = parseInt(idxAnswer, 10) - 1;
  if (Number.isInteger(idx) && matches[idx]) return matches[idx];
  console.log(`Could not parse choice. Falling back to default: ${mockDefault.name}`);
  return mockDefault;
}

function waitForCallback(port, expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        error
          ? `<html><body><h2>Authorization failed</h2><p>${error}: ${errorDescription || ''}</p><p>You can close this tab.</p></body></html>`
          : '<html><body><h2>Authorized</h2><p>You can close this tab and return to the terminal.</p></body></html>'
      );

      server.close();

      if (error) {
        reject(new Error(`Authorization was not granted: ${error}${errorDescription ? ' - ' + errorDescription : ''}`));
        return;
      }
      if (!code) {
        reject(new Error('Callback received without a "code" parameter.'));
        return;
      }
      if (expectedState && state !== expectedState) {
        reject(new Error(`Callback "state" did not match what was sent (expected ${expectedState}, got ${state}). Aborting.`));
        return;
      }
      resolve(code);
    });

    server.listen(port, () => {
      console.log(`Waiting for the callback on http://localhost:${port}/callback ...`);
    });

    server.on('error', reject);

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Timed out after 10 minutes waiting for the authorization callback.'));
    }, 10 * 60 * 1000);
    server.on('close', () => clearTimeout(timeout));
  });
}

async function main() {
  const config = loadConfig();
  const aspsp = await pickAspsp(config);
  console.log(`\nUsing ASPSP: ${aspsp.name} (${aspsp.country})\n`);

  const state = crypto.randomUUID();
  const validUntil = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

  const authBody = {
    access: { valid_until: validUntil },
    aspsp: { name: aspsp.name, country: aspsp.country },
    state,
    redirect_url: config.redirectUrl,
    psu_type: 'personal',
  };

  const authResp = await ebFetch(config, '/auth', { method: 'POST', body: authBody });
  const authUrl = authResp.url;
  if (!authUrl) throw new Error('No "url" field in /auth response - cannot continue.');

  console.log('Open this URL in your browser to authorize:\n');
  console.log(`  ${authUrl}\n`);

  const port = Number(new URL(config.redirectUrl).port) || 3344;
  const code = await waitForCallback(port, state);

  console.log('\nGot the authorization code. Creating session...');
  const session = await ebFetch(config, '/sessions', { method: 'POST', body: { code } });

  const sessionId = session.session_id;
  const accounts = session.accounts || [];

  fs.mkdirSync(config.outputDir, { recursive: true });
  const outPath = path.join(config.outputDir, 'session.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ session_id: sessionId, accounts, aspsp, saved_at: new Date().toISOString() }, null, 2)
  );

  console.log(`\n✓ Session saved to ${outPath}\n`);
  console.log(`${accounts.length} account(s):\n`);
  for (const acc of accounts) {
    const iban = acc.account_id?.iban || '(no IBAN)';
    console.log(`  ${iban}  ${acc.name || '(no name)'}  ${acc.currency || ''}`);
  }
  console.log('\nNext: npm run explore');
}

main().catch((err) => {
  if (err.status) explainError(err);
  else console.error('\n✗ ' + err.message);
  process.exit(1);
});
