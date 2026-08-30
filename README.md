# 🌊 AQUABATTLE

Turnajový web pro LoL turnaj — draft, rozpis, pavouk, výsledky a statistiky.

## Spuštění

**Dvojklik na `start.bat`** — spustí server a otevře prohlížeč na
`http://localhost:8099`. Potřebuje jen [Node.js](https://nodejs.org), nic se
neinstaluje.

Se serverem admin panel **zapisuje rovnou do `data/*.js`** — nic nekopíruješ.
Předchozí verze souborů se schovávají do `data/.backup/` (posledních 20).

> `index.html` jde otevřít i přímo bez serveru, ale pak je to jen ke čtení —
> změny v adminu zůstanou v prohlížeči a do souborů se nezapíšou. Panel na to
> upozorní červeným pruhem.

---

## Co kde je

| Sekce | K čemu slouží |
|---|---|
| **Přehled** | Tabulka skupiny, nejbližší zápasy, poslední výsledky, top výkony |
| **Týmy** | Soupisky všech 6 týmů podle pozic + srovnání síly |
| **Draft** | Live nástroj — kapitáni pickují v snake pořadí |
| **Admin** | Rozřazení hráčů na pozice, zápis výsledků, názvy a barvy týmů |
| **Zápasy** | Všech 15 sérií skupiny po kolech. Klik na dohraný zápas → detail |
| **Pavouk** | Playoff TOP 4. Týmy se doplní samy podle konečné tabulky |
| **Statistiky** | Žebříčky, tabulka všech hráčů (řaditelná), přehled championů |
| **Hráči** | Celý pool s ranky, pozicemi a profily |

### Náhled s odehraným turnajem

Otevři `index.html?demo=1` — načte vygenerovaný turnaj, ať vidíš, jak to bude
vypadat plné. Ostrá data v `data/matches.js` to nijak nezmění.

---

## Datové soubory

Všechno se edituje ve složce `data/`. Jsou to obyčejné `.js` soubory (ne JSON),
aby web fungoval i po prostém dvojkliku na `index.html` bez serveru.

| Soubor | Obsah |
|---|---|
| `data/players.js` | Pool hráčů a kapitánů — jména, ranky, body, pozice |
| `data/teams.js` | Týmy, barvy, názvy, soupisky |
| `data/matches.js` | Rozpis, výsledky a statistiky jednotlivých her |

---

## Strop soupisky (salary cap)

Každý tým smí dohromady stát **1400 bodů**. Kapitán se do stropu počítá svým
rankem a zbytek je jeho rozpočet na 4 spoluhráče:

| kapitán | rank | body | rozpočet na tým |
|---|---|---|---|
| ricci | Master | 400 | 1000 |
| Dortomet, florad, Martin | Emerald | 300 | 1100 |
| Bella, tropix | Bronze | 100 | 1300 |

Slabší kapitán dostane víc peněz, takže všechny týmy vyjdou nastejno.
Náhradníci se do stropu nepočítají. Strop změníš přes `window.SALARY_CAP`
v `data/players.js`.

---

## 1a. Admin panel — rozřazení pozic

Záložka **Admin** je na ruční skládání týmů:

- Klik na slot → vybereš hráče. Nabídne jen ty, co danou pozici umí.
- Hráč se automaticky uvolní z předchozího týmu, nemůže hrát za dva.
- U každého vidíš cenu; co se nevejde do rozpočtu, má červený rámeček.
- **Auto-rozdělení** doplní volné sloty tak, aby nikdo nepřestřelil strop.
- **Názvy a barvy** mění název, zkratku a barvu týmu.

Se spuštěným serverem se každá změna hned zapíše do `data/teams.js`.

---

## 1. Draft

1. V záložce **Draft** klikni na **Pozice kapitánů** a nastav, na co budou
   kapitáni hrát (zamkne se po prvním picku).
2. Kapitáni klikají na hráče v snake pořadí. Když hráč umí víc chybějících
   pozic, vyskočí výběr role.
3. Průběh se sám ukládá do prohlížeče — refresh o nic nepřijde. Překlik se
   vrací tlačítkem **↶ Zpět**.
4. Se spuštěným serverem se picky zapisují do `data/teams.js` průběžně.

> Bez serveru draft žije jen v tvém prohlížeči a jinde ho nikdo neuvidí.

Nástroj hlídá, aby se tým nezabetonoval — když by ti po picku nezbyl nikdo na
volnou pozici, upozorní tě dřív, než pick potvrdíš. U chybějících pozic vidíš
i počet dostupných hráčů (červeně, když jsou ≤ 2).

### Změna názvů a barev týmů

V `data/teams.js` uprav `name`, `tag` (3 písmena do znaku) a `color`.
Barva se propíše všude — do znaků, tabulky, pavouka i grafů.

---

## 2. Zápis výsledků

**Admin → Výsledky zápasů.** Klikni na sérii, dej **+ Přidat hru** a přepiš
čísla z end-game screenu. Sestavy se předvyplní ze soupisek, takže doplňuješ
jen championa a statistiky. Ukládá se samo — badge nahoře hlásí zapsáno.

- Vítěze hry přepneš tlačítkem se jménem týmu.
- **⇄** prohodí modrou a červenou stranu.
- Skóre série (2:1 apod.) se nikde nezadává, dopočítá se z vyhraných her.
- Tabulka, postupy do playoff i všechny statistiky se přepočítají samy.

Můžeš mi taky poslat screenshot a přepíšu ti to sám.

<details>
<summary>Ruční editace souboru (když bys chtěl)</summary>

V `data/matches.js` najdi sérii podle `id` a doplň `games`:

```js
{ id: 'R1M1', round: 1, a: 'riptide', b: 'maelstrom', date: null, status: 'done',
  games: [
    {
      duration: '31:47',
      winner: 'blue',                    // 'blue' nebo 'red'
      blue: {
        team: 'riptide',                 // id týmu
        bans: ['Yone', 'KSante'],
        towers: 9, inhibs: 2, dragons: 3, barons: 1, heralds: 1,
        players: [
          { role:'TOP',  player:'losik', champ:'Aatrox', k:5, d:2, a:7,
            cs:212, gold:14200, dmg:24800, taken:31200, vision:18 },
          // ...zbylí 4 hráči
        ]
      },
      red: { team:'maelstrom', /* stejná struktura */ }
    }
    // ...další hry série
  ]
}
```

**Pozor:** admin panel tenhle soubor přegeneruje při prvním uložení, takže
ruční úpravy přepíše.

</details>

### Jména championů

Klíč bez mezer a apostrofů, jak ho zná Riot API:
`KSante`, `Belveth`, `ChoGath`, `DrMundo`, `JarvanIV`, `KaiSa`, `KhaZix`,
`LeeSin`, `MasterYi`, `MissFortune`, `MonkeyKing` (Wukong), `Nunu`, `RekSai`,
`TahmKench`, `TwistedFate`, `VelKoz`, `XinZhao`.

Ikonky se tahají z CDN automaticky. Když se název netrefí, zobrazí se místo
ikonky iniciály — nic se nerozbije.

---

## 3. Náhradníci

Sub sloty jsou připravené — v `data/teams.js` přidej id hráčů do `subs`:

```js
subs: ['gerald', 'linzal']
```

Objeví se v kartě týmu pod základní pětkou.

---

## Formát turnaje

- **Skupina:** každý s každým, 15 sérií v 5 kolech, všechno BO3
- **Playoff:** TOP 4, semifinále 1–4 a 2–3, pak finále a zápas o 3. místo
- **Řazení v tabulce:** výhry v sériích → rozdíl her → vzájemný zápas → rozdíl killů

Chceš jiný formát? Uprav `window.SCHEDULE` a `window.PLAYOFFS` v `data/matches.js`.

---

## Struktura

```
league/
├── start.bat              spusť tímhle
├── server.js              lokální server + zápis do data/
├── index.html
├── data/
│   ├── .backup/           automatické zálohy před každým uložením
│   ├── players.js         pool hráčů (edituj)
│   ├── teams.js           týmy a soupisky (edituj)
│   ├── matches.js         rozpis a výsledky (edituj)
│   └── matches.demo.js    ukázka pro ?demo=1
└── assets/
    ├── css/style.css
    └── js/
        ├── lib.js         výpočty tabulky a statistik
        ├── api.js         ukládání na server
        ├── components.js  scoreboardy, modaly, znaky
        ├── view-*.js      jednotlivé sekce
        └── app.js         router
```

---

## Nasazení na Railway

Aby admin fungoval i online, musí běžet Node server — samotné GitHub Pages
nestačí (ty umí jen statické soubory).

### 1. Vytvoř projekt

Na [railway.app](https://railway.app) dej **New Project → Deploy from GitHub
repo** a vyber tenhle repozitář. Railway pozná `package.json` a spustí
`npm start` sám, nic nekonfiguruješ.

### 2. Nastav heslo

V **Variables** přidej:

```
ADMIN_PASSWORD = <tvoje heslo>
```

> **Bez tohohle to nepustí ven.** Když `ADMIN_PASSWORD` chybí, server
> naslouchá jen na `127.0.0.1` a na Railway bude nedostupný. Je to schválně —
> je to pojistka proti tomu vystavit admin bez hesla.

### 3. Přidej volume (jinak přijdeš o data)

Railway má **pomíjivý filesystem** — po každém deployi nebo restartu se vrátí
do stavu z gitu. Bez volume by ti zmizely soupisky i výsledky.

1. **New → Volume**, připoj ke službě, mount path třeba `/app/persist`
2. Do Variables přidej `DATA_DIR = /app/persist`

Při prvním startu se volume naplní daty z repozitáře, od té chvíle je zdrojem
pravdy volume. V logu uvidíš `[seed] …`. Když `DATA_DIR` zapomeneš, server na
to při startu upozorní.

### 4. Doména

**Settings → Networking → Generate Domain**. Tu adresu můžeš posílat divákům —
turnaj si prohlédnou bez přihlášení, na admin se dostane jen kdo zná heslo.

---

## Kdo co smí

| | Prohlížení | Admin |
|---|---|---|
| Kdokoliv s odkazem | ✅ | ❌ |
| Kdo zná `ADMIN_PASSWORD` | ✅ | ✅ |

Přihlášení drží 30 dní. Server nepustí zápis bez platného tokenu, takže ani
`curl` na API nic nezmění. Heslo je jen v proměnných prostředí — v repozitáři
nikde není.

Lokálně přes `start.bat` běží server bez hesla (a jen na `127.0.0.1`), takže
se doma nemusíš přihlašovat.
