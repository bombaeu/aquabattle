/* ==========================================================================
   AQUABATTLE — sdílené utility, výpočet tabulky a agregace statistik
   ========================================================================== */
(function (w) {
  'use strict';

  var AB = w.AB = {};

  /* ---------------------------------------------------------------- DOM --- */

  AB.$ = function (sel, root) { return (root || document).querySelector(sel); };
  AB.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /** el('div.card', {onclick: fn}, [child, 'text']) */
  AB.el = function (spec, attrs, children) {
    var parts = spec.split(/(?=[.#])/);
    var node = document.createElement(parts.shift() || 'div');
    parts.forEach(function (p) {
      if (p[0] === '.') {
        // ".a b" -> dvě třídy; classList.add() by na mezeře spadl
        p.slice(1).split(/\s+/).filter(Boolean).forEach(function (c) { node.classList.add(c); });
      } else node.id = p.slice(1);
    });
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      // Object.assign na style tiše zahodí CSS proměnné (--tc), musí přes
      // setProperty — jinak se barvy týmů nikam nepropíšou
      if (k === 'style' && typeof v === 'object') {
        Object.keys(v).forEach(function (prop) {
          if (v[prop] === null || v[prop] === undefined) return;
          if (prop.indexOf('--') === 0) node.style.setProperty(prop, v[prop]);
          else node.style[prop] = v[prop];
        });
      }
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
      });
    }
    return node;
  };

  AB.frag = function (children) {
    var f = document.createDocumentFragment();
    children.filter(Boolean).forEach(function (c) { f.appendChild(c); });
    return f;
  };

  AB.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ------------------------------------------------------------ lookupy --- */

  /** Všichni lidé v turnaji: kapitáni + pool. */
  AB.everyone = function () { return w.CAPTAINS.concat(w.POOL); };

  var _pmap = null;
  AB.player = function (id) {
    if (!_pmap) {
      _pmap = {};
      AB.everyone().forEach(function (p) { _pmap[p.id] = p; });
    }
    return _pmap[id] || { id: id, name: id, rank: null, points: 0, roles: [] };
  };
  AB.isCaptain = function (id) {
    return w.CAPTAINS.some(function (c) { return c.id === id; });
  };

  var _tmap = null;
  AB.team = function (id) {
    if (!_tmap) {
      _tmap = {};
      w.TEAMS.forEach(function (t) { _tmap[t.id] = t; });
    }
    return _tmap[id] || null;
  };

  /** Tým, za který hráč hraje (nebo null když je nedraftovaný). */
  AB.teamOfPlayer = function (pid) {
    for (var i = 0; i < w.TEAMS.length; i++) {
      var t = w.TEAMS[i];
      if (t.subs && t.subs.indexOf(pid) !== -1) return t;
      var roles = Object.keys(t.roster);
      for (var j = 0; j < roles.length; j++) if (t.roster[roles[j]] === pid) return t;
    }
    return null;
  };

  AB.rosterIds = function (team) {
    return AB.ROLE_KEYS.map(function (r) { return team.roster[r]; }).filter(Boolean);
  };

  AB.teamPoints = function (team) {
    return AB.rosterIds(team).reduce(function (s, id) { return s + AB.player(id).points; }, 0);
  };

  AB.ROLE_KEYS = ['TOP', 'JG', 'MID', 'ADC', 'SUPP'];

  AB.draftedIds = function () {
    var out = {};
    w.TEAMS.forEach(function (t) {
      AB.ROLE_KEYS.forEach(function (r) { if (t.roster[r]) out[t.roster[r]] = t.id; });
      (t.subs || []).forEach(function (s) { out[s] = t.id; });
    });
    return out;
  };

  AB.draftComplete = function () {
    return w.TEAMS.every(function (t) {
      return AB.ROLE_KEYS.every(function (r) { return !!t.roster[r]; });
    });
  };

  /* -------------------------------------------------------------- ikony --- */

  var DDRAGON_VER = '15.13.1';

  /** Obrázek championa s dvojitým fallbackem (CommunityDragon -> DDragon -> iniciály). */
  AB.champImg = function (champ, cls) {
    var key = String(champ || '').replace(/[^A-Za-z0-9]/g, '');
    var sel = cls ? '.' + String(cls).trim().split(/\s+/).join('.') : '';
    var img = AB.el('img' + sel, {
      alt: champ || '?',
      title: champ || '',
      loading: 'lazy',
      src: 'https://cdn.communitydragon.org/latest/champion/' + key + '/square'
    });
    var stage = 0;
    img.addEventListener('error', function () {
      stage++;
      if (stage === 1) {
        img.src = 'https://ddragon.leagueoflegends.com/cdn/' + DDRAGON_VER + '/img/champion/' + key + '.png';
      } else {
        var ph = AB.el('span.champ-ph' + sel, { title: champ || '' }, (champ || '?').slice(0, 2));
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
      }
    });
    return img;
  };

  /* -------------------------------------------------------------- série --- */

  /** Skóre BO3 série spočítané z odehraných her: [výhryA, výhryB]. */
  AB.seriesScore = function (m) {
    var a = 0, b = 0;
    (m.games || []).forEach(function (g) {
      var side = g.winner === 'blue' ? g.blue : g.red;
      if (!side) return;
      if (side.team === m.a) a++; else if (side.team === m.b) b++;
    });
    return [a, b];
  };

  AB.seriesWinner = function (m) {
    var s = AB.seriesScore(m);
    if (s[0] >= 2) return m.a;
    if (s[1] >= 2) return m.b;
    return null;
  };

  AB.isPlayed = function (m) { return (m.games || []).length > 0; };

  /** Všechny série (skupina + playoff) v jednom poli. */
  AB.allMatches = function () { return w.SCHEDULE.concat(w.PLAYOFFS); };

  /* ------------------------------------------------------------ tabulka --- */

  /**
   * Tabulka skupiny.
   * Řazení: výhry v sériích -> rozdíl her -> vzájemný zápas -> rozdíl killů.
   */
  AB.standings = function () {
    var rows = {};
    w.TEAMS.forEach(function (t) {
      rows[t.id] = {
        team: t, w: 0, l: 0, gw: 0, gl: 0, kills: 0, deaths: 0, played: 0, form: []
      };
    });

    w.SCHEDULE.forEach(function (m) {
      if (!AB.isPlayed(m)) return;
      var winner = AB.seriesWinner(m);
      if (!winner) return;                       // rozehraná série se do tabulky nepočítá
      var sc = AB.seriesScore(m);
      var ra = rows[m.a], rb = rows[m.b];
      if (!ra || !rb) return;

      ra.played++; rb.played++;
      ra.gw += sc[0]; ra.gl += sc[1];
      rb.gw += sc[1]; rb.gl += sc[0];
      if (winner === m.a) { ra.w++; rb.l++; ra.form.push('W'); rb.form.push('L'); }
      else { rb.w++; ra.l++; rb.form.push('W'); ra.form.push('L'); }

      (m.games || []).forEach(function (g) {
        ['blue', 'red'].forEach(function (side) {
          var s = g[side]; if (!s || !rows[s.team]) return;
          var k = (s.players || []).reduce(function (x, p) { return x + (p.k || 0); }, 0);
          var d = (s.players || []).reduce(function (x, p) { return x + (p.d || 0); }, 0);
          rows[s.team].kills += k;
          rows[s.team].deaths += d;
        });
      });
    });

    var list = Object.keys(rows).map(function (k) {
      var r = rows[k];
      r.gd = r.gw - r.gl;
      r.kd = r.kills - r.deaths;
      return r;
    });

    list.sort(function (x, y) {
      if (y.w !== x.w) return y.w - x.w;
      if (y.gd !== x.gd) return y.gd - x.gd;
      var h2h = AB.headToHead(x.team.id, y.team.id);
      if (h2h) return h2h === x.team.id ? -1 : 1;
      if (y.gw !== x.gw) return y.gw - x.gw;
      return y.kd - x.kd;
    });

    list.forEach(function (r, i) { r.rank = i + 1; });
    return list;
  };

  /** Vítěz vzájemného zápasu dvou týmů ve skupině, jinak null. */
  AB.headToHead = function (t1, t2) {
    for (var i = 0; i < w.SCHEDULE.length; i++) {
      var m = w.SCHEDULE[i];
      var pair = (m.a === t1 && m.b === t2) || (m.a === t2 && m.b === t1);
      if (pair && AB.isPlayed(m)) return AB.seriesWinner(m);
    }
    return null;
  };

  AB.groupComplete = function () {
    return w.SCHEDULE.every(function (m) { return !!AB.seriesWinner(m); });
  };

  /** Playoff s doplněnými týmy z tabulky / z výsledků semifinále. */
  AB.resolvedPlayoffs = function () {
    var table = AB.standings();
    var done = AB.groupComplete();
    var seed = function (n) { return done && table[n - 1] ? table[n - 1].team.id : null; };

    var map = {};
    var out = w.PLAYOFFS.map(function (p) {
      var m = Object.assign({}, p);
      if (!m.a && m.seedA) m.a = seed(m.seedA);
      if (!m.b && m.seedB) m.b = seed(m.seedB);
      map[m.id] = m;
      return m;
    });

    out.forEach(function (m) {
      if (!m.from) return;
      m.from.forEach(function (ref, i) {
        var parts = ref.split(':'), src = map[parts[0]];
        if (!src) return;
        var wn = AB.seriesWinner(src);
        if (!wn) return;
        var val = parts[1] === 'winner' ? wn : (wn === src.a ? src.b : src.a);
        if (i === 0 && !m.a) m.a = val;
        if (i === 1 && !m.b) m.b = val;
      });
    });
    return out;
  };

  AB.champion = function () {
    var fin = AB.resolvedPlayoffs().filter(function (p) { return p.stage === 'final'; })[0];
    return fin ? AB.seriesWinner(fin) : null;
  };

  /* ------------------------------------------------------------- staty --- */

  /** Ploché pole všech hráčských výkonů napříč všemi hrami. */
  AB.allPerformances = function () {
    var out = [];
    AB.allMatches().forEach(function (m) {
      (m.games || []).forEach(function (g, gi) {
        ['blue', 'red'].forEach(function (side) {
          var s = g[side]; if (!s) return;
          var won = g.winner === side;
          (s.players || []).forEach(function (p) {
            out.push(Object.assign({}, p, {
              matchId: m.id, gameNo: gi + 1, side: side, team: s.team,
              won: won, duration: AB.toSeconds(g.duration)
            }));
          });
        });
      });
    });
    return out;
  };

  AB.toSeconds = function (dur) {
    if (!dur) return 0;
    var p = String(dur).split(':').map(Number);
    return p.length === 2 ? p[0] * 60 + p[1] : 0;
  };

  AB.kda = function (k, d, a) {
    return d === 0 ? (k + a) : (k + a) / d;
  };

  /** Agregované statistiky po hráčích (seřazené podle počtu her). */
  AB.playerStats = function () {
    var by = {};
    AB.allPerformances().forEach(function (p) {
      var r = by[p.player] || (by[p.player] = {
        id: p.player, games: 0, wins: 0, k: 0, d: 0, a: 0,
        cs: 0, gold: 0, dmg: 0, taken: 0, vision: 0, secs: 0,
        champs: {}, teamId: p.team, bestKda: 0
      });
      r.games++;
      if (p.won) r.wins++;
      r.k += p.k || 0; r.d += p.d || 0; r.a += p.a || 0;
      r.cs += p.cs || 0; r.gold += p.gold || 0;
      r.dmg += p.dmg || 0; r.taken += p.taken || 0;
      r.vision += p.vision || 0; r.secs += p.duration || 0;
      if (p.champ) r.champs[p.champ] = (r.champs[p.champ] || 0) + 1;
      r.bestKda = Math.max(r.bestKda, AB.kda(p.k || 0, p.d || 0, p.a || 0));
    });

    return Object.keys(by).map(function (id) {
      var r = by[id];
      r.kdaAvg = AB.kda(r.k, r.d, r.a);
      r.winrate = r.games ? r.wins / r.games : 0;
      r.csPerMin = r.secs ? r.cs / (r.secs / 60) : 0;
      r.dmgPerMin = r.secs ? r.dmg / (r.secs / 60) : 0;
      r.kp = r.k + r.a;
      r.topChamps = Object.keys(r.champs)
        .sort(function (x, y) { return r.champs[y] - r.champs[x]; });
      return r;
    }).sort(function (x, y) { return y.games - x.games || y.kdaAvg - x.kdaAvg; });
  };

  /** Agregované statistiky po championech. */
  AB.championStats = function () {
    var by = {};
    AB.allPerformances().forEach(function (p) {
      if (!p.champ) return;
      var r = by[p.champ] || (by[p.champ] = { champ: p.champ, picks: 0, wins: 0, k: 0, d: 0, a: 0, players: {} });
      r.picks++;
      if (p.won) r.wins++;
      r.k += p.k || 0; r.d += p.d || 0; r.a += p.a || 0;
      r.players[p.player] = (r.players[p.player] || 0) + 1;
    });

    var bans = {};
    AB.allMatches().forEach(function (m) {
      (m.games || []).forEach(function (g) {
        ['blue', 'red'].forEach(function (side) {
          ((g[side] || {}).bans || []).forEach(function (c) { bans[c] = (bans[c] || 0) + 1; });
        });
      });
    });
    Object.keys(bans).forEach(function (c) {
      if (!by[c]) by[c] = { champ: c, picks: 0, wins: 0, k: 0, d: 0, a: 0, players: {} };
      by[c].bans = bans[c];
    });

    return Object.keys(by).map(function (c) {
      var r = by[c];
      r.bans = r.bans || 0;
      r.presence = r.picks + r.bans;
      r.winrate = r.picks ? r.wins / r.picks : 0;
      r.kdaAvg = AB.kda(r.k, r.d, r.a);
      return r;
    }).sort(function (x, y) { return y.presence - x.presence || y.picks - x.picks; });
  };

  AB.totalGames = function () {
    return AB.allMatches().reduce(function (s, m) { return s + (m.games || []).length; }, 0);
  };

  /* ------------------------------------------------------------ formát --- */

  AB.fmt = function (n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    return Number(n).toFixed(dec === undefined ? 0 : dec);
  };
  AB.pct = function (n) { return AB.fmt(n * 100, 0) + '%'; };
  AB.k = function (n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0); };
  AB.mmss = function (secs) {
    var m = Math.floor(secs / 60), s = Math.round(secs % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  AB.dateLabel = function (d) {
    if (!d) return 'termín TBD';
    var dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  /* ------------------------------------------------------------ úložiště -- */

  AB.store = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem('aquabattle:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, val) {
      try { localStorage.setItem('aquabattle:' + key, JSON.stringify(val)); } catch (e) { /* plné/zakázané */ }
    },
    del: function (key) {
      try { localStorage.removeItem('aquabattle:' + key); } catch (e) { /* noop */ }
    }
  };

})(window);
