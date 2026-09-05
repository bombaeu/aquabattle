/* ==========================================================================
   AQUABATTLE — server
   --------------------------------------------------------------------------
   Servíruje web a umožňuje adminu zapisovat data přímo do souborů.

   Lokálně:   node server.js   (nebo dvojklik na start.bat)  -> http://localhost:8099
   Na hostingu: nastav ADMIN_PASSWORD, jinak by kdokoliv mohl přepsat výsledky.

   PROMĚNNÉ PROSTŘEDÍ
     PORT             port (Railway ho nastavuje sám, lokálně 8099)
     ADMIN_PASSWORD   heslo do adminu. Když není nastavené, server běží
                      v lokálním režimu: poslouchá jen na 127.0.0.1 a admin
                      je bez hesla. Jakmile ho nastavíš, poslouchá navenek
                      a zápis vyžaduje přihlášení.
     DATA_DIR         kam se ukládají data. Na Railway namiř na volume,
                      jinak se po každém deployi ztratí. Když je adresář
                      prázdný, naplní se výchozími daty z repozitáře.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SEED_DIR = path.join(ROOT, 'data');              // výchozí data v repu
const DATA_DIR = path.resolve(process.env.DATA_DIR || SEED_DIR);
const PORT = Number(process.env.PORT) || 8099;
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const LOCAL_ONLY = !PASSWORD;                          // bez hesla nepouštěj ven
const HOST = LOCAL_ONLY ? '127.0.0.1' : '0.0.0.0';

/* Soubory, které admin mění — jen ty žijí v DATA_DIR (na hostingu volume).
   Zbytek dat (players.js, matches.demo.js) je referenční a čte se vždycky
   z repozitáře. Kdyby se seedovaly taky, zmrazily by se ve volume při prvním
   startu a žádná pozdější úprava v gitu by se už neprojevila. */
const MUTABLE = ['teams.js', 'matches.js', 'accounts.js', 'preferences.js'];

/* Data, která se NESMÍ servírovat staticky — champion pooly jsou taktická
   informace. Kdyby si je soupeřův kapitán mohl stáhnout, věděl by přesně,
   co banovat. Chodí jen přes /api/preferences, profiltrované podle toho,
   kdo se ptá. */
