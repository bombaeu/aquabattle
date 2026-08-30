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

const DATA_FILES = ['players.js', 'teams.js', 'matches.js', 'matches.demo.js'];

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

/** Na prvním startu (typicky na volume) doplní chybějící data z repozitáře. */
function ensureDataDir() {
  if (DATA_DIR === SEED_DIR) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  DATA_FILES.forEach((f) => {
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

window.DRAFT_ORDER = ['maelstrom', 'coral', 'kraken', 'abyss', 'tsunami', 'riptide'];
window.DRAFT_ROUNDS = 4;
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

const sessions = new Map();                  // token -> platnost do
const SESSION_MS = 30 * 24 * 3600 * 1000;    // 30 dní

/** Porovnání hesla v konstantním čase — přes hash, ať nezáleží na délce. */
function passwordOk(given) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function newSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

function validSession(req) {
  if (LOCAL_ONLY) return true;               // lokálně bez hesla
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
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
  if (!validSession(req)) return sendJSON(res, 401, { ok: false, error: 'nepřihlášen' });
  try {
    const body = await readBody(req);
    if (kind === 'teams') {
      if (!Array.isArray(body) || !body.length) throw new Error('očekávám pole týmů');
      writeData('teams.js', teamsFile(body));
      console.log(`[uloženo] teams.js — ${body.length} týmů`);
      return sendJSON(res, 200, { ok: true, file: 'data/teams.js' });
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
    return sendJSON(res, 200, { ok: true, authRequired: !LOCAL_ONLY, authed: validSession(req) });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    if (LOCAL_ONLY) return sendJSON(res, 200, { ok: true, token: 'local' });
    try {
      const { password } = await readBody(req);
      if (!passwordOk(password)) {
        console.warn('[login] neúspěšný pokus');
        return sendJSON(res, 401, { ok: false, error: 'špatné heslo' });
      }
      return sendJSON(res, 200, { ok: true, token: newSession() });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/teams' && req.method === 'POST') return handleSave(req, res, 'teams');
  if (pathname === '/api/matches' && req.method === 'POST') return handleSave(req, res, 'matches');
  if (pathname.startsWith('/api/')) return sendJSON(res, 404, { ok: false, error: 'neznámé API' });

  /* ---- statické soubory: data z DATA_DIR, zbytek z repa ---- */

  // Nic, co začíná tečkou — chrání to .git, .env i data/.backup se zálohami.
  if (pathname.split('/').some((seg) => seg.startsWith('.') && seg.length > 1)) {
    res.writeHead(403); return res.end('403');
  }

  let file, base;
  const dataMatch = pathname.match(/^\/data\/([A-Za-z0-9._-]+)$/);
  if (dataMatch) {
    base = DATA_DIR;
    file = path.join(DATA_DIR, dataMatch[1]);
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
