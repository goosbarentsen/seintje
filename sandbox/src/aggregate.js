// Aggregate-only analysis of a real transaction export (Tilisy / Enable Banking JSON).
//
// PRIVACY CONTRACT — see CLAUDE.md hard rule 5.
// This script exists so that real bank data can be analysed without anyone reading it.
// It prints counts, percentages, dates and ratios, and nothing else: no amounts, no
// names, no IBANs, no descriptions, not a single example transaction. Counterparties are
// grouped by a truncated SHA-256 of their identifier, so even a stray console.log during
// future edits cannot leak an identity. Nothing is written to disk — terminal only, so
// the founder decides what to share.
//
// Anything added here must hold to that: if a new statistic cannot be expressed as a
// number, a date or a percentage, it does not belong in this file. The one considered
// exception is the transaction-type code histogram in section 4: scheme codes like
// "PMNT | ICDT-ESCT" are a closed vocabulary describing a payment *kind*, never anything
// about a person, and knowing them is what makes coverage-per-type answerable at all.
// They are length-capped and character-filtered so free text cannot ride along.
//
// Usage:  npm run aggregate -- /path/to/export.json
//         node src/aggregate.js /path/to/export.json

import fs from 'node:fs';
import crypto from 'node:crypto';

// --- reading the export ------------------------------------------------------
// Tilisy exports are not guaranteed to have one shape, so accept the plausible ones:
// a bare array, {transactions: [...]}, or a per-account wrapper holding either.
function extractTransactions(root) {
  if (Array.isArray(root)) {
    if (root.every(looksLikeTransaction)) return root;
    // array of accounts, each holding transactions
    return root.flatMap((entry) => extractTransactions(entry));
  }
  if (!root || typeof root !== 'object') return [];
  for (const key of ['transactions', 'items', 'results', 'data']) {
    if (Array.isArray(root[key])) return extractTransactions(root[key]);
  }
  if (Array.isArray(root.accounts)) return root.accounts.flatMap((a) => extractTransactions(a));
  return [];
}

function looksLikeTransaction(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return (
    'booking_date' in v ||
    'transaction_date' in v ||
    'value_date' in v ||
    'transaction_amount' in v ||
    'credit_debit_indicator' in v
  );
}

// --- field shapes ------------------------------------------------------------
// Confirmed against live Enable Banking data during sandbox exploration (see
// src/explore.js): counterparty sits in creditor/debtor depending on direction, and
// account identifiers are {iban, other: {identification, scheme_name}}, not flat.
function isDebit(tx) {
  return tx.credit_debit_indicator === 'DBIT';
}

function pickCounterparty(tx) {
  const debit = isDebit(tx);
  return {
    party: debit ? tx.creditor : tx.debtor,
    account: debit ? tx.creditor_account : tx.debtor_account,
  };
}

function looksLikeIban(value) {
  return typeof value === 'string' && /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(value.replace(/\s+/g, ''));
}

function counterpartyIban(tx) {
  const { account } = pickCounterparty(tx);
  if (!account) return null;
  if (account.iban && looksLikeIban(account.iban)) return account.iban;
  const other = account.other;
  if (!other || !other.identification) return null;
  if (other.scheme_name && other.scheme_name.toUpperCase() === 'IBAN') return other.identification;
  return looksLikeIban(other.identification) ? other.identification : null;
}

function counterpartyName(tx) {
  const { party } = pickCounterparty(tx);
  const name = party && party.name;
  return name && String(name).trim() ? String(name).trim() : null;
}

function description(tx) {
  const r = tx.remittance_information;
  if (Array.isArray(r)) {
    const joined = r.filter(Boolean).join(' ').trim();
    return joined || null;
  }
  if (r && String(r).trim()) return String(r).trim();
  const alt = tx.remittance_information_unstructured || tx.description;
  return alt && String(alt).trim() ? String(alt).trim() : null;
}

function txDate(tx) {
  return tx.booking_date || tx.transaction_date || tx.value_date || null;
}

