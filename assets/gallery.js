/* Gallery: editorial justified rows. Photos are display-only (clicking does not open them).
   Photos come from the "gallery" folder, listed in assets/photos.js by update-photos.command.
   A sub-folder name becomes the heading of its group (e.g. gallery/Prometeo 2026/…). */
(function () {
  'use strict';

  var root = document.getElementById('gallery-root');
  if (!root) return;

  var photos = [];          // every photo shown

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] === true) n.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* "prometeo-2026" -> "Prometeo 2026"; "Film Sets" stays as written. */
  function nice(name) {
    var s = String(name || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  /* ---------------------------------------------------------------- loading */
  function load() {
    var list = ((window.SITE_PHOTOS || {}).gallery || []).filter(function (p) { return p && p.src; });
    return Promise.all(list.map(function (p, i) {
      return new Promise(function (resolve) {
        var url = encodeURI(p.src) + '?v=' + (p.added || 0);
        var im = new Image();
        im.onload = function () {
          var act = nice(p.activity);
          var cap = String(p.caption || '').trim();
          resolve({ src: url, w: im.naturalWidth, h: im.naturalHeight, activity: act, caption: cap, added: p.added || 0, idx: i,
            alt: cap || (act ? act + ' photograph' : 'Gallery photograph') });
        };
        im.onerror = function () { if (window.console) console.warn('Gallery: could not load ' + p.src); resolve(null); };
        im.src = url;
      });
    })).then(function (a) { return a.filter(function (p) { return p && p.w && p.h; }); });
  }

  /* ---------------------------------------------------------------- grouping + layout */
  function group() {
    var map = {};
    photos.forEach(function (p) {
      var key = p.activity || 'Moments';
      (map[key] = map[key] || []).push(p);
    });
    var groups = Object.keys(map).map(function (k) {
      var items = map[k].slice().sort(function (a, b) { return (b.added - a.added) || (a.idx - b.idx); });
      return { name: k, named: k !== 'Moments' || items.some(function (p) { return p.activity; }), items: items, latest: items[0].added };
    });
    groups.sort(function (a, b) { return (b.latest - a.latest) || a.name.localeCompare(b.name); });
    return groups;
  }

  /* Justified rows keep every photograph at its true aspect ratio. The first row
     of each activity is taller (featured); later rows are smaller (supporting). */
  function justify(items, W, gap) {
    var narrow = W < 560;
    var t0 = narrow ? W * 1.1 : Math.max(300, Math.min(540, W * 0.5));
    var t1 = narrow ? Math.max(150, W * 0.5) : Math.max(180, Math.min(300, W * 0.26));
    var rows = [], i = 0, n = items.length;
    while (i < n) {
      var target = rows.length ? t1 : t0;
      var row = [], sum = 0;
      while (i < n) {
        var ar = items[i].w / items[i].h;
        row.push(items[i]); sum += ar; i++;
        var h = (W - (row.length - 1) * gap) / sum;
        if (h <= target) {
          if (row.length > 1) {
            var prevSum = sum - ar, prevH = (W - (row.length - 2) * gap) / prevSum;
            if (Math.abs(Math.log(prevH / target)) < Math.abs(Math.log(h / target))) { row.pop(); sum = prevSum; i--; }
          }
          break;
        }
      }
      var hh = (W - (row.length - 1) * gap) / sum;
      var last = i >= n;
      if (last && hh > target) hh = target;                       // do not blow up the final row
      if (narrow && rows.length === 0 && row.length === 1) hh = Math.min(hh, W * 1.25);
      rows.push({ items: row, h: hh });
    }
    return rows;
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    root.textContent = '';

    if (!photos.length) { root.appendChild(emptyState()); return; }

    var W = Math.floor(root.clientWidth);
    var gap = W < 560 ? 10 : Math.max(12, Math.min(20, Math.round(W * 0.016)));
    var groups = group();
    /* Photos placed directly in gallery/ need no heading; only named sub-folders get one. */
    var plain = groups.length === 1 && !groups[0].named;
    groups.forEach(function (g) {
      var rows = justify(g.items, W, gap);
      var head = plain ? null : el('div', { class: 'reel__head' }, [el('h2', { text: g.name })]);
      var rowsEl = el('div', { class: 'rows' });
      rows.forEach(function (r) {
        var rowEl = el('div', { class: 'row' });
        r.items.forEach(function (p) {
          var w = Math.floor((p.w / p.h) * r.h * 10) / 10;
          var img = el('img', { src: p.src, alt: p.alt, width: p.w, height: p.h, loading: 'lazy', decoding: 'async' });
          var fig = el('figure', { class: 'shot' }, [img, p.caption ? el('figcaption', null, [el('span', { text: p.caption })]) : null]);
          fig.style.width = w + 'px';
          rowEl.appendChild(fig);
        });
        rowsEl.appendChild(rowEl);
      });
      root.appendChild(el('section', { class: 'reel reveal in' }, plain ? [rowsEl] : [head, rowsEl]));
    });
  }

  function emptyState() {
    var text = el('div', null, [
      el('h2', { text: 'The first frame is still to come.' }),
      el('p', { text: 'Photographs will appear here.' })
    ]);
    var art = el('img', { src: 'assets/scenes/sprig.svg', alt: '', 'aria-hidden': 'true' });
    return el('div', { class: 'gempty' }, [text, art]);
  }

  /* ---------------------------------------------------------------- go */
  var rt = null, lastW = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var w = Math.floor(root.clientWidth); if (w !== lastW) { lastW = w; if (photos.length) render(); } }, 160);
  });
  lastW = Math.floor(root.clientWidth);
  load().then(function (res) { photos = res; render(); });
})();
