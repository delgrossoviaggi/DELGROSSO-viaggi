# DELGROSSO Viaggi — Public Site V11

V11 is a public-site visual redesign only.

## Protected architecture
- `GESTIONALE/` is not included in this public package and must remain untouched in the repository.
- Viaggi, Partenze, Prenota and Richiedi Preventivo keep their existing Gestionale/Supabase-Gestionale logic.
- Public fleet/media content continues to use the dedicated Site Supabase through the existing bridge/site-content layer.

## Visual layer
- One final public visual system: `css/delgrosso-v11.css`.
- Responsive desktop/tablet/mobile layout.
- Modern colorful gradients, premium cards, micro-interactions, reveal animations and unified navigation.
- Existing business/data logic is intentionally preserved.

## Cleanup
Development/version notes and patch artifacts from the public root were removed. The actual Gestionale must not be deleted or modified when applying this package.
