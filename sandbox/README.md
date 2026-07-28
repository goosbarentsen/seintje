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

## The three sandbox commands

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

## `npm run aggregate` — for real, personal data

The three commands above run against the *sandbox*, where the data is fake and printing an
example transaction is harmless. This fourth one is different: it is built for a real export of
a real account (the founder's own, via Tilisy, or later a pilot family's), and it is the only
sanctioned way to look at such a file.

```sh
npm run aggregate -- ~/path/to/export.json
```

It prints counts, dates and percentages to your terminal and nothing else — no amounts, no
names, no IBANs, no descriptions, and no example transactions. Counterparties are reduced to an
opaque digest before any grouping happens, so an identity cannot leak even by accident. Nothing
is written to disk; you read the report and decide yourself what to pass on.

The report covers: history depth (oldest/newest date, span, calendar months covered), freshness
(how old the newest transaction is), field coverage (counterparty IBAN, counterparty name,
description, and which of the three date fields are populated), transaction counts per ISO week
including empty weeks, and the category mix — how many transactions come from a counterparty
seen in three or more distinct months ("recurring"), how many of those sit at a fixed amount
(subscription-shaped), and how many are incidental.

Two parts of the report exist to settle questions the raw numbers cannot:

- **Time of day** (section 3). A date field being *populated* is not the same as it carrying a
  time — a bare date reads as midnight and looks like real data until you check. The report
  states per date field how many values carry a time at all, how many are not exactly midnight,
  whether `transaction_date` ever differs from `booking_date`, and, if real times exist, an
  hour-of-day histogram. If nothing carries a time, it says so plainly.
- **Coverage per transaction type** (section 4). A single overall IBAN percentage averages
  together types that answer different questions: card payments have no counterparty IBAN and
  never needed one. The report breaks coverage down per derived type, then gives the share of
  *outgoing credit transfers* carrying a counterparty IBAN — the slice where it matters.

Because the code vocabulary differs per bank, section 4 also prints the raw type codes it saw
with counts. That is how you check the classifier guessed right; if everything lands in
"unclassified", the classifier in `classify()` needs this bank's codes added.

Accepted input shapes: a bare array of transactions, `{"transactions": [...]}`, or an object
with an `accounts` array holding either.

**The rule around this file** (CLAUDE.md hard rule 5): personal bank data lives outside the repo
or in `sandbox/output/`, which is gitignored. It is never opened, read, printed or quoted — only
scripts touch it, and only aggregates leave the terminal.

## Errors

- **Auth errors (401/403)** almost always mean a JWT problem — the error message will point you
  at exactly which claim/header to check against the
  [Quick Start docs](https://enablebanking.com/docs/api/quick-start/).
- **Expired or invalid session** (errors while fetching accounts/balances/transactions) — re-run
  `npm run connect`.
