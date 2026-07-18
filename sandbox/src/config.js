import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SANDBOX_ROOT = path.resolve(__dirname, '..');

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function expandHome(p) {
  if (p.startsWith('~')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', p.slice(1));
  }
  return p;
}

export function loadConfig() {
  const envPath = path.join(SANDBOX_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.error(`Missing .env file at ${envPath}`);
    console.error('Copy .env.example to .env and fill in your values first:');
    console.error(`  cp ${path.join(SANDBOX_ROOT, '.env.example')} ${envPath}`);
    process.exit(1);
  }
  process.loadEnvFile(envPath);

  const applicationId = process.env.EB_APPLICATION_ID;
  const rawKeyPath = process.env.EB_PRIVATE_KEY_PATH;
  const redirectUrl = process.env.EB_REDIRECT_URL;

  const missing = [];
  if (!applicationId) missing.push('EB_APPLICATION_ID');
  if (!rawKeyPath) missing.push('EB_PRIVATE_KEY_PATH');
  if (!redirectUrl) missing.push('EB_REDIRECT_URL');
  if (missing.length) {
    console.error(`Missing required value(s) in .env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const keyPath = path.resolve(expandHome(rawKeyPath));

  // --- security gate: refuse to run if the private key is inside this repo ---
  const repoRoot = findRepoRoot(SANDBOX_ROOT);
  if (repoRoot && (keyPath === repoRoot || keyPath.startsWith(repoRoot + path.sep))) {
    console.error('');
    console.error('REFUSING TO PROCEED: your private key file is inside this git repository.');
    console.error(`  Key path:  ${keyPath}`);
    console.error(`  Repo root: ${repoRoot}`);
    console.error('');
    console.error('Move the .pem file outside the repo (e.g. ~/.secrets/enablebanking/), update');
    console.error('EB_PRIVATE_KEY_PATH in .env to the new location, then run this command again.');
    process.exit(1);
  }

  if (!fs.existsSync(keyPath)) {
    console.error(`Private key file not found at: ${keyPath}`);
    console.error('Check EB_PRIVATE_KEY_PATH in .env.');
    process.exit(1);
  }

  const privateKey = fs.readFileSync(keyPath, 'utf8');
  if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
    console.error(`File at ${keyPath} does not look like a PEM private key.`);
    console.error('(Not printing its contents here - check the file itself.)');
    process.exit(1);
  }

  return {
    applicationId,
    privateKey, // never log this
    redirectUrl,
    apiOrigin: 'https://api.enablebanking.com',
    repoRoot,
    outputDir: path.join(SANDBOX_ROOT, 'output'),
  };
}
