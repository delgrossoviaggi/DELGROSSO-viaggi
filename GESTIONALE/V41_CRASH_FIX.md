# V41 — Crash Fix

Fix critico per Prenotazioni: la precedente MutationObserver di dg-prenotazioni-v38.js riscriveva continuamente il testo delle celle (in particolare la data), generando nuove mutation e causando un loop di aggiornamento che poteva bloccare/crashare la pagina e il browser.

V41 rende l'enhancement idempotente: aggiorna DOM solo quando il valore cambia e protegge l'enhance da rientranze. Il resto del Gestionale V40 è preservato.
