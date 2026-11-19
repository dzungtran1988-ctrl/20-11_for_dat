/**
 * gallery.js — the family memory gallery
 *
 *   • Polaroid gallery built from SITE_DATA.memories (photos in assets/images/)
 *   • Accessible lightbox: buttons, ← / → keys, Esc, swipe on touch screens
 *   • Optional photos added from the browser, stored in IndexedDB.
 *     They live ONLY in the browser/device where they were added.
 *   • JSON backup export / import (with validation) to move or restore them
 *
 * Exposes window.Gallery.init(), called once by main.js.
 */
(function () {
  'use strict';

  const CONFIG = {
    dbName: 'qua-20-11-cho-bo',
    dbVersion: 1,
    storeName: 'photos',
    exportApp: 'qua-20-11-cho-bo',
    exportVersion: 1,
    maxDimension: 1600,          // longest side after compression (px)
    jpegQuality: 0.82,
    maxInputBytes: 40 * 1024 * 1024,   // per selected photo
    maxImportBytes: 300 * 1024 * 1024, // per backup file
    maxImportPhotos: 500,
    maxCaption: 140,
    maxDate: 40,
  };

  // Deterministic "scrapbook" variety — the same photo always gets the same look.
  const TILTS = [-2.4, 1.8, -1.1, 2.6, -1.8, 1.2, -0.6, 2.2, -2.9, 0.9];
  const SHIFTS = [0, 18, -4, 10, -12, 6, 20, -6, 4, 12];
  const SIZES = ['md', 'sm', 'lg', 'sm', 'md', 'lg', 'sm', 'md'];
  const TAPE_TILTS = [-3, 4, -2, 2.5, -4];
  const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,/;

  /* ------------------------------------------------------------------------
   * Helpers
   * --------------------------------------------------------------------- */
  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const uid = () =>
    (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const isQuotaError = (err) =>
    !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22);

  function toArrayBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Response(blob).arrayBuffer();
  }

  function readFileAsText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  /** "data:image/jpeg;base64,…" → Blob. Throws on anything unexpected. */
  function dataURLToBlob(dataUrl) {
    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) throw new Error('unsupported-format');
    const binary = atob(dataUrl.slice(match[0].length)); // throws on invalid base64
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: match[1] });
  }

  /* ------------------------------------------------------------------------
   * IndexedDB — a tiny promise wrapper. Images are stored as ArrayBuffers
   * (most compatible across browsers), never in localStorage.
   * --------------------------------------------------------------------- */
  const PhotoStore = (() => {
    let dbPromise = null;

    function isSupported() {
      try { return typeof window.indexedDB !== 'undefined' && window.indexedDB !== null; } catch (e) { return false; }
    }

    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        let request;
        try { request = window.indexedDB.open(CONFIG.dbName, CONFIG.dbVersion); } catch (err) { reject(err); return; }
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(CONFIG.storeName)) db.createObjectStore(CONFIG.storeName, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('indexeddb-blocked'));
      });
      dbPromise.catch(() => { dbPromise = null; });
      return dbPromise;
    }

    function run(mode, work) {
      return open().then((db) => new Promise((resolve, reject) => {
        let tx;
        try { tx = db.transaction(CONFIG.storeName, mode); } catch (err) { reject(err); return; }
        let result;
        const request = work(tx.objectStore(CONFIG.storeName));
        if (request) request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('transaction-aborted'));
      }));
    }

    return {
      isSupported,
      getAll: () => run('readonly', (s) => s.getAll())
        .then((list) => (list || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))),
      put: (record) => run('readwrite', (s) => s.put(record)),
      remove: (id) => run('readwrite', (s) => s.delete(id)),
      clear: () => run('readwrite', (s) => s.clear()),
    };
  })();

  /* ------------------------------------------------------------------------
   * Image decoding & compression (canvas → JPEG)
   * --------------------------------------------------------------------- */

  /** Decodes via <img>, which applies EXIF rotation in modern browsers. */
  function decodeImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode-failed')); };
      img.src = url;
    });
  }

  /** Resizes to maxDimension and re-encodes as JPEG. Returns { blob, width, height }. */
  async function compressImage(blob) {
    const decoded = await decodeImage(blob);
    try {
      const { width: w0, height: h0 } = decoded;
      if (!w0 || !h0) throw new Error('decode-failed');
      const scale = Math.min(1, CONFIG.maxDimension / Math.max(w0, h0));
      const width = Math.max(1, Math.round(w0 * scale));
      const height = Math.max(1, Math.round(h0 * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas-unavailable');
      ctx.fillStyle = '#FFFFFF'; // transparent PNGs get a white background
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(decoded.source, 0, 0, width, height);

      const out = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), 'image/jpeg', CONFIG.jpegQuality);
      });
      canvas.width = 0; // free memory early (helps on iOS)
      canvas.height = 0;

      // Small JPEGs that are already optimised: keep the original bytes.
      if (scale === 1 && blob.type === 'image/jpeg' && blob.size <= out.size) return { blob, width, height };
      return { blob: out, width, height };
    } finally {
      decoded.release();
    }
  }

  /* ------------------------------------------------------------------------
   * State
   * --------------------------------------------------------------------- */
  const state = {
    initialized: false,
    items: [],
    config: {},
    toast: () => {},
    reduceMotion: () => false,
    els: {},
    renderQueued: false,
    busy: false,
    canUpload: false,
  };

  const lb = { list: [], index: 0, opener: null, swipedAt: 0 };

  const visibleItems = () => state.items.filter((item) => !item.broken);

  function fromStatic(memory, index) {
    if (!memory || typeof memory.src !== 'string' || !memory.src.trim()) return null;
    return {
      key: `s${index}`,
      source: 'static',
      src: memory.src.trim(),
      caption: cleanText(memory.caption, 300),
      date: cleanText(memory.date, 80),
      size: ['sm', 'md', 'lg'].includes(memory.size) ? memory.size : null,
      broken: false,
    };
  }

  function fromRecord(record) {
    const blob = new Blob([record.data], { type: record.type || 'image/jpeg' });
    return {
      key: `l${record.id}`,
      id: record.id,
      source: 'local',
      src: URL.createObjectURL(blob),
      caption: record.caption || '',
      date: record.date || '',
      width: record.width,
      height: record.height,
      createdAt: record.createdAt || 0,
      size: null,
      broken: false,
    };
  }

  /** Prepackaged photos first, then browser-added ones in the order they were added. */
  function sortItems() {
    const statics = state.items.filter((i) => i.source === 'static');
    const locals = state.items.filter((i) => i.source === 'local').sort((a, b) => a.createdAt - b.createdAt);
    state.items = statics.concat(locals);
  }

  /* ------------------------------------------------------------------------
   * Rendering
   * --------------------------------------------------------------------- */
  function render() {
    const { list, empty, section } = state.els;
    const items = visibleItems();
    const frag = document.createDocumentFragment();
    items.forEach((item, i) => frag.appendChild(createPolaroid(item, i)));
    list.textContent = '';
    list.appendChild(frag);
    list.hidden = items.length === 0;
    empty.hidden = items.length > 0;
    if (state.config.hideWhenEmpty) section.hidden = items.length === 0;
    // While the album is empty, the empty state's own "Thêm ảnh" button is enough.
    if (state.canUpload) state.els.tools.hidden = items.length === 0 && !state.els.tools.open;
  }

  function queueRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => { state.renderQueued = false; render(); });
  }

  function createPolaroid(item, index) {
    const li = document.createElement('li');
    li.className = 'polaroid-item';
    li.dataset.size = item.size || SIZES[index % SIZES.length];
    li.style.setProperty('--tilt', `${TILTS[index % TILTS.length]}deg`);
    li.style.setProperty('--shift', `${SHIFTS[index % SHIFTS.length]}px`);
    li.style.setProperty('--i', String(index));
    if (item.width && item.height) li.style.setProperty('--ar', String(clamp(item.width / item.height, 0.68, 1.45)));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'polaroid';
    btn.dataset.key = item.key;
    btn.setAttribute('aria-label', `Xem ảnh lớn: ${item.caption || `Ảnh kỷ niệm ${index + 1}`}`);

    if (index % 3 !== 1) {
      const tape = document.createElement('span');
      tape.className = 'polaroid__tape';
      tape.style.setProperty('--tape-tilt', `${TAPE_TILTS[index % TAPE_TILTS.length]}deg`);
      tape.setAttribute('aria-hidden', 'true');
      btn.appendChild(tape);
    }

    const frame = document.createElement('span');
    frame.className = 'polaroid__photo';
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => {
      if (!item.width && img.naturalWidth) {
        item.width = img.naturalWidth;
        item.height = img.naturalHeight;
        li.style.setProperty('--ar', String(clamp(item.width / item.height, 0.68, 1.45)));
      }
      li.classList.add('is-loaded');
    }, { once: true });
    img.addEventListener('error', () => markBroken(item), { once: true });
    img.src = item.src;
    frame.appendChild(img);
    btn.appendChild(frame);

    if (item.caption) {
      const caption = document.createElement('span');
      caption.className = 'polaroid__caption';
      caption.textContent = item.caption;
      btn.appendChild(caption);
    }
    if (item.date) {
      const date = document.createElement('span');
      date.className = 'polaroid__date';
      date.textContent = item.date;
      btn.appendChild(date);
    }
    const spacer = document.createElement('span');
    spacer.className = 'polaroid__spacer';
    spacer.setAttribute('aria-hidden', 'true');
    btn.appendChild(spacer);

    li.appendChild(btn);
    return li;
  }

  /** A listed photo could not be loaded — hide it and tell the editor why. */
  function markBroken(item) {
    if (item.broken) return;
    item.broken = true;
    console.warn(`[Album] Không tải được ảnh "${item.src}" — kiểm tra lại tên file trong js/data.js (phân biệt chữ hoa/thường).`);
    queueRender();
  }

  /* ------------------------------------------------------------------------
   * Lightbox
   * --------------------------------------------------------------------- */
  function initLightbox() {
    const { dialog, stage, img, closeBtn, prevBtn, nextBtn, deleteBtn } = state.els;
    if (!dialog) return;

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));
    deleteBtn.addEventListener('click', deleteCurrent);

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      else if (event.key === 'Escape' && typeof dialog.showModal !== 'function') closeLightbox();
    });
    dialog.addEventListener('close', onLightboxClosed);

    // Tap/click on the dark area around the photo closes the lightbox.
    dialog.addEventListener('click', (event) => {
      if (performance.now() - lb.swipedAt < 400) return;
      if (event.target === dialog || event.target === stage) closeLightbox();
    });

    // Swipe left / right on touch screens.
    let startX = null;
    let startY = null;
    stage.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      startX = event.clientX;
      startY = event.clientY;
    });
    stage.addEventListener('pointerup', (event) => {
      if (startX === null) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      startX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        lb.swipedAt = performance.now();
        step(dx < 0 ? 1 : -1);
      }
    });
    stage.addEventListener('pointercancel', () => { startX = null; });

    img.addEventListener('load', () => img.classList.remove('is-loading'));
    img.addEventListener('error', () => {
      img.classList.remove('is-loading');
      const item = lb.list[lb.index];
      if (item && item.source === 'static') markBroken(item);
    });
  }

  function openLightbox(item, opener) {
    const { dialog } = state.els;
    const list = visibleItems();
    const index = list.indexOf(item);
    if (!dialog || index < 0) return;
    lb.list = list;
    lb.index = index;
    lb.opener = opener || null;
    showCurrent();
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
      dialog.classList.add('is-fallback');
      state.els.closeBtn.focus();
    }
    document.documentElement.classList.add('is-locked');
  }

  function showCurrent() {
    const { img, lbCaption, lbDate, figcaption, counter, prevBtn, nextBtn, localFoot } = state.els;
    const item = lb.list[lb.index];
    if (!item) return;
    const total = lb.list.length;

    if (img.getAttribute('src') !== item.src) {
      img.classList.add('is-loading');
      img.src = item.src;
    }
    if (img.complete && img.naturalWidth) img.classList.remove('is-loading');
    img.alt = item.caption || `Ảnh kỷ niệm ${lb.index + 1}`;

    lbCaption.textContent = item.caption || '';
    lbDate.textContent = item.date || '';
    figcaption.hidden = !item.caption && !item.date;
    counter.textContent = `${lb.index + 1} / ${total}`;
    prevBtn.hidden = total < 2;
    nextBtn.hidden = total < 2;
    localFoot.hidden = item.source !== 'local';

    // Warm up neighbours for smooth navigation.
    [lb.index - 1, lb.index + 1].forEach((i) => {
      const neighbour = lb.list[(i + total) % total];
      if (neighbour && neighbour !== item) { const pre = new Image(); pre.src = neighbour.src; }
    });
  }

  function step(direction) {
    const total = lb.list.length;
    if (total < 2) return;
    lb.index = (lb.index + direction + total) % total;
    showCurrent();
  }

  function closeLightbox() {
    const { dialog } = state.els;
    if (!dialog || !dialog.hasAttribute('open')) return;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      dialog.classList.remove('is-fallback');
      onLightboxClosed();
    }
  }

  function onLightboxClosed() {
    document.documentElement.classList.remove('is-locked');
    const opener = lb.opener;
    lb.opener = null;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    else if (state.els.list && state.els.list.firstElementChild) {
      const first = state.els.list.querySelector('.polaroid');
      if (first) first.focus({ preventScroll: true });
    }
  }

  async function deleteCurrent() {
    const item = lb.list[lb.index];
    if (!item || item.source !== 'local') return;
    const ok = window.confirm('Xoá ảnh này khỏi album trên trình duyệt này?\n\nNếu chưa sao lưu, bạn sẽ không khôi phục lại được.');
    if (!ok) return;
    try {
      await PhotoStore.remove(item.id);
    } catch (err) {
      console.error('[Album] delete failed', err);
      setStatus('Không xoá được ảnh. Vui lòng thử lại.');
      return;
    }
    URL.revokeObjectURL(item.src);
    state.items = state.items.filter((i) => i !== item);
    render();
    lb.list = visibleItems();
    lb.opener = null;
    if (!lb.list.length) { closeLightbox(); return; }
    lb.index = Math.min(lb.index, lb.list.length - 1);
    showCurrent();
  }

  /* ------------------------------------------------------------------------
   * Optional: add photos from this browser
   * --------------------------------------------------------------------- */
  function setStatus(message) {
    if (state.els.status) state.els.status.textContent = message;
  }

  function initTools() {
    const els = state.els;
    state.canUpload = true;
    els.emptyAdd.hidden = false;
    render();

    els.fileInput.addEventListener('change', () => {
      const files = els.fileInput.files || [];
      const n = files.length;
      els.chosen.textContent = n === 0 ? 'Chưa chọn ảnh nào' : (n === 1 ? files[0].name : `Đã chọn ${n} ảnh`);
      els.saveBtn.disabled = n === 0 || state.busy;
      if (n) setStatus('');
    });

    els.form.addEventListener('submit', onSubmit);
    els.exportBtn.addEventListener('click', exportBackup);
    els.importBtn.addEventListener('click', () => els.importInput.click());
    els.importInput.addEventListener('change', () => {
      const file = els.importInput.files && els.importInput.files[0];
      els.importInput.value = '';
      if (file) importBackup(file);
    });
    els.clearBtn.addEventListener('click', clearLocal);

    // "Thêm ảnh" in the empty state opens the panel and the file picker.
    els.emptyAdd.addEventListener('click', () => {
      els.tools.hidden = false;
      els.tools.open = true;
      els.fileInput.click();
    });
  }

  function setBusy(on) {
    const els = state.els;
    state.busy = on;
    els.form.setAttribute('aria-busy', String(on));
    els.saveBtn.disabled = on || !(els.fileInput.files && els.fileInput.files.length);
    [els.exportBtn, els.importBtn, els.clearBtn].forEach((b) => { b.disabled = on; });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (state.busy) return;
    const els = state.els;
    const files = Array.from(els.fileInput.files || []);
    if (!files.length) { setStatus('Hãy chọn ít nhất một ảnh.'); return; }

    setBusy(true);
    const caption = cleanText(els.caption.value, CONFIG.maxCaption);
    const date = cleanText(els.date.value, CONFIG.maxDate);
    const failed = [];
    let added = 0;
    let quotaHit = false;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      setStatus(files.length > 1 ? `Đang xử lý ảnh ${i + 1}/${files.length}…` : 'Đang xử lý ảnh…');
      try {
        if (file.type && !file.type.startsWith('image/')) throw new Error('not-an-image');
        if (file.size > CONFIG.maxInputBytes) throw new Error('too-large');
        const { blob, width, height } = await compressImage(file);
        const record = {
          id: uid(),
          data: await toArrayBuffer(blob),
          type: blob.type || 'image/jpeg',
          caption,
          date,
          width,
          height,
          createdAt: Date.now() + i,
        };
        await PhotoStore.put(record);
        state.items.push(fromRecord(record));
        added += 1;
      } catch (err) {
        console.warn('[Album] Could not add', file.name, err);
        if (isQuotaError(err)) { quotaHit = true; break; }
        failed.push(file.name);
      }
    }

    sortItems();
    render();

    if (added) {
      els.form.reset();
      els.chosen.textContent = 'Chưa chọn ảnh nào';
      requestPersistentStorage();
    }

    const parts = [];
    if (added) parts.push(`Đã thêm ${added} ảnh vào album.`);
    if (failed.length) parts.push(`Không đọc được: ${failed.join(', ')} — hãy thử ảnh JPG hoặc PNG.`);
    if (quotaHit) parts.push('Bộ nhớ của trình duyệt đã đầy, không thể lưu thêm ảnh.');
    setStatus(parts.join(' '));
    setBusy(false);
  }

  /** Ask the browser not to evict our photos when storage runs low. */
  function requestPersistentStorage() {
    try {
      if (navigator.storage && typeof navigator.storage.persist === 'function') navigator.storage.persist().catch(() => {});
    } catch (e) { /* ignore */ }
  }

  async function exportBackup() {
    if (state.busy) return;
    let records;
    try {
      records = await PhotoStore.getAll();
    } catch (err) {
      setStatus('Không đọc được ảnh đã lưu trên trình duyệt này.');
      return;
    }
    if (!records.length) {
      setStatus('Chưa có ảnh nào được thêm trên trình duyệt này để sao lưu.');
      return;
    }

    setBusy(true);
    setStatus('Đang chuẩn bị bản sao lưu…');
    try {
      const photos = [];
      for (const r of records) {
        photos.push({
          id: r.id,
          caption: r.caption || '',
          date: r.date || '',
          width: r.width || null,
          height: r.height || null,
          createdAt: r.createdAt || Date.now(),
          image: await blobToDataURL(new Blob([r.data], { type: r.type || 'image/jpeg' })),
        });
      }
      const payload = {
        app: CONFIG.exportApp,
        version: CONFIG.exportVersion,
        exportedAt: new Date().toISOString(),
        count: photos.length,
        photos,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `album-tang-bo-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus(`Đã tạo bản sao lưu gồm ${photos.length} ảnh. Hãy cất file .json này ở nơi an toàn.`);
    } catch (err) {
      console.error('[Album] export failed', err);
      setStatus('Không tạo được bản sao lưu. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  /** Validates the backup structure. Returns the list of usable photo entries, or null. */
  function validateBackup(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (payload.app !== CONFIG.exportApp) return null;
    if (typeof payload.version !== 'number' || payload.version > CONFIG.exportVersion) return null;
    if (!Array.isArray(payload.photos)) return null;
    return payload.photos.slice(0, CONFIG.maxImportPhotos);
  }

  async function importBackup(file) {
    if (state.busy) return;
    if (file.size > CONFIG.maxImportBytes) { setStatus('File sao lưu quá lớn.'); return; }

    setBusy(true);
    setStatus('Đang đọc bản sao lưu…');
    try {
      let payload;
      try {
        payload = JSON.parse(await readFileAsText(file));
      } catch (err) {
        setStatus('File này không đọc được — có thể không phải bản sao lưu album (.json).');
        return;
      }

      const entries = validateBackup(payload);
      if (!entries) { setStatus('File này không phải bản sao lưu album hợp lệ.'); return; }
      if (!entries.length) { setStatus('Bản sao lưu không có ảnh nào.'); return; }

      const existing = new Set((await PhotoStore.getAll()).map((r) => r.id));
      let added = 0;
      let skipped = 0;
      let invalid = 0;
      let quotaHit = false;

      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        setStatus(`Đang khôi phục ảnh ${i + 1}/${entries.length}…`);
        if (!entry || typeof entry !== 'object' || typeof entry.image !== 'string') { invalid += 1; continue; }
        const id = (typeof entry.id === 'string' && /^[\w-]{1,80}$/.test(entry.id)) ? entry.id : uid();
        if (existing.has(id)) { skipped += 1; continue; }
        try {
          let blob = dataURLToBlob(entry.image);
          // Decoding proves it is a real image (and gives its size).
          const decoded = await decodeImage(blob);
          let { width, height } = decoded;
          decoded.release();
          if (Math.max(width, height) > CONFIG.maxDimension * 1.05 || blob.size > 3.5 * 1024 * 1024) {
            ({ blob, width, height } = await compressImage(blob));
          }
          const createdAt = Number(entry.createdAt);
          const record = {
            id,
            data: await toArrayBuffer(blob),
            type: blob.type || 'image/jpeg',
            caption: cleanText(entry.caption, CONFIG.maxCaption),
            date: cleanText(entry.date, CONFIG.maxDate),
            width,
            height,
            createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() + i,
          };
          await PhotoStore.put(record);
          existing.add(id);
          state.items.push(fromRecord(record));
          added += 1;
        } catch (err) {
          if (isQuotaError(err)) { quotaHit = true; break; }
          invalid += 1;
        }
      }

      sortItems();
      render();
      if (added) requestPersistentStorage();

      let message = `Đã khôi phục ${added} ảnh`;
      if (skipped) message += `, bỏ qua ${skipped} ảnh đã có sẵn`;
      if (invalid) message += `, ${invalid} ảnh bị lỗi`;
      message += '.';
      if (quotaHit) message += ' Bộ nhớ của trình duyệt đã đầy nên chưa khôi phục hết.';
      setStatus(message);
    } catch (err) {
      console.error('[Album] import failed', err);
      setStatus('Không khôi phục được bản sao lưu. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function clearLocal() {
    if (state.busy) return;
    const locals = state.items.filter((i) => i.source === 'local');
    if (!locals.length) { setStatus('Chưa có ảnh nào được thêm trên trình duyệt này.'); return; }
    const ok = window.confirm(
      `Xoá ${locals.length} ảnh đã thêm trên trình duyệt này?\n\n` +
      'Ảnh có sẵn trong website không bị ảnh hưởng. Nếu chưa sao lưu, bạn sẽ không khôi phục lại được.'
    );
    if (!ok) return;
    try {
      await PhotoStore.clear();
    } catch (err) {
      setStatus('Không xoá được. Vui lòng thử lại.');
      return;
    }
    locals.forEach((i) => URL.revokeObjectURL(i.src));
    state.items = state.items.filter((i) => i.source !== 'local');
    render();
    setStatus('Đã xoá các ảnh đã thêm trên trình duyệt này.');
  }

  /* ------------------------------------------------------------------------
   * Init
   * --------------------------------------------------------------------- */
  async function init(options) {
    if (state.initialized) return; // never bind listeners twice
    state.initialized = true;

    const opts = options || {};
    state.config = opts.config || {};
    if (typeof opts.toast === 'function') state.toast = opts.toast;
    if (typeof opts.reduceMotion === 'function') state.reduceMotion = opts.reduceMotion;

    state.els = {
      section: byId('ky-niem'),
      list: byId('polaroids'),
      empty: byId('gallery-empty'),
      emptyAdd: byId('gallery-empty-add'),
      tools: byId('album-tools'),
      form: byId('album-form'),
      fileInput: byId('photo-input'),
      chosen: byId('photo-chosen'),
      caption: byId('photo-caption'),
      date: byId('photo-date'),
      saveBtn: byId('photo-save'),
      exportBtn: byId('album-export'),
      importBtn: byId('album-import-btn'),
      importInput: byId('album-import'),
      clearBtn: byId('album-clear'),
      status: byId('album-status'),
      dialog: byId('lightbox'),
      stage: byId('lightbox-stage'),
      img: byId('lightbox-img'),
      lbCaption: byId('lightbox-caption'),
      lbDate: byId('lightbox-date'),
      figcaption: byId('lightbox-figcaption'),
      counter: byId('lightbox-counter'),
      closeBtn: byId('lightbox-close'),
      prevBtn: byId('lightbox-prev'),
      nextBtn: byId('lightbox-next'),
      localFoot: byId('lightbox-local'),
      deleteBtn: byId('lightbox-delete'),
    };

    const { list } = state.els;
    if (!list) return;

    const memories = Array.isArray(opts.memories) ? opts.memories : [];
    state.items = memories.map(fromStatic).filter(Boolean);

    // One delegated listener for every polaroid (survives re-renders).
    list.addEventListener('click', (event) => {
      const btn = event.target.closest('.polaroid');
      if (!btn) return;
      const item = state.items.find((i) => i.key === btn.dataset.key);
      if (item) openLightbox(item, btn);
    });

    initLightbox();
    render();

    if (state.config.allowUploads === false || !PhotoStore.isSupported()) return;
    try {
      const records = await PhotoStore.getAll();
      records.forEach((record) => {
        if (record && record.data) state.items.push(fromRecord(record));
      });
      sortItems();
      initTools(); // renders
    } catch (err) {
      console.info('[Album] IndexedDB is not available here — adding photos from the browser is disabled.', err);
    }
  }

  window.Gallery = { init };
})();