// Amounts are read for grouping only (a fixed-amount series is what makes a
// subscription recognisable) and are never printed, aggregated or totalled.
function amountKey(tx) {
  const raw = tx.transaction_amount?.amount ?? tx.amount?.amount ?? tx.amount;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return `${isDebit(tx) ? 'D' : 'C'}${Math.round(Math.abs(n) * 100)}`;
}

// Does a date field carry a usable time of day? Part of what we need to measure depends on
// having one, and a field being *populated* is not the same as it being *timed* — a bare
// "2026-07-27" reads as midnight and looks like real data until you check.
function timeInfo(value) {
  if (typeof value !== 'string') return { present: false, hasTime: false, nonMidnight: false, hour: null };
  const m = value.match(/[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return { present: true, hasTime: false, nonMidnight: false, hour: null };
  const nonMidnight = !(m[1] === '00' && m[2] === '00' && (!m[3] || m[3] === '00'));
  return { present: true, hasTime: true, nonMidnight, hour: Number(m[1]) };
}

// --- transaction type --------------------------------------------------------
// Counterparty coverage is only meaningful per transaction type. Card payments have no
// counterparty IBAN and never needed one, so a single overall percentage averages together
// types that answer completely different questions. The slice we care about is outgoing
// credit transfers; coverage *within* that slice is the number worth knowing.
//
// The exact code vocabulary per bank is not known up front, so the raw codes are printed
// as a histogram alongside the derived classes — that is what lets the classifier below
// be corrected against reality. Scheme codes are a closed vocabulary, not personal data;
// they are still length-capped and stripped of anything outside [A-Za-z0-9 /_.-] so no
// free text can ride along.
function typeTokens(tx) {
  const b = tx.bank_transaction_code || {};
  const p = tx.proprietary_bank_transaction_code || {};
  return [b.code, b.sub_code, b.description, p.code].filter(Boolean).map(String);
}

function safeLabel(s) {
  const cleaned = String(s).replace(/[^A-Za-z0-9 /_.-]/g, '').trim();
  if (!cleaned) return '(empty)';
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}…` : cleaned;
}

function classify(tx) {
  const hay = typeTokens(tx).join(' ').toUpperCase();
  if (!hay) return 'unclassified (no type code)';
  if (/CWDL|ATM|CASH|GELDAUTOMAAT|OPNAME/.test(hay)) return 'cash withdrawal';
  if (/DDBT|ESDD|DIRECT ?DEBIT|INCASSO/.test(hay)) return 'direct debit';
  if (/CCRD|DCRD|POSD|CARD|BETAALAUTOMAAT|\bPIN\b/.test(hay)) return 'card payment';
  if (/ICDT|ESCT|RCDT|RRTN|TRF|TRANSFER|OVERBOEKING|SEPA/.test(hay)) return 'credit transfer';
  return 'other';
}

// Identity is reduced to an opaque digest immediately, so nothing downstream in this
// script ever holds a readable IBAN or name.
function counterpartyKey(tx) {
  const iban = counterpartyIban(tx);
  const raw = iban ? `iban:${iban.replace(/\s+/g, '').toUpperCase()}` : null;
  const viaName = raw
    ? null
    : (() => {
        const name = counterpartyName(tx);
        if (!name) return null;
        return `name:${name.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()}`;
      })();
  const source = raw || viaName;
  if (!source) return null;
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
}

// --- date helpers (UTC throughout, so a timezone never shifts a week boundary) ---
function parseDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mondayOf(d) {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (m.getUTCDay() + 6) % 7; // Monday = 0
  m.setUTCDate(m.getUTCDate() - dow);
  return m;
}

function isoWeekKey(d) {
  const t = mondayOf(d);
  const thursday = new Date(t);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round((thursday - mondayOf(firstThursday)) / (7 * 24 * 3600 * 1000));
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// --- report ------------------------------------------------------------------
function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run aggregate -- /path/to/export.json');
    console.error('');
    console.error('Keep the file outside the repo, or inside sandbox/output/ (gitignored).');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`No file at ${file}`);
    process.exit(1);
  }

  let root;
  try {
    root = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    // Deliberately does not echo the offending line: that would be file content.
    console.error(`Could not parse ${file} as JSON (${err.name}).`);
    process.exit(1);
  }

  const txs = extractTransactions(root);
  if (!txs.length) {
    console.error('No transactions found in that file. Expected an array of transactions,');
    console.error('an object with a "transactions" array, or accounts holding either.');
    process.exit(1);
  }

  const n = txs.length;
  const pct = (count) => `${((count / n) * 100).toFixed(1)}%`;

  console.log('');
  console.log('========== AGGREGATE REPORT ==========');
  console.log('Counts, dates and percentages only — no amounts, names, IBANs or descriptions.');
  console.log(`Source file: ${file}`);
  console.log(`Transactions: ${n}`);

  // 1. history depth
  const dated = txs
    .map((tx) => ({ tx, d: parseDate(txDate(tx)) }))
    .filter((x) => x.d)
    .sort((a, b) => a.d - b.d);
  const undated = n - dated.length;

  console.log('');
  console.log('1) HISTORY DEPTH');
  if (!dated.length) {
    console.log('   No usable dates found — the rest of this report needs them.');
    process.exit(1);
  }
  const oldest = dated[0].d;
  const newest = dated[dated.length - 1].d;
  const spanDays = Math.round((newest - oldest) / 86400000);
  const spanMonths =
    (newest.getUTCFullYear() - oldest.getUTCFullYear()) * 12 +
    (newest.getUTCMonth() - oldest.getUTCMonth());
  const distinctMonths = new Set(dated.map((x) => monthKey(x.d)));
  console.log(`   Oldest transaction: ${oldest.toISOString().slice(0, 10)}`);
  console.log(`   Newest transaction: ${newest.toISOString().slice(0, 10)}`);
  console.log(`   Span: ${spanMonths} month(s) / ${spanDays} days`);
  console.log(`   Calendar months containing at least one transaction: ${distinctMonths.size}`);
  if (undated) console.log(`   Without a usable date: ${undated} (${pct(undated)}) — excluded below`);

  // 2. freshness
  const now = new Date();
  const gapHours = (now - newest) / 3600000;
  const newestTimed = timeInfo(txDate(dated[dated.length - 1].tx)).hasTime;
  console.log('');
  console.log('2) FRESHNESS');
  console.log(`   Today: ${now.toISOString().slice(0, 10)}`);
  console.log(
    `   Newest transaction is ${gapHours >= 48 ? `${(gapHours / 24).toFixed(1)} days` : `${gapHours.toFixed(1)} hours`} old`
  );
  if (!newestTimed) {
    console.log('   Measured from midnight — that date carries no time, so this figure has a');
    console.log('   ~24h floor and cannot be read as connection latency. See section 3.');
  }

  // 3. field coverage
  const withIban = txs.filter((tx) => counterpartyIban(tx)).length;
  const withName = txs.filter((tx) => counterpartyName(tx)).length;
  const withDesc = txs.filter((tx) => description(tx)).length;
  const withBooking = txs.filter((tx) => tx.booking_date).length;
  const withTxDate = txs.filter((tx) => tx.transaction_date).length;
  const withValueDate = txs.filter((tx) => tx.value_date).length;
  console.log('');
  console.log(`3) FIELD COVERAGE (n=${n})`);
  console.log(`   Counterparty IBAN: ${withIban} (${pct(withIban)})`);
  console.log(`   Counterparty name: ${withName} (${pct(withName)})`);
  console.log(`   Description:       ${withDesc} (${pct(withDesc)})`);
  console.log(`   booking_date:      ${withBooking} (${pct(withBooking)})`);
  console.log(`   transaction_date:  ${withTxDate} (${pct(withTxDate)})`);
  console.log(`   value_date:        ${withValueDate} (${pct(withValueDate)})`);

  // 3b. do those dates carry a time?
  console.log('');
  console.log('   Time of day:');
  const hours = [];
  for (const field of ['booking_date', 'transaction_date', 'value_date']) {
    const infos = txs.map((tx) => timeInfo(tx[field])).filter((i) => i.present);
    if (!infos.length) {
      console.log(`     ${(field + ':').padEnd(18)} not present`);
      continue;
    }
    const timed = infos.filter((i) => i.hasTime);
    const real = timed.filter((i) => i.nonMidnight);
    console.log(
      `     ${(field + ':').padEnd(18)} ${timed.length}/${infos.length} carry a time, of which ${real.length} not exactly midnight`
    );
    if (field === 'transaction_date') hours.push(...real.map((i) => i.hour));
  }
  const bothDates = txs.filter((tx) => tx.booking_date && tx.transaction_date);
  const differing = bothDates.filter((tx) => tx.booking_date !== tx.transaction_date).length;
  if (bothDates.length) {
    console.log(
      `     transaction_date differs from booking_date: ${differing}/${bothDates.length} (${((differing / bothDates.length) * 100).toFixed(1)}%)`
    );
  }
  if (hours.length) {
    console.log('');
    console.log('     Hour-of-day distribution (transaction_date), counts only:');
    const buckets = new Array(24).fill(0);
    for (const h of hours) buckets[h] += 1;
    const hmax = Math.max(...buckets);
    buckets.forEach((c, h) => {
      if (!c) return;
      console.log(`       ${String(h).padStart(2, '0')}:00  ${String(c).padStart(4)}  ${'█'.repeat(Math.round((c / hmax) * 30))}`);
    });
    console.log('     → time-of-day analysis is possible on this export.');
  } else {
    console.log('');
    console.log('     → NO usable time of day anywhere in this export.');
    console.log('       Anything that depends on when in the day something happened cannot');
    console.log('       be derived from this data alone.');
  }

  // 4. transaction types, and IBAN coverage within each
  console.log('');
  console.log('4) TRANSACTION TYPE AND COUNTERPARTY COVERAGE PER TYPE');
  const classes = new Map();
  for (const tx of txs) {
    const c = classify(tx);
    if (!classes.has(c)) classes.set(c, { n: 0, iban: 0, name: 0, out: 0, outIban: 0 });
    const bucket = classes.get(c);
    bucket.n += 1;
    if (counterpartyIban(tx)) bucket.iban += 1;
    if (counterpartyName(tx)) bucket.name += 1;
    if (isDebit(tx)) {
      bucket.out += 1;
      if (counterpartyIban(tx)) bucket.outIban += 1;
    }
  }
  const share = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : 'n/a');
  for (const [name, b] of [...classes].sort((x, y) => y[1].n - x[1].n)) {
    console.log(`   ${name.padEnd(28)} ${String(b.n).padStart(5)} (${share(b.n, n).padStart(6)})  IBAN ${share(b.iban, b.n).padStart(6)}  name ${share(b.name, b.n).padStart(6)}`);
  }
  const transfers = classes.get('credit transfer');
  console.log('');
  if (transfers && transfers.out) {
    console.log(`   Outgoing credit transfers: ${transfers.out}`);
    console.log(`   Of those, with a counterparty IBAN: ${transfers.outIban} (${share(transfers.outIban, transfers.out)})`);
    if (transfers.outIban < transfers.out) {
      console.log('   → below 100%: not every transfer counterparty can be identified by IBAN,');
      console.log('     so a fallback identifier is needed.');
    } else {
      console.log('   → 100%: every outgoing transfer counterparty is identifiable by IBAN.');
    }
  } else {
    console.log('   No transactions classified as credit transfers — check the raw codes below;');
    console.log('   the classifier may not know this bank\'s vocabulary yet.');
  }
  console.log('');
  console.log('   Raw type codes seen (code vocabulary, not transaction content):');
  const rawCodes = new Map();
  for (const tx of txs) {
    const key = typeTokens(tx).map(safeLabel).join(' | ') || '(no type code)';
    rawCodes.set(key, (rawCodes.get(key) || 0) + 1);
  }
  const sortedCodes = [...rawCodes].sort((a, b) => b[1] - a[1]);
  for (const [label, count] of sortedCodes.slice(0, 25)) {
    console.log(`     ${String(count).padStart(5)}  ${label}`);
  }
  if (sortedCodes.length > 25) console.log(`     ... and ${sortedCodes.length - 25} more distinct code combinations`);

  // 5. volume per week
  const weekCounts = new Map();
  for (const { d } of dated) {
    const k = isoWeekKey(d);
    weekCounts.set(k, (weekCounts.get(k) || 0) + 1);
  }
  // Walk every week in the span, so empty weeks (gaps in the data) show up as zeroes.
  const weeks = [];
  for (let cur = mondayOf(oldest); cur <= mondayOf(newest); cur.setUTCDate(cur.getUTCDate() + 7)) {
    const k = isoWeekKey(cur);
    weeks.push({ key: k, start: cur.toISOString().slice(0, 10), count: weekCounts.get(k) || 0 });
  }
  const counts = weeks.map((w) => w.count);
  const max = Math.max(...counts, 1);
  const empty = counts.filter((c) => c === 0).length;

  console.log('');
  console.log(`5) TRANSACTIONS PER WEEK (${weeks.length} weeks)`);
  console.log(
    `   min ${Math.min(...counts)} · median ${median(counts)} · mean ${(dated.length / weeks.length).toFixed(1)} · max ${max}`
  );
  console.log(`   Weeks with no transactions: ${empty}`);
  console.log('');
  for (const w of weeks) {
    const bar = '█'.repeat(Math.round((w.count / max) * 40));
    console.log(`   ${w.key} (from ${w.start})  ${String(w.count).padStart(3)}  ${bar}`);
  }

  // 6. recurring vs incidental
  // Two levels, because they answer different questions: a counterparty seen across many
  // months is a familiar payee, while the same counterparty at an identical amount across
  // months is a subscription-shaped charge. Both matter, for different reasons.
  const byParty = new Map();
  const byPartyAmount = new Map();
  let unkeyed = 0;
  for (const { tx, d } of dated) {
    const key = counterpartyKey(tx);
    if (!key) {
      unkeyed += 1;
      continue;
    }
    const m = monthKey(d);
    if (!byParty.has(key)) byParty.set(key, new Set());
    byParty.get(key).add(m);
    const amt = amountKey(tx);
    if (amt) {
      const ak = `${key}|${amt}`;
      if (!byPartyAmount.has(ak)) byPartyAmount.set(ak, new Set());
      byPartyAmount.get(ak).add(m);
    }
  }
  const RECURRING_MONTHS = 3;
  let recurringParty = 0;
  let fixedSeries = 0;
  for (const { tx } of dated) {
    const key = counterpartyKey(tx);
    if (!key) continue;
    if ((byParty.get(key)?.size || 0) >= RECURRING_MONTHS) recurringParty += 1;
    const amt = amountKey(tx);
    if (amt && (byPartyAmount.get(`${key}|${amt}`)?.size || 0) >= RECURRING_MONTHS) fixedSeries += 1;
  }
  const incidental = dated.length - recurringParty - unkeyed;
  const dpct = (c) => `${((c / dated.length) * 100).toFixed(1)}%`;
  const debits = txs.filter((tx) => isDebit(tx)).length;

  console.log('');
  console.log(`6) CATEGORY MIX (n=${dated.length} dated transactions)`);
  console.log(`   "Recurring" = same counterparty in ${RECURRING_MONTHS} or more distinct calendar months.`);
  console.log(`   Recurring counterparty:        ${recurringParty} (${dpct(recurringParty)})`);
  console.log(`     of which fixed-amount series: ${fixedSeries} (${dpct(fixedSeries)}) — subscription-shaped`);
  console.log(`   Incidental:                    ${incidental} (${dpct(incidental)})`);
  console.log(`   No identifiable counterparty:  ${unkeyed} (${dpct(unkeyed)}) — uncategorisable`);
  console.log(`   Distinct counterparties: ${byParty.size}`);
  console.log('');
  console.log(`   Money out / money in: ${debits} (${pct(debits)}) / ${n - debits} (${pct(n - debits)})`);

  console.log('');
  console.log('======================================');
  console.log('Nothing was written to disk. Review the above and share only what you choose.');
  console.log('');
}

main();
