/* ==========================================================================
   AQUABATTLE — POOL HRÁČŮ
   --------------------------------------------------------------------------
   Zdroj: AQUABATTLE_serazeno.xlsx (list "Prehled")

   Každý hráč má JEDEN rank + body a SEZNAM rolí, které umí hrát.
   Body podle ranku:  MASTER 400 | DIAMOND 350 | EMERALD 300 | PLATINUM 250
                      GOLD 200 | SILVER 150 | BRONZE 100 | IRON 50

   Přidání hráče = přidat řádek do POOL. `id` musí být unikátní (bez mezer).
   ========================================================================== */

/* Barvy odpovídají emblémům v klientu. */
window.RANKS = {
  MASTER:   { label: 'Master',   short: 'M',  color: '#B44FD0', order: 8 },
  DIAMOND:  { label: 'Diamond',  short: 'D',  color: '#7B9FE8', order: 7 },
  EMERALD:  { label: 'Emerald',  short: 'E',  color: '#20A45E', order: 6 },
  PLATINUM: { label: 'Platinum', short: 'P',  color: '#4EA8A0', order: 5 },
  GOLD:     { label: 'Gold',     short: 'G',  color: '#E0AA43', order: 4 },
  SILVER:   { label: 'Silver',   short: 'S',  color: '#9AA4AF', order: 3 },
  BRONZE:   { label: 'Bronze',   short: 'B',  color: '#A2704A', order: 2 },
  IRON:     { label: 'Iron',     short: 'I',  color: '#7E7B78', order: 1 }
};

window.ROLES = {
  TOP:  { label: 'Top',     icon: '⚔' },
  JG:   { label: 'Jungle',  icon: '🌿' },
  MID:  { label: 'Mid',     icon: '✦' },
  ADC:  { label: 'Bot',     icon: '🏹' },
  SUPP: { label: 'Support', icon: '✚' }
};

/* Strop soupisky: kapitánovy body za rank + jeho rozpočet = vždy 1400,
   takže všechny týmy vyjdou nastejno. Slabší kapitán dostane víc peněz. */
window.SALARY_CAP = 1400;

/* Kapitáni — každý zakládá jeden tým.
   `budget` = kolik bodů může utratit za 4 spoluhráče (= SALARY_CAP - points). */
window.CAPTAINS = [
  { id: 'ricci',    name: 'ricci',    rank: 'MASTER',  points: 400, budget: 1000, roles: ['MID'] },
  { id: 'Dortomet', name: 'Dortomet', rank: 'EMERALD', points: 300, budget: 1100, roles: ['SUPP', 'TOP'] },
  { id: 'florad',   name: 'florad',   rank: 'EMERALD', points: 300, budget: 1100, roles: ['MID', 'ADC'] },
  { id: 'Martin',   name: 'Martin',   rank: 'EMERALD', points: 300, budget: 1100, roles: ['ADC'] },
  { id: 'Bella',    name: 'Bella',    rank: 'BRONZE',  points: 100, budget: 1300, roles: ['SUPP'] },
  { id: 'tropix',   name: 'tropix',   rank: 'BRONZE',  points: 100, budget: 1300, roles: ['ADC', 'JG'] }
];

