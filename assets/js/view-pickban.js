/* ==========================================================================
   AQUABATTLE — Pick & Ban
   --------------------------------------------------------------------------
   Turnajový draft championů podle pořadí, jaké se hraje v soutěžním LoL:

     Bany 1:   B1 R1 B2 R2 B3 R3          (6 banů)
     Picky 1:  B1 | R1 R2 | B2 B3 | R3    (6 picků)
     Bany 2:   R4 B4 R5 B5                (4 bany)
     Picky 2:  R4 | B4 B5 | R5            (4 picky)

   Admin vybere sérii a hru, spustí draft a kliká, co kapitáni říkají.
   Na konci se bany a championi zapíšou rovnou do té hry v rozpisu, takže
   ve statistikách pak sedí, kdo co hrál.

   Stav běžícího draftu žije v prohlížeči — je to jedna obrazovka na stream,
   ne synchronizovaná lobby.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  /* Pořadí tahů. side: 'blue'|'red', type: 'ban'|'pick'. */
  var SEQUENCE = [
    { side: 'blue', type: 'ban' }, { side: 'red', type: 'ban' },
    { side: 'blue', type: 'ban' }, { side: 'red', type: 'ban' },
    { side: 'blue', type: 'ban' }, { side: 'red', type: 'ban' },

    { side: 'blue', type: 'pick' },
    { side: 'red', type: 'pick' }, { side: 'red', type: 'pick' },
    { side: 'blue', type: 'pick' }, { side: 'blue', type: 'pick' },
    { side: 'red', type: 'pick' },

    { side: 'red', type: 'ban' }, { side: 'blue', type: 'ban' },
    { side: 'red', type: 'ban' }, { side: 'blue', type: 'ban' },

    { side: 'red', type: 'pick' },
    { side: 'blue', type: 'pick' }, { side: 'blue', type: 'pick' },
    { side: 'red', type: 'pick' }
  ];

  /* ------------------------------------------------------------- stav ---- */

  var PB = AB.pickban = {
    load: function () { return AB.store.get('pickban', null); },
    save: function (s) { AB.store.set('pickban', s); },
    clear: function () { AB.store.del('pickban'); }
  };

  /** Prázdný draft pro danou sérii a číslo hry. */
  function newDraft(matchId, gameNo, blueTeam, redTeam) {
    return {
      matchId: matchId, gameNo: gameNo,
      blue: blueTeam, red: redTeam,
      steps: []                       // [{champ}] v pořadí podle SEQUENCE
    };
  }

  function championsTaken(draft) {
    var out = {};
    draft.steps.forEach(function (s) { out[s.champ] = true; });
    return out;
  }

  function stepsOf(draft, side, type) {
    return SEQUENCE.map(function (s, i) { return { s: s, i: i }; })
      .filter(function (x) { return x.s.side === side && x.s.type === type; })
      .map(function (x) { return draft.steps[x.i] ? draft.steps[x.i].champ : null; });
  }

  /* -------------------------------------------------------------- view --- */

  AB.views.pickban = function () {
    var root = el('div.view');
    var draft = PB.load();

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Draft championů · 10 banů · 10 picků'),
      el('h1', {}, 'Pick & Ban'),
      el('p', {}, 'Standardní turnajové pořadí. Vyber sérii a hru, spusť draft a klikej, co kapitáni volají. ' +
        'Na konci to jde uložit rovnou do zápasu, takže se championi propíšou do statistik.')
    ]));

    if (!draft) {
      root.appendChild(setupPanel());
      return root;
    }

    root.appendChild(draftBoard(draft));
    return root;
  };

  /* ------------------------------------------------------ výběr zápasu --- */

  function setupPanel() {
    var box = el('div');
    var all = AB.allMatches().filter(function (m) { return AB.team(m.a) && AB.team(m.b); });

    if (!all.length) {
      return C.empty('Není co draftovat',
        'Zatím není známý ani jeden pár soupeřů. Doplň soupisky a rozpis v adminu.',
        el('a.btn.btn-primary', { href: '#/admin' }, 'Otevřít admin'));
    }

    box.appendChild(el('div.section-head', { style: { marginTop: 0 } }, [
      el('h2', {}, 'Vyber zápas')
    ]));

    box.appendChild(el('div.grid', { style: { gap: '10px' } }, all.map(function (m) {
      var ta = AB.team(m.a), tb = AB.team(m.b);
      var gameNo = (m.games || []).length + 1;

      return el('div.match', {
        onclick: function () { start(m, gameNo, m.a, m.b); }
      }, [
        el('div.match-side', {}, [C.crest(ta, 'crest-sm'), el('div.nm', {}, ta.name)]),
        el('div', {}, [
          el('div.match-vs', {}, 'HRA ' + gameNo),
          el('div.match-meta', {}, m.label || (m.round + '. kolo'))
        ]),
        el('div.match-side.right', {}, [C.crest(tb, 'crest-sm'), el('div.nm', {}, tb.name)])
      ]);
    })));

    box.appendChild(el('p.muted', { style: { fontSize: '12.5px', marginTop: '18px' } },
      'Strany se dají prohodit hned po spuštění — první tým jde defaultně na modrou.'));

    return box;

    function start(m, gameNo, blueId, redId) {
      PB.save(newDraft(m.id, gameNo, blueId, redId));
      AB.reload();
    }
  }

  /* ------------------------------------------------------ deska draftu --- */

  function draftBoard(draft) {
    var box = el('div');
    var idx = draft.steps.length;
    var done = idx >= SEQUENCE.length;
    var current = done ? null : SEQUENCE[idx];
    var taken = championsTaken(draft);

    var blueTeam = AB.team(draft.blue), redTeam = AB.team(draft.red);
    var matchObj = AB.allMatches().filter(function (m) { return m.id === draft.matchId; })[0];

    /* ---- lišta ---- */
    box.appendChild(el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap', marginBottom: '20px' } }, [
      el('button.btn.btn-sm', {
        disabled: !idx,
        onclick: function () { draft.steps.pop(); PB.save(draft); AB.reload(); }
      }, '↶ Zpět'),
      el('button.btn.btn-sm', {
        disabled: !!idx,
        title: idx ? 'Strany už nejdou prohodit, draft běží' : 'Prohodit modrou a červenou',
        onclick: function () {
          var t = draft.blue; draft.blue = draft.red; draft.red = t;
          PB.save(draft); AB.reload();
        }
      }, '⇄ Prohodit strany'),
      done && matchObj ? el('button.btn.btn-sm.btn-primary', {
        onclick: function () { saveToMatch(draft, matchObj); }
      }, '↓ Uložit do zápasu') : null,
      el('button.btn.btn-sm.btn-danger.btn-ghost', {
        style: { marginLeft: 'auto' },
        onclick: function () {
          if (!confirm('Zahodit rozdělaný draft?')) return;
          PB.clear(); AB.reload();
        }
      }, '✕ Zrušit draft')
    ].filter(Boolean)));

    /* ---- stav ---- */
    if (done) {
      box.appendChild(el('div.notice', {}, [
        el('span', {}, [el('b', {}, 'Draft hotový. '),
          matchObj
            ? 'Klikni na „Uložit do zápasu“ a bany i championi se zapíšou do hry ' + draft.gameNo + '.'
            : 'Zápas se nepodařilo najít, ukládat není kam.'])
      ]));
    } else {
      var side = current.side === 'blue' ? blueTeam : redTeam;
      box.appendChild(el('div.onclock', { style: { '--tc': side.color } }, [
        el('span.team-crest', { style: { background: side.color } }, side.tag),
        el('div', {}, [
          el('div.who', {}, side.name + (current.type === 'ban' ? ' banuje' : ' pická')),
          el('div.rnd', {}, 'Tah ' + (idx + 1) + ' z ' + SEQUENCE.length +
            ' · ' + (current.type === 'ban' ? 'ban' : 'pick'))
        ]),
        el('div', { style: { marginLeft: 'auto', textAlign: 'right' } }, [
          el('div.muted', { style: { fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase' } }, 'hra'),
          el('div', { style: { fontFamily: 'var(--font-head)', fontSize: '24px', color: 'var(--gold-1)' } }, draft.gameNo)
        ])
      ]));
    }

    /* ---- dvě strany + grid ---- */
    var layout = el('div.pb-layout');
    layout.appendChild(sideColumn(draft, 'blue', blueTeam, current));
    layout.appendChild(championGrid(draft, taken, current, done));
    layout.appendChild(sideColumn(draft, 'red', redTeam, current));
    box.appendChild(layout);

    return box;
  }

  /* ---- sloupec jedné strany: picky nahoře, bany dole ---- */
  function sideColumn(draft, side, team, current) {
    var picks = stepsOf(draft, side, 'pick');
    var bans = stepsOf(draft, side, 'ban');
    var active = current && current.side === side;

    var col = el('div.pb-side' + (active ? '.active' : ''), { style: { '--tc': team.color } });

    col.appendChild(el('div.pb-side-head', {}, [
      C.crest(team, 'crest-sm'),
      el('div', {}, [
        el('div', { style: { fontFamily: 'var(--font-head)', fontSize: '15px', color: 'var(--gold-1)', textTransform: 'uppercase' } }, team.name),
        el('div.muted', { style: { fontSize: '10px', letterSpacing: '.15em', textTransform: 'uppercase' } },
          side === 'blue' ? 'modrá strana' : 'červená strana')
      ])
    ]));

    var roster = AB.ROLE_KEYS.map(function (r) { return team.roster[r]; });

    picks.forEach(function (champ, i) {
      var pid = roster[i];
      col.appendChild(el('div.pb-pick' + (champ ? '.filled' : ''), {}, [
        champ ? AB.champImg(champ, 'pb-portrait') : el('div.pb-portrait.empty', {}),
        el('div', { style: { minWidth: 0 } }, [
          el('div.pb-champ', {}, champ ? champName(champ) : '—'),
          el('div.pb-player', {}, pid ? AB.player(pid).name : 'volný slot')
        ])
      ]));
    });

    col.appendChild(el('div.pb-bans', {}, bans.map(function (champ) {
      return champ
        ? el('span.pb-ban', {}, AB.champImg(champ, 'champ-ic sm'))
        : el('span.pb-ban.empty', {});
    })));

    return col;
  }

  /* ---- prostřední mřížka se všemi championy ----------------------------
     Mřížka se staví jen jednou a mezi tahy se recykluje. Přegenerovat 173
     <img> po každém picku by znamenalo tolikrát sáhnout do cache prohlížeče
     — na streamu zbytečné cukání. Při dalším tahu se tak jen přepínají
     třídy a překreslí se zbytek desky.                                    */

  var gridCache = null;   // { wrap, btns: {champId: button}, count, search, onPick }

  function championGrid(draft, taken, current, done) {
    if (!gridCache) buildGrid();

    // aktuální akce se předává přes ref, ať tlačítka nedrží starý stav draftu
    gridCache.onPick = function (champId) {
      if (done) return;
      draft.steps.push({ champ: champId });
      PB.save(draft);
      C.toast((current.type === 'ban' ? 'Ban: ' : 'Pick: ') + champName(champId));
      AB.reload();
    };

    Object.keys(gridCache.btns).forEach(function (id) {
      var btn = gridCache.btns[id];
      var isTaken = !!taken[id];
      btn.classList.toggle('taken', isTaken);
      btn.disabled = isTaken || done;
      btn.title = isTaken ? champName(id) + ' — už je z výběru pryč' : champName(id);
    });

    setTimeout(function () { gridCache.search.focus(); }, 30);
    return gridCache.wrap;
  }

  function buildGrid() {
    var wrap = el('div.pb-grid-wrap');
    var grid = el('div.pb-grid');
    var count = el('span.muted', { style: { fontSize: '12px', marginLeft: 'auto' } });
    var btns = {};

    var search = el('input.search', {
      type: 'search',
      placeholder: 'Hledat championa…',
      oninput: function (e) { filter(e.target.value.toLowerCase().trim()); }
    });

    (w.CHAMPIONS || []).forEach(function (c) {
      var btn = el('button.pb-champ-btn', {
        title: c.name,
        onclick: function () { if (gridCache.onPick) gridCache.onPick(c.id); }
      }, [
        AB.champImg(c.id, 'pb-champ-img'),
        el('span.pb-champ-name', {}, c.name)
      ]);
      btns[c.id] = btn;
      grid.appendChild(btn);
    });

    /** Filtrování jen schovává, nemaže — obrázky tak zůstávají načtené. */
    function filter(q) {
      var shown = 0;
      (w.CHAMPIONS || []).forEach(function (c) {
        var hit = !q || c.name.toLowerCase().indexOf(q) !== -1;
        btns[c.id].style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      count.textContent = shown + ' z ' + (w.CHAMPIONS || []).length;
    }

    wrap.appendChild(el('div.pool-filters', { style: { marginBottom: '12px' } }, [search, count]));
    wrap.appendChild(grid);
    filter('');

    gridCache = { wrap: wrap, btns: btns, count: count, search: search, onPick: null };
  }

  /* ------------------------------------------------------------ zápis ---- */

  /** Zapíše bany a picky do příslušné hry v rozpisu. */
  function saveToMatch(draft, m) {
    var gi = draft.gameNo - 1;
    m.games = m.games || [];

    // hra ještě neexistuje -> založ ji s předvyplněnými sestavami
    if (!m.games[gi]) {
      var mk = function (tid) {
        var t = AB.team(tid);
        return {
          team: tid, bans: [], towers: 0, inhibs: 0, dragons: 0, barons: 0, heralds: 0,
          players: AB.ROLE_KEYS.map(function (r) {
            return {
              role: r, player: t.roster[r] || null, champ: '',
              k: 0, d: 0, a: 0, cs: 0, gold: 0, dmg: 0, taken: 0, vision: 0
            };
          })
        };
      };
      m.games[gi] = { duration: '', winner: 'blue', blue: mk(draft.blue), red: mk(draft.red) };
      m.status = 'done';
    }

    var g = m.games[gi];

    ['blue', 'red'].forEach(function (side) {
      var tid = draft[side];
      // strana v draftu nemusí odpovídat straně v už existující hře
      var target = (g.blue && g.blue.team === tid) ? g.blue : (g.red && g.red.team === tid ? g.red : null);
      if (!target) return;

      target.bans = stepsOf(draft, side, 'ban').filter(Boolean);
      var picks = stepsOf(draft, side, 'pick');
      (target.players || []).forEach(function (p, i) {
        if (picks[i]) p.champ = picks[i];
      });
    });

    var finish = function () {
      C.toast('Zapsáno do hry ' + draft.gameNo);
      PB.clear();
      w.location.hash = '#/zapasy';
    };

    if (AB.api && AB.api.canWrite()) {
      AB.api.saveMatches().then(finish).catch(function (e) { C.toast('Nezapsáno: ' + e.message); });
    } else {
      AB.store.set('matches', { schedule: w.SCHEDULE, playoffs: w.PLAYOFFS });
      finish();
    }
  }

  /* ----------------------------------------------------------- pomocné --- */

  var nameMap = null;
  function champName(id) {
    if (!nameMap) {
      nameMap = {};
      (w.CHAMPIONS || []).forEach(function (c) { nameMap[c.id] = c.name; });
    }
    return nameMap[id] || id;
  }

})(window);
