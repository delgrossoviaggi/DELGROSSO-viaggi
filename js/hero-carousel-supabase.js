/**
 * DELGROSSO VIAGGI - Carosello Home collegato in lettura al Supabase "delgrosso-sito".
 * Fonte UNICA: public.carousel_home.foto_urls (pubblicato = true), ordine dell'Admin Sito.
 * Non modifica il database e non interferisce con prenotazioni, gestione o area Admin.
 */
(() => {
  'use strict';
  const PROJECT = 'https://bhsanrbadsqcpbtxupmr.supabase.co';
  // Chiave pubblicabile, NON una chiave secret/service_role (la stessa già presente in admin.html).
  const PUBLIC_KEY = 'sb_publishable_jcc3RIJmNnXZdhcmFuIKFg_EpxO_rBp';
  const AUTOPLAY_MS = 5000;
  const REFRESH_MS = 180000;
  const ENDPOINT = `${PROJECT}/rest/v1/carousel_home?select=foto_urls,sort_order,created_at&pubblicato=eq.true&order=sort_order.asc,created_at.desc`;
  const ALLOWED_PREFIX = '/storage/v1/object/public/site-media/';

  const panel = document.getElementById('dgHeroImagePanel');
  const first = document.getElementById('dgHeroFallbackPhoto');
  const controls = document.getElementById('dgHeroControls');
  const counter = document.getElementById('dgHeroCounter');
  const prev = document.getElementById('dgHeroPrev');
  const next = document.getElementById('dgHeroNext');
  const pause = document.getElementById('dgHeroPause');
  if (!panel || !first || !controls || !counter || !prev || !next || !pause) return;

  first.classList.add('dg-hero-frame', 'dg-is-active');
  const second = document.createElement('img');
  second.className = 'bus-photo dg-hero-frame';
  second.alt = '';
  second.setAttribute('aria-hidden', 'true');
  second.decoding = 'async';
  panel.insertBefore(second, panel.querySelector('.panel-shine'));
  const frames = [first, second];
  let activeFrame = first;
  let images = [];
  let index = -1;
  let timer = null;
  let pausedByUser = false;
  let mouseOver = false;
  let focused = false;
  let visible = true;
  let requestToken = 0;
  let lastFetch = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const preloads = new Map();
  let isRefreshing = false;

  function allowedUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value);
      return url.origin === PROJECT && url.pathname.startsWith(ALLOWED_PREFIX) ? url.href : null;
    } catch (_) { return null; }
  }

  function readUrls(rows) {
    // IMPORTANTE: nessun .slice(), nessun limite, nessuna lista di fotografie inserita a mano.
    return rows.flatMap(row => Array.isArray(row.foto_urls) ? row.foto_urls : [])
      .map(allowedUrl).filter(Boolean);
  }

  function imageReady(url) {
    if (preloads.has(url)) return preloads.get(url);
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        img.onload = null;
        img.onerror = null;
        error ? reject(error) : resolve(url);
      };
      const timeout = setTimeout(() => finish(new Error('Foto non caricata in tempo')), 12000);
      img.onload = () => finish();
      img.onerror = () => finish(new Error('Foto Supabase non disponibile'));
      img.decoding = 'async';
      img.src = url;
      if (img.complete && img.naturalWidth > 0) finish();
    }).catch(error => { preloads.delete(url); throw error; });
    preloads.set(url, p);
    return p;
  }

  function setCounter() {
    if (index < 0 || !images.length) return;
    counter.textContent = `${String(index + 1).padStart(2,'0')} / ${String(images.length).padStart(2,'0')}`;
    const description = `Fotografia DELGROSSO ${index + 1} di ${images.length}`;
    activeFrame.alt = description;
    panel.setAttribute('aria-label', `Galleria fotografica originale DELGROSSO, ${description}`);
  }

  function shouldPlay() {
    return images.length > 1 && index >= 0 && !pausedByUser && !reducedMotion.matches
      && !document.hidden && !mouseOver && !focused && visible;
  }
  function restartTimer() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (shouldPlay()) timer = setInterval(() => { void show(index + 1); }, AUTOPLAY_MS);
  }

  async function show(requested) {
    if (!images.length) return;
    const token = ++requestToken;
    // In caso di foto eliminata dallo Storage, passiamo alla successiva senza schermo bianco.
    for (let tried = 0; tried < images.length; tried++) {
      const n = ((requested + tried) % images.length + images.length) % images.length;
      const url = images[n];
      if (n === index && activeFrame.src === url) { setCounter(); restartTimer(); return; }
      try { await imageReady(url); }
      catch (error) { console.warn('DELGROSSO Carousel: immagine ignorata', error); continue; }
      if (token !== requestToken) return;
      const incoming = activeFrame === frames[0] ? frames[1] : frames[0];
      incoming.src = url;
      incoming.alt = `Fotografia DELGROSSO ${n + 1} di ${images.length}`;
      incoming.setAttribute('aria-hidden', 'false');
      activeFrame.setAttribute('aria-hidden', 'true');
      // Un'unica transizione incrociata, senza scaricare tutte le foto in anticipo.
      incoming.classList.add('dg-is-active');
      activeFrame.classList.remove('dg-is-active');
      activeFrame = incoming;
      index = n;
      setCounter();
      restartTimer();
      const nextUrl = images[(n + 1) % images.length];
      if (nextUrl && nextUrl !== url) {
        setTimeout(() => { imageReady(nextUrl).catch(() => {}); }, 500);
      }
      return;
    }
    // Nessuna foto raggiungibile: resta visibile l'ultima fotografia caricata.
    restartTimer();
  }

  async function refresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    try {
      const response = await fetch(ENDPOINT, {
        method:'GET', headers:{apikey:PUBLIC_KEY,Accept:'application/json'},
        signal: abort.signal, cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Lettura Supabase: HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Dati carosello inattesi');
      const updated = readUrls(rows);
      lastFetch = Date.now();
      if (!updated.length) {
        images = [];
        index = -1;
        controls.hidden = true;
        if (timer) clearInterval(timer);
        timer = null;
        // Nessuna foto pubblicata: immagine fallback locale originale.
        activeFrame.classList.remove('dg-is-active');
        first.src = 'assets/bus-bianco-reale.jpg';
        first.classList.add('dg-is-active');
        first.setAttribute('aria-hidden','false');
        activeFrame = first;
        return;
      }
      const oldUrl = images[index] || '';
      images = updated;
      controls.hidden = images.length < 2;
      const newIndex = oldUrl ? images.indexOf(oldUrl) : -1;
      if (newIndex >= 0) {
        index = newIndex;
        setCounter();
        restartTimer();
      } else {
        index = -1;
        await show(0);
      }
    } catch(error) {
      console.warn('DELGROSSO Carousel: non è stato possibile aggiornare da Supabase. Mantengo le immagini già visibili.', error);
    } finally {
      clearTimeout(timeout);
      isRefreshing = false;
    }
  }

  prev.addEventListener('click', () => { void show(index - 1); });
  next.addEventListener('click', () => { void show(index + 1); });
  function syncPause() {
    pause.setAttribute('aria-pressed', String(pausedByUser));
    pause.setAttribute('aria-label', pausedByUser ? 'Riprendi lo scorrimento automatico' : 'Metti in pausa lo scorrimento automatico');
    pause.title = pausedByUser ? 'Riprendi' : 'Pausa';
    pause.textContent = pausedByUser ? '▶' : '❚❚';
    restartTimer();
  }
  pause.addEventListener('click', () => {
    pausedByUser = !pausedByUser;
    if (!pausedByUser && reducedMotion.matches) pausedByUser = true; // Rispettare preferenze di accessibilità.
    syncPause();
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {event.preventDefault();void show(index - 1);}
    if (event.key === 'ArrowRight') {event.preventDefault();void show(index + 1);}
  });
  if (window.matchMedia('(hover: hover)').matches) {
    panel.addEventListener('mouseenter', () => { mouseOver = true; restartTimer(); });
    panel.addEventListener('mouseleave', () => { mouseOver = false; restartTimer(); });
  }
  panel.addEventListener('focusin', () => {focused = true;restartTimer();});
  panel.addEventListener('focusout', () => {setTimeout(() => {focused = panel.contains(document.activeElement);restartTimer();},0);});

  let touchStart = null;
  panel.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touchStart = {x:event.touches[0].clientX,y:event.touches[0].clientY};
  }, {passive:true});
  panel.addEventListener('touchend', event => {
    if (!touchStart || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) >= 38 && Math.abs(dx) > Math.abs(dy)*1.3) void show(index + (dx < 0 ? 1 : -1));
  }, {passive:true});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = Boolean(entries[0]?.isIntersecting);
      restartTimer();
    }, {threshold:0.12});
    observer.observe(panel);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastFetch > 60000) void refresh();
    restartTimer();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', restartTimer);
  setInterval(() => {if (!document.hidden) void refresh();}, REFRESH_MS);
  void refresh();
})();
