/* ==========================================================================
   AQUABATTLE — Rozpis a výsledky skupiny
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  AB.views.zapasy = function () {
    var root = el('div.view');
    var played = w.SCHEDULE.filter(AB.isPlayed).length;

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Skupina · každý s každým · BO3'),
      el('h1', {}, 'Rozpis a výsledky'),
      el('p', {}, '15 sérií v 5 kolech. Klikni na dohraný zápas a rozbalí se ti detail každé hry — scoreboard, ' +
        'championi, KDA, zlato, poškození i objectivy.')
    ]));

    root.appendChild(el('div.grid.g-4', { style: { marginBottom: '10px' } }, [
      C.stat(played + ' / ' + w.SCHEDULE.length, 'Odehrané série'),
      C.stat(String(AB.totalGames()), 'Odehrané hry'),
      C.stat(String(w.SCHEDULE.length - played), 'Zbývá odehrát'),
      C.stat('5', 'Kol ve skupině')
    ]));

    /* filtr týmu */
    var filterTeam = 'ALL';
    var listBox = el('div');

    var filters = el('div.pool-filters', { style: { marginTop: '26px' } }, [
      el('button.filter-btn.active', {
        onclick: function (e) { setFilter(e, 'ALL'); }
      }, 'Všechny')
    ].concat(w.TEAMS.map(function (t) {
      return el('button.filter-btn', {
        onclick: function (e) { setFilter(e, t.id); }
      }, t.name);
    })));

    function setFilter(e, id) {
      AB.$$('.filter-btn', filters).forEach(function (b) { b.classList.remove('active'); });
      e.currentTarget.classList.add('active');
      filterTeam = id;
      render();
    }

    root.appendChild(filters);
    root.appendChild(listBox);

    function render() {
      AB.clear(listBox);
      var rounds = {};
      w.SCHEDULE.forEach(function (m) {
        if (filterTeam !== 'ALL' && m.a !== filterTeam && m.b !== filterTeam) return;
        (rounds[m.round] = rounds[m.round] || []).push(m);
      });

      var keys = Object.keys(rounds).sort(function (a, b) { return a - b; });
      if (!keys.length) {
        listBox.appendChild(C.empty('Nic tu není', 'Pro tenhle filtr nejsou žádné zápasy.'));
        return;
      }

      keys.forEach(function (r) {
        var ms = rounds[r];
        var doneCount = ms.filter(AB.isPlayed).length;
        listBox.appendChild(el('div.section', {}, [
          el('div.section-head', {}, [
            el('h2', {}, r + '. kolo'),
            el('span.muted', { style: { fontSize: '12px', marginLeft: 'auto' } }, doneCount + '/' + ms.length + ' dohráno')
          ]),
          el('div.grid', { style: { gap: '11px' } }, ms.map(function (m) { return C.matchRow(m); }))
        ]));
      });
    }

    render();
    return root;
  };

})(window);
