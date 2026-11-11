/* Home portrait: shows the newest photo in the profile-photo folder (listed in assets/photos.js).
   If there is none, the placeholder stays visible. */
(function () {
  'use strict';
  var P = (window.SITE_PHOTOS || {}).portrait;
  var figs = document.querySelectorAll('[data-portrait]');
  if (!P || !P.src || !figs.length) return;
  var url = encodeURI(P.src) + '?v=' + (P.added || 0);
  figs.forEach(function (fig) {
    var img = fig.querySelector('img');
    var ph = fig.querySelector('.portrait__ph');
    if (!img) return;
    img.onload = function () { img.hidden = false; if (ph) ph.hidden = true; };
    img.onerror = function () { img.hidden = true; if (ph) ph.hidden = false; };
    img.src = url;
  });
})();
