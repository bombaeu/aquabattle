# 🌊 AQUABATTLE

Turnajový web pro LoL turnaj — soupisky, pick&ban, rozpis, pavouk, výsledky a statistiky.

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
| **Pick & Ban** | Živý draft championů — lobby, 10 banů, 10 picků |
| **Admin** | Soupisky, řízení draftu, zápis výsledků, názvy a barvy týmů |
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
| `data/champions.js` | Všichni championi (generovaný, needituj ručně) |
| `data/accounts.js` | Riot ID pro OP.GG — edituje admin |
| `data/preferences.js` | Champion pooly hráčů — edituje kapitán, veřejně se neservíruje |
| `data/teams.js` | Týmy, barvy, názvy, soupisky — edituje admin |
| `data/matches.js` | Rozpis, výsledky a statistiky — edituje admin |

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

## 1. Pick & Ban (živý draft championů)

Draft běží **na serveru**, takže ho dva kapitáni hrají proti sobě ze svých
počítačů a kdokoliv další ho může sledovat. Pořadí tahů hlídá server — kapitán
nemůže kliknout mimo pořadí ani vzít už vybraného championa.

| Kdo | Co může |
|---|---|
| **Pořadatel** (admin) | otevřít lobby, prohodit strany, zahájit draft, vrátit tah, zrušit, zaskočit za kapitána, zapsat výsledek |
| **Kapitán** | potvrdit se v lobby a klikat, když je jeho tým na tahu |
| **Divák** | jen kouká, přihlašovat se nemusí |

> Všechno ovládání draftu (zahájení, vrácení tahu, prohození stran, zrušení,
> zápis do zápasu) je **jen v Admin → Draft**. Na stránce Pick & Ban se
> kapitánům ani divákům neukáže — ti tam vidí čistě lobby a desku.

Na tah je **30 sekund**. Odpočet vidí všichni, ale po nule se nic nestane —
jen svítí, že se čeká. Nikdo nepřijde o pick kvůli časovému limitu.

Stránka se sama obnovuje, takže divákům i kapitánům naskakují tahy průběžně.
Rozehraný draft přežije i restart serveru.

### Hesla pro kapitány

V **Admin → Hesla kapitánů** vybereš, komu vygenerovat, a klikneš. Server
vyrobí náhodná hesla, **jednou** ti je ukáže (zkopíruj a rozešli) a uloží si
jen jejich otisk. Čitelná hesla nikde neleží — ani na disku, ani v repozitáři.

Kapitán se pak přihlásí přímo v sekci Pick & Ban tlačítkem *Přihlásit se jako
kapitán*. Ztracené heslo se nedá zobrazit, jen vygenerovat nové.

### Pořadí tahů

| Fáze | Pořadí |
|---|---|
| Bany 1 | B · R · B · R · B · R |
| Picky 1 | B · RR · BB · R |
| Bany 2 | R · B · R · B |
| Picky 2 | R · BB · R |

Dohromady 10 banů a 10 picků. Nad mřížkou je **časová osa všech 20 tahů**
rozdělená do těchto čtyř fází, takže je pořád vidět, co se zrovna děje:

- **bany** mají čárkovanou hranu a jsou odbarvené a přeškrtnuté
- **picky** mají plnou hranu a barvu v plné síle
- barva hrany říká, čí je tah; aktuální krok navíc svítí zlatě

Kdo je na tahu, se ukazuje i velkým pruhem nahoře — včetně toho, **pro kterého
hráče** se zrovna pická.

### Championi podle pozic

Mřížka jde filtrovat na TOP / JG / MID / ADC / SUPP. Když přijde pick, filtr
se **sám přepne** na pozici hráče, na kterého je řada, takže se nemusí hledat.
Filtr se dá kombinovat s hledáním podle jména.

Pozice championů jsou v `tools/champion-lanes.js` (Data Dragon je nezná).
Nově vydaný champion dostane pozici odhadem z tagů a generátor na něj upozorní.

### Champion pooly hráčů

**Pick & Ban → Preference týmu.** Kapitán se přihlásí ke svému týmu a každému
hráči nastaví championy, které na dané pozici hraje. Našeptávač nabízí jen
championy, co tu pozici umí.

Během draftu se mu ty championy **zvýrazní zlatě**, jakmile přijde pick na
jeho hráče — a mřížka se sama přepne na jeho pozici. Pick tím není nijak
omezený, vybrat jde pořád cokoliv.

> **Soupeř tvoje pooly nevidí.** Filtruje to server: kapitán dostane jen
> hráče ze svého týmu, divák nic, admin všechno. `data/preferences.js` se
> navíc vůbec neservíruje staticky — kdyby ano, stačilo by si otevřít URL
> a vědět, co banovat.

