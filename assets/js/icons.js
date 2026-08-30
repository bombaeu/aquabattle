/* ==========================================================================
   AQUABATTLE — ikony pozic a ornamenty
   --------------------------------------------------------------------------
   Ikonky pozic jsou kreslené inline (ne z CDN), takže fungují i offline,
   škálují se a barví se přes `currentColor`.

   Vizuální jazyk je stejný jako v klientu: lajny = kosočtverec mapy se
   zvýrazněnou částí, jungle = list, support = štít.
   ========================================================================== */
(function (w) {
  'use strict';
  var AB = w.AB;

  var MAP = '<path d="M12 1.9 22.1 12 12 22.1 1.9 12Z" stroke="currentColor" stroke-width="1.25" opacity=".34"/>';

  var SVG = {
    TOP: MAP +
      '<path d="M5.7 12 12 5.7" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',

    MID: MAP +
      '<path d="M8.3 15.7 15.7 8.3" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',

    ADC: MAP +
      '<path d="M12 18.3 18.3 12" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',

    JG:
      '<path d="M20.2 3.4c-9.3.5-14.2 5.2-14.2 11 0 2 .7 3.7 1.9 4.8 1.9-4 5.2-7.9 9.7-10.7-3.7 3.2-6.4 7.2-7.8 11.8 1 .4 2 .6 3 .6 4.9 0 8-4.9 7.4-17.5Z" fill="currentColor"/>',

    SUPP:
      '<path d="M12 2.3 20.5 6v6c0 4.8-3.6 7.9-8.5 9.6C7.1 19.9 3.5 16.8 3.5 12V6Z" stroke="currentColor" stroke-width="1.35" opacity=".55"/>' +
      '<path d="M12 8.3v7.4M8.3 12h7.4" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>'
  };

  /** Ikonka pozice jako <span> s vloženým SVG. */
  AB.roleIcon = function (role, cls) {
    var span = AB.el('span.role-ico' + (cls ? '.' + String(cls).trim().split(/\s+/).join('.') : ''), {
      title: (w.ROLES[role] || {}).label || role,
      'aria-label': (w.ROLES[role] || {}).label || role
    });
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      (SVG[role] || '') + '</svg>';
    return span;
  };

  /** Zlatý kosočtverec mezi dvěma linkami — oddělovač sekcí. */
  AB.ornament = function () {
    return AB.el('span.ornament', { html: '<i></i><b></b><i></i>' });
  };

})(window);
