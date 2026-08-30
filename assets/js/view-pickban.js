/* ==========================================================================
   AQUABATTLE — Pick & Ban (živý, online)
   --------------------------------------------------------------------------
   Draft běží na serveru, takže ho dva kapitáni hrají proti sobě z vlastních
   počítačů a kdokoliv další ho může sledovat.

   Role:
     admin     spustí draft, může vrátit tah, zaskočit za kapitána a zapsat
               výsledek do zápasu
     kapitán   klikat smí jen když je jeho tým na tahu
     divák     jen kouká (nepřihlášený i přihlášený)

   Pořadí tahů je stejné jako v soutěžním LoL a validuje ho server, takže
   kapitán nemůže kliknout mimo pořadí ani vzít už vybraného championa.

   Stav se stahuje pollingem — na 30s tahy to bohatě stačí a nepere se to
   s proxy jako dlouho držené spojení.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  var SEQUENCE = [
    ['blue', 'ban'], ['red', 'ban'], ['blue', 'ban'], ['red', 'ban'], ['blue', 'ban'], ['red', 'ban'],
    ['blue', 'pick'], ['red', 'pick'], ['red', 'pick'], ['blue', 'pick'], ['blue', 'pick'], ['red', 'pick'],
    ['red', 'ban'], ['blue', 'ban'], ['red', 'ban'], ['blue', 'ban'],
    ['red', 'pick'], ['blue', 'pick'], ['blue', 'pick'], ['red', 'pick']
  ].map(function (x) { return { side: x[0], type: x[1] }; });

  var POLL_MS = 1200;

  /* stav načtený ze serveru */
  var state = { draft: null, me: null, loaded: false, error: null };
  var pollTimer = null, tickTimer = null, lastRev = -1;

  /* --------------------------------------------------------- polling ---- */

  function startPolling() {
    stopPolling();
    // Hned se ptáme jen při prvním vstupu. Jinak by každé překreslení (které
    // samo vzniklo z pollingu) vyvolalo další dotaz navíc.
    if (!state.loaded) poll();
    pollTimer = setInterval(poll, POLL_MS);
    // odpočet tiká vlastním tempem, ať nečeká na server
    tickTimer = setInterval(paintClock, 250);
  }

  function stopPolling() {
    clearInterval(pollTimer); clearInterval(tickTimer);
    pollTimer = tickTimer = null;
  }

  function poll() {
    if (!AB.api || !AB.api.online) return;
    AB.api.getDraft().then(function (j) {
      state.me = j.me;
      state.loaded = true;
      state.error = null;
      var rev = j.draft ? j.draft.rev : -1;
      var changed = rev !== lastRev || (!j.draft) !== (!state.draft);
      state.draft = j.draft;
      lastRev = rev;
      if (changed && isOnPage()) AB.reload();          // překresli jen při změně
    }).catch(function (e) {
      state.error = e.message;
    });
  }

  function isOnPage() { return (w.location.hash || '').indexOf('pickban') !== -1; }

  /* ------------------------------------------------------------ view --- */

  AB.views.pickban = function () {
    var root = el('div.view');
    var api = AB.api || {};

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Draft championů · 10 banů · 10 picků · živě'),
      el('h1', {}, 'Pick & Ban'),
      el('p', {}, 'Kapitáni draftí proti sobě ze svých počítačů, ostatní se můžou dívat. ' +
        'Pořadí tahů hlídá server.')
    ]));

    if (!api.online) {
      root.appendChild(C.empty('Server neběží',
        'Živý draft potřebuje běžící server. Spusť start.bat a načti stránku znovu.'));
      return root;
    }

    startPolling();

    if (!state.loaded) {
      root.appendChild(el('div.card', { style: { textAlign: 'center', padding: '40px' } },
        el('span.muted', {}, 'Načítám stav draftu…')));
      return root;
    }

    root.appendChild(whoBar());

    if (!state.draft) {
      root.appendChild(isAdmin() ? setupPanel() : waitingPanel());
      return root;
    }

    root.appendChild(board());
    return root;
  };

  function isAdmin() { return state.me && state.me.role === 'admin'; }
  function myCaptainId() { return state.me && state.me.role === 'captain' ? state.me.id : null; }

  /* ---- pruh "jsi přihlášený jako…" ---- */
  function whoBar() {
    var me = state.me;
    var label, tone;

    if (!me) { label = 'Sleduješ jako divák'; tone = 'var(--tx-2)'; }
    else if (me.role === 'admin') { label = 'Přihlášen jako pořadatel'; tone = 'var(--gold-2)'; }
    else { label = 'Přihlášen jako kapitán ' + AB.player(me.id).name; tone = 'var(--hex-2)'; }

    var bar = el('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '10px 15px', marginBottom: '18px',
        border: '1px solid var(--line)', background: 'rgba(0,0,0,.3)'
      }
    }, [
      el('span', { style: { fontSize: '12px', fontWeight: '600', letterSpacing: '.1em', textTransform: 'uppercase', color: tone } }, label),
      state.error ? el('span', { style: { fontSize: '11.5px', color: 'var(--loss)' } }, 'spojení: ' + state.error) : null,
      me
        ? el('button.btn.btn-sm.btn-ghost', {
            style: { marginLeft: 'auto' },
            onclick: function () { AB.api.logout(); lastRev = -1; poll(); AB.reload(); }
          }, 'Odhlásit')
        : el('button.btn.btn-sm', { style: { marginLeft: 'auto' }, onclick: openLogin }, 'Přihlásit se jako kapitán')
    ].filter(Boolean));

    return bar;
  }

  /* ---- přihlášení kapitána ---- */
  function openLogin() {
    var err = el('div', { style: { color: 'var(--loss)', fontSize: '12.5px', minHeight: '18px', marginTop: '8px' } });

    var select = el('select.search', { style: { width: '100%', flex: 'none' } },
      [el('option', { value: '' }, '— vyber sebe —')].concat(
        w.CAPTAINS.map(function (c) { return el('option', { value: c.id }, c.name); })
      ));

    var pw = el('input.search', {
      type: 'password', placeholder: 'Heslo od pořadatele',
      style: { width: '100%', flex: 'none', marginTop: '10px' },
      onkeydown: function (e) { if (e.key === 'Enter') submit(); }
    });

    var btn = el('button.btn.btn-primary', { style: { marginTop: '14px' }, onclick: submit }, 'Přihlásit');

    function submit() {
      if (!select.value) { err.textContent = 'Vyber, kdo jsi.'; return; }
      btn.disabled = true; err.textContent = '';
      AB.api.login(select.value, pw.value)
        .then(function () { m.close(); lastRev = -1; poll(); C.toast('Přihlášen'); AB.reload(); })
        .catch(function (e) { err.textContent = e.message; btn.disabled = false; pw.select(); });
    }

    var m = C.modal('Přihlášení kapitána', el('div', {}, [
      el('p.muted', { style: { marginTop: 0, fontSize: '13px', lineHeight: '1.6' } },
        'Přihlaš se, ať můžeš draftit za svůj tým. Údaje ti dá pořadatel. ' +
        'Bez přihlášení se můžeš dívat, ale ne klikat.'),
      select, pw, err, btn
    ]));
  }

  /* ---- divák, když nic neběží ---- */
  function waitingPanel() {
    return C.empty('Zatím se nedraftí',
      'Jakmile pořadatel spustí draft, objeví se tady sám od sebe — stránku obnovovat nemusíš.');
  }

  /* ------------------------------------------------- spuštění (admin) --- */

  function setupPanel() {
    var box = el('div');
    var all = AB.allMatches().filter(function (m) { return AB.team(m.a) && AB.team(m.b); });

    if (!all.length) {
      return C.empty('Není co draftovat',
        'Zatím není známý ani jeden pár soupeřů. Doplň soupisky a rozpis v adminu.',
        el('a.btn.btn-primary', { href: '#/admin' }, 'Otevřít admin'));
    }

    box.appendChild(el('div.section-head', { style: { marginTop: 0 } }, [el('h2', {}, 'Spustit draft')]));
    box.appendChild(el('p.muted', { style: { fontSize: '13px', marginTop: 0 } },
      'Vyber zápas. Kapitáni obou týmů se pak přihlásí a draftí sami; ty můžeš kdykoliv zaskočit.'));

    box.appendChild(el('div.grid', { style: { gap: '10px' } }, all.map(function (m) {
      var ta = AB.team(m.a), tb = AB.team(m.b);
      var gameNo = (m.games || []).length + 1;

      return el('div.match', {
        onclick: function () {
          var captains = {};
          captains[m.a] = ta.captain;
          captains[m.b] = tb.captain;
          AB.api.draftAction('start', {
            matchId: m.id, gameNo: gameNo, blue: m.a, red: m.b, captains: captains
          }).then(function () {
            lastRev = -1; poll();
            C.toast('Draft spuštěn');
          }).catch(function (e) { C.toast('Nepodařilo se: ' + e.message); });
        }
      }, [
        el('div.match-side', {}, [C.crest(ta, 'crest-sm'), el('div.nm', {}, ta.name)]),
        el('div', {}, [
          el('div.match-vs', {}, 'HRA ' + gameNo),
          el('div.match-meta', {}, m.label || (m.round + '. kolo'))
        ]),
        el('div.match-side.right', {}, [C.crest(tb, 'crest-sm'), el('div.nm', {}, tb.name)])
      ]);
    })));

    return box;
  }

  /* ------------------------------------------------------------ deska --- */

  function board() {
    var d = state.draft;
    var box = el('div');
    var idx = d.steps.length;
    var done = idx >= SEQUENCE.length;
    var current = done ? null : SEQUENCE[idx];
    var taken = {};
    d.steps.forEach(function (s) { taken[s.champ] = true; });

    var blueTeam = AB.team(d.blue), redTeam = AB.team(d.red);
    if (!blueTeam || !redTeam) {
      return C.empty('Neznámé týmy', 'Draft odkazuje na tým, který v datech není.');
    }
    var matchObj = AB.allMatches().filter(function (m) { return m.id === d.matchId; })[0];
    var onTurn = current && myTurn(current);

    /* ---- ovládání pro admina ---- */
    if (isAdmin()) {
      box.appendChild(el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap', marginBottom: '18px' } }, [
        el('button.btn.btn-sm', {
          disabled: !idx,
          onclick: function () { act('undo'); }
        }, '↶ Zpět'),
        el('button.btn.btn-sm', {
          disabled: !!idx,
          title: idx ? 'Draft už běží' : 'Prohodit modrou a červenou',
          onclick: function () { act('swap'); }
        }, '⇄ Prohodit strany'),
        done && matchObj ? el('button.btn.btn-sm.btn-primary', {
          onclick: function () { saveToMatch(d, matchObj); }
        }, '↓ Uložit do zápasu') : null,
        el('button.btn.btn-sm.btn-danger.btn-ghost', {
          style: { marginLeft: 'auto' },
          onclick: function () {
            if (!confirm('Zrušit běžící draft? Uvidí to i kapitáni.')) return;
            act('cancel');
          }
        }, '✕ Zrušit draft')
      ].filter(Boolean)));
    }

    /* ---- stav / kdo je na tahu ---- */
    if (done) {
      box.appendChild(el('div.notice', {}, el('span', {}, [
        el('b', {}, 'Draft dokončen. '),
        isAdmin()
          ? (matchObj ? 'Klikni na „Uložit do zápasu“ a bany i championi se zapíšou do hry ' + d.gameNo + '.'
                      : 'Zápas se nepodařilo najít, ukládat není kam.')
          : 'Čeká se na pořadatele, až výsledek zapíše.'
      ])));
    } else {
      var side = current.side === 'blue' ? blueTeam : redTeam;
      box.appendChild(el('div.onclock', { style: { '--tc': side.color } }, [
        el('span.team-crest', { style: { background: side.color } }, side.tag),
        el('div', { style: { minWidth: 0 } }, [
          el('div.who', {}, side.name + (current.type === 'ban' ? ' banuje' : ' pická')),
          el('div.rnd', {}, onTurn
            ? 'JSI NA TAHU — vyber championa'
            : 'Tah ' + (idx + 1) + ' z ' + SEQUENCE.length + ' · ' + (current.type === 'ban' ? 'ban' : 'pick'))
        ]),
        el('div#pb-clock.pb-clock', {}, '–')
      ]));
    }

    /* ---- tři sloupce ---- */
    var layout = el('div.pb-layout');
    layout.appendChild(sideColumn(d, 'blue', blueTeam, current));
    layout.appendChild(championGrid(d, taken, current, done, onTurn));
    layout.appendChild(sideColumn(d, 'red', redTeam, current));
    box.appendChild(layout);

    setTimeout(paintClock, 0);
    return box;
  }

  /** Je aktuální tah můj? */
  function myTurn(current) {
    var d = state.draft;
    if (!d || !state.me) return false;
    if (state.me.role === 'admin') return true;
    var teamId = current.side === 'blue' ? d.blue : d.red;
    return (d.captains || {})[teamId] === state.me.id;
  }

  function act(action, payload) {
    AB.api.draftAction(action, payload)
      .then(function () { lastRev = -1; poll(); })
      .catch(function (e) { C.toast(e.message); });
  }

  /* ---- odpočet ---- */
  function paintClock() {
    var host = AB.$('#pb-clock');
    if (!host || !state.draft) return;
    var limit = state.draft.turnSeconds || 30;
    var elapsed = (Date.now() - (state.draft.turnStartedAt || Date.now())) / 1000;
    var left = Math.max(0, Math.ceil(limit - elapsed));
    host.textContent = left;
    host.classList.toggle('low', left <= 10 && left > 0);
    host.classList.toggle('out', left === 0);
    host.title = left === 0 ? 'Čas vypršel — čeká se dál, nic se neděje automaticky' : 'Zbývá ' + left + ' s';
  }

  /* ---- sloupec strany ---- */
  function sideColumn(d, side, team, current) {
    var picks = stepsOf(d, side, 'pick');
    var bans = stepsOf(d, side, 'ban');
    var active = current && current.side === side;
    var capId = (d.captains || {})[team.id];
    var isMe = state.me && state.me.role === 'captain' && state.me.id === capId;

    var col = el('div.pb-side' + (active ? '.active' : ''), { style: { '--tc': team.color } });

    col.appendChild(el('div.pb-side-head', {}, [
      C.crest(team, 'crest-sm'),
      el('div', { style: { minWidth: 0 } }, [
        el('div', { style: { fontFamily: 'var(--font-head)', fontSize: '15px', color: 'var(--gold-1)', textTransform: 'uppercase' } }, team.name),
        el('div.muted', { style: { fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase' } },
          (side === 'blue' ? 'modrá' : 'červená') + (capId ? ' · ' + AB.player(capId).name : ''))
      ]),
      isMe ? el('span.badge.badge-cap', { style: { marginLeft: 'auto' } }, 'TY') : null
    ].filter(Boolean)));

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
      return champ ? el('span.pb-ban', {}, AB.champImg(champ, 'champ-ic sm')) : el('span.pb-ban.empty', {});
    })));

    return col;
  }

  function stepsOf(d, side, type) {
    return SEQUENCE.map(function (s, i) { return { s: s, i: i }; })
      .filter(function (x) { return x.s.side === side && x.s.type === type; })
      .map(function (x) { return d.steps[x.i] ? d.steps[x.i].champ : null; });
  }

  /* ---- mřížka championů (staví se jednou, mezi tahy se recykluje) ---- */

  var gridCache = null;

  function championGrid(d, taken, current, done, onTurn) {
    if (!gridCache) buildGrid();

    gridCache.onPick = function (champId) {
      if (done || !onTurn) return;
      act('pick', { champ: champId });
    };

    var locked = done || !onTurn;
    gridCache.wrap.classList.toggle('locked', locked);
    gridCache.hint.textContent = done ? 'Draft je hotový.'
      : onTurn ? '' : 'Čeká se na soupeře — klikat můžeš, až budeš na tahu.';

    Object.keys(gridCache.btns).forEach(function (id) {
      var btn = gridCache.btns[id];
      var isTaken = !!taken[id];
      btn.classList.toggle('taken', isTaken);
      btn.disabled = isTaken || locked;
    });

    return gridCache.wrap;
  }

  function buildGrid() {
    var wrap = el('div.pb-grid-wrap');
    var grid = el('div.pb-grid');
    var count = el('span.muted', { style: { fontSize: '12px', marginLeft: 'auto' } });
    var hint = el('div.pb-hint');
    var btns = {};

    var search = el('input.search', {
      type: 'search', placeholder: 'Hledat championa…',
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

    /** Filtr jen schovává, nemaže — obrázky tak zůstanou načtené. */
    function filter(q) {
      var shown = 0;
      (w.CHAMPIONS || []).forEach(function (c) {
        var hit = !q || c.name.toLowerCase().indexOf(q) !== -1;
        btns[c.id].style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      count.textContent = shown + ' z ' + (w.CHAMPIONS || []).length;
    }

    wrap.appendChild(el('div.pool-filters', { style: { marginBottom: '10px' } }, [search, count]));
    wrap.appendChild(hint);
    wrap.appendChild(grid);
    filter('');

    gridCache = { wrap: wrap, btns: btns, count: count, search: search, hint: hint, onPick: null };
  }

  /* ------------------------------------------------------------ zápis --- */

  function saveToMatch(d, m) {
    var gi = d.gameNo - 1;
    m.games = m.games || [];

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
      m.games[gi] = { duration: '', winner: 'blue', blue: mk(d.blue), red: mk(d.red) };
      m.status = 'done';
    }

    var g = m.games[gi];

    ['blue', 'red'].forEach(function (side) {
      var tid = d[side];
      // strana v draftu nemusí sedět se stranou v už založené hře
      var target = (g.blue && g.blue.team === tid) ? g.blue : (g.red && g.red.team === tid ? g.red : null);
      if (!target) return;

      target.bans = stepsOf(d, side, 'ban').filter(Boolean);
      var picks = stepsOf(d, side, 'pick');
      (target.players || []).forEach(function (p, i) { if (picks[i]) p.champ = picks[i]; });
    });

    AB.api.saveMatches()
      .then(function () { return AB.api.draftAction('clear'); })
      .then(function () {
        C.toast('Zapsáno do hry ' + d.gameNo);
        state.draft = null; lastRev = -1;
        w.location.hash = '#/zapasy';
      })
      .catch(function (e) { C.toast('Nezapsáno: ' + e.message); });
  }

  /* ----------------------------------------------------------- pomocné -- */

  var nameMap = null;
  function champName(id) {
    if (!nameMap) {
      nameMap = {};
      (w.CHAMPIONS || []).forEach(function (c) { nameMap[c.id] = c.name; });
    }
    return nameMap[id] || id;
  }

  /* Když uživatel odejde jinam, přestaň dotazovat server. */
  w.addEventListener('hashchange', function () {
    if (!isOnPage()) stopPolling();
  });

})(window);
