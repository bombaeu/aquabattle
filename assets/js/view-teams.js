/* ==========================================================================
   AQUABATTLE — Týmy
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  AB.views.tymy = function () {
    var root = el('div.view');

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Soupisky'),
      el('h1', {}, 'Týmy'),
      el('p', {}, 'Každý tým vede kapitán a doplňují ho 4 draftovaní hráči. Sub sloty jsou volitelné — přidávají se do pole ' +
        '`subs` v data/teams.js.')
    ]));

    if (!AB.draftComplete()) {
      root.appendChild(el('div.notice', {}, [
        el('span', {}, [
          el('b', {}, 'Soupisky nejsou kompletní. '),
          'Prázdné sloty doplníš v adminu.'
        ]),
        el('a.btn.btn-sm.btn-primary', { href: '#/admin', style: { marginLeft: 'auto' } }, 'Otevřít admin')
      ]));
    }

    root.appendChild(el('div.grid.g-2', {}, w.TEAMS.map(teamCard)));

    /* --- srovnání síly týmů --- */
    var maxPts = w.SALARY_CAP;
    root.appendChild(el('div.section', {}, [
      el('div.section-head', {}, [
        el('h2', {}, 'Síla soupisek'),
        el('span.muted', { style: { fontSize: '12px' } }, 'strop je ' + w.SALARY_CAP + ' bodů na tým')
      ]),
      el('div.card', {}, w.TEAMS.slice().sort(function (a, b) { return AB.teamPoints(b) - AB.teamPoints(a); }).map(function (t) {
        var p = AB.teamPoints(t);
        return el('div', { style: { marginBottom: '13px' } }, [
          el('div', { style: { display: 'flex', gap: '9px', alignItems: 'center', marginBottom: '5px', fontSize: '13px' } }, [
            C.crest(t, 'crest-xs'),
            el('span', { style: { fontWeight: '600' } }, t.name),
            el('span.mono', { style: { marginLeft: 'auto', color: t.color, fontWeight: '700' } }, p)
          ]),
          el('div.cmp-bar', {}, el('i', { style: { width: (p / maxPts * 100) + '%', background: t.color } }))
        ]);
      }))
    ]));

    return root;
  };

  function teamCard(t) {
    var card = el('div.team-card', { style: { '--tc': t.color } });

    card.appendChild(el('div.team-head', {}, [
      C.crest(t, 'team-crest'),
      el('div', { style: { minWidth: 0 } }, [
        el('div.team-name', {}, t.name),
        el('div.team-sub', {}, 'kapitán ' + AB.player(t.captain).name)
      ]),
      el('div.team-pts', {}, [
        el('b', { style: { color: AB.remaining(t) < 0 ? 'var(--loss)' : null } }, AB.teamPoints(t)),
        el('span', {}, 'z ' + w.SALARY_CAP)
      ]),
      C.opggTeam(t)
    ]));

    AB.ROLE_KEYS.forEach(function (role) {
      var pid = t.roster[role];
      var p = pid ? AB.player(pid) : null;
      var isCap = pid === t.captain;

      card.appendChild(el('div.roster-row' + (p ? '' : '.is-empty'), {}, [
        el('span.role-chip', {}, AB.roleIcon(role)),
        p ? el('span.roster-name', {}, p.name) : el('span.roster-name.muted', {}, '— volný slot —'),
        el('span.roster-meta', {}, [
          isCap ? el('span.badge.badge-cap', {}, '★ C') : null,
          p ? C.opgg(p.id) : null,
          p ? C.rankBadge(p.rank) : null,
          p ? el('span.mono.muted', { style: { fontSize: '12px', minWidth: '30px', textAlign: 'right' } }, p.points) : null
        ].filter(Boolean))
      ]));
    });

    (t.subs || []).forEach(function (pid) {
      var p = AB.player(pid);
      card.appendChild(el('div.roster-row.is-sub', {}, [
        el('span.role-chip', { style: { color: 'var(--gold-2)' } }, 'SUB'),
        el('span.roster-name', {}, p.name),
        el('span.roster-meta', {}, [
          C.roleBadges(p.roles.slice(0, 2)),
          C.rankBadge(p.rank)
        ])
      ]));
    });

    if (!t.subs || !t.subs.length) {
      card.appendChild(el('div.roster-row.is-sub.is-empty', {}, [
        el('span.role-chip', { style: { color: 'var(--gold-2)' } }, 'SUB'),
        el('span.roster-name.muted', {}, '— zatím bez náhradníka —')
      ]));
    }

    return card;
  }

})(window);
