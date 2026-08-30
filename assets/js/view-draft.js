/* ==========================================================================
   AQUABATTLE — Live draft nástroj
   --------------------------------------------------------------------------
   Snake draft: pořadí z window.DRAFT_ORDER, DRAFT_ROUNDS kol.
   Stav se průběžně ukládá do localStorage, takže refresh o nic nepřijde.
   Tlačítko "Exportovat týmy" vygeneruje hotový obsah data/teams.js.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;
  AB.views = AB.views || {};

  /* ------------------------------------------------------------- stav ---- */

  AB.draft = {
    load: function () {
      var s = AB.store.get('draft', null);
      return s && Array.isArray(s.picks) ? s : { picks: [], captainRoles: {} };
    },
    save: function (s) { AB.store.set('draft', s); },
    clear: function () { AB.store.del('draft'); }
  };

  /**
   * Dá se každá z rolí `roles` obsadit jiným hráčem z `players`?
   * (bipartitní párování, Kuhnův algoritmus — rolí jsou max 4, takže je to levné)
   *
   * Používá se jako pojistka proti zabetonování: hráč umí víc rolí a kapitán
   * ho dá na špatnou, takže na zbylý slot pak nikdo nezbyde.
   */
  function canFillAll(roles, players) {
    var matchOf = {};                                   // playerId -> role

    function assign(role, seen) {
      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        if (p.roles.indexOf(role) === -1 || seen[p.id]) continue;
        seen[p.id] = 1;
        if (!matchOf[p.id] || assign(matchOf[p.id], seen)) {
          matchOf[p.id] = role;
          return true;
        }
      }
      return false;
    }

    for (var i = 0; i < roles.length; i++) {
      if (!assign(roles[i], {})) return false;
    }
    return true;
  }

  /** Pořadí picků: snake přes DRAFT_ORDER. */
  AB.draftSequence = function () {
    var seq = [];
    for (var r = 0; r < w.DRAFT_ROUNDS; r++) {
      var order = (r % 2 === 0) ? w.DRAFT_ORDER : w.DRAFT_ORDER.slice().reverse();
      order.forEach(function (tid) { seq.push({ round: r + 1, team: tid }); });
    }
    return seq;
  };

  /**
   * Přepočítá window.TEAMS z původních dat v teams.js + uloženého draftu.
   *
   * Nejdřív si zapamatuje soupisky tak, jak přišly ze souboru, a od té chvíle
   * je při každém překreslení obnoví a teprve pak na ně naskládá picky. Díky
   * tomu funguje "Zpět" i reset — jinak by v TEAMS zůstal hráč, kterého už
   * draft nezná. Ručně vyplněné sloty v teams.js zůstávají nedotčené.
   */
  AB.applyDraftFromStorage = function () {
    // Se serverem je zdrojem pravdy soubor a admin sahá rovnou do window.TEAMS.
    // Přestavovat soupisky při každém renderu by mu ty změny mazalo.
    if (AB.api && AB.api.online) return AB.draft.load();
    return AB.rebuildRostersFromDraft();
  };

  AB.rebuildRostersFromDraft = function () {
    w.TEAMS.forEach(function (t) {
      if (!t._base) t._base = { roster: Object.assign({}, t.roster), captainRole: t.captainRole };
      t.roster = Object.assign({}, t._base.roster);
      t.captainRole = t._base.captainRole;
    });

    var s = AB.draft.load();

    Object.keys(s.captainRoles || {}).forEach(function (tid) {
      var t = AB.team(tid), role = s.captainRoles[tid];
      if (!t || !role || t.captainRole === role) return;
      if (t.roster[t.captainRole] === t.captain) t.roster[t.captainRole] = null;
      t.captainRole = role;
      t.roster[role] = t.captain;
    });

    s.picks.forEach(function (p) {
      var t = AB.team(p.team);
      if (t && !t.roster[p.role]) t.roster[p.role] = p.player;
    });

    return s;
  };

  /* -------------------------------------------------------------- view --- */

  AB.views.draft = function () {
    var root = el('div.view');
    var state = AB.draft.load();
    var seq = AB.draftSequence();

    /* Po každé změně picků: se serverem přepočítej soupisky a zapiš do souboru
       (offline to za nás udělá applyDraftFromStorage při renderu). */
    function syncDraft() {
      if (!(AB.api && AB.api.canWrite())) return;
      AB.rebuildRostersFromDraft();
      AB.persistTeams();
    }

    /* pomocné výpočty nad aktuálním stavem */
    var pickedIds = {};
    state.picks.forEach(function (p) { pickedIds[p.player] = p.team; });

    /** Role, které týmu ještě chybí (kapitán už jednu drží). */
    function needsOf(tid) {
      var t = AB.team(tid);
      var taken = {};
      if (t.captainRole) taken[t.captainRole] = true;
      state.picks.forEach(function (p) { if (p.team === tid) taken[p.role] = true; });
      // respektuj i ručně vyplněné sloty z teams.js
      AB.ROLE_KEYS.forEach(function (r) {
        if (t.roster[r] && t.roster[r] !== t.captain && !taken[r]) {
          var fromPick = state.picks.some(function (p) { return p.team === tid && p.role === r; });
          if (!fromPick) taken[r] = true;
        }
      });
      return AB.ROLE_KEYS.filter(function (r) { return !taken[r]; });
    }

    var idx = state.picks.length;
    var done = idx >= seq.length;
    var current = done ? null : seq[idx];

    /* ---------- hlavička ---------- */
    root.appendChild(el('div.page-head', {}, [
      el('div.eyebrow', {}, 'Snake draft · ' + w.DRAFT_ROUNDS + ' kola · ' + seq.length + ' picků'),
      el('h1', {}, 'Draft'),
      el('p', {}, 'Kapitáni vybírají v snake pořadí — nejslabší tým začíná. Klikni na hráče a přiřaď mu pozici. ' +
        'Stav se ukládá do prohlížeče, na konci si týmy vyexportuješ do souboru.')
    ]));

    /* ---------- akce ---------- */
    root.appendChild(el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap', marginBottom: '20px' } }, [
      el('button.btn.btn-sm', {
        disabled: !state.picks.length,
        onclick: function () {
          state.picks.pop();
          AB.draft.save(state);
          syncDraft();
          AB.reload();
          C.toast('Poslední pick vrácen zpět');
        }
      }, '↶ Zpět'),
      el('button.btn.btn-sm.btn-primary', { onclick: exportTeams }, '⤓ Exportovat týmy'),
      el('button.btn.btn-sm', { onclick: openCaptainRoles, disabled: state.picks.length > 0 },
        '⚙ Pozice kapitánů' + (state.picks.length ? ' (zamčeno)' : '')),
      el('button.btn.btn-sm.btn-danger.btn-ghost', {
        onclick: function () {
          if (!confirm('Opravdu smazat celý rozdraftovaný stav? Tohle se nedá vrátit.')) return;
          AB.draft.clear();
          w.location.reload();
        }
      }, '✕ Reset draftu')
    ]));

    /* ---------- pruh pořadí ---------- */
    root.appendChild(el('div.order-strip', {}, seq.map(function (s, i) {
      var t = AB.team(s.team);
      return el('div.order-cell' + (i < idx ? '.done' : (i === idx ? '.now' : '')), {
        style: { '--tc': t.color },
        title: 'Pick ' + (i + 1) + ' · ' + t.name + ' (' + s.round + '. kolo)'
      }, t.tag);
    })));

    /* ---------- on the clock ---------- */
    if (done) {
      root.appendChild(el('div.notice', { style: { borderColor: 'rgba(52,211,153,.4)', background: 'rgba(52,211,153,.09)' } }, [
        el('span', {}, '✅'),
        el('span', {}, [el('b', { style: { color: 'var(--win)' } }, 'Draft dokončen! '),
          'Nezapomeň kliknout na „Exportovat týmy" a vložit výsledek do data/teams.js, ať to zůstane natrvalo.']),
        el('button.btn.btn-sm.btn-primary', { onclick: exportTeams, style: { marginLeft: 'auto' } }, 'Exportovat')
      ]));
    } else {
      var ct = AB.team(current.team);
      var needs = needsOf(current.team);
      root.appendChild(el('div.onclock', { style: { '--tc': ct.color } }, [
        el('span.team-crest', { style: { background: ct.color } }, ct.tag),
        el('div', {}, [
          el('div.who', {}, ct.name + ' vybírá'),
          el('div.rnd', {}, 'Pick ' + (idx + 1) + ' z ' + seq.length + ' · ' + current.round + '. kolo · kapitán ' + ct.captain)
        ]),
        el('div.needs', {}, needs.map(function (r) {
          var avail = w.POOL.filter(function (p) {
            return !pickedIds[p.id] && p.roles.indexOf(r) !== -1;
          }).length;
          // zvýrazni role, kterých je v poolu málo
          var scarce = avail <= 2;
          return el('span.badge.badge-role', scarce ? {
            style: { background: 'rgba(196,68,63,.14)', borderColor: 'rgba(196,68,63,.5)', color: 'var(--loss)' },
            title: (w.ROLES[r] || {}).label + ' — zbývají jen ' + avail + ' hráči!'
          } : { title: (w.ROLES[r] || {}).label + ' — ' + avail + ' volných hráčů' }, [
            AB.roleIcon(r),
            el('span.mono', {}, avail)
          ]);
        }))
      ]));
    }

    /* ---------- layout ---------- */
    var layout = el('div.draft-layout');
    var left = el('div');
    var right = el('div');
    layout.appendChild(left);
    layout.appendChild(right);
    root.appendChild(layout);

    /* ----- filtry ----- */
    var filterRole = 'ALL';
    var query = '';
    var poolGrid = el('div.pool-grid');

    // přímá reference — podstrom ještě není v documentu, takže by ho
    // querySelector přes document nenašel
    var poolCount = el('span.muted', { style: { fontSize: '12px', marginLeft: 'auto' } });
    var filters = el('div.pool-filters');
    ['ALL'].concat(AB.ROLE_KEYS).forEach(function (r) {
      filters.appendChild(el('button.filter-btn' + (r === 'ALL' ? '.active' : ''), {
        onclick: function (e) {
          AB.$$('.filter-btn', filters).forEach(function (b) { b.classList.remove('active'); });
          e.currentTarget.classList.add('active');
          filterRole = r;
          renderPool();
        },
        title: r === 'ALL' ? 'Všichni hráči' : w.ROLES[r].label
      }, r === 'ALL' ? 'Všichni' : AB.roleIcon(r)));
    });
    filters.appendChild(el('input.search', {
      type: 'search', placeholder: 'Hledat hráče…',
      oninput: function (e) { query = e.target.value.toLowerCase().trim(); renderPool(); }
    }));

    left.appendChild(el('div.section-head', { style: { marginTop: '4px' } }, [
      el('h2', {}, 'Volný pool'),
      poolCount
    ]));
    left.appendChild(filters);
    left.appendChild(poolGrid);

    function renderPool() {
      AB.clear(poolGrid);
      var needs = current ? needsOf(current.team) : [];

      var list = w.POOL.filter(function (p) {
        if (filterRole !== 'ALL' && p.roles.indexOf(filterRole) === -1) return false;
        if (query && p.name.toLowerCase().indexOf(query) === -1) return false;
        return true;
      }).sort(function (a, b) {
        var ta = !!pickedIds[a.id], tb = !!pickedIds[b.id];
        if (ta !== tb) return ta ? 1 : -1;                 // obsazení dolů
        return b.points - a.points || a.name.localeCompare(b.name);
      });

      var free = 0;
      list.forEach(function (p) {
        var taken = !!pickedIds[p.id];
        if (!taken) free++;
        var fits = !current || p.roles.some(function (r) { return needs.indexOf(r) !== -1; });

        var card = el('div.pool-card' + (taken ? '.taken' : ''), {
          style: !taken && !fits ? { opacity: '.45' } : null,
          title: taken ? ('Draftován: ' + AB.team(pickedIds[p.id]).name)
                       : (fits ? 'Kliknutím draftovat' : 'Neumí žádnou z chybějících pozic tohoto týmu'),
          onclick: taken ? null : function () { pickPlayer(p); }
        }, [
          C.rankDot(p.rank),
          el('div', { style: { minWidth: 0 } }, [
            el('div.pool-name', {}, p.name),
            C.roleBadges(p.roles)
          ]),
          el('span.pts', { style: { color: (w.RANKS[p.rank] || {}).color } }, p.points)
        ]);
        poolGrid.appendChild(card);
      });

      if (!list.length) poolGrid.appendChild(el('div.muted', { style: { padding: '20px' } }, 'Nikdo neodpovídá filtru.'));
      poolCount.textContent = free + ' volných z ' + w.POOL.length;
    }

    /* ----- pravý sloupec: týmy + log ----- */
    var teamsBox = el('div.card', { style: { marginBottom: '16px' } }, [el('div.card-t', {}, 'Soupisky')]);
    w.TEAMS.forEach(function (t) {
      var needs = needsOf(t.id);
      var picks = state.picks.filter(function (p) { return p.team === t.id; });
      var isNow = current && current.team === t.id;

      teamsBox.appendChild(el('div', {
        style: {
          padding: '9px 10px', marginBottom: '6px', borderRadius: '0',
          borderLeft: '3px solid ' + t.color,
          background: isNow ? 'rgba(34,211,238,.11)' : 'rgba(255,255,255,.028)'
        }
      }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: picks.length ? '6px' : '0' } }, [
          C.crest(t, 'crest-xs'),
          el('span', { style: { fontWeight: '600', fontSize: '13px' } }, t.name),
          el('span.mono.muted', { style: { marginLeft: 'auto', fontSize: '11px' } }, (4 - needs.length) + '/4')
        ]),
        el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
          AB.ROLE_KEYS.map(function (r) {
            var pid = r === t.captainRole ? t.captain
                    : (picks.filter(function (p) { return p.role === r; })[0] || {}).player;
            return el('span.pill', {
              style: Object.assign({ display: 'inline-flex', alignItems: 'center', gap: '5px' },
                pid ? { color: 'var(--gold-1)' } : { opacity: '.4' }),
              title: (w.ROLES[r] || {}).label
            }, [AB.roleIcon(r, 'sm'), pid ? el('span', {}, AB.player(pid).name) : null].filter(Boolean));
          }))
      ]));
    });
    right.appendChild(teamsBox);

    var log = el('div.card', {}, [el('div.card-t', {}, 'Průběh draftu')]);
    var logBody = el('div.pick-log');
    if (!state.picks.length) {
      logBody.appendChild(el('div.muted', { style: { fontSize: '12.5px', padding: '6px 0' } }, 'Zatím žádný pick.'));
    }
    state.picks.slice().reverse().forEach(function (p, i) {
      var t = AB.team(p.team);
      logBody.appendChild(el('div.pick-log-row', { style: { '--tc': t.color } }, [
        el('span.n', {}, state.picks.length - i),
        C.crest(t, 'crest-xs'),
        el('span', { style: { fontWeight: '600' } }, AB.player(p.player).name),
        el('span', { style: { marginLeft: 'auto' } }, AB.roleIcon(p.role))
      ]));
    });
    log.appendChild(logBody);
    right.appendChild(log);

    renderPool();

    /* ------------------------------------------------------- akce picku -- */

    function pickPlayer(p) {
      if (done) { C.toast('Draft už je dokončený'); return; }
      var needs = needsOf(current.team);
      var options = p.roles.filter(function (r) { return needs.indexOf(r) !== -1; });

      if (!options.length) {
        C.toast(p.name + ' neumí žádnou z chybějících pozic');
        return;
      }
      if (options.length === 1) { commit(p, options[0]); return; }

      var m = C.modal('Na jakou pozici jde ' + p.name + '?', el('div.role-pick-grid', {},
        AB.ROLE_KEYS.map(function (r) {
          var can = options.indexOf(r) !== -1;
          return el('button.role-pick', {
            disabled: !can,
            onclick: function () { m.close(); commit(p, r); }
          }, [
            el('div.ic', {}, AB.roleIcon(r)),
            el('div.nm', {}, (w.ROLES[r] || {}).label),
            el('div.who', {}, can ? 'volné' : (p.roles.indexOf(r) === -1 ? 'neumí' : 'obsazeno'))
          ]);
        })));
    }

    function commit(p, role) {
      var rest = needsOf(current.team).filter(function (r) { return r !== role; });
      var free = w.POOL.filter(function (x) { return !pickedIds[x.id] && x.id !== p.id; });

      if (rest.length && !canFillAll(rest, free)) {
        var names = rest.map(function (r) { return (w.ROLES[r] || {}).label; }).join(' + ');
        if (!confirm(
          'Pozor: když dáš ' + p.name + ' na ' + (w.ROLES[role] || {}).label + ', nezbyde ti nikdo na ' + names + '.\n\n' +
          'Zbývající hráči neumí pokrýt všechny tvoje volné pozice. Chceš to i tak?')) return;
      }

      state.picks.push({ team: current.team, player: p.id, role: role });
      AB.draft.save(state);
      syncDraft();
      C.toast(AB.team(current.team).name + ' bere ' + p.name + ' na ' + (w.ROLES[role] || {}).label);
      AB.reload();
    }

    /* ------------------------------------------------ pozice kapitánů ---- */

    function openCaptainRoles() {
      var body = el('div');
      body.appendChild(el('p.muted', { style: { fontSize: '13px', marginTop: '0' } },
        'Kapitáni s více rolemi si musí vybrat jednu, na které budou hrát. Po prvním picku se to zamkne.'));

      w.TEAMS.forEach(function (t) {
        var cap = AB.player(t.captain);
        body.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--line)' } }, [
          C.crest(t, 'crest-xs'),
          el('span', { style: { fontWeight: '600', minWidth: '110px' } }, cap.name),
          el('div', { style: { display: 'flex', gap: '6px', marginLeft: 'auto' } }, cap.roles.map(function (r) {
            return el('button.filter-btn' + (t.captainRole === r ? '.active' : ''), {
              onclick: function () {
                state.captainRoles = state.captainRoles || {};
                state.captainRoles[t.id] = r;
                AB.draft.save(state);
                syncDraft();
                AB.reload();
                C.toast(cap.name + ' hraje ' + (w.ROLES[r] || {}).label);
              }
            }, (w.ROLES[r] || {}).label);
          }))
        ]));
      });
      C.modal('Pozice kapitánů', body);
    }

    /* ------------------------------------------------------- export ------ */

    function exportTeams() {
      var out = '/* Vygenerováno draft nástrojem AQUABATTLE — ' + new Date().toLocaleString('cs-CZ') + ' */\n\n';
      out += 'window.TEAMS = [\n';
      out += w.TEAMS.map(function (t) {
        var roster = AB.ROLE_KEYS.map(function (r) {
          var v = t.roster[r];
          return '      ' + r + ': ' + (v ? "'" + v + "'" : 'null');
        }).join(',\n');
        return '  {\n' +
          "    id: '" + t.id + "',\n" +
          "    name: '" + t.name + "',\n" +
          "    tag: '" + t.tag + "',\n" +
          "    captain: '" + t.captain + "',\n" +
          "    captainRole: '" + t.captainRole + "',\n" +
          "    color: '" + t.color + "',\n" +
          '    roster: {\n' + roster + '\n    },\n' +
          '    subs: [' + (t.subs || []).map(function (s) { return "'" + s + "'"; }).join(', ') + ']\n' +
          '  }';
      }).join(',\n') + '\n];\n\n';
      out += "window.DRAFT_ORDER = " + JSON.stringify(w.DRAFT_ORDER) + ';\n';
      out += 'window.DRAFT_ROUNDS = ' + w.DRAFT_ROUNDS + ';\n';

      var ta = el('textarea.code-out', { spellcheck: 'false' });
      ta.value = out;

      var body = el('div', {}, [
        el('p', { style: { marginTop: '0', fontSize: '13px', color: 'var(--tx-1)' } },
          'Zkopíruj tohle a přepiš tím celý obsah souboru '),
        el('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } }, [
          el('code.mono', { style: { background: 'var(--void)', padding: '6px 10px', borderRadius: '0', fontSize: '12px' } }, 'data/teams.js'),
          el('button.btn.btn-sm.btn-primary', {
            style: { marginLeft: 'auto' },
            onclick: function () {
              ta.select();
              var ok = false;
              try { ok = document.execCommand('copy'); } catch (e) { /* ignoruj */ }
              if (w.navigator.clipboard) w.navigator.clipboard.writeText(ta.value).catch(function () { });
              C.toast(ok ? 'Zkopírováno do schránky' : 'Označeno — zkopíruj přes Ctrl+C');
            }
          }, '⧉ Kopírovat')
        ]),
        ta
      ]);
      C.modal('Export týmů', body, true);
    }

    return root;
  };

})(window);
