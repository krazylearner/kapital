(function () {
  const G = (window.Kapital = window.Kapital || {});

  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

  const ALIASES = {
    isin: ['isin', 'isincode'],
    instrument: [
      'stockname', 'scripname', 'companyname', 'schemename', 'fundname', 'securityname',
      'instrument', 'stock', 'scrip', 'scheme', 'fund', 'company', 'name', 'symbol', 'tradingsymbol'
    ],
    qty: ['quantity', 'qty', 'units', 'noofshares', 'shares', 'noofunits', 'matchedquantity', 'matchedunits'],
    buyDate: ['buydate', 'purchasedate', 'dateofpurchase', 'acquisitiondate', 'purchasedon', 'buytransactiondate'],
    sellDate: ['selldate', 'saledate', 'dateofsale', 'redemptiondate', 'redeemdate', 'soldon', 'selltransactiondate', 'disposaldate'],
    tradeDate: ['tradedate', 'transactiondate', 'orderdate', 'executiondate', 'tradedon', 'date'],
    tradeType: ['transactiontype', 'tradetype', 'buysell', 'transaction', 'orderside', 'side'],
    buyPrice: [
      'buyprice', 'purchaseprice', 'buyaverage', 'purchaseaverage', 'avgbuynav', 'buyavg',
      'purchaseavg', 'buyrate', 'purchaserate', 'purchasenav', 'buynav', 'avgprice', 'averagecost', 'avgcost'
    ],
    sellPrice: [
      'sellprice', 'saleprice', 'sellaverage', 'saleaverage', 'avgsellnav', 'sellavg',
      'saleavg', 'sellrate', 'salerate', 'redemptionnav', 'redemptionprice', 'redeemnav', 'redeemprice', 'salenav'
    ],
    price: ['price', 'nav', 'tradeprice', 'transactionprice', 'executionprice', 'executedprice', 'tradedprice', 'rate', 'execnav', 'unitprice'],
    charges: [
      'charges', 'totalcharges', 'chargesandtaxes', 'brokerage', 'brokerageandtaxes', 'fees',
      'feesandcharges', 'taxesandcharges', 'totaltaxes', 'transactioncharges', 'stt'
    ],
    realizedPL: [
      'realizedpl', 'realisedpl', 'realizedpnl', 'realisedpnl', 'profitloss', 'pnl',
      'realizedprofitloss', 'realisedprofitloss', 'gainloss', 'capitalgain', 'capitalgains',
      'realizedgain', 'realisedgain', 'realizedgainloss', 'netgain'
    ],
    shortGain: ['shorttermcapitalgain', 'shorttermcapitalgains', 'shorttermcapitalgainloss', 'shorttermgain', 'shorttermgains', 'stcg'],
    longGain: ['longtermcapitalgain', 'longtermcapitalgains', 'longtermcapitalgainloss', 'longtermgain', 'longtermgains', 'ltcg'],
    holdingType: ['holdingperiod', 'gaintype', 'term', 'holdingtype', 'shortlongterm', 'capitalgainstype', 'stcl', 'ltcl'],
    currentPrice: ['currentprice', 'ltp', 'lasttradedprice', 'marketprice', 'currentnav', 'marketrate', 'closingprice', 'closeprice', 'currentrate'],
    currentValue: ['currentvalue', 'marketvalue', 'currentmarketvalue', 'presentvalue', 'holdingvalue', 'currentamount', 'currentinvestmentvalue', 'valuation', 'currentvaluation'],
    investedValue: ['investedvalue', 'investedamount', 'investmentamount', 'costvalue', 'totalcost', 'costofacquisition', 'investmentvalue', 'invested', 'amountinvested', 'purchasedcost'],
    buyValue: ['buyvalue', 'purchasevalue', 'buyamount', 'purchaseamount', 'totalbuyvalue', 'grossbuyvalue'],
    sellValue: ['sellvalue', 'salevalue', 'saleamount', 'sellamount', 'totalsellvalue', 'grosssellvalue', 'redemptionamount'],
    assetClass: ['assetclass', 'assettype', 'securitytype', 'instrumenttype', 'instrumentcategory', 'fundtype', 'assetcategory', 'category']
  };

  const FIELD_ORDER = [
    'isin', 'instrument', 'qty', 'buyDate', 'sellDate', 'tradeDate', 'tradeType',
    'buyPrice', 'sellPrice', 'price', 'charges', 'realizedPL', 'shortGain', 'longGain', 'holdingType',
    'currentPrice', 'currentValue', 'investedValue', 'buyValue', 'sellValue', 'assetClass'
  ];

  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  const DEBT_NAME_RE = /(bond|debt|liquid|gilt|overnight|money market|credit risk|low duration|ultra short|short duration|corporate bond|dynamic bond|income fund|savings fund|banking and pps|gsec|treasury|floating rate)/i;

  function parseDate(v) {
    if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;

    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return isNaN(d) ? null : d;
    }

    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) {
      let day = +m[1];
      let month = +m[2];
      const year = +m[3];
      if (month > 12 && day <= 12) {
        const t = day;
        day = month;
        month = t;
      }
      const d = new Date(year, month - 1, day);
      return isNaN(d) ? null : d;
    }

    m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s,-]+(\d{4})/);
    if (m) {
      const month = MONTHS[String(m[2]).slice(0, 3).toLowerCase()];
      if (month != null) {
        const d = new Date(+m[3], month, +m[1]);
        return isNaN(d) ? null : d;
      }
    }

    m = s.match(/^([A-Za-z]{3,})[\s-]+(\d{1,2}),?[\s-]+(\d{4})/);
    if (m) {
      const month = MONTHS[String(m[1]).slice(0, 3).toLowerCase()];
      if (month != null) {
        const d = new Date(+m[3], month, +m[2]);
        return isNaN(d) ? null : d;
      }
    }

    const d = new Date(s);
    if (isNaN(d)) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function toNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    let s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) {
      neg = true;
      s = s.slice(1, -1);
    }
    s = s.replace(/[\u20B9,\s%]/g, '');
    if (!/^[-+]?\d*\.?\d+$/.test(s)) return NaN;
    const n = parseFloat(s);
    if (isNaN(n)) return NaN;
    return neg ? -n : n;
  }

  const num = (v) => {
    const n = toNum(v);
    return isNaN(n) ? 0 : n;
  };

  const numOrNull = (v) => {
    const n = toNum(v);
    return isNaN(n) ? null : n;
  };

  function mapColumns(headers, dataRows) {
    const cols = {};
    const assigned = new Set();

    function find(aliases) {
      for (let a = 0; a < aliases.length; a++) {
        for (let i = 0; i < headers.length; i++) {
          if (assigned.has(i)) continue;
          if (norm(headers[i]) === aliases[a]) return i;
        }
      }
      return -1;
    }

    FIELD_ORDER.forEach(function (f) {
      const idx = find(ALIASES[f]);
      if (idx >= 0) {
        cols[f] = idx;
        assigned.add(idx);
      }
    });

    headers.forEach(function (h, i) {
      if (assigned.has(i)) return;
      if (norm(h) === 'type') {
        const vals = dataRows.slice(0, 30).map(function (r) {
          return String(r[i] || '').toUpperCase().replace(/[^A-Z]/g, '');
        });
        const tradeish = vals.filter(function (v) {
          return /^(BUY|SELL|PURCHASE|REDEEM|REDEMPTION|SIP|SWITCHIN|SWITCHOUT|BONUS|SPLIT)$/.test(v);
        }).length;
        const termish = vals.filter(function (v) {
          return /^(STCG|LTCG|STCL|LTCL|SHORTTERM|LONGTERM)$/.test(v);
        }).length;
        if (cols.tradeType == null && tradeish > 0 && tradeish >= termish) {
          cols.tradeType = i;
          assigned.add(i);
        } else if (cols.holdingType == null && termish > 0) {
          cols.holdingType = i;
          assigned.add(i);
        }
      }
    });

    return cols;
  }

  function isHeaderRow(row, rows, idx) {
    const cols = mapColumns(row, rows.slice(idx + 1));
    const score = Object.keys(cols).length;
    return (cols.instrument != null || cols.isin != null) && score >= 3 ? cols : null;
  }

  function isSectionRow(row) {
    const filled = row.filter(function (c) {
      return String(c == null ? '' : c).trim() !== '';
    });
    if (filled.length !== 1) return null;
    const txt = String(filled[0]).trim();
    if (!txt) return null;
    if (/^[\d.,\-\s\u20B9%]+$/.test(txt)) return null;
    return txt;
  }

  function findBlocks(rows) {
    const blocks = [];
    let section = '';
    let i = 0;
    while (i < rows.length) {
      const row = rows[i] || [];
      const filled = row.filter(function (c) {
        return String(c == null ? '' : c).trim() !== '';
      });
      if (!filled.length) {
        i++;
        continue;
      }
      const sectionText = isSectionRow(row);
      if (sectionText) {
        section = sectionText;
        i++;
        continue;
      }
      const cols = isHeaderRow(row, rows, i);
      if (!cols) {
        i++;
        continue;
      }
      const data = [];
      let j = i + 1;
      while (j < rows.length) {
        const r = rows[j] || [];
        const f2 = r.filter(function (c) {
          return String(c == null ? '' : c).trim() !== '';
        });
        if (!f2.length) {
          let next = -1;
          for (let k = j + 1; k < rows.length; k++) {
            const rk = rows[k] || [];
            if (rk.some(function (c) {
              return String(c == null ? '' : c).trim() !== '';
            })) {
              next = k;
              break;
            }
          }
          if (next < 0) break;
          const nr = rows[next];
          if (isSectionRow(nr) || isHeaderRow(nr, rows, next)) break;
          j = next;
          continue;
        }
        if (isSectionRow(r)) break;
        if (isHeaderRow(r, rows, j)) break;
        data.push(r);
        j++;
      }
      blocks.push({ header: row, cols: cols, data: data, section: section });
      i = j;
    }
    return blocks;
  }

  function holdingInfoFrom(v) {
    const raw = String(v == null ? '' : v);
    const s = raw.toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return { type: null, months: null };
    if (/(LTCG|LTCL|LONGTERM)/.test(s)) return { type: 'LT', months: null };
    if (/(STCG|STCL|SHORTTERM)/.test(s)) return { type: 'ST', months: null };
    const m = raw.match(/(\d+(?:\.\d+)?)\s*(month|year)/i);
    if (m) {
      const months = Math.round(parseFloat(m[1]) * (/year/i.test(m[2]) ? 12 : 1));
      return { type: null, months: months };
    }
    return { type: null, months: null };
  }

  function parseRowsTable(rows, opts) {
    opts = opts || {};
    const blocks = findBlocks(rows);
    if (!blocks.length) return null;

    const result = { type: null, isMF: false, warnings: [], trades: [], roundtrips: [], holdings: [] };
    const override = String(opts.override || 'AUTO').toUpperCase();
    const types = new Set();

    blocks.forEach(function (block) {
      const headers = block.header;
      const cols = block.cols;
      const dataRows = block.data;
      if (!dataRows.length) return;

      const normHeaders = headers.map(norm).join('|');
      const isMF =
        /(scheme|fund|folio)/.test(normHeaders) ||
        /(^|\|)nav(\||$)/.test(normHeaders) ||
        /(^|\|)units(\||$)/.test(normHeaders) ||
        /mutual|mf/i.test(String(opts.name || ''));
      result.isMF = result.isMF || isMF;

      const sectionAsset = (function () {
        const s = String(block.section || '').toLowerCase();
        if (/debt/.test(s)) return 'DEBT_MF';
        if (/equity/.test(s)) return isMF ? 'EQUITY_MF' : 'EQUITY';
        return null;
      })();

      const get = (row, f) => (cols[f] != null ? row[cols[f]] : undefined);
      const isinOf = (row) => String(get(row, 'isin') || '').trim();
      const nameOf = (row) => String(get(row, 'instrument') || isinOf(row) || '').trim();

      function sideOf(v) {
        const s = String(v == null ? '' : v).toUpperCase();
        if (/(SELL|REDEEM|REDEMPTION|SWITCH_OUT|SWITCHOUT)/.test(s)) return 'SELL';
        if (/(BUY|PURCHASE|SIP|SWITCH_IN|SWITCHIN)/.test(s)) return 'BUY';
        return null;
      }

      function assetFor(row, name) {
        if (override !== 'AUTO') return override;
        const a = String(get(row, 'assetClass') || '').toLowerCase();
        if (a) {
          if (/(debt|liquid|gilt|bond|income|money|overnight)/.test(a)) return 'DEBT_MF';
          if (/(equity|stock|share)/.test(a)) return isMF ? 'EQUITY_MF' : 'EQUITY';
          if (/(mutual|fund)/.test(a)) return 'EQUITY_MF';
        }
        if (sectionAsset) return sectionAsset;
        if (isMF || /\bfund\b/i.test(name)) return DEBT_NAME_RE.test(name) ? 'DEBT_MF' : 'EQUITY_MF';
        return 'EQUITY';
      }

      const hasSide = cols.tradeType != null && dataRows.some(function (r) {
        return sideOf(r[cols.tradeType]) != null;
      });

      let amountCol = -1;
      const usedIdx = Object.keys(cols).map(function (k) {
        return cols[k];
      });
      for (let i = 0; i < headers.length; i++) {
        if (usedIdx.indexOf(i) >= 0) continue;
        const n = norm(headers[i]);
        if (['amount', 'value', 'transactionamount', 'grossamount', 'totalamount'].indexOf(n) >= 0) {
          amountCol = i;
          break;
        }
      }

      if (hasSide && cols.tradeDate != null && (cols.price != null || amountCol >= 0)) {
        types.add('tradebook');
        dataRows.forEach(function (row) {
          const side = sideOf(row[cols.tradeType]);
          if (!side) return;
          const name = nameOf(row);
          if (!name) return;
          const qty = numOrNull(get(row, 'qty'));
          const date = parseDate(get(row, 'tradeDate'));
          let price = numOrNull(get(row, 'price'));
          if (price == null && amountCol >= 0) {
            const amt = numOrNull(row[amountCol]);
            if (amt != null && qty) price = amt / qty;
          }
          if (qty == null || qty <= 0) {
            result.warnings.push('Skipped a ' + side + ' row for ' + name + ': missing quantity.');
            return;
          }
          if (!date) {
            result.warnings.push('Skipped a ' + side + ' row for ' + name + ': unreadable date.');
            return;
          }
          if (price == null) {
            result.warnings.push('Skipped a ' + side + ' row for ' + name + ': missing price/NAV.');
            return;
          }
          result.trades.push({
            instrument: name,
            isin: isinOf(row),
            assetClass: assetFor(row, name),
            side: side,
            qty: qty,
            price: price,
            date: date,
            charges: num(get(row, 'charges'))
          });
        });
        return;
      }

      if (cols.buyDate != null) {
        const hasGainColumns = cols.shortGain != null || cols.longGain != null;

        dataRows.forEach(function (row) {
          const name = nameOf(row);
          if (!name) return;
          if (/^(total|grandtotal|subtotal|totals)$/i.test(name.replace(/\s+/g, ''))) return;
          const qty = numOrNull(get(row, 'qty'));
          const buyDate = parseDate(get(row, 'buyDate'));
          const sellDate = parseDate(get(row, 'sellDate'));
          let buyPrice = numOrNull(get(row, 'buyPrice'));
          let sellPrice = numOrNull(get(row, 'sellPrice'));
          const buyValue = numOrNull(get(row, 'buyValue'));
          const sellValue = numOrNull(get(row, 'sellValue'));
          const investedValue = numOrNull(get(row, 'investedValue'));
          const currentPrice = numOrNull(get(row, 'currentPrice'));
          const currentValue = numOrNull(get(row, 'currentValue'));
          const charges = num(get(row, 'charges'));
          const statedPL = numOrNull(get(row, 'realizedPL'));
          const holdingInfo = holdingInfoFrom(get(row, 'holdingType'));
          const assetClass = assetFor(row, name);

          if (buyPrice == null && buyValue != null && qty) buyPrice = buyValue / qty;
          if (buyPrice == null && investedValue != null && qty) buyPrice = investedValue / qty;
          if (sellPrice == null && sellValue != null && qty) sellPrice = sellValue / qty;

          if (qty == null || qty <= 0) {
            result.warnings.push('Skipped ' + name + ': missing quantity.');
            return;
          }
          if (!buyDate) {
            result.warnings.push('Skipped ' + name + ': missing purchase date.');
            return;
          }

          const base = {
            instrument: name,
            isin: isinOf(row),
            assetClass: assetClass,
            qty: qty,
            buyDate: buyDate,
            sellDate: sellDate,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            charges: charges,
            holdingMonths: holdingInfo.months
          };

          if (hasGainColumns) {
            const shortGain = cols.shortGain != null ? numOrNull(get(row, 'shortGain')) : null;
            const longGain = cols.longGain != null ? numOrNull(get(row, 'longGain')) : null;
            let added = 0;
            if (shortGain != null && Math.abs(shortGain) > 0.000001) {
              result.roundtrips.push(Object.assign({}, base, {
                statedPL: shortGain,
                useStated: true,
                holdingType: 'ST'
              }));
              added++;
            }
            if (longGain != null && Math.abs(longGain) > 0.000001) {
              result.roundtrips.push(Object.assign({}, base, {
                statedPL: longGain,
                useStated: true,
                holdingType: 'LT'
              }));
              added++;
            }
            if (!added) {
              result.warnings.push('Skipped ' + name + ': both short-term and long-term gains are zero.');
            }
            types.add('capitalgains');
            return;
          }

          if (sellDate && (sellPrice != null || statedPL != null)) {
            result.roundtrips.push(Object.assign({}, base, {
              statedPL: statedPL,
              holdingType: holdingInfo.type
            }));
            types.add('roundtrip');
          } else if (!sellDate) {
            result.holdings.push({
              instrument: name,
              isin: isinOf(row),
              assetClass: assetClass,
              qty: qty,
              avgCost: buyPrice,
              currentPrice: currentPrice,
              currentValue: currentValue
            });
            types.add('holdings');
          } else {
            result.warnings.push('Skipped ' + name + ': sold position without sell price or P&L.');
          }
        });
        return;
      }

      if (cols.qty != null && (cols.currentValue != null || cols.currentPrice != null)) {
        types.add('holdings');
        dataRows.forEach(function (row) {
          const name = nameOf(row);
          if (!name) return;
          const qty = numOrNull(get(row, 'qty'));
          const avgCost = numOrNull(get(row, 'buyPrice'));
          const investedValue = numOrNull(get(row, 'investedValue'));
          const currentPrice = numOrNull(get(row, 'currentPrice'));
          const currentValue = numOrNull(get(row, 'currentValue'));
          if (qty == null || qty <= 0) return;
          result.holdings.push({
            instrument: name,
            isin: isinOf(row),
            assetClass: assetFor(row, name),
            qty: qty,
            avgCost: avgCost != null ? avgCost : (investedValue != null ? investedValue / qty : null),
            currentPrice: currentPrice,
            currentValue: currentValue
          });
        });
      }
    });

    const parsedSomething =
      result.trades.length || result.roundtrips.length || result.holdings.length;
    if (!parsedSomething) return null;

    result.type = resolveType(types);
    return result;
  }

  function resolveType(types) {
    if (types.size === 1) return Array.from(types)[0];
    if (types.has('capitalgains')) return 'capitalgains';
    if (types.has('tradebook')) return 'tradebook';
    if (types.has('roundtrip')) return 'roundtrip';
    if (types.has('holdings')) return 'holdings';
    return 'mixed';
  }

  function parseTables(tables, opts) {
    const merged = { type: null, isMF: false, warnings: [], trades: [], roundtrips: [], holdings: [] };
    const types = new Set();
    let any = false;

    (tables || []).forEach(function (t) {
      const tableOpts = Object.assign({}, opts, { name: opts && opts.name ? opts.name : t.name });
      const res = parseRowsTable(t.rows || [], tableOpts);
      if (!res) return;
      any = true;
      merged.isMF = merged.isMF || res.isMF;
      res.warnings.forEach(function (w) {
        merged.warnings.push(w);
      });
      merged.trades = merged.trades.concat(res.trades);
      merged.roundtrips = merged.roundtrips.concat(res.roundtrips);
      merged.holdings = merged.holdings.concat(res.holdings);
      types.add(res.type);
    });

    if (!any) {
      throw new Error('No recognizable table found. Expected columns such as ISIN, Quantity, Buy Date / Sell Date, or Transaction Type, Units, NAV, Date.');
    }

    merged.type = resolveType(types);
    return merged;
  }

  function parseText(text, opts) {
    return parseTables([{ rows: G.csv.parse(text) }], opts);
  }

  G.parsers = {
    parseText: parseText,
    parseTables: parseTables,
    parseDate: parseDate,
    num: num
  };
})();
