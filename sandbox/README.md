# Enable Banking sandbox exploration

A small, dependency-free Node.js tool for exploring the [Enable Banking](https://enablebanking.com)
sandbox API. This is **exploration only** — there is no detection engine, no database, and no app
logic here. It exists to answer questions about what real data from the API looks like before any
of that gets built.

Uses only Node's built-ins (`crypto`, `fetch`, `http`, `readline`, `process.loadEnvFile`) — no
`npm install` needed.

## One-time setup

1. In the [Enable Banking Control Panel](https://enablebanking.com/cp/applications), confirm your
   sandbox application has `http://localhost:3344/callback` registered as a redirect URL, and note
   the application ID and the path to the private key `.pem` file it generated for you.

2. **Move the private key file outside this repository** if it isn't already — anywhere on your
   machine works, e.g. `~/.secrets/enablebanking/sandbox.pem`. The tool actively refuses to run if
   it detects the key file inside the repo, so this isn't optional.

3. Copy the example env file and fill it in:

   ```sh
   cd sandbox
   cp .env.example .env
   ```

   Edit `.env`:
   - `EB_APPLICATION_ID` — your application ID from the Control Panel
   - `EB_PRIVATE_KEY_PATH` — absolute path to the `.pem` file, **outside** this repo
   - `EB_REDIRECT_URL` — must exactly match what's registered in the Control Panel
     (defaults to `http://localhost:3344/callback`)

`.env`, `*.pem`, and `sandbox/output/` are all gitignored (both at the repo root and locally in
this folder) — nothing here should ever get committed.

## The three commands

Run these from inside `/sandbox`, in order:

### `npm run banks`

Fetches `GET /aspsps` and lists every available bank with its country code. Prints a summary
confirming whether a Mock ASPSP and any Dutch (NL) banks are present in this sandbox.

### `npm run connect`

Runs the full authorization flow:

1. Fetches the ASPSP list and asks you to pick one (Enter = the Mock ASPSP, or type a name to
   search).
2. Starts a temporary local server on the port from `EB_REDIRECT_URL` (3344 by default).
3. Calls `POST /auth` and prints the authorization URL — **open this in your browser** and
   complete the (mock) authorization.
4. Catches the redirect back to `/callback`, exchanges the code via `POST /sessions`.
5. Saves `session_id` and the account list to `sandbox/output/session.json` and prints each
   account's IBAN, name, and currency.

Consent is requested for 90 days; you'll need to re-run this once it (or the session) expires.

### `npm run explore`

Uses the saved session to fetch balances and every available transaction (paginating via
`continuation_key`) for each account. Saves the raw API responses to `sandbox/output/` and prints
an analysis report answering:

1. **History depth** — oldest transaction date, and how many months of history are available
2. **Freshness** — how far behind "now" the newest transaction is (hours or days)
3. **Field coverage** — what percentage of transactions have a counterparty IBAN, a counterparty
   name, and remittance information, plus 3 full example transactions so you can see the real
   field structure

A machine-readable version of the same report is saved to `sandbox/output/analysis-report.json`.

## Errors

- **Auth errors (401/403)** almost always mean a JWT problem — the error message will point you
  at exactly which claim/header to check against the
  [Quick Start docs](https://enablebanking.com/docs/api/quick-start/).
- **Expired or invalid session** (errors while fetching accounts/balances/transactions) — re-run
  `npm run connect`.