const PRIVATE = ['preferences.js'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

/* ------------------------------------------------------------- úložiště -- */

/** Na prvním startu (typicky na volume) doplní měnitelná data z repozitáře. */
function ensureDataDir() {
  if (DATA_DIR === SEED_DIR) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  MUTABLE.forEach((f) => {
    const target = path.join(DATA_DIR, f);
    const seed = path.join(SEED_DIR, f);
    if (!fs.existsSync(target) && fs.existsSync(seed)) {
      fs.copyFileSync(seed, target);
      console.log('[seed] ' + f + ' -> ' + DATA_DIR);
    }
  });
}

/* ----------------------------------------------------------- serializace -- */

const q = (v) => (v === null || v === undefined ? 'null' : JSON.stringify(String(v)));
const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUPP'];

function teamsFile(teams) {
  const body = teams.map((t) => {
    const roster = ROLES.map((r) => `      ${r}: ${q((t.roster || {})[r])}`).join(',\n');
    const subs = (t.subs || []).map(q).join(', ');
    return [
      '  {',
      `    id: ${q(t.id)},`,
      `    name: ${q(t.name)},`,
      `    tag: ${q(t.tag)},`,
      `    captain: ${q(t.captain)},`,
      `    captainRole: ${q(t.captainRole)},`,
      `    color: ${q(t.color)},`,
      '    roster: {',
      roster,
      '    },',
      `    subs: [${subs}]`,
      '  }'
    ].join('\n');
  }).join(',\n');

  return `/* AQUABATTLE — týmy. Uloženo z admin panelu ${new Date().toLocaleString('cs-CZ')} */

window.TEAMS = [
${body}
];

`;
}

function playerLine(p) {
  const n = (k) => Number(p[k]) || 0;
  return `        { role: ${q(p.role)}, player: ${q(p.player)}, champ: ${q(p.champ)}, ` +
    `k: ${n('k')}, d: ${n('d')}, a: ${n('a')}, cs: ${n('cs')}, gold: ${n('gold')}, ` +
    `dmg: ${n('dmg')}, taken: ${n('taken')}, vision: ${n('vision')} }`;
}

function sideBlock(name, s) {
  if (!s) return `      ${name}: null`;
  const n = (k) => Number(s[k]) || 0;
  return [
    `      ${name}: {`,
    `        team: ${q(s.team)},`,
    `        bans: [${(s.bans || []).map(q).join(', ')}],`,
    `        towers: ${n('towers')}, inhibs: ${n('inhibs')}, dragons: ${n('dragons')}, ` +
      `barons: ${n('barons')}, heralds: ${n('heralds')},`,
    '        players: [',
    (s.players || []).map(playerLine).join(',\n'),
    '        ]',
    '      }'
  ].join('\n');
}

function gameBlock(g) {
  return [
    '    {',
    `      duration: ${q(g.duration)},`,
    `      winner: ${q(g.winner)},`,
    sideBlock('blue', g.blue) + ',',
    sideBlock('red', g.red),
    '    }'
  ].join('\n');
}

function matchBlock(m, isPlayoff) {
  const head = [
    `    id: ${q(m.id)},`,
    isPlayoff
      ? `    stage: ${q(m.stage)}, label: ${q(m.label)},` +
        (m.seedA ? ` seedA: ${Number(m.seedA)}, seedB: ${Number(m.seedB)},` : '') +
        (m.from ? ` from: [${m.from.map(q).join(', ')}],` : '')
      : `    round: ${Number(m.round) || 0},`,
    `    a: ${q(m.a)}, b: ${q(m.b)},`,
    `    date: ${q(m.date)},`,
    `    status: ${q(m.status || 'scheduled')},`
  ].join('\n');

  const games = (m.games || []).length
    ? '    games: [\n' + m.games.map(gameBlock).join(',\n') + '\n    ]'
    : '    games: []';

  return '  {\n' + head + '\n' + games + '\n  }';
}

function accountsFile(region, accounts) {
  const def = region || 'eune';

  /* Hráč z výchozího regionu je prostý řetězec, kdo hraje jinde dostane
     objekt s vlastním regionem. Soubor tak zůstane čitelný. */
  const line = (k) => {
    const a = accounts[k];
    const id = typeof a === 'string' ? a : a.id;
    const reg = typeof a === 'string' ? null : (a.region || null);
    const val = (!reg || reg === def)
      ? q(id)
      : `{ id: ${q(id)}, region: ${q(reg)} }`;
    return `  ${JSON.stringify(k)}: ${val}`;
  };

  const ids = Object.keys(accounts)
    .filter((k) => accounts[k] && (typeof accounts[k] === 'string' ? accounts[k] : accounts[k].id))
    .sort();

  const body = ids.length
    ? ids.map(line).join(',\n')
    : '  // zatím nikdo — přiřaď Riot ID v adminu';

  return `/* AQUABATTLE — herní účty hráčů (Riot ID pro OP.GG).
   Uloženo z admin panelu ${new Date().toLocaleString('cs-CZ')}.

   Formát: 'id hráče': 'Jméno#TAG'                         (výchozí region)
           'id hráče': { id: 'Jméno#TAG', region: 'euw' }   (hraje jinde) */

window.OPGG_REGION = ${JSON.stringify(def)};

window.ACCOUNTS = {
${body}
};
`;
}

function preferencesFile(prefs) {
  const ids = Object.keys(prefs).filter((k) => (prefs[k] || []).length).sort();
  const body = ids.length
    ? ids.map((k) => `  ${JSON.stringify(k)}: [${prefs[k].map(q).join(', ')}]`).join(',\n')
    : '  // zatím nikdo — nastav v Pick & Ban → Preference týmu';

  return `/* AQUABATTLE — preferovaní championi hráčů.
   Uloženo ${new Date().toLocaleString('cs-CZ')}.
   Formát: 'id hráče': ['Champion', ...] */

window.PREFERENCES = {
${body}
};
`;
}

/** Načte náš vlastní datový soubor a vytáhne z něj globály. */
function readDataFile(file) {
  const target = MUTABLE.includes(file) ? path.join(DATA_DIR, file) : path.join(SEED_DIR, file);
  const fake = {};
  try {
    // eslint-disable-next-line no-new-func
    new Function('window', fs.readFileSync(target, 'utf8'))(fake);
  } catch (e) {
    console.error('[data] nepodařilo se přečíst ' + file + ': ' + e.message);
  }
  return fake;
}

/* ------------------------------------------------------------ kapitáni -- */

/**
 * Srovná kapitány týmů se seznamem v players.js.
 *
 * players.js je referenční a čte se vždycky z repa, teams.js je mutable a na
 * nasazené instanci žije na volume — po výměně kapitána se ty dva rozejdou a
 * na produkci zůstane viset ten starý. Tým vedený někým, kdo v players.js
 * kapitán není, dostane kapitána, který zatím žádný tým nevede.
 *
 * Stejná logika běží i na klientu (lib.js); tady jde hlavně o to, aby podle
 * ní šla autorizovat kapitánská volání. Mutuje `teams`, vrací počet oprav.
 */
function normalizeCaptains(teams) {
  const list = (readDataFile('players.js').CAPTAINS || []).map((c) => c.id);
  if (!list.length) return 0;

  const claimed = new Set(teams.filter((t) => list.includes(t.captain)).map((t) => t.captain));
  const volni = list.filter((id) => !claimed.has(id));
  let rozbite = teams.filter((t) => !list.includes(t.captain));
  if (!rozbite.length || !volni.length) return 0;

  let opraveno = 0;
  const prirad = (t, id) => {
    console.warn(`[kapitáni] ${t.id}: ${t.captain} -> ${id} (podle players.js)`);
    t.captain = id;
    const role = ROLES.find((r) => (t.roster || {})[r] === id);
    if (role) t.captainRole = role;
    volni.splice(volni.indexOf(id), 1);
    rozbite = rozbite.filter((x) => x !== t);
    opraveno++;
  };

  // Nejjistější vodítko: kapitán bez týmu, který na té soupisce už stojí.
  rozbite.slice().forEach((t) => {
    const naSoupisce = volni.find((id) =>
      ROLES.some((r) => (t.roster || {})[r] === id) || (t.subs || []).includes(id));
    if (naSoupisce) prirad(t, naSoupisce);
  });

  // Zbytek jde spárovat, jen když nezůstane na výběr — jinak bychom hádali.
  if (rozbite.length === 1 && volni.length === 1) prirad(rozbite[0], volni[0]);
  return opraveno;
}

/** Týmy z dat, vždycky se srovnanými kapitány. */
function readTeams() {
  const teams = readDataFile('teams.js').TEAMS || [];
  normalizeCaptains(teams);
  return teams;
}

/**
 * Oprava rovnou v souboru na volume. Bez ní by se kapitán sice při každém
 * čtení dorovnal, ale v datech by zůstal špatně napořád — a admin panel by
 * ho při nejbližším uložení soupisky zapsal zpátky.
 */
function repairCaptainsOnDisk() {
  const teams = readDataFile('teams.js').TEAMS || [];
  if (!teams.length || !normalizeCaptains(teams)) return;
  try {
    writeData('teams.js', teamsFile(teams));
    console.log('[kapitáni] teams.js srovnán podle players.js a uložen');
  } catch (e) {
    console.error('[kapitáni] nepodařilo se uložit: ' + e.message);
  }
}

function matchesFile(schedule, playoffs) {
  return `/* AQUABATTLE — rozpis, výsledky a statistiky.
   Uloženo z admin panelu ${new Date().toLocaleString('cs-CZ')}.

   Tenhle soubor generuje admin (záložka Výsledky) — ruční úpravy tady přepíše
   první uložení. Skóre sérií se nezapisuje, dopočítává se z vyhraných her.
   Popis formátu je v README.md. */

window.SCHEDULE = [
${schedule.map((m) => matchBlock(m, false)).join(',\n')}
];

window.PLAYOFFS = [
${playoffs.map((m) => matchBlock(m, true)).join(',\n')}
];
`;
}

/* ---------------------------------------------------------------- zápis -- */

function writeData(file, content) {
  const target = path.join(DATA_DIR, file);
  if (!path.resolve(target).startsWith(DATA_DIR)) throw new Error('neplatná cesta');

  if (fs.existsSync(target)) {
    const backups = path.join(DATA_DIR, '.backup');
    fs.mkdirSync(backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(target, path.join(backups, `${file}.${stamp}`));
    pruneBackups(backups, file);
  }
  fs.writeFileSync(target, content, 'utf8');
}

/** Posledních 20 záloh od každého souboru, ať to nebobtná donekonečna. */
function pruneBackups(dir, file) {
  const mine = fs.readdirSync(dir).filter((f) => f.startsWith(file + '.')).sort();
  mine.slice(0, Math.max(0, mine.length - 20))
    .forEach((f) => { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* nevadí */ } });
}

/* ------------------------------------------------------------ přihlášení -- */

const sessions = new Map();                  // token -> { role, id, exp }
const SESSION_MS = 30 * 24 * 3600 * 1000;    // 30 dní
const CRED_FILE = path.join(DATA_DIR, 'credentials.json');

/** Porovnání v konstantním čase — přes hash, ať nezáleží na délce. */
function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a || '')).digest();
  const hb = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* --- účty kapitánů: v souboru jsou jen hashe, hesla vidí admin jednou --- */