/* Draftovatelný pool — 33 hráčů. */
window.POOL = [
  { id: 'dargy',       name: 'dargy',       rank: 'MASTER',   points: 400, roles: ['TOP', 'MID'] },
  { id: 'dan',         name: 'dan',         rank: 'MASTER',   points: 400, roles: ['JG', 'SUPP'] },
  { id: 'shay',        name: 'shay',        rank: 'MASTER',   points: 400, roles: ['JG', 'ADC'] },
  { id: 'sedesi',      name: 'sedesi',      rank: 'MASTER',   points: 400, roles: ['MID', 'ADC'] },

  { id: 'losik',       name: 'losik',       rank: 'DIAMOND',  points: 350, roles: ['TOP', 'MID'] },
  { id: 'Richard',     name: 'Richard',     rank: 'DIAMOND',  points: 350, roles: ['TOP', 'ADC'] },
  { id: 'marek',       name: 'marek',       rank: 'DIAMOND',  points: 350, roles: ['JG', 'MID'] },
  { id: 'Mrkev',       name: 'Mrkev',       rank: 'DIAMOND',  points: 350, roles: ['MID', 'SUPP'] },

  { id: 'Kuba',        name: 'Kuba',        rank: 'EMERALD',  points: 300, roles: ['TOP', 'JG'] },
  { id: 'Mario',       name: 'Mario',       rank: 'EMERALD',  points: 300, roles: ['TOP', 'ADC'] },
  { id: 'Sebzub',      name: 'Sebzub',      rank: 'EMERALD',  points: 300, roles: ['JG', 'MID'] },
  { id: 'spajdy',      name: 'spajdy',      rank: 'EMERALD',  points: 300, roles: ['JG', 'MID'] },
  { id: 'ya_boi_emil', name: 'ya_boi_emil', rank: 'EMERALD',  points: 300, roles: ['JG', 'SUPP'] },
  { id: 'Echo',        name: 'Echo',        rank: 'EMERALD',  points: 300, roles: ['MID', 'ADC'] },

  { id: 'jeromino',    name: 'jeromino',    rank: 'PLATINUM', points: 250, roles: ['TOP', 'JG', 'MID', 'ADC', 'SUPP'] },
  { id: 'pery',        name: 'pery',        rank: 'PLATINUM', points: 250, roles: ['TOP', 'MID'] },
  { id: 'tomasshyb',   name: 'tomasshyb',   rank: 'PLATINUM', points: 250, roles: ['TOP', 'MID'] },
  { id: 'bomba',       name: 'bomba',       rank: 'PLATINUM', points: 250, roles: ['JG', 'SUPP'] },
  { id: 'bruska',      name: 'bruska',      rank: 'PLATINUM', points: 250, roles: ['SUPP'] },
  { id: 'sherko',      name: 'sherko',      rank: 'PLATINUM', points: 250, roles: ['JG', 'SUPP'] },
  { id: 'malta',       name: 'malta',       rank: 'PLATINUM', points: 250, roles: ['JG', 'MID'] },
  { id: 'jarvyn',      name: 'jarvyn',      rank: 'PLATINUM', points: 250, roles: ['MID', 'ADC'] },
  { id: 'shadow',      name: 'shadow',      rank: 'PLATINUM', points: 250, roles: ['MID', 'ADC'] },
  { id: 'shinigami',   name: 'shinigami',   rank: 'PLATINUM', points: 250, roles: ['MID', 'SUPP'] },

  { id: 'mczgstudio',  name: 'mczgstudio',  rank: 'GOLD',     points: 200, roles: ['TOP', 'MID'] },
  { id: 'ramelon',     name: 'ramelon',     rank: 'GOLD',     points: 200, roles: ['TOP', 'JG'] },
  { id: 'pekys',       name: 'pekys',       rank: 'GOLD',     points: 200, roles: ['JG', 'MID'] },
  { id: 'stepekk',     name: 'stepekk',     rank: 'GOLD',     points: 200, roles: ['MID', 'SUPP'] },

  { id: 'gerald',      name: 'gerald',      rank: 'SILVER',   points: 150, roles: ['TOP', 'JG', 'MID', 'ADC', 'SUPP'] },
  { id: 'key the cat', name: 'key the cat', rank: 'SILVER',   points: 150, roles: ['TOP', 'MID'] },
  { id: 'matty',       name: 'matty',       rank: 'SILVER',   points: 150, roles: ['TOP', 'MID'] },

  { id: 'Armin',       name: 'Armin',       rank: 'BRONZE',   points: 100, roles: ['TOP', 'SUPP'] },
  { id: 'prochy',      name: 'prochy',      rank: 'BRONZE',   points: 100, roles: ['TOP', 'SUPP'] },
  { id: 'dori',        name: 'dori',        rank: 'BRONZE',   points: 100, roles: ['JG', 'ADC'] },
  { id: 'linzal',      name: 'linzal',      rank: 'BRONZE',   points: 100, roles: ['JG', 'MID', 'ADC', 'SUPP'] },

  { id: 'ethias',      name: 'ethias',      rank: 'IRON',     points: 50,  roles: ['ADC', 'SUPP'] }
];
