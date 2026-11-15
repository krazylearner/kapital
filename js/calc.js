(function () {
  const G = (window.Kapital = window.Kapital || {});
  const MS_DAY = 86400000;
  const CUTOFF = new Date(2024, 6, 23);

  const DEFAULTS = {
    stcg: 20,
    ltcg: 12.5,
    exemption: 125000,
    legacyStcg: 15,
    legacyLtcg: 10,
    legacyExemption: 100000,
    debtLtcg: 12.5,
    legacyDebtLtcg: 20,
    slab: 30
  };

  function fyOf(date) {
    return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  }

  function fyLabel(startYear) {
    return 'FY ' + startYear + '-' + String((startYear + 1) % 100).padStart(2, '0');
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function isLongTerm(assetClass, buyDate, sellDate, holdingMonths) {
    const months = assetClass === 'DEBT_MF' ? (sellDate >= CUTOFF ? 24 : 36) : 12;
    if (holdingMonths != null) return holdingMonths > months;
    const ann = new Date(buyDate.getTime());
    ann.setMonth(ann.getMonth() + months);
    return sellDate.getTime() > ann.getTime();
  }

  function fifoRealize(trades, warnings) {
    const byKey = new Map();
    trades.forEach(function (t) {
      if (!t.date || !(t.qty > 0) || t.price == null) return;
      const key = t.isin || t.instrument;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(t);
    });

    const events = [];
    const open = [];

    byKey.forEach(function (list) {
      list.sort(function (a, b) {
        return a.date - b.date || (a.side === 'BUY' ? -1 : 1);
      });

      const lots = [];
      list.forEach(function (t) {
        if (t.side === 'BUY') {
          lots.push({
            instrument: t.instrument,
            isin: t.isin,
            assetClass: t.assetClass,
            date: t.date,
            price: t.price,
            remaining: t.qty,
            chargePerUnit: (t.charges || 0) / t.qty
          });
          return;
        }

        let remaining = t.qty;
        const sellCPU = (t.charges || 0) / t.qty;
        while (remaining > 1e-9 && lots.length) {
          const lot = lots[0];
          const take = Math.min(lot.remaining, remaining);
          events.push({
            instrument: t.instrument || lot.instrument,
            isin: t.isin || lot.isin,
            assetClass: lot.assetClass || t.assetClass,
            qty: take,
            buyDate: lot.date,
            sellDate: t.date,
            buyPrice: lot.price,
            sellPrice: t.price,
            charges: take * lot.chargePerUnit + take * sellCPU,
            investment: take * lot.price,
            proceeds: take * t.price,
            grossPL: take * (t.price - lot.price)
          });
          lot.remaining -= take;
          remaining -= take;
          if (lot.remaining <= 1e-9) lots.shift();
        }
        if (remaining > 1e-9) {
          warnings.push('Sold ' + round2(remaining) + ' units of ' + t.instrument + ' with no matching buy, ignored.');
        }
      });

      lots.forEach(function (lot) {
        open.push({
          instrument: lot.instrument,
          isin: lot.isin,
          assetClass: lot.assetClass,
          qty: lot.remaining,
          avgCost: lot.price,
          currentPrice: null,
          currentValue: null
        });
      });
    });

    return { events: events, open: open };
  }

  function mapRoundtrips(roundtrips, warnings) {
    const events = [];
    roundtrips.forEach(function (r) {
      let grossPL = null;
      if (r.useStated && r.statedPL != null) {
        grossPL = r.statedPL;
      } else if (r.buyPrice != null && r.sellPrice != null) {
        grossPL = r.qty * (r.sellPrice - r.buyPrice);
      } else if (r.statedPL != null) {
        grossPL = r.statedPL;
      }
      if (grossPL == null) {
        warnings.push('Skipped ' + (r.instrument || r.isin) + ': no prices or P&L value available.');
        return;
      }
      events.push({
        instrument: r.instrument,
        isin: r.isin,
        assetClass: r.assetClass,
        qty: r.qty,
        buyDate: r.buyDate,
        sellDate: r.sellDate,
        buyPrice: r.buyPrice,
        sellPrice: r.sellPrice,
        charges: r.charges || 0,
        investment: r.buyPrice != null ? r.qty * r.buyPrice : null,
        proceeds: r.sellPrice != null ? r.qty * r.sellPrice : null,
        grossPL: grossPL,
        holdingType: r.holdingType || null,
        holdingMonths: r.holdingMonths != null ? r.holdingMonths : null
      });
    });
    return events;
  }

  function mergeHoldings(fileHoldings, openLots) {
    const map = new Map();
    function add(h) {
      const key = h.isin || h.instrument;
      const cur = h.currentValue != null ? h.currentValue : (h.currentPrice != null ? h.qty * h.currentPrice : null);
      const row = Object.assign({}, h, { currentValue: cur });
      const prev = map.get(key);
      if (!prev) {
        map.set(key, row);
        return;
      }
      if (prev.currentValue == null && row.currentValue != null) map.set(key, row);
    }
    fileHoldings.forEach(add);
    openLots.forEach(function (lot) {
      const key = lot.isin || lot.instrument;
      if (!map.has(key)) map.set(key, Object.assign({}, lot, { currentValue: null }));
    });
    return Array.from(map.values());
  }

  function xirr(flows) {
    const fs = (flows || []).filter(function (f) {
      return f.date instanceof Date && !isNaN(f.date) && isFinite(f.amount) && f.amount !== 0;
    });
    if (fs.length < 2) return null;
    if (!fs.some(function (f) { return f.amount > 0; }) || !fs.some(function (f) { return f.amount < 0; })) {
      return null;
    }

    const t0 = Math.min.apply(null, fs.map(function (f) { return f.date.getTime(); }));
    const C = fs.map(function (f) {
      return { t: (f.date.getTime() - t0) / MS_DAY / 365, v: f.amount };
    });

    function f(r) {
      return C.reduce(function (s, c) {
        return s + c.v / Math.pow(1 + r, c.t);
      }, 0);
    }

    function df(r) {
      return C.reduce(function (s, c) {
        return s - (c.t * c.v) / Math.pow(1 + r, c.t + 1);
      }, 0);
    }

    let r = 0.1;
    for (let i = 0; i < 80; i++) {
      const fv = f(r);
      const dv = df(r);
      if (!isFinite(fv) || Math.abs(dv) < 1e-12) break;
      const nr = r - fv / dv;
      if (!isFinite(nr)) break;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr;
      if (r <= -0.9999) r = -0.9998;
      if (r > 100) r = 100;
    }

    let lo = -0.9999;
    let hi = 10;
    let flo = f(lo);
    const fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fm = f(mid);
      if (Math.abs(fm) < 1e-9) return mid;
      if (flo * fm <= 0) {
        hi = mid;
      } else {
        lo = mid;
        flo = fm;
      }
    }
    return (lo + hi) / 2;
  }

  function emptyBucket() {
    const cell = function () { return { gain: 0, loss: 0 }; };
    return { eqSt: cell(), eqLt: cell(), debtSt: cell(), debtLt: cell() };
  }

  function addToCell(cell, amount) {
    if (amount >= 0) cell.gain += amount;
    else cell.loss -= amount;
  }

  function taxableBuckets(agg, s) {
    const nb = agg.regimes.new;
    const lb = agg.regimes.legacy;
    return [
      { type: 'LT', eq: true, v: nb.eqLt.gain, rate: s.ltcg },
      { type: 'LT', eq: true, v: lb.eqLt.gain, rate: s.legacyLtcg },
      { type: 'LT', eq: false, v: nb.debtLt.gain, rate: s.debtLtcg },
      { type: 'LT', eq: false, v: lb.debtLt.gain, rate: s.legacyDebtLtcg },
      { type: 'ST', eq: true, v: nb.eqSt.gain, rate: s.stcg },
      { type: 'ST', eq: true, v: lb.eqSt.gain, rate: s.legacyStcg },
      { type: 'ST', eq: false, v: nb.debtSt.gain, rate: s.slab },
      { type: 'ST', eq: false, v: lb.debtSt.gain, rate: s.slab }
    ];
  }

  function lossTotals(agg) {
    const nb = agg.regimes.new;
    const lb = agg.regimes.legacy;
    return {
      lt: nb.eqLt.loss + lb.eqLt.loss + nb.debtLt.loss + lb.debtLt.loss,
      st: nb.eqSt.loss + lb.eqSt.loss + nb.debtSt.loss + lb.debtSt.loss
    };
  }

  function consumeLoss(carry, targets) {
    targets.forEach(function (b) {
      if (b.v <= 0) return;
      for (let i = 0; i < carry.length && b.v > 0; i++) {
        const c = carry[i];
        if (c.amount <= 0) continue;
        const use = Math.min(c.amount, b.v);
        c.amount -= use;
        b.v -= use;
      }
    });
  }

  function applyTax(fys, s, warnings) {
    let carryLt = [];
    let carrySt = [];

    fys.forEach(function (agg) {
      const buckets = taxableBuckets(agg, s);
      const losses = lossTotals(agg);

      const exemption = agg.startYear >= 2024 ? s.exemption : s.legacyExemption;
      let remainingEx = exemption;
      buckets
        .filter(function (b) { return b.type === 'LT' && b.eq && b.v > 0; })
        .sort(function (a, b) { return b.rate - a.rate; })
        .forEach(function (b) {
          if (remainingEx <= 0) return;
          const use = Math.min(remainingEx, b.v);
          b.v -= use;
          remainingEx -= use;
        });

      if (losses.lt > 0) carryLt.push({ amount: losses.lt, expires: agg.startYear + 8 });
      if (losses.st > 0) carrySt.push({ amount: losses.st, expires: agg.startYear + 8 });
      carryLt = carryLt.filter(function (c) { return c.expires >= agg.startYear && c.amount > 0; });
      carrySt = carrySt.filter(function (c) { return c.expires >= agg.startYear && c.amount > 0; });

      consumeLoss(carryLt, buckets.filter(function (b) {
        return b.type === 'LT' && b.v > 0;
      }).sort(function (a, b) { return b.rate - a.rate; }));

      consumeLoss(carrySt, buckets.filter(function (b) {
        return b.v > 0;
      }).sort(function (a, b) { return b.rate - a.rate; }));

      let tax = 0;
      buckets.forEach(function (b) {
        if (b.v > 0) tax += (b.v * b.rate) / 100;
      });

      agg.tax = tax;
      agg.pat = agg.netPL - tax;
      agg.roi = agg.invested > 0 ? agg.netPL / agg.invested : null;
    });

    const leftoverLt = carryLt.reduce(function (a, c) { return a + c.amount; }, 0);
    const leftoverSt = carrySt.reduce(function (a, c) { return a + c.amount; }, 0);
    if (leftoverLt > 0.005) {
      warnings.push('Unused long-term capital loss of ' + round2(leftoverLt) + ' remains after the loaded financial years; it can be carried forward for up to 8 years and set off only against long-term gains.');
    }
    if (leftoverSt > 0.005) {
      warnings.push('Unused short-term capital loss of ' + round2(leftoverSt) + ' remains after the loaded financial years; it can be carried forward for up to 8 years against short- or long-term gains.');
    }
  }

  function compute(input) {
    input = input || {};
    const s = Object.assign({}, DEFAULTS, input.settings || {});
    const warnings = (input.warnings || []).slice();
    const trades = input.trades || [];
    const roundtrips = input.roundtrips || [];
    const holdingsIn = input.holdings || [];

    const fifo = trades.length ? fifoRealize(trades, warnings) : { events: [], open: [] };
    const tradeKeys = new Set(trades.map(function (t) { return t.isin || t.instrument; }));
    const rtEvents = mapRoundtrips(roundtrips, warnings).filter(function (e) {
      return !tradeKeys.has(e.isin || e.instrument);
    });
    const events = fifo.events.concat(rtEvents);

    if (!events.length && !holdingsIn.length && !fifo.open.length) {
      return {
        fys: [],
        totals: null,
        unrealized: null,
        instruments: [],
        xirr: null,
        xirrFlows: 0,
        series: { cumulative: [], stProfit: 0, ltProfit: 0 },
        warnings: warnings,
        empty: true
      };
    }

    const fyMap = new Map();
    const instrMap = new Map();
    let stProfit = 0;
    let ltProfit = 0;

    events.forEach(function (ev) {
      if (!ev.sellDate) return;
      const startYear = fyOf(ev.sellDate);
      const regime = ev.sellDate >= CUTOFF ? 'new' : 'legacy';
      const lt = ev.holdingType === 'LT' ? true
        : ev.holdingType === 'ST' ? false
        : isLongTerm(ev.assetClass, ev.buyDate, ev.sellDate, ev.holdingMonths);
      const net = ev.grossPL - (ev.charges || 0);

      let agg = fyMap.get(startYear);
      if (!agg) {
        agg = {
          startYear: startYear,
          label: fyLabel(startYear),
          invested: 0,
          proceeds: 0,
          grossPL: 0,
          charges: 0,
          netPL: 0,
          stNet: 0,
          ltNet: 0,
          regimes: { new: emptyBucket(), legacy: emptyBucket() },
          tax: 0,
          pat: 0,
          roi: null,
          events: 0
        };
        fyMap.set(startYear, agg);
      }

      agg.events += 1;
      agg.invested += ev.investment || 0;
      agg.proceeds += ev.proceeds || 0;
      agg.grossPL += ev.grossPL;
      agg.charges += ev.charges || 0;
      agg.netPL += net;
      if (lt) agg.ltNet += net;
      else agg.stNet += net;

      const bucket = agg.regimes[regime];
      if (ev.assetClass === 'DEBT_MF') {
        addToCell(lt ? bucket.debtLt : bucket.debtSt, net);
      } else {
        addToCell(lt ? bucket.eqLt : bucket.eqSt, net);
      }

      if (lt) ltProfit += Math.max(0, net);
      else stProfit += Math.max(0, net);

      const ikey = ev.isin || ev.instrument;
      let ins = instrMap.get(ikey);
      if (!ins) {
        ins = {
          key: ikey,
          name: ev.instrument || ev.isin,
          isin: ev.isin || '',
          assetClass: ev.assetClass,
          grossPL: 0,
          charges: 0,
          netPL: 0,
          qtySold: 0,
          events: 0,
          unrealizedPL: null
        };
        instrMap.set(ikey, ins);
      }
      ins.grossPL += ev.grossPL;
      ins.charges += ev.charges || 0;
      ins.netPL += net;
      ins.qtySold += ev.qty;
      ins.events += 1;
    });

    const fys = Array.from(fyMap.values()).sort(function (a, b) {
      return a.startYear - b.startYear;
    });

    applyTax(fys, s, warnings);

    const totals = {
      invested: 0,
      proceeds: 0,
      grossPL: 0,
      charges: 0,
      netPL: 0,
      stNet: 0,
      ltNet: 0,
      tax: 0,
      pat: 0,
      roi: null
    };
    fys.forEach(function (f) {
      totals.invested += f.invested;
      totals.proceeds += f.proceeds;
      totals.grossPL += f.grossPL;
      totals.charges += f.charges;
      totals.netPL += f.netPL;
      totals.stNet += f.stNet;
      totals.ltNet += f.ltNet;
      totals.tax += f.tax;
      totals.pat += f.pat;
    });
    totals.roi = totals.invested > 0 ? totals.netPL / totals.invested : null;

    const holdRowsAll = mergeHoldings(holdingsIn, fifo.open);
    let uInvested = 0;
    let uCurrent = 0;
    let pricedInvested = 0;
    let missing = 0;
    const uRows = holdRowsAll.map(function (h) {
      const invested = h.avgCost != null ? h.qty * h.avgCost : null;
      const current = h.currentValue != null ? h.currentValue : null;
      const pl = invested != null && current != null ? current - invested : null;
      if (invested != null) uInvested += invested;
      if (current != null) {
        uCurrent += current;
        if (invested != null) pricedInvested += invested;
      } else {
        missing += 1;
      }
      const row = Object.assign({}, h, {
        invested: invested,
        current: current,
        pl: pl,
        plPct: invested && pl != null ? pl / invested : null
      });
      const ikey = h.isin || h.instrument;
      let ins = instrMap.get(ikey);
      if (!ins) {
        ins = {
          key: ikey,
          name: h.instrument || h.isin,
          isin: h.isin || '',
          assetClass: h.assetClass,
          grossPL: 0,
          charges: 0,
          netPL: 0,
          qtySold: 0,
          events: 0,
          unrealizedPL: null
        };
        instrMap.set(ikey, ins);
      }
      if (pl != null) ins.unrealizedPL = (ins.unrealizedPL || 0) + pl;
      return row;
    });

    const unrealized = {
      invested: uInvested,
      pricedInvested: pricedInvested,
      current: uCurrent,
      pl: missing === 0 ? uCurrent - uInvested : null,
      partialPL: uCurrent - pricedInvested,
      partialPct: pricedInvested > 0 ? (uCurrent - pricedInvested) / pricedInvested : null,
      complete: missing === 0,
      hasPriced: pricedInvested > 0,
      missing: missing,
      rows: uRows.sort(function (a, b) {
        return (b.pl == null ? -Infinity : b.pl) - (a.pl == null ? -Infinity : a.pl);
      })
    };

    const flows = [];
    if (trades.length) {
      trades.forEach(function (t) {
        if (!t.date || t.price == null || !(t.qty > 0)) return;
        flows.push({
          date: t.date,
          amount: t.side === 'BUY' ? -t.qty * t.price : t.qty * t.price
        });
      });
    } else {
      events.forEach(function (ev) {
        if (ev.buyDate && ev.buyPrice != null) flows.push({ date: ev.buyDate, amount: -ev.qty * ev.buyPrice });
        if (ev.sellDate && ev.sellPrice != null) flows.push({ date: ev.sellDate, amount: ev.qty * ev.sellPrice });
      });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    uRows.forEach(function (row) {
      if (row.current != null && row.qty > 0) flows.push({ date: today, amount: row.current });
    });

    const rate = xirr(flows);

    const sortedEvents = events.slice().sort(function (a, b) {
      return a.sellDate - b.sellDate;
    });
    let cum = 0;
    const cumulative = sortedEvents.map(function (e) {
      cum += e.grossPL - (e.charges || 0);
      return { date: e.sellDate, value: cum };
    });

    const instruments = Array.from(instrMap.values())
      .filter(function (i) {
        return i.events > 0 || i.unrealizedPL != null;
      })
      .sort(function (a, b) {
        return b.netPL - a.netPL;
      });

    return {
      fys: fys,
      totals: totals,
      unrealized: unrealized,
      instruments: instruments,
      xirr: rate,
      xirrFlows: flows.length,
      series: {
        cumulative: cumulative,
        stProfit: stProfit,
        ltProfit: ltProfit
      },
      warnings: warnings,
      empty: false
    };
  }

  G.calc = { compute: compute, defaults: DEFAULTS, fyOf: fyOf, fyLabel: fyLabel, xirr: xirr };
})();