Kapitán může měnit jen hráče ze svého týmu; i to hlídá server, ne jen UI.

### Jak to odbavit

1. **Pořadatel** jde do **Admin → Draft**, vybere zápas a u něj hru
   (Hra 1 / 2 / 3). Otevře se **pick lobby**.
2. **Kapitáni** si otevřou Pick & Ban, přihlásí se a kliknou
   *✓ Jsem připraven*. Jejich karta zezelená — vidí to i pořadatel
   a diváci, živě.
3. Dokud je lobby otevřené, jdou **⇄ Prohodit strany** (jen pořadatel).
   Po zahájení už ne.
4. Pořadatel dá **▶ Zahájit draft**. Tlačítko funguje i když se někdo
   nepotvrdil — zeptá se ale na potvrzení.
5. Draft naskočí všem sám. Kapitánům je mřížka zamčená a zašedlá,
   dokud nejsou na tahu. **Diváci nemusí nic.**
6. **↶ Vrátit tah** (Admin → Draft), kdyby někdo ukliknul.
7. Na konci **↓ Zapsat do zápasu** — bany i championi se propíšou do té
   hry v rozpisu a tím i do statistik.

Picky se přiřazují hráčům v pořadí TOP → JG → MID → ADC → SUPP podle soupisky.
Když tým draftoval jinak, přehodíš championy u hráčů v **Admin → Výsledky**.

Seznam championů je v `data/champions.js` (Data Dragon). Po nové generaci ho
přegeneruješ:

```
node tools/update-champions.js
```

---

## 1b. Riot ID a OP.GG

V **Admin → Riot ID / OP.GG** přiřadíš každému hráči jeho Riot ID ve tvaru
`Jméno#TAG` a nastavíš region. Pak se objeví:

- **odkaz OP.GG u každého hráče** v kartě týmu
- **multisearch celého týmu** v hlavičce karty — otevře všech 5 naráz

U týmu, kde někomu Riot ID chybí, je na tlačítku vidět kolik jich je vyplněných
(např. `OP.GG (3/5)`). Hráč bez účtu prostě odkaz nemá, nikde se nic nerozbije.

### Hráč z jiného serveru

Každý hráč má vlastní přepínač regionu — kdyby ti třeba jeden hrál na EUW,
zatímco zbytek turnaje je na EUNE. Jeho profil pak vede na správný server
a v soupisce má místo `OP.GG` zlatý odznak s názvem regionu, ať je to vidět.

**Multisearch se u smíšeného týmu rozdělí.** OP.GG hledá vždycky jen v jednom
regionu, takže místo jednoho tlačítka budou dvě — `EUNE 4` a `EUW 1`.

> Když změníš **výchozí region turnaje**, hráči, co už mají účet vyplněný,
> zůstanou tam, kde byli — panel jim region ukotví a řekne ti o tom. Nová
> volba platí jen pro ty, které přidáš potom.

Účty se ukládají do `data/accounts.js` — schválně odděleně od `players.js`,
protože ten je referenční a čte se vždycky z repozitáře.

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
│   ├── champions.js       všichni championi (generovaný)
│   ├── accounts.js        Riot ID pro OP.GG (edituje admin)
│   ├── preferences.js     champion pooly (jen přes API, ne staticky)
│   ├── teams.js           týmy a soupisky (edituj)
│   ├── matches.js         rozpis a výsledky (edituj)
│   └── matches.demo.js    ukázka pro ?demo=1
├── tools/
│   ├── update-champions.js
│   └── champion-lanes.js  na jakých pozicích se který champion hraje
└── assets/
    ├── css/style.css
    └── js/
        ├── lib.js         výpočty tabulky a statistik
        ├── api.js         ukládání na server
        ├── components.js  scoreboardy, modaly, znaky
        ├── view-*.js      jednotlivé sekce
        ├── view-draftadmin.js  řízení draftu (Admin → Draft)
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

| | Prohlížení | Draft za svůj tým | Admin |
|---|---|---|---|
| Kdokoliv s odkazem | ✅ | ❌ | ❌ |
| Kapitán se svým heslem | ✅ | ✅ | ❌ |
| Kdo zná `ADMIN_PASSWORD` | ✅ | ✅ (za oba) | ✅ |

Přihlášení drží 30 dní. Server nepustí zápis ani draftový tah bez platného
tokenu, takže ani `curl` na API nic nezmění. Admin heslo je jen v proměnných
prostředí, hesla kapitánů jen jako otisk v `data/credentials.json` (ten je
mimo git). V repozitáři není ani jedno.

Lokálně přes `start.bat` běží server bez hesla (a jen na `127.0.0.1`), takže
se doma nemusíš přihlašovat.
