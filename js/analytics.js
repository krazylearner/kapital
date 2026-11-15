(function () {
  var G = window.Kapital || {};
  var cfg = G.config || {};
  var token = cfg.analytics && cfg.analytics.beaconToken;
  if (!token || window.__kapitalBeacon) return;

  var host = location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1' || /\.local$/.test(host)) return;

  window.__kapitalBeacon = true;

  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.defer = true;
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: token }));
  document.head.appendChild(s);
})();
