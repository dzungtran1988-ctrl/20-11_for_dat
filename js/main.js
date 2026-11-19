/**
 * main.js — renders the content from js/data.js and wires up the experience:
 *
 *   1. Content rendering (text, quote, cards, letter)
 *   2. Envelope intro & opening sequence
 *   3. Scroll reveals
 *   4. Flip cards
 *   5. Final hug (floating hearts)
 *   6. Background music toggle
 *
 * The photo gallery & lightbox live in js/gallery.js.
 * No personal text lives here — edit js/data.js instead.
 */
(function () {
  'use strict';

  // Tells the safety net in index.html that the script started correctly.
  window.__giftReady = true;

  const root = document.documentElement;
  const DATA = window.SITE_DATA;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => motionQuery.matches;

  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

  /* ------------------------------------------------------------------------
   * Small utilities
   * --------------------------------------------------------------------- */

  // Icons from Lucide (https://lucide.dev, ISC licence), inlined so the site
  // has no runtime dependency.
  const ICONS = {
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    feather: '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>',
    coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2"/><path d="M10 2v2"/><path d="M14 2v2"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    star: '<path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  };

  /** Returns an <svg> element for one of the icons above. */
  function icon(name, className, filled) {
    const paths = ICONS[name] || ICONS.heart;
    const attrs = filled
      ? 'fill="currentColor" stroke="none"'
      : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
    const tpl = document.createElement('template');
    tpl.innerHTML = `<svg viewBox="0 0 24 24" ${attrs} aria-hidden="true" focusable="false">${paths}</svg>`;
    const svg = tpl.content.firstElementChild;
    if (className) svg.setAttribute('class', className);
    return svg;
  }

  /** Reads "a.b.c" from an object. */
  function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  /**
   * Safely writes text into an element (never parsed as HTML), drawing every
   * ❤️ / ❤ as a small inline heart so it matches the palette on every device.
   */
  function setText(el, value) {
    el.textContent = '';
    String(value).split(/(❤️|❤)/).forEach((part) => {
      if (!part) return;
      if (part === '❤️' || part === '❤') el.appendChild(icon('heart', 'inline-heart', true));
      else el.appendChild(document.createTextNode(part));
    });
  }

  const isEmpty = (value) => value == null || String(value).trim() === '';

  /** localStorage wrapped in try/catch (private mode, blocked storage…). */
  const storage = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ } },
  };

  /** A short, polite status message at the bottom of the screen. */
  const toast = (() => {
    const el = $('#toast');
    let timer = 0;
    return (message, duration = 4500) => {
      if (!el) return;
      el.textContent = message;
      // next frame so the transition runs even when the element was empty
      requestAnimationFrame(() => el.classList.add('is-visible'));
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove('is-visible');
        setTimeout(() => { if (!el.classList.contains('is-visible')) el.textContent = ''; }, 400);
      }, duration);
    };
  })();

  /** Removes an element from keyboard / screen reader reach (or restores it). */
  function setInert(el, on) {
    if (!el) return;
    if ('inert' in el) el.inert = on;
    else if (on) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
  }

  /* ------------------------------------------------------------------------
   * 1. Content rendering
   * --------------------------------------------------------------------- */

  function renderContent() {
    if (DATA.meta && !isEmpty(DATA.meta.title)) document.title = DATA.meta.title;

    // Simple text bindings: <p data-text="message.intro"></p>
    $$('[data-text]').forEach((el) => {
      const value = getPath(DATA, el.dataset.text);
      if (isEmpty(value)) { el.hidden = true; return; }
      setText(el, value);
    });

    renderQuote();
    renderCards();
    renderLetter();
  }

  function renderQuote() {
    const el = $('#message-quote');
    const lines = [].concat((DATA.message && DATA.message.quote) || []).filter((l) => !isEmpty(l));
    lines.forEach((line, i) => {
      const span = document.createElement('span');
      span.className = 'quote-line';
      span.setAttribute('data-enter', '');
      span.style.setProperty('--d', String(500 + i * 500));
      setText(span, line);
      if (i > 0) el.appendChild(document.createTextNode(' '));
      el.appendChild(span);
    });
  }

  function renderCards() {
    const list = $('#cards');
    const cfg = DATA.cards || {};
    const items = Array.isArray(cfg.items) ? cfg.items : [];
    const frag = document.createDocumentFragment();

    items.forEach((card, i) => {
      const li = document.createElement('li');
      li.className = 'flip-card';
      li.style.setProperty('--i', String(i));

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flip-card__btn';
      btn.setAttribute('aria-pressed', 'false');

      // Front face
      const front = document.createElement('span');
      front.className = 'flip-card__face flip-card__face--front';

      const top = document.createElement('span');
      top.className = 'flip-card__top';
      top.setAttribute('aria-hidden', 'true');
      const num = document.createElement('span');
      num.className = 'flip-card__num';
      num.textContent = String(i + 1).padStart(2, '0');
      const iconWrap = document.createElement('span');
      iconWrap.className = 'flip-card__icon';
      iconWrap.appendChild(icon(card.icon));
      top.append(num, iconWrap);

      const title = document.createElement('span');
      title.className = 'flip-card__title';
      setText(title, card.front || '');

      const hint = document.createElement('span');
      hint.className = 'flip-card__hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.append(icon('rotate'), document.createTextNode(cfg.flipHint || ''));

      front.append(top, title, hint);

      // Back face
      const back = document.createElement('span');
      back.className = 'flip-card__face flip-card__face--back';

      const mark = document.createElement('span');
      mark.className = 'flip-card__mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '“';

      const text = document.createElement('span');
      text.className = 'flip-card__text';
      setText(text, card.back || '');

      const backHint = document.createElement('span');
      backHint.className = 'flip-card__back-hint';
      backHint.setAttribute('aria-hidden', 'true');
      backHint.append(icon('rotate'), document.createTextNode(cfg.flipBackHint || ''));

      back.append(mark, text, backHint);

      btn.append(front, back);
      li.appendChild(btn);
      frag.appendChild(li);
    });

    list.appendChild(frag);
  }

  function renderLetter() {
    const L = DATA.letter || {};
    const body = $('#letter-body');

    (L.paragraphs || []).filter((p) => !isEmpty(p)).forEach((text) => {
      const p = document.createElement('p');
      p.setAttribute('data-line', '');
      setText(p, text);
      body.appendChild(p);
    });

    const closing = (L.closing || []).filter((p) => !isEmpty(p));
    if (closing.length) {
      const wrap = document.createElement('div');
      wrap.className = 'letter__closing';
      closing.forEach((text) => {
        const p = document.createElement('p');
        p.setAttribute('data-line', '');
        setText(p, text);
        wrap.appendChild(p);
      });
      body.appendChild(wrap);
    }

    const signature = $('#letter-signature');
    if (isEmpty(L.signature)) signature.hidden = true;
    else setText(signature, L.signature);
  }

  /* ------------------------------------------------------------------------
   * 2. Envelope intro
   * --------------------------------------------------------------------- */

  function initIntro() {
    const intro = $('#intro');
    const envelope = $('#envelope');
    const main = $('#main');
    const footer = $('.site-footer');

    const showStory = () => {
      root.classList.add('is-opened');
      root.classList.remove('is-locked');
      setInert(main, false);
      setInert(footer, false);
    };

    // Opening a link with a #section (e.g. index.html#la-thu) skips the
    // envelope — handy while editing the content.
    let target = null;
    try { target = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch (e) { target = null; }

    if (!intro || !envelope || target) {
      if (intro) intro.hidden = true;
      showStory();
      if (target) requestAnimationFrame(() => target.scrollIntoView());
      return;
    }

    // Always start the story from the top, behind the envelope.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    root.classList.add('is-locked');
    setInert(main, true);
    setInert(footer, true);

    let opened = false;
    let finished = false;

    envelope.addEventListener('click', () => {
      if (opened) return;
      opened = true;
      envelope.setAttribute('aria-disabled', 'true');

      // The click is a user gesture, so a remembered "music on" may start now.
      music.resumeIfPreferred();

      if (reduceMotion()) { leave(); return; }
      intro.classList.add('is-opening');
      // seal → flap → letter rises (≈2.2s), then the envelope fades away
      setTimeout(leave, 2400);
    });

    function leave() {
      intro.classList.add('is-leaving');
      showStory();
      intro.addEventListener('animationend', (event) => { if (event.target === intro) finish(); });
      setTimeout(finish, reduceMotion() ? 200 : 1300); // fallback if animationend never fires
    }

    function finish() {
      if (finished) return;
      finished = true;
      intro.hidden = true;
      // Move focus to the opening message so keyboard & screen reader users
      // continue right where the story begins.
      const quote = $('#message-quote');
      if (quote) quote.focus({ preventScroll: true });
    }
  }

  /* ------------------------------------------------------------------------
   * 3. Scroll reveals
   * --------------------------------------------------------------------- */

  function initReveal() {
    const blocks = $$('[data-reveal]');
    const lines = $$('.letter [data-line]');
    const letterWrap = $('#letter-wrap');
    const all = [...blocks, ...lines, letterWrap].filter(Boolean);

    if (!('IntersectionObserver' in window)) {
      all.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });

    all.forEach((el) => observer.observe(el));
  }

  /* ------------------------------------------------------------------------
   * 4. Flip cards (one delegated listener for all cards)
   * --------------------------------------------------------------------- */

  function initCards() {
    const list = $('#cards');
    if (!list) return;
    list.addEventListener('click', (event) => {
      const btn = event.target.closest('.flip-card__btn');
      if (!btn || !list.contains(btn)) return;
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!pressed));
    });
  }

  /* ------------------------------------------------------------------------
   * 5. The final hug
   * --------------------------------------------------------------------- */

  function initHug() {
    const btn = $('#hug-btn');
    const label = $('#hug-btn-label');
    const messageEl = $('#hug-message');
    const section = $('#om-bo');
    const layer = $('#hearts-layer');
    const cfg = DATA.hug || {};
    if (!btn) return;

    let hugged = false;
    let lastBurst = 0;

    btn.addEventListener('click', () => {
      if (!hugged) {
        hugged = true;
        if (!isEmpty(cfg.message)) {
          setText(messageEl, cfg.message);
          requestAnimationFrame(() => messageEl.classList.add('is-shown'));
        }
        if (!isEmpty(cfg.buttonAgain)) setText(label, cfg.buttonAgain);
      }

      // Restart the warm glow pulse
      section.classList.remove('is-hugging');
      void section.offsetWidth; // reflow so the animation can replay
      section.classList.add('is-hugging');

      const now = performance.now();
      if (reduceMotion() || now - lastBurst < 600) return;
      lastBurst = now;
      burstHearts(btn, layer);
    });
  }

  /** A small, restrained cloud of hearts rising from the button. */
  function burstHearts(origin, layer) {
    if (!layer || layer.childElementCount > 40) return;
    const rect = origin.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#D97706', '#F0B47A', '#E8DFD2', '#C2410C', '#F5D0A9'];
    const count = window.innerWidth < 600 ? 12 : 18;
    const rand = (min, max) => min + Math.random() * (max - min);

    for (let i = 0; i < count; i += 1) {
      const heart = icon('heart', 'float-heart', true);
      const style = heart.style;
      style.setProperty('--x', `${cx + rand(-0.4, 0.4) * rect.width}px`);
      style.setProperty('--y', `${cy + rand(-6, 6)}px`);
      style.setProperty('--s', `${rand(12, 26).toFixed(1)}px`);
      style.setProperty('--dx', `${rand(-150, 150).toFixed(0)}px`);
      style.setProperty('--dy', `${-rand(220, Math.min(480, cy + 40)).toFixed(0)}px`);
      style.setProperty('--r', `${rand(-40, 40).toFixed(0)}deg`);
      style.setProperty('--dur', `${rand(2.6, 4).toFixed(2)}s`);
      style.setProperty('--delay', `${rand(0, 0.4).toFixed(2)}s`);
      style.setProperty('--c', colors[i % colors.length]);
      heart.addEventListener('animationend', () => heart.remove(), { once: true });
      layer.appendChild(heart);
    }
  }

  /* ------------------------------------------------------------------------
   * 6. Background music (never autoplays)
   * --------------------------------------------------------------------- */

  const music = (() => {
    const cfg = (DATA && DATA.music) || {};
    const KEY = 'qua-20-11-cho-bo:music';
    const remember = cfg.rememberPreference !== false;
    const targetVolume = Math.min(1, Math.max(0, Number(cfg.volume) || 0.5));
    let btn = null;
    let audio = null;
    let available = false;
    let fadeFrame = 0;

    function init() {
      btn = $('#music-toggle');
      if (!btn || cfg.enabled === false || isEmpty(cfg.src)) return;
      btn.addEventListener('click', toggle);

      fileExists(cfg.src).then((ok) => {
        if (!ok) {
          console.info(`[Nhạc nền] Không tìm thấy "${cfg.src}" — nút nhạc được ẩn. (Add a piano.mp3 to enable it.)`);
          return;
        }
        available = true;
        ensureAudio();
        btn.hidden = false;
        requestAnimationFrame(() => btn.classList.add('is-ready'));
      });
    }

    /** Checks the file without downloading it. On file:// we cannot check, so we try. */
    function fileExists(src) {
      if (location.protocol === 'file:') return Promise.resolve(true);
      return fetch(src, { method: 'HEAD', cache: 'no-cache' })
        .then((res) => res.ok)
        .catch(() => false);
    }

    function ensureAudio() {
      if (audio) return audio;
      audio = new Audio();
      audio.src = cfg.src;
      audio.loop = true;
      audio.preload = 'auto';
      audio.addEventListener('error', onError);
      audio.addEventListener('play', () => setUI(true));
      audio.addEventListener('pause', () => setUI(false));
      return audio;
    }

    function play() {
      const a = ensureAudio();
      try { a.volume = 0; } catch (e) { /* iOS: volume is read-only */ }
      setUI(true);
      const attempt = a.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch((err) => {
          setUI(false);
          if (!err || err.name !== 'NotAllowedError') onError();
        });
      }
      fadeTo(targetVolume, 400);
    }

    function pause() {
      if (!audio) return;
      setUI(false);
      fadeTo(0, 600, () => audio.pause());
    }

    function toggle() {
      if (audio && !audio.paused) {
        pause();
        if (remember) storage.set(KEY, 'off');
      } else {
        play();
        if (remember) storage.set(KEY, 'on');
      }
    }

    /** Gentle volume fade (silently ignored where volume is read-only). */
    function fadeTo(to, duration, done) {
      cancelAnimationFrame(fadeFrame);
      const a = audio;
      const from = a.volume;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        try { a.volume = from + (to - from) * t; } catch (e) { /* ignore */ }
        if (t < 1) fadeFrame = requestAnimationFrame(step);
        else if (done) done();
      };
      fadeFrame = requestAnimationFrame(step);
    }

    function onError() {
      console.warn(`[Nhạc nền] Không phát được "${cfg.src}".`);
      available = false;
      setUI(false);
      if (btn) btn.hidden = true;
      toast('Không phát được nhạc nền.');
    }

    function setUI(on) {
      if (!btn) return;
      const label = on ? 'Tắt nhạc nền' : 'Bật nhạc nền';
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }

    /** Called from the envelope click (a user gesture). */
    function resumeIfPreferred() {
      if (available && remember && storage.get(KEY) !== 'off' && !(audio && !audio.paused)) play();
    }

    return { init, resumeIfPreferred };
  })();

  /* ------------------------------------------------------------------------
   * Misc
   * --------------------------------------------------------------------- */

  function initScrollCue() {
    const cue = $('#scroll-cue');
    if (!cue) return;
    // Scroll without adding #bon-dieu to the URL (a #hash skips the envelope on reload).
    cue.addEventListener('click', (event) => {
      const target = $('#bon-dieu');
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /** Shown when js/data.js could not be read (usually a typo while editing). */
  function showDataError() {
    root.classList.remove('js');
    const main = $('#main');
    const intro = $('#intro');
    if (intro) intro.hidden = true;
    if (main) {
      main.innerHTML =
        '<div class="fatal" role="alert"><h1>Không đọc được nội dung</h1>' +
        '<p>File <code>js/data.js</code> có thể vừa bị thiếu một dấu phẩy, dấu ngoặc kép hoặc dấu ngoặc. ' +
        'Hãy mở Console của trình duyệt (F12) để xem dòng bị lỗi.</p></div>';
    }
    console.error('[20/11] window.SITE_DATA is missing — check js/data.js for a syntax error.');
  }

  /* ------------------------------------------------------------------------
   * Boot
   * --------------------------------------------------------------------- */

  function boot() {
    if (!DATA || typeof DATA !== 'object') { showDataError(); return; }

    renderContent();
    music.init();
    initIntro();
    initReveal();
    initCards();
    initHug();
    initScrollCue();

    if (window.Gallery && typeof window.Gallery.init === 'function') {
      window.Gallery.init({
        memories: Array.isArray(DATA.memories) ? DATA.memories : [],
        config: DATA.gallery || {},
        toast,
        reduceMotion,
      });
    }
  }

  boot();
})();