function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CRED_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveCreds(c) {
  fs.writeFileSync(CRED_FILE, JSON.stringify(c, null, 2), 'utf8');
}

function hashPassword(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 32).toString('hex');
}

function captainOk(id, pw) {
  const rec = loadCreds()[id];
  if (!rec) return false;
  return sameSecret(hashPassword(pw, rec.salt), rec.hash);
}

/** Vygeneruje nová hesla pro zadané kapitány. Vrací je v čitelné podobě — jednou. */
function generateCreds(ids) {
  const creds = loadCreds();
  const plain = {};
  // bez znaků, co se pletou při přepisování (0/O, 1/l/I)
  const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

  ids.forEach((id) => {
    let pw = '';
    for (let i = 0; i < 8; i++) pw += ALPHABET[crypto.randomInt(ALPHABET.length)];
    const salt = crypto.randomBytes(16).toString('hex');
    creds[id] = { salt, hash: hashPassword(pw, salt) };
    plain[id] = pw;
  });

  saveCreds(creds);
  return plain;
}

function newSession(role, id) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { role, id, exp: Date.now() + SESSION_MS });
  return token;
}

/** Vrátí session objekt nebo null. */
function session(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const s = sessions.get(token);
  if (!s) return LOCAL_ONLY ? { role: 'admin', id: 'admin' } : null;
  if (s.exp < Date.now()) { sessions.delete(token); return null; }
  return s;
}

const isAdmin = (req) => { const s = session(req); return !!s && s.role === 'admin'; };

