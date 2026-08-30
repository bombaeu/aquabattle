/* ==========================================================================
   AQUABATTLE — Hráči (pool + profily)
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  AB.views.hraci = function () {
    var root = el('div.view');
    var all = AB.everyone();

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, w.CAPTAINS.length + ' kapitánů · ' + w.POOL.length + ' hráčů v poolu'),
      el('h1', {}, 'Hráči'),
      el('p', {}, 'Kompletní seznam přihlášených. Body odpovídají ranku a používají se pro vyvážení týmů. ' +
        'Klikni na hráče pro detail.')
    ]));

    /* ---------- rozložení ranků ---------- */
    var byRank = {};
    all.forEach(function (p) { byRank[p.rank] = (byRank[p.rank] || 0) + 1; });
    var rankOrder = Object.keys(w.RANKS).sort(function (a, b) { return w.RANKS[b].order - w.RANKS[a].order; });

    root.appendChild(el('div.card', { style: { marginBottom: '24px' } }, [
      el('div.card-t', {}, 'Rozložení ranků'),
      el('div', { style: { display: 'flex', gap: '3px', height: '32px', borderRadius: '0', overflow: 'hidden' } },
        rankOrder.filter(function (r) { return byRank[r]; }).map(function (r) {
          return el('div', {
            style: {
              flex: byRank[r], background: w.RANKS[r].color, opacity: '.82',
              display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: '700', color: '#06121a'
            },
            title: w.RANKS[r].label + ': ' + byRank[r] + ' hráčů'
          }, byRank[r]);
        })),
      el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '11px', marginTop: '11px', fontSize: '11.5px' } },
        rankOrder.filter(function (r) { return byRank[r]; }).map(function (r) {
          return el('span', { style: { display: 'flex', alignItems: 'center', gap: '5px' } }, [
            C.rankDot(r), el('span.muted', {}, w.RANKS[r].label + ' (' + byRank[r] + ')')
          ]);
        }))
    ]));

    /* ---------- filtry ---------- */
    var filterRole = 'ALL', filterStatus = 'ALL', query = '';
    var listBox = el('div');

    var roleFilters = el('div.pool-filters');
    ['ALL'].concat(AB.ROLE_KEYS).forEach(function (r, i) {
      roleFilters.appendChild(el('button.filter-btn' + (i === 0 ? '.active' : ''), {
        title: r === 'ALL' ? 'Všechny pozice' : w.ROLES[r].label,
        onclick: function (e) {
          AB.$$('.filter-btn', roleFilters).forEach(function (b) { b.classList.remove('active'); });
          e.currentTarget.classList.add('active');
          filterRole = r;
          render();
        }
      }, r === 'ALL' ? 'Všechny pozice' : AB.roleIcon(r)));
    });
    roleFilters.appendChild(el('input.search', {
      type: 'search', placeholder: 'Hledat hráče…',
      oninput: function (e) { query = e.target.value.toLowerCase().trim(); render(); }
    }));

    var statusFilters = el('div.pool-filters');
    [['ALL', 'Všichni'], ['CAP', 'Kapitáni'], ['TEAM', 'V týmu'], ['FREE', 'Nedraftovaní']]
      .forEach(function (pair, i) {
        statusFilters.appendChild(el('button.filter-btn' + (i === 0 ? '.active' : ''), {
          onclick: function (e) {
            AB.$$('.filter-btn', statusFilters).forEach(function (b) { b.classList.remove('active'); });
            e.currentTarget.classList.add('active');
            filterStatus = pair[0];
            render();
          }
        }, pair[1]));
      });

    root.appendChild(roleFilters);
    root.appendChild(statusFilters);
    root.appendChild(listBox);

    function render() {
      AB.clear(listBox);
      var rows = all.filter(function (p) {
        if (filterRole !== 'ALL' && p.roles.indexOf(filterRole) === -1) return false;
        if (query && p.name.toLowerCase().indexOf(query) === -1) return false;
        var t = AB.teamOfPlayer(p.id);
        if (filterStatus === 'CAP' && !AB.isCaptain(p.id)) return false;
        if (filterStatus === 'TEAM' && !t) return false;
        if (filterStatus === 'FREE' && t) return false;
        return true;
      }).sort(function (a, b) { return b.points - a.points || a.name.localeCompare(b.name); });

      if (!rows.length) {
        listBox.appendChild(C.empty('Nikdo nenalezen', 'Zkus jiný filtr nebo jiné jméno.'));
        return;
      }

      listBox.appendChild(el('div.tbl-wrap', {}, el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, 'Hráč'), el('th', {}, 'Rank'),
          el('th', { style: { textAlign: 'right' } }, 'Body'),
          el('th', {}, 'Pozice'), el('th', {}, 'Tým')
        ])),
        el('tbody', {}, rows.map(function (p) {
          var t = AB.teamOfPlayer(p.id);
          return el('tr', { style: { cursor: 'pointer' }, onclick: function () { playerModal(p); } }, [
            el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '9px' } }, [
              C.rankDot(p.rank),
              el('span', { style: { fontWeight: '600' } }, p.name),
              AB.isCaptain(p.id) ? el('span.badge.badge-cap', {}, '★ Kapitán') : null
            ])),
            el('td', {}, C.rankBadge(p.rank)),
            el('td.num', { style: { color: w.RANKS[p.rank].color, fontWeight: '700' } }, p.points),
            el('td', {}, C.roleBadges(p.roles)),
            el('td', {}, t
              ? el('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } }, [C.crest(t, 'crest-xs'), el('span', {}, t.name)])
              : el('span.muted', {}, 'volný'))
          ]);
        }))
      ])));

      listBox.appendChild(el('div.muted', { style: { fontSize: '12px', marginTop: '10px' } }, rows.length + ' hráčů'));
    }

    render();
    return root;
  };

  /* ------------------------------------------------------------ profil --- */

  function playerModal(p) {
    var t = AB.teamOfPlayer(p.id);
    var s = AB.playerStats().filter(function (x) { return x.id === p.id; })[0];

    var body = el('div', {}, [
      el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' } }, [
        C.rankBadge(p.rank),
        el('span.pill', {}, p.points + ' bodů'),
        t ? el('span.pill', { style: { background: t.color + '28', color: t.color } }, t.name) : el('span.pill', {}, 'nedraftovaný'),
        AB.isCaptain(p.id) ? el('span.badge.badge-cap', {}, '★ Kapitán') : null
      ].filter(Boolean)),

      el('div.card-t', {}, 'Hraje pozice'),
      el('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '20px' } },
        p.roles.map(function (r) {
          var isMain = t && t.roster[r] === p.id;
          return el('span.badge.badge-role', {
            style: isMain ? { background: 'rgba(200,155,60,.18)', borderColor: 'var(--gold-3)', color: 'var(--gold-1)' } : null,
            title: (w.ROLES[r] || {}).label + (isMain ? ' — hraje v týmu' : '')
          }, [AB.roleIcon(r), el('span', {}, (w.ROLES[r] || {}).label + (isMain ? ' ✓' : ''))]);
        }))
    ]);

    if (s) {
      body.appendChild(el('div.card-t', {}, 'Statistiky v turnaji'));
      body.appendChild(el('div.grid.g-4', { style: { marginBottom: '18px' } }, [
        C.stat(String(s.games), 'Hry', s.wins + 'V – ' + (s.games - s.wins) + 'P'),
        C.stat(AB.fmt(s.kdaAvg, 2), 'KDA', s.k + '/' + s.d + '/' + s.a),
        C.stat(AB.pct(s.winrate), 'Winrate'),
        C.stat(AB.fmt(s.dmgPerMin, 0), 'Dmg/min')
      ]));

      if (s.topChamps.length) {
        body.appendChild(el('div.card-t', {}, 'Odehraní championi'));
        body.appendChild(el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap' } },
          s.topChamps.map(function (c) {
            return el('div', { style: { textAlign: 'center' } }, [
              AB.champImg(c, 'champ-ic'),
              el('div.muted', { style: { fontSize: '10px', marginTop: '3px' } }, s.champs[c] + '×')
            ]);
          })));
      }
    } else {
      body.appendChild(el('div.muted', { style: { fontSize: '13px' } }, 'Zatím neodehrál žádnou hru.'));
    }

    C.modal(p.name, body);
  }

})(window);
