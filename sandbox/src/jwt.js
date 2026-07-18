import crypto from 'node:crypto';

// Enable Banking auth JWT, per https://enablebanking.com/docs/api/quick-start/
// header: {typ, alg: RS256, kid: <application id>}
// claims: {iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp}
// Signed with the application's private key, sent as "Authorization: Bearer <jwt>".
export function createAuthJwt({ applicationId, privateKey }) {
  const header = { typ: 'JWT', alg: 'RS256', kid: applicationId };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  return `${signingInput}.${signature.toString('base64url')}`;
  // Never log the return value of this function - it's a bearer credential.
}
