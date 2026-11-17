#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const CASES = path.join(FIXTURES, 'cases.json');
const SCRIPTS = ['js/csv.js', 'js/export.js', 'js/samples.js', 'js/parsers.js', 'js/ledger.js', 'js/isin-map.js', 'js/calc.js', 'js/itr.js'];
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

function xlsxStub() {
  return {
    utils: {
      book_new: function () {
        return { SheetNames: [], Sheets: {} };
      },
      aoa_to_sheet: function (rows) {
        return { rows: rows };
      },
      book_append_sheet: function (wb, ws, name) {
        wb.SheetNames.push(name);
        wb.Sheets[name] = ws;
      }
    },
    write: function () {
      return new Uint8Array(0);
    }
  };
}

function loadApp(today) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  sandbox.Date = fixedDateClass(today);
  sandbox.window.XLSX = xlsxStub();
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

  Object.keys(c.manual || {}).forEach(function (name) {
    const res = G.isin.setManual(name, c.manual[name]);
    if (!res.ok) throw new Error('Bad manual ISIN for ' + name + ': ' + res.error);
  });

  const isin = G.isin.applyToLedger(ledger);

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
    isin: isin,
    isinRows: ledger.map(function (row) {
      return {
        instrument: row.instrument,
        isin: row.isin || null,
        source: row.isinSource || null,
        confidence: row.isinConfidence || null,
        suggestion: row.isinSuggestion ? row.isinSuggestion.isin : null
      };
    }),
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
  Object.keys(e.isin || {}).forEach(function (key) {
    compare('isin.' + key, observed.isin ? observed.isin[key] : null, e.isin[key], null, failures);
  });
  (e.isinRows || []).forEach(function (expected) {
    const actual = observed.isinRows.filter(function (row) {
      return row.instrument === expected.instrument;
    })[0];
    if (!actual) {
      failures.push('isinRows[' + expected.instrument + ']: not found');
      return;
    }
    ['isin', 'source', 'confidence', 'suggestion'].forEach(function (key) {
      if (expected[key] !== undefined) {
        compare('isinRows[' + expected.instrument + '].' + key, actual[key], expected[key], null, failures);
      }
    });
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

function runExportCase(G, c) {
  if (c.mode === 'print') {
    return { text: G.export.printView(c) };
  }
  if (c.mode === 'workbook') {
    const wb = G.export.workbook(c.sheets);
    const sheets = {};
    wb.SheetNames.forEach(function (name) {
      sheets[name] = wb.Sheets[name].rows;
    });
    return { sheetNames: wb.SheetNames.slice(), sheets: sheets };
  }
  return { text: G.export.csv(c.rows, c.schema, c.options || {}) };
}

function validateExport(c, observed) {
  const failures = [];

  if (c.expectLines) {
    compare('csv', observed.text, c.expectLines.join('\r\n') + '\r\n', null, failures);
  }
  (c.expectInclude || []).forEach(function (needle) {
    if (String(observed.text).indexOf(needle) < 0) failures.push('print: missing ' + JSON.stringify(needle));
  });
  (c.expectExclude || []).forEach(function (needle) {
    if (String(observed.text).indexOf(needle) >= 0) failures.push('print: unexpected ' + JSON.stringify(needle));
  });
  if (c.expectNoBom && String(observed.text).charCodeAt(0) === 0xfeff) {
    failures.push('csv: unexpected UTF-8 BOM');
  }
  if (c.expectSheetNames) {
    compare('sheetNames', JSON.stringify(observed.sheetNames), JSON.stringify(c.expectSheetNames), null, failures);
  }
  Object.keys(c.expectSheets || {}).forEach(function (name) {
    compare(
      'sheets[' + name + ']',
      JSON.stringify(observed.sheets ? observed.sheets[name] : null),
      JSON.stringify(c.expectSheets[name]),
      null,
      failures
    );
  });

  return failures;
}

function runExportSuite(show) {
  const file = path.join(FIXTURES, 'export-cases.json');
  if (!fs.existsSync(file)) return 0;
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  const G = loadApp(spec.today || '2026-11-16T00:00:00');
  const cases = spec.cases || [];
  let failed = 0;

  cases.forEach(function (c) {
    let observed;
    try {
      observed = runExportCase(G, c);
    } catch (err) {
      failed += 1;
      console.log('FAIL export/' + c.name + ' \u2014 threw: ' + err.message);
      return;
    }

    if (show) {
      console.log('CASE export/' + c.name + ' (' + (c.description || '') + ')');
      console.log(JSON.stringify(observed, null, 2));
      return;
    }

    const failures = validateExport(c, observed);
    if (failures.length) {
      failed += 1;
      console.log('FAIL export/' + c.name);
      failures.forEach(function (f) {
        console.log('  - ' + f);
      });
    } else {
      console.log('ok   export/' + c.name);
    }
  });

  if (show) return 0;
  console.log('');
  console.log((cases.length - failed) + '/' + cases.length + ' export cases passed' + (failed ? ', ' + failed + ' failed' : ''));
  return failed;
}

function runItrCase(G, c) {
  G.itr.reset();
  const entries = fixtureEntries(G, c);
  let ledger = [];

  entries.forEach(function (entry, i) {
    const parsed = G.parsers.parseText(entry.text, {
      name: entry.name,
      override: c.override || 'AUTO'
    });
    ledger = ledger.concat(G.ledger.fromParsed(parsed, {
      id: i + 1,
      file: entry.name,
      type: parsed.type
    }));
  });

  Object.keys(c.manual || {}).forEach(function (name) {
    const res = G.isin.setManual(name, c.manual[name]);
    if (!res.ok) throw new Error('Bad manual ISIN for ' + name + ': ' + res.error);
  });
  G.isin.applyToLedger(ledger);

  Object.keys(c.overrides || {}).forEach(function (name) {
    G.itr.overrideByName(name, c.overrides[name]);
  });

  const events = G.itr.buildEvents(ledger);
  const rows = G.itr.project(events, {});
  const fys = G.itr.fyOptions(rows);
  const fy = c.fy != null ? c.fy : (fys.length ? fys[fys.length - 1] : null);

  const counts = { '112A': 0, '111A': 0 };
  rows.forEach(function (r) {
    if (r.section) counts[r.section] += 1;
  });

  const scoped = fy == null ? rows : rows.filter(function (r) { return r.fy === fy; });

  return {
    fyOptions: fys,
    fy: fy,
    counts: counts,
    blocking: rows.filter(function (r) { return G.itr.isBlocking(r); }).length,
    outOfScope: scoped.filter(function (r) { return !r.section && !r.excluded; }).length,
    outOfScopeReasons: scoped.filter(function (r) { return !r.section && !r.excluded; }).map(function (r) {
      return r.excludeReason || 'Not eligible';
    }),
    rows: rows.filter(function (r) { return r.section; }).map(function (r) {
      return {
        instrument: r.instrument,
        section: r.section,
        fy: r.fy,
        acquiredCode: r.acquiredCode,
        transferredCode: r.transferredCode,
        saleValue: round2(r.sellValue),
        actualCost: round2(r.actualCost),
        deemedCost: round2(r.costWithoutIndexation),
        transferExpenses: round2(r.transferExpenses),
        gain: r.gain == null ? null : round2(r.gain),
        excluded: r.excluded,
        flags: r.flags.slice()
      };
    }),
    csv112A: fy == null ? '' : G.itr.csv112A(rows, fy),
    csv111A: fy == null ? '' : G.itr.csv111A(rows, fy),
    print: fy == null ? '' : G.export.printView(G.itr.printSpec(fy, {
      rows: rows,
      result: null,
      settings: c.settings || {}
    }))
  };
}

function validateItr(c, observed) {
  const failures = [];
  const e = c.expect || {};

  if (e.fyOptions) {
    compare('fyOptions', JSON.stringify(observed.fyOptions), JSON.stringify(e.fyOptions), null, failures);
  }
  if (e.blocking != null) compare('blocking', observed.blocking, e.blocking, null, failures);
  if (e.outOfScope != null) compare('outOfScope', observed.outOfScope, e.outOfScope, null, failures);
  if (e.outOfScopeReason && !observed.outOfScopeReasons.some(function (r) {
    return r.indexOf(e.outOfScopeReason) >= 0;
  })) {
    failures.push('outOfScopeReason: no row carries ' + JSON.stringify(e.outOfScopeReason));
  }

  Object.keys(e.counts || {}).forEach(function (section) {
    compare('counts.' + section, observed.counts[section] || 0, e.counts[section], null, failures);
  });

  (e.rows || []).forEach(function (expected) {
    const actual = observed.rows.filter(function (row) {
      return row.instrument === expected.instrument;
    })[0];
    if (!actual) {
      failures.push('rows[' + expected.instrument + ']: not found');
      return;
    }
    ['section', 'fy', 'acquiredCode', 'transferredCode', 'saleValue', 'actualCost', 'deemedCost', 'transferExpenses', 'gain', 'excluded'].forEach(function (key) {
      if (expected[key] !== undefined) {
        compare('rows[' + expected.instrument + '].' + key, actual[key], expected[key], key === 'section' || key === 'fy' || key === 'acquiredCode' || key === 'transferredCode' || key === 'excluded' ? null : NUM_TOL, failures);
      }
    });
  });

  Object.keys(e.flags || {}).forEach(function (name) {
    const actual = observed.rows.filter(function (row) { return row.instrument === name; })[0];
    if (!actual) {
      failures.push('flags[' + name + ']: row not found');
      return;
    }
    e.flags[name].forEach(function (flag) {
      if (actual.flags.indexOf(flag) < 0) {
        failures.push('flags[' + name + ']: missing ' + flag + ' (got ' + actual.flags.join(', ') + ')');
      }
    });
  });

  [['csv112A', 'Share/Unit acquired(1a)'], ['csv111A', 'Financial year']].forEach(function (pair) {
    const key = pair[0];
    if (!e[key]) return;
    const lines = String(observed[key]).split('\r\n').filter(function (line) {
      return line !== '';
    });
    const header = lines.shift() || '';
    if (header.indexOf(pair[1]) < 0) {
      failures.push(key + ': unexpected header ' + JSON.stringify(header));
    }
    if (key === 'csv112A' && header.indexOf('Balance(14) = 6 - 13') < 0) {
      failures.push(key + ': header is missing the 112A Balance(14) column');
    }
    const expected = e[key].join('\r\n') + '\r\n';
    const body = lines.length ? lines.join('\r\n') + '\r\n' : '';
    compare(key, body, expected, null, failures);
  });

  (e.printInclude || []).forEach(function (needle) {
    if (String(observed.print).indexOf(needle) < 0) failures.push('print: missing ' + JSON.stringify(needle));
  });

  return failures;
}

function runItrSuite(show) {
  const file = path.join(FIXTURES, 'itr-cases.json');
  if (!fs.existsSync(file)) return 0;
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cases = spec.cases || [];
  let failed = 0;

  cases.forEach(function (c) {
    let observed;
    try {
      observed = runItrCase(loadApp(spec.today || '2026-11-16T00:00:00'), c);
    } catch (err) {
      failed += 1;
      console.log('FAIL itr/' + c.name + ' \u2014 threw: ' + err.message);
      return;
    }

    if (show) {
      console.log('CASE itr/' + c.name + ' (' + (c.description || '') + ')');
      console.log(JSON.stringify(observed, null, 2));
      return;
    }

    const failures = validateItr(c, observed);
    if (failures.length) {
      failed += 1;
      console.log('FAIL itr/' + c.name);
      failures.forEach(function (f) {
        console.log('  - ' + f);
      });
    } else {
      console.log('ok   itr/' + c.name);
    }
  });

  if (show) return 0;
  console.log('');
  console.log((cases.length - failed) + '/' + cases.length + ' itr cases passed' + (failed ? ', ' + failed + ' failed' : ''));
  return failed;
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
  const exportFailed = runExportSuite(false);
  const itrFailed = runItrSuite(false);
  if (failed || exportFailed || itrFailed) process.exit(1);
}

main();
