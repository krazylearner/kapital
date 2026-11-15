# Kapital

**Your Groww P&L, XIRR and capital gains in 10 seconds — in your browser.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[GitHub](https://github.com/krazylearner/kapital) · [Issues](https://github.com/krazylearner/kapital/issues)

Kapital reads Groww CSV/XLSX exports and turns them into FY-wise realized and
unrealized P&L, ROI, XIRR and capital-gains tax estimates — then renders a
shareable summary image. Everything runs client-side: no upload, no login, no
cookies, no backend.

> Unofficial and independent. Not affiliated with Groww. Tax figures are
> estimates — verify with your CA before filing.

![Kapital share summary](tools/share-preview.png)

## What it does

- Realized P&L with FIFO lot matching, charges and split/bonus handling
- Unrealized P&L from holdings exports (no live prices are fetched)
- Indian financial-year breakdown (April–March) with cumulative net P&L
- XIRR across all buy/sell cashflows plus current value of open holdings
- Capital-gains tax estimates, including the 23 Jul 2024 regime change
  (legacy vs current STCG/LTCG rates, equity/debt, LTCG exemption)
- Per-instrument and open-holdings tables
- Shareable PNG summary + a QR/link back to the app

## Supported inputs

Drag any combination of these into the app:

| Export | Examples |
| --- | --- |
| P&L report | `sample_equity_pl_report.csv` |
| Mutual fund statement | `sample_mf_statement.csv` |
| Holdings export | `sample_holdings.csv` |
| Capital gains report | `sample_capital_gains.csv` |
| Equity tradebook | CSV/XLSX |

Use **Load sample data** to try it without any real exports.

## Run locally

No build step, no dependencies to install:

```sh
python -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly also works, but a local server makes file
handling and sharing behave like production.

## Deploy

The repo is static. Any of these work with zero configuration:

- **GitHub Pages** — Settings → Pages → deploy from `main` / root
- **Cloudflare Pages** — framework preset: none, output directory: `/`
- **Netlify / Vercel** — no build command, publish directory `/`

Before going live, set your domain in these four places:

- `js/config.js` → `siteUrl` (share image QR code, caption, share links)
- `index.html` → `canonical`, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`
- `robots.txt` → `Sitemap:`
- `sitemap.xml` → `<loc>`

## Privacy

Parsing, calculation, charts and image generation all happen in `js/*.js` in
the browser tab. There is no `fetch`/XHR of user data anywhere in the codebase.
Verify it yourself: open DevTools → Network, load your exports, and watch that
no request carries them. The only external requests are the CDN assets
(98.css, Chart.js, SheetJS, qrcode-generator).

## Project layout

```
index.html        shell, SEO/OG metadata, dialogs
css/style.css     Win98-themed styling
js/config.js      brand, domain, repo — edit this first
js/parsers.js     CSV/XLSX detection and normalization
js/calc.js        FIFO matching, FY aggregation, XIRR, tax estimates
js/charts.js      in-app charts
js/share.js       summary image, QR code, captions, share intents
js/samples.js     sample exports for demos and tests
js/app.js         UI wiring and rendering
tools/og-image.html   regenerates og-image.png (open it, then click Save)
tools/share-preview.png  sample summary image for this README
```

## Contributing

Issues and PRs welcome. Useful first contributions:

- More broker/export formats (Zerodha, Upstox, INDmoney, ICICI Direct)
- Accuracy fixtures for tax edge cases
- Accessibility and mobile polish
- Additional languages

Please keep the client-side-only constraint: no server, no telemetry that reads
file contents.

## License

MIT — see [LICENSE](LICENSE).
