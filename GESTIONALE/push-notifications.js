/* Del Grosso Gestionale - iPhone Web Push V20 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoa3VheWhibWl0ZG16bW12b25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzIzNzcsImV4cCI6MjEwMTM0ODM3N30.FU_bdDex03h2hawHVFlmy3zjylGDSuAjR9RUjdeGgwI'; // Legacy anon key: temporary compatibility fallback while this project migrates API keys.
  // Public VAPID key. The matching private key stays ONLY in Supabase Edge Function secrets.
  const VAPID_PUBLIC_KEY = 'BGYzb5phslgo0hOA61u4-BXteNGtEx-AbNKWno_oNpMI5y3HlwtZLeeJoTrx5cNJZTzeiQ1EpzyVyXpP27B-Xwo';
  const APP_BASE = new URL('./', document.baseURI);
  const SW_URL = new URL('sw.js', APP_BASE).href;
  const SCOPE = APP_BASE.pathname;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function getUser() {
    try { return JSON.parse(localStorage.getItem('dg_session') || 'null'); } catch (_) { return null; }
  }

  function b64ToUint8Array(base64) {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker non supportato da questo browser.');
    return navigator.serviceWorker.register(SW_URL, { scope: SCOPE, updateViaCache: 'none' });
  }

  async function saveSubscription(subscription) {
    const json = subscription.toJSON();
    const user = getUser() || {};
    const payload = {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
      user_name: String(user.username || user.nome || 'admin'),
      platform: isIOS ? 'ios' : 'web',
      user_agent: navigator.userAgent.slice(0, 500),
      active: true
    };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Registrazione notifiche non riuscita (404): la tabella push_subscriptions non è ancora attiva su Supabase. Applica la migration 20260831_push_notifications.sql.');
      if (response.status === 401) { const detail = await response.text().catch(() => ''); if (detail.includes('42501') || detail.includes('row-level security')) throw new Error(`Registrazione notifiche non riuscita: policy RLS di Supabase blocca l'inserimento in push_subscriptions (42501).`); throw new Error(`Registrazione notifiche non riuscita (401): ${detail ? detail.slice(0, 220) : 'Supabase ha rifiutato la richiesta.'}`); }
      if (response.status === 403) throw new Error('Registrazione notifiche non riuscita (403): policy RLS non consente la registrazione.');
      throw new Error(`Registrazione notifiche non riuscita (${response.status}).`);
    }
    return payload;
  }

  async function enablePush() {
    if (!window.isSecureContext) throw new Error('Il gestionale deve essere aperto in HTTPS.');
    if (!('Notification' in window) || !('PushManager' in window)) throw new Error('Le notifiche push non sono disponibili su questo browser.');
    if (isIOS && !isStandalone) {
      const err = new Error('Su iPhone devi prima aggiungere il gestionale alla schermata Home.');
      err.code = 'IOS_HOME_SCREEN_REQUIRED';
      throw err;
    }

    const registration = await registerServiceWorker();
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permesso notifiche non concesso. Puoi abilitarlo nelle impostazioni dell’iPhone.');

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await saveSubscription(subscription);
    return { subscription, permission };
  }

  async function init() {
    try { await registerServiceWorker(); } catch (_) { return; }
    const button = document.querySelector('[data-push-enable]');
    if (!button) return;
    button.hidden = false;

    const status = document.querySelector('[data-push-status]');
    const setStatus = (text, ok = false) => {
      if (status) {
        status.textContent = text;
        status.dataset.state = ok ? 'ok' : 'warn';
      }
    };

    if (isIOS && !isStandalone) {
      setStatus('Su iPhone: aggiungi il gestionale alla schermata Home per ricevere notifiche.', false);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setStatus('Permesso iPhone già concesso. Verifico la registrazione push…', false);
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await saveSubscription(existing);
          button.textContent = '✓ Notifiche iPhone attive';
          button.classList.add('is-active');
          setStatus('Notifiche push attive su questo dispositivo.', true);
        } else {
          setStatus('Permesso concesso. Premi Attiva notifiche per completare la registrazione.', false);
        }
      } catch (error) {
        button.classList.remove('is-active');
        setStatus(error?.message || 'Registrazione push non completata.', false);
      }
    }

    button.addEventListener('click', async () => {
      button.disabled = true;
      const original = button.textContent;
      button.textContent = 'Attivazione…';
      try {
        await enablePush();
        button.textContent = '✓ Notifiche iPhone attive';
        button.classList.add('is-active');
        setStatus('Perfetto: questo iPhone riceverà le nuove prenotazioni.', true);
      } catch (error) {
        setStatus(error?.message || 'Impossibile attivare le notifiche.', false);
        button.textContent = original;
      } finally {
        button.disabled = false;
      }
    }, { passive: true });
  }

  window.DGPush = { enable: enablePush, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
