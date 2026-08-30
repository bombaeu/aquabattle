/* ==========================================================================
   Přegeneruje data/champions.js z aktuálního Riot Data Dragonu.
   Pusť po nové generaci championů:   node tools/update-champions.js
   ========================================================================== */

const https = require('https');
const fs = require('fs');
const path = require('path');

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

  const champs = Object.keys(data.data).sort().map((id) => ({ id, name: data.data[id].name }));
  const lines = champs
    .map((c) => `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)} }`)
    .join(',\n');

  const out = `/* ==========================================================================
   AQUABATTLE — seznam všech championů
   --------------------------------------------------------------------------
   Vygenerováno z Riot Data Dragon ${version}.
   \`id\` je klíč, jak ho zná Riot API (bez mezer a apostrofů) — používá se pro
   ikonky z CDN. \`name\` je zobrazované jméno.

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
})().catch((e) => {
  console.error('Nepodařilo se stáhnout seznam championů:', e.message);
  process.exit(1);
});
