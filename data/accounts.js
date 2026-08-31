/* ==========================================================================
   AQUABATTLE — herní účty hráčů (Riot ID pro OP.GG)
   --------------------------------------------------------------------------
   Mapuje id hráče z players.js na jeho Riot ID ve tvaru  Jméno#TAG.

   Hráč z výchozího regionu je prostý řetězec. Kdo hraje jinde, má objekt
   s vlastním regionem — třeba jeden EUW hráč mezi EUNE. Multisearch se pak
   sám rozdělí, protože OP.GG umí hledat vždycky jen v jednom regionu.

     'dargy':  'dargy#EUNE',
     'losik':  { id: 'losik#EUW', region: 'euw' },

   Tenhle soubor edituje admin (Soupisky → Riot ID / OP.GG), takže je
   schválně oddělený od players.js — ten je referenční a čte se vždy z repa.

   Regiony: eune | euw | na | kr | br | jp | oce | tr | ru | las | lan
            sg | ph | th | tw | vn | me
   ========================================================================== */

window.OPGG_REGION = 'eune';

window.ACCOUNTS = {
  // 'dargy': 'dargy#EUNE',
};
