(function () {
  const G = (window.Kapital = window.Kapital || {});

  function parse(text) {
    const s = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch !== '\r') {
        field += ch;
      }
    }

    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(function (r) {
      return r.some(function (c) {
        return String(c).trim() !== '';
      });
    });
  }

  G.csv = { parse: parse };
})();
