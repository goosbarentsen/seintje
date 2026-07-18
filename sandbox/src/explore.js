import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { ebFetch } from './api.js';
import { explainError } from './errors.js';

function safeName(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function fetchAllTransactions(config, uid) {
  const all = [];
  let continuationKey;
  const dateFrom = new Date(Date.now() - 10 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  let page = 0;
  while (true) {
    page += 1;
    const query = { date_from: dateFrom };
    if (continuationKey) query.continuation_key = continuationKey;
    const resp = await ebFetch(config, `/accounts/${uid}/transactions`, { query });
    const txs = resp.transactions || [];
    all.push(...txs);
    continuationKey = resp.continuation_key;
    console.log(`    page ${page}: ${txs.length} transaction(s) (${all.length} total so far)`);
    if (!continuationKey) break;
    if (page > 200) {
      console.log('    stopping after 200 pages as a safety cap.');
      break;
    }
  }
  return all;
}

function pickCounterparty(tx) {
  const isDebit = tx.credit_debit_indicator === 'DBTR';
  return {
    party: isDebit ? tx.creditor : tx.debtor,
    account: isDebit ? tx.creditor_account : tx.debtor_account,
  };
}

function looksLikeIban(value) {
  return typeof value === 'string' && /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(value.replace(/\s+/g, ''));
}

function hasCounterpartyIban(tx) {
  const { account } = pickCounterparty(tx);
  if (!account || !account.identification) return false;
  if (account.scheme_name && account.scheme_name.toUpperCase() === 'IBAN') return true;
  return looksLikeIban(account.identification);
}

function hasCounterpartyName(tx) {
  const { party } = pickCounterparty(tx);
  return !!(party && party.name && String(party.name).trim());
}

function hasRemittanceInfo(tx) {
  if (Array.isArray(tx.remittance_information)) {
    return tx.remittance_information.some((line) => line && String(line).trim());
  }
  return !!(tx.remittance_information && String(tx.remittance_information).trim());
}

function txDate(tx) {
  return tx.booking_date || tx.transaction_date || tx.value_date || null;
}

function monthsBetween(oldIso, newIso) {
  const o = new Date(oldIso);
  const n = new Date(newIso);
  return (n.getFullYear() - o.getFullYear()) * 12 + (n.getMonth() - o.getMonth());
}

async function main() {
  const config = loadConfig();
  const sessionPath = path.join(config.outputDir, 'session.json');
  if (!fs.existsSync(sessionPath)) {
    console.error(`No saved session found at ${sessionPath}`);
    console.error('Run: npm run connect');
    process.exit(1);
  }
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const accounts = session.accounts || [];
  if (!accounts.length) {
    console.error('Saved session has no accounts.');
    process.exit(1);
  }

  fs.mkdirSync(config.outputDir, { recursive: true });

  const allTransactions = [];

  for (const acc of accounts) {
    const uid = acc.uid;
    const label = acc.account_id?.iban || acc.name || uid;
    console.log(`\n=== Account ${label} ===`);

    console.log('  Fetching balances...');
    const balances = await ebFetch(config, `/accounts/${uid}/balances`);
    fs.writeFileSync(
      path.join(config.outputDir, `balances-${safeName(label)}.json`),
      JSON.stringify(balances, null, 2)
    );
    for (const b of balances.balances || []) {
      console.log(`    ${b.name || b.balance_type}: ${b.balance_amount?.amount} ${b.balance_amount?.currency}`);
    }

    console.log('  Fetching transactions (paginating)...');
    const txs = await fetchAllTransactions(config, uid);
    fs.writeFileSync(
      path.join(config.outputDir, `transactions-${safeName(label)}.json`),
      JSON.stringify(txs, null, 2)
    );
    console.log(`  ${txs.length} transaction(s) saved.`);

    allTransactions.push(...txs);
  }

  console.log('\n\n========== ANALYSIS REPORT ==========\n');

  if (!allTransactions.length) {
    console.log('No transactions were returned at all - nothing to analyze.');
    return;
  }

  const dated = allTransactions
    .map((t) => ({ t, d: txDate(t) }))
    .filter((x) => x.d)
    .sort((a, b) => new Date(a.d) - new Date(b.d));

  const oldest = dated[0];
  const newest = dated[dated.length - 1];

  console.log('1) HISTORY DEPTH');
  console.log(`   Oldest transaction date: ${oldest.d}`);
  console.log(`   Newest transaction date: ${newest.d}`);
  console.log(`   Span: ~${monthsBetween(oldest.d, newest.d)} month(s) of history`);

  console.log('\n2) FRESHNESS');
  const now = new Date();
  const newestDate = new Date(newest.d);
  const diffMs = now - newestDate;
  const diffHours = diffMs / 3600000;
  const diffDays = diffHours / 24;
  console.log(`   Newest transaction: ${newest.d}`);
  console.log(`   Now: ${now.toISOString()}`);
  console.log(`   Gap: ${diffDays >= 2 ? diffDays.toFixed(1) + ' days' : diffHours.toFixed(1) + ' hours'} behind real time`);

  console.log(`\n3) FIELD COVERAGE (n=${allTransactions.length})`);
  const withIban = allTransactions.filter(hasCounterpartyIban).length;
  const withName = allTransactions.filter(hasCounterpartyName).length;
  const withRemit = allTransactions.filter(hasRemittanceInfo).length;
  const pct = (n) => ((n / allTransactions.length) * 100).toFixed(1);
  console.log(`   Counterparty IBAN:           ${withIban}/${allTransactions.length} (${pct(withIban)}%)`);
  console.log(`   Counterparty name:           ${withName}/${allTransactions.length} (${pct(withName)}%)`);
  console.log(`   Remittance info/description: ${withRemit}/${allTransactions.length} (${pct(withRemit)}%)`);

  console.log('\n   3 example transactions (full raw fields):\n');
  const examples = allTransactions.slice(0, 3);
  examples.forEach((t, i) => {
    console.log(`   --- Example ${i + 1} ---`);
    console.log(
      JSON.stringify(t, null, 2)
        .split('\n')
        .map((l) => '   ' + l)
        .join('\n')
    );
    console.log('');
  });

  const reportPath = path.join(config.outputDir, 'analysis-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        transaction_count: allTransactions.length,
        oldest_transaction_date: oldest.d,
        newest_transaction_date: newest.d,
        months_of_history: monthsBetween(oldest.d, newest.d),
        freshness_hours_behind: diffHours,
        field_coverage: {
          counterparty_iban_pct: Number(pct(withIban)),
          counterparty_name_pct: Number(pct(withName)),
          remittance_info_pct: Number(pct(withRemit)),
        },
      },
      null,
      2
    )
  );
  console.log(`\nFull analysis saved to ${reportPath}`);
  console.log(`Raw data saved to ${config.outputDir}/`);
}

main().catch((err) => {
  if (err.status) explainError(err);
  else console.error('\n✗ ' + err.message);
  process.exit(1);
});
