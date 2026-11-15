(function () {
  const G = (window.Kapital = window.Kapital || {});

  const equityPL = [
    'Stock Name,ISIN,Quantity,Buy Date,Buy Price,Sell Date,Sell Price,Current Price,Charges',
    'Infosys Ltd,INE009A01021,20,2023-06-15,1450.00,2024-08-01,1720.00,,60',
    'Tata Consultancy Services Ltd,INE467B01029,10,2024-05-10,3800.00,2024-11-20,4200.00,,45',
    'Reliance Industries Ltd,INE002A01018,15,2024-01-05,2600.00,2025-02-10,2900.00,,55',
    'Tata Motors Ltd,INE155A01022,30,2025-09-10,950.00,2026-03-05,880.00,,65',
    'Wipro Ltd,INE075A01022,40,2024-06-20,450.00,2025-09-15,530.00,,40',
    'HDFC Bank Ltd,INE040A01034,25,2025-06-01,1650.00,,,1780.00,0',
    'ITC Ltd,INE154A01025,50,2024-02-12,410.00,,,465.00,0'
  ].join('\n');

  const mfStatement = [
    'Scheme Name,ISIN,Transaction Type,Date,Units,NAV,Amount,Charges',
    'Parag Parikh Flexi Cap Fund - Direct Growth,INF204KA1MS3,PURCHASE,2023-04-10,120,58.20,6984.00,0',
    'Parag Parikh Flexi Cap Fund - Direct Growth,INF204KA1MS3,PURCHASE,2024-02-15,80,71.50,5720.00,0',
    'Parag Parikh Flexi Cap Fund - Direct Growth,INF204KA1MS3,REDEMPTION,2025-08-20,100,88.70,8870.00,5',
    'HDFC Corporate Bond Fund - Direct Growth,INF179K01XQ0,PURCHASE,2024-03-01,500,28.40,14200.00,0',
    'HDFC Corporate Bond Fund - Direct Growth,INF179K01XQ0,REDEMPTION,2025-10-10,500,31.05,15525.00,5',
    'Mirae Asset Large Cap Fund - Direct Growth,INF769K01AX2,PURCHASE,2025-01-20,150,98.30,14745.00,0'
  ].join('\n');

  const holdings = [
    'Instrument,ISIN,Quantity,Average Cost,Current Price,Current Value',
    'Mirae Asset Large Cap Fund - Direct Growth,INF769K01AX2,150,98.30,112.40,16860.00',
    'HDFC Bank Ltd,INE040A01034,25,1650.00,1780.00,44500.00',
    'ITC Ltd,INE154A01025,50,410.00,465.00,23250.00'
  ].join('\n');

  const capitalGains = [
    'Scheme Name,Scheme Code,Category,Folio Number,Purchase Transaction Id,Purchase Date,Matched Quantity,Purchase Price,Redeem Transaction Id,Redeem Date,Grandfathered Nav,Redeem Price,Short Term-Capital Gain,Long Term-Capital Gain',
    'Canara Robeco Small Cap Fund Direct Growth,146130,Equity,17744699871,492692283,2022-08-16,192.743,25.94,2764590213,2026-06-03,0,42.31,0,3155.2',
    'PGIM India Flexi Cap Fund Direct Growth,133839,Equity,9104579211,1064790583,2025-01-20,100,40,2803383299,2026-06-15,0,46.5,650,0',
    'SBI ELSS Tax Saver Fund Direct Growth,119723,Equity,33663212,732263296,2023-06-09,50,100,2791419943,2026-06-15,0,94,0,-300'
  ].join('\n');

  G.samples = [
    { name: 'sample_equity_pl_report.csv', text: equityPL },
    { name: 'sample_mf_statement.csv', text: mfStatement },
    { name: 'sample_holdings.csv', text: holdings },
    { name: 'sample_capital_gains.csv', text: capitalGains }
  ];
})();