/** Hráči na soupiskách týmů, které vede kapitán `captainId`. */
function playersOf(captainId) {
  const teams = readTeams();
  const out = [];
  teams.filter((t) => t.captain === captainId).forEach((t) => {
    ROLES.forEach((r) => { if (t.roster[r]) out.push(t.roster[r]); });
    (t.subs || []).forEach((s) => out.push(s));
  });
  return out;
}

/** Je `player` na soupisce týmu, který vede kapitán `captainId`? */
function ownsPlayer(captainId, player) {
  return playersOf(captainId).indexOf(player) !== -1;
}

/** Vede kapitán `captainId` tým `teamId`? */
function ownsTeam(captainId, teamId) {
  return readTeams().some((t) => t.id === teamId && t.captain === captainId);
}

/* --------------------------------------------------------------- loga --- */

const LOGO_DIR = path.join(DATA_DIR, 'logos');
const LOGO_MAX = 400 * 1024;                 // strop po dekódování

/** { teamId: čas poslední změny } — verze slouží klientovi k cache-bustingu. */
function logoIndex() {
  try {
    return fs.readdirSync(LOGO_DIR)
      .filter((f) => f.endsWith('.png'))
      .reduce((acc, f) => {
        acc[f.slice(0, -4)] = Math.round(fs.statSync(path.join(LOGO_DIR, f)).mtimeMs);
        return acc;
      }, {});
  } catch (e) { return {}; }
}

/** Uloží logo z data URL. Vrací cestu, nebo vyhodí chybu. */
function writeLogo(teamId, dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('očekávám obrázek jako data URL (png, jpeg nebo webp)');

  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw new Error('prázdný obrázek');
  if (buf.length > LOGO_MAX) throw new Error('obrázek je moc velký (max 400 kB po zmenšení)');

  fs.mkdirSync(LOGO_DIR, { recursive: true });
  const target = path.join(LOGO_DIR, teamId + '.png');
  if (!path.resolve(target).startsWith(path.resolve(LOGO_DIR) + path.sep)) throw new Error('neplatný tým');
  fs.writeFileSync(target, buf);
  return target;
}

