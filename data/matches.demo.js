/* ==========================================================================
   AQUABATTLE — UKÁZKOVÁ DATA  (načte se jen při  index.html?demo=1)
   --------------------------------------------------------------------------
   Tenhle soubor NENÍ součástí ostrých dat a index.html ho normálně nenačítá.
   Slouží k tomu, aby sis mohl prohlédnout, jak stránka vypadá s kompletně
   odehraným turnajem — soupisky, výsledky, pavouk i statistiky.

   Čísla jsou vygenerovaná deterministicky (stejný seed = stejný turnaj),
   takže se nic neháže náhodně při každém refreshi.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB;

  /* --- deterministický generátor (mulberry32) ---------------------------- */
  var seed = 20260830;
  function rnd() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function ri(min, max) { return min + Math.floor(rnd() * (max - min + 1)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  /* --- ukázkové soupisky (výsledek snake draftu podle bodů) -------------- */
  var DEMO_ROSTERS = {
    riptide:   { TOP: 'losik',      JG: 'sherko',      MID: 'ricci',  ADC: 'Richard', SUPP: 'shinigami' },
    kraken:    { TOP: 'tomasshyb',  JG: 'Sebzub',      MID: 'spajdy', ADC: 'shay',    SUPP: 'Dortomet' },
    abyss:     { TOP: 'Kuba',       JG: 'bomba',       MID: 'florad', ADC: 'sedesi',  SUPP: 'gerald' },
    tsunami:   { TOP: 'pery',       JG: 'marek',       MID: 'Mrkev',  ADC: 'Martin',  SUPP: 'stepekk' },
    coral:     { TOP: 'mczgstudio', JG: 'dan',         MID: 'Echo',   ADC: 'jarvyn',  SUPP: 'Bella' },
    maelstrom: { TOP: 'jeromino',   JG: 'ya_boi_emil', MID: 'dargy',  ADC: 'tropix',  SUPP: 'Armin' }
  };

  w.TEAMS.forEach(function (t) {
    if (DEMO_ROSTERS[t.id]) t.roster = Object.assign({}, DEMO_ROSTERS[t.id]);
  });

  /* --- champion pooly podle rolí ---------------------------------------- */
  var POOLS = {
    TOP:  ['Aatrox', 'Darius', 'Camille', 'KSante', 'Jax', 'Gnar', 'Renekton', 'Ornn', 'Malphite', 'Gwen'],
    JG:   ['Viego', 'LeeSin', 'Hecarim', 'Vi', 'XinZhao', 'Nidalee', 'Kindred', 'Belveth', 'MasterYi', 'JarvanIV'],
    MID:  ['Ahri', 'Syndra', 'Orianna', 'Yasuo', 'Zed', 'Viktor', 'Azir', 'Sylas', 'Katarina', 'TwistedFate'],
    ADC:  ['Jinx', 'Caitlyn', 'Ezreal', 'KaiSa', 'Aphelios', 'Xayah', 'MissFortune', 'Lucian', 'Zeri', 'Varus'],
    SUPP: ['Thresh', 'Lulu', 'Nautilus', 'Leona', 'Rakan', 'Karma', 'Milio', 'Braum', 'Blitzcrank', 'Renata']
  };

  /* --- generátor jedné hry ---------------------------------------------- */
  function makeGame(blueId, redId, blueWins) {
    var mins = ri(24, 41);
    var dur = mins + ':' + String(ri(0, 59)).padStart(2, '0');

    function side(teamId, won) {
      var team = AB.team(teamId);
      var used = {};
      var players = AB.ROLE_KEYS.map(function (role) {
        var champ;
        do { champ = pick(POOLS[role]); } while (used[champ]);
        used[champ] = true;

        var carry = role === 'ADC' || role === 'MID';
        var k = won ? ri(carry ? 4 : 1, carry ? 12 : 8) : ri(0, carry ? 6 : 4);
        var d = won ? ri(0, 4) : ri(2, 8);
        var a = role === 'SUPP' ? ri(won ? 10 : 5, won ? 24 : 15) : ri(won ? 4 : 2, won ? 14 : 9);
        // vítěz má navrch i ekonomicky, jinak by scoreboard vypadal nesmyslně
        var edge = won ? 1.14 : 0.9;
        var cs = role === 'SUPP' ? ri(20, 55) : Math.round(mins * (carry ? ri(75, 92) : ri(62, 84)) / 10 * edge);
        var goldPm = role === 'SUPP' ? ri(250, 320) : (carry ? ri(400, 480) : ri(340, 420));
        var dmgPm = role === 'SUPP' ? ri(200, 400) : (carry ? ri(750, 1150) : ri(500, 800));

        return {
          role: role,
          player: team.roster[role],
          champ: champ,
          k: k, d: d, a: a,
          cs: cs,
          gold: Math.round(mins * goldPm * edge),
          dmg: Math.round(mins * dmgPm * edge),
          taken: Math.round(mins * (role === 'SUPP' || role === 'TOP' ? ri(700, 1000) : ri(400, 700))),
          vision: role === 'SUPP' ? ri(38, 72) : ri(12, 30)
        };
      });

      var bans = [];
      while (bans.length < 3) {
        var b = pick(POOLS[AB.ROLE_KEYS[ri(0, 4)]]);
        if (bans.indexOf(b) === -1) bans.push(b);
      }

      return {
        team: teamId,
        bans: bans,
        towers: won ? ri(7, 11) : ri(0, 5),
        inhibs: won ? ri(1, 3) : 0,
        dragons: won ? ri(2, 4) : ri(0, 2),
        barons: won ? ri(0, 2) : 0,
        heralds: ri(0, 1),
        players: players
      };
    }

    return {
      duration: dur,
      winner: blueWins ? 'blue' : 'red',
      blue: side(blueId, blueWins),
      red: side(redId, !blueWins)
    };
  }

  /** Odehraje BO3 sérii — silnější tým (podle bodů) má větší šanci. */
  function playSeries(m) {
    var pa = AB.teamPoints(AB.team(m.a)), pb = AB.teamPoints(AB.team(m.b));
    var pA = 0.5 + (pa - pb) / 4000;                    // mírné zvýhodnění
    var wins = [0, 0], games = [];

    while (wins[0] < 2 && wins[1] < 2) {
      var aWon = rnd() < pA;
      // strany se v BO3 střídají
      var blueIsA = games.length % 2 === 0;
      var blueId = blueIsA ? m.a : m.b;
      var redId = blueIsA ? m.b : m.a;
      var blueWins = blueIsA ? aWon : !aWon;
      games.push(makeGame(blueId, redId, blueWins));
      wins[aWon ? 0 : 1]++;
    }
    m.games = games;
    m.status = 'done';
    return m;
  }

  /* --- odehrát skupinu --------------------------------------------------- */
  var day = new Date('2026-09-05T19:00:00');
  w.SCHEDULE.forEach(function (m, i) {
    m.date = new Date(day.getTime() + (m.round - 1) * 86400000 + (i % 3) * 5400000).toISOString();
    playSeries(m);
  });

  /* --- odehrát playoff --------------------------------------------------- */
  var table = AB.standings();
  var byId = {};
  w.PLAYOFFS.forEach(function (p) { byId[p.id] = p; });

  byId.SF1.a = table[0].team.id; byId.SF1.b = table[3].team.id;
  byId.SF2.a = table[1].team.id; byId.SF2.b = table[2].team.id;
  byId.SF1.date = '2026-09-12T19:00:00';
  byId.SF2.date = '2026-09-12T21:00:00';
  playSeries(byId.SF1);
  playSeries(byId.SF2);

  var w1 = AB.seriesWinner(byId.SF1), l1 = w1 === byId.SF1.a ? byId.SF1.b : byId.SF1.a;
  var w2 = AB.seriesWinner(byId.SF2), l2 = w2 === byId.SF2.a ? byId.SF2.b : byId.SF2.a;

  byId.BR3.a = l1; byId.BR3.b = l2; byId.BR3.date = '2026-09-13T18:00:00';
  byId.FIN.a = w1; byId.FIN.b = w2; byId.FIN.date = '2026-09-13T20:00:00';
  playSeries(byId.BR3);
  playSeries(byId.FIN);

  console.info('[AQUABATTLE] Ukázková data načtena (' + AB.totalGames() + ' her). ' +
    'Ostrá data v data/matches.js zůstala nedotčená.');

})(window);
