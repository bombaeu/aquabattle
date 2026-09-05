/* ==========================================================================
   AQUABATTLE — řízení draftu (záložka Admin → Draft)
   --------------------------------------------------------------------------
   Všechno, co může s draftem udělat jen pořadatel:

     otevřít lobby pro konkrétní hru · prohodit strany · zahájit draft
     vrátit tah · zrušit draft · zapsat výsledek do zápasu

   Kapitáni tyhle věci na stránce Pick & Ban nevidí — tam jen potvrdí,
   že jsou připravení, a pak draftí.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;

  var draft = null;
  var poll = null;

  AB.draftAdminPanel = function () {
    var box = el('div');

    if (!(AB.api && AB.api.canWrite())) {
      return C.empty('Bez přihlášení', 'Draft může řídit jen přihlášený pořadatel.');
    }

    /* stav se dotahuje ze serveru, ať admin vidí ready kapitánů živě */
    startPoll();

    if (draft === null) {
      box.appendChild(el('div.card', { style: { textAlign: 'center', padding: '30px' } },
        el('span.muted', {}, 'Načítám stav draftu…')));
      return box;
    }

    box.appendChild(draft ? controls() : chooser());
    return box;
  };

  /* --------------------------------------------------------- polling ---- */

  function startPoll() {
    stopPoll();
    fetchState();
    poll = setInterval(fetchState, 1500);
  }

  function stopPoll() { clearInterval(poll); poll = null; }

  var lastRev = -2;
  function fetchState() {
    if (!AB.api.online) return;
    AB.api.getDraft().then(function (j) {
      var rev = j.draft ? j.draft.rev : -1;
      var changed = rev !== lastRev || (!j.draft) !== (!draft);
      draft = j.draft || false;          // false = načteno, ale žádný draft
      lastRev = rev;
      if (changed && onAdminDraftTab()) AB.reload();
    }).catch(function () { /* přechodný výpadek nevadí, zkusí se znovu */ });
  }

  function onAdminDraftTab() {
    return (w.location.hash || '').indexOf('admin') !== -1 && AB.adminTab === 'draft';
  }

  w.addEventListener('hashchange', function () {
    if ((w.location.hash || '').indexOf('admin') === -1) stopPoll();
  });

  /* ------------------------------------------------- výběr zápasu ------- */

  function chooser() {
    var box = el('div');
    var all = AB.allMatches().filter(function (m) { return AB.team(m.a) && AB.team(m.b); });

    if (!all.length) {
      return C.empty('Není co draftovat',
        'Zatím není známý ani jeden pár soupeřů. Doplň soupisky a rozpis.');
    }

    box.appendChild(el('p.muted', { style: { fontSize: '13px', margin: '4px 0 18px' } },
      'Vyber zápas a hru. Otevře se pick lobby, kde se kapitáni potvrdí — pak draft zahájíš.'));

    box.appendChild(el('div.grid', { style: { gap: '10px' } }, all.map(function (m) {
      var ta = AB.team(m.a), tb = AB.team(m.b);
      var odehrano = (m.games || []).length;

      /* kolik her série vůbec může mít — skupina jedna, finále pět */
      var pocetHer = AB.seriesFormat(m).bestOf;
      var her = [];
      for (var i = 1; i <= pocetHer; i++) her.push(i);

      var volby = el('div', { style: { display: 'flex', gap: '5px', justifyContent: 'center' } },
        her.map(function (n) {
          return el('button.btn.btn-sm' + (n === odehrano + 1 ? '.btn-primary' : ''), {
            title: 'Otevřít lobby pro hru ' + n + (n <= odehrano ? ' (už je zapsaná — přepíše se)' : ''),
            onclick: function (e) {
              e.stopPropagation();
              open(m, n);
            }
          }, 'Hra ' + n);
        }));

      return el('div.match', { style: { cursor: 'default' } }, [
        el('div.match-side', {}, [C.crest(ta, 'crest-sm'), el('div.nm', {}, ta.name)]),
        el('div', {}, [
          volby,
          el('div.match-meta', {}, (m.label || (m.round + '. kolo')) + ' · ' +
            AB.seriesFormat(m).label + ' · ' + odehrano + ' odehráno')
        ]),
        el('div.match-side.right', {}, [C.crest(tb, 'crest-sm'), el('div.nm', {}, tb.name)])
      ]);
    })));

    return box;

    function open(m, gameNo) {
      var ta = AB.team(m.a), tb = AB.team(m.b);
      var captains = {};
      captains[m.a] = ta.captain;
      captains[m.b] = tb.captain;

      var payload = { matchId: m.id, gameNo: gameNo, blue: m.a, red: m.b, captains: captains };

      // U druhé a třetí hry si stranu bere vítěz té předchozí, mincí se hází
      // jen před první hrou. Když výsledek ještě není zapsaný, zůstane hod.
      var predchozi = gameNo > 1 ? AB.gameWinnerTeam(m, gameNo - 1) : null;
      if (predchozi) payload.sideTeam = predchozi;

      AB.api.draftAction('open', payload).then(function () {
        lastRev = -2; fetchState();
        C.toast('Lobby otevřeno — kapitáni se můžou potvrdit');
      }).catch(function (e) { C.toast('Nepodařilo se: ' + e.message); });
    }
  }

  /* ------------------------------------- hod mincí a volba stran -------- */

  function doAction(action, payload, msg) {
    AB.api.draftAction(action, payload)
      .then(function () { lastRev = -2; fetchState(); AB.reload(); if (msg) C.toast(msg); })
      .catch(function (e) { C.toast(e.message); });
  }

  function choiceCard(d, blueTeam, redTeam) {
    var c = d.choice || {};
    var box = el('div.card', { style: { marginBottom: '16px' } });
    box.appendChild(el('div.card-t', {}, 'Strany a pořadí pickování'));

    /* ještě se nerozhodlo, kdo si bere stranu */
    if (!c.sideTeam) {
      box.appendChild(el('p.muted', { style: { fontSize: '12.5px', margin: '0 0 12px' } },
        d.gameNo > 1
          ? 'Výsledek předchozí hry zatím není zapsaný, takže rozhodne mince — nebo vítěze urči rovnou.'
          : 'Hoď mincí. Vítěz si vybere stranu, druhý tým pořadí pickování.'));

      box.appendChild(el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap' } },
        [
          el('button.btn.btn-primary', {
            onclick: function () { doAction('coin', null, 'Hodeno'); }
          }, '🪙 Hodit mincí')
        ].concat([blueTeam, redTeam].map(function (t) {
          return el('button.btn.btn-sm', {
            onclick: function () { doAction('coin', { sideTeam: t.id }, t.name + ' si bere stranu'); }
          }, 'Stranu bere ' + t.name);
        }))));
      return box;
    }

    var sideTeam = AB.team(c.sideTeam) || { id: c.sideTeam, name: c.sideTeam, color: '#888' };
    var orderTeam = AB.team(c.orderTeam) || { id: c.orderTeam, name: c.orderTeam, color: '#888' };

    box.appendChild(el('p.muted', { style: { fontSize: '12.5px', margin: '0 0 12px' } },
      (c.from === 'previous' ? 'Podle výsledku minulé hry' : 'Hod mincí') +
      ' — stranu si bere ' + sideTeam.name + ', pořadí pickování ' + orderTeam.name + '.'));

    /* Admin může vybrat za kapitány, kdyby některý nebyl u počítače. */
    var radek = function (team, popis, hodnota, volby) {
      return el('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px',
          marginBottom: '6px', background: 'rgba(0,0,0,.3)',
          borderLeft: '3px solid ' + team.color
        }
      }, [
        C.crest(team, 'crest-xs'),
        el('span', { style: { fontWeight: '600', fontSize: '13px' } }, team.name),
        el('span.muted', { style: { fontSize: '12px' } }, popis),
        hodnota
          ? el('span', {
              style: {
                marginLeft: 'auto', fontSize: '12px', fontWeight: '700',
                letterSpacing: '.08em', color: 'var(--win)'
              }
            }, '✓ ' + hodnota)
          : el('span', { style: { marginLeft: 'auto', display: 'flex', gap: '6px' } }, volby)
      ]);
    };

    box.appendChild(radek(sideTeam, 'strana',
      c.side ? (c.side === 'blue' ? 'MODRÁ' : 'ČERVENÁ') : null,
      [['blue', 'Modrá'], ['red', 'Červená']].map(function (o) {
        return el('button.btn.btn-sm', {
          onclick: function () { doAction('side', { side: o[0] }, sideTeam.name + ' → ' + o[1]); }
        }, o[1]);
      })));

    box.appendChild(radek(orderTeam, 'pořadí',
      c.order ? (c.order === 'first' ? 'FIRST PICK' : 'LAST PICK') : null,
      [['first', 'First pick'], ['last', 'Last pick']].map(function (o) {
        return el('button.btn.btn-sm', {
          onclick: function () { doAction('order', { order: o[0] }, orderTeam.name + ' → ' + o[1]); }
        }, o[1]);
      })));

    if (!c.side && !c.order) {
      box.appendChild(el('button.btn.btn-sm.btn-ghost', {
        style: { marginTop: '4px' },
        onclick: function () { doAction('coin', null, 'Hodeno znovu'); }
      }, '↻ Hodit znovu'));
    }

    return box;
  }

  /* ------------------------------ kdo hraje kterého championa ----------- */

  function assignCard(d, blueTeam, redTeam) {
    var box = el('div.card', { style: { marginBottom: '16px' } });
    box.appendChild(el('div.card-t', {}, 'Kdo hraje kterého championa'));
    box.appendChild(el('p.muted', { style: { fontSize: '12.5px', margin: '0 0 14px' } },
      'Pickuje se podle toho, co soupeř nechá, ne podle pozic — tak si to tu srovnej, ' +
      'než to zapíšeš. Když sáhneš po hráči, který už někde je, oba se prohodí.'));

    box.appendChild(el('div.grid.g-2', {}, [blueTeam, redTeam].map(function (t) {
      return teamAssign(d, t);
    })));
    return box;
  }

  function teamAssign(d, team) {
    var side = d.blue === team.id ? 'blue' : 'red';
    var picks = AB.draftPicksOf(d, side);
    var poradi = ((d.assign || {})[team.id] || AB.draftDefaultAssign(team.id)).slice();
    var hraci = AB.ROLE_KEYS.map(function (r) { return team.roster[r]; }).filter(Boolean);

    var box = el('div', {}, [
      el('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
          paddingBottom: '7px', borderBottom: '1px solid var(--line)'
        }
      }, [
        C.crest(team, 'crest-xs'),
        el('span', { style: { fontWeight: '700', fontSize: '13px' } }, team.name),
        el('span.muted', { style: { fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase' } },
          side === 'blue' ? 'modrá' : 'červená')
      ])
    ]);

    picks.forEach(function (champ, i) {
      if (!champ) return;
      box.appendChild(el('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '6px 8px', marginBottom: '5px', background: 'rgba(0,0,0,.3)'
        }
      }, [
        AB.champImg(champ, 'champ-ic sm'),
        el('span', { style: { fontSize: '12.5px', fontWeight: '600' } }, champ),
        el('span.muted', { style: { fontSize: '10.5px' } }, (i + 1) + '. pick'),
        el('select.search', {
          style: { marginLeft: 'auto', padding: '5px 7px', fontSize: '12px', maxWidth: '140px' },
          onchange: function (e) { prehod(i, e.target.value); }
        }, hraci.map(function (pid) {
          return el('option', { value: pid, selected: poradi[i] === pid }, AB.player(pid).name);
        }))
      ]));
    });

    if (!hraci.length) {
      box.appendChild(el('p.muted', { style: { fontSize: '12px' } },
        'Tenhle tým nemá zaplněnou soupisku — doplň ji v záložce Soupisky.'));
    }

    return box;

    /** Přiřadí hráče k picku. Když už někde je, vymění si místo. */
    function prehod(i, pid) {
      var novy = poradi.slice();
      var kde = novy.indexOf(pid);
      if (kde !== -1) novy[kde] = novy[i];
      novy[i] = pid;
      doAction('assign', { team: team.id, slots: novy }, null);
    }
  }

  /* ------------------------------------------------------- ovládání ----- */

  function controls() {
    var d = draft;
    var box = el('div');
    var blueTeam = AB.team(d.blue), redTeam = AB.team(d.red);
    if (!blueTeam || !redTeam) {
      return C.empty('Neznámé týmy', 'Draft odkazuje na tým, který v datech není.');
    }

    var caps = [d.blue, d.red].map(function (t) { return (d.captains || {})[t]; }).filter(Boolean);
    var readyCount = caps.filter(function (c) { return (d.ready || {})[c]; }).length;
    var inLobby = d.status === 'lobby';
    var hotovo = d.steps.length >= 20;

    /* hlavička */
    box.appendChild(el('div.card', { style: { marginBottom: '16px' } }, [
      el('div.card-t', {}, inLobby ? 'Pick lobby' : (hotovo ? 'Draft dokončen' : 'Draft běží')),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } }, [
        C.crest(blueTeam, 'crest-sm'),
        el('span', { style: { fontFamily: 'var(--font-head)', fontSize: '17px', color: 'var(--gold-1)' } },
          blueTeam.name + ' vs ' + redTeam.name),
        C.crest(redTeam, 'crest-sm'),
        el('span.pill', { style: { marginLeft: 'auto' } }, 'Hra ' + d.gameNo),
        el('span.pill', {}, d.steps.length + '/20 tahů')
      ])
    ]));

    /* stav kapitánů */
    box.appendChild(el('div.card', { style: { marginBottom: '16px' } }, [
      el('div.card-t', {}, 'Kapitáni'),
      el('div', {}, ['blue', 'red'].map(function (side) {
        var team = side === 'blue' ? blueTeam : redTeam;
        var capId = (d.captains || {})[team.id];
        var ready = capId && (d.ready || {})[capId];
        return el('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px',
            marginBottom: '6px', borderLeft: '3px solid ' + team.color,
            background: 'rgba(0,0,0,.3)'
          }
        }, [
          C.crest(team, 'crest-xs'),
          el('span', { style: { fontWeight: '600', fontSize: '13px' } }, team.name),
          el('span.muted', { style: { fontSize: '12px' } },
            capId ? AB.player(capId).name : 'bez kapitána'),
          el('span.muted', { style: { fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase' } },
            side === 'blue' ? 'modrá' : 'červená'),
          el('span', {
            style: {
              marginLeft: 'auto', fontSize: '11px', fontWeight: '700', letterSpacing: '.1em',
              color: ready ? 'var(--win)' : 'var(--tx-2)'
            }
          }, ready ? '✓ PŘIPRAVEN' : (inLobby ? 'čeká se…' : '—'))
        ]);
      }))
    ]));

    if (inLobby) box.appendChild(choiceCard(d, blueTeam, redTeam));
    if (hotovo) box.appendChild(assignCard(d, blueTeam, redTeam));

    /* akce */
    var akce = el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap' } });
    var c = d.choice || {};
    var volbaHotova = !!(c.side && c.order);

    if (inLobby) {
      akce.appendChild(el('button.btn.btn-primary', {
        disabled: !volbaHotova,
        title: volbaHotova ? '' : 'Nejdřív musí padnout strana i pořadí pickování',
        onclick: function () {
          if (readyCount < caps.length &&
              !confirm('Zatím se potvrdil jen ' + readyCount + ' z ' + caps.length +
                       ' kapitánů.\n\nZahájit draft i tak?')) return;
          act('begin', null, 'Draft zahájen');
        }
      }, readyCount === caps.length && caps.length ? '▶ Zahájit draft' : '▶ Zahájit i tak'));

      akce.appendChild(el('button.btn', {
        onclick: function () { act('swap', null, 'Strany prohozeny'); }
      }, '⇄ Prohodit strany'));
    } else {
      akce.appendChild(el('button.btn', {
        disabled: !d.steps.length,
        onclick: function () { act('undo', null, 'Tah vrácen'); }
      }, '↶ Vrátit tah'));

      if (hotovo) {
        akce.appendChild(el('button.btn.btn-primary', {
          onclick: function (e) {
            var btn = e.currentTarget;
            btn.disabled = true;
            AB.draftSaveToMatch(d)
              .then(function (gameNo) {
                C.toast('Zapsáno do hry ' + gameNo);
                draft = false; lastRev = -2;
                AB.reload();
              })
              .catch(function (err) { C.toast('Nezapsáno: ' + err.message); btn.disabled = false; });
          }
        }, '↓ Zapsat do zápasu'));
      }
    }

    akce.appendChild(el('button.btn.btn-danger.btn-ghost', {
      style: { marginLeft: 'auto' },
      onclick: function () {
        if (!confirm('Zrušit draft?\n\n' +
          (d.steps.length ? 'Přijdeš o ' + d.steps.length + ' odehraných tahů. ' : '') +
          'Uvidí to i kapitáni a diváci.')) return;
        act('cancel', null, 'Draft zrušen');
      }
    }, '✕ Zrušit draft'));

    box.appendChild(akce);

    box.appendChild(el('p.muted', { style: { fontSize: '12.5px', marginTop: '16px', lineHeight: '1.6' } },
      inLobby
        ? 'Kapitáni se potvrzují na stránce Pick & Ban. Až budou oba připravení, zahaj draft.'
        : 'Průběh draftu sleduj na stránce Pick & Ban — tam se dá i klikat za kapitána, kdyby vypadl.'));

    if (!inLobby) {
      box.appendChild(el('a.btn.btn-sm', { href: '#/pickban', style: { marginTop: '10px' } },
        'Otevřít desku draftu →'));
    }

    return box;

    function act(action, payload, msg) {
      AB.api.draftAction(action, payload)
        .then(function () { lastRev = -2; fetchState(); AB.reload(); C.toast(msg); })
        .catch(function (e) { C.toast(e.message); });
    }
  }

})(window);
