export function explainError(err) {
  console.error('');
  console.error('✗ ' + err.message);
  if (err.body) {
    const bodyStr = JSON.stringify(err.body, null, 2);
    console.error(bodyStr.length > 2000 ? bodyStr.slice(0, 2000) + '\n... (truncated)' : bodyStr);
  }
  console.error('');

  const apiPath = err.apiPath || '';
  const touchesSession = apiPath.startsWith('/accounts/') || apiPath === '/sessions';

  if (touchesSession && [400, 401, 403, 404, 410].includes(err.status)) {
    console.error('This likely means the saved session has expired or is no longer valid.');
    console.error('Run: npm run connect');
  } else if ([401, 403].includes(err.status)) {
    console.error('This looks like an authentication problem with the JWT. Check:');
    console.error('  - EB_APPLICATION_ID in .env matches the application ID in the Control Panel');
    console.error('  - EB_PRIVATE_KEY_PATH points at the PEM generated for THAT SAME application');
    console.error('  - The JWT header "kid" must equal the application ID');
    console.error('  - The JWT claims must be exactly iss: "enablebanking.com", aud: "api.enablebanking.com"');
    console.error('  - Your system clock must be roughly correct (iat/exp are time-based)');
    console.error('  Docs: https://enablebanking.com/docs/api/quick-start/');
  } else {
    console.error(`Unexpected API error (status ${err.status}). Check the response body above against:`);
    console.error('https://enablebanking.com/docs/api/reference/');
  }
}
