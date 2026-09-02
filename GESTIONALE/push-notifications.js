/* Del Grosso Gestionale - iPhone Web Push V23 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoa3VheWhibWl0ZG16bW12b25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzIzNzcsImV4cCI6MjEwMTM0ODM3N30.FU_bdDex03h2hawHVFlmy3zjylGDSuAjR9RUjdeGgwI'; // Legacy anon key: temporary compatibility fallback while this project migrates API keys.
  // Public VAPID key. The matching private key stays ONLY in Supabase Edge Function secrets.
  const VAPID_PUBLIC_KEY = 'BGYzb5phslgo0hOA61u4-BXteNGtEx-AbNKWno_oNpMI5y3HlwtZLeeJoTrx5cNJZTzeiQ1EpzyVyXpP27B-Xwo';
  const APP_BASE = new URL('./', document.baseURI);
  const SW_URL = new URL('sw.js', APP_BASE).href;
  const SCOPE = APP_BASE.pathname;
  const PUSH_STATE_KEY = 'dg_push_active_v24';

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

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_push_subscription`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ p_subscription: payload })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      if (response.status === 404) throw new Error('Registrazione notifiche non riuscita (404): la funzione RPC register_push_subscription non è presente su Supabase. Applica SQL_FIX_PUSH_V22.sql.');
      if (response.status === 401 || response.status === 403) throw new Error(`Registrazione notifiche non riuscita (${response.status}): Supabase ha rifiutato la chiamata RPC. ${detail.slice(0,220)}`);
      if (response.status === 425) throw new Error(`Registrazione notifiche non riuscita (425): ${detail.slice(0,220)}`);
      throw new Error(`Registrazione notifiche non riuscita (${response.status}): ${detail.slice(0,220)}`);
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

    // iOS/Android can retain a PushSubscription created with an older VAPID key.
    // Reuse is safe only when the subscription was created for this exact key.
    // To avoid Apple APNs VapidPkHashMismatch, refresh the browser subscription
    // before registering it with our backend.
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch (unsubscribeError) {
        console.warn('Unable to replace existing push subscription:', unsubscribeError);
      }
      subscription = null;
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8Array(VAPID_PUBLIC_KEY)
    });

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
        if (existing && localStorage.getItem(PUSH_STATE_KEY) === '1') {
          button.textContent = '✓ Notifiche iPhone attive';
          button.classList.add('is-active');
          setStatus('Notifiche iPhone attive e registrate. Non è necessario riattivarle ad ogni accesso.', true);
        } else if (existing) {
          setStatus('È presente una registrazione push precedente. Premi Attiva notifiche per aggiornarla.', false);
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
        localStorage.setItem(PUSH_STATE_KEY, '1');
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
