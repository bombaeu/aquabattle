/* ==========================================================================
   AQUABATTLE — komunikace se serverem
   --------------------------------------------------------------------------
   Když běží server, admin ukládá rovnou do datových souborů.
   Nasazený server chce heslo — token se drží v prohlížeči, takže se
   přihlašuješ jednou za 30 dní.

   Bez serveru (otevřený soubor) to spadne na localStorage a admin na to
   upozorní — nic se pak nezapíše natrvalo.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB;

  var api = AB.api = {
    online: false,        // běží server?
    authRequired: false,  // chce heslo?
    authed: false,        // jsme přihlášení jako admin?
    role: null,           // 'admin' | 'captain' | null
    id: null,             // u kapitána jeho id
    checked: false
  };

  function token() { return AB.store.get('token', null); }

  /** Zjistí, jestli server běží a jestli jsme přihlášení. */
  api.detect = function () {
    return new Promise(function (resolve) {
      if (w.location.protocol === 'file:') {          // fetch na file:// nefunguje
        api.checked = true;
        return resolve(false);
      }
      var done = false;
      var finish = function (ok, j) {
        if (done) return;
        done = true;
        api.online = ok;
        api.authRequired = !!(j && j.authRequired);
        api.authed = ok && (!api.authRequired || !!(j && j.authed));
        api.role = j ? j.role : null;
        api.id = j ? j.id : null;
        api.checked = true;
        resolve(ok);
      };
      setTimeout(function () { finish(false); }, 2500);

      var headers = {};
      var t = token();
      if (t) headers.Authorization = 'Bearer ' + t;

      w.fetch('/api/ping', { cache: 'no-store', headers: headers })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { finish(!!(j && j.ok), j); })
        .catch(function () { finish(false); });
    });
  };

  /** Přihlášení. `user` je 'admin' nebo id kapitána. Token držíme v prohlížeči. */
  api.login = function (user, password) {
    return w.fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: user || 'admin', password: password })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.ok) throw new Error(j.error || 'přihlášení selhalo');
        AB.store.set('token', j.token);
        api.role = j.role;
        api.id = j.id;
        api.authed = j.role === 'admin';
        return j;
      });
    });
  };

  api.logout = function () {
    AB.store.del('token');
    api.authed = false;
    api.role = null;
    api.id = null;
  };

  function post(path, payload) {
    var headers = { 'Content-Type': 'application/json' };
    var t = token();
    if (t) headers.Authorization = 'Bearer ' + t;

    return w.fetch(path, { method: 'POST', headers: headers, body: JSON.stringify(payload) })
      .then(function (r) {
        return r.json().then(function (j) {
          if (r.status === 401) {                     // vypršelo nebo špatný token
            api.authed = false;
            AB.store.del('token');
            throw new Error('vypršelo přihlášení — přihlas se znovu');
          }
          if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
          return j;
        });
      });
  }

  api.saveTeams = function () {
    return post('/api/teams', w.TEAMS.map(function (t) {
      return {
        id: t.id, name: t.name, tag: t.tag,
        captain: t.captain, captainRole: t.captainRole, color: t.color,
        roster: t.roster, subs: t.subs || []
      };
    }));
  };

  api.saveMatches = function () {
    return post('/api/matches', { schedule: w.SCHEDULE, playoffs: w.PLAYOFFS });
  };

  api.saveAccounts = function () {
    return post('/api/accounts', { region: w.OPGG_REGION, accounts: w.ACCOUNTS || {} });
  };

  /** Smí admin zapisovat? */
  api.canWrite = function () {
    return api.online && (!api.authRequired || api.authed);
  };

  /* ------------------------------------------------------- živý draft --- */

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }

  /** Stav běžícího draftu + kdo jsem. Volá se v pravidelném pollingu. */
  api.getDraft = function () {
    return w.fetch('/api/draft', { cache: 'no-store', headers: authHeaders() })
      .then(function (r) { return r.json(); });
  };

  api.draftAction = function (action, payload) {
    return w.fetch('/api/draft/' + action, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload || {})
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  };

  /** Vygeneruje hesla kapitánům. Čitelná přijdou jen v téhle odpovědi. */
  api.generateCredentials = function (captainIds) {
    return post('/api/credentials', { captains: captainIds });
  };

  /**
   * Natáhne champion pooly, na které mám nárok.
   * Kapitán dostane jen svůj tým, admin všechno, divák nic — filtruje
   * to server, aby si soupeř nemohl stáhnout, co plánujeme hrát.
   */
  api.loadPreferences = function () {
    if (!api.online) return Promise.resolve({});
    return w.fetch('/api/preferences', { cache: 'no-store', headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        w.PREFERENCES = (j && j.preferences) || {};
        api.prefScope = (j && j.scope) || 'none';
        return w.PREFERENCES;
      })
      .catch(function () { return w.PREFERENCES || {}; });
  };

  /** Seznam nahraných log. Veřejné — logo vidí i divák. */
  api.loadLogos = function () {
    if (!api.online) return Promise.resolve({});
    return w.fetch('/api/logos', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { w.LOGOS = (j && j.logos) || {}; return w.LOGOS; })
      .catch(function () { return w.LOGOS || {}; });
  };

  /** Nahraje (nebo s `null` smaže) logo týmu. */
  api.saveLogo = function (team, dataUrl) {
    return post('/api/logo', { team: team, dataUrl: dataUrl || null }).then(function (j) {
      w.LOGOS = j.logos || {};
      return w.LOGOS;
    });
  };

  /** Uloží preferované championy jednoho hráče. */
  api.savePreferences = function (player, champs) {
    return post('/api/preferences', { player: player, champs: champs }).then(function (j) {
      w.PREFERENCES = j.preferences || {};
      return j;
    });
  };

  api.listCredentials = function () {
    return w.fetch('/api/credentials', { cache: 'no-store', headers: authHeaders() })
      .then(function (r) { return r.json(); });
  };

})(window);