function removeLogo(teamId) {
  const target = path.join(LOGO_DIR, teamId + '.png');
  if (!path.resolve(target).startsWith(path.resolve(LOGO_DIR) + path.sep)) throw new Error('neplatný tým');
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

/* ---------------------------------------------------------- živý draft -- */

/* Turnajové pořadí tahů. Musí sedět s klientem (view-pickban.js). */
const DRAFT_SEQUENCE = [
  ['blue', 'ban'], ['red', 'ban'], ['blue', 'ban'], ['red', 'ban'], ['blue', 'ban'], ['red', 'ban'],
  ['blue', 'pick'], ['red', 'pick'], ['red', 'pick'], ['blue', 'pick'], ['blue', 'pick'], ['red', 'pick'],
  ['red', 'ban'], ['blue', 'ban'], ['red', 'ban'], ['blue', 'ban'],
  ['red', 'pick'], ['blue', 'pick'], ['blue', 'pick'], ['red', 'pick']
].map(([side, type]) => ({ side, type }));

const DRAFT_FILE = path.join(DATA_DIR, 'draft.json');
const TURN_SECONDS = 30;

let draft = null;      // jeden běžící draft; víc naráz nedává na streamu smysl

function loadDraft() {
  try { draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8')); } catch (e) { draft = null; }
}

function persistDraft() {
  try {
    if (draft) fs.writeFileSync(DRAFT_FILE, JSON.stringify(draft), 'utf8');
    else if (fs.existsSync(DRAFT_FILE)) fs.unlinkSync(DRAFT_FILE);
  } catch (e) { console.error('[draft] nepodařilo se uložit:', e.message); }
}

function touch() {
  draft.rev = (draft.rev || 0) + 1;
  draft.turnStartedAt = Date.now();
  persistDraft();
}

/**
 * Pořadí tahů pro tenhle draft.
 *
 * DRAFT_SEQUENCE je zapsaná tak, že začíná modrá — jak to chodí v klientu.
 * U nás si ale strana a pořadí pickování vybírají dva různé týmy, takže se
 * můžou rozejít: když si tým na červené vybral first pick, celá sekvence se
 * zrcadlí. Strany zůstanou, kde jsou, prohodí se jen to, kdo je kdy na tahu.
 */
function sequenceFor(d) {
  if (!d || !d.firstPick || d.firstPick === d.blue) return DRAFT_SEQUENCE;
  return DRAFT_SEQUENCE.map((s) => ({ side: s.side === 'blue' ? 'red' : 'blue', type: s.type }));
}

/** Kdo je na tahu, nebo null když je hotovo. */
function currentTurn() {
  if (!draft) return null;
  return sequenceFor(draft)[draft.steps.length] || null;
}

/** Smí tenhle uživatel provést aktuální tah? */
function mayPick(s) {
  if (!draft || draft.status !== 'running') return false;
  const turn = currentTurn();
  if (!turn || !s) return false;
  if (s.role === 'admin') return true;                       // admin může zaskočit
  const teamId = turn.side === 'blue' ? draft.blue : draft.red;
  return s.role === 'captain' && draft.captains[teamId] === s.id;
}

/** Kapitáni, kteří v tomhle draftu hrají. */
function draftCaptains() {
  if (!draft) return [];
  return [draft.blue, draft.red].map((tid) => (draft.captains || {})[tid]).filter(Boolean);
}

function allReady() {
  const caps = draftCaptains();
  return caps.length > 0 && caps.every((c) => (draft.ready || {})[c]);
}

/** Určí, kdo si bere stranu; ten druhý dostane volbu pořadí pickování. */
function setChooser(teamId, from) {
  const other = teamId === draft.blue ? draft.red : draft.blue;
  draft.choice = {
    sideTeam: teamId,
    orderTeam: other,
    from: from,                            // 'coin' = hod mincí, 'previous' = podle minulé hry
    // nonce nutí klienta přehrát animaci i při dvou hodech se stejným vítězem
    flip: { winner: teamId, at: Date.now(), nonce: crypto.randomBytes(4).toString('hex') },
    side: null,
    order: null
  };
  draft.firstPick = null;
}

/** Je uživatel kapitánem daného týmu (nebo admin, který smí zaskočit)? */
function mayChooseFor(s, teamId) {
  if (!s) return false;
  if (s.role === 'admin') return true;
  return s.role === 'captain' && (draft.captains || {})[teamId] === s.id;
}

async function handleDraft(req, res, action) {
  const s = session(req);
  if (!s) return sendJSON(res, 401, { ok: false, error: 'nepřihlášen' });

  const adminOnly = () => {
    if (s.role === 'admin') return true;
    sendJSON(res, 403, { ok: false, error: 'jen pro admina' });
    return false;
  };

  try {
    /* Admin otevře lobby — kapitáni se v něm odklikají jako připravení. */
    if (action === 'open') {
      if (!adminOnly()) return;
      const b = await readBody(req);
      if (!b.matchId || !b.blue || !b.red) throw new Error('chybí zápas nebo týmy');
      draft = {
        matchId: String(b.matchId),
        gameNo: Number(b.gameNo) || 1,
        blue: String(b.blue),
        red: String(b.red),
        captains: b.captains || {},        // { teamId: captainId }
        status: 'lobby',
        ready: {},
        steps: [],
        rev: 0,
        turnSeconds: TURN_SECONDS,
        turnStartedAt: Date.now(),
        /* Volba stran: jeden tým si bere stranu, druhý pořadí pickování.
           Do zahájení musí být obojí vyplněné. */
        choice: { sideTeam: null, orderTeam: null, from: null, flip: null, side: null, order: null },
        firstPick: null
      };
      // U druhé a třetí hry vybírá stranu vítěz té předchozí — admin ho
      // posílá z klienta, kde jsou k dispozici výsledky.
      if (b.sideTeam && [draft.blue, draft.red].includes(String(b.sideTeam))) {
        setChooser(String(b.sideTeam), 'previous');
      }
      persistDraft();
      console.log(`[draft] lobby ${draft.blue} vs ${draft.red}, hra ${draft.gameNo}`);
      return sendJSON(res, 200, { ok: true, draft });
    }

    if (!draft) return sendJSON(res, 409, { ok: false, error: 'žádný draft neběží' });

    /* Kapitán se přepne na připraven / nepřipraven. */
    if (action === 'ready') {
      if (draft.status !== 'lobby') throw new Error('lobby už je zavřené');
      if (s.role !== 'captain') return sendJSON(res, 403, { ok: false, error: 'jen pro kapitány' });
      if (draftCaptains().indexOf(s.id) === -1) {
        return sendJSON(res, 403, { ok: false, error: 'v tomhle draftu nehraješ' });
      }
      const b = await readBody(req);
      draft.ready = draft.ready || {};
      if (b.ready === false) delete draft.ready[s.id];
      else draft.ready[s.id] = true;
      touch();
      return sendJSON(res, 200, { ok: true, draft });
    }

    /* Hod mincí — rozhodne, kdo si bere stranu. Jen v lobby a jen admin. */
    if (action === 'coin') {
      if (!adminOnly()) return;
      if (draft.status !== 'lobby') throw new Error('draft už běží');
      const b = await readBody(req);
      if (b.sideTeam) {
        if (![draft.blue, draft.red].includes(String(b.sideTeam))) throw new Error('neznámý tým');
        setChooser(String(b.sideTeam), 'previous');
      } else {
        // Losujeme kryptograficky, ať to nejde odhadnout z času požadavku.
        setChooser(crypto.randomInt(2) ? draft.red : draft.blue, 'coin');
      }
      touch();
      console.log(`[draft] stranu vybírá ${draft.choice.sideTeam} (${draft.choice.from})`);
      return sendJSON(res, 200, { ok: true, draft });
    }

    /* Vítěz hodu si bere modrou nebo červenou. */
    if (action === 'side') {
      if (draft.status !== 'lobby') throw new Error('draft už běží');
      const c = draft.choice || {};
      if (!c.sideTeam) throw new Error('nejdřív musí padnout mince');
      if (!mayChooseFor(s, c.sideTeam)) {
        return sendJSON(res, 403, { ok: false, error: 'stranu vybírá druhý tým' });
      }
      const { side } = await readBody(req);
      if (side !== 'blue' && side !== 'red') throw new Error('očekávám blue nebo red');

      // Strany se přiřazují až tady — do teď byly jen tak, jak přišly ze zápasu.
      if (side === 'blue') { draft.blue = c.sideTeam; draft.red = c.orderTeam; }
      else { draft.red = c.sideTeam; draft.blue = c.orderTeam; }
      c.side = side;
      if (c.order) draft.firstPick = c.order === 'first' ? c.orderTeam : c.sideTeam;
      touch();
      return sendJSON(res, 200, { ok: true, draft });
    }

    /* Druhý tým si bere first nebo last pick. */
    if (action === 'order') {
      if (draft.status !== 'lobby') throw new Error('draft už běží');
      const c = draft.choice || {};
      if (!c.orderTeam) throw new Error('nejdřív musí padnout mince');
      if (!mayChooseFor(s, c.orderTeam)) {
        return sendJSON(res, 403, { ok: false, error: 'pořadí vybírá druhý tým' });
      }
      const { order } = await readBody(req);
      if (order !== 'first' && order !== 'last') throw new Error('očekávám first nebo last');
      c.order = order;
      draft.firstPick = order === 'first' ? c.orderTeam : c.sideTeam;
      touch();
      return sendJSON(res, 200, { ok: true, draft });
    }

    /* Admin spustí samotný draft. */
    if (action === 'begin') {
      if (!adminOnly()) return;
      if (draft.status !== 'lobby') throw new Error('draft už běží');
      const c = draft.choice || {};
      if (!c.side || !c.order) {
        throw new Error('nejdřív musí být vybraná strana i pořadí pickování');
      }
      draft.status = 'running';
      touch();
      console.log(`[draft] zahájen (${allReady() ? 'oba připraveni' : 'admin spustil bez potvrzení'})`);
      return sendJSON(res, 200, { ok: true, draft });
    }

    if (action === 'pick') {
      if (!mayPick(s)) return sendJSON(res, 403, { ok: false, error: 'nejsi na tahu' });
      const { champ } = await readBody(req);
      if (!champ) throw new Error('chybí champion');
      if (draft.steps.some((x) => x.champ === champ)) throw new Error('tenhle champion už je pryč');
      draft.steps.push({ champ: String(champ), by: s.id, at: Date.now() });
      touch();
      return sendJSON(res, 200, { ok: true, draft });
    }

    /* Po draftu: kdo z týmu hraje kterého picknutého championa.
       Pickuje se podle toho, co soupeř nechá, ne podle pozic, takže se to
       před zápisem do zápasu musí dát srovnat. `slots` je pole hráčů
       v pořadí picků dané strany. */
    if (action === 'assign') {
      if (!adminOnly()) return;
      const { team, slots } = await readBody(req);
      if (![draft.blue, draft.red].includes(String(team))) throw new Error('neznámý tým');
      if (!Array.isArray(slots)) throw new Error('očekávám seznam hráčů');
      draft.assign = draft.assign || {};
      draft.assign[String(team)] = slots.map((x) => (x === null || x === undefined ? null : String(x)));
      touch();
      return sendJSON(res, 200, { ok: true, draft });
    }

    if (action === 'undo') {
      if (!adminOnly()) return;
      draft.steps.pop();
      touch();
      return sendJSON(res, 200, { ok: true, draft });
    }

    if (action === 'swap') {
      if (!adminOnly()) return;
      if (draft.status !== 'lobby') throw new Error('strany jdou prohodit jen v lobby');
      const t = draft.blue; draft.blue = draft.red; draft.red = t;
      // choice.side je zapsaná jako "co si vybral sideTeam", takže musí jít s ním.
      // firstPick je teamId, ten se prohozením stran nemění.
      if (draft.choice && draft.choice.side) {
        draft.choice.side = draft.choice.side === 'blue' ? 'red' : 'blue';
      }
      touch();
      return sendJSON(res, 200, { ok: true, draft });
    }

    if (action === 'cancel') {
      if (!adminOnly()) return;
      draft = null;
      persistDraft();
      console.log('[draft] zrušen');
      return sendJSON(res, 200, { ok: true, draft: null });
    }

    if (action === 'clear') {                 // po zapsání do zápasu
      if (!adminOnly()) return;
      draft = null;
      persistDraft();
      return sendJSON(res, 200, { ok: true, draft: null });
    }

    return sendJSON(res, 404, { ok: false, error: 'neznámá akce' });
  } catch (e) {
    return sendJSON(res, 400, { ok: false, error: e.message });
  }
}

/* --------------------------------------------------------------- server -- */

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5e6) { reject(new Error('tělo požadavku je moc velké')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(new Error('neplatný JSON')); }
    });
    req.on('error', reject);
  });
}

