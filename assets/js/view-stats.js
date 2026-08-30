/* ==========================================================================
   AQUABATTLE — Statistiky (hráči + championi)
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  /* Sloupce tabulky hráčů: [nadpis, klíč, formátovač, výchozí směr] */
  var COLS = [
    ['Hry',      'games',     function (r) { return r.games; }],
    ['V–P',      'wins',      function (r) { return r.wins + '–' + (r.games - r.wins); }],
    ['WR',       'winrate',   function (r) { return AB.pct(r.winrate); }],
    ['K',        'k',         function (r) { return r.k; }],
    ['D',        'd',         function (r) { return r.d; }],
    ['A',        'a',         function (r) { return r.a; }],
    ['KDA',      'kdaAvg',    function (r) { return AB.fmt(r.kdaAvg, 2); }],
    ['CS/min',   'csPerMin',  function (r) { return AB.fmt(r.csPerMin, 1); }],
    ['Dmg/min',  'dmgPerMin', function (r) { return AB.fmt(r.dmgPerMin, 0); }],
    ['Zlato',    'gold',      function (r) { return AB.k(r.gold); }],
    ['Vision',   'vision',    function (r) { return r.vision; }]
  ];

  AB.views.staty = function () {
    var root = el('div.view');
    var stats = AB.playerStats();

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Napříč všemi odehranými hrami'),
      el('h1', {}, 'Statistiky'),
      el('p', {}, 'Všechno se počítá automaticky z dat zapsaných u jednotlivých her. Klikni na hlavičku sloupce a seřadíš podle něj.')
    ]));

    if (!stats.length) {
      root.appendChild(C.empty('Zatím žádná data',
        'Statistiky se objeví, jakmile bude zapsaná první odehraná hra. Pošli screenshot z konce zápasu a doplní se čísla za všechny hráče.',
        el('a.btn.btn-primary', { href: '#/zapasy' }, 'Zobrazit rozpis')));
      return root;
    }

    /* ---------- souhrn ---------- */
    var perf = AB.allPerformances();
    var totalKills = perf.reduce(function (s, p) { return s + (p.k || 0); }, 0);
    var totalSecs = AB.allMatches().reduce(function (s, m) {
      return s + (m.games || []).reduce(function (x, g) { return x + AB.toSeconds(g.duration); }, 0);
    }, 0);
    var games = AB.totalGames();

    root.appendChild(el('div.grid.g-4', {}, [
      C.stat(String(games), 'Odehrané hry'),
      C.stat(String(totalKills), 'Zabití celkem', games ? AB.fmt(totalKills / games, 1) + ' na hru' : ''),
      C.stat(games ? AB.mmss(totalSecs / games) : '–', 'Průměrná délka hry'),
      C.stat(String(AB.championStats().filter(function (c) { return c.picks; }).length), 'Různých championů')
    ]));

    /* ---------- žebříčky ---------- */
    var lb = function (title, sortKey, fmt, note) {
      var arr = stats.slice().sort(function (a, b) { return b[sortKey] - a[sortKey]; });
      return el('div.card', {}, [
        el('div.card-t', {}, title),
        el('div', {}, arr.slice(0, 5).map(function (r, i) {
          var t = AB.teamOfPlayer(r.id);
          return el('div.lb-row', {}, [
            el('span.lb-pos', {}, '#' + (i + 1)),
            t ? C.crest(t, 'crest-xs') : null,
            el('span.lb-nm', {}, AB.player(r.id).name),
            el('span.lb-v', {}, fmt(r))
          ]);
        })),
        note ? el('div.muted', { style: { fontSize: '11px', marginTop: '8px' } }, note) : null
      ]);
    };

    root.appendChild(el('div.section', {}, [
      el('div.section-head', {}, el('h2', {}, 'Žebříčky')),
      el('div.grid.g-3', {}, [
        lb('Nejvyšší KDA', 'kdaAvg', function (r) { return AB.fmt(r.kdaAvg, 2); }),
        lb('Nejvíc zabití', 'k', function (r) { return r.k; }),
        lb('Nejvíc asistencí', 'a', function (r) { return r.a; }),
        lb('Poškození za minutu', 'dmgPerMin', function (r) { return AB.fmt(r.dmgPerMin, 0); }),
        lb('CS za minutu', 'csPerMin', function (r) { return AB.fmt(r.csPerMin, 1); }),
        lb('Vision score', 'vision', function (r) { return r.vision; })
      ])
    ]));

    /* ---------- velká tabulka hráčů ---------- */
    var sortKey = 'games', sortDir = -1;
    var tblBox = el('div');

    function renderTable() {
      AB.clear(tblBox);
      var rows = stats.slice().sort(function (a, b) {
        var d = (b[sortKey] - a[sortKey]) * (sortDir === -1 ? 1 : -1);
        return d || a.id.localeCompare(b.id);
      });

      tblBox.appendChild(el('div.tbl-wrap', {}, el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'Hráč'), el('th', {}, 'Tým'), el('th', {}, 'Championi')]
          .concat(COLS.map(function (c) {
            var active = sortKey === c[1];
            return el('th', {
              style: { textAlign: 'right', cursor: 'pointer', color: active ? 'var(--gold-2)' : null },
              onclick: function () {
                if (sortKey === c[1]) sortDir = -sortDir; else { sortKey = c[1]; sortDir = -1; }
                renderTable();
              }
            }, c[0] + (active ? (sortDir === -1 ? ' ↓' : ' ↑') : ''));
          })))),
        el('tbody', {}, rows.map(function (r) {
          var t = AB.teamOfPlayer(r.id);
          var p = AB.player(r.id);
          return el('tr', {}, [
            el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
              C.rankDot(p.rank),
              el('span', { style: { fontWeight: '600' } }, p.name),
              AB.isCaptain(r.id) ? el('span.badge.badge-cap', {}, '★') : null
            ])),
            el('td', {}, t ? el('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } }, [
              C.crest(t, 'crest-xs'), el('span', { style: { fontSize: '12.5px' } }, t.name)
            ]) : el('span.muted', {}, '–')),
            el('td', {}, el('div', { style: { display: 'flex', gap: '4px' } },
              r.topChamps.slice(0, 4).map(function (c) { return AB.champImg(c, 'champ-ic sm'); }))),
          ].concat(COLS.map(function (c) { return el('td.num', {}, c[2](r)); })));
        }))
      ])));
    }

    root.appendChild(el('div.section', {}, [
      el('div.section-head', {}, [
        el('h2', {}, 'Všichni hráči'),
        el('span.muted', { style: { fontSize: '12px', marginLeft: 'auto' } }, stats.length + ' hráčů s odehranou hrou')
      ]),
      tblBox
    ]));
    renderTable();

    /* ---------- championi ---------- */
    var champs = AB.championStats();
    if (champs.length) {
      root.appendChild(el('div.section', {}, [
        el('div.section-head', {}, [
          el('h2', {}, 'Championi'),
          el('span.muted', { style: { fontSize: '12px' } }, 'presence = picky + bany')
        ]),
        el('div.tbl-wrap', {}, el('table.tbl', {}, [
          el('thead', {}, el('tr', {}, [
            el('th', {}, ''), el('th', {}, 'Champion'),
            el('th', { style: { textAlign: 'right' } }, 'Picky'),
            el('th', { style: { textAlign: 'right' } }, 'Bany'),
            el('th', { style: { textAlign: 'right' } }, 'Presence'),
            el('th', { style: { textAlign: 'right' } }, 'WR'),
            el('th', { style: { textAlign: 'right' } }, 'KDA'),
            el('th', {}, 'Hráli')
          ])),
          el('tbody', {}, champs.map(function (c) {
            return el('tr', {}, [
              el('td', { style: { width: '44px' } }, AB.champImg(c.champ, 'champ-ic')),
              el('td', { style: { fontWeight: '600' } }, c.champ),
              el('td.num', {}, c.picks),
              el('td.num', { style: { color: c.bans ? 'var(--loss)' : 'var(--tx-2)' } }, c.bans || '–'),
              el('td.num', {}, c.presence),
              el('td.num', {}, c.picks ? AB.pct(c.winrate) : '–'),
              el('td.num', {}, c.picks ? AB.fmt(c.kdaAvg, 2) : '–'),
              el('td.muted', { style: { fontSize: '12px' } },
                Object.keys(c.players).map(function (p) { return AB.player(p).name; }).join(', ') || '–')
            ]);
          }))
        ]))
      ]));
    }

    return root;
  };

})(window);
