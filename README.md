<p align="center"><a href="https://kapital-abl.pages.dev"><img src="assets/logo.svg" width="72" height="72" alt="Kapital logo"></a></p>

<h1 align="center">Kapital</h1>

<p align="center"><strong>Your Groww P&L, XIRR and capital gains in 10 seconds — in your browser.</strong></p>

<p align="center">
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

<table align="center">
  <tr>
    <td align="center"><img src="assets/brokers/groww.png" height="32" alt="Groww"><br><sub>Groww · supported</sub></td>
    <td align="center"><img src="assets/brokers/zerodha.svg" height="32" alt="Zerodha"><br><sub>Zerodha · planned</sub></td>
    <td align="center"><img src="assets/brokers/upstox.svg" height="22" alt="Upstox"><br><sub>Upstox · planned</sub></td>
    <td align="center"><img src="assets/brokers/indmoney.svg" height="32" alt="INDmoney"><br><sub>INDmoney · planned</sub></td>
    <td align="center"><img src="assets/brokers/icicibank.svg" height="32" alt="ICICI Direct"><br><sub>ICICI Direct · planned</sub></td>
  </tr>
</table>

Groww exports work today. Zerodha, Upstox, INDmoney and ICICI Direct are
planned — see [Contributing](#contributing).

Kapital reads Groww CSV/XLSX exports and turns them into FY-wise realized and
unrealized P&L, ROI, XIRR and capital-gains tax estimates — then renders a
shareable summary image. Everything runs client-side: no upload, no login, no
cookies, no backend.

> Unofficial and independent. Not affiliated with Groww or any other broker
> shown above; their names and logos are trademarks of their respective
> owners. Tax figures are estimates — verify with your CA before filing.

## What it does

- Realized P&L with FIFO lot matching, charges and split/bonus handling
- Unrealized P&L from holdings exports (no live prices are fetched)
- Indian financial-year breakdown (April–March) with cumulative net P&L
- XIRR across all buy/sell cashflows plus current value of open holdings
- Capital-gains tax estimates, including the 23 Jul 2024 regime change
  (legacy vs current STCG/LTCG rates, equity/debt, LTCG exemption)
- Per-instrument and open-holdings tables
- Tax-loss harvesting simulator: select open losses and see the effect on this
  financial year's estimated tax
- Shareable PNG summary + a QR/link back to the app

## Kapital vs. ChatGPT, for this task

A comparison for one job — turning a Groww export into P&L and capital-gains
numbers. [See the full comparison](https://kapital-abl.pages.dev/why-kapital).

| What matters | Kapital | ChatGPT |
| --- | :---: | :---: |
| Your export stays on your device | ✅ | ❌ |
| Repeatable, deterministic calculation | ✅ | ❌ |
| No prompt writing | ✅ | ❌ |
| Indian FY + 2024 STCG/LTCG rules built in | ✅ | ❌ |
| Open-source, auditable calculation | ✅ | ❌ |
| Free, no account | ✅ | ❌ |
| Charts and shareable summary image | ✅ | ❌ |
| General explanations and follow-up questions | ❌ | ✅ |

✅ = built in / default. ❌ = not built in, not guaranteed, or requires
uploading data / extra prompting.

ChatGPT is a trademark of OpenAI. Kapital is not affiliated with OpenAI.

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

## Demo

Fully functional demo: **https://kapital-abl.pages.dev**

## Privacy

Parsing, calculation, charts and image generation all happen in `js/*.js` in
the browser tab. There is no `fetch`/XHR of user data anywhere in the codebase.
Verify it yourself: open DevTools → Network, load your exports, and watch that
no request carries them. The only external requests are the CDN assets
(98.css, Chart.js, SheetJS, qrcode-generator).

The site loads Cloudflare Web Analytics (`js/analytics.js`) for cookieless
page-view counts. It never sees file contents, filenames or computed numbers.
Set `analytics.beaconToken` in `js/config.js` to an empty string to disable it.

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
