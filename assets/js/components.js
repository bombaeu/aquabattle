/* ==========================================================================
   AQUABATTLE — znovupoužitelné UI komponenty
   ========================================================================== */
(function (w) {
  'use strict';

  var AB = w.AB, el = AB.el;
  var C = AB.ui = {};

  /* ---------------------------------------------------------------- znaky -- */

  C.crest = function (team, cls) {
    if (!team) return el('span.' + (cls || 'crest-sm'), { style: { '--tc': '#3a4a5a' } }, '?');
    return el('span.' + (cls || 'crest-sm'), { style: { '--tc': team.color }, title: team.name }, team.tag);
  };

  C.rankBadge = function (rank) {
    var r = w.RANKS[rank];
    if (!r) return null;
    return el('span.badge.badge-rank', { style: { color: r.color, borderColor: r.color + '55' } }, r.label);
  };

  C.rankDot = function (rank) {
    var r = w.RANKS[rank] || { color: '#556' };
    return el('span.rank-dot', { style: { background: r.color }, title: (r.label || rank) });
  };

  /** Pozice jako ikonka z klienta. Název je v tooltipu. */
  C.roleBadge = function (role, withLabel) {
    var r = w.ROLES[role];
    return el('span.badge.badge-role', { title: r ? r.label : role }, [
      AB.roleIcon(role),
      withLabel ? el('span', {}, r ? r.label : role) : null
    ].filter(Boolean));
  };

  C.roleBadges = function (roles) {
    return el('span.pool-roles', {}, (roles || []).map(function (r) { return AB.roleIcon(r, 'sm'); }));
  };

  /* ------------------------------------------------------------- prázdno -- */

  /** Prázdný stav. Místo emoji zlatý ornament, ať to ladí se zbytkem. */
  C.empty = function (title, text, action) {
    return el('div.empty', {}, [
      el('div.ico', {}, AB.ornament()),
      el('h3', {}, title),
      el('p', {}, text),
      action || null
    ]);
  };

  /* --------------------------------------------------------------- staty -- */

  C.stat = function (value, label, sub, color) {
    return el('div.card.stat', {}, [
      el('div.v', { style: color ? { color: color } : null }, value),
      el('div.l', {}, label),
      sub ? el('div.s', {}, sub) : null
    ]);
  };

  /* -------------------------------------------------------------- zápasy -- */

  /**
   * Řádek série. Kliknutí otevře detail (jen pokud je odehraná).
   * opts: { showRound, showDate }
   */
  C.matchRow = function (m, opts) {
    opts = opts || {};
    var ta = AB.team(m.a), tb = AB.team(m.b);
    var played = AB.isPlayed(m);
    var sc = AB.seriesScore(m);
    var winner = AB.seriesWinner(m);
    var known = ta && tb;

    var side = function (team, isRight) {
      var lost = winner && team && winner !== team.id;
      return el('div.match-side' + (isRight ? '.right' : '') + (lost ? '.lost' : ''), {}, [
        C.crest(team, 'crest-sm'),
        el('div', {}, [
          el('div.nm', {}, team ? team.name : 'TBD'),
          team ? el('div.muted', { style: { fontSize: '11px' } }, team.captain) : null
        ])
      ]);
    };

    var middle = played
      ? el('div', {}, [
          el('div.match-score', {}, [
            el('span' + (sc[0] < sc[1] ? '.lo' : ''), {}, sc[0]),
            el('span.sep', {}, ':'),
            el('span' + (sc[1] < sc[0] ? '.lo' : ''), {}, sc[1])
          ]),
          el('div.match-meta', {}, winner ? 'BO3 · dohráno' : 'BO3 · rozehráno')
        ])
      : el('div', {}, [
          el('div.match-vs', {}, 'VS'),
          el('div.match-meta', {}, AB.dateLabel(m.date))
        ]);

    var cls = '.match' + (played ? '.is-done' : (known ? '' : '.is-locked'));
    var node = el('div' + cls, {}, [side(ta, false), middle, side(tb, true)]);

    if (played) node.addEventListener('click', function () { C.matchModal(m); });
    return node;
  };

  /* ------------------------------------------------------------- modaly --- */

  C.modal = function (title, body, wide) {
    var bg = el('div.modal-bg', {
      onclick: function (e) { if (e.target === bg) close(); }
    });
    var box = el('div.modal', wide ? { style: { width: 'min(1080px, 100%)' } } : null, [
      el('div.modal-head', {}, [
        typeof title === 'string' ? el('h3', {}, title) : title,
        el('button.modal-x', { onclick: function () { close(); }, 'aria-label': 'Zavřít' }, '✕')
      ]),
      el('div.modal-body', {}, body)
    ]);
    bg.appendChild(box);
    document.body.appendChild(bg);
    document.body.style.overflow = 'hidden';

    function close() {
      bg.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    return { close: close, body: box.querySelector('.modal-body') };
  };

  C.toast = function (msg) {
    var t = el('div.toast', {}, msg);
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 300);
    }, 2200);
  };

  /* ------------------------------------------------- detail série (BO3) --- */

  C.matchModal = function (m) {
    var ta = AB.team(m.a), tb = AB.team(m.b);
    var sc = AB.seriesScore(m);

    var title = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
      C.crest(ta, 'crest-sm'),
      el('h3', {}, (ta ? ta.name : '?') + '  ' + sc[0] + ' : ' + sc[1] + '  ' + (tb ? tb.name : '?')),
      C.crest(tb, 'crest-sm')
    ]);

    var host = el('div');
    var modal = C.modal(title, host, true);

    var games = m.games || [];
    var tabs = el('div.game-tabs');
    var pane = el('div');

    games.forEach(function (g, i) {
      var t = el('div.game-tab' + (i === 0 ? '.active' : ''), {
        onclick: function () {
          AB.$$('.game-tab', tabs).forEach(function (x) { x.classList.remove('active'); });
          t.classList.add('active');
          AB.clear(pane).appendChild(C.gameView(g, m));
        }
      }, 'Hra ' + (i + 1));
      tabs.appendChild(t);
    });

    host.appendChild(tabs);
    host.appendChild(pane);
    if (games.length) pane.appendChild(C.gameView(games[0], m));
    else pane.appendChild(C.empty('Zatím bez dat', 'Tahle série ještě nemá zapsané žádné hry.'));

    return modal;
  };

  /** Detail jedné hry: porovnání týmů + dva scoreboardy. */
  C.gameView = function (g, m) {
    var box = el('div');

    var sum = function (side, f) {
      return ((g[side] || {}).players || []).reduce(function (s, p) { return s + (p[f] || 0); }, 0);
    };

    var bt = AB.team((g.blue || {}).team), rt = AB.team((g.red || {}).team);
    var bc = bt ? bt.color : 'var(--hex-3)';
    var rc = rt ? rt.color : 'var(--loss)';

    /* --- horní přehled --- */
    box.appendChild(el('div.card', { style: { marginBottom: '16px' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '13px' } }, [
        el('span.mono', {}, '⏱ ' + (g.duration || '–')),
        el('span.eyebrow', {}, 'Souhrn hry')
      ]),
      cmpBar('Zabití', sum('blue', 'k'), sum('red', 'k'), bc, rc),
      cmpBar('Zlato', sum('blue', 'gold'), sum('red', 'gold'), bc, rc, AB.k),
      cmpBar('Poškození championům', sum('blue', 'dmg'), sum('red', 'dmg'), bc, rc, AB.k),
      cmpBar('Věže', (g.blue || {}).towers || 0, (g.red || {}).towers || 0, bc, rc),
      cmpBar('Draci', (g.blue || {}).dragons || 0, (g.red || {}).dragons || 0, bc, rc),
      cmpBar('Baroni', (g.blue || {}).barons || 0, (g.red || {}).barons || 0, bc, rc)
    ]));

    box.appendChild(C.scoreboard(g, 'blue'));
    box.appendChild(C.scoreboard(g, 'red'));
    return box;

    function cmpBar(label, a, b, ca, cb, fmt) {
      fmt = fmt || function (x) { return x; };
      var tot = (a + b) || 1;
      return el('div.cmp', {}, [
        el('div.lbl', {}, label),
        el('div.v', { style: { color: ca } }, fmt(a)),
        el('div.cmp-bar', {}, [
          el('i', { style: { width: (a / tot * 100) + '%', background: ca } }),
          el('i', { style: { width: (b / tot * 100) + '%', background: cb } })
        ]),
        el('div.v.r', { style: { color: cb } }, fmt(b))
      ]);
    }
  };

  /** Scoreboard jedné strany (5 hráčů). */
  C.scoreboard = function (g, side) {
    var s = g[side];
    if (!s) return el('div');
    var team = AB.team(s.team);
    var won = g.winner === side;

    var head = el('div.sb-head.' + side, {}, [
      C.crest(team, 'crest-sm'),
      el('span', {}, team ? team.name : side.toUpperCase()),
      el('span.pill', {}, side === 'blue' ? 'Modrá strana' : 'Červená strana'),
      (s.bans && s.bans.length)
        ? el('span.bans', {}, [el('span.muted', { style: { fontSize: '11px' } }, 'Bany:')]
            .concat(s.bans.map(function (c) { return AB.champImg(c, 'champ-ic sm'); })))
        : null,
      el('span.res.' + (won ? 'w' : 'l'), {}, won ? 'VÍTĚZSTVÍ' : 'PORÁŽKA')
    ]);

    var rows = (s.players || []).map(function (p) {
      var kdaV = AB.kda(p.k || 0, p.d || 0, p.a || 0);
      var kdaCls = kdaV >= 4 ? 'kda-good' : (kdaV >= 2.5 ? 'kda-mid' : 'kda-bad');
      return el('tr', {}, [
        el('td', { style: { width: '46px' } }, AB.champImg(p.champ, 'champ-ic')),
        el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          AB.roleIcon(p.role, 'sm'),
          el('span', { style: { fontWeight: '600', color: 'var(--gold-1)' } }, AB.player(p.player).name)
        ])),
        el('td.num', {}, (p.k || 0) + ' / ' + (p.d || 0) + ' / ' + (p.a || 0)),
        el('td.num.' + kdaCls, {}, AB.fmt(kdaV, 2)),
        el('td.num', {}, p.cs || 0),
        el('td.num', {}, AB.k(p.gold || 0)),
        el('td.num', {}, AB.k(p.dmg || 0)),
        el('td.num', {}, p.vision || 0)
      ]);
    });

    return el('div.scoreboard', {}, [
      head,
      el('div.tbl-wrap', { style: { border: 'none', borderRadius: '0' } }, [
        el('table.tbl', {}, [
          el('thead', {}, el('tr', {}, [
            el('th', {}, ''), el('th', {}, 'Hráč'), el('th', { style: { textAlign: 'right' } }, 'K / D / A'),
            el('th', { style: { textAlign: 'right' } }, 'KDA'), el('th', { style: { textAlign: 'right' } }, 'CS'),
            el('th', { style: { textAlign: 'right' } }, 'Zlato'), el('th', { style: { textAlign: 'right' } }, 'Dmg'),
            el('th', { style: { textAlign: 'right' } }, 'Vision')
          ])),
          el('tbody', {}, rows)
        ])
      ])
    ]);
  };

})(window);
