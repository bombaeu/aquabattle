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

  /* Fáze pro přehlednost — index prvního tahu -> název. */
  var PHASES = [
    { from: 0,  to: 5,  label: 'Ban fáze 1',  short: 'BANY 1' },
    { from: 6,  to: 11, label: 'Pick fáze 1', short: 'PICKY 1' },
    { from: 12, to: 15, label: 'Ban fáze 2',  short: 'BANY 2' },
    { from: 16, to: 19, label: 'Pick fáze 2', short: 'PICKY 2' }
  ];

  function phaseOf(i) {
    for (var p = 0; p < PHASES.length; p++) if (i >= PHASES[p].from && i <= PHASES[p].to) return PHASES[p];
    return null;
  }

  /** Kolikátý pick dané strany je tah `i` (0-4), nebo -1 když je to ban. */
  function pickIndexAt(i) {
    if (SEQUENCE[i].type !== 'pick') return -1;
    var side = SEQUENCE[i].side, n = 0;
    for (var k = 0; k < i; k++) if (SEQUENCE[k].side === side && SEQUENCE[k].type === 'pick') n++;
    return n;
  }

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
      root.appendChild(waitingPanel());
      return root;
    }

    // lobby: čeká se, až se kapitáni odkliknou a pořadatel to zahájí
    root.appendChild(state.draft.status === 'lobby' ? lobbyPanel() : board());
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
      me && myTeams().length
        ? el('button.btn.btn-sm', { style: { marginLeft: 'auto' }, onclick: openPreferences }, 'Preference týmu')
        : null,
      me
        ? el('button.btn.btn-sm.btn-ghost', {
            style: myTeams().length ? null : { marginLeft: 'auto' },
            onclick: function () { AB.api.logout(); lastRev = -1; poll(); AB.reload(); }
          }, 'Odhlásit')
        : el('button.btn.btn-sm', { style: { marginLeft: 'auto' }, onclick: openLogin }, 'Přihlásit se jako kapitán')
    ].filter(Boolean));

    return bar;
  }

  /* =============================================== preference championů == */

  /** Týmy, jejichž preference smím editovat. */
  function myTeams() {
    if (isAdmin()) return w.TEAMS.slice();
    var cid = myCaptainId();
    return cid ? w.TEAMS.filter(function (t) { return t.captain === cid; }) : [];
  }

  function openPreferences() {
    var teams = myTeams();
    if (!teams.length) { C.toast('Nemáš žádný tým'); return; }

    var body = el('div');
    body.appendChild(el('p.muted', { style: { marginTop: 0, fontSize: '13px', lineHeight: '1.6' } },
      'Nastav každému hráči, co obvykle hraje. Během draftu se ti tihle championi ' +
      'zvýrazní, jakmile přijde pick na jeho pozici — vybrat můžeš pořád i cokoliv jiného.'));

    teams.forEach(function (t) {
      if (teams.length > 1) {
        body.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '18px 0 8px' } }, [
          C.crest(t, 'crest-xs'),
          el('span', { style: { fontWeight: '600', fontSize: '13px', color: 'var(--gold-1)' } }, t.name)
        ]));
      }
      AB.ROLE_KEYS.forEach(function (r) {
        var pid = t.roster[r];
        if (!pid) return;
        body.appendChild(prefRow(pid, r));
      });
    });

    C.modal('Preference týmu', body, true);
  }

  /** Jeden řádek: hráč + jeho championi + přidávání. */
  function prefRow(pid, role) {
    var row = el('div.pb-pref-row');
    var chips = el('div.pb-pref-chips');

    function list() { return ((w.PREFERENCES || {})[pid] || []).slice(); }

    function save(next) {
      w.PREFERENCES = w.PREFERENCES || {};
      if (next.length) w.PREFERENCES[pid] = next; else delete w.PREFERENCES[pid];
      paint();
      AB.api.savePreferences(pid, next)
        .catch(function (e) { C.toast('Neuloženo: ' + e.message); });
    }

    function paint() {
      AB.clear(chips);
      var cur = list();
      if (!cur.length) chips.appendChild(el('span.muted', { style: { fontSize: '11.5px' } }, 'zatím nic'));
      cur.forEach(function (champ) {
        chips.appendChild(el('span.pb-pref-chip', {}, [
          AB.champImg(champ, 'champ-ic sm'),
          el('span', {}, champName(champ)),
          el('button.icon-btn', {
            title: 'Odebrat',
            onclick: function () { save(list().filter(function (x) { return x !== champ; })); }
          }, '✕')
        ]));
      });
    }

    var input = el('input.search', {
      type: 'search', placeholder: 'Přidat championa…',
      style: { flex: '0 0 190px' },
      list: 'champ-list-' + pid,
      onchange: function (e) {
        var name = e.target.value.trim().toLowerCase();
        var found = (w.CHAMPIONS || []).filter(function (c) { return c.name.toLowerCase() === name; })[0];
        if (!found) { C.toast('Takového championa neznám'); return; }
        var cur = list();
        if (cur.indexOf(found.id) !== -1) { C.toast('Už tam je'); e.target.value = ''; return; }
        save(cur.concat([found.id]));
        e.target.value = '';
      }
    });

    // našeptávač jen z championů, co danou pozici hrají
    var dl = el('datalist#champ-list-' + pid, {},
      (w.CHAMPIONS || []).filter(function (c) { return (c.lanes || []).indexOf(role) !== -1; })
        .map(function (c) { return el('option', { value: c.name }); }));

    row.appendChild(el('div.pb-pref-who', {}, [
      AB.roleIcon(role, 'sm'),
      el('span', {}, AB.player(pid).name)
    ]));
    row.appendChild(chips);
    row.appendChild(input);
    row.appendChild(dl);
    paint();
    return row;
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
      isAdmin()
        ? 'Draft se otevírá v Admin → Draft. Vybereš tam zápas a hru, kapitáni se potvrdí a ty to zahájíš.'
        : 'Jakmile pořadatel otevře draft, objeví se tady sám od sebe — stránku obnovovat nemusíš.',
      isAdmin() ? el('a.btn.btn-primary', { href: '#/admin' }, 'Otevřít admin') : null);
  }

  /* ------------------------------------------------------------ lobby --- */

  function lobbyPanel() {
    var d = state.draft;
    var box = el('div');
    var blueTeam = AB.team(d.blue), redTeam = AB.team(d.red);
    if (!blueTeam || !redTeam) return C.empty('Neznámé týmy', 'Draft odkazuje na tým, který v datech není.');

    var meCap = myCaptainId();
    var iAmIn = meCap && draftCaptains().indexOf(meCap) !== -1;
    var imReady = meCap && (d.ready || {})[meCap];

    box.appendChild(el('div.pb-lobby-head', {}, [
      el('div.eyebrow', {}, 'Pick lobby'),
      el('h2', {}, blueTeam.name + '  vs  ' + redTeam.name),
      el('div.muted', { style: { fontSize: '13px', marginTop: '5px' } },
        'Hra ' + d.gameNo + ' · čeká se na potvrzení kapitánů')
    ]));

    /* dvě karty kapitánů se stavem */
    box.appendChild(el('div.pb-lobby', {}, ['blue', 'red'].map(function (side) {
      var team = side === 'blue' ? blueTeam : redTeam;
      var capId = (d.captains || {})[team.id];
      var ready = capId && (d.ready || {})[capId];
      var isMe = capId && capId === meCap;

      return el('div.pb-lobby-card' + (ready ? '.ready' : ''), { style: { '--tc': team.color } }, [
        el('div.pb-lobby-side', {}, side === 'blue' ? 'Modrá strana' : 'Červená strana'),
        C.crest(team, 'team-crest'),
        el('div.pb-lobby-team', {}, team.name),
        el('div.pb-lobby-cap', {}, capId ? AB.player(capId).name : 'bez kapitána'),
        el('div.pb-lobby-state' + (ready ? '.ok' : ''), {},
          ready ? '✓ PŘIPRAVEN' : 'čeká se…'),
        isMe ? el('span.badge.badge-cap', {}, 'TY') : null
      ].filter(Boolean));
    })));

    /* tlačítko jen pro kapitána, který v draftu opravdu hraje */
    if (iAmIn) {
      box.appendChild(el('div', { style: { textAlign: 'center', marginTop: '22px' } }, [
        el('button.btn' + (imReady ? '' : '.btn-primary'), {
          style: { padding: '13px 30px', fontSize: '13px' },
          onclick: function () { act('ready', { ready: !imReady }); }
        }, imReady ? '✕ Přece jen ještě ne' : '✓ Jsem připraven'),
        el('div.muted', { style: { fontSize: '12px', marginTop: '10px' } },
          imReady ? 'Čeká se na soupeře a na pořadatele.' : 'Potvrď, až budeš mít rozmyšlené bany.')
      ]));
    } else if (meCap) {
      box.appendChild(el('p.muted', { style: { textAlign: 'center', marginTop: '20px', fontSize: '13px' } },
        'V tomhle draftu nehraješ — můžeš ho jen sledovat.'));
    } else {
      box.appendChild(el('p.muted', { style: { textAlign: 'center', marginTop: '20px', fontSize: '13px' } },
        state.me ? 'Draft zahájí pořadatel v admin panelu.'
                 : 'Jsi divák. Draft se tu rozjede sám, jakmile ho pořadatel zahájí.'));
    }

    /* náhled preferencí ještě před začátkem */
    if (iAmIn) {
      box.appendChild(el('div', { style: { textAlign: 'center', marginTop: '14px' } },
        el('button.btn.btn-sm.btn-ghost', { onclick: openPreferences }, 'Zkontrolovat preference týmu')));
    }

    return box;
  }

  /** Kapitáni, kteří v aktuálním draftu hrají. */
  function draftCaptains() {
    var d = state.draft;
    if (!d) return [];
    return [d.blue, d.red].map(function (tid) { return (d.captains || {})[tid]; }).filter(Boolean);
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
    var onTurn = current && myTurn(current);

    /* Ovládání draftu (zpět, strany, zrušení, zápis) je schválně jen
       v admin panelu — kapitánům se tady nesmí objevit. */

    /* ---- kdo je na tahu ---- */
    var targetPlayer = null;      // pro pick: komu champion patří
    if (done) {
      box.appendChild(el('div.notice', {}, el('span', {}, [
        el('b', {}, 'Draft dokončen. '),
        isAdmin()
          ? 'Zapsat do zápasu můžeš v Admin → Draft.'
          : 'Čeká se na pořadatele, až výsledek zapíše.'
      ])));
    } else {
      var side = current.side === 'blue' ? blueTeam : redTeam;
      var phase = phaseOf(idx);
      var pi = pickIndexAt(idx);
      if (pi >= 0) targetPlayer = (side.roster || {})[AB.ROLE_KEYS[pi]] || null;

      box.appendChild(el('div.onclock.pb-onclock', { style: { '--tc': side.color } }, [
        el('span.team-crest', { style: { background: side.color } }, side.tag),
        el('div', { style: { minWidth: 0 } }, [
          el('div.pb-phase', {}, [
            el('span.pb-phase-tag' + (current.type === 'ban' ? '.ban' : '.pick'), {},
              current.type === 'ban' ? 'BAN' : 'PICK'),
            el('span', {}, phase ? phase.label : ''),
            el('span.muted', {}, 'tah ' + (idx + 1) + '/' + SEQUENCE.length)
          ]),
          el('div.who', {}, side.name + (current.type === 'ban' ? ' banuje' : ' pická')),
          el('div.rnd', {}, onTurn
            ? (current.type === 'ban' ? 'JSI NA TAHU — vyber, koho zabanovat'
                                      : 'JSI NA TAHU — vyber championa' +
                                        (targetPlayer ? ' pro ' + AB.player(targetPlayer).name : ''))
            : (targetPlayer ? 'pozice ' + (w.ROLES[AB.ROLE_KEYS[pi]] || {}).label + ' · ' + AB.player(targetPlayer).name
                            : 'čeká se na soupeře'))
        ]),
        el('div#pb-clock.pb-clock', {}, '–')
      ]));
    }

    /* ---- časová osa všech 20 tahů ---- */
    box.appendChild(timeline(d, idx, blueTeam, redTeam));

    /* ---- tři sloupce ---- */
    var layout = el('div.pb-layout');
    layout.appendChild(sideColumn(d, 'blue', blueTeam, current));
    layout.appendChild(championGrid(d, taken, current, done, onTurn, targetPlayer));
    layout.appendChild(sideColumn(d, 'red', redTeam, current));
    box.appendChild(layout);

    setTimeout(paintClock, 0);
    return box;
  }

  /* ---- časová osa: všech 20 tahů po fázích, aby bylo vidět co se děje ---- */
  function timeline(d, idx, blueTeam, redTeam) {
    var wrap = el('div.pb-timeline');

    PHASES.forEach(function (ph) {
      var group = el('div.pb-phase-group' + (idx >= ph.from && idx <= ph.to ? '.now' : ''));
      group.appendChild(el('div.pb-phase-label', {}, ph.short));

      var row = el('div.pb-phase-steps');
      for (var i = ph.from; i <= ph.to; i++) {
        var step = d.steps[i];
        var seq = SEQUENCE[i];
        var team = seq.side === 'blue' ? blueTeam : redTeam;
        var cls = '.pb-step.' + seq.type;
        if (i < idx) cls += '.done';
        else if (i === idx) cls += '.current';

        var pi = pickIndexAt(i);
        var owner = pi >= 0 ? (team.roster || {})[AB.ROLE_KEYS[pi]] : null;
        var tip = team.name + ' · ' + (seq.type === 'ban' ? 'ban' : 'pick') +
          (owner ? ' · ' + AB.player(owner).name : '') +
          (step ? ' · ' + champName(step.champ) : '');

        row.appendChild(el('div' + cls, { style: { '--tc': team.color }, title: tip },
          step ? AB.champImg(step.champ, 'pb-step-img') : el('span.pb-step-n', {}, i + 1)));
      }
      group.appendChild(row);
      wrap.appendChild(group);
    });

    return wrap;
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

  function championGrid(d, taken, current, done, onTurn, targetPlayer) {
    if (!gridCache) buildGrid();

    gridCache.onPick = function (champId) {
      if (done || !onTurn) return;
      act('pick', { champ: champId });
    };

    var locked = done || !onTurn;
    gridCache.wrap.classList.toggle('locked', locked);

    /* Přednastavení hráče, na kterého zrovna přišla řada — zvýrazní se v mřížce. */
    var prefs = {};
    if (targetPlayer) {
      ((w.PREFERENCES || {})[targetPlayer] || []).forEach(function (c) { prefs[c] = true; });
    }
    var prefCount = Object.keys(prefs).length;

    gridCache.hint.textContent = done
      ? 'Draft je hotový.'
      : !onTurn
        ? 'Čeká se na soupeře — klikat můžeš, až budeš na tahu.'
        : (current && current.type === 'ban')
          ? 'Vyber championa, kterého chceš zabanovat.'
          : targetPlayer
            ? (prefCount
                ? 'Zvýraznění = co hraje ' + AB.player(targetPlayer).name + '. Vybrat můžeš i cokoliv jiného.'
                : AB.player(targetPlayer).name + ' nemá nastavené preference.')
            : '';

    // při picku předvyber roli hráče, ať kapitán nemusí hledat
    if (targetPlayer && current && current.type === 'pick' && gridCache.autoRole !== targetPlayer) {
      gridCache.autoRole = targetPlayer;
      var pi = pickIndexAt(d.steps.length);
      if (pi >= 0) gridCache.setRole(AB.ROLE_KEYS[pi]);
    }
    if (!targetPlayer) gridCache.autoRole = null;

    Object.keys(gridCache.btns).forEach(function (id) {
      var btn = gridCache.btns[id];
      var isTaken = !!taken[id];
      btn.classList.toggle('taken', isTaken);
      btn.classList.toggle('preferred', !!prefs[id] && !isTaken);
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

    var search = el('input.search', { type: 'search', placeholder: 'Hledat championa…' });

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

    var query = '', role = 'ALL';

    /** Filtr jen schovává, nemaže — obrázky tak zůstanou načtené. */
    function filter() {
      var shown = 0;
      (w.CHAMPIONS || []).forEach(function (c) {
        var hitName = !query || c.name.toLowerCase().indexOf(query) !== -1;
        var hitRole = role === 'ALL' || (c.lanes || []).indexOf(role) !== -1;
        var hit = hitName && hitRole;
        btns[c.id].style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      count.textContent = shown + ' z ' + (w.CHAMPIONS || []).length;
    }

    /* filtr podle pozice — ikonky stejné jako v soupiskách */
    var roleBtns = {};
    var roleBar = el('div.pb-roles');
    ['ALL'].concat(AB.ROLE_KEYS).forEach(function (r) {
      var b = el('button.filter-btn' + (r === 'ALL' ? '.active' : ''), {
        title: r === 'ALL' ? 'Všichni championi' : w.ROLES[r].label,
        onclick: function () { setRole(r); }
      }, r === 'ALL' ? 'Vše' : AB.roleIcon(r));
      roleBtns[r] = b;
      roleBar.appendChild(b);
    });

    function setRole(r) {
      role = r;
      Object.keys(roleBtns).forEach(function (k) { roleBtns[k].classList.toggle('active', k === r); });
      filter();
    }

    search.addEventListener('input', function (e) {
      query = e.target.value.toLowerCase().trim();
      filter();
    });

    wrap.appendChild(el('div.pool-filters', { style: { marginBottom: '8px' } }, [search, count]));
    wrap.appendChild(roleBar);
    wrap.appendChild(hint);
    wrap.appendChild(grid);
    filter();

    gridCache = {
      wrap: wrap, btns: btns, count: count, search: search, hint: hint,
      setRole: setRole, autoRole: null, onPick: null
    };
  }

  /* ------------------------------------------------------------ zápis --- */

  /**
   * Zapíše hotový draft do příslušné hry v rozpisu.
   * Volá to admin panel — tady žije proto, že zná pořadí tahů.
   */
  AB.draftSaveToMatch = function (d) {
    var m = AB.allMatches().filter(function (x) { return x.id === d.matchId; })[0];
    if (!m) return Promise.reject(new Error('zápas ' + d.matchId + ' nenalezen'));
    return saveToMatch(d, m);
  };

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

    return AB.api.saveMatches()
      .then(function () { return AB.api.draftAction('clear'); })
      .then(function () {
        state.draft = null;
        lastRev = -1;
        return d.gameNo;
      });
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
