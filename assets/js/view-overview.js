/* ==========================================================================
   AQUABATTLE — Přehled (úvodní dashboard)
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;

  AB.views = AB.views || {};

  AB.views.prehled = function () {
    var root = el('div.view');
    var drafted = Object.keys(AB.draftedIds()).length;
    var totalGames = AB.totalGames();
    var champ = AB.champion();

    /* ---------- hlavička ---------- */
    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'League of Legends · sezóna 1'),
      el('h1', {}, 'AQUABATTLE'),
      el('p', {}, '6 týmů, ' + AB.everyone().length + ' hráčů. Skupina každý s každým na jednu hru, pak playoff TOP 4 — semifinále na dvě vítězné, finále na tři.')
    ]));

    if (champ) {
      var ct = AB.team(champ);
      root.appendChild(el('div.champion-box', { style: { marginBottom: '26px', flexDirection: 'row', justifyContent: 'flex-start', gap: '18px', textAlign: 'left' } }, [
        el('span.trophy', {}, '🏆'),
        el('div', {}, [
          el('div.eyebrow', { style: { color: 'var(--gold-2)' } }, 'Vítěz turnaje'),
          el('div.nm', {}, ct ? ct.name : champ),
          el('div.muted', { style: { fontSize: '13px' } }, 'kapitán ' + (ct ? ct.captain : ''))
        ])
      ]));
    }

    /* ---------- rychlé statistiky ---------- */
    var played = w.SCHEDULE.filter(function (m) { return AB.seriesWinner(m); }).length;
    root.appendChild(el('div.grid.g-4', {}, [
      C.stat(drafted + ' / ' + (w.TEAMS.length * 5), 'Obsazené sloty', drafted === w.TEAMS.length * 5 ? 'Draft dokončen' : 'Draft probíhá', 'var(--gold-2)'),
      C.stat(played + ' / ' + w.SCHEDULE.length, 'Zápasy ve skupině', totalGames + ' odehraných her'),
      C.stat(String(w.TEAMS.length), 'Týmy', 'každý s každým'),
      C.stat(String(w.POOL.length + w.CAPTAINS.length), 'Hráči', w.CAPTAINS.length + ' kapitánů')
    ]));

    /* ---------- tabulka ---------- */
    root.appendChild(el('div.section', {}, [
      el('div.section-head', {}, [
        el('h2', {}, 'Tabulka skupiny'),
        el('span.muted', { style: { fontSize: '12px' } }, 'první 4 postupují do playoff')
      ]),
      AB.standingsTable()
    ]));

    /* ---------- nadcházející + poslední ---------- */
    var upcoming = w.SCHEDULE.filter(function (m) { return !AB.isPlayed(m); }).slice(0, 4);
    var recent = w.SCHEDULE.filter(AB.isPlayed).slice(-4).reverse();

    var cols = el('div.grid.g-2.section');
    cols.appendChild(el('div', {}, [
      el('div.section-head', {}, el('h2', {}, 'Nejbližší zápasy')),
      upcoming.length
        ? el('div.grid', { style: { gap: '10px' } }, upcoming.map(function (m) { return C.matchRow(m); }))
        : el('div.card.muted', { style: { textAlign: 'center', padding: '30px' } }, 'Skupina je dohraná.')
    ]));
    cols.appendChild(el('div', {}, [
      el('div.section-head', {}, el('h2', {}, 'Poslední výsledky')),
      recent.length
        ? el('div.grid', { style: { gap: '10px' } }, recent.map(function (m) { return C.matchRow(m); }))
        : el('div.card.muted', { style: { textAlign: 'center', padding: '30px' } }, 'Zatím se nehrálo.')
    ]));
    root.appendChild(cols);

    /* ---------- top výkony ---------- */
    var ps = AB.playerStats();
    if (ps.length) {
      var lb = function (title, arr, fmt) {
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
          }))
        ]);
      };
      root.appendChild(el('div.section', {}, [
        el('div.section-head', {}, [
          el('h2', {}, 'Nejlepší výkony'),
          el('a.muted', { href: '#/staty', style: { fontSize: '12px', marginLeft: 'auto' } }, 'všechny statistiky →')
        ]),
        el('div.grid.g-3', {}, [
          lb('Nejvyšší KDA', ps.slice().sort(function (a, b) { return b.kdaAvg - a.kdaAvg; }), function (r) { return AB.fmt(r.kdaAvg, 2); }),
          lb('Nejvíc zabití', ps.slice().sort(function (a, b) { return b.k - a.k; }), function (r) { return r.k; }),
          lb('Poškození za minutu', ps.slice().sort(function (a, b) { return b.dmgPerMin - a.dmgPerMin; }), function (r) { return AB.fmt(r.dmgPerMin, 0); })
        ])
      ]));
    }

    return root;
  };

  /* ---------------------------------------------------- tabulka skupiny --- */

  AB.standingsTable = function (compact) {
    var rows = AB.standings();
    var anyPlayed = rows.some(function (r) { return r.played > 0; });

    var body = rows.map(function (r) {
      var tr = el('tr' + (r.rank === 4 ? '.qual-line' : ''), {}, [
        el('td', { style: { width: '34px' } }, el('span.mono', { style: { color: r.rank <= 4 ? 'var(--gold-2)' : 'var(--tx-2)', fontWeight: '700' } }, r.rank)),
        el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
          C.crest(r.team, 'crest-sm'),
          el('div', {}, [
            el('div', { style: { fontWeight: '700' } }, r.team.name),
            el('div.muted', { style: { fontSize: '11px' } }, r.team.captain)
          ])
        ])),
        el('td.num', { style: { color: 'var(--win)', fontWeight: '700' } }, r.w),
        el('td.num', { style: { color: 'var(--tx-2)' } }, r.l),
        el('td.num', {}, r.gw + '–' + r.gl),
        el('td.num', { style: { color: r.gd > 0 ? 'var(--win)' : (r.gd < 0 ? 'var(--loss)' : 'var(--tx-2)') } }, (r.gd > 0 ? '+' : '') + r.gd),
        compact ? null : el('td.num', {}, r.kills || '–'),
        compact ? null : el('td', {}, el('span.form-strip', {}, r.form.slice(-5).map(function (f) { return el('i.' + f, {}, f); })))
      ].filter(Boolean));
      return tr;
    });

    var head = ['#', 'Tým', 'V', 'P', 'Hry', '+/-'];
    if (!compact) head = head.concat(['Zabití', 'Forma']);

    var table = el('div.tbl-wrap', {}, el('table.tbl', {}, [
      el('thead', {}, el('tr', {}, head.map(function (h, i) {
        return el('th', i >= 2 && h !== 'Forma' ? { style: { textAlign: 'right' } } : null, h);
      }))),
      el('tbody', {}, body)
    ]));

    if (!anyPlayed) {
      var hint = el('div.muted', { style: { fontSize: '12px', marginTop: '9px', textAlign: 'center' } },
        'Tabulka se naplní automaticky, jakmile zapíšeš první výsledky.');
      return el('div', {}, [table, hint]);
    }
    return table;
  };

})(window);
