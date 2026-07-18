import { createAuthJwt } from './jwt.js';

export async function ebFetch(config, apiPath, { method = 'GET', query, body } = {}) {
  const jwt = createAuthJwt(config); // fresh token per call, cheap and avoids expiry edge cases

  const url = new URL(config.apiOrigin + apiPath);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`, // never logged
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`Enable Banking API responded ${res.status} ${res.statusText} for ${method} ${apiPath}`);
    err.status = res.status;
    err.body = data;
    err.apiPath = apiPath;
    throw err;
  }

  return data;
}
