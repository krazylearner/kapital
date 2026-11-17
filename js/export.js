(function () {
  const G = (window.Kapital = window.Kapital || {});

  const MIME = {
    csv: 'text/csv;charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    html: 'text/html;charset=utf-8'
  };

  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  const PRINT_CSS = [
    '@page { size: A4 portrait; margin: 14mm; }',
    '* { box-sizing: border-box; }',
    'body { margin: 0; color: #111; font: 11pt/1.4 "Segoe UI", system-ui, sans-serif; }',
    'h1 { margin: 0 0 2mm; font-size: 18pt; }',
    'h2 { margin: 6mm 0 2mm; font-size: 12pt; }',
    'p { margin: 0 0 2mm; }',
    '.subtitle { margin: 0 0 4mm; color: #444; }',
    'table { width: 100%; margin: 0 0 4mm; border-collapse: collapse; }',
    'th, td { padding: 1.5mm 2mm; border: 1px solid #999; text-align: left; vertical-align: top; }',
    'th { background: #e6e6e6; font-weight: 600; }',
    'td.num { text-align: right; }',
    'thead { display: table-header-group; }',
    'tr { page-break-inside: avoid; }',
    'table.meta th { width: 35%; }',
    '.note { color: #444; font-size: 9.5pt; }',
    'footer { margin-top: 6mm; padding-top: 2mm; border-top: 1px solid #999; color: #555; font-size: 9pt; }'
  ].join('\n');

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function makeDate(year, month, day) {
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = new Date(year, month, day);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
    return d;
  }

  function toDate(value) {
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    const s = String(value == null ? '' : value).trim();
    if (!s) return null;

    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
    if (m) return makeDate(+m[1], +m[2] - 1, +m[3]);

    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
      let day = +m[1];
      let month = +m[2];
      if (month > 12 && day <= 12) {
        const swap = day;
        day = month;
        month = swap;
      }
      return makeDate(+m[3], month - 1, day);
    }

    m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s,-]+(\d{4})$/);
    if (m) {
      const month = MONTHS[String(m[2]).slice(0, 3).toLowerCase()];
      if (month != null) return makeDate(+m[3], month, +m[1]);
    }

    m = s.match(/^([A-Za-z]{3,})[\s-]+(\d{1,2}),?[\s-]+(\d{4})$/);
    if (m) {
      const month = MONTHS[String(m[1]).slice(0, 3).toLowerCase()];
      if (month != null) return makeDate(+m[3], month, +m[2]);
    }

    const fallback = new Date(s);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  function formatDate(value) {
    const d = toDate(value);
    if (!d) return '';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function formatNumber(value, options) {
    if (value == null || value === '' || typeof value === 'boolean') return '';
    let n = value;
    if (typeof n !== 'number') {
      n = Number(String(value).replace(/[\u20B9,\s]/g, ''));
    }
    if (!isFinite(n)) return '';
    const decimals = options && options.decimals != null ? options.decimals : 2;
    if (decimals < 0) return '';
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(n * factor) / factor;
    if (Object.is(rounded, -0) || rounded === 0) return '0';
    if (Math.abs(rounded) >= 1e21) return rounded.toFixed(0);
    return String(rounded);
  }

  function formatValue(value, column) {
    const type = column && column.type ? column.type : 'text';
    if (type === 'date') return formatDate(value);
    if (type === 'number') return formatNumber(value, column);
    if (type === 'integer') return formatNumber(value, { decimals: 0 });
    return value == null ? '' : String(value);
  }

  function normalizeSchema(schema) {
    const spec = Array.isArray(schema) ? { columns: schema } : (schema || {});
    const columns = (spec.columns || []).map(function (column) {
      if (typeof column === 'string') return { key: column, header: column, type: 'text' };
      return {
        key: column.key,
        header: column.header != null ? column.header : column.key,
        type: column.type || 'text',
        decimals: column.decimals,
        width: column.width,
        value: column.value
      };
    });
    return {
      columns: columns,
      templateVersion: spec.templateVersion || null,
      lineEnding: spec.lineEnding || '\r\n',
      includeHeader: spec.includeHeader !== false,
      title: spec.title || null
    };
  }

  function columnValue(row, column) {
    return typeof column.value === 'function' ? column.value(row) : row[column.key];
  }

  function needsQuote(text, delimiter) {
    const s = String(text);
    const delim = delimiter || ',';
    return s.indexOf(delim) >= 0 || s.indexOf('"') >= 0 || /[\r\n]/.test(s) || s !== s.trim();
  }

  function quoteCell(text, delimiter) {
    const s = String(text);
    return needsQuote(s, delimiter) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvCell(value, column, delimiter) {
    return quoteCell(formatValue(value, column), delimiter);
  }

  function table(rows, schema, options) {
    const spec = normalizeSchema(schema);
    const opts = options || {};
    const out = [];
    if (opts.includeHeader != null ? opts.includeHeader : spec.includeHeader) {
      out.push(spec.columns.map(function (column) {
        return column.header == null ? '' : String(column.header);
      }));
    }
    (rows || []).forEach(function (row) {
      out.push(spec.columns.map(function (column) {
        return formatValue(columnValue(row, column), column);
      }));
    });
    return out;
  }

  function csv(rows, schema, options) {
    const spec = normalizeSchema(schema);
    const opts = options || {};
    const lineEnding = opts.lineEnding != null ? opts.lineEnding : spec.lineEnding;
    const delimiter = opts.delimiter || ',';
    const includeHeader = opts.includeHeader != null ? opts.includeHeader : spec.includeHeader;
    const lines = [];

    if (includeHeader) {
      lines.push(spec.columns.map(function (column) {
        return quoteCell(column.header == null ? '' : column.header, delimiter);
      }).join(delimiter));
    }
    (rows || []).forEach(function (row) {
      lines.push(spec.columns.map(function (column) {
        return csvCell(columnValue(row, column), column, delimiter);
      }).join(delimiter));
    });

    const body = lines.length ? lines.join(lineEnding) + lineEnding : '';
    return opts.bom ? '\uFEFF' + body : body;
  }

  function workbook(sheets, options) {
    const opts = options || {};
    const XLSX = opts.xlsx || (typeof window !== 'undefined' ? window.XLSX : null);
    if (!XLSX || !XLSX.utils) throw new Error('SheetJS (window.XLSX) is not loaded');
    const wb = XLSX.utils.book_new();

    (sheets || []).forEach(function (sheet, index) {
      const spec = normalizeSchema(sheet);
      const aoa = [];
      if (spec.includeHeader) {
        aoa.push(spec.columns.map(function (column) {
          return column.header == null ? '' : String(column.header);
        }));
      }
      (sheet.rows || []).forEach(function (row) {
        aoa.push(spec.columns.map(function (column) {
          const raw = columnValue(row, column);
          if (column.type === 'date') return formatDate(raw);
          if (column.type === 'number' || column.type === 'integer') {
            const text = formatValue(raw, column);
            return text === '' ? '' : Number(text);
          }
          return raw == null ? '' : String(raw);
        }));
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = spec.columns.map(function (column) {
        return { wch: column.width || Math.max(10, String(column.header || '').length + 2) };
      });
      const name = String(sheet.name || 'Sheet' + (index + 1))
        .replace(/[\\/?*[\]:]/g, '-')
        .slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    return wb;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function htmlTable(rows, schema, options) {
    const spec = normalizeSchema(schema);
    const opts = options || {};
    const head = '<thead><tr>' + spec.columns.map(function (column) {
      return '<th scope="col">' + escapeHtml(column.header) + '</th>';
    }).join('') + '</tr></thead>';
    const body = (rows || []).map(function (row) {
      return '<tr>' + spec.columns.map(function (column) {
        const numeric = column.type === 'number' || column.type === 'integer';
        const text = formatValue(columnValue(row, column), column);
        return '<td' + (numeric ? ' class="num"' : '') + '>' + escapeHtml(text) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table' + (opts.className ? ' class="' + escapeHtml(opts.className) + '"' : '') + '>' +
      head + '<tbody>' + body + '</tbody></table>';
  }

  function printView(spec) {
    spec = spec || {};
    const extraCss = spec.css ? '\n' + spec.css : '';
    const meta = (spec.meta || []).map(function (pair) {
      return '<tr><th scope="row">' + escapeHtml(pair[0]) + '</th><td>' + escapeHtml(pair[1]) + '</td></tr>';
    }).join('');
    const sections = (spec.sections || []).map(function (section) {
      const title = section.title ? '<h2>' + escapeHtml(section.title) + '</h2>' : '';
      return title + htmlTable(section.rows || [], section);
    }).join('');
    const notes = (spec.notes || []).map(function (note) {
      return '<p class="note">' + escapeHtml(note) + '</p>';
    }).join('');
    const subtitle = spec.subtitle ? '<p class="subtitle">' + escapeHtml(spec.subtitle) + '</p>' : '';

    return '<!doctype html>\n' +
      '<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<title>' + escapeHtml(spec.title || 'Kapital export') + '</title>\n' +
      '<style>\n' + PRINT_CSS + extraCss + '\n</style>\n' +
      '</head>\n<body>\n' +
      '<header><h1>' + escapeHtml(spec.title || 'Kapital export') + '</h1>' + subtitle + '</header>\n' +
      (meta ? '<table class="meta"><tbody>' + meta + '</tbody></table>\n' : '') +
      (spec.html || '') +
      sections + notes +
      (spec.footer ? '<footer>' + escapeHtml(spec.footer) + '</footer>\n' : '') +
      '</body>\n</html>\n';
  }

  function print(spec) {
    if (typeof document === 'undefined') return false;
    const html = printView(spec);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', (spec && spec.title) || 'Printable export');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;';
    document.body.appendChild(frame);

    const frameDoc = frame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    let started = false;
    function run() {
      if (started) return;
      started = true;
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } finally {
        setTimeout(function () {
          frame.remove();
        }, 1000);
      }
    }
    frame.addEventListener('load', run);
    setTimeout(run, 150);
    return true;
  }

  function downloadBlob(filename, blob) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  }

  function downloadText(filename, text, mime) {
    if (typeof Blob === 'undefined') return false;
    return downloadBlob(filename, new Blob([String(text)], { type: mime || 'text/plain;charset=utf-8' }));
  }

  function downloadCsv(filename, rows, schema, options) {
    return downloadText(filename, csv(rows, schema, options), MIME.csv);
  }

  function downloadWorkbook(filename, sheets, options) {
    const opts = options || {};
    const XLSX = opts.xlsx || (typeof window !== 'undefined' ? window.XLSX : null);
    if (!XLSX) return false;
    const wb = workbook(sheets, opts);
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return downloadBlob(filename, new Blob([data], { type: MIME.xlsx }));
  }

  function fileName(base, ext) {
    const name = String(base == null ? 'kapital-export' : base)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = ext ? (String(ext).charAt(0) === '.' ? '' : '.') + ext : '';
    return (name || 'kapital-export') + suffix;
  }

  G.export = {
    csv: csv,
    table: table,
    workbook: workbook,
    printView: printView,
    print: print,
    htmlTable: htmlTable,
    downloadText: downloadText,
    downloadCsv: downloadCsv,
    downloadWorkbook: downloadWorkbook,
    formatDate: formatDate,
    formatNumber: formatNumber,
    formatValue: formatValue,
    needsQuote: needsQuote,
    fileName: fileName,
    schema: normalizeSchema,
    MIME: MIME
  };
})();
