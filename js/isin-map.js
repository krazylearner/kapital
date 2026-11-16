(function () {
  const G = (window.Kapital = window.Kapital || {});

  const ENTRIES = [
    { isin: 'INE009A01021', symbol: 'INFY', name: 'Infosys Ltd', aliases: ['Infosys Limited'] },
    { isin: 'INE467B01029', symbol: 'TCS', name: 'Tata Consultancy Services Ltd', aliases: ['Tata Consultancy Services Limited'] },
    { isin: 'INE002A01018', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', aliases: ['Reliance Industries Limited'] },
    { isin: 'INE155A01022', symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', aliases: ['Tata Motors Limited'] },
    { isin: 'INE075A01022', symbol: 'WIPRO', name: 'Wipro Ltd', aliases: ['Wipro Limited'] },
    { isin: 'INE296A01024', symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', aliases: ['Bajaj Finance Limited'] },
    { isin: 'INE040A01034', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', aliases: ['HDFC Bank Limited'] },
    { isin: 'INE154A01025', symbol: 'ITC', name: 'ITC Ltd', aliases: ['ITC Limited'] },
    { isin: 'INE758T01015', symbol: 'ZOMATO', name: 'Zomato Ltd', aliases: ['Zomato Limited', 'Eternal Ltd', 'Eternal Limited'] },
    { isin: 'INE090A01021', symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', aliases: ['ICICI Bank Limited'] },
    { isin: 'INE062A01020', symbol: 'SBIN', name: 'State Bank of India', aliases: ['SBI'] },
    { isin: 'INE238A01034', symbol: 'AXISBANK', name: 'Axis Bank Ltd', aliases: ['Axis Bank Limited'] },
    { isin: 'INE237A01028', symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', aliases: ['Kotak Mahindra Bank Limited'] },
    { isin: 'INE018A01030', symbol: 'LT', name: 'Larsen & Toubro Ltd', aliases: ['Larsen and Toubro Ltd', 'Larsen & Toubro Limited', 'L&T'] },
    { isin: 'INE021A01026', symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', aliases: ['Asian Paints Limited'] },
    { isin: 'INE030A01027', symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', aliases: ['Hindustan Unilever Limited', 'HUL'] },
    { isin: 'INE044A01036', symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', aliases: ['Sun Pharma Industries Ltd', 'Sun Pharma'] },
    { isin: 'INE397D01024', symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', aliases: ['Bharti Airtel Limited', 'Airtel'] },
    { isin: 'INE860A01027', symbol: 'HCLTECH', name: 'HCL Technologies Ltd', aliases: ['HCL Technologies Limited', 'HCL Tech'] },
    { isin: 'INE733E01010', symbol: 'NTPC', name: 'NTPC Ltd', aliases: ['NTPC Limited'] },
    { isin: 'INE752E01010', symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd', aliases: ['Power Grid Corporation of India Limited'] },
    { isin: 'INE585B01010', symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', aliases: ['Maruti Suzuki India Limited'] },
    { isin: 'INE280A01028', symbol: 'TITAN', name: 'Titan Company Ltd', aliases: ['Titan Company Limited'] },
    { isin: 'INE481G01011', symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', aliases: ['UltraTech Cement Limited'] },
    { isin: 'INE423A01024', symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', aliases: ['Adani Enterprises Limited'] },
    { isin: 'INE742F01042', symbol: 'ADANIPORTS', name: 'Adani Ports and Special Economic Zone Ltd', aliases: ['Adani Ports and SEZ Ltd', 'Adani Ports'] },
    { isin: 'INE917I01010', symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', aliases: ['Bajaj Auto Limited'] },
    { isin: 'INE089A01023', symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories Ltd", aliases: ["Dr Reddy's Laboratories Ltd", "Dr. Reddy's Laboratories Limited"] },
    { isin: 'INE059A01026', symbol: 'CIPLA', name: 'Cipla Ltd', aliases: ['Cipla Limited'] },
    { isin: 'INE239A01024', symbol: 'NESTLEIND', name: 'Nestle India Ltd', aliases: ['Nestle India Limited', 'Nestlé India Ltd'] },
    { isin: 'INE522F01014', symbol: 'COALINDIA', name: 'Coal India Ltd', aliases: ['Coal India Limited'] },
    { isin: 'INE213A01029', symbol: 'ONGC', name: 'Oil and Natural Gas Corporation Ltd', aliases: ['Oil and Natural Gas Corporation Limited', 'ONGC Ltd'] },
    { isin: 'INE081A01020', symbol: 'TATASTEEL', name: 'Tata Steel Ltd', aliases: ['Tata Steel Limited'] },
    { isin: 'INE019A01038', symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', aliases: ['JSW Steel Limited'] },
    { isin: 'INE038A01020', symbol: 'HINDALCO', name: 'Hindalco Industries Ltd', aliases: ['Hindalco Industries Limited'] },
    { isin: 'INE669C01036', symbol: 'TECHM', name: 'Tech Mahindra Ltd', aliases: ['Tech Mahindra Limited'] },
    { isin: 'INE047A01021', symbol: 'GRASIM', name: 'Grasim Industries Ltd', aliases: ['Grasim Industries Limited'] },
    { isin: 'INE066A01021', symbol: 'EICHERMOT', name: 'Eicher Motors Ltd', aliases: ['Eicher Motors Limited'] },
    { isin: 'INE158A01026', symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', aliases: ['Hero MotoCorp Limited'] },
    { isin: 'INE918I01026', symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd', aliases: ['Bajaj Finserv Limited'] },
    { isin: 'INF204KA1MS3', name: 'Parag Parikh Flexi Cap Fund - Direct Growth', aliases: ['Parag Parikh Flexi Cap Fund Direct Plan Growth', 'PPFAS Flexi Cap Fund - Direct Growth'] },
    { isin: 'INF179K01XQ0', name: 'HDFC Corporate Bond Fund - Direct Growth', aliases: ['HDFC Corporate Bond Fund Direct Plan Growth'] },
    { isin: 'INF769K01AX2', name: 'Mirae Asset Large Cap Fund - Direct Growth', aliases: ['Mirae Asset Large Cap Fund Direct Plan Growth'] },
    { isin: 'INF109K01Z48', name: 'ICICI Prudential Nifty Next 50 Index Fund - Direct Growth', aliases: ['ICICI Prudential Nifty Next 50 Index Fund Direct Plan Growth'] }
  ];

  const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  const SUFFIXES = ['ltd', 'limited', 'co', 'company', 'corp', 'corporation', 'plc', 'inc'];
  const FUZZY_STOP = {
    fund: true, funds: true, scheme: true, direct: true, regular: true, plan: true,
    growth: true, option: true, idcw: true, dividend: true, payout: true, reinvestment: true,
    ltd: true, limited: true, the: true, of: true, and: true, co: true, company: true,
    corp: true, corporation: true, inc: true, plc: true
  };

  const bySymbol = Object.create(null);
  const byName = Object.create(null);
  const manual = new Map();

  function cleanIsin(v) {
    return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase();
  }

  function isValidIsin(v) {
    return ISIN_RE.test(cleanIsin(v));
  }

  function normalizeName(v) {
    let s = String(v == null ? '' : v).toLowerCase();
    s = s.replace(/&/g, ' and ').replace(/['\u2019.]/g, '');
    s = s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const parts = s.split(' ');
    while (parts.length > 1 && SUFFIXES.indexOf(parts[parts.length - 1]) >= 0) parts.pop();
    return parts.join(' ');
  }

  function symbolKey(v) {
    return normalizeName(v).replace(/\band\b/g, ' ').replace(/[^a-z0-9]/g, '').toUpperCase();
  }

  function register(entry) {
    if (entry.symbol) bySymbol[symbolKey(entry.symbol)] = entry;
    [entry.name].concat(entry.aliases || []).forEach(function (name) {
      const key = normalizeName(name);
      if (key && !byName[key]) byName[key] = entry;
      if (/^[A-Z&.\- ]+$/.test(String(name).trim())) {
        const sk = symbolKey(name);
        if (sk && !bySymbol[sk]) bySymbol[sk] = entry;
      }
    });
  }

  ENTRIES.forEach(register);

  function tokensOf(name) {
    return normalizeName(name).split(' ').filter(function (t) {
      return t && !FUZZY_STOP[t];
    });
  }

  function editDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function fuzzyMatch(name) {
    const qTokens = tokensOf(name);
    if (!qTokens.length) return null;
    const qSet = new Set(qTokens);
    let best = null;

    ENTRIES.forEach(function (entry) {
      [entry.name].concat(entry.aliases || []).forEach(function (candidate) {
        const cTokens = tokensOf(candidate);
        if (!cTokens.length) return;
        let score = 0;
        if (qSet.size === 1 && cTokens.length === 1) {
          const a = qTokens[0];
          const b = cTokens[0];
          const dist = editDistance(a, b);
          const maxDist = a.length <= 6 ? 1 : 2;
          if (dist <= maxDist && Math.max(a.length, b.length) > 2) {
            score = 1 - dist / Math.max(a.length, b.length);
          }
        } else {
          const cSet = new Set(cTokens);
          let shared = 0;
          qSet.forEach(function (t) {
            if (cSet.has(t)) shared += 1;
          });
          if (shared > 0) score = (2 * shared) / (qSet.size + cSet.size);
        }
        if (score < 0.6) return;
        if (!best || score > best.score) {
          best = { isin: entry.isin, name: candidate, score: Math.round(score * 1000) / 1000 };
        }
      });
    });

    return best;
  }

  function manualFor(name) {
    const key = normalizeName(name);
    return key ? manual.get(key) || null : null;
  }

  function setManual(name, isin) {
    const key = normalizeName(name);
    if (!key) return { ok: false, error: 'Enter a security or scheme name first.' };
    const clean = cleanIsin(isin);
    if (!clean) {
      manual.delete(key);
      return { ok: true, cleared: true };
    }
    if (!isValidIsin(clean)) {
      return { ok: false, error: 'ISIN must be 12 characters, start with a two-letter country code and end with a digit (for example INE009A01021).' };
    }
    manual.set(key, clean);
    return { ok: true, isin: clean };
  }

  function clearManual(name) {
    const key = normalizeName(name);
    if (key) manual.delete(key);
  }

  function clearAllManual() {
    manual.clear();
  }

  function lookup(name, statedIsin) {
    const clean = cleanIsin(statedIsin);
    if (clean) {
      const valid = isValidIsin(clean);
      return { isin: clean, source: 'export', confidence: valid ? 'exact' : null, valid: valid };
    }

    const manualHit = manualFor(name);
    if (manualHit) return { isin: manualHit, source: 'manual', confidence: 'manual', valid: true };

    const symbolHit = bySymbol[symbolKey(name)];
    if (symbolHit) return { isin: symbolHit.isin, source: 'map', confidence: 'symbol', valid: true, entry: symbolHit };

    const nameHit = byName[normalizeName(name)];
    if (nameHit) return { isin: nameHit.isin, source: 'map', confidence: 'name', valid: true, entry: nameHit };

    const suggestion = fuzzyMatch(name);
    if (suggestion) return { isin: null, source: null, confidence: null, valid: false, suggestion: suggestion };

    return { isin: null, source: null, confidence: null, valid: false };
  }

  function applyResult(row, result) {
    row.isin = result.isin;
    row.isinSource = result.source;
    row.isinConfidence = result.confidence;
    row.isinSuggestion = null;
    row.flags = (row.flags || []).filter(function (f) {
      return f !== 'needs_isin' && f !== 'invalid_isin';
    });
  }

  function applyToLedger(rows) {
    const summary = {
      total: 0, exported: 0, mapped: 0, manual: 0, suggested: 0, missing: 0, invalid: 0
    };

    (rows || []).forEach(function (row) {
      if (!row) return;
      summary.total += 1;
      const stated = cleanIsin(row.isin);
      const manualHit = stated && !isValidIsin(stated) ? manualFor(row.instrument) : null;
      if (manualHit) {
        applyResult(row, { isin: manualHit, source: 'manual', confidence: 'manual', valid: true });
        summary.manual += 1;
        return;
      }
      const result = lookup(row.instrument, stated);

      if (stated && result.valid) {
        applyResult(row, result);
        summary.exported += 1;
        return;
      }
      if (stated && !result.valid) {
        row.isin = stated;
        row.isinSource = 'export';
        row.isinConfidence = null;
        row.isinSuggestion = null;
        if (!row.flags) row.flags = [];
        if (row.flags.indexOf('invalid_isin') < 0) row.flags.push('invalid_isin');
        summary.exported += 1;
        summary.invalid += 1;
        return;
      }
      if (result.source === 'manual') {
        applyResult(row, result);
        summary.manual += 1;
        return;
      }
      if (result.source === 'map') {
        applyResult(row, result);
        summary.mapped += 1;
        return;
      }

      row.isinSource = null;
      row.isinConfidence = null;
      row.isinSuggestion = result.suggestion || null;
      if (!row.flags) row.flags = [];
      if (row.flags.indexOf('needs_isin') < 0) row.flags.push('needs_isin');
      summary.missing += 1;
      if (result.suggestion) summary.suggested += 1;
    });

    return summary;
  }

  G.isin = {
    entries: ENTRIES,
    normalizeName: normalizeName,
    isValidIsin: isValidIsin,
    cleanIsin: cleanIsin,
    lookup: lookup,
    fuzzyMatch: fuzzyMatch,
    manualFor: manualFor,
    setManual: setManual,
    clearManual: clearManual,
    clearAllManual: clearAllManual,
    applyToLedger: applyToLedger
  };
})();
