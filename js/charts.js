(function () {
  const G = (window.Kapital = window.Kapital || {});
  const charts = {};

  const COLORS = {
    green: '#007000',
    red: '#a00000',
    navy: '#000080',
    grid: '#c0c0c0'
  };

  function init() {
    if (!window.Chart) return false;
    if (init.done) return true;
    Chart.defaults.font.family = '"MS Sans Serif", Tahoma, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#000';
    Chart.defaults.borderColor = COLORS.grid;
    init.done = true;
    return true;
  }

  function make(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(el, cfg);
  }

  function clear() {
    Object.keys(charts).forEach(function (id) {
      charts[id].destroy();
      delete charts[id];
    });
  }

  function shortINR(v) {
    if (v == null || isNaN(v)) return '';
    const sign = v < 0 ? '-' : '';
    const a = Math.abs(v);
    if (a >= 1e7) return sign + '\u20B9' + (a / 1e7).toFixed(2) + ' Cr';
    if (a >= 1e5) return sign + '\u20B9' + (a / 1e5).toFixed(2) + ' L';
    if (a >= 1e3) return sign + '\u20B9' + (a / 1e3).toFixed(1) + 'k';
    return sign + '\u20B9' + a.toFixed(0);
  }

  const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

  function fullINR(v) {
    if (v == null || isNaN(v)) return '';
    return (v < 0 ? '-' : '') + '\u20B9' + inrFmt.format(Math.abs(Math.round(v)));
  }

  function fmtDate(d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
  }

  function titleOpt(text) {
    return {
      display: true,
      text: text,
      font: { size: 11, weight: 'bold' },
      color: '#000',
      padding: { top: 2, bottom: 8 }
    };
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  }

  function render(result) {
    if (!init()) return;
    const fys = result.fys || [];

    make('ch-fy', {
      type: 'bar',
      data: {
        labels: fys.map(function (f) { return f.label; }),
        datasets: [{
          label: 'Net realized P&L',
          data: fys.map(function (f) { return Math.round(f.netPL); }),
          backgroundColor: fys.map(function (f) { return f.netPL >= 0 ? COLORS.green : COLORS.red; }),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: titleOpt('Net realized P&L by financial year'),
          tooltip: {
            callbacks: {
              label: function (ctx) { return ' ' + fullINR(ctx.parsed.y); }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: { callback: function (v) { return shortINR(v); } },
            grid: { color: COLORS.grid }
          }
        }
      }
    });

    const cum = result.series.cumulative || [];

    make('ch-cum', {
      type: 'line',
      data: {
        labels: cum.map(function (p) { return fmtDate(p.date); }),
        datasets: [{
          label: 'Cumulative realized P&L',
          data: cum.map(function (p) { return Math.round(p.value); }),
          borderColor: COLORS.navy,
          backgroundColor: 'rgba(0, 0, 128, 0.08)',
          fill: true,
          tension: 0,
          borderWidth: 1.5,
          pointRadius: cum.length > 60 ? 0 : 2,
          pointBackgroundColor: COLORS.navy
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: titleOpt('Cumulative realized P&L over time'),
          tooltip: {
            callbacks: {
              label: function (ctx) { return ' ' + fullINR(ctx.parsed.y); }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
          },
          y: {
            ticks: { callback: function (v) { return shortINR(v); } },
            grid: { color: COLORS.grid }
          }
        }
      }
    });

    const insts = (result.instruments || []).filter(function (i) {
      return Math.abs(i.netPL) > 0.01;
    });
    const sorted = insts.slice().sort(function (a, b) { return b.netPL - a.netPL; });
    let picks;
    if (sorted.length > 16) {
      const top = sorted.slice(0, 8);
      const bottom = sorted.slice(-8).filter(function (x) { return top.indexOf(x) === -1; });
      picks = bottom.concat(top);
    } else {
      picks = sorted.slice().reverse();
    }

    make('ch-top', {
      type: 'bar',
      data: {
        labels: picks.map(function (i) { return truncate(i.name, 30); }),
        datasets: [{
          label: 'Realized net P&L',
          data: picks.map(function (i) { return Math.round(i.netPL); }),
          backgroundColor: picks.map(function (i) { return i.netPL >= 0 ? COLORS.green : COLORS.red; }),
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: titleOpt('Top gainers and losers by instrument'),
          tooltip: {
            callbacks: {
              label: function (ctx) { return ' ' + fullINR(ctx.parsed.x); }
            }
          }
        },
        scales: {
          x: {
            ticks: { callback: function (v) { return shortINR(v); } },
            grid: { color: COLORS.grid }
          },
          y: { grid: { display: false } }
        }
      }
    });
  }

  G.charts = { render: render, clear: clear };
})();