/** Uložení dat — společné pro teams i matches. */
async function handleSave(req, res, kind) {
  if (!isAdmin(req)) return sendJSON(res, 401, { ok: false, error: 'jen pro admina' });
  try {
    const body = await readBody(req);
    if (kind === 'teams') {
      if (!Array.isArray(body) || !body.length) throw new Error('očekávám pole týmů');
      writeData('teams.js', teamsFile(body));
      console.log(`[uloženo] teams.js — ${body.length} týmů`);
      return sendJSON(res, 200, { ok: true, file: 'data/teams.js' });
    }
    if (kind === 'accounts') {
      const accounts = body.accounts || {};
      if (typeof accounts !== 'object' || Array.isArray(accounts)) throw new Error('očekávám mapu účtů');
      writeData('accounts.js', accountsFile(body.region, accounts));
      console.log(`[uloženo] accounts.js — ${Object.keys(accounts).length} účtů`);
      return sendJSON(res, 200, { ok: true, file: 'data/accounts.js' });
    }
    const { schedule, playoffs } = body;
    if (!Array.isArray(schedule) || !Array.isArray(playoffs)) throw new Error('očekávám schedule a playoffs');
    writeData('matches.js', matchesFile(schedule, playoffs));
    const games = schedule.concat(playoffs).reduce((n, m) => n + (m.games || []).length, 0);
    console.log(`[uloženo] matches.js — ${games} her`);
    return sendJSON(res, 200, { ok: true, file: 'data/matches.js' });
  } catch (e) {
    console.error('[chyba] ' + kind + ':', e.message);
    return sendJSON(res, 400, { ok: false, error: e.message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  /* ---- API ---- */
  if (pathname === '/api/ping') {
    const s = session(req);
    return sendJSON(res, 200, {
      ok: true,
      authRequired: !LOCAL_ONLY,
      authed: !!s && s.role === 'admin',
      role: s ? s.role : null,
      id: s ? s.id : null
    });
  }

  /* Přihlášení: buď admin (heslem z prostředí), nebo kapitán (jméno + heslo). */
  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const { user, password } = await readBody(req);
      const who = String(user || 'admin');

      if (who === 'admin') {
        if (LOCAL_ONLY) return sendJSON(res, 200, { ok: true, token: newSession('admin', 'admin'), role: 'admin', id: 'admin' });
        if (!sameSecret(password, PASSWORD)) {
          console.warn('[login] neúspěšný pokus o admina');
          return sendJSON(res, 401, { ok: false, error: 'špatné heslo' });
        }
        return sendJSON(res, 200, { ok: true, token: newSession('admin', 'admin'), role: 'admin', id: 'admin' });
      }

      if (!captainOk(who, password)) {
        console.warn('[login] neúspěšný pokus o kapitána: ' + who);
        return sendJSON(res, 401, { ok: false, error: 'špatné jméno nebo heslo' });
      }
      console.log('[login] kapitán ' + who);
      return sendJSON(res, 200, { ok: true, token: newSession('captain', who), role: 'captain', id: who });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }

  /* Vygenerování hesel kapitánům — čitelná se vrátí jen teď a nikde se neukládají. */
  if (pathname === '/api/credentials' && req.method === 'POST') {
    if (!isAdmin(req)) return sendJSON(res, 401, { ok: false, error: 'jen pro admina' });
    try {
      const { captains } = await readBody(req);
      if (!Array.isArray(captains) || !captains.length) throw new Error('očekávám seznam kapitánů');
      const plain = generateCreds(captains.map(String));
      console.log('[creds] vygenerována hesla pro: ' + captains.join(', '));
      return sendJSON(res, 200, { ok: true, passwords: plain });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/credentials' && req.method === 'GET') {
    if (!isAdmin(req)) return sendJSON(res, 401, { ok: false, error: 'jen pro admina' });
    return sendJSON(res, 200, { ok: true, captains: Object.keys(loadCreds()) });
  }

  /* ---- živý draft ---- */
  if (pathname === '/api/draft' && req.method === 'GET') {
    const s = session(req);
    return sendJSON(res, 200, {
      ok: true,
      draft: draft,
      me: s ? { role: s.role, id: s.id } : null
    });
  }

  if (pathname.startsWith('/api/draft/') && req.method === 'POST') {
    return handleDraft(req, res, pathname.slice('/api/draft/'.length));
  }

  if (pathname === '/api/teams' && req.method === 'POST') return handleSave(req, res, 'teams');
  if (pathname === '/api/matches' && req.method === 'POST') return handleSave(req, res, 'matches');
  if (pathname === '/api/accounts' && req.method === 'POST') return handleSave(req, res, 'accounts');

  /* Champion pooly. Vrací jen ty, na které má tazatel nárok — soupeř
     nesmí vidět, co si druhý tým nachystal. */
  /* Loga týmů — seznam je veřejný, nahrávat smí kapitán jen to svoje. */
  if (pathname === '/api/logos' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, logos: logoIndex() });
  }

  if (pathname === '/api/logo' && req.method === 'POST') {
    const s = session(req);
    if (!s) return sendJSON(res, 401, { ok: false, error: 'nepřihlášen' });
    try {
      const { team, dataUrl } = await readBody(req);
      if (!team) throw new Error('chybí tým');
      if (s.role !== 'admin' && !ownsTeam(s.id, team)) {
        return sendJSON(res, 403, { ok: false, error: 'tohle není tvůj tým' });
      }

      if (dataUrl) {
        writeLogo(String(team), dataUrl);
        console.log('[logo] uloženo pro ' + team);
      } else {
        removeLogo(String(team));
        console.log('[logo] smazáno pro ' + team);
      }
      return sendJSON(res, 200, { ok: true, logos: logoIndex() });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/preferences' && req.method === 'GET') {
    const s = session(req);
    const all = readDataFile('preferences.js').PREFERENCES || {};

    if (!s) return sendJSON(res, 200, { ok: true, preferences: {}, scope: 'none' });
    if (s.role === 'admin') return sendJSON(res, 200, { ok: true, preferences: all, scope: 'all' });

    const mine = {};
    playersOf(s.id).forEach((pid) => { if (all[pid]) mine[pid] = all[pid]; });
    return sendJSON(res, 200, { ok: true, preferences: mine, scope: 'own' });
  }

  /* Preference championů — kapitán smí sahat jen na svoje hráče, admin na všechny. */
  if (pathname === '/api/preferences' && req.method === 'POST') {
    const s = session(req);
    if (!s) return sendJSON(res, 401, { ok: false, error: 'nepřihlášen' });
    try {
      const { player, champs } = await readBody(req);
      if (!player) throw new Error('chybí hráč');
      if (!Array.isArray(champs)) throw new Error('očekávám seznam championů');

      if (s.role !== 'admin' && !ownsPlayer(s.id, player)) {
        return sendJSON(res, 403, { ok: false, error: 'tenhle hráč není z tvého týmu' });
      }

      const prefs = readDataFile('preferences.js').PREFERENCES || {};
      if (champs.length) prefs[player] = champs.map(String);
      else delete prefs[player];

      writeData('preferences.js', preferencesFile(prefs));

      // zpátky posílej jen to, na co má tazatel nárok — jinak by kapitán
      // uložením jednoho hráče vytáhl pooly celého turnaje
      if (s.role === 'admin') return sendJSON(res, 200, { ok: true, preferences: prefs });
      const mine = {};
      playersOf(s.id).forEach((pid) => { if (prefs[pid]) mine[pid] = prefs[pid]; });
      return sendJSON(res, 200, { ok: true, preferences: mine });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }
  if (pathname.startsWith('/api/')) return sendJSON(res, 404, { ok: false, error: 'neznámé API' });

  /* ---- statické soubory: data z DATA_DIR, zbytek z repa ---- */

  // Nic, co začíná tečkou — chrání to .git, .env i data/.backup se zálohami.
  if (pathname.split('/').some((seg) => seg.startsWith('.') && seg.length > 1)) {
    res.writeHead(403); return res.end('403');
  }

  let file, base;

  /* loga leží ve vlastním podadresáři na volume */
  const logoMatch = pathname.match(/^\/data\/logos\/([A-Za-z0-9_-]+\.png)$/);
  if (logoMatch) {
    const f = path.join(LOGO_DIR, logoMatch[1]);
    if (!path.resolve(f).startsWith(path.resolve(LOGO_DIR) + path.sep)) { res.writeHead(403); return res.end('403'); }
    return fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' });
      res.end(buf);
    });
  }

  const dataMatch = pathname.match(/^\/data\/([A-Za-z0-9._-]+)$/);
  if (dataMatch) {
    if (PRIVATE.includes(dataMatch[1])) { res.writeHead(403); return res.end('403'); }
    // z volume jen to, co admin zapisuje; referenční data vždy z repa
    base = MUTABLE.includes(dataMatch[1]) ? DATA_DIR : SEED_DIR;
    file = path.join(base, dataMatch[1]);
  } else {
    base = ROOT;
    file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  }

  // `startsWith(base)` bez oddělovače by pustil i sourozence typu "league-tajne"
  const resolved = path.resolve(file);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    res.writeHead(403); return res.end('403');
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — ' + pathname);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'          // po uložení ať se vždy načtou čerstvá data
    });
    res.end(buf);
  });
});

ensureDataDir();
repairCaptainsOnDisk();
loadDraft();
if (draft) console.log('[draft] obnoven rozehraný draft (' + draft.steps.length + ' tahů)');

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  AQUABATTLE');
  console.log('  ➜  http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT);
  console.log('  data: ' + DATA_DIR);
  console.log(LOCAL_ONLY
    ? '  režim: LOKÁLNÍ (jen 127.0.0.1, admin bez hesla)'
    : '  režim: VEŘEJNÝ (admin chráněný heslem)');
  if (!LOCAL_ONLY && DATA_DIR === SEED_DIR) {
    console.warn('  ⚠  DATA_DIR není nastavené — po redeployi se změny ztratí!');
  }
  console.log('');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} je obsazený. Buď už server běží, nebo zkus:  set PORT=8100 && node server.js\n`);
  } else console.error(e);
  process.exit(1);
});
