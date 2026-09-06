#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Patch V7: questa cartella deve essere copiata nella root del repository."
echo "NON esegue modifiche automatiche per evitare di toccare il Gestionale."
echo "Copiare js/bridge.js nel repository e sostituire manualmente SOLO uploadCloudinary() in admin.html."
