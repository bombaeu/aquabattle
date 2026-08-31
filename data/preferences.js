/* ==========================================================================
   AQUABATTLE — champion pooly hráčů
   --------------------------------------------------------------------------
   Kapitán si tu pro každého svého hráče nastaví, co obvykle hraje. Během
   draftu se mu ti championi v mřížce zvýrazní, jakmile přijde pick na jeho
   pozici — ale pořád jde vybrat cokoliv jiného.

   Formát:  'id hráče z players.js': ['Champion', 'Champion', ...]

   POZOR: tenhle soubor se schválně NEservíruje staticky. Chodí jen přes
   /api/preferences profiltrovaný podle přihlášení — kapitán vidí jen svůj
   tým, divák nic. Jinak by si soupeř mohl stáhnout, co plánujeme hrát,
   a podle toho banovat.

   Edituje se z webu (Pick & Ban → Preference týmu), ručně sem lézt nemusíš.
   ========================================================================== */

window.PREFERENCES = {
  // 'dargy': ['Aatrox', 'Camille', 'KSante'],
};
