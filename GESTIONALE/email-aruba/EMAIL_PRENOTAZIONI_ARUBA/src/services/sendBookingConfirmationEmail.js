/**
 * DELGROSSO VIAGGI - client per l'invio email prenotazione
 *
 * Questo file NON contiene password SMTP.
 * La password rimane esclusivamente nelle Environment Variables di Vercel.
 *
 * Uso:
 * await sendBookingConfirmationEmail({
 *   email: cliente.email,
 *   nome: cliente.nome,
 *   viaggio: viaggio.titolo,
 *   data: viaggio.data,
 *   posti: postiSelezionati.length,
 *   totale: totale,
 *   codicePrenotazione: prenotazione.id,
 *   pdfBase64: pdfBase64,
 *   pdfFilename: "ricevuta-prenotazione.pdf"
 * });
 */

export async function sendBookingConfirmationEmail(payload) {
  const response = await fetch("/api/send-booking-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Impossibile inviare la conferma email");
  }

  return data;
}
