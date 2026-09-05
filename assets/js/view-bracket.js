/* ==========================================================================
   AQUABATTLE — Playoff pavouk (TOP 4)
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  AB.views.pavouk = function () {
    var root = el('div.view');
    var po = AB.resolvedPlayoffs();
    var groupDone = AB.groupComplete();

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Playoff · TOP 4 ze skupiny · semifinále BO3 · finále BO5'),
      el('h1', {}, 'Pavouk'),
      el('p', {}, 'Semifinále se páruje 1. vs 4. a 2. vs 3. podle konečné tabulky skupiny. ' +
        'Poražení hrají o 3. místo na dvě vítězné, vítězové finále na tři.')
    ]));

    if (!groupDone) {
      root.appendChild(el('div.notice', {}, [
        el('span', {}, '⏳'),
        el('span', {}, [
          el('b', {}, 'Skupina ještě běží. '),
          'Účastníci playoff se do pavouka doplní automaticky, jakmile bude dohraná poslední série.'
        ]),
        el('a.btn.btn-sm', { href: '#/zapasy', style: { marginLeft: 'auto' } }, 'Zobrazit rozpis')
      ]));
    }

    var byStage = function (s) { return po.filter(function (p) { return p.stage === s; }); };
    var final = byStage('final')[0];
    var champ = final ? AB.seriesWinner(final) : null;

    /* ---------- pavouk ---------- */
    var bracket = el('div.bracket', {}, [
      el('div.br-round', {}, [el('div.br-round-t', {}, 'Semifinále')].concat(byStage('semi').map(brMatch))),
      el('div.br-round', {}, [el('div.br-round-t', {}, 'Finále')].concat(byStage('final').map(brMatch))),
      el('div.br-round', {}, [
        el('div.br-round-t', {}, 'Vítěz'),
        champ ? el('div.champion-box', {}, [
          el('span.trophy', {}, '🏆'),
          C.crest(AB.team(champ), 'team-crest'),
          el('div.nm', {}, AB.team(champ).name),
          el('div.muted', { style: { fontSize: '12px' } }, 'kapitán ' + AB.team(champ).captain)
        ]) : el('div.champion-box', { style: { opacity: '.4', borderStyle: 'dashed' } }, [
          el('span.trophy', { style: { filter: 'none', opacity: '.5' } }, '🏆'),
          el('div.muted', {}, 'Zatím neznámý')
        ])
      ])
    ]);
    root.appendChild(bracket);

    /* ---------- o 3. místo ---------- */
    var third = byStage('third')[0];
    if (third) {
      root.appendChild(el('div.section', {}, [
        el('div.section-head', {}, el('h2', {}, 'Zápas o 3. místo')),
        el('div', { style: { maxWidth: '540px' } }, brMatch(third))
      ]));
    }

    /* ---------- cesta do playoff ---------- */
    root.appendChild(el('div.section', {}, [
      el('div.section-head', {}, [
        el('h2', {}, 'Aktuální nasazení'),
        el('span.muted', { style: { fontSize: '12px' } }, groupDone ? 'konečná tabulka' : 'průběžné pořadí')
      ]),
      AB.standingsTable(true)
    ]));

    return root;

    /* --------------------------------------------------------- helper --- */

    function brMatch(m) {
      var sc = AB.seriesScore(m);
      var winner = AB.seriesWinner(m);
      var played = AB.isPlayed(m);

      var row = function (tid, score, seedLabel) {
        var t = AB.team(tid);
        var cls = '.br-team';
        if (winner) cls += (winner === tid) ? '.won' : '.lost';
        if (!t) cls += '.tbd';
        return el('div' + cls, { style: { '--tc': t ? t.color : 'transparent' } }, [
          t ? C.crest(t, 'crest-xs') : el('span.crest-xs', { style: { '--tc': '#2a3b4a' } }, '?'),
          el('span', {}, t ? t.name : seedLabel),
          el('span.sc', {}, played ? score : '–')
        ]);
      };

      var node = el('div.br-match' + (m.stage === 'final' ? '.final' : '') + (played ? '.clickable' : ''), {}, [
        el('div', { style: { padding: '7px 13px', fontSize: '10px', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--tx-2)', borderBottom: '1px solid var(--line)' } },
          m.label + (m.date ? ' · ' + AB.dateLabel(m.date) : '')),
        row(m.a, sc[0], m.seedA ? (m.seedA + '. místo skupiny') : 'TBD'),
        row(m.b, sc[1], m.seedB ? (m.seedB + '. místo skupiny') : 'TBD')
      ]);

      if (played) node.addEventListener('click', function () { C.matchModal(m); });
      return node;
    }
  };

})(window);
