/* Gallery: editorial justified rows, lightbox, and browser-local photo adding.
   Published photos come from assets/config.js (window.GALLERY_PHOTOS).
   Photos added with "Add photos" live in this browser's IndexedDB only. */
(function () {
  'use strict';

  var root = document.getElementById('gallery-root');
  if (!root || !window.Media) return;

  var Media = window.Media, Store = Media.Store, LIM = Media.LIMITS;
  var CFG = window.SITE_CONFIG || {};
  var OWNER = CFG.ownerTools !== false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var photos = [];          // every photo currently shown (published + local)
  var order = [];           // photos in display order (for the lightbox)
  var objectURLs = [];

  /* ---------------------------------------------------------------- helpers */
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
  function fmtDate(s) {
    if (!s) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function ts(s) { var d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime(); }

  /* ---------------------------------------------------------------- loading */
  function loadPublished() {
    var list = (window.GALLERY_PHOTOS || []).filter(function (p) { return p && p.src; });
    return Promise.all(list.map(function (p, i) {
      return new Promise(function (resolve) {
        function done(w, h) {
          resolve({ id: 'pub-' + i, src: p.src, w: w, h: h, title: p.title || '', activity: p.activity || '', date: p.date || '',
            caption: p.caption || '', featured: !!p.featured, local: false, added: 0 });
        }
        if (p.width && p.height) { done(p.width, p.height); return; }
        var im = new Image();
        im.onload = function () { done(im.naturalWidth, im.naturalHeight); };
        im.onerror = function () { if (window.console) console.warn('Gallery: could not load ' + p.src); resolve(null); };
        im.src = p.src;
      });
    })).then(function (a) { return a.filter(Boolean); });
  }

  function loadLocal() {
    return Store.listPhotos().then(function (recs) {
      return recs.map(function (r) {
        var url = URL.createObjectURL(r.blob);
        objectURLs.push(url);
        return { id: r.id, src: url, w: r.w, h: r.h, title: r.title || '', activity: r.activity || '', date: r.date || '',
          caption: r.caption || '', featured: !!r.featured, local: true, added: r.added || 0 };
      });
    });
  }

  function refresh() {
    objectURLs.forEach(function (u) { URL.revokeObjectURL(u); });
    objectURLs = [];
    return Promise.all([loadPublished(), loadLocal()]).then(function (res) {
      photos = res[0].concat(res[1]);
      render();
    });
  }

  /* ---------------------------------------------------------------- grouping + layout */
  function group() {
    var map = {};
    photos.forEach(function (p) {
      var key = (p.activity || '').trim() || 'Moments';
      (map[key] = map[key] || []).push(p);
    });
    var groups = Object.keys(map).map(function (k) {
      var items = map[k].slice().sort(function (a, b) {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        var d = ts(b.date) - ts(a.date);
        return d || (b.added - a.added);
      });
      var latest = Math.max.apply(null, items.map(function (p) { return ts(p.date); }));
      var dates = items.map(function (p) { return p.date; }).filter(Boolean).sort();
      return { name: k, items: items, latest: latest, dates: dates };
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
    order = [];
    var count = document.getElementById('gallery-count');
    if (count) count.textContent = photos.length ? photos.length + (photos.length === 1 ? ' photograph' : ' photographs') : 'No photographs yet';

    if (!photos.length) { root.appendChild(emptyState()); return; }

    var W = Math.floor(root.clientWidth);
    var gap = W < 560 ? 10 : Math.max(12, Math.min(20, Math.round(W * 0.016)));
    group().forEach(function (g) {
      var rows = justify(g.items, W, gap);
      var span = g.dates.length ? (fmtDate(g.dates[0]) + (g.dates.length > 1 && g.dates[0] !== g.dates[g.dates.length - 1] ? ' – ' + fmtDate(g.dates[g.dates.length - 1]) : '')) : '';
      var head = el('div', { class: 'reel__head' }, [
        el('h2', { text: g.name }),
        el('span', { text: [g.items.length + (g.items.length === 1 ? ' photo' : ' photos'), span].filter(Boolean).join(' · ') })
      ]);
      var rowsEl = el('div', { class: 'rows' });
      rows.forEach(function (r) {
        var rowEl = el('div', { class: 'row' });
        r.items.forEach(function (p) {
          var idx = order.push(p) - 1;
          var w = Math.floor((p.w / p.h) * r.h * 10) / 10;
          var alt = p.title || p.caption || (p.activity ? p.activity + ' photograph' : 'Gallery photograph');
          var img = el('img', { src: p.src, alt: alt, width: p.w, height: p.h, loading: 'lazy', decoding: 'async' });
          var btn = el('button', { type: 'button', class: 'open', 'data-i': idx, 'aria-label': 'Open: ' + alt }, [img]);
          var cap = (p.title || p.date) ? el('figcaption', null, [
            el('b', { text: p.title || '' }),
            el('i', { text: fmtDate(p.date) })
          ]) : null;
          var fig = el('figure', { class: 'shot' }, [btn, cap]);
          fig.style.width = w + 'px';
          if (p.local) {
            fig.appendChild(el('span', { class: 'tag', text: 'This browser' }));
            if (OWNER) fig.appendChild(removeButton(p));
          }
          rowEl.appendChild(fig);
        });
        rowsEl.appendChild(rowEl);
      });
      root.appendChild(el('section', { class: 'reel reveal in' }, [head, rowsEl]));
    });
  }

  function emptyState() {
    var text = el('div', null, [
      el('span', { class: 'eyebrow', text: 'Nothing here yet' }),
      el('h2', { text: 'The first frame is still to come.' }),
      el('p', { text: OWNER
        ? 'Add photographs of events, festivals, filming, teaching and projects. They are arranged by activity, and each one opens full size.'
        : 'Photographs from events, festivals, filming, teaching and projects will appear here.' })
    ]);
    if (OWNER) text.appendChild(el('button', { type: 'button', class: 'btn btn--solid', 'data-add': true, text: 'Add photos' }));
    var art = el('img', { src: 'assets/scenes/sprig.svg', alt: '', 'aria-hidden': 'true' });
    var box = el('div', { class: 'gempty' }, [text, art]);
    var b = box.querySelector('[data-add]');
    if (b) b.addEventListener('click', openAdd);
    return box;
  }

  function removeButton(p) {
    var b = el('button', { type: 'button', class: 'rm', 'aria-label': 'Remove this photograph from this browser', title: 'Remove', text: '✕' });
    var armed = null;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!armed) {
        b.textContent = 'Remove?'; b.style.width = 'auto'; b.style.padding = '0 10px'; b.style.opacity = 1; b.style.font = '600 0.62rem Inter, sans-serif';
        armed = setTimeout(function () { armed = null; b.textContent = '✕'; b.style.cssText = ''; }, 3000);
        return;
      }
      clearTimeout(armed);
      doRemove(p);
    });
    return b;
  }
  function doRemove(p) {
    Store.removePhoto(p.id).then(function () { closeLB(); return refresh(); });
  }

  /* ---------------------------------------------------------------- lightbox */
  var lb = document.getElementById('lightbox');
  var lbImg = lb && lb.querySelector('.lb__stage img');
  var cur = 0, opener = null;

  function showLB(i) {
    if (!order.length) return;
    cur = (i + order.length) % order.length;
    var p = order[cur];
    lbImg.src = p.src;
    lbImg.alt = p.title || p.caption || p.activity || 'Gallery photograph';
    lb.querySelector('.lb__count').textContent = (cur + 1) + ' / ' + order.length;
    var cap = lb.querySelector('.lb__cap');
    cap.textContent = '';
    var meta = [p.activity, fmtDate(p.date)].filter(Boolean).join(' · ');
    if (p.title) cap.appendChild(el('h3', { text: p.title }));
    if (p.caption) cap.appendChild(el('p', { text: p.caption }));
    if (meta) cap.appendChild(el('small', { text: meta }));
    if (p.local && OWNER) {
      var rm = el('button', { type: 'button', class: 'btn lb__rm', text: 'Remove from this browser' });
      var armed = false;
      rm.style.color = '#F4F3EF'; rm.style.borderColor = 'rgba(244,243,239,.5)';
      rm.addEventListener('click', function () {
        if (!armed) { armed = true; rm.textContent = 'Click again to remove'; setTimeout(function () { armed = false; rm.textContent = 'Remove from this browser'; }, 3000); return; }
        doRemove(p);
      });
      cap.appendChild(rm);
    }
    // preload neighbours
    [1, -1].forEach(function (d) { var q = order[(cur + d + order.length) % order.length]; if (q) { var im = new Image(); im.src = q.src; } });
  }
  function openLB(i, from) {
    opener = from || null;
    lb.setAttribute('data-open', 'true');
    document.documentElement.style.overflow = 'hidden';
    showLB(i);
    lb.querySelector('[data-lb-close]').focus();
  }
  function closeLB() {
    if (!lb || lb.getAttribute('data-open') !== 'true') return;
    lb.setAttribute('data-open', 'false');
    lbImg.removeAttribute('src');
    document.documentElement.style.overflow = '';
    if (opener && document.contains(opener)) opener.focus();
  }
  if (lb) {
    lb.querySelector('[data-lb-close]').addEventListener('click', closeLB);
    lb.querySelector('.lb__nav--prev').addEventListener('click', function () { showLB(cur - 1); });
    lb.querySelector('.lb__nav--next').addEventListener('click', function () { showLB(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb__stage')) closeLB(); });
    document.addEventListener('keydown', function (e) {
      if (lb.getAttribute('data-open') !== 'true') return;
      if (e.key === 'Escape') closeLB();
      else if (e.key === 'ArrowRight') showLB(cur + 1);
      else if (e.key === 'ArrowLeft') showLB(cur - 1);
      else if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(lb.querySelectorAll('button'), function (b) { return b.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) showLB(cur + (dx < 0 ? 1 : -1));
    });
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button.open');
    if (b) openLB(parseInt(b.getAttribute('data-i'), 10), b);
  });

  /* ---------------------------------------------------------------- add photos dialog */
  var dlg = document.getElementById('add-dlg');
  var draft = [];

  function openAdd() {
    if (!dlg) return;
    resetDraft();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('#file-input').focus();
  }
  function closeAdd() {
    if (!dlg) return;
    resetDraft();
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }
  function resetDraft() {
    draft.forEach(function (d) { URL.revokeObjectURL(d.url); });
    draft = [];
    var errs = dlg.querySelector('#errs'); errs.textContent = '';
    dlg.querySelector('#add-msg').textContent = '';
    dlg.querySelector('#file-input').value = '';
    renderDraft();
  }

  function addFiles(fileList) {
    var errs = dlg.querySelector('#errs');
    errs.textContent = '';
    var files = Array.prototype.slice.call(fileList || []);
    var room = LIM.maxLocalPhotos - photos.filter(function (p) { return p.local; }).length - draft.length;
    files.forEach(function (f) {
      var bad = Media.validate(f);
      if (!bad && room <= 0) bad = 'The limit of ' + LIM.maxLocalPhotos + ' photos in this browser has been reached.';
      if (bad) { errs.appendChild(el('li', { text: f.name + ': ' + bad })); return; }
      room--;
      var bulkAct = dlg.querySelector('#bulk-activity').value.trim();
      var bulkDate = dlg.querySelector('#bulk-date').value;
      draft.push({ id: Media.uid(), file: f, url: URL.createObjectURL(f), title: '', activity: bulkAct, date: bulkDate, caption: '', featured: false });
    });
    renderDraft();
  }

  function renderDraft() {
    var ul = dlg.querySelector('#prev');
    ul.textContent = '';
    dlg.querySelector('#bulk').hidden = !draft.length;
    var go = dlg.querySelector('#add-go');
    go.disabled = !draft.length;
    go.textContent = draft.length ? 'Add ' + draft.length + (draft.length === 1 ? ' photo' : ' photos') + ' to gallery' : 'Add to gallery';
    draft.forEach(function (d, i) {
      function field(label, key, type, wide) {
        var id = 'f-' + d.id + '-' + key;
        var inp = type === 'textarea' ? el('textarea', { id: id, rows: 2, maxlength: 400 }) : el('input', { id: id, type: type, maxlength: 120 });
        inp.value = d[key] || '';
        inp.addEventListener('input', function () { d[key] = inp.value; });
        return el('div', { class: 'field' + (wide ? ' wide' : '') }, [el('label', { 'for': id, text: label }), inp]);
      }
      var chkId = 'f-' + d.id + '-feat';
      var chk = el('input', { type: 'checkbox', id: chkId }); chk.checked = d.featured;
      chk.addEventListener('change', function () { d.featured = chk.checked; });
      var x = el('button', { type: 'button', class: 'x', 'aria-label': 'Remove ' + d.file.name + ' from this batch', text: '✕' });
      x.addEventListener('click', function () { URL.revokeObjectURL(d.url); draft.splice(i, 1); renderDraft(); });
      var fields = el('div', { class: 'fields' }, [
        field('Title', 'title', 'text'), field('Activity / event', 'activity', 'text'),
        field('Date', 'date', 'date'),
        el('label', { class: 'chk', 'for': chkId }, [chk, el('span', { text: 'Feature this photo (shown larger)' })]),
        field('Caption', 'caption', 'textarea', true)
      ]);
      ul.appendChild(el('li', null, [el('img', { src: d.url, alt: 'Preview of ' + d.file.name }), fields, x]));
    });
  }

  function commit() {
    var go = dlg.querySelector('#add-go'), msg = dlg.querySelector('#add-msg'), errs = dlg.querySelector('#errs');
    errs.textContent = '';
    go.disabled = true;
    var n = draft.length, done = 0, failed = 0;
    function step(i) {
      if (i >= n) return Promise.resolve();
      var d = draft[i];
      msg.textContent = 'Adding ' + (i + 1) + ' of ' + n + '…';
      return Media.processImage(d.file).then(function (r) {
        return Store.addPhoto({ id: d.id, blob: r.blob, w: r.w, h: r.h, title: d.title.trim(), activity: d.activity.trim(), date: d.date,
          caption: d.caption.trim(), featured: !!d.featured, added: Date.now() + i, type: r.blob.type });
      }).then(function () { done++; }).catch(function (e) {
        failed++;
        var quota = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)));
        errs.appendChild(el('li', { text: d.file.name + ': ' + (quota ? 'your browser has no storage space left for more photos.' : (e.message || 'could not be added.')) }));
      }).then(function () { return step(i + 1); });
    }
    step(0).then(function () { return refresh(); }).then(function () {
      if (!failed) { closeAdd(); announce(done + (done === 1 ? ' photo' : ' photos') + ' added.'); }
      else { msg.textContent = done + ' added, ' + failed + ' failed.'; draft = []; renderDraft(); go.disabled = true; }
      if (!Store.persistent) announce('Heads up: this browser blocked saving, so these photos last only until you leave this page.');
    });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  }

  function announce(t) { var a = document.getElementById('gallery-live'); if (a) a.textContent = t; }

  if (dlg) {
    dlg.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeAdd); });
    dlg.addEventListener('cancel', function () { resetDraft(); });
    dlg.querySelector('#file-input').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
    var drop = dlg.querySelector('#drop');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
    drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });
    function bulk(key, sel) {
      dlg.querySelector(sel).addEventListener('input', function (e) {
        draft.forEach(function (d) { d[key] = e.target.value; });
        dlg.querySelectorAll('.prev li').forEach(function (li, i) {
          var inp = li.querySelector('#f-' + draft[i].id + '-' + key); if (inp) inp.value = e.target.value;
        });
      });
    }
    bulk('activity', '#bulk-activity'); bulk('date', '#bulk-date');
    dlg.querySelector('#add-go').addEventListener('click', commit);
  }

  document.querySelectorAll('[data-open-add]').forEach(function (b) {
    if (!OWNER) { b.hidden = true; return; }
    b.addEventListener('click', openAdd);
  });
  document.querySelectorAll('[data-owner-only]').forEach(function (n) { n.hidden = !OWNER; });

  /* ---------------------------------------------------------------- go */
  var rt = null, lastW = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var w = Math.floor(root.clientWidth); if (w !== lastW) { lastW = w; if (photos.length) render(); } }, 160);
  });
  lastW = Math.floor(root.clientWidth);
  refresh().then(function () {
    if (!Store.persistent) {
      var n = document.getElementById('gallery-storage-warn'); if (n) n.hidden = false;
    }
  });
})();
