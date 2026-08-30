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
    authed: false,        // jsme přihlášení?
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

  /** Přihlášení heslem. Token si necháme v prohlížeči. */
  api.login = function (password) {
    return w.fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.ok) throw new Error(j.error || 'přihlášení selhalo');
        AB.store.set('token', j.token);
        api.authed = true;
        return j;
      });
    });
  };

  api.logout = function () {
    AB.store.del('token');
    api.authed = false;
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

})(window);
