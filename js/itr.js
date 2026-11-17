(function () {
  const G = (window.Kapital = window.Kapital || {});
  const $ = function (id) {
    return typeof document === 'undefined' ? null : document.getElementById(id);
  };

  const FMV_CUTOFF = new Date(2018, 0, 31);
  const REGIME_CUTOFF = new Date(2024, 6, 23);
  const TEMPLATE_VERSION = 'AY 2025-26 / AY 2026-27 CSV112A (15 columns, col 1b)';

  const RULES = {
    legacy: {
      id: 'legacy',
      label: 'Legacy (transfer before 23 Jul 2024)',
      stcg: 15,
      ltcg: 10,
      exemption: 100000
    },
    current: {
      id: 'current',
      label: 'Current (transfer on/after 23 Jul 2024)',
      stcg: 20,
      ltcg: 12.5,
      exemption: 125000
    }
  };

  const HEADERS_112A = [
    'Share/Unit acquired(1a)',
    'Share/Unit Transferred(1b)',
    'ISIN Code(2)',
    'Name of the Share/Unit(3)',
    'No. of Shares/Units(4)',
    'Sale-price per Share/Unit(5)',
    'Full Value of Consideration(Total Sale Value)(6) = 4 * 5',
    'Cost of acquisition without indexation(7)',
    'Cost of acquisition(8)',
    'If the long term capital asset was acquired before 01.02.2018(9)',
    'Fair Market Value per share/unit as on 31st January,2018(10)',
    'Total Fair Market Value of capital asset as per section 55(2)(ac)(11) = 4 * 10',
    'Expenditure wholly and exclusively in connection with transfer(12)',
    'Total deductions(13) = 7 + 12',
    'Balance(14) = 6 - 13'
  ];

  const HEADERS_111A = [
    'Financial year',
    'Rule set',
    'ISIN',
    'Name of the Share/Unit',
    'No. of Shares/Units',
    'Date of acquisition',
    'Date of transfer',
    'Full Value of Consideration',
    'Cost of acquisition',
    'Expenditure on transfer',
    'Capital gain'
  ];

  const overrides = new Map();
  const state = { fy: null, tab: '112A', acknowledged: false };
  let last = { rows: [], fys: [], result: null, settings: null };

  function isDate(d) {
    return d instanceof Date && !isNaN(d.getTime());
  }

  function dayStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function fyOf(d) {
    return G.calc.fyOf(dayStart(d));
  }

  function fyLabel(startYear) {
    return G.calc.fyLabel(startYear);
  }

  function ruleFor(date, settings) {
    const s = settings || G.calc.defaults;
    const legacy = dayStart(date) < REGIME_CUTOFF;
    return legacy
      ? { id: 'legacy', label: RULES.legacy.label, stcg: s.legacyStcg, ltcg: s.legacyLtcg, exemption: s.legacyExemption }
      : { id: 'current', label: RULES.current.label, stcg: s.stcg, ltcg: s.ltcg, exemption: s.exemption };
  }

  function nameKey(name) {
    if (G.isin && G.isin.normalizeName) return G.isin.normalizeName(name);
    return String(name == null ? '' : name).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function validIsin(v) {
    if (G.isin && G.isin.isValidIsin) return G.isin.isValidIsin(v);
    return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(v == null ? '' : v).trim());
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function numOrNull(v) {
    return typeof v === 'number' && isFinite(v) ? v : null;
  }

  function buildEvents(ledger) {
    const events = [];
    const groups = new Map();
    const tradeKeys = new Set();

    (ledger || []).forEach(function (row) {
      if (!row || (row.kind !== 'BUY' && row.kind !== 'SELL')) return;
      const key = row.isin || row.instrument;
      if (!key) return;
      tradeKeys.add(key);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    groups.forEach(function (list) {
      list.sort(function (a, b) {
        return (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0) ||
          (a.kind === 'BUY' ? -1 : 1);
      });

      const lots = [];
      list.forEach(function (row) {
        if (row.kind === 'BUY') {
          lots.push({
            row: row,
            remaining: row.qty,
            chargePerUnit: row.qty > 0 ? (row.charges || 0) / row.qty : 0
          });
          return;
        }
        if (!isDate(row.date) || !(row.qty > 0) || row.price == null) return;
        let remaining = row.qty;
        const sellPerUnit = (row.charges || 0) / row.qty;
        while (remaining > 1e-9 && lots.length) {
          const lot = lots[0];
          const take = Math.min(lot.remaining, remaining);
          events.push({
            key: null,
            sourceFile: row.sourceFile,
            sourceType: row.sourceType,
            broker: row.broker,
            instrument: row.instrument || lot.row.instrument,
            isin: row.isin || lot.row.isin,
            isinSource: row.isinSource || lot.row.isinSource,
            isinConfidence: row.isinConfidence || lot.row.isinConfidence,
            isinSuggestion: row.isinSuggestion || lot.row.isinSuggestion,
            assetClass: lot.row.assetClass || row.assetClass,
            qty: take,
            buyDate: lot.row.date,
            sellDate: row.date,
            buyPrice: lot.row.price,
            sellPrice: row.price,
            buyValue: take * lot.row.price,
            sellValue: take * row.price,
            buyCharges: take * lot.chargePerUnit,
            sellCharges: take * sellPerUnit,
            holdingType: null,
            holdingMonths: null,
            statedPLOnly: false
          });
          lot.remaining -= take;
          remaining -= take;
          if (lot.remaining <= 1e-9) lots.shift();
        }
      });
    });

    (ledger || []).forEach(function (row) {
      if (!row || row.kind !== 'ROUNDTRIP') return;
      if (tradeKeys.has(row.isin || row.instrument)) return;
      const buyValue = row.buyValue != null ? row.buyValue : (row.buyPrice != null ? row.qty * row.buyPrice : null);
      const sellValue = row.sellValue != null ? row.sellValue : (row.sellPrice != null ? row.qty * row.sellPrice : null);
      events.push({
        key: null,
        sourceFile: row.sourceFile,
        sourceType: row.sourceType,
        broker: row.broker,
        instrument: row.instrument,
        isin: row.isin,
        isinSource: row.isinSource,
        isinConfidence: row.isinConfidence,
        isinSuggestion: row.isinSuggestion,
        assetClass: row.assetClass,
        qty: row.qty,
        buyDate: row.buyDate,
        sellDate: row.sellDate,
        buyPrice: row.buyPrice,
        sellPrice: row.sellPrice,
        buyValue: buyValue,
        sellValue: sellValue,
        buyCharges: 0,
        sellCharges: row.charges || 0,
        holdingType: row.holdingType,
        holdingMonths: row.holdingMonths,
        statedPLOnly: buyValue == null || sellValue == null
      });
    });

    const seen = {};
    events.forEach(function (ev) {
      const base = [
        nameKey(ev.instrument),
        isDate(ev.buyDate) ? ev.buyDate.getTime() : 'na',
        isDate(ev.sellDate) ? ev.sellDate.getTime() : 'na',
        ev.qty
      ].join('|');
      seen[base] = (seen[base] || 0) + 1;
      ev.key = base + '|' + seen[base];
    });

    return events;
  }

  function termOf(ev) {
    if (ev.holdingType === 'LT') return 'LT';
    if (ev.holdingType === 'ST') return 'ST';
    if (!isDate(ev.buyDate) || !isDate(ev.sellDate)) return null;
    return G.calc.isLongTerm(ev.assetClass, ev.buyDate, ev.sellDate, ev.holdingMonths) ? 'LT' : 'ST';
  }

  function overrideFor(ev) {
    if (overrides.has(ev.key)) return overrides.get(ev.key) || {};
    const byName = overrides.get('name:' + nameKey(ev.instrument));
    return byName || {};
  }

  function isEligibleAsset(assetClass) {
    return assetClass === 'EQUITY' || assetClass === 'EQUITY_MF';
  }

  function is112AEligible(row) {
    if (!row) return false;
    if (!isEligibleAsset(row.assetClass)) return false;
    if (!isDate(row.sellDate)) return false;
    if (row.sttPaid === false) return false;
    if (row.term !== 'LT') return false;
    return numOrNull(row.sellValue) != null && numOrNull(row.buyValue) != null;
  }

  function grandfatheredCost(row) {
    const actual = numOrNull(row.actualCost);
    if (!isDate(row.buyDate)) {
      return { applicable: false, actual: actual, fmv: null, deemed: actual, source: 'missing' };
    }
    if (dayStart(row.buyDate) > FMV_CUTOFF) {
      return { applicable: false, actual: actual, fmv: null, deemed: actual, source: 'post_2018' };
    }
    const fmvTotal = numOrNull(row.fmvTotal);
    if (fmvTotal == null || actual == null || numOrNull(row.sellValue) == null) {
      return { applicable: true, actual: actual, fmv: null, deemed: null, source: 'missing' };
    }
    const capped = Math.max(actual, Math.min(fmvTotal, row.sellValue));
    return {
      applicable: true,
      actual: actual,
      fmv: fmvTotal,
      deemed: capped,
      source: row.fmvSource || 'manual'
    };
  }

  function project(events, options) {
    const opts = options || {};
    const rows = [];
    const useOverrides = opts.overrides === false ? null : overrideFor;

    (events || []).forEach(function (ev) {
      const ov = useOverrides ? useOverrides(ev) : {};
      const row = Object.assign({}, ev);
      row.fy = isDate(ev.sellDate) ? fyOf(ev.sellDate) : null;
      row.term = termOf(ev);
      row.section = isEligibleAsset(ev.assetClass)
        ? (row.term === 'LT' ? '112A' : row.term === 'ST' ? '111A' : null)
        : null;
      row.rule = isDate(ev.sellDate) ? ruleFor(ev.sellDate, opts.settings) : null;
      row.acquiredCode = isDate(ev.buyDate) && dayStart(ev.buyDate) <= FMV_CUTOFF ? 'BE' : 'AE';
      row.transferredCode = isDate(ev.sellDate) && dayStart(ev.sellDate) < REGIME_CUTOFF ? 'BE' : 'AE';
      row.actualCost = ev.buyValue == null ? null : ev.buyValue + (ev.buyCharges || 0);
      row.costWithoutIndexation = row.actualCost;
      row.transferExpenses = ev.sellCharges || 0;
      row.fmvPerUnit = numOrNull(ov.fmv);
      row.fmvSource = row.fmvPerUnit != null ? 'manual' : 'missing';
      row.fmvTotal = row.fmvPerUnit != null && ev.qty != null ? ev.qty * row.fmvPerUnit : null;
      row.sttPaid = ov.stt === false ? false : null;
      row.excluded = ov.excluded === true || row.sttPaid === false;
      row.excludeReason = ov.reason || (row.sttPaid === false ? 'STT not paid on transfer' : null);
      row.flags = [];

      const gf = grandfatheredCost(row);
      row.grandfathered = gf;
      if (gf.applicable) {
        row.costWithoutIndexation = gf.deemed;
        if (gf.deemed != null) row.actualCost = gf.actual;
      }
      row.gain = row.costWithoutIndexation == null || row.sellValue == null
        ? null
        : row.sellValue - row.costWithoutIndexation - row.transferExpenses;

      if (!isEligibleAsset(ev.assetClass)) {
        row.flags.push('not_112a_asset');
        if (!row.excludeReason) row.excludeReason = 'Debt mutual funds are reported in Schedule CG, not 112A/111A';
      }
      if (row.term == null) row.flags.push('needs_dates');
      if (row.statedPLOnly || row.sellValue == null || row.buyValue == null) row.flags.push('needs_values');
      if (row.transferredCode === 'BE' && row.rule) row.flags.push('legacy_transfer');
      if (row.acquiredCode === 'AE') row.flags.push('consolidated_row');
      if (row.sttPaid == null) row.flags.push('assumed_stt');
      if (ev.isinSuggestion) row.isinSuggestion = ev.isinSuggestion;

      if (row.section === '112A') {
        if (row.acquiredCode === 'BE') {
          if (!validIsin(row.isin)) row.flags.push('needs_isin');
          if (row.fmvTotal == null) row.flags.push('needs_fmv');
        } else if (!validIsin(row.isin)) {
          row.flags.push('isin_consolidated');
        }
      } else if (row.section === '111A') {
        if (!validIsin(row.isin)) row.flags.push('needs_isin');
      }

      if (row.flags.indexOf('needs_isin') >= 0 && row.isin) row.flags.push('invalid_isin');
      rows.push(row);
    });

    return rows;
  }

  function blockingFlags(row) {
    const blocking = ['needs_isin', 'invalid_isin', 'needs_fmv', 'needs_values', 'needs_dates'];
    return (row.flags || []).filter(function (f) {
      return blocking.indexOf(f) >= 0;
    });
  }

  function isBlocking(row) {
    if (row.excluded || !row.section) return false;
    return blockingFlags(row).length > 0;
  }

  function rowsFor(rows, fy, section) {
    return (rows || []).filter(function (r) {
      return r.fy === fy && r.section === section;
    });
  }

  function totalsOf(rows) {
    const t = { rows: 0, excluded: 0, sale: 0, cost: 0, expenses: 0, gain: 0, assumedStt: 0 };
    (rows || []).forEach(function (r) {
      t.rows += 1;
      if (r.excluded) {
        t.excluded += 1;
        return;
      }
      t.sale += r.sellValue || 0;
      t.cost += r.actualCost || 0;
      t.expenses += r.transferExpenses || 0;
      t.gain += r.gain || 0;
      if (r.sttPaid == null) t.assumedStt += 1;
    });
    return t;
  }

  function fyOptions(rows) {
    const seen = {};
    (rows || []).forEach(function (r) {
      if (r.fy != null && r.section) seen[r.fy] = true;
    });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  function sanitizeName(name) {
    return String(name == null ? '' : name)
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'CONSOLIDATED';
  }

  function columnNumber(value, decimals) {
    if (value == null || typeof value !== 'number' || !isFinite(value)) return '';
    const factor = Math.pow(10, decimals == null ? 2 : decimals);
    const rounded = Math.round(value * factor) / factor;
    return rounded === 0 ? '0' : String(rounded);
  }

  function schema112A() {
    return {
      templateVersion: TEMPLATE_VERSION,
      lineEnding: '\r\n',
      columns: [
        { key: 'acquiredCode', header: HEADERS_112A[0], type: 'text' },
        { key: 'transferredCode', header: HEADERS_112A[1], type: 'text' },
        { key: 'isinExport', header: HEADERS_112A[2], type: 'text' },
        { key: 'nameExport', header: HEADERS_112A[3], type: 'text' },
        { key: 'qty', header: HEADERS_112A[4], type: 'number', decimals: 4, value: function (r) { return r.consolidated ? null : r.qty; } },
        { key: 'sellPrice', header: HEADERS_112A[5], type: 'number', decimals: 4, value: function (r) { return r.consolidated ? null : r.sellPrice; } },
        { key: 'sellValue', header: HEADERS_112A[6], type: 'number', decimals: 2 },
        { key: 'costWithoutIndexation', header: HEADERS_112A[7], type: 'number', decimals: 2, value: function (r) { return r.costWithoutIndexation; } },
        { key: 'actualCost', header: HEADERS_112A[8], type: 'number', decimals: 2, value: function (r) { return r.actualCost; } },
        { key: 'lowerOfSaleAndFmv', header: HEADERS_112A[9], type: 'number', decimals: 2, value: function (r) { return r.consolidated || r.acquiredCode !== 'BE' ? null : Math.min(r.sellValue, r.fmvTotal); } },
        { key: 'fmvPerUnit', header: HEADERS_112A[10], type: 'number', decimals: 4, value: function (r) { return r.consolidated || r.acquiredCode !== 'BE' ? null : r.fmvPerUnit; } },
        { key: 'fmvTotal', header: HEADERS_112A[11], type: 'number', decimals: 2, value: function (r) { return r.consolidated || r.acquiredCode !== 'BE' ? null : r.fmvTotal; } },
        { key: 'transferExpenses', header: HEADERS_112A[12], type: 'number', decimals: 2 },
        { key: 'totalDeductions', header: HEADERS_112A[13], type: 'number', decimals: 2, value: function (r) { return r.costWithoutIndexation + r.transferExpenses; } },
        { key: 'gain', header: HEADERS_112A[14], type: 'number', decimals: 2 }
      ]
    };
  }

  function schema111A() {
    return {
      lineEnding: '\r\n',
      columns: [
        { key: 'fyLabel', header: HEADERS_111A[0], type: 'text' },
        { key: 'ruleLabel', header: HEADERS_111A[1], type: 'text' },
        { key: 'isin', header: HEADERS_111A[2], type: 'text' },
        { key: 'instrument', header: HEADERS_111A[3], type: 'text' },
        { key: 'qty', header: HEADERS_111A[4], type: 'number', decimals: 4 },
        { key: 'buyDate', header: HEADERS_111A[5], type: 'date' },
        { key: 'sellDate', header: HEADERS_111A[6], type: 'date' },
        { key: 'sellValue', header: HEADERS_111A[7], type: 'number', decimals: 2 },
        { key: 'actualCost', header: HEADERS_111A[8], type: 'number', decimals: 2 },
        { key: 'transferExpenses', header: HEADERS_111A[9], type: 'number', decimals: 2 },
        { key: 'gain', header: HEADERS_111A[10], type: 'number', decimals: 2 }
      ]
    };
  }

  function consolidate(aeRows) {
    const buckets = {};
    (aeRows || []).forEach(function (r) {
      const key = r.transferredCode;
      if (!buckets[key]) {
        buckets[key] = {
          consolidated: true,
          acquiredCode: 'AE',
          transferredCode: key,
          isinExport: 'INNOTREQUIRD',
          nameExport: 'CONSOLIDATED',
          sellValue: 0,
          actualCost: 0,
          costWithoutIndexation: 0,
          transferExpenses: 0,
          gain: 0,
          fmvTotal: null,
          fmvPerUnit: null,
          sellPrice: null,
          qty: null,
          rows: 0
        };
      }
      const b = buckets[key];
      b.rows += 1;
      b.sellValue += r.sellValue || 0;
      b.actualCost += r.actualCost || 0;
      b.costWithoutIndexation += r.costWithoutIndexation || 0;
      b.transferExpenses += r.transferExpenses || 0;
      b.gain += r.gain || 0;
    });
    return ['BE', 'AE'].filter(function (k) { return buckets[k]; }).map(function (k) {
      return buckets[k];
    });
  }

  function exportRows(rows, fy, section) {
    const included = rowsFor(rows, fy, section).filter(function (r) {
      return !r.excluded && !isBlocking(r);
    });
    if (section !== '112A') return included;

    const be = included.filter(function (r) { return r.acquiredCode === 'BE'; }).map(function (r) {
      return Object.assign({}, r, {
        consolidated: false,
        isinExport: validIsin(r.isin) ? r.isin : 'INNOTAVAILAB',
        nameExport: sanitizeName(r.instrument)
      });
    });
    const ae = included.filter(function (r) { return r.acquiredCode === 'AE'; });
    return be.concat(consolidate(ae));
  }

  function csv112A(rows, fy) {
    return G.export.csv(exportRows(rows, fy, '112A'), schema112A());
  }

  function csv111A(rows, fy) {
    const prepared = exportRows(rows, fy, '111A').map(function (r) {
      return Object.assign({}, r, {
        fyLabel: fyLabel(r.fy),
        ruleLabel: r.rule ? r.rule.label : ''
      });
    });
    return G.export.csv(prepared, schema111A());
  }

  function reconciliation(rows, fy, result) {
    const fyAgg = (result && result.fys || []).filter(function (f) { return f.startYear === fy; })[0];
    const lt = (fyAgg ? (fyAgg.regimes.new.eqLt.gain - fyAgg.regimes.new.eqLt.loss + fyAgg.regimes.legacy.eqLt.gain - fyAgg.regimes.legacy.eqLt.loss) : 0);
    const st = (fyAgg ? (fyAgg.regimes.new.eqSt.gain - fyAgg.regimes.new.eqSt.loss + fyAgg.regimes.legacy.eqSt.gain - fyAgg.regimes.legacy.eqSt.loss) : 0);
    const ltExport = rowsFor(rows, fy, '112A').filter(function (r) { return !r.excluded; }).reduce(function (a, r) { return a + (r.gain || 0); }, 0);
    const stExport = rowsFor(rows, fy, '111A').filter(function (r) { return !r.excluded; }).reduce(function (a, r) { return a + (r.gain || 0); }, 0);
    return {
      lt: { dashboard: round2(lt), export: round2(ltExport), diff: round2(ltExport - lt) },
      st: { dashboard: round2(st), export: round2(stExport), diff: round2(stExport - st) }
    };
  }

  function reset() {
    overrides.clear();
    state.fy = null;
    state.tab = '112A';
    state.acknowledged = false;
  }

  function setOverride(key, patch) {
    const current = overrides.get(key) || {};
    overrides.set(key, Object.assign({}, current, patch || {}));
    return overrides.get(key);
  }

  function overrideByName(name, patch) {
    return setOverride('name:' + nameKey(name), patch);
  }

  function getOverrides() {
    const out = {};
    overrides.forEach(function (v, k) {
      out[k] = Object.assign({}, v);
    });
    return out;
  }

  G.calc.is112AEligible = is112AEligible;
  G.calc.grandfatheredCost = grandfatheredCost;

  G.itr = {
    TEMPLATE_VERSION: TEMPLATE_VERSION,
    HEADERS_112A: HEADERS_112A,
    HEADERS_111A: HEADERS_111A,
    rules: RULES,
    buildEvents: buildEvents,
    project: project,
    termOf: termOf,
    is112AEligible: is112AEligible,
    grandfatheredCost: grandfatheredCost,
    blockingFlags: blockingFlags,
    isBlocking: isBlocking,
    rowsFor: rowsFor,
    totalsOf: totalsOf,
    fyOptions: fyOptions,
    exportRows: exportRows,
    schema112A: schema112A,
    schema111A: schema111A,
    csv112A: csv112A,
    csv111A: csv111A,
    printSpec: printSpec,
    reconciliation: reconciliation,
    setOverride: setOverride,
    overrideByName: overrideByName,
    getOverrides: getOverrides,
    reset: reset,
    state: state,
    last: function () { return last; },
    render: render,
    onData: onData,
    show: show
  };

  const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const inrFmt2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 });

  function fmt(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return (v < 0 ? '-' : '') + '\u20B9' + inrFmt.format(Math.abs(Math.round(v)));
  }

  function fmtQty(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return qtyFmt.format(v);
  }

  function fmtUnit(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return '\u20B9' + inrFmt2.format(v);
  }

  function fmtDate(d) {
    if (!isDate(d)) return '\u2014';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function colored(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return '<span class="' + (v > 0 ? 'pos' : v < 0 ? 'neg' : '') + '">' + fmt(v) + '</span>';
  }

  function flagLabel(f) {
    const labels = {
      needs_isin: 'Needs ISIN',
      invalid_isin: 'Invalid ISIN',
      needs_fmv: 'Needs 31 Jan 2018 FMV',
      needs_values: 'Needs buy/sell values',
      needs_dates: 'Needs dates',
      assumed_stt: 'STT assumed paid',
      consolidated_row: 'Consolidated (AE)',
      isin_consolidated: 'ISIN not needed (AE)',
      legacy_transfer: 'Pre-23 Jul 2024 rate',
      not_112a_asset: 'Not 112A/111A'
    };
    return labels[f] || f;
  }

  function renderFyOptions(fys) {
    const sel = $('itr-fy');
    if (!sel) return;
    sel.innerHTML = fys.map(function (y) {
      return '<option value="' + y + '">' + esc(fyLabel(y)) + '</option>';
    }).join('');
    sel.value = String(state.fy);
  }

  function renderCards(fy, section, totals) {
    const cards = [
      { label: section === '112A' ? '112A rows' : '111A rows', value: String(totals.rows), sub: totals.excluded ? totals.excluded + ' excluded' : 'included in export' },
      { label: 'Sale value', value: fmt(totals.sale), sub: fyLabel(fy) },
      { label: 'Cost of acquisition', value: fmt(totals.cost), sub: section === '112A' ? 'actual cost, before grandfathering' : 'actual cost' },
      { label: 'Capital gain', value: colored(totals.gain), sub: section === '112A' ? 'after grandfathering and charges' : 'after charges' },
      { label: 'STT', value: totals.assumedStt ? String(totals.assumedStt) : '0', sub: 'rows assumed STT paid' }
    ];
    const el = $('itr-cards');
    if (!el) return;
    el.innerHTML = cards.map(function (c) {
      return '<div class="card">' +
        '<div class="card-label">' + esc(c.label) + '</div>' +
        '<div class="card-value">' + c.value + '</div>' +
        '<div class="card-sub">' + esc(c.sub) + '</div>' +
        '</div>';
    }).join('');
  }

  function actionsFor(r) {
    let html = '';
    if (r.section === '112A' && r.acquiredCode === 'BE' && r.fmvPerUnit == null && !r.excluded) {
      html += '<span class="itr-inline">' +
        '<input class="itr-num" type="text" inputmode="decimal" placeholder="FMV/unit" data-fmv="' + esc(r.key) + '" aria-label="FMV per unit as on 31 January 2018 for ' + esc(r.instrument) + '">' +
        '<button class="mini-btn" type="button" data-fmv-apply="' + esc(r.key) + '">Set FMV</button>' +
        '</span>';
    }
    if (!validIsin(r.isin) && !r.excluded) {
      let hint = '';
      if (r.isinSuggestion) {
        hint = '<button class="mini-btn" type="button" data-isin-suggest="' + esc(r.key) + '">Use ' + esc(r.isinSuggestion.isin) + '</button>';
      }
      html += '<span class="itr-inline">' +
        '<input class="itr-isin" type="text" maxlength="12" placeholder="INE..." data-isin="' + esc(r.key) + '" aria-label="ISIN for ' + esc(r.instrument) + '">' +
        hint +
        '<button class="mini-btn" type="button" data-isin-apply="' + esc(r.key) + '">Set ISIN</button>' +
        '</span>';
    }
    html += '<button class="mini-btn" type="button" data-exclude="' + esc(r.key) + '">' +
      (r.excluded ? 'Include' : 'Exclude') + '</button>';
    html += '<button class="mini-btn" type="button" data-stt="' + esc(r.key) + '">' +
      (r.sttPaid === false ? 'STT paid' : 'No STT') + '</button>';
    return html;
  }

  function renderTable(fy, section, rows) {
    const table = $('itr-table');
    if (!table) return;
    const list = rowsFor(rows, fy, section);

    if (!list.length) {
      table.innerHTML = '<tbody><tr><td class="empty">No ' + section + ' rows for ' + esc(fyLabel(fy)) +
        ' in the loaded files. ' + (section === '112A' ? 'Long-term equity sales appear here.' : 'Short-term equity sales appear here.') + '</td></tr></tbody>';
      return;
    }

    const head = '<thead><tr>' +
      '<th>Security</th>' +
      '<th>ISIN</th>' +
      '<th class="num">Qty</th>' +
      '<th>Buy</th>' +
      '<th>Sell</th>' +
      '<th class="num">Sale value</th>' +
      '<th class="num">Actual cost</th>' +
      '<th class="num">FMV / unit</th>' +
      '<th class="num">Deemed cost</th>' +
      '<th class="num">Expenses</th>' +
      '<th class="num">Gain</th>' +
      '<th>Flags</th>' +
      '<th>Actions</th>' +
      '</tr></thead>';

    const body = list.map(function (r) {
      const flags = (r.flags || []).filter(function (f) {
        return f !== 'consolidated_row' && f !== 'isin_consolidated' && f !== 'assumed_stt';
      });
      const badge = r.acquiredCode === 'BE' ? 'BE' : 'AE';
      return '<tr' + (r.excluded ? ' class="itr-excluded"' : '') + '>' +
        '<td>' + esc(r.instrument) + ' <span class="itr-badge" title="' +
          (r.acquiredCode === 'BE' ? 'Acquired on or before 31 Jan 2018' : 'Acquired after 31 Jan 2018') + '">' + badge + '</span></td>' +
        '<td>' + esc(validIsin(r.isin) ? r.isin : (r.acquiredCode === 'AE' ? 'consolidated' : '\u2014')) + '</td>' +
        '<td class="num">' + fmtQty(r.qty) + '</td>' +
        '<td>' + fmtDate(r.buyDate) + '</td>' +
        '<td>' + fmtDate(r.sellDate) + '</td>' +
        '<td class="num">' + fmt(r.sellValue) + '</td>' +
        '<td class="num">' + fmt(r.actualCost) + '</td>' +
        '<td class="num">' + (r.acquiredCode === 'BE' ? fmtUnit(r.fmvPerUnit) : '\u2014') + '</td>' +
        '<td class="num">' + fmt(r.costWithoutIndexation) + '</td>' +
        '<td class="num">' + fmt(r.transferExpenses) + '</td>' +
        '<td class="num">' + colored(r.gain) + '</td>' +
        '<td class="itr-flags">' + (flags.length ? flags.map(function (f) {
          return '<span class="flag">' + esc(flagLabel(f)) + '</span>';
        }).join(' ') : '\u2014') + '</td>' +
        '<td>' + actionsFor(r) + '</td>' +
        '</tr>';
    }).join('');

    const totalRow = '<tr class="total">' +
      '<td colspan="5">Total (included rows)</td>' +
      '<td class="num">' + fmt(totalsOf(list).sale) + '</td>' +
      '<td class="num">' + fmt(totalsOf(list).cost) + '</td>' +
      '<td class="num"></td>' +
      '<td class="num"></td>' +
      '<td class="num">' + fmt(totalsOf(list).expenses) + '</td>' +
      '<td class="num">' + colored(totalsOf(list).gain) + '</td>' +
      '<td colspan="2"></td>' +
      '</tr>';

    table.innerHTML = head + '<tbody>' + body + totalRow + '</tbody>';
  }

  function renderExclusions(fy, section, rows) {
    const el = $('itr-exclusions');
    if (!el) return;
    const list = rowsFor(rows, fy, section).filter(function (r) { return r.excluded; });
    const other = (rows || []).filter(function (r) {
      return r.fy === fy && !r.section && !r.excluded;
    });
    if (!list.length && !other.length) {
      el.innerHTML = '';
      return;
    }
    let html = '';
    if (list.length) {
      html += '<div class="section-title">Excluded from this export</div>' +
        '<ul class="itr-exclusions">' + list.map(function (r) {
          return '<li><strong>' + esc(r.instrument) + '</strong> \u00B7 ' + fmtDate(r.sellDate) +
            ' \u00B7 ' + esc(r.excludeReason || 'Excluded') +
            ' <button class="mini-btn" type="button" data-exclude="' + esc(r.key) + '">Include</button></li>';
        }).join('') + '</ul>';
    }
    if (other.length) {
      html += '<div class="section-title">Not reported in 112A / 111A</div>' +
        '<ul class="itr-exclusions">' + other.map(function (r) {
          return '<li><strong>' + esc(r.instrument) + '</strong> \u00B7 ' + fmtDate(r.sellDate) +
            ' \u00B7 ' + esc(r.excludeReason || 'Not eligible') + '</li>';
        }).join('') + '</ul>';
    }
    el.innerHTML = html;
  }

  function renderReconcile(fy, section, rows, result) {
    const note = $('itr-reconcile');
    const ackWrap = $('itr-ack-wrap');
    const ack = $('itr-ack');
    if (!note) return;

    const rec = reconciliation(rows, fy, result)[section === '112A' ? 'lt' : 'st'];
    const mismatch = Math.abs(rec.diff) >= 1;

    if (!mismatch) {
      note.innerHTML = 'Reconciles with the dashboard: ' + (section === '112A' ? 'LTCG' : 'STCG') +
        ' for ' + esc(fyLabel(fy)) + ' is ' + fmt(rec.dashboard) + ' and this export totals ' + fmt(rec.export) + '.';
      if (ackWrap) ackWrap.classList.add('hidden');
      if (ack) ack.checked = false;
      state.acknowledged = false;
      return;
    }

    const reason = section === '112A'
      ? 'Grandfathering (31 Jan 2018 FMV), excluded rows, and transfer charges can all make the 112A total differ from the dashboard LTCG.'
      : 'Excluded rows and transfer charges can make the 111A total differ from the dashboard STCG.';
    note.innerHTML = '<strong>Does not reconcile:</strong> dashboard ' + (section === '112A' ? 'LTCG' : 'STCG') +
      ' is ' + fmt(rec.dashboard) + ', this export totals ' + fmt(rec.export) +
      ' (difference ' + fmt(rec.diff) + '). ' + esc(reason);
    if (ackWrap) ackWrap.classList.remove('hidden');
    if (ack) ack.checked = state.acknowledged;
  }

  function blockingSummary(fy, section, rows) {
    const list = rowsFor(rows, fy, section);
    const blocked = list.filter(isBlocking);
    return {
      blocked: blocked.length,
      names: blocked.slice(0, 4).map(function (r) { return r.instrument; })
    };
  }

  function renderButtons(fy, section, rows) {
    const dl = $('itr-download');
    const pr = $('itr-print');
    if (!dl) return;
    dl.textContent = 'Download ' + section + ' CSV';
    const info = blockingSummary(fy, section, rows);
    const rec = reconciliation(rows, fy, last.result || null)[section === '112A' ? 'lt' : 'st'];
    const mismatch = Math.abs(rec.diff) >= 1;
    const hasRows = rowsFor(rows, fy, section).some(function (r) { return !r.excluded; });
    const blocked = info.blocked > 0 || !hasRows || (mismatch && !state.acknowledged);
    dl.disabled = blocked;
    dl.title = !hasRows
      ? 'No rows to export for this financial year.'
      : info.blocked
        ? info.blocked + ' row(s) need attention: ' + info.names.join(', ')
        : mismatch && !state.acknowledged
          ? 'Reconciliation mismatch must be acknowledged first.'
          : 'Download the ' + section + ' CSV. Generated in your browser.';
    if (pr) pr.disabled = !hasRows;

    const warn = $('itr-note');
    if (warn) {
      warn.textContent = section === '112A'
        ? 'The 112A CSV follows the ' + TEMPLATE_VERSION + ' column order. Rows acquired after 31 Jan 2018 are consolidated as INNOTREQUIRD / CONSOLIDATED, as the portal expects. 111A has no portal upload, so its CSV is a working schedule for you and your CA. Estimates only \u2014 verify with your CA before filing.'
        : 'The portal has no 111A bulk-upload format. This CSV is a working schedule for you and your CA. Estimates only \u2014 verify with your CA before filing.';
    }
  }

  function renderEmpty(message) {
    const cards = $('itr-cards');
    const table = $('itr-table');
    const note = $('itr-note');
    const rec = $('itr-reconcile');
    const ackWrap = $('itr-ack-wrap');
    const excl = $('itr-exclusions');
    const dl = $('itr-download');
    const pr = $('itr-print');
    if (cards) cards.innerHTML = '';
    if (table) table.innerHTML = '<tbody><tr><td class="empty">' + esc(message) + '</td></tr></tbody>';
    if (rec) rec.textContent = '';
    if (ackWrap) ackWrap.classList.add('hidden');
    if (excl) excl.innerHTML = '';
    if (note) note.textContent = '';
    if (dl) { dl.disabled = true; dl.title = message; }
    if (pr) pr.disabled = true;
  }

  function render() {
    if (typeof document === 'undefined') return;
    const root = $('view-itr');
    if (!root) return;

    const app = G.app;
    const result = app ? app.result() : null;
    const ledger = app ? app.ledger() : [];
    const settings = app ? app.settings() : G.calc.defaults;

    if (!result || result.empty || !ledger.length) {
      last = { rows: [], fys: [], result: result, settings: settings };
      renderEmpty('Load your Groww exports on the dashboard first, then come back here to build the 112A / 111A export.');
      const sel = $('itr-fy');
      if (sel) sel.innerHTML = '';
      return;
    }

    const events = buildEvents(ledger);
    const rows = project(events, { settings: settings });
    const fys = fyOptions(rows);
    if (!fys.length) {
      last = { rows: rows, fys: [], result: result, settings: settings };
      renderEmpty('No realised equity sales were found. 112A/111A cover sold equity shares and equity mutual funds, not open holdings.');
      const sel = $('itr-fy');
      if (sel) sel.innerHTML = '';
      return;
    }

    if (state.fy == null || fys.indexOf(state.fy) < 0) state.fy = fys[fys.length - 1];
    const fy = state.fy;
    const section = state.tab;
    const scope = rowsFor(rows, fy, section);
    const totals = totalsOf(scope);

    last = { rows: rows, fys: fys, result: result, settings: settings };

    renderFyOptions(fys);
    const tab112 = $('itr-tab-112a');
    const tab111 = $('itr-tab-111a');
    if (tab112) {
      tab112.setAttribute('aria-selected', String(section === '112A'));
      tab112.classList.toggle('active', section === '112A');
    }
    if (tab111) {
      tab111.setAttribute('aria-selected', String(section === '111A'));
      tab111.classList.toggle('active', section === '111A');
    }
    renderCards(fy, section, totals);
    renderTable(fy, section, rows);
    renderExclusions(fy, section, rows);
    renderReconcile(fy, section, rows, result);
    renderButtons(fy, section, rows);
  }

  function onData() {
    const view = $('view-itr');
    if (view && !view.classList.contains('hidden')) render();
  }

  function show() {
    render();
  }

  function status(message) {
    const el = $('status');
    if (el) el.textContent = message;
  }

  function keyRow(key) {
    return (last.rows || []).filter(function (r) { return r.key === key; })[0] || null;
  }

  function parsePositive(text) {
    if (text == null) return null;
    const cleaned = String(text).replace(/[\u20B9,\s]/g, '');
    if (!cleaned) return null;
    if (!/^\d*\.?\d+$/.test(cleaned)) return NaN;
    return parseFloat(cleaned);
  }

  function download() {
    const fy = state.fy;
    const section = state.tab;
    if (fy == null) return;
    const rows = last.rows || [];
    const text = section === '112A' ? csv112A(rows, fy) : csv111A(rows, fy);
    const end = String((fy + 1) % 100).padStart(2, '0');
    const name = 'kapital-' + (section === '112A' ? '112a' : '111a') + '-FY' + fy + '-' + end + '.csv';
    G.export.downloadText(name, text, G.export.MIME.csv);
    status(section + ' CSV generated in your browser \u2014 nothing was uploaded.');
  }

  function printSpec(fy, context) {
    const ctx = context || last;
    const rows = ctx.rows || [];
    if (fy == null) return null;
    const scoped = rowsFor(rows, fy, '112A').concat(rowsFor(rows, fy, '111A')).filter(function (r) { return !r.excluded; });
    const codes = {};
    scoped.forEach(function (r) { codes[r.transferredCode] = true; });
    const ruleLabel = codes.BE && codes.AE
      ? 'Mixed \u2014 pre and post 23 Jul 2024 transfers'
      : codes.BE ? RULES.legacy.label : RULES.current.label;
    const excluded = rowsFor(rows, fy, '112A').concat(rowsFor(rows, fy, '111A')).filter(function (r) { return r.excluded; });
    const included = rowsFor(rows, fy, '112A').filter(function (r) { return !r.excluded && !isBlocking(r); });
    const needsReview = rowsFor(rows, fy, '112A').concat(rowsFor(rows, fy, '111A')).filter(function (r) {
      return !r.excluded && isBlocking(r);
    }).map(function (r) {
      return Object.assign({}, r, {
        reason: blockingFlags(r).map(flagLabel).join(', ')
      });
    });
    const reviewColumns = [
      { key: 'instrument', header: 'Security', type: 'text' },
      { key: 'isin', header: 'ISIN', type: 'text' },
      { key: 'qty', header: 'Qty', type: 'number', decimals: 4 },
      { key: 'buyDate', header: 'Buy date', type: 'date' },
      { key: 'sellDate', header: 'Sell date', type: 'date' },
      { key: 'sellValue', header: 'Sale value', type: 'number' },
      { key: 'actualCost', header: 'Actual cost', type: 'number' },
      { key: 'costWithoutIndexation', header: 'Deemed cost', type: 'number' },
      { key: 'transferExpenses', header: 'Expenses', type: 'number' },
      { key: 'gain', header: 'Gain', type: 'number' }
    ];
    const lt = totalsOf(rowsFor(rows, fy, '112A'));
    const st = totalsOf(rowsFor(rows, fy, '111A'));
    const rec = reconciliation(rows, fy, ctx.result);
    const settings = ctx.settings || G.calc.defaults;
    const summary = [
      { section: '112A (long-term equity)', rows: lt.rows, sale: lt.sale, cost: lt.cost, expenses: lt.expenses, gain: lt.gain },
      { section: '111A (short-term equity)', rows: st.rows, sale: st.sale, cost: st.cost, expenses: st.expenses, gain: st.gain }
    ];
    const excludedRows = excluded.map(function (r) {
      return Object.assign({}, r, { reason: r.excludeReason || 'Excluded' });
    });

    return {
      title: 'Kapital \u2014 ITR capital-gains summary',
      subtitle: fyLabel(fy) + ' \u00B7 ' + ruleLabel,
      meta: [
        ['Generated', new Date().toLocaleDateString('en-IN')],
        ['112A template', TEMPLATE_VERSION],
        ['Rule set', ruleLabel],
        ['Rates applied', 'STCG ' + settings.stcg + '% / ' + settings.legacyStcg + '% legacy \u00B7 LTCG ' + settings.ltcg + '% / ' + settings.legacyLtcg + '% legacy'],
        ['Dashboard reconciliation', 'LTCG diff ' + fmt(rec.lt.diff) + ' \u00B7 STCG diff ' + fmt(rec.st.diff)]
      ],
      sections: [
        { title: 'Totals by schedule', rows: summary, columns: [
          { key: 'section', header: 'Schedule', type: 'text' },
          { key: 'rows', header: 'Rows', type: 'integer' },
          { key: 'sale', header: 'Sale value', type: 'number' },
          { key: 'cost', header: 'Cost', type: 'number' },
          { key: 'expenses', header: 'Expenses', type: 'number' },
          { key: 'gain', header: 'Gain', type: 'number' }
        ] },
        { title: '112A rows included', rows: included, columns: reviewColumns },
        { title: '111A rows included', rows: rowsFor(rows, fy, '111A').filter(function (r) { return !r.excluded && !isBlocking(r); }), columns: reviewColumns },
        { title: 'Blocked from export (needs review)', rows: needsReview, columns: reviewColumns.concat([{ key: 'reason', header: 'Reason', type: 'text' }]) },
        { title: 'Excluded rows', rows: excludedRows, columns: reviewColumns.concat([{ key: 'reason', header: 'Reason', type: 'text' }]) }
      ],
      notes: [
        'Estimates only. Verify every figure with your chartered accountant before filing.',
        'Grandfathering uses deemed cost = higher of actual cost and the lower of 31 Jan 2018 FMV and sale value.',
        'Rows acquired after 31 Jan 2018 are consolidated into INNOTREQUIRD / CONSOLIDATED rows in the 112A CSV, as the portal expects.',
        'The portal has no 111A bulk-upload template; that CSV is a working schedule.'
      ],
      footer: 'Kapital is an independent, unofficial tool. Not affiliated with Groww.'
    };
  }

  function printSummary() {
    const spec = printSpec(state.fy);
    if (spec) G.export.print(spec);
  }

  function applyFmv(key) {
    const row = keyRow(key);
    if (!row || typeof document === 'undefined') return;
    const input = document.querySelector('[data-fmv="' + key + '"]');
    const value = parsePositive(input ? input.value : '');
    if (value == null || isNaN(value) || value < 0) {
      status('Enter a non-negative FMV per unit as on 31 January 2018.');
      return;
    }
    setOverride(key, { fmv: value });
    status('FMV applied for ' + row.instrument + ' (this session only).');
    render();
  }

  function applyIsin(key) {
    const row = keyRow(key);
    if (!row || typeof document === 'undefined') return;
    const input = document.querySelector('[data-isin="' + key + '"]');
    const value = input ? input.value : '';
    const res = G.isin.setManual(row.instrument, value);
    if (!res.ok) {
      status(res.error);
      return;
    }
    if (G.app && G.app.rebuild) G.app.rebuild();
    else render();
    status('ISIN ' + (res.cleared ? 'override cleared' : 'override applied') + ' for this session.');
  }

  function toggleExclude(key) {
    const row = keyRow(key);
    if (!row) return;
    if (row.excluded) {
      overrides.set(key, Object.assign({}, overrides.get(key) || {}, { excluded: false, reason: null, stt: null }));
    } else {
      overrides.set(key, Object.assign({}, overrides.get(key) || {}, { excluded: true, reason: 'Excluded from the export' }));
    }
    render();
  }

  function toggleStt(key) {
    const row = keyRow(key);
    if (!row) return;
    const next = row.sttPaid !== false;
    overrides.set(key, Object.assign({}, overrides.get(key) || {}, next
      ? { stt: false, excluded: true, reason: 'STT not paid on transfer' }
      : { stt: null, excluded: false, reason: null }));
    render();
  }

  function init() {
    if (typeof document === 'undefined') return;
    const root = $('view-itr');
    if (!root) return;

    const fy = $('itr-fy');
    if (fy) {
      fy.addEventListener('change', function (e) {
        state.fy = Number(e.target.value);
        state.acknowledged = false;
        render();
      });
    }

    const tab112 = $('itr-tab-112a');
    const tab111 = $('itr-tab-111a');
    function setTab(tab) {
      state.tab = tab;
      state.acknowledged = false;
      render();
    }
    if (tab112) tab112.addEventListener('click', function () { setTab('112A'); });
    if (tab111) tab111.addEventListener('click', function () { setTab('111A'); });

    const back = $('itr-back');
    if (back) {
      back.addEventListener('click', function () {
        if (G.app && G.app.showView) G.app.showView('dashboard');
      });
    }

    const dl = $('itr-download');
    if (dl) dl.addEventListener('click', download);

    const pr = $('itr-print');
    if (pr) pr.addEventListener('click', printSummary);

    const ack = $('itr-ack');
    if (ack) {
      ack.addEventListener('change', function () {
        state.acknowledged = ack.checked;
        render();
      });
    }

    root.addEventListener('click', function (e) {
      const exclude = e.target.closest('button[data-exclude]');
      if (exclude) {
        toggleExclude(exclude.getAttribute('data-exclude'));
        return;
      }
      const stt = e.target.closest('button[data-stt]');
      if (stt) {
        toggleStt(stt.getAttribute('data-stt'));
        return;
      }
      const fmv = e.target.closest('button[data-fmv-apply]');
      if (fmv) {
        applyFmv(fmv.getAttribute('data-fmv-apply'));
        return;
      }
      const isin = e.target.closest('button[data-isin-apply]');
      if (isin) {
        applyIsin(isin.getAttribute('data-isin-apply'));
        return;
      }
      const suggest = e.target.closest('button[data-isin-suggest]');
      if (suggest) {
        const key = suggest.getAttribute('data-isin-suggest');
        const row = keyRow(key);
        if (!row || !row.isinSuggestion) return;
        const res = G.isin.setManual(row.instrument, row.isinSuggestion.isin);
        if (!res.ok) {
          status(res.error);
          return;
        }
        if (G.app && G.app.rebuild) G.app.rebuild();
        else render();
      }
    });

    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.matches('input[data-fmv]')) {
        e.preventDefault();
        applyFmv(e.target.getAttribute('data-fmv'));
        return;
      }
      if (e.target.matches('input[data-isin]')) {
        e.preventDefault();
        applyIsin(e.target.getAttribute('data-isin'));
      }
    });
  }

  init();
})();
