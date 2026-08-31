/* ==========================================================================
   Přegeneruje data/champions.js z aktuálního Riot Data Dragonu.
   Pusť po nové generaci championů:   node tools/update-champions.js
   ========================================================================== */

const https = require('https');
const fs = require('fs');
const path = require('path');
const LANES = require('./champion-lanes');

/* Když champion v tabulce chybí, odhadni pozici z tagů. Lepší než nic —
   generátor to vypíše, ať se to dá doplnit ručně. */
const BY_TAG = {
  Marksman: 'ADC',
  Support: 'SUPP',
  Assassin: 'MID',
  Mage: 'MID',
  Fighter: 'TOP',
  Tank: 'TOP'
};

function lanesFor(id, tags) {
  if (LANES[id]) return { lanes: LANES[id], guessed: false };
  const guess = (tags || []).map((t) => BY_TAG[t]).filter(Boolean);
  return { lanes: guess.length ? [guess[0]] : ['MID'], guessed: true };
}

const get = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'aquabattle' } }, (r) => {
    let d = '';
    r.on('data', (c) => { d += c; });
    r.on('end', () => resolve(d));
  }).on('error', reject);
});

(async () => {
  const versions = JSON.parse(await get('https://ddragon.leagueoflegends.com/api/versions.json'));
  const version = versions[0];

  const data = JSON.parse(await get(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  ));

  const guessed = [];
  const champs = Object.keys(data.data).sort().map((id) => {
    const info = lanesFor(id, data.data[id].tags);
    if (info.guessed) guessed.push(id);
    return { id, name: data.data[id].name, lanes: info.lanes };
  });

  const lines = champs.map((c) =>
    `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, ` +
    `lanes: [${c.lanes.map((l) => JSON.stringify(l)).join(', ')}] }`
  ).join(',\n');

  const out = `/* ==========================================================================
   AQUABATTLE — seznam všech championů
   --------------------------------------------------------------------------
   Vygenerováno z Riot Data Dragon ${version}.
   \`id\` je klíč, jak ho zná Riot API (bez mezer a apostrofů) — používá se pro
   ikonky z CDN. \`name\` je zobrazované jméno. \`lanes\` jsou pozice, na kterých
   se champion hraje (první je hlavní) — podle tools/champion-lanes.js.

   Aktualizace po nové generaci championů:
     node tools/update-champions.js
   ========================================================================== */

window.DDRAGON_VERSION = ${JSON.stringify(version)};

window.CHAMPIONS = [
${lines}
];
`;

  const target = path.join(__dirname, '..', 'data', 'champions.js');
  fs.writeFileSync(target, out, 'utf8');
  console.log(`Zapsáno ${target} — ${champs.length} championů (Data Dragon ${version}).`);

  if (guessed.length) {
    console.warn('\nPozice odhadnuté z tagů (doplň je do tools/champion-lanes.js):');
    guessed.forEach((id) => console.warn('  - ' + id));
  }
})().catch((e) => {
  console.error('Nepodařilo se stáhnout seznam championů:', e.message);
  process.exit(1);
});
