(function () {
  const G = window.Kapital;
  const $ = (id) => document.getElementById(id);

  const state = {
    files: [],
    settings: Object.assign({}, G.calc.defaults),
    result: null,
    ledger: [],
    isinGroups: {},
    sort: { key: 'netPL', dir: -1 }
  };

  let nextId = 1;

  const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

  function fmt(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return (v < 0 ? '-' : '') + '\u20B9' + inrFmt.format(Math.abs(v));
  }

  function fmtPct(v, alreadyPercent) {
    if (v == null || isNaN(v)) return '\u2014';
    return (v * (alreadyPercent ? 1 : 100)).toFixed(2) + '%';
  }

  function fmtQty(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return qtyFmt.format(v);
  }

  function cls(v) {
    return v == null || isNaN(v) ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  }

  function cell(v, extra) {
    return '<td class="num ' + (extra || '') + '">' + v + '</td>';
  }

  function colored(value) {
    if (value == null || isNaN(value)) return '\u2014';
    return '<span class="' + cls(value) + '">' + fmt(value) + '</span>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function typeLabel(f) {
    if (f.error) return '<span class="ferr">' + esc(f.error) + '</span>';
    if (f.type === 'tradebook') return 'tradebook';
    if (f.type === 'capitalgains') return 'capital gains (ST/LT)';
    if (f.type === 'roundtrip') return 'P&L / capital gains';
    if (f.type === 'holdings') return 'holdings';
    if (f.type === 'mixed') return 'mixed reports';
    return 'unknown';
  }

  function workbookTables(buffer) {
    const wb = window.XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
    return wb.SheetNames.map(function (sn) {
      return {
        name: sn,
        rows: window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' })
      };
    });
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const buf = reader.result;
        const bytes = new Uint8Array(buf);
        const isZip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
        const isLegacyXls = /\.xls$/i.test(file.name);
        if (isZip || isLegacyXls) {
          try {
            if (!window.XLSX) {
              throw new Error('Excel parser (SheetJS) is not available. Check your internet connection and reload.');
            }
            resolve({ name: file.name, size: file.size, tables: workbookTables(buf) });
          } catch (err) {
            reject(err);
          }
          return;
        }
        resolve({ name: file.name, size: file.size, text: new TextDecoder('utf-8').decode(bytes) });
      };
      reader.onerror = function () {
        reject(reader.error);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function addFile(name, payload) {
    const text = typeof payload === 'string' ? payload : (payload && payload.text) || null;
    const tables = payload && payload.tables ? payload.tables : null;
    const size = payload && payload.size ? payload.size : 0;
    const sig = text != null ? 'text:' + text : 'tables:' + JSON.stringify(tables);
    const duplicate = state.files.some(function (f) {
      return f.name === name && f.sig === sig;
    });
    if (duplicate) return false;
    state.files.push({
      id: nextId++,
      name: name,
      text: text,
      tables: tables,
      sig: sig,
      size: size,
      override: 'AUTO',
      type: null,
      error: null
    });
    return true;
  }

  function rebuild() {
    const acc = { warnings: [] };
    let ledger = [];

    state.files.forEach(function (f) {
      f.error = null;
      f.type = null;
      try {
        const parsed = f.tables
          ? G.parsers.parseTables(f.tables, { name: f.name, override: f.override })
          : G.parsers.parseText(f.text, { name: f.name, override: f.override });
        f.type = parsed.type;
        parsed.warnings.forEach(function (w) {
          acc.warnings.push(f.name + ': ' + w);
        });
        ledger = ledger.concat(G.ledger.fromParsed(parsed, {
          id: f.id,
          file: f.name,
          type: parsed.type
        }));
      } catch (err) {
        f.error = err.message;
      }
    });

    if (G.isin) G.isin.applyToLedger(ledger);
    state.ledger = ledger;
    state.result = ledger.length ? G.calc.compute({
      ledger: ledger,
      warnings: acc.warnings,
      settings: state.settings
    }) : null;

    render();
  }

  function renderFiles() {
    const panel = $('files-panel');
    const list = $('file-list');

    if (!state.files.length) {
      panel.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    panel.classList.remove('hidden');
    list.innerHTML = state.files.map(function (f) {
      const opts = [
        ['AUTO', 'Auto detect'],
        ['EQUITY', 'Equity'],
        ['EQUITY_MF', 'Equity MF'],
        ['DEBT_MF', 'Debt MF']
      ];
      const sel = opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (f.override === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');
      return '<div class="file-row">' +
        '<span class="fname" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
        '<span class="ftype">' + typeLabel(f) + '</span>' +
        (f.error ? '' : '<select name="asset-class" data-id="' + f.id + '" title="Asset class">' + sel + '</select>') +
        '<button class="mini-btn" type="button" data-remove="' + f.id + '">Remove</button>' +
        '</div>';
    }).join('');
  }

  function renderIsinReview() {
    const panel = $('isin-panel');
    const list = $('isin-list');
    const note = $('isin-note');
    if (!panel || !list || !G.isin) return;

    const groups = {};
    (state.ledger || []).forEach(function (row) {
      if (!row.instrument) return;
      const flags = row.flags || [];
      const needs = flags.indexOf('needs_isin') >= 0;
      const invalid = flags.indexOf('invalid_isin') >= 0;
      if (!needs && !invalid && row.isinSource !== 'manual') return;
      const key = G.isin.normalizeName(row.instrument);
      if (!key) return;
      let g = groups[key];
      if (!g) {
        g = groups[key] = {
          key: key,
          name: row.instrument,
          rows: 0,
          files: {},
          isin: null,
          source: null,
          suggestion: null,
          needs: false,
          invalid: false
        };
      }
      g.rows += 1;
      if (row.sourceFile) g.files[row.sourceFile] = true;
      if (row.isin) g.isin = row.isin;
      if (row.isinSource) g.source = row.isinSource;
      if (!g.suggestion && row.isinSuggestion) g.suggestion = row.isinSuggestion;
      if (needs) g.needs = true;
      if (invalid) g.invalid = true;
    });

    const keys = Object.keys(groups).sort(function (a, b) {
      return groups[a].name.localeCompare(groups[b].name);
    });
    state.isinGroups = groups;

    if (!keys.length) {
      panel.classList.add('hidden');
      list.innerHTML = '';
      note.textContent = '';
      return;
    }

    let unresolved = 0;
    let manualCount = 0;
    let invalidCount = 0;
    keys.forEach(function (k) {
      if (groups[k].needs) unresolved += 1;
      if (groups[k].source === 'manual') manualCount += 1;
      if (groups[k].invalid) invalidCount += 1;
    });

    panel.classList.remove('hidden');
    list.innerHTML = keys.map(function (k) {
      const g = groups[k];
      const files = Object.keys(g.files).join(', ');
      const manual = g.source === 'manual';
      const meta = [];
      if (files) meta.push(esc(files));
      meta.push(g.rows + ' row' + (g.rows === 1 ? '' : 's'));
      if (manual) meta.push('manual override');
      if (g.invalid) meta.push('invalid ISIN');

      let actions = '';
      if (g.suggestion && !manual) {
        actions += '<span class="isin-suggest">Match: ' + esc(g.suggestion.name) +
          ' (' + esc(g.suggestion.isin) + ', ' + Math.round(g.suggestion.score * 100) + '% similar)</span>' +
          '<button class="mini-btn" type="button" data-isin-suggest="' + esc(k) + '">Use match</button>';
      }
      actions += '<input type="text" maxlength="12" placeholder="INE..." aria-label="ISIN for ' + esc(g.name) + '"' +
        ' data-isin-input="' + esc(k) + '" value="' + esc(manual || g.invalid ? g.isin : '') + '">' +
        '<button class="mini-btn" type="button" data-isin-apply="' + esc(k) + '">' +
        (manual || g.invalid ? 'Change' : 'Set ISIN') + '</button>';

      return '<div class="isin-row">' +
        '<div class="isin-main"><strong title="' + esc(g.name) + '">' + esc(g.name) + '</strong>' +
        '<span class="isin-meta">' + meta.join(' \u00B7 ') + '</span></div>' +
        '<div class="isin-actions">' + actions + '</div>' +
        '</div>';
    }).join('');

    const parts = [];
    if (unresolved) parts.push(unresolved + ' securit' + (unresolved === 1 ? 'y' : 'ies') + ' still need' + (unresolved === 1 ? 's' : '') + ' an ISIN');
    if (manualCount) parts.push(manualCount + ' manual override' + (manualCount === 1 ? '' : 's'));
    if (invalidCount) parts.push(invalidCount + ' invalid ISIN' + (invalidCount === 1 ? '' : 's'));
    note.textContent = parts.join('; ') + '. ISINs are filled from a bundled public map; matches and overrides stay on this device and last for this session only.';
  }

  function renderWarnings(result) {
    const panel = $('warnings-panel');
    const list = $('warnings-list');
    const warnings = result ? result.warnings : [];
    if (!warnings || !warnings.length) {
      panel.classList.add('hidden');
      list.innerHTML = '';
      return;
    }
    panel.classList.remove('hidden');
    list.innerHTML = warnings.map(function (w) {
      return '<li>' + esc(w) + '</li>';
    }).join('');
  }

  function renderCards(result) {
    const t = result.totals;
    const u = result.unrealized;
    const cards = [
      {
        label: 'Net realized P&L',
        value: colored(t ? t.netPL : null),
        sub: result.fys.length + ' financial year' + (result.fys.length === 1 ? '' : 's')
      },
      {
        label: 'Profit after tax (est.)',
        value: colored(t ? t.pat : null),
        sub: 'estimated tax ' + fmt(t ? t.tax : null)
      },
      {
        label: 'Unrealized P&L',
        value: u && u.rows.length
          ? (u.complete ? colored(u.pl) : (u.hasPriced ? colored(u.partialPL) : '\u2014'))
          : '\u2014',
        sub: u && u.rows.length
          ? (u.missing ? u.missing + ' of ' + u.rows.length + ' holding(s) missing price' : u.rows.length + ' open holding(s)')
          : 'no open holdings in exports'
      },
      {
        label: 'Overall ROI',
        value: t && t.roi != null ? fmtPct(t.roi) : '\u2014',
        sub: 'on ' + fmt(t ? t.invested : null) + ' invested'
      },
      {
        label: 'XIRR (annualized)',
        value: result.xirr != null ? fmtPct(result.xirr) : '\u2014',
        sub: result.xirrFlows ? result.xirrFlows + ' cashflows' : 'not enough cashflows'
      }
    ];

    $('cards').innerHTML = cards.map(function (c) {
      return '<div class="card">' +
        '<div class="card-label">' + esc(c.label) + '</div>' +
        '<div class="card-value">' + c.value + '</div>' +
        '<div class="card-sub">' + esc(c.sub) + '</div>' +
        '</div>';
    }).join('');
  }

  function renderFYTable(result) {
    const rows = result.fys;
    const tot = result.totals;
    const head = '<thead><tr>' +
      '<th>Financial year</th>' +
      '<th class="num">Invested</th>' +
      '<th class="num">Proceeds</th>' +
      '<th class="num">Gross P&amp;L</th>' +
      '<th class="num">Charges</th>' +
      '<th class="num">Net P&amp;L</th>' +
      '<th class="num">STCG (net)</th>' +
      '<th class="num">LTCG (net)</th>' +
      '<th class="num">Est. tax</th>' +
      '<th class="num">Profit after tax</th>' +
      '<th class="num">ROI</th>' +
      '</tr></thead>';

    const body = rows.map(function (f) {
      return '<tr>' +
        '<td>' + esc(f.label) + '</td>' +
        cell(fmt(f.invested)) +
        cell(fmt(f.proceeds)) +
        cell(colored(f.grossPL)) +
        cell(fmt(f.charges)) +
        cell(colored(f.netPL)) +
        cell(colored(f.stNet)) +
        cell(colored(f.ltNet)) +
        cell(fmt(f.tax)) +
        cell(colored(f.pat)) +
        cell(fmtPct(f.roi)) +
        '</tr>';
    }).join('');

    const totalRow = '<tr class="total">' +
      '<td>All financial years</td>' +
      cell(fmt(tot.invested)) +
      cell(fmt(tot.proceeds)) +
      cell(colored(tot.grossPL)) +
      cell(fmt(tot.charges)) +
      cell(colored(tot.netPL)) +
      cell(colored(tot.stNet)) +
      cell(colored(tot.ltNet)) +
      cell(fmt(tot.tax)) +
      cell(colored(tot.pat)) +
      cell(fmtPct(tot.roi)) +
      '</tr>';

    $('fy-table').innerHTML = head + '<tbody>' + body + totalRow + '</tbody>';

    const s = state.settings;
    $('tax-note').textContent =
      'Tax estimate uses STCG ' + s.stcg + '% and LTCG ' + s.ltcg + '% above ' + fmt(s.exemption) +
      ' for equity / equity MF; debt MF STCG at slab ' + s.slab + '% and LTCG ' + s.debtLtcg + '%.' +
      ' Transfers before 23 Jul 2024 use legacy rates (' + s.legacyStcg + '% / ' + s.legacyLtcg + '% / exemption ' + fmt(s.legacyExemption) + ').' +
      ' One LTCG exemption applies per financial year from FY 2024-25 (₹1 lakh before).' +
      ' Loss set-off is modelled per FY: short-term losses offset short- and long-term gains (highest-taxed first), long-term losses offset only long-term gains, and unused losses carry forward up to 8 years.' +
      ' Editable via "Tax settings".';
  }

  function sortValue(item, key) {
    if (key === 'name') return item.name || '';
    const v = item[key];
    return v == null ? -Infinity : v;
  }

  function renderInstrTable(result) {
    const dir = state.sort.dir;
    const key = state.sort.key;
    const rows = result.instruments.slice().sort(function (a, b) {
      if (key === 'name') return a.name.localeCompare(b.name) * dir;
      return (sortValue(a, key) - sortValue(b, key)) * dir;
    });

    function th(label, sortKey, extra) {
      if (!sortKey) return '<th class="' + (extra || '') + '">' + label + '</th>';
      const arrow = state.sort.key === sortKey ? (state.sort.dir > 0 ? ' \u25B2' : ' \u25BC') : '';
      return '<th class="sortable ' + (extra || '') + '" data-sort="' + sortKey + '">' + label + arrow + '</th>';
    }

    const head = '<thead><tr>' +
      th('Instrument', 'name') +
      th('Asset', null) +
      th('Sold qty', 'qtySold', 'num') +
      th('Gross P&amp;L', 'grossPL', 'num') +
      th('Charges', 'charges', 'num') +
      th('Realized net', 'netPL', 'num') +
      '</tr></thead>';

    const body = rows.map(function (i) {
      return '<tr>' +
        '<td>' + esc(i.name) + '</td>' +
        '<td>' + esc(assetLabel(i.assetClass)) + '</td>' +
        cell(fmtQty(i.qtySold)) +
        cell(colored(i.grossPL)) +
        cell(fmt(i.charges)) +
        cell(colored(i.netPL)) +
        '</tr>';
    }).join('');

    $('instr-table').innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  function assetLabel(a) {
    if (a === 'EQUITY_MF') return 'Equity MF';
    if (a === 'DEBT_MF') return 'Debt MF';
    return 'Equity';
  }

  function renderHoldTable(result) {
    const u = result.unrealized;
    if (!u || !u.rows.length) {
      $('hold-table').innerHTML = '<tbody><tr><td class="empty">No open holdings in the loaded files.</td></tr></tbody>';
      $('hold-note').textContent = '';
      return;
    }

    const head = '<thead><tr>' +
      '<th>Instrument</th>' +
      '<th class="num">Qty</th>' +
      '<th class="num">Avg cost</th>' +
      '<th class="num">Current value</th>' +
      '<th class="num">Invested</th>' +
      '<th class="num">Unrealized P&amp;L</th>' +
      '<th class="num">%</th>' +
      '</tr></thead>';

    const body = u.rows.map(function (h) {
      return '<tr>' +
        '<td>' + esc(h.instrument) + '</td>' +
        cell(fmtQty(h.qty)) +
        cell(fmt(h.avgCost)) +
        cell(fmt(h.current)) +
        cell(fmt(h.invested)) +
        cell(colored(h.pl)) +
        cell(fmtPct(h.plPct)) +
        '</tr>';
    }).join('');

    const totalRow = '<tr class="total">' +
      '<td>Total' + (u.complete ? '' : ' (priced only)') + '</td>' +
      cell('') +
      cell('') +
      cell(fmt(u.hasPriced ? u.current : null)) +
      cell(fmt(u.complete ? u.invested : u.pricedInvested)) +
      cell(colored(u.complete ? u.pl : (u.hasPriced ? u.partialPL : null))) +
      cell(fmtPct(u.complete ? (u.invested ? u.pl / u.invested : null) : u.partialPct)) +
      '</tr>';

    $('hold-table').innerHTML = head + '<tbody>' + body + totalRow + '</tbody>';

    $('hold-note').textContent = u.missing
      ? u.missing + ' holding(s) have no current market value in the exports; totals cover only priced holdings. Add a holdings export that includes current value/price for a complete unrealized P&L.'
      : 'Current values come from the uploaded holdings/P&L export; no live prices are fetched.';
  }

  function renderCharts(result) {
    G.charts.render(result);
    const hasRealized = result.fys && result.fys.length > 0;
    $('chart-note').textContent = hasRealized
      ? 'XIRR is computed from all buy/sell cashflows plus the current value of open holdings; holdings without a market value are excluded.'
      : 'No realized sales found in the loaded files, so gain charts are empty.';
  }

  function render() {
    renderFiles();
    const r = state.result;
    renderWarnings(r);
    renderIsinReview();

    const hasData = r && !r.empty;
    $('dashboard').classList.toggle('hidden', !hasData);

    if (hasData) {
      renderCards(r);
      renderFYTable(r);
      renderInstrTable(r);
      renderHoldTable(r);
      renderCharts(r);
      if (G.harvest) G.harvest.render(r, state.settings);
    } else if (G.charts) {
      G.charts.clear();
    }

    const total = state.files.length;
    const bad = state.files.filter(function (f) { return f.error; }).length;
    $('status').textContent = !total
      ? 'Ready'
      : bad
        ? bad + ' file(s) could not be parsed'
        : 'Ready';
    $('status-files').textContent = total + ' file(s) loaded';
  }

  function handleFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    Promise.all(files.map(readFile)).then(function (reads) {
      reads.forEach(function (r) {
        addFile(r.name, r);
      });
      rebuild();
    }).catch(function (err) {
      $('status').textContent = 'Could not read file: ' + (err && err.message ? err.message : 'unknown error');
    });
  }

  function fillSettingsInputs() {
    const s = state.settings;
    $('set-stcg').value = s.stcg;
    $('set-ltcg').value = s.ltcg;
    $('set-exempt').value = s.exemption;
    $('set-lstcg').value = s.legacyStcg;
    $('set-lltcg').value = s.legacyLtcg;
    $('set-lexempt').value = s.legacyExemption;
    $('set-debtlt').value = s.debtLtcg;
    $('set-ldebtlt').value = s.legacyDebtLtcg;
    $('set-slab').value = s.slab;
  }

  function readSettingsInputs() {
    const d = G.calc.defaults;
    function q(id, fallback) {
      const v = parseFloat($(id).value);
      return isFinite(v) && v >= 0 ? v : fallback;
    }
    state.settings = {
      stcg: q('set-stcg', d.stcg),
      ltcg: q('set-ltcg', d.ltcg),
      exemption: q('set-exempt', d.exemption),
      legacyStcg: q('set-lstcg', d.legacyStcg),
      legacyLtcg: q('set-lltcg', d.legacyLtcg),
      legacyExemption: q('set-lexempt', d.legacyExemption),
      debtLtcg: q('set-debtlt', d.debtLtcg),
      legacyDebtLtcg: q('set-ldebtlt', d.legacyDebtLtcg),
      slab: q('set-slab', d.slab)
    };
  }

  function loadSamples() {
    G.samples.forEach(function (s) {
      addFile(s.name, s.text);
    });
    rebuild();
  }

  function bindEvents() {
    $('btn-open').addEventListener('click', function () {
      $('file-input').click();
    });

    $('file-input').addEventListener('change', function (e) {
      handleFiles(e.target.files);
      e.target.value = '';
    });

    $('btn-sample').addEventListener('click', loadSamples);

    $('btn-clear').addEventListener('click', function () {
      state.files = [];
      state.result = null;
      state.ledger = [];
      state.isinGroups = {};
      render();
    });

    $('btn-settings').addEventListener('click', function () {
      fillSettingsInputs();
      $('settings-modal').classList.remove('hidden');
    });

    $('btn-share').addEventListener('click', function () {
      if (!state.result || state.result.empty) {
        $('status').textContent = 'Load some files first to share a summary.';
        return;
      }
      G.share.show(state.result);
    });

    $('settings-x').addEventListener('click', function () {
      $('settings-modal').classList.add('hidden');
    });

    $('settings-apply').addEventListener('click', function () {
      readSettingsInputs();
      $('settings-modal').classList.add('hidden');
      if (state.files.length) rebuild();
      else render();
    });

    $('settings-reset').addEventListener('click', function () {
      state.settings = Object.assign({}, G.calc.defaults);
      fillSettingsInputs();
      if (state.files.length) rebuild();
    });

    const dz = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('drag');
      });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
    dz.addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') $('file-input').click();
    });

    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    $('file-list').addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-remove]');
      if (!btn) return;
      const id = Number(btn.getAttribute('data-remove'));
      state.files = state.files.filter(function (f) { return f.id !== id; });
      rebuild();
    });

    $('file-list').addEventListener('change', function (e) {
      const sel = e.target.closest('select[data-id]');
      if (!sel) return;
      const id = Number(sel.getAttribute('data-id'));
      state.files.forEach(function (f) {
        if (f.id === id) f.override = sel.value;
      });
      rebuild();
    });

    $('isin-list').addEventListener('click', function (e) {
      const suggestBtn = e.target.closest('button[data-isin-suggest]');
      const applyBtn = e.target.closest('button[data-isin-apply]');
      if (!suggestBtn && !applyBtn) return;
      const btn = suggestBtn || applyBtn;
      const key = btn.getAttribute(suggestBtn ? 'data-isin-suggest' : 'data-isin-apply');
      const group = (state.isinGroups || {})[key];
      if (!group) return;
      let value = '';
      if (suggestBtn) {
        value = group.suggestion ? group.suggestion.isin : '';
      } else {
        const row = btn.closest('.isin-row');
        const input = row ? row.querySelector('input[data-isin-input]') : null;
        value = input ? input.value : '';
      }
      const result = G.isin.setManual(group.name, value);
      if (!result.ok) {
        $('status').textContent = result.error;
        return;
      }
      rebuild();
      $('status').textContent = 'ISIN ' + (result.cleared ? 'override cleared' : 'override applied for this session') + '.';
    });

    $('isin-list').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches('input[data-isin-input]')) return;
      const row = e.target.closest('.isin-row');
      const btn = row ? row.querySelector('button[data-isin-apply]') : null;
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    });

    $('instr-table').addEventListener('click', function (e) {
      const th = e.target.closest('th[data-sort]');
      if (!th || !state.result) return;
      const key = th.getAttribute('data-sort');
      if (state.sort.key === key) state.sort.dir *= -1;
      else {
        state.sort.key = key;
        state.sort.dir = key === 'name' ? 1 : -1;
      }
      renderInstrTable(state.result);
    });
  }

  function autoLoadDemo() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') !== '1') return;
      loadSamples();
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      }
      const dashboard = $('dashboard');
      if (dashboard && dashboard.scrollIntoView) {
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      $('status').textContent = 'Could not load the sample data.';
    }
  }

  bindEvents();
  render();
  autoLoadDemo();
})();
