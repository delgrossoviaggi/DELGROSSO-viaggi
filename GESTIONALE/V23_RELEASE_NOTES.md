# V23 — Push + QR + Menu

- Push: sostituisce sempre una PushSubscription esistente prima di registrarla, evitando VAPID public-key mismatch su iOS/Android.
- Push: mantiene la registrazione tramite register_push_subscription.
- QR check-in: mantiene html5-qrcode + scansione da foto + inserimento manuale, compatibile con dispositivi/browser moderni.
- Menu: mantiene il menu globale con pulsante in alto a sinistra.
