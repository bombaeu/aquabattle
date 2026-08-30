/* AQUABATTLE — rozpis, výsledky a statistiky.
   Uloženo z admin panelu 30. 8. 2026 20:07:47.
   Skóre sérií se nezapisuje, dopočítává se z vyhraných her. */

window.SCHEDULE = [
  {
    id: "R1M1",
    round: 1,
    a: "riptide", b: "maelstrom",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R1M2",
    round: 1,
    a: "kraken", b: "coral",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R1M3",
    round: 1,
    a: "abyss", b: "tsunami",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R2M1",
    round: 2,
    a: "riptide", b: "coral",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R2M2",
    round: 2,
    a: "maelstrom", b: "tsunami",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R2M3",
    round: 2,
    a: "kraken", b: "abyss",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R3M1",
    round: 3,
    a: "riptide", b: "tsunami",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R3M2",
    round: 3,
    a: "coral", b: "abyss",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R3M3",
    round: 3,
    a: "maelstrom", b: "kraken",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R4M1",
    round: 4,
    a: "riptide", b: "abyss",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R4M2",
    round: 4,
    a: "tsunami", b: "kraken",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R4M3",
    round: 4,
    a: "coral", b: "maelstrom",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R5M1",
    round: 5,
    a: "riptide", b: "kraken",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R5M2",
    round: 5,
    a: "abyss", b: "maelstrom",
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "R5M3",
    round: 5,
    a: "tsunami", b: "coral",
    date: null,
    status: "scheduled",
    games: []
  }
];

window.PLAYOFFS = [
  {
    id: "SF1",
    stage: "semi", label: "Semifinále 1", seedA: 1, seedB: 4,
    a: null, b: null,
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "SF2",
    stage: "semi", label: "Semifinále 2", seedA: 2, seedB: 3,
    a: null, b: null,
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "BR3",
    stage: "third", label: "O 3. místo", from: ["SF1:loser", "SF2:loser"],
    a: null, b: null,
    date: null,
    status: "scheduled",
    games: []
  },
  {
    id: "FIN",
    stage: "final", label: "FINÁLE", from: ["SF1:winner", "SF2:winner"],
    a: null, b: null,
    date: null,
    status: "scheduled",
    games: []
  }
];
