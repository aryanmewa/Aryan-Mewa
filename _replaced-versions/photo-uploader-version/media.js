/* Shared photo tools: browser-local storage (IndexedDB), image validation/resizing,
   and the portrait slot used on Home and About. No dependencies. */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var LIMITS = {
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    maxFileBytes: 15 * 1024 * 1024,
    maxSide: 2400,
    maxLocalPhotos: 80
  };

  /* ---------------------------------------------------------- IndexedDB store */
  var DB_NAME = 'aryan-portfolio-media', DB_VER = 1;
  var dbPromise = null;
  var mem = { photos: [], portrait: null };
  var Store = { persistent: true };

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('misc')) db.createObjectStore('misc');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB error')); };
      req.onblocked = function () { reject(new Error('IndexedDB blocked')); };
    });
    return dbPromise;
  }

  function run(storeName, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, mode);
        var req = fn(t.objectStore(storeName));
        t.oncomplete = function () { resolve(req ? req.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Transaction aborted')); };
      });
    });
  }

  function fallback(err) { Store.persistent = false; Store.lastError = err; }

  Store.listPhotos = function () {
    return run('photos', 'readonly', function (s) { return s.getAll(); })
      .then(function (r) { return r || []; })
      .catch(function (e) { fallback(e); return mem.photos.slice(); });
  };
  Store.addPhoto = function (rec) {
    return run('photos', 'readwrite', function (s) { return s.put(rec); })
      .catch(function (e) {
        fallback(e);
        if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))) throw e;
        mem.photos.push(rec);
      });
  };
  Store.removePhoto = function (id) {
    mem.photos = mem.photos.filter(function (p) { return p.id !== id; });
    return run('photos', 'readwrite', function (s) { return s['delete'](id); }).catch(function (e) { fallback(e); });
  };
  Store.getPortrait = function () {
    return run('misc', 'readonly', function (s) { return s.get('portrait'); })
      .then(function (r) { return r || null; })
      .catch(function (e) { fallback(e); return mem.portrait; });
  };
  Store.setPortrait = function (blob) {
    mem.portrait = blob;
    return run('misc', 'readwrite', function (s) { return s.put(blob, 'portrait'); }).catch(fallback);
  };

  /* ---------------------------------------------------------- validation + resize */
  function validate(file) {
    var name = (file.name || '').toLowerCase();
    if (/\.(heic|heif)$/.test(name) || /hei[cf]/.test(file.type || '')) {
      return 'HEIC/HEIF photos are not supported by browsers. Export or convert it to JPG first.';
    }
    if (LIMITS.types.indexOf(file.type) === -1) {
      return 'Unsupported format. Use JPG, PNG, WebP, GIF or AVIF.';
    }
    if (file.size > LIMITS.maxFileBytes) {
      return 'Larger than ' + Math.round(LIMITS.maxFileBytes / 1048576) + ' MB (this one is ' + (file.size / 1048576).toFixed(1) + ' MB).';
    }
    if (file.size === 0) return 'The file is empty.';
    return '';
  }

  function decode(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { resolve({ img: im, url: url, w: im.naturalWidth, h: im.naturalHeight }); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image.')); };
      im.src = url;
    });
  }

  /* Keeps the original when it is already small; otherwise scales (never distorts). */
  function processImage(file, maxSide) {
    maxSide = maxSide || LIMITS.maxSide;
    return decode(file).then(function (d) {
      var scale = Math.min(1, maxSide / Math.max(d.w, d.h));
      if (scale >= 1 || file.type === 'image/gif') {
        URL.revokeObjectURL(d.url);
        return { blob: file, w: d.w, h: d.h };
      }
      var w = Math.round(d.w * scale), h = Math.round(d.h * scale);
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(d.img, 0, 0, w, h);
      URL.revokeObjectURL(d.url);
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { b ? resolve({ blob: b, w: w, h: h }) : reject(new Error('Could not resize this image.')); }, 'image/jpeg', 0.92);
      });
    });
  }

  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  window.Media = { LIMITS: LIMITS, Store: Store, validate: validate, processImage: processImage, uid: uid, config: CFG };

  /* ---------------------------------------------------------- portrait slots */
  var portraitURL = null;

  function applyPortrait(src, isLocal) {
    document.querySelectorAll('[data-portrait]').forEach(function (fig) {
      var img = fig.querySelector('img');
      var ph = fig.querySelector('.portrait__ph');
      var rep = fig.querySelector('.portrait__replace');
      if (!src) {
        if (img) img.hidden = true;
        if (ph) ph.hidden = false;
        if (rep) rep.hidden = true;
        return;
      }
      img.onload = function () { img.hidden = false; if (ph) ph.hidden = true; if (rep) rep.hidden = !isLocal; };
      img.onerror = function () { img.hidden = true; if (ph) ph.hidden = false; };
      img.src = src;
    });
  }

  function chooseLocalPortrait() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = LIMITS.types.join(',');
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var bad = validate(f);
      if (bad) { window.alert(bad); return; }
      processImage(f, 1800).then(function (r) {
        return Store.setPortrait(r.blob).then(function () {
          if (portraitURL) URL.revokeObjectURL(portraitURL);
          portraitURL = URL.createObjectURL(r.blob);
          applyPortrait(portraitURL, true);
        });
      }).catch(function (e) { window.alert(e.message || 'Could not add that photo.'); });
    };
    inp.click();
  }

  function initPortraits() {
    var figs = document.querySelectorAll('[data-portrait]');
    if (!figs.length) return;
    var owner = CFG.ownerTools !== false;
    figs.forEach(function (fig) {
      var add = fig.querySelector('[data-add-portrait]');
      var rep = fig.querySelector('.portrait__replace');
      if (add) { add.hidden = !owner; add.addEventListener('click', chooseLocalPortrait); }
      if (rep) rep.addEventListener('click', chooseLocalPortrait);
    });
    if (CFG.portrait) {
      // A file is configured: use it, and fall back to a locally added one if it is missing.
      var probe = new Image();
      probe.onload = function () { applyPortrait(CFG.portrait, false); };
      probe.onerror = useLocal;
      probe.src = CFG.portrait;
    } else {
      useLocal();
    }
    function useLocal() {
      Store.getPortrait().then(function (blob) {
        if (blob) { portraitURL = URL.createObjectURL(blob); applyPortrait(portraitURL, true); }
        else applyPortrait('', false);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPortraits);
  else initPortraits();
})();
