/* ==========================================================================
   AQUABATTLE — Admin panel
   --------------------------------------------------------------------------
   Dvě záložky: Soupisky (rozřazení hráčů) a Výsledky (zápis odehraných her).

   Když běží server.js, každá změna se rovnou zapíše do data/*.js — žádné
   kopírování. Bez serveru se to odloží do localStorage a panel na to upozorní.

   Hlídá se strop soupisky: kapitánův rank + cena čtyř spoluhráčů <= SALARY_CAP.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  /* ------------------------------------------------- offline fallback --- */

  AB.rosters = {
    load: function () {
      var s = AB.store.get('rosters', null);
      return (s && s.teams) ? s : { teams: {}, subs: {}, meta: {} };
    },
    save: function (s) { AB.store.set('rosters', s); },
    clear: function () { AB.store.del('rosters'); }
  };

  /**
   * Naskládá odložené úpravy na soupisky.
   * Běží JEN bez serveru — se serverem je zdrojem pravdy soubor, a stará
   * localStorage vrstva by ho přebíjela zastaralými daty.
   */
  AB.applyRosterOverrides = function () {
    if (AB.api && AB.api.online) return;
    var s = AB.rosters.load();

    w.TEAMS.forEach(function (t) {
      var ov = s.teams[t.id];
      if (ov) {
        AB.ROLE_KEYS.forEach(function (r) {
          if (Object.prototype.hasOwnProperty.call(ov, r)) t.roster[r] = ov[r];
        });
        var at = AB.ROLE_KEYS.filter(function (r) { return t.roster[r] === t.captain; })[0];
        if (at) t.captainRole = at;
      }
      if (s.subs[t.id]) t.subs = s.subs[t.id].slice();
      var meta = s.meta[t.id];
      if (meta) {
        if (meta.name) t.name = meta.name;
        if (meta.tag) t.tag = meta.tag;
        if (meta.color) t.color = meta.color;
      }
    });
  };

  /* ------------------------------------------------------------ rozpočet -- */

  /** Co soupiska dohromady stojí — kapitán se počítá jako každý jiný. */
  AB.spent = function (t) { return AB.teamPoints(t); };

  /** Rozpočet kapitána na čtyři spoluhráče. Jen pro zobrazení. */
  AB.budgetOf = function (t) {
    var cap = AB.player(t.captain);
    return cap.budget !== undefined ? cap.budget : (w.SALARY_CAP - cap.points);
  };

  /**
   * Kolik zbývá do stropu. Záporné číslo = tým je přes.
   *
   * Počítá se rovnou proti stropu, ne oklikou přes kapitánův rozpočet.
   * Ta odečítala kapitánův rank ze stropu, ale zároveň sčítala všechny hráče
   * na soupisce — takže když kapitán na soupisce nebyl (třeba po výměně),
   * odečetl se dvakrát: jednou jako sleva ze stropu, podruhé jako cena
   * hráče, který zaujal jeho místo.
   *
   * Když kapitán na soupisce je, vyjde to stejně jako dřív.
   */
  AB.remaining = function (t) { return w.SALARY_CAP - AB.teamPoints(t); };

  /** Vede tým někdo, kdo za něj nehraje? Pak sedí soupiska o hráče jinak. */
  AB.captainOffRoster = function (t) {
    return AB.ROLE_KEYS.every(function (r) { return t.roster[r] !== t.captain; });
  };

  /* -------------------------------------------------------- ukládání ----- */

  var saveState = { status: 'idle', msg: '' };   // idle | saving | ok | error
  var saveTimer = null;

  /**
   * Uloží soupisky. Se serverem rovnou do souboru, jinak do localStorage.
   * Zapisuje se odloženě, ať rychlé klikání nezahltí disk.
   */
  AB.persistTeams = function () {
    if (!(AB.api && AB.api.canWrite())) {
      var s = AB.rosters.load();
      w.TEAMS.forEach(function (t) {
        s.teams[t.id] = {};
        AB.ROLE_KEYS.forEach(function (r) { s.teams[t.id][r] = t.roster[r]; });
        s.subs[t.id] = (t.subs || []).slice();
        s.meta[t.id] = { name: t.name, tag: t.tag, color: t.color };
      });
      AB.rosters.save(s);
      saveState = { status: 'ok', msg: 'uloženo v prohlížeči' };
      return;
    }

    saveState = { status: 'saving', msg: '' };
    paintSaveBadge();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      AB.api.saveTeams()
        .then(function () { saveState = { status: 'ok', msg: 'uloženo do data/teams.js' }; })
        .catch(function (e) { saveState = { status: 'error', msg: e.message }; })
        .then(paintSaveBadge);
    }, 250);
  };

  function paintSaveBadge() {
    var host = AB.$('#save-badge');
    if (!host) return;
    AB.clear(host);
    var map = {
      idle:   ['', ''],
      saving: ['⏳ ukládám…', 'var(--tx-1)'],
      ok:     ['✓ ' + saveState.msg, 'var(--win)'],
      error:  ['⚠ nezapsáno: ' + saveState.msg, 'var(--loss)']
    };
    var v = map[saveState.status];
    if (v[0]) host.appendChild(el('span', { style: { color: v[1], fontSize: '12px', fontWeight: '600' } }, v[0]));
  }

  /* --------------------------------------------------------------- view -- */

  /* AB.adminTab je globální, aby si polling v draft panelu poznal,
     jestli je jeho záložka zrovna vidět. */
  AB.adminTab = AB.adminTab || 'soupisky';

  AB.views.admin = function () {
    var root = el('div.view');
    var api = AB.api || {};

    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Admin'),
      el('h1', {}, 'Správa turnaje'),
      el('p', {}, api.online
        ? 'Server běží — každá změna se rovnou zapisuje do datových souborů. Nic nekopíruješ, stačí kliknout.'
        : 'Server neběží, takže se změny ukládají jen do tohoto prohlížeče. Spusť start.bat a načti stránku znovu.')
    ]));

    // nasazený server chce heslo, dokud se nepřihlásíš
    if (api.online && api.authRequired && !api.authed) {
      root.appendChild(loginForm());
      return root;
    }

    if (!api.online) {
      root.appendChild(el('div.notice', { style: { borderColor: 'rgba(248,113,113,.4)', background: 'rgba(248,113,113,.09)' } }, [
        el('span', {}, '⚠'),
        el('span', {}, [el('b', { style: { color: 'var(--loss)' } }, 'Bez serveru. '),
          'Změny zůstanou jen v tomhle prohlížeči. Spusť ', el('code.mono', {}, 'start.bat'),
          ' (nebo ', el('code.mono', {}, 'node server.js'), ') a otevři ',
          el('code.mono', {}, 'http://localhost:8099'), '.'])
      ]));
    }

    /* ---- záložky ---- */
    var tabs = el('div.game-tabs', { style: { marginTop: 0 } });
    [['soupisky', 'Soupisky'], ['draft', 'Draft'], ['vysledky', 'Výsledky zápasů']].forEach(function (pair) {
      tabs.appendChild(el('div.game-tab' + (AB.adminTab === pair[0] ? '.active' : ''), {
        onclick: function () { AB.adminTab = pair[0]; AB.reload(); }
      }, pair[1]));
    });
    tabs.appendChild(el('span#save-badge', { style: { marginLeft: 'auto', alignSelf: 'center' } }));
    if (api.authRequired) {
      tabs.appendChild(el('button.btn.btn-sm.btn-ghost', {
        style: { alignSelf: 'center', marginLeft: '12px' },
        onclick: function () {
          AB.api.logout();
          AB.api.loadPreferences().then(function () { AB.reload(); });
          C.toast('Odhlášeno');
        }
      }, 'Odhlásit'));
    }
    root.appendChild(tabs);

    root.appendChild(
      AB.adminTab === 'soupisky' ? rostersPanel()
        : AB.adminTab === 'draft' ? AB.draftAdminPanel()
          : AB.resultsPanel()
    );
    setTimeout(paintSaveBadge, 0);
    return root;
  };

  /* ========================================================= PŘIHLÁŠENÍ == */

  function loginForm() {
    var err = el('div', { style: { color: 'var(--loss)', fontSize: '12.5px', minHeight: '18px', marginTop: '10px' } });
    var input = el('input.search', {
      type: 'password', placeholder: 'Heslo do adminu', autofocus: 'autofocus',
      style: { width: '100%', flex: 'none' },
      onkeydown: function (e) { if (e.key === 'Enter') submit(); }
    });

    var btn = el('button.btn.btn-primary', { style: { marginTop: '14px' }, onclick: submit }, 'Přihlásit');

    function submit() {
      var pw = input.value;
      if (!pw) { err.textContent = 'Zadej heslo.'; return; }
      btn.disabled = true;
      err.textContent = '';
      AB.api.login('admin', pw)
        .then(function () { return AB.api.loadPreferences(); })
        .then(function () { C.toast('Přihlášeno'); AB.reload(); })
        .catch(function (e) {
          err.textContent = e.message;
          btn.disabled = false;
          input.select();
        });
    }

    setTimeout(function () { input.focus(); }, 30);

    return el('div.card', { style: { maxWidth: '430px', margin: '30px auto', padding: '28px' } }, [
      el('div', { style: { textAlign: 'center', marginBottom: '20px' } }, AB.ornament()),
      el('div.card-t', { style: { textAlign: 'center' } }, 'Přístup jen pro pořadatele'),
      el('p.muted', { style: { fontSize: '13px', marginTop: 0, lineHeight: '1.6' } },
        'Rozřazení týmů a zápis výsledků může měnit jen ten, kdo zná heslo. ' +
        'Ostatní si turnaj můžou prohlížet bez přihlášení.'),
      input,
      err,
      btn
    ]);
  }

  /* =========================================================== SOUPISKY == */

  function rostersPanel() {
    var box = el('div');

    function assign(tid, role, pid) {
      // hráč nemůže hrát za dva týmy najednou
      w.TEAMS.forEach(function (t) {
        AB.ROLE_KEYS.forEach(function (r) {
          if (t.roster[r] === pid && !(t.id === tid && r === role)) t.roster[r] = null;
        });
        if ((t.subs || []).indexOf(pid) !== -1) {
          t.subs = t.subs.filter(function (x) { return x !== pid; });
        }
      });
      AB.team(tid).roster[role] = pid;
      var at = AB.ROLE_KEYS.filter(function (r) { return AB.team(tid).roster[r] === AB.team(tid).captain; })[0];
      if (at) AB.team(tid).captainRole = at;
      AB.persistTeams();
      AB.reload();
    }

    function clearSlot(tid, role) {
      AB.team(tid).roster[role] = null;
      AB.persistTeams();
      AB.reload();
    }

    /* ---- nástroje ---- */
    box.appendChild(el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap', margin: '4px 0 22px' } }, [
      el('button.btn.btn-sm', { onclick: autoAssign }, 'Auto-rozdělení'),
      el('button.btn.btn-sm', { onclick: openSettings }, 'Týmy a kapitáni'),
      el('button.btn.btn-sm', { onclick: openAccounts }, 'Riot ID / OP.GG'),
      el('button.btn.btn-sm', { onclick: openCredentials }, 'Hesla kapitánů'),
      el('button.btn.btn-sm.btn-danger.btn-ghost', {
        onclick: function () {
          if (!confirm('Vymazat všechny sloty ve všech týmech? Kapitáni zůstanou.')) return;
          w.TEAMS.forEach(function (t) {
            AB.ROLE_KEYS.forEach(function (r) { if (t.roster[r] !== t.captain) t.roster[r] = null; });
            t.subs = [];
          });
          AB.persistTeams();
          AB.reload();
        }
      }, '✕ Vyprázdnit sloty')
    ]));

    /* ---- rozpočty ---- */
    box.appendChild(el('div.card', { style: { marginBottom: '22px' } }, [
      el('div.card-t', {}, 'Rozpočty · strop ' + w.SALARY_CAP + ' bodů na tým'),
      el('div.grid.g-3', {}, w.TEAMS.map(function (t) {
        var rem = AB.remaining(t), spent = AB.spent(t);
        var over = rem < 0;
        var offRoster = AB.captainOffRoster(t);
        return el('div', { style: { padding: '10px 12px', borderRadius: '0', borderLeft: '3px solid ' + t.color, background: 'rgba(255,255,255,.03)' } }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' } }, [
            C.crest(t, 'crest-xs'),
            el('span', { style: { fontWeight: '600', fontSize: '13px' } }, t.name),
            el('span.mono', { style: { marginLeft: 'auto', fontWeight: '700', color: over ? 'var(--loss)' : 'var(--win)' } },
              (over ? '' : '+') + rem)
          ]),
          el('div.cmp-bar', {}, el('i', { style: { width: Math.min(100, spent / w.SALARY_CAP * 100) + '%', background: over ? 'var(--loss)' : t.color } })),
          el('div.muted', { style: { fontSize: '11px', marginTop: '5px' } },
            'soupiska stojí ' + spent + ' z ' + w.SALARY_CAP + (over ? ' — PŘES STROP!' : '')),
          offRoster ? el('div', { style: { fontSize: '11px', marginTop: '4px', color: 'var(--warn)' } },
            '⚠ kapitán ' + AB.player(t.captain).name + ' není na soupisce') : null
        ].filter(Boolean));
      }))
    ]));

    /* ---- panely týmů ---- */
    box.appendChild(el('div.grid.g-2', {}, w.TEAMS.map(teamPanel)));

    /* ---- nezařazení ---- */
    var assigned = AB.draftedIds();
    var free = AB.everyone().filter(function (p) { return !assigned[p.id]; })
      .sort(function (a, b) { return b.points - a.points || a.name.localeCompare(b.name); });

    box.appendChild(el('div.section', {}, [
      el('div.section-head', {}, [
        el('h2', {}, 'Nezařazení hráči'),
        el('span.muted', { style: { fontSize: '12px', marginLeft: 'auto' } }, free.length + ' volných')
      ]),
      free.length
        ? el('div.pool-grid', {}, free.map(function (p) {
            return el('div.pool-card', { onclick: function () { openPlayerAssign(p); } }, [
              C.rankDot(p.rank),
              el('div', { style: { minWidth: 0 } }, [el('div.pool-name', {}, p.name), C.roleBadges(p.roles)]),
              el('span.pts', { style: { color: (w.RANKS[p.rank] || {}).color } }, p.points)
            ]);
          }))
        : el('div.card.muted', { style: { textAlign: 'center', padding: '26px' } }, 'Všichni hráči jsou zařazení.')
    ]));

    return box;

    /* ------------------------------------------------------ panel týmu --- */

    function teamPanel(t) {
      var card = el('div.team-card', { style: { '--tc': t.color } });
      var rem = AB.remaining(t);

      card.appendChild(el('div.team-head', {}, [
        C.crest(t, 'team-crest'),
        el('div', { style: { minWidth: 0 } }, [
          el('div.team-name', {}, t.name),
          el('div.team-sub', {}, 'kapitán ' + AB.player(t.captain).name + ' · ' + AB.player(t.captain).points + ' b.')
        ]),
        el('div.team-pts', {}, [
          el('b', { style: { color: rem < 0 ? 'var(--loss)' : t.color } }, rem),
          el('span', {}, 'zbývá')
        ])
      ]));

      AB.ROLE_KEYS.forEach(function (role) {
        var pid = t.roster[role];
        var p = pid ? AB.player(pid) : null;
        var isCap = pid === t.captain;

        card.appendChild(el('div.roster-row' + (p ? '' : '.is-empty'), {
          style: { cursor: 'pointer' },
          onclick: function () { openSlot(t, role); }
        }, [
          el('span.role-chip', {}, AB.roleIcon(role)),
          p ? el('span.roster-name', {}, p.name) : el('span.roster-name.muted', {}, '+ přiřadit hráče'),
          el('span.roster-meta', {}, [
            isCap ? el('span.badge.badge-cap', {}, '★ C') : null,
            p ? C.rankBadge(p.rank) : null,
            p ? el('span.mono', {
              // i kapitánovy body se počítají do stropu, tak je ukaž
              style: { fontSize: '12px', minWidth: '32px', textAlign: 'right', color: (w.RANKS[p.rank] || {}).color }
            }, p.points) : null,
            p && !isCap ? el('button.icon-btn', {
              title: 'Uvolnit slot',
              onclick: function (e) { e.stopPropagation(); clearSlot(t.id, role); }
            }, '✕') : null
          ].filter(Boolean))
        ]));
      });

      (t.subs || []).forEach(function (pid) {
        var p = AB.player(pid);
        card.appendChild(el('div.roster-row.is-sub', {}, [
          el('span.role-chip', { style: { color: 'var(--gold-2)' } }, 'SUB'),
          el('span.roster-name', {}, p.name),
          el('span.roster-meta', {}, [
            C.rankBadge(p.rank),
            el('button.icon-btn', {
              title: 'Odebrat náhradníka',
              onclick: function () {
                t.subs = (t.subs || []).filter(function (x) { return x !== pid; });
                AB.persistTeams(); AB.reload();
              }
            }, '✕')
          ])
        ]));
      });

      card.appendChild(el('div.roster-row.is-sub', {
        style: { cursor: 'pointer', opacity: '.62' }, onclick: function () { openSubAdd(t); }
      }, [
        el('span.role-chip', { style: { color: 'var(--gold-2)' } }, 'SUB'),
        el('span.roster-name.muted', {}, '+ přidat náhradníka')
      ]));

      return card;
    }

    /* --------------------------------------------------- modal na slot --- */

    function openSlot(t, role) {
      var body = el('div');
      var current = t.roster[role];
      var query = '';
      var listBox = el('div.pool-grid');

      body.appendChild(el('input.search', {
        type: 'search', placeholder: 'Hledat hráče…', style: { width: '100%', marginBottom: '14px' },
        oninput: function (e) { query = e.target.value.toLowerCase().trim(); renderList(); }
      }));

      if (current && current !== t.captain) {
        body.appendChild(el('button.btn.btn-sm.btn-danger.btn-ghost', {
          style: { marginBottom: '14px' },
          onclick: function () { m.close(); clearSlot(t.id, role); }
        }, '✕ Uvolnit slot (' + AB.player(current).name + ')'));
      }
      body.appendChild(listBox);

      function renderList() {
        AB.clear(listBox);
        // uvolněním slotu se jeho body vrátí — i u kapitána, ten se do
        // stropu počítá jako každý jiný
        var rem = AB.remaining(t) + (current ? AB.player(current).points : 0);

        var cands = AB.everyone().filter(function (p) {
          if (p.roles.indexOf(role) === -1) return false;
          if (query && p.name.toLowerCase().indexOf(query) === -1) return false;
          if (AB.isCaptain(p.id) && p.id !== t.captain) return false;
          return true;
        }).sort(function (a, b) { return b.points - a.points || a.name.localeCompare(b.name); });

        cands.forEach(function (p) {
          var owner = AB.teamOfPlayer(p.id);
          var isCap = p.id === t.captain;
          var cost = p.points;
          var fits = cost <= rem;

          listBox.appendChild(el('div.pool-card', {
            style: !fits ? { borderColor: 'rgba(248,113,113,.4)' } : null,
            title: fits ? '' : 'Přesahuje rozpočet o ' + (cost - rem) + ' bodů',
            onclick: function () {
              if (!fits && !confirm(p.name + ' stojí ' + cost + ' b., ale zbývá jen ' + rem + '. Přiřadit i tak?')) return;
              m.close();
              assign(t.id, role, p.id);
              C.toast(p.name + ' → ' + t.name);
            }
          }, [
            C.rankDot(p.rank),
            el('div', { style: { minWidth: 0 } }, [
              el('div.pool-name', {}, p.name),
              el('div.muted', { style: { fontSize: '11px', marginTop: '2px' } },
                isCap ? '★ kapitán týmu' : (owner ? 'nyní: ' + owner.name : 'volný'))
            ]),
            el('span.pts', { style: { color: fits ? (w.RANKS[p.rank] || {}).color : 'var(--loss)' } }, cost)
          ]));
        });

        if (!cands.length) listBox.appendChild(el('div.muted', { style: { padding: '18px' } }, 'Nikdo neumí tuhle pozici.'));
      }

      renderList();
      var m = C.modal(el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        AB.roleIcon(role, 'lg'),
        el('h3', {}, (w.ROLES[role] || {}).label + ' — ' + t.name),
        el('span.pill', {}, 'zbývá ' + AB.remaining(t) + ' b.')
      ]), body, true);
    }

    /* ------------------------------------------------ modal na hráče ---- */

    function openPlayerAssign(p) {
      var body = el('div', {}, [
        el('p.muted', { style: { marginTop: 0, fontSize: '13px' } },
          p.name + ' (' + p.points + ' b.) umí: ' + p.roles.map(function (r) { return (w.ROLES[r] || {}).label; }).join(', '))
      ]);

      w.TEAMS.forEach(function (t) {
        var rem = AB.remaining(t);
        body.appendChild(el('div', { style: { padding: '11px 0', borderBottom: '1px solid var(--line)' } }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' } }, [
            C.crest(t, 'crest-xs'),
            el('span', { style: { fontWeight: '600', fontSize: '13px' } }, t.name),
            el('span.mono', { style: { marginLeft: 'auto', fontSize: '12px', color: rem >= p.points ? 'var(--win)' : 'var(--loss)' } }, 'zbývá ' + rem)
          ]),
          el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, p.roles.map(function (r) {
            var occupied = t.roster[r];
            return el('button.filter-btn', {
              title: (w.ROLES[r] || {}).label + (occupied ? ' — nahradí: ' + AB.player(occupied).name : ' — volný slot'),
              onclick: function () {
                if (occupied === t.captain) { C.toast('Tady stojí kapitán, přesuň ho nejdřív jinam'); return; }
                m.close();
                assign(t.id, r, p.id);
                C.toast(p.name + ' → ' + t.name);
              }
            }, [
              AB.roleIcon(r, 'sm'),
              el('span', {}, occupied ? AB.player(occupied).name : 'volné')
            ]);
          }))
        ]));
      });
      var m = C.modal('Kam patří ' + p.name + '?', body);
    }

    /* ------------------------------------------------------ náhradníci -- */

    function openSubAdd(t) {
      var assignedNow = AB.draftedIds();
      var cands = AB.everyone().filter(function (p) { return !assignedNow[p.id]; })
        .sort(function (a, b) { return b.points - a.points; });

      var body = el('div', {}, [
        el('p.muted', { style: { marginTop: 0, fontSize: '13px' } }, 'Náhradníci se nezapočítávají do stropu.'),
        cands.length
          ? el('div.pool-grid', {}, cands.map(function (p) {
              return el('div.pool-card', {
                onclick: function () {
                  m.close();
                  t.subs = (t.subs || []).concat([p.id]);
                  AB.persistTeams(); AB.reload();
                  C.toast(p.name + ' je náhradník ' + t.name);
                }
              }, [
                C.rankDot(p.rank),
                el('div', {}, [el('div.pool-name', {}, p.name), C.roleBadges(p.roles)]),
                el('span.pts', {}, p.points)
              ]);
            }))
          : el('div.muted', {}, 'Nikdo volný nezbyl.')
      ]);
      var m = C.modal('Náhradník pro ' + t.name, body, true);
    }

    /* -------------------------------------------------- názvy a barvy --- */

    /**
     * Vymění kapitána týmu.
     *
     * Nový kapitán se uvolní odkudkoliv jinud (klidně i z tohohle týmu, kde
     * mohl hrát jako řadový hráč) a posadí se na první pozici, kterou umí.
     * Starý kapitán slot opustí — zůstane v poolu a jde ho draftovat zpátky.
     */
    function setCaptain(t, newCapId) {
      var newCap = AB.player(newCapId);
      if (!newCap.roles || !newCap.roles.length) { C.toast('Ten hráč nemá žádnou pozici'); return; }

      // starý kapitán ze slotu pryč
      AB.ROLE_KEYS.forEach(function (r) { if (t.roster[r] === t.captain) t.roster[r] = null; });

      // nový nemůže zůstat nikde jinde
      w.TEAMS.forEach(function (x) {
        AB.ROLE_KEYS.forEach(function (r) { if (x.roster[r] === newCapId) x.roster[r] = null; });
        if ((x.subs || []).indexOf(newCapId) !== -1) {
          x.subs = x.subs.filter(function (s) { return s !== newCapId; });
        }
      });

      // přednostně na volnou pozici, kterou umí
      var role = newCap.roles.filter(function (r) { return !t.roster[r]; })[0] || newCap.roles[0];
      t.captain = newCapId;
      t.captainRole = role;
      t.roster[role] = newCapId;

      AB.persistTeams();
      AB.reload();
      C.toast(newCap.name + ' je kapitán ' + t.name + ' (' + (w.ROLES[role] || {}).label + ')');
    }

    function openSettings() {
      var body = el('div');
      body.appendChild(el('p.muted', { style: { marginTop: 0, fontSize: '13px', lineHeight: '1.6' } },
        'Změna kapitána přesune nového na první pozici, kterou umí, a starého uvolní ' +
        'do poolu. Rozpočet týmu se přepočítá podle ranku nového kapitána — a heslo ' +
        'pro přihlášení do draftu mu vygeneruj znovu.'));

      w.TEAMS.forEach(function (t) {
        body.appendChild(el('div', { style: { padding: '13px 0', borderBottom: '1px solid var(--line)' } }, [
          el('div', { style: { display: 'flex', gap: '9px', alignItems: 'center' } }, [
            C.crest(t, 'crest-xs'),
            el('input.search', {
              value: t.name, style: { flex: '2' }, title: 'Název týmu',
              oninput: function (e) { t.name = e.target.value; AB.persistTeams(); }
            }),
            el('input.search', {
              value: t.tag, maxlength: '4', style: { flex: '0 0 70px', textAlign: 'center' }, title: 'Zkratka',
              oninput: function (e) { t.tag = e.target.value.toUpperCase(); AB.persistTeams(); }
            }),
            el('input', {
              type: 'color', value: t.color, title: 'Barva',
              style: { width: '44px', height: '34px', border: '1px solid var(--line)', borderRadius: '0', background: 'transparent', cursor: 'pointer' },
              oninput: function (e) { t.color = e.target.value; AB.persistTeams(); }
            })
          ]),
          el('div', { style: { display: 'flex', gap: '9px', alignItems: 'center', marginTop: '8px' } }, [
            el('span.muted', { style: { fontSize: '11.5px', minWidth: '58px' } }, 'Kapitán:'),
            el('select.search', {
              style: { flex: '1' },
              onchange: function (e) {
                var id = e.target.value;
                if (id === t.captain) return;
                if (!confirm('Udělat z ' + AB.player(id).name + ' kapitána týmu ' + t.name + '?\n\n' +
                             AB.player(t.captain).name + ' uvolní slot a vrátí se do poolu.')) {
                  e.target.value = t.captain;
                  return;
                }
                setCaptain(t, id);
              }
            }, w.CAPTAINS.map(function (c) {
              return el('option', {
                value: c.id,
                selected: c.id === t.captain ? 'selected' : null
              }, c.name + ' · ' + (w.RANKS[c.rank] || {}).label + ' · ' + c.roles.join('/'));
            })),
            el('span.muted', { style: { fontSize: '11.5px' } },
              'rozpočet ' + AB.budgetOf(t))
          ])
        ]));
      });
      body.appendChild(el('button.btn.btn-primary', {
        style: { marginTop: '16px' },
        onclick: function () { m.close(); AB.reload(); }
      }, 'Hotovo'));
      var m = C.modal('Týmy — název, barva, kapitán', body);
    }

    /* ------------------------------------------------ Riot ID / OP.GG --- */

    function openAccounts() {
      w.ACCOUNTS = w.ACCOUNTS || {};
      var body = el('div');
      var saveSoon = debounce(function () {
        if (!(AB.api && AB.api.canWrite())) { C.toast('Bez přihlášení se to neuloží'); return; }
        AB.api.saveAccounts()
          .then(function () { C.toast('Riot ID uložena'); })
          .catch(function (e) { C.toast('Nezapsáno: ' + e.message); });
      }, 700);

      body.appendChild(el('p.muted', { style: { marginTop: 0, fontSize: '13px', lineHeight: '1.6' } },
        'Riot ID ve tvaru Jméno#TAG (přesně jak ho má hráč ve hře). Používá se pro odkazy ' +
        'na OP.GG u hráčů i pro multisearch celého týmu. Kdo hraje na jiném serveru, ' +
        'má u sebe vlastní region — multisearch se pak rozdělí podle regionů.'));

      body.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px' } }, [
        el('span.muted', { style: { fontSize: '12px' } }, 'Výchozí region turnaje:'),
        el('select.search', {
          style: { flex: '0 0 120px' },
          onchange: function (e) {
            /* Hráči uložení jako prostý řetězec nemají region zapsaný —
               drží se výchozího. Kdybychom ho přepnuli rovnou, tiše by se
               všichni přestěhovali jinam. Proto jim ho nejdřív ukotvíme. */
            var pinned = 0;
            Object.keys(w.ACCOUNTS || {}).forEach(function (pid) {
              if (typeof w.ACCOUNTS[pid] === 'string') {
                w.ACCOUNTS[pid] = { id: w.ACCOUNTS[pid], region: AB.region() };
                pinned++;
              }
            });
            w.OPGG_REGION = e.target.value;
            saveSoon();
            AB.reload();
            if (pinned) C.toast(pinned + ' hráčům zůstal původní region');
          }
        }, AB.REGIONS.map(function (r) {
          return el('option', { value: r, selected: AB.region() === r ? 'selected' : null }, r.toUpperCase());
        }))
      ]));

      w.TEAMS.forEach(function (t) {
        var ids = AB.rosterIds(t).concat(t.subs || []);
        if (!ids.length) return;

        body.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0 8px' } }, [
          C.crest(t, 'crest-xs'),
          el('span', { style: { fontWeight: '600', fontSize: '13px', color: 'var(--gold-1)' } }, t.name)
        ]));

        ids.forEach(function (pid) { body.appendChild(accountRow(pid, saveSoon)); });
      });

      // nezařazení hráči na konec, ať nepřekáží
      var free = AB.everyone().filter(function (p) { return !AB.teamOfPlayer(p.id); });
      if (free.length) {
        body.appendChild(el('div.card-t', { style: { marginTop: '20px' } }, 'Bez týmu'));
        free.forEach(function (p) { body.appendChild(accountRow(p.id, saveSoon, true)); });
      }

      C.modal('Riot ID hráčů', body, true);
    }

    /** Řádek: jméno · Riot ID · region. */
    function accountRow(pid, saveSoon, dim) {
      var acc = AB.accountOf(pid);

      /** Zapíše účet zpátky — prostý řetězec, nebo objekt když má vlastní region. */
      function write(id, region) {
        if (!id) { delete w.ACCOUNTS[pid]; return; }
        w.ACCOUNTS[pid] = (region && region !== AB.region()) ? { id: id, region: region } : id;
      }

      var regionSel = el('select.search', {
        style: { flex: '0 0 104px', fontSize: '12px' },
        title: 'Region tohoto hráče',
        onchange: function (e) {
          var cur = AB.accountOf(pid);
          if (!cur) { C.toast('Nejdřív vyplň Riot ID'); e.target.value = AB.region(); return; }
          write(cur.id, e.target.value);
          saveSoon();
          AB.reload();
        }
      }, AB.REGIONS.map(function (r) {
        return el('option', {
          value: r,
          selected: (acc ? acc.region : AB.region()) === r ? 'selected' : null
        }, r.toUpperCase());
      }));

      return el('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 0' } }, [
        el('span' + (dim ? '.muted' : ''), { style: { minWidth: '120px', fontSize: '13px' } }, AB.player(pid).name),
        el('input.search', {
          value: acc ? acc.id : '',
          placeholder: 'Jméno#TAG',
          oninput: function (e) {
            write(e.target.value.trim(), regionSel.value);
            saveSoon();
          }
        }),
        regionSel
      ]);
    }

    /* ---------------------------------------------- hesla kapitánů ------ */

    function openCredentials() {
      var body = el('div');
      var out = el('div');

      body.appendChild(el('p.muted', { style: { marginTop: 0, fontSize: '13px', lineHeight: '1.6' } },
        'Kapitáni se s těmihle údaji přihlásí v sekci Pick & Ban a můžou draftit za svůj tým. ' +
        'Server si ukládá jen otisk hesla — čitelné ho uvidíš jednou, tady. Kdo si ho ztratí, ' +
        'vygeneruj mu nové.'));

      var list = el('div', { style: { margin: '14px 0' } });
      var chosen = {};
      w.CAPTAINS.forEach(function (c) {
        chosen[c.id] = true;
        list.appendChild(el('label', {
          style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 0', cursor: 'pointer' }
        }, [
          el('input', {
            type: 'checkbox', checked: 'checked',
            onchange: function (e) { chosen[c.id] = e.target.checked; }
          }),
          el('span', { style: { fontWeight: '600', fontSize: '13px' } }, c.name),
          el('span.muted', { style: { fontSize: '11.5px' } }, (AB.teamOfPlayer(c.id) || {}).name || '')
        ]));
      });
      body.appendChild(list);

      var btn = el('button.btn.btn-primary', {
        onclick: function () {
          var ids = Object.keys(chosen).filter(function (k) { return chosen[k]; });
          if (!ids.length) { C.toast('Nikoho jsi nevybral'); return; }
          if (!confirm('Vygenerovat nová hesla pro ' + ids.length + ' kapitánů?\n\n' +
                       'Stará hesla okamžitě přestanou platit.')) return;
          btn.disabled = true;
          AB.api.generateCredentials(ids)
            .then(function (j) { showPasswords(j.passwords); btn.disabled = false; })
            .catch(function (e) { C.toast('Nepodařilo se: ' + e.message); btn.disabled = false; });
        }
      }, 'Vygenerovat hesla');

      body.appendChild(btn);
      body.appendChild(out);

      function showPasswords(pw) {
        AB.clear(out);
        var lines = Object.keys(pw).map(function (id) {
          return AB.player(id).name + ': ' + pw[id];
        }).join('\n');

        out.appendChild(el('div.notice', { style: { marginTop: '18px' } },
          el('span', {}, [el('b', {}, 'Zkopíruj si je teď. '),
            'Až tohle okno zavřeš, znovu je nezobrazíš — jde je jen vygenerovat nanovo.'])));

        var ta = el('textarea.code-out', { spellcheck: 'false', style: { minHeight: '150px' } });
        ta.value = lines;
        out.appendChild(ta);
        out.appendChild(el('button.btn.btn-sm', {
          style: { marginTop: '10px' },
          onclick: function () {
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { /* ignoruj */ }
            if (w.navigator.clipboard) w.navigator.clipboard.writeText(ta.value).catch(function () { });
            C.toast(ok ? 'Zkopírováno' : 'Označeno — Ctrl+C');
          }
        }, '⧉ Kopírovat'));
      }

      C.modal('Hesla kapitánů', body);
    }

    function debounce(fn, ms) {
      var t = null;
      return function () { clearTimeout(t); t = setTimeout(fn, ms); };
    }

    /* --------------------------------------------- auto-rozdělení ------- */

    function autoAssign() {
      if (!confirm('Doplnit VOLNÉ sloty automaticky? Už zařazení hráči zůstanou, kde jsou.')) return;
      var order = w.TEAMS.slice();
      var filled = 0;

      AB.ROLE_KEYS.forEach(function () {
        order.sort(function (a, b) { return AB.remaining(b) - AB.remaining(a); });
        order.forEach(function (t) {
          var gap = AB.ROLE_KEYS.filter(function (r) { return !t.roster[r]; })[0];
          if (!gap) return;

          var taken = AB.draftedIds();
          var slotsLeft = AB.ROLE_KEYS.filter(function (r) { return !t.roster[r]; }).length;
          // nech si 50 b. (nejlevnější hráč) na každý zbylý slot
          var maxSpend = AB.remaining(t) - (slotsLeft - 1) * 50;

          var best = AB.everyone().filter(function (p) {
            return !taken[p.id] && !AB.isCaptain(p.id) && p.roles.indexOf(gap) !== -1 && p.points <= maxSpend;
          }).sort(function (a, b) { return b.points - a.points; })[0];

          if (best) { t.roster[gap] = best.id; filled++; }
        });
      });

      AB.persistTeams();
      AB.reload();
      C.toast(filled ? 'Doplněno ' + filled + ' slotů' : 'Nebylo co doplnit');
    }
  }

})(window);
