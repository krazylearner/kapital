#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const CASES = path.join(FIXTURES, 'cases.json');
const SCRIPTS = ['js/csv.js', 'js/samples.js', 'js/parsers.js', 'js/ledger.js', 'js/calc.js'];
const NUM_TOL = 0.01;
const XIRR_TOL = 1e-6;

function fixedDateClass(iso) {
  const stamp = new Date(iso).getTime();
  return class FixedDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(stamp);
      else super(...args);
    }
    static now() {
      return stamp;
    }
  };
}

function loadApp(today) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  sandbox.Date = fixedDateClass(today);
  SCRIPTS.forEach(function (rel) {
    const file = path.join(ROOT, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: rel });
  });
  return sandbox.window.Kapital;
}

function fixtureEntries(G, c) {
  const entries = [];
  (c.samples || []).forEach(function (name) {
    const sample = (G.samples || []).filter(function (s) {
      return s.name === name;
    })[0];
    if (!sample) throw new Error('Unknown sample: ' + name);
    entries.push({ name: name, text: sample.text });
  });
  (c.files || []).forEach(function (rel) {
    const file = path.join(ROOT, rel);
    entries.push({ name: path.basename(file), text: fs.readFileSync(file, 'utf8') });
  });
  if (!entries.length) throw new Error('Case has no files or samples');
  return entries;
}

function runCase(G, c) {
  const entries = fixtureEntries(G, c);
  const warnings = [];
  let ledger = [];

  entries.forEach(function (entry, i) {
    const parsed = G.parsers.parseText(entry.text, {
      name: entry.name,
      override: c.override || 'AUTO'
    });
    parsed.warnings.forEach(function (w) {
      warnings.push(entry.name + ': ' + w);
    });
    ledger = ledger.concat(G.ledger.fromParsed(parsed, {
      id: i + 1,
      file: entry.name,
      type: parsed.type
    }));
  });

  const result = G.calc.compute({
    ledger: ledger,
    warnings: warnings,
    settings: c.settings || {}
  });

  const kinds = {};
  const flags = {};
  ledger.forEach(function (row) {
    kinds[row.kind] = (kinds[row.kind] || 0) + 1;
    (row.flags || []).forEach(function (f) {
      flags[f] = (flags[f] || 0) + 1;
    });
  });

  return {
    ledgerRows: ledger.length,
    kinds: kinds,
    flags: flags,
    warningCount: warnings.length,
    warnings: warnings,
    empty: result.empty,
    fyCount: result.fys.length,
    fys: result.fys.map(function (f) {
      return { label: f.label, netPL: round2(f.netPL), tax: round2(f.tax) };
    }),
    totals: result.totals ? {
      invested: round2(result.totals.invested),
      proceeds: round2(result.totals.proceeds),
      charges: round2(result.totals.charges),
      netPL: round2(result.totals.netPL),
      stNet: round2(result.totals.stNet),
      ltNet: round2(result.totals.ltNet),
      tax: round2(result.totals.tax)
    } : null,
    xirr: result.xirr == null ? null : Math.round(result.xirr * 1e6) / 1e6
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmt(n) {
  return typeof n === 'number' ? String(n) : JSON.stringify(n);
}

function near(actual, expected) {
  if (typeof actual !== 'number' || typeof expected !== 'number') return actual === expected;
  return Math.abs(actual - expected) <= NUM_TOL;
}

function compare(label, actual, expected, tol, failures) {
  const ok = typeof tol === 'number'
    ? typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) <= tol
    : near(actual, expected);
  if (!ok) failures.push(label + ': expected ' + fmt(expected) + ', got ' + fmt(actual));
}

function compareTotals(prefix, actual, expected, failures) {
  Object.keys(expected || {}).forEach(function (key) {
    compare(prefix + '.' + key, actual ? actual[key] : null, expected[key], NUM_TOL, failures);
  });
}

function validate(c, observed) {
  const failures = [];
  const e = c.expect || {};

  if (e.ledgerRows != null) compare('ledgerRows', observed.ledgerRows, e.ledgerRows, null, failures);
  if (e.empty != null) compare('empty', observed.empty, e.empty, null, failures);
  if (e.fyCount != null) compare('fyCount', observed.fyCount, e.fyCount, null, failures);
  if (e.warningCount != null) compare('warningCount', observed.warningCount, e.warningCount, null, failures);
  if (e.xirr !== undefined) compare('xirr', observed.xirr, e.xirr, XIRR_TOL, failures);

  Object.keys(e.kinds || {}).forEach(function (kind) {
    compare('kinds.' + kind, observed.kinds[kind] || 0, e.kinds[kind], null, failures);
  });
  Object.keys(e.flags || {}).forEach(function (flag) {
    compare('flags.' + flag, observed.flags[flag] || 0, e.flags[flag], null, failures);
  });
  compareTotals('totals', observed.totals, e.totals, failures);

  (e.fys || []).forEach(function (expected, i) {
    const actual = observed.fys[i];
    if (!actual) {
      failures.push('fys[' + i + ']: missing (expected ' + JSON.stringify(expected) + ')');
      return;
    }
    compare('fys[' + i + '].label', actual.label, expected.label, null, failures);
    if (expected.netPL !== undefined) compare('fys[' + i + '].netPL', actual.netPL, expected.netPL, NUM_TOL, failures);
    if (expected.tax !== undefined) compare('fys[' + i + '].tax', actual.tax, expected.tax, NUM_TOL, failures);
  });

  (e.warningsInclude || []).forEach(function (needle) {
    const hit = observed.warnings.some(function (w) {
      return w.indexOf(needle) >= 0;
    });
    if (!hit) failures.push('warningsInclude: no warning contains ' + JSON.stringify(needle));
  });

  return failures;
}

function main() {
  const args = process.argv.slice(2);
  const show = args.indexOf('--show') >= 0;
  const filter = args.filter(function (a) {
    return a.charAt(0) !== '-';
  })[0];

  const spec = JSON.parse(fs.readFileSync(CASES, 'utf8'));
  const today = spec.today || '2026-11-16T00:00:00';
  const cases = (spec.cases || []).filter(function (c) {
    return !filter || c.name === filter;
  });
  if (!cases.length) {
    console.error('No cases matched' + (filter ? ': ' + filter : ''));
    process.exit(1);
  }

  let failed = 0;
  cases.forEach(function (c) {
    let observed;
    try {
      observed = runCase(loadApp(today), c);
    } catch (err) {
      failed += 1;
      console.log('FAIL ' + c.name + ' — threw: ' + err.message);
      return;
    }

    if (show) {
      console.log('CASE ' + c.name + ' (' + (c.description || '') + ')');
      console.log(JSON.stringify(observed, null, 2));
      return;
    }

    const failures = validate(c, observed);
    if (failures.length) {
      failed += 1;
      console.log('FAIL ' + c.name);
      failures.forEach(function (f) {
        console.log('  - ' + f);
      });
    } else {
      console.log('ok   ' + c.name);
    }
  });

  if (show) return;
  const total = cases.length;
  console.log('');
  console.log((total - failed) + '/' + total + ' cases passed' + (failed ? ', ' + failed + ' failed' : ''));
  if (failed) process.exit(1);
}

main();
