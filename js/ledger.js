(function () {
  const G = (window.Kapital = window.Kapital || {});

  const KINDS = {
    BUY: 'BUY',
    SELL: 'SELL',
    ROUNDTRIP: 'ROUNDTRIP',
    HOLDING: 'HOLDING'
  };

  const SEGMENTS = {
    EQUITY: 'EQUITY',
    EQUITY_MF: 'EQUITY_MF',
    DEBT_MF: 'DEBT_MF'
  };

  function segmentOf(assetClass) {
    return SEGMENTS[assetClass] || null;
  }

  function finite(n) {
    return typeof n === 'number' && isFinite(n);
  }

  function product(qty, price) {
    return finite(qty) && finite(price) ? qty * price : null;
  }

  function makeRow(spec) {
    spec = spec || {};
    const isin = spec.isin ? String(spec.isin).trim() : '';
    const row = {
      id: spec.id != null ? spec.id : null,
      rowId: spec.rowId != null ? spec.rowId : null,
      kind: spec.kind || null,
      sourceFile: spec.sourceFile || '',
      sourceType: spec.sourceType || null,
      broker: spec.broker || null,
      segment: spec.segment || segmentOf(spec.assetClass),
      instrument: spec.instrument || '',
      isin: isin,
      isinSource: null,
      isinConfidence: null,
      isinSuggestion: null,
      assetClass: spec.assetClass || null,
      date: spec.date || null,
      buyDate: spec.buyDate || null,
      sellDate: spec.sellDate || null,
      qty: spec.qty != null ? spec.qty : null,
      price: spec.price != null ? spec.price : null,
      value: spec.value != null ? spec.value : null,
      buyPrice: spec.buyPrice != null ? spec.buyPrice : null,
      sellPrice: spec.sellPrice != null ? spec.sellPrice : null,
      buyValue: spec.buyValue != null ? spec.buyValue : null,
      sellValue: spec.sellValue != null ? spec.sellValue : null,
      avgCost: spec.avgCost != null ? spec.avgCost : null,
      currentPrice: spec.currentPrice != null ? spec.currentPrice : null,
      currentValue: spec.currentValue != null ? spec.currentValue : null,
      charges: finite(spec.charges) ? spec.charges : 0,
      statedPL: spec.statedPL != null ? spec.statedPL : null,
      useStated: spec.useStated === true,
      holdingType: spec.holdingType || null,
      holdingMonths: spec.holdingMonths != null ? spec.holdingMonths : null,
      flags: []
    };

    if (row.value == null) {
      if (row.kind === KINDS.BUY || row.kind === KINDS.SELL) row.value = product(row.qty, row.price);
      else if (row.kind === KINDS.ROUNDTRIP) row.value = row.sellValue != null ? row.sellValue : product(row.qty, row.sellPrice);
      else if (row.kind === KINDS.HOLDING) row.value = row.currentValue;
    }
    if (row.buyValue == null) row.buyValue = product(row.qty, row.buyPrice);
    if (row.sellValue == null) row.sellValue = product(row.qty, row.sellPrice);
    if (!row.isin) row.flags.push('needs_isin');

    return row;
  }

  function fromParsed(parsed, meta) {
    parsed = parsed || {};
    meta = meta || {};
    const rows = [];
    let seq = 0;
    const fileId = meta.id != null ? String(meta.id) : String(meta.file || 'file');

    function add(kind, spec) {
      seq += 1;
      const rowId = seq;
      const base = {
        id: fileId + ':' + rowId,
        rowId: rowId,
        kind: kind,
        sourceFile: meta.file || '',
        sourceType: meta.type || parsed.type || null,
        broker: meta.broker || null
      };
      rows.push(makeRow(Object.assign(base, spec)));
      return rows[rows.length - 1];
    }

    (parsed.trades || []).forEach(function (t) {
      if (t.side !== KINDS.BUY && t.side !== KINDS.SELL) return;
      add(t.side, {
        instrument: t.instrument,
        isin: t.isin,
        assetClass: t.assetClass,
        date: t.date,
        qty: t.qty,
        price: t.price,
        charges: t.charges
      });
    });

    (parsed.roundtrips || []).forEach(function (r) {
      add(KINDS.ROUNDTRIP, {
        instrument: r.instrument,
        isin: r.isin,
        assetClass: r.assetClass,
        buyDate: r.buyDate,
        sellDate: r.sellDate,
        qty: r.qty,
        buyPrice: r.buyPrice,
        sellPrice: r.sellPrice,
        charges: r.charges,
        statedPL: r.statedPL,
        useStated: r.useStated,
        holdingType: r.holdingType,
        holdingMonths: r.holdingMonths
      });
    });

    (parsed.holdings || []).forEach(function (h) {
      add(KINDS.HOLDING, {
        instrument: h.instrument,
        isin: h.isin,
        assetClass: h.assetClass,
        qty: h.qty,
        avgCost: h.avgCost,
        currentPrice: h.currentPrice,
        currentValue: h.currentValue
      });
    });

    return rows;
  }

  function toCalcInput(rows) {
    const trades = [];
    const roundtrips = [];
    const holdings = [];

    (rows || []).forEach(function (row) {
      if (row.kind === KINDS.BUY || row.kind === KINDS.SELL) {
        trades.push({
          instrument: row.instrument,
          isin: row.isin,
          assetClass: row.assetClass,
          side: row.kind,
          qty: row.qty,
          price: row.price,
          date: row.date,
          charges: row.charges
        });
        return;
      }
      if (row.kind === KINDS.ROUNDTRIP) {
        roundtrips.push({
          instrument: row.instrument,
          isin: row.isin,
          assetClass: row.assetClass,
          qty: row.qty,
          buyDate: row.buyDate,
          sellDate: row.sellDate,
          buyPrice: row.buyPrice,
          sellPrice: row.sellPrice,
          charges: row.charges,
          statedPL: row.statedPL,
          useStated: row.useStated,
          holdingType: row.holdingType,
          holdingMonths: row.holdingMonths
        });
        return;
      }
      if (row.kind === KINDS.HOLDING) {
        holdings.push({
          instrument: row.instrument,
          isin: row.isin,
          assetClass: row.assetClass,
          qty: row.qty,
          avgCost: row.avgCost,
          currentPrice: row.currentPrice,
          currentValue: row.currentValue
        });
      }
    });

    return { trades: trades, roundtrips: roundtrips, holdings: holdings };
  }

  G.ledger = {
    KINDS: KINDS,
    makeRow: makeRow,
    fromParsed: fromParsed,
    toCalcInput: toCalcInput
  };
})();
