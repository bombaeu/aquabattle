/* ==========================================================================
   AQUABATTLE — zápis výsledků (záložka Admin → Výsledky)
   --------------------------------------------------------------------------
   Vybereš sérii, přidáš hru a vyplníš scoreboard. Sestavy se předvyplní ze
   soupisek, takže doplňuješ jen championa a čísla z end-game obrazovky.

   Skóre série se nikde nezadává — dopočítá se z vyhraných her.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB, el = AB.el, C = AB.ui;

  var openId = null;         // rozbalená série

  AB.resultsPanel = function () {
    var box = el('div');

    box.appendChild(el('p.muted', { style: { fontSize: '13px', margin: '4px 0 20px' } },
      'Klikni na sérii, přidej hru a přepiš čísla z end-game screenu. Ukládá se okamžitě.'));

    var po = AB.resolvedPlayoffs();

    box.appendChild(el('div.section-head', { style: { marginTop: 0 } }, [
      el('h2', {}, 'Skupina'),
      el('span.muted', { style: { fontSize: '12px', marginLeft: 'auto' } },
        w.SCHEDULE.filter(AB.isPlayed).length + ' z ' + w.SCHEDULE.length + ' odehráno')
    ]));
    box.appendChild(el('div.grid', { style: { gap: '10px' } }, w.SCHEDULE.map(function (m) { return seriesRow(m, false); })));

    box.appendChild(el('div.section-head', { style: { marginTop: '34px' } }, [el('h2', {}, 'Playoff')]));
    box.appendChild(el('div.grid', { style: { gap: '10px' } }, w.PLAYOFFS.map(function (stored, i) {
      // rozpis playoffu zná soupeře až z tabulky, ale zapisuje se do uloženého objektu
      if (!stored.a && po[i]) stored.a = po[i].a;
      if (!stored.b && po[i]) stored.b = po[i].b;
      return seriesRow(stored, true);
    })));

    return box;

    /* ------------------------------------------------------- řádek série -- */

    function seriesRow(m, isPlayoff) {
      var ta = AB.team(m.a), tb = AB.team(m.b);
      var sc = AB.seriesScore(m);
      var isOpen = openId === m.id;

      var head = el('div.match', {
        style: isOpen ? { borderColor: 'var(--gold-2)' } : null,
        onclick: function () { openId = isOpen ? null : m.id; AB.reload(); }
      }, [
        el('div.match-side', {}, [
          C.crest(ta, 'crest-sm'),
          el('div.nm', {}, ta ? ta.name : 'TBD')
        ]),
        el('div', {}, [
          el('div.match-score', {}, [
            el('span' + (sc[0] < sc[1] ? '.lo' : ''), {}, sc[0]),
            el('span.sep', {}, ':'),
            el('span' + (sc[1] < sc[0] ? '.lo' : ''), {}, sc[1])
          ]),
          el('div.match-meta', {}, (isPlayoff ? m.label : m.round + '. kolo') + ' · ' + (m.games || []).length + ' her')
        ]),
        el('div.match-side.right', {}, [
          C.crest(tb, 'crest-sm'),
          el('div.nm', {}, tb ? tb.name : 'TBD')
        ])
      ]);

      if (!isOpen) return head;

      var panel = el('div.card', { style: { marginTop: '-4px', borderTopLeftRadius: 0, borderTopRightRadius: 0 } });

      if (!ta || !tb) {
        panel.appendChild(el('div.muted', { style: { fontSize: '13px' } },
          'Soupeři nejsou známí — nejdřív musí být dohraná skupina.'));
        return el('div', {}, [head, panel]);
      }

      (m.games || []).forEach(function (g, gi) {
        panel.appendChild(gameEditor(m, g, gi));
      });

      panel.appendChild(el('div', { style: { display: 'flex', gap: '9px', marginTop: '14px', flexWrap: 'wrap' } }, [
        el('button.btn.btn-sm.btn-primary', {
          disabled: (m.games || []).length >= 3,
          onclick: function () {
            m.games = (m.games || []).concat([blankGame(m)]);
            m.status = 'done';
            save('Hra ' + m.games.length + ' přidána');
          }
        }, '+ Přidat hru'),
        (m.games || []).length ? el('button.btn.btn-sm.btn-danger.btn-ghost', {
          onclick: function () {
            if (!confirm('Smazat poslední hru téhle série?')) return;
            m.games.pop();
            if (!m.games.length) m.status = 'scheduled';
            save('Hra smazána');
          }
        }, '✕ Smazat poslední hru') : null,
        el('input.search', {
          type: 'datetime-local',
          value: m.date ? String(m.date).slice(0, 16) : '',
          style: { maxWidth: '210px' },
          title: 'Termín zápasu',
          onchange: function (e) { m.date = e.target.value || null; save('Termín uložen'); }
        })
      ].filter(Boolean)));

      return el('div', {}, [head, panel]);
    }

    /* ------------------------------------------------------ editor hry --- */

    function gameEditor(m, g, gi) {
      var wrap = el('div', { style: { border: '1px solid var(--line)', borderRadius: '0', marginBottom: '14px', overflow: 'hidden' } });

      wrap.appendChild(el('div', {
        style: { display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 14px', background: 'rgba(255,255,255,.04)', flexWrap: 'wrap' }
      }, [
        el('b', { style: { fontFamily: 'var(--font-head)' } }, 'Hra ' + (gi + 1)),
        el('input.search', {
          value: g.duration || '', placeholder: 'délka 31:47', style: { maxWidth: '120px' },
          oninput: function (e) { g.duration = e.target.value; saveSoon(); }
        }),
        el('span.muted', { style: { fontSize: '12px' } }, 'vyhrála:'),
        el('div', { style: { display: 'flex', gap: '6px' } }, ['blue', 'red'].map(function (side) {
          var t = AB.team((g[side] || {}).team);
          return el('button.filter-btn' + (g.winner === side ? '.active' : ''), {
            onclick: function () { g.winner = side; save('Vítěz: ' + (t ? t.name : side)); }
          }, t ? t.name : side);
        })),
        el('button.icon-btn', {
          style: { marginLeft: 'auto' },
          title: 'Prohodit strany',
          onclick: function () {
            var tmp = g.blue; g.blue = g.red; g.red = tmp;
            g.winner = g.winner === 'blue' ? 'red' : 'blue';
            save('Strany prohozeny');
          }
        }, '⇄')
      ]));

      ['blue', 'red'].forEach(function (side) { wrap.appendChild(sideEditor(m, g, side)); });
      return wrap;
    }

    function sideEditor(m, g, side) {
      var s = g[side];
      if (!s) return el('div');
      var team = AB.team(s.team);
      var box = el('div');

      box.appendChild(el('div.sb-head.' + side, {}, [
        C.crest(team, 'crest-xs'),
        el('span', {}, team ? team.name : side),
        el('span.pill', {}, side === 'blue' ? 'Modrá' : 'Červená'),
        el('span', { style: { marginLeft: 'auto', display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' } }, [
          el('span.muted', { style: { fontSize: '11px' } }, 'bany:'),
          el('input.search', {
            value: (s.bans || []).join(', '), placeholder: 'Yone, KSante', style: { width: '150px', fontSize: '12px', padding: '5px 9px' },
            oninput: function (e) {
              s.bans = e.target.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
              saveSoon();
            }
          })
        ])
      ]));

      /* objectivy */
      var objRow = el('div', { style: { display: 'flex', gap: '8px', padding: '9px 14px', flexWrap: 'wrap', borderBottom: '1px solid var(--line)' } });
      [['towers', 'věže'], ['inhibs', 'inhib'], ['dragons', 'draci'], ['barons', 'baroni'], ['heralds', 'herald']]
        .forEach(function (pair) {
          objRow.appendChild(el('label', { style: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--tx-2)' } }, [
            el('span', {}, pair[1]),
            el('input.search', {
              type: 'number', min: '0', value: s[pair[0]] || 0,
              style: { width: '56px', padding: '4px 7px', fontSize: '12px' },
              oninput: function (e) { s[pair[0]] = Number(e.target.value) || 0; saveSoon(); }
            })
          ]));
        });
      box.appendChild(objRow);

      /* hráči */
      var cols = [
        ['champ', 'Champion', 'text', 110],
        ['k', 'K', 'number', 46], ['d', 'D', 'number', 46], ['a', 'A', 'number', 46],
        ['cs', 'CS', 'number', 58], ['gold', 'Zlato', 'number', 72],
        ['dmg', 'Dmg', 'number', 76], ['taken', 'Utrž.', 'number', 76], ['vision', 'Vis', 'number', 52]
      ];

      var rows = (s.players || []).map(function (p) {
        return el('tr', {}, [
          el('td', { style: { width: '38px' } }, AB.champImg(p.champ, 'champ-ic sm')),
          el('td', { style: { minWidth: '130px' } },
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
              AB.roleIcon(p.role, 'sm'),
              el('span', { style: { fontWeight: '600', fontSize: '13px', color: 'var(--gold-1)' } }, AB.player(p.player).name)
            ]))
        ].concat(cols.map(function (c) {
          return el('td', {}, el('input.search', {
            type: c[2], value: p[c[0]] === undefined ? '' : p[c[0]],
            placeholder: c[1],
            style: { width: c[3] + 'px', padding: '5px 8px', fontSize: '12px' },
            oninput: function (e) {
              p[c[0]] = c[2] === 'number' ? (Number(e.target.value) || 0) : e.target.value;
              saveSoon();
            }
          }));
        })));
      });

      box.appendChild(el('div.tbl-wrap', { style: { border: 'none', borderRadius: 0 } },
        el('table.tbl', {}, [
          el('thead', {}, el('tr', {}, [el('th', {}, ''), el('th', {}, 'Hráč')]
            .concat(cols.map(function (c) { return el('th', {}, c[1]); })))),
          el('tbody', {}, rows)
        ])));

      return box;
    }

    /* --------------------------------------------------------- pomocné --- */

    /** Prázdná hra s předvyplněnými sestavami obou týmů. */
    function blankGame(m) {
      var n = (m.games || []).length;
      // strany se v BO3 střídají
      var blueId = n % 2 === 0 ? m.a : m.b;
      var redId = n % 2 === 0 ? m.b : m.a;

      var side = function (tid) {
        var t = AB.team(tid);
        return {
          team: tid, bans: [],
          towers: 0, inhibs: 0, dragons: 0, barons: 0, heralds: 0,
          players: AB.ROLE_KEYS.map(function (r) {
            return {
              role: r, player: t.roster[r] || null, champ: '',
              k: 0, d: 0, a: 0, cs: 0, gold: 0, dmg: 0, taken: 0, vision: 0
            };
          })
        };
      };
      return { duration: '', winner: 'blue', blue: side(blueId), red: side(redId) };
    }
  };

  /* ---------------------------------------------------------- ukládání --- */

  var timer = null;

  /** Uloží hned a překreslí (pro strukturální změny). */
  function save(msg) {
    persist();
    if (msg) C.toast(msg);
    AB.reload();
  }

  /** Uloží se zpožděním a NEpřekresluje — jinak by psaní v inputu ztrácelo fokus. */
  function saveSoon() {
    clearTimeout(timer);
    timer = setTimeout(persist, 600);
  }

  function persist() {
    if (AB.api && AB.api.canWrite()) {
      AB.api.saveMatches()
        .then(function () { flash('✓ uloženo do data/matches.js', 'var(--win)'); })
        .catch(function (e) { flash('⚠ nezapsáno: ' + e.message, 'var(--loss)'); });
    } else {
      AB.store.set('matches', { schedule: w.SCHEDULE, playoffs: w.PLAYOFFS });
      flash('✓ uloženo v prohlížeči', 'var(--tx-1)');
    }
  }

  function flash(text, color) {
    var host = AB.$('#save-badge');
    if (!host) return;
    AB.clear(host);
    host.appendChild(el('span', { style: { color: color, fontSize: '12px', fontWeight: '600' } }, text));
  }

  /** Bez serveru se výsledky drží v prohlížeči — nalej je zpět po refreshi. */
  AB.applyMatchOverrides = function () {
    if (AB.api && AB.api.online) return;
    var s = AB.store.get('matches', null);
    if (!s || !s.schedule) return;
    var byId = {};
    s.schedule.concat(s.playoffs || []).forEach(function (m) { byId[m.id] = m; });
    w.SCHEDULE.concat(w.PLAYOFFS).forEach(function (m) {
      var saved = byId[m.id];
      if (!saved) return;
      m.games = saved.games || [];
      m.status = saved.status || m.status;
      m.date = saved.date || m.date;
      if (saved.a) m.a = saved.a;
      if (saved.b) m.b = saved.b;
    });
  };

})(window);
