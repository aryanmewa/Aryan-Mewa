/* Shows PDF buttons (data-report="greenSynthesis" or "cv") when a PDF is present in the matching folder,
   as listed in assets/photos.js by update-photos.command. Without a PDF the button stays hidden. */
(function () {
  'use strict';
  var R = (window.SITE_PHOTOS || {}).reports || {};
  document.querySelectorAll('[data-report]').forEach(function (a) {
    var r = R[a.getAttribute('data-report')];
    if (!r || !r.src) return;
    a.href = encodeURI(r.src) + '?v=' + (r.added || 0);
    a.hidden = false;
  });
  /* links that normally go to a page but should open the PDF itself when one exists */
  document.querySelectorAll('[data-report-link]').forEach(function (a) {
    var r = R[a.getAttribute('data-report-link')];
    if (!r || !r.src) return;
    a.href = encodeURI(r.src) + '?v=' + (r.added || 0);
    a.target = '_blank'; a.rel = 'noopener';
  });
})();
