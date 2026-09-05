/* ==========================================================================
   AQUABATTLE — router a start aplikace
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el;

  var ROUTES = [
    { path: 'prehled', label: 'Přehled' },
    { path: 'tymy',    label: 'Týmy' },
    { path: 'zapasy',  label: 'Zápasy' },
    { path: 'pickban', label: 'Pick & Ban' },
    { path: 'pavouk',  label: 'Pavouk' },
    { path: 'staty',   label: 'Statistiky' },
    { path: 'hraci',   label: 'Hráči' },
    { path: 'admin',   label: 'Admin' }
  ];

  function currentRoute() {
    var h = (w.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.some(function (r) { return r.path === h; }) ? h : 'prehled';
  }

  function renderNav() {
    var nav = AB.clear(AB.$('#nav-links'));
    var cur = currentRoute();
    ROUTES.forEach(function (r) {
      nav.appendChild(el('a.nav-link' + (r.path === cur ? '.active' : ''), { href: '#/' + r.path }, r.label));
    });
  }

  function render() {
    var route = currentRoute();
    var app = AB.clear(AB.$('#app'));
    renderNav();

    // Se serverem je zdrojem pravdy soubor a admin do něj píše rovnou.
    // Bez serveru se dorovnají odložené úpravy z prohlížeče.
    AB.applyRosterOverrides();
    AB.applyMatchOverrides();

    // teams.js žije na volume, players.js v repu — po výměně kapitána se
    // rozejdou a tým by zůstal viset na tom původním. Srovnáme podle repa.
    var opraveni = AB.normalizeCaptains();
    if (opraveni) console.warn('[AQUABATTLE] kapitáni srovnaní podle players.js: ' + opraveni);

    var view = AB.views[route];
    if (!view) {
      app.appendChild(AB.ui.empty('Stránka nenalezena', 'Tahle sekce neexistuje.'));
      return;
    }

    try {
      app.appendChild(view());
    } catch (err) {
      console.error('[AQUABATTLE] chyba při vykreslení "' + route + '":', err);
      app.appendChild(AB.ui.empty('Něco se rozbilo',
        'Sekce "' + route + '" se nepodařila vykreslit — nejspíš je chyba v datech. Detail najdeš v konzoli prohlížeče (F12). ' +
        (err && err.message ? '(' + err.message + ')' : '')));
    }

    w.scrollTo(0, 0);
  }

  /** Překreslí aktuální pohled (používá draft po každém picku). */
  AB.reload = render;

  /* ---------------------------------------------------------------- boot -- */

  function boot() {
    // nejdřív zjisti, jestli běží server — na tom závisí, kam se ukládá
    AB.api.detect().then(function (online) {
      console.info(online
        ? '[AQUABATTLE] Server běží — admin zapisuje rovnou do data/.'
        : '[AQUABATTLE] Bez serveru — změny zůstanou jen v tomhle prohlížeči. Spusť start.bat.');

      // pooly podle přihlášení, loga jsou veřejná — obojí naráz
      return Promise.all([AB.api.loadPreferences(), AB.api.loadLogos()]);
    }).then(function () {
      w.addEventListener('hashchange', render);
      render();
    });
  }

  /* Volitelná ukázková data: index.html?demo=1 */
  if (/[?&]demo=1/.test(w.location.search)) {
    var s = document.createElement('script');
    s.src = 'data/matches.demo.js';
    s.onload = boot;
    s.onerror = function () {
      console.warn('[AQUABATTLE] data/matches.demo.js se nepodařilo načíst, jedu na ostrých datech.');
      boot();
    };
    document.head.appendChild(s);
  } else {
    boot();
  }

})(window);
