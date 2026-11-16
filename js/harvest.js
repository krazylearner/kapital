(function () {
  const G = window.Kapital;
  const $ = (id) => document.getElementById(id);

  const state = {
    startYear: null,
    selected: {},
    terms: {}
  };

  let last = { result: null, settings: null, rows: [] };

  const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

  function fmt(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return (v < 0 ? '-' : '') + '\u20B9' + inrFmt.format(Math.abs(Math.round(v)));
  }

  function fmtQty(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return qtyFmt.format(v);
  }

  function colored(v) {
    if (v == null || isNaN(v)) return '\u2014';
    const c = v > 0 ? 'pos' : v < 0 ? 'neg' : '';
    return '<span class="' + c + '">' + fmt(v) + '</span>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function keyOf(row) {
    return row.isin || row.instrument;
  }

  function lossOf(row) {
    return row.pl != null && row.pl < 0 ? -row.pl : 0;
  }

  function autoTerm(row) {
    if (row.date instanceof Date && !isNaN(row.date)) {
      return G.calc.isLongTerm(row.assetClass, row.date, new Date(), null) ? 'LT' : 'ST';
    }
    return null;
  }

  function termOf(row) {
    const k = keyOf(row);
    if (state.terms[k]) return state.terms[k];
    return autoTerm(row) || 'ST';
  }

  function defaultFY(fys) {
    const todayFy = G.calc.fyOf(new Date());
    if (fys.some(function (f) { return f.startYear === todayFy; })) return todayFy;
    return fys[fys.length - 1].startYear;
  }

  function lossRows(result) {
    const rows = (result.unrealized && result.unrealized.rows) || [];
    return rows
      .filter(function (r) { return lossOf(r) > 0; })
      .sort(function (a, b) { return a.pl - b.pl; });
  }

  function renderFYOptions(fys) {
    const sel = $('harvest-fy');
    sel.innerHTML = fys.map(function (f) {
      return '<option value="' + f.startYear + '">' + esc(f.label) + '</option>';
    }).join('');
    sel.value = String(state.startYear);
  }

  function renderTable(rows) {
    const table = $('harvest-table');
    if (!rows.length) {
      table.innerHTML = '<tbody><tr><td class="empty">No open holdings show an unrealized loss in the loaded files. Add a holdings export with current values, or pick another file, to use the simulator.</td></tr></tbody>';
      return;
    }

    const head = '<thead><tr>' +
      '<th class="pick"><span class="sr-only">Include</span></th>' +
      '<th>Instrument</th>' +
      '<th class="num">Qty</th>' +
      '<th class="num">Invested</th>' +
      '<th class="num">Current value</th>' +
      '<th class="num">Unrealized loss</th>' +
      '<th>Term</th>' +
      '</tr></thead>';

    const body = rows.map(function (r) {
      const k = keyOf(r);
      const detected = autoTerm(r);
      const assumed = !detected;
      const term = termOf(r);
      const opts = ['ST', 'LT'].map(function (t) {
        return '<option value="' + t + '"' + (term === t ? ' selected' : '') + '>' +
          (t === 'ST' ? 'Short' : 'Long') + '</option>';
      }).join('');
      return '<tr' + (state.selected[k] ? ' class="sel"' : '') + '>' +
        '<td class="pick"><input type="checkbox" data-key="' + esc(k) + '"' + (state.selected[k] ? ' checked' : '') + ' aria-label="Include ' + esc(r.instrument) + '"></td>' +
        '<td>' + esc(r.instrument) + '</td>' +
        '<td class="num">' + fmtQty(r.qty) + '</td>' +
        '<td class="num">' + fmt(r.invested) + '</td>' +
        '<td class="num">' + fmt(r.current) + '</td>' +
        '<td class="num">' + colored(r.pl) + '</td>' +
        '<td><select data-term="' + esc(k) + '" title="' + (assumed ? 'Purchase date not in the exports; assumed short-term. Change if this lot is older.' : 'Inferred from the purchase date in your exports.') + '">' + opts + '</select></td>' +
        '</tr>';
    }).join('');

    table.innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  function renderCards(result, settings, rows) {
    const fy = result.fys.filter(function (f) { return f.startYear === state.startYear; })[0];
    let stLoss = 0;
    let ltLoss = 0;
    let count = 0;

    rows.forEach(function (r) {
      if (!state.selected[keyOf(r)]) return;
      count += 1;
      const loss = lossOf(r);
      if (termOf(r) === 'LT') ltLoss += loss;
      else stLoss += loss;
    });

    const available = rows.reduce(function (a, r) { return a + lossOf(r); }, 0);
    const sim = G.calc.simulateHarvest(result.fys, settings, state.startYear, {
      stLoss: stLoss,
      ltLoss: ltLoss
    });
    const carried = sim.carriedSt + sim.carriedLt;
    const laterSaved = Math.max(0, sim.totalTaxSaved - sim.taxSaved);

    const cards = [
      {
        label: 'Realized net this FY',
        value: fy ? colored(fy.netPL) : '\u2014',
        sub: fy ? 'ST ' + fmt(fy.stNet) + ' &middot; LT ' + fmt(fy.ltNet) : ''
      },
      {
        label: 'Est. tax this FY',
        value: fmt(sim.baselineTax),
        sub: 'before harvesting'
      },
      {
        label: 'Harvestable losses',
        value: fmt(available),
        sub: rows.length + ' holding' + (rows.length === 1 ? '' : 's') + ' at a loss'
      },
      {
        label: 'Tax after harvesting',
        value: fmt(sim.simulatedTax),
        sub: count ? 'saves ' + fmt(sim.taxSaved) : 'nothing selected'
      },
      {
        label: 'Loss booked',
        value: fmt(stLoss + ltLoss),
        sub: count ? 'ST ' + fmt(stLoss) + ' &middot; LT ' + fmt(ltLoss) : 'select holdings below'
      }
    ];

    $('harvest-cards').innerHTML = cards.map(function (c) {
      return '<div class="card">' +
        '<div class="card-label">' + c.label + '</div>' +
        '<div class="card-value">' + c.value + '</div>' +
        '<div class="card-sub">' + c.sub + '</div>' +
        '</div>';
    }).join('');

    let note;
    if (!rows.length) {
      note = 'To simulate harvesting, load a holdings or P&L export that includes the current market value of your open positions.';
    } else if (!count) {
      note = 'Pick holdings below to see how booking their losses changes this financial year\u2019s estimated tax.';
    } else {
      note = 'Booking ' + fmt(stLoss + ltLoss) + ' of losses cuts the estimated tax for ' + (fy ? fy.label : 'this FY') +
        ' by ' + fmt(sim.taxSaved) + '.';
      if (laterSaved > 0.5) {
        note += ' It also cuts later loaded financial years by ' + fmt(laterSaved) + '.';
      }
      if (carried > 0.5) {
        note += ' ' + fmt(carried) + ' of that loss exceeds this year\u2019s gains and is carried forward (up to 8 years).';
      }
    }
    note += ' Short-term losses offset short- and long-term gains; long-term losses offset only long-term gains.' +
      ' Term is inferred from purchase dates where present; otherwise it is assumed short-term \u2014 adjust per holding.';

    $('harvest-note').innerHTML = esc(note);
  }

  function render(result, settings) {
    const panel = $('harvest-panel');
    if (!panel) return;

    if (!result || result.empty || !result.fys || !result.fys.length) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');

    const fys = result.fys;
    if (state.startYear == null || !fys.some(function (f) { return f.startYear === state.startYear; })) {
      state.startYear = defaultFY(fys);
    }

    const rows = lossRows(result);
    const keys = {};
    rows.forEach(function (r) { keys[keyOf(r)] = true; });
    Object.keys(state.selected).forEach(function (k) {
      if (!keys[k]) delete state.selected[k];
    });
    Object.keys(state.terms).forEach(function (k) {
      if (!keys[k]) delete state.terms[k];
    });

    last = { result: result, settings: settings, rows: rows };

    renderFYOptions(fys);
    renderTable(rows);
    renderCards(result, settings, rows);
  }

  function refresh() {
    if (last.result) render(last.result, last.settings);
  }

  function init() {
    const panel = $('harvest-panel');
    if (!panel) return;

    $('harvest-fy').addEventListener('change', function (e) {
      state.startYear = Number(e.target.value);
      refresh();
    });

    panel.addEventListener('change', function (e) {
      const cb = e.target.closest('input[data-key]');
      if (cb) {
        const k = cb.getAttribute('data-key');
        if (cb.checked) state.selected[k] = true;
        else delete state.selected[k];
        refresh();
        return;
      }
      const sel = e.target.closest('select[data-term]');
      if (sel) {
        state.terms[sel.getAttribute('data-term')] = sel.value;
        refresh();
      }
    });

    $('harvest-all').addEventListener('click', function () {
      last.rows.forEach(function (r) { state.selected[keyOf(r)] = true; });
      refresh();
    });

    $('harvest-none').addEventListener('click', function () {
      state.selected = {};
      refresh();
    });
  }

  G.harvest = { render: render };

  init();
})();
