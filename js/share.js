(function () {
  const G = (window.Kapital = window.Kapital || {});

  const CONFIG = G.config || {};
  const BRAND = CONFIG.brand || 'Kapital';
  const SITE_URL = CONFIG.siteUrl || 'https://kapital-abl.pages.dev';
  const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const COLORS = {
    green: '#007000',
    red: '#a00000',
    navy: '#000080',
    grid: '#c0c0c0',
    ink: '#000',
    muted: '#444',
    bg: '#008080',
    card: '#ffffff',
    tile: '#efefef'
  };

  const FONT = '"MS Sans Serif", Tahoma, sans-serif';

  const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

  function fmt(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return (v < 0 ? '-' : '') + '\u20B9' + inrFmt.format(Math.abs(v));
  }

  function fmtPct(v) {
    if (v == null || isNaN(v)) return '\u2014';
    return (v * 100).toFixed(2) + '%';
  }

  function shortINR(v) {
    if (v == null || isNaN(v)) return '';
    const sign = v < 0 ? '-' : '';
    const a = Math.abs(v);
    if (a >= 1e7) return sign + '\u20B9' + (a / 1e7).toFixed(1) + 'Cr';
    if (a >= 1e5) return sign + '\u20B9' + (a / 1e5).toFixed(1) + 'L';
    if (a >= 1e3) return sign + '\u20B9' + (a / 1e3).toFixed(0) + 'k';
    return sign + '\u20B9' + a.toFixed(0);
  }

  function colorFor(v) {
    if (v == null || isNaN(v) || v === 0) return COLORS.ink;
    return v > 0 ? COLORS.green : COLORS.red;
  }

  function dateLabel() {
    return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function stamp() {
    const d = new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function truncateToWidth(ctx, text, maxW) {
    text = String(text == null ? '' : text);
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(text.slice(0, mid) + '\u2026').width <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + '\u2026';
  }

  function drawQr(ctx, url, x, y, size) {
    if (typeof qrcode !== 'function') return false;
    let qr;
    try {
      qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
    } catch (e) {
      return false;
    }
    const n = qr.getModuleCount();
    const quiet = 2;
    const total = n + quiet * 2;
    const cell = size / total;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
    return true;
  }

  function summaryTiles(result) {
    const t = result.totals || {};
    const u = result.unrealized;
    const uVal = u && u.rows.length
      ? (u.complete ? u.pl : (u.hasPriced ? u.partialPL : null))
      : null;
    const uSub = u && u.rows.length
      ? (u.missing ? u.missing + ' of ' + u.rows.length + ' holding(s) unpriced' : u.rows.length + ' open holding(s)')
      : 'no open holdings';
    const fyCount = (result.fys || []).length;
    return [
      { label: 'Net realized P&L', value: fmt(t.netPL), raw: t.netPL, sub: fyCount + ' financial year' + (fyCount === 1 ? '' : 's') },
      { label: 'Total invested', value: fmt(t.invested), raw: null, sub: 'cost of realized holdings' },
      { label: 'Total proceeds', value: fmt(t.proceeds), raw: null, sub: 'realized sale value' },
      { label: 'Profit after tax (est.)', value: fmt(t.pat), raw: t.pat, sub: 'estimated tax ' + fmt(t.tax) },
      { label: 'Unrealized P&L', value: fmt(uVal), raw: uVal, sub: uSub },
      { label: 'Overall ROI', value: fmtPct(t.roi), raw: t.roi, sub: 'on ' + fmt(t.invested) + ' invested' },
      { label: 'XIRR (annualized)', value: fmtPct(result.xirr), raw: result.xirr, sub: result.xirrFlows ? result.xirrFlows + ' cashflows' : 'not enough cashflows' }
    ];
  }

  function pickTopInstruments(result, limit) {
    const insts = (result.instruments || []).filter(function (i) {
      return Math.abs(i.netPL) > 0.01;
    });
    return insts.slice()
      .sort(function (a, b) { return Math.abs(b.netPL) - Math.abs(a.netPL); })
      .slice(0, limit)
      .sort(function (a, b) { return b.netPL - a.netPL; });
  }

  function drawFyChart(ctx, fys, x, y, w, h) {
    const values = fys.map(function (f) { return f.netPL; });
    if (!fys.length) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = '18px ' + FONT;
      ctx.textBaseline = 'top';
      ctx.fillText('No realized sales found in the loaded files.', x, y + 10);
      return;
    }

    const top = y + 10;
    const bottom = y + h - 30;
    const plotH = bottom - top;
    let min = Math.min.apply(null, [0].concat(values));
    let max = Math.max.apply(null, [0].concat(values));
    if (min === max) max = min + 1;
    const span = max - min;
    const scale = plotH / span;
    const zeroY = top + max * scale;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, zeroY + 0.5);
    ctx.lineTo(x + w, zeroY + 0.5);
    ctx.stroke();

    ctx.font = '13px ' + FONT;
    ctx.fillStyle = COLORS.muted;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (max > 0) ctx.fillText(shortINR(max), x, top + 8);
    if (min < 0) ctx.fillText(shortINR(min), x, bottom - 8);
    ctx.textAlign = 'start';

    const slot = w / fys.length;
    const barW = Math.min(84, slot * 0.62);
    const compact = fys.length > 5;

    fys.forEach(function (f, i) {
      const cx = x + slot * i + slot / 2;
      const v = f.netPL;
      const barH = Math.max(1, Math.abs(v) * scale);
      const barTop = v >= 0 ? zeroY - barH : zeroY;
      ctx.fillStyle = v >= 0 ? COLORS.green : COLORS.red;
      ctx.fillRect(cx - barW / 2, barTop, barW, barH);

      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      const vLabel = truncateToWidth(ctx, compact ? shortINR(v) : fmt(v), slot - 6);
      if (v >= 0) {
        ctx.fillStyle = colorFor(v);
        ctx.textBaseline = 'bottom';
        ctx.fillText(vLabel, cx, barTop - 4);
      } else if (barH >= 24) {
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'top';
        ctx.fillText(vLabel, cx, zeroY + 5);
      } else {
        ctx.fillStyle = colorFor(v);
        ctx.textBaseline = 'top';
        ctx.fillText(vLabel, cx, Math.min(barTop + barH + 4, bottom - 18));
      }

      const fyFont = slot < 96 ? 13 : 15;
      ctx.font = fyFont + 'px ' + FONT;
      ctx.fillStyle = COLORS.ink;
      ctx.textBaseline = 'top';
      const fyText = slot < 96 ? String(f.label).replace(/^FY\s+/, '') : f.label;
      ctx.fillText(truncateToWidth(ctx, fyText, slot - 6), cx, bottom + 8);
    });

    ctx.textAlign = 'start';
  }

  function drawTopChart(ctx, picks, x, y, w, h) {
    if (!picks.length) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = '18px ' + FONT;
      ctx.textBaseline = 'top';
      ctx.fillText('No instrument-level realized P&L to show.', x, y + 10);
      return;
    }

    const rowH = 34;
    const nameW = 270;
    const valueW = 150;
    const barX = x + nameW + 16;
    const barMaxW = w - nameW - 16 - valueW;
    const maxAbs = Math.max.apply(null, picks.map(function (p) { return Math.abs(p.netPL); })) || 1;
    const scale = barMaxW / maxAbs;

    picks.forEach(function (p, i) {
      const cy = y + i * rowH + rowH / 2;
      const barW = Math.max(2, Math.abs(p.netPL) * scale);

      ctx.font = '15px ' + FONT;
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncateToWidth(ctx, p.name, nameW), barX - 12, cy);

      ctx.fillStyle = p.netPL >= 0 ? COLORS.green : COLORS.red;
      ctx.fillRect(barX, cy - 10, barW, 20);

      ctx.font = 'bold 14px ' + FONT;
      ctx.fillStyle = colorFor(p.netPL);
      ctx.textAlign = 'left';
      ctx.fillText(fmt(p.netPL), barX + barW + 8, cy);
    });

    ctx.textAlign = 'start';
  }

  function compose(result) {
    const W = 1080;
    const PAD = 40;
    const CARD_PAD = 32;
    const INNER = W - PAD * 2 - CARD_PAD * 2;

    const tiles = summaryTiles(result);
    const picks = pickTopInstruments(result, 12);
    const fys = result.fys || [];

    const headerH = 118;
    const tileH = 112;
    const tileGap = 18;
    const tileCols = 3;
    const tileRows = Math.ceil(tiles.length / tileCols);
    const summaryH = tileRows * tileH + (tileRows - 1) * tileGap;
    const secGap = 34;
    const secTitleH = 40;
    const fyChartH = 250;
    const topRows = Math.max(picks.length, 1);
    const topChartH = topRows * 34 + 10;
    const footerH = 112;

    const contentH = headerH + summaryH + secGap + secTitleH + fyChartH + secGap + secTitleH + topChartH + footerH;
    const H = PAD * 2 + CARD_PAD * 2 + contentH;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'start';

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = COLORS.card;
    ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD + 0.5, PAD + 0.5, W - PAD * 2 - 1, H - PAD * 2 - 1);

    const x0 = PAD + CARD_PAD;
    let y = PAD + CARD_PAD;

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 34px ' + FONT;
    ctx.fillText(BRAND + ' \u2014 P&L Analyzer', x0, y);
    ctx.font = '18px ' + FONT;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('Portfolio P&L summary \u2014 generated ' + dateLabel(), x0, y + 46);

    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = COLORS.navy;
    ctx.textAlign = 'right';
    ctx.fillText(SITE_HOST, x0 + INNER, y + 12);
    ctx.textAlign = 'start';

    ctx.strokeStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.moveTo(x0, y + headerH - 26.5);
    ctx.lineTo(x0 + INNER, y + headerH - 26.5);
    ctx.stroke();

    y += headerH;

    const tileW = (INNER - tileGap * (tileCols - 1)) / tileCols;
    tiles.forEach(function (tile, i) {
      const col = i % tileCols;
      const row = Math.floor(i / tileCols);
      const spanFull = tiles.length % tileCols === 1 && i === tiles.length - 1;
      const tw = spanFull ? INNER : tileW;
      const tx = x0 + col * (tileW + tileGap);
      const ty = y + row * (tileH + tileGap);

      ctx.fillStyle = COLORS.tile;
      ctx.fillRect(tx, ty, tw, tileH);
      ctx.strokeStyle = '#808080';
      ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, tileH - 1);
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(tx + 1.5, ty + tileH - 1.5);
      ctx.lineTo(tx + 1.5, ty + 1.5);
      ctx.lineTo(tx + tw - 1.5, ty + 1.5);
      ctx.stroke();

      ctx.fillStyle = COLORS.muted;
      ctx.font = '16px ' + FONT;
      ctx.fillText(truncateToWidth(ctx, tile.label, tw - 32), tx + 16, ty + 14);

      ctx.fillStyle = colorFor(tile.raw);
      ctx.font = 'bold 28px ' + FONT;
      ctx.fillText(truncateToWidth(ctx, tile.value, tw - 32), tx + 16, ty + 40);

      ctx.fillStyle = '#555';
      ctx.font = '14px ' + FONT;
      ctx.fillText(truncateToWidth(ctx, tile.sub, tw - 32), tx + 16, ty + 82);
    });

    y += summaryH + secGap;

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Net realized P&L by financial year', x0, y);
    y += secTitleH;
    drawFyChart(ctx, fys, x0, y, INNER, fyChartH);
    y += fyChartH + secGap;

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Top gainers and losers \u2014 realized net P&L', x0, y);
    y += secTitleH;
    drawTopChart(ctx, picks, x0, y, INNER, topChartH);
    y += topChartH;

    ctx.strokeStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.moveTo(x0, y + 12.5);
    ctx.lineTo(x0 + INNER, y + 12.5);
    ctx.stroke();

    const footY = y + 30;
    const qrSize = 76;
    const hasQr = drawQr(ctx, SITE_URL, x0 + INNER - qrSize, footY, qrSize);
    const textMaxW = INNER - (hasQr ? qrSize + 20 : 0);

    ctx.textAlign = 'start';
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText(truncateToWidth(ctx, 'Free P&L, XIRR and capital gains analyzer', textMaxW), x0, footY);

    ctx.fillStyle = COLORS.navy;
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(SITE_HOST, x0, footY + 26);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(truncateToWidth(ctx, 'Computed locally from Groww exports \u2014 no data left the browser.', textMaxW), x0, footY + 48);
    ctx.fillText(truncateToWidth(ctx, 'Unofficial tool, not affiliated with Groww. Tax figures are estimates.', textMaxW), x0, footY + 66);

    return canvas;
  }

  function caption(result) {
    const t = result.totals || {};
    const fyCount = (result.fys || []).length;
    const parts = ['My portfolio P&L: net ' + fmt(t.netPL)];
    if (fyCount) parts.push('across ' + fyCount + ' FY' + (fyCount === 1 ? '' : 's'));
    if (t.roi != null) parts.push('ROI ' + fmtPct(t.roi));
    if (result.xirr != null) parts.push('XIRR ' + fmtPct(result.xirr));
    return parts.join(', ') + '. Analyzed in-browser with ' + BRAND + ' \u2014 ' + SITE_URL;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve) {
      if (!canvas.toBlob) {
        resolve(null);
        return;
      }
      canvas.toBlob(function (blob) { resolve(blob); }, 'image/png');
    });
  }

  let current = null;

  function pageUrl() {
    return /^https?:/i.test(location.href) ? location.href : '';
  }

  function shareLinks(text) {
    const url = pageUrl();
    const withUrl = url ? text + '\n' + url : text;
    const links = [
      { name: 'X (Twitter)', href: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + (url ? '&url=' + encodeURIComponent(url) : '') },
      { name: 'WhatsApp', href: 'https://wa.me/?text=' + encodeURIComponent(withUrl) },
      { name: 'Telegram', href: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text) },
      { name: 'Reddit', href: 'https://www.reddit.com/submit?title=' + encodeURIComponent('My portfolio P&L summary') + '&url=' + encodeURIComponent(url) },
      {
        name: 'LinkedIn',
        href: url
          ? 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url)
          : 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(text)
      }
    ];
    return links;
  }

  function setNote(msg) {
    const el = document.getElementById('share-note');
    if (el) el.textContent = msg;
  }

  function renderModal(result) {
    const img = document.getElementById('share-img');
    if (img) img.src = current.url;

    const linksBox = document.getElementById('share-links');
    if (linksBox) {
      linksBox.innerHTML = shareLinks(current.text).map(function (l) {
        return '<a class="share-link" href="' + l.href + '" target="_blank" rel="noopener noreferrer">' + l.name + '</a>';
      }).join('');
    }

    const nativeBtn = document.getElementById('share-native');
    if (nativeBtn) nativeBtn.classList.toggle('hidden', !canNativeShare());

    setNote('Image generated in your browser and never uploaded. Social sites cannot attach an image from a link \u2014 download it and add it to your post.');
  }

  function canNativeShare() {
    if (!navigator.share) return false;
    if (navigator.canShare && current && current.file) {
      try {
        return navigator.canShare({ files: [current.file] });
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  function show(result) {
    if (!result || result.empty) return;
    const canvas = compose(result);
    toBlob(canvas).then(function (blob) {
      if (current && current.url) URL.revokeObjectURL(current.url);
      const filename = 'kapital-pnl-summary-' + stamp() + '.png';
      const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
      current = {
        blob: blob,
        url: url,
        filename: filename,
        text: caption(result),
        file: blob ? new File([blob], filename, { type: 'image/png' }) : null
      };
      renderModal(result);
      const modal = document.getElementById('share-modal');
      if (modal) modal.classList.remove('hidden');
    });
  }

  function hide() {
    const modal = document.getElementById('share-modal');
    if (modal) modal.classList.add('hidden');
  }

  function download() {
    if (!current) return;
    const a = document.createElement('a');
    a.href = current.url;
    a.download = current.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function copyCaption() {
    if (!current) return;
    const text = current.text;
    function done() { setNote('Caption copied to clipboard \u2014 paste it into your post.'); }
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } catch (e) {
        setNote('Could not copy automatically \u2014 select the text below.\n' + text);
      }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  function nativeShare() {
    if (!current || !current.file) return false;
    if (!navigator.share) return false;
    const data = { files: [current.file], title: BRAND + ' portfolio P&L summary', text: current.text };
    navigator.share(data).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      setNote('Native sharing failed in this browser \u2014 use "Download image" and attach it to your post.');
    });
    return true;
  }

  function bind() {
    const modal = document.getElementById('share-modal');
    if (!modal) return;
    const x = document.getElementById('share-x');
    if (x) x.addEventListener('click', hide);
    const dl = document.getElementById('share-download');
    if (dl) dl.addEventListener('click', download);
    const cp = document.getElementById('share-copy');
    if (cp) cp.addEventListener('click', copyCaption);
    const ns = document.getElementById('share-native');
    if (ns) {
      ns.addEventListener('click', function () {
        if (!nativeShare()) {
          setNote('Native sharing is not available in this browser. Use "Download image" and attach it to your post.');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  G.share = { show: show, compose: compose, caption: caption };
})();
