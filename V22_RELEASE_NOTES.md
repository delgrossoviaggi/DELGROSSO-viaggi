# DELGROSSO Gestionale V22

- Push registration moved to secure Supabase RPC `register_push_subscription` to avoid client-side RLS INSERT failures.
- QR scanner no longer depends on native `BarcodeDetector`. Uses html5-qrcode with camera scanning and image-file fallback.
- Existing manual QR payload entry remains available.
- Unified V21 menu retained.
