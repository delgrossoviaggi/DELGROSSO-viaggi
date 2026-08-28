/**
 * DELGROSSO VIAGGI - Invio email prenotazione con QR
 *
 * Endpoint Vercel:
 * POST /api/send-booking-email
 *
 * Variabili ambiente richieste su Vercel:
 * ARUBA_EMAIL_PASSWORD = password della casella prenotazioni@delgrossoviaggi.it
 *
 * Configurazione Aruba:
 * SMTP: smtps.aruba.it
 * Porta: 465
 * SSL: true
 * Utente: prenotazioni@delgrossoviaggi.it
 * Mittente: prenotazioni@delgrossoviaggi.it
 */

import nodemailer from "nodemailer";

const SMTP_HOST = "smtps.aruba.it";
const SMTP_PORT = 465;
const SMTP_USER = "prenotazioni@delgrossoviaggi.it";
const FROM_NAME = "DELGROSSO VIAGGI";
const FROM_EMAIL = "prenotazioni@delgrossoviaggi.it";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeHtml({ nome, viaggio, data, posti, totale, codicePrenotazione }) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Conferma prenotazione - DELGROSSO VIAGGI</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
  <h2>Conferma prenotazione</h2>
  <p>Ciao <strong>${escapeHtml(nome)}</strong>,</p>
  <p>la tua prenotazione è stata registrata correttamente.</p>
  <table cellpadding="7" cellspacing="0" border="0">
    <tr><td><strong>Viaggio</strong></td><td>${escapeHtml(viaggio)}</td></tr>
    <tr><td><strong>Data</strong></td><td>${escapeHtml(data)}</td></tr>
    <tr><td><strong>Posti</strong></td><td>${escapeHtml(posti)}</td></tr>
    <tr><td><strong>Totale</strong></td><td>${escapeHtml(totale)}</td></tr>
    <tr><td><strong>Codice prenotazione</strong></td><td>${escapeHtml(codicePrenotazione)}</td></tr>
  </table>
  <p>In allegato trovi la ricevuta della prenotazione con il tuo QR Code.</p>
  <p>Conserva il QR Code e presentalo al check-in.</p>
  <p><strong>DELGROSSO VIAGGI &amp; Limousine Bus</strong></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const password = process.env.ARUBA_EMAIL_PASSWORD;

    if (!password) {
      return res.status(500).json({
        ok: false,
        error: "Variabile ARUBA_EMAIL_PASSWORD non configurata su Vercel"
      });
    }

    const {
      email,
      nome,
      viaggio = "",
      data = "",
      posti = "",
      totale = "",
      codicePrenotazione = "",
      pdfBase64 = "",
      pdfFilename = "ricevuta-prenotazione.pdf"
    } = req.body || {};

    if (!email || !nome) {
      return res.status(400).json({
        ok: false,
        error: "Email e nome cliente sono obbligatori"
      });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: password
      }
    });

    const mail = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: `Conferma prenotazione ${codicePrenotazione ? `- ${codicePrenotazione}` : ""}`.trim(),
      html: makeHtml({
        nome,
        viaggio,
        data,
        posti,
        totale,
        codicePrenotazione
      }),
      attachments: []
    };

    // Il PDF/QR già generato dal gestionale viene riutilizzato.
    if (pdfBase64) {
      const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, "");
      mail.attachments.push({
        filename: pdfFilename,
        content: cleanBase64,
        encoding: "base64",
        contentType: "application/pdf"
      });
    }

    await transporter.sendMail(mail);

    return res.status(200).json({
      ok: true,
      message: "Email di conferma inviata al cliente"
    });
  } catch (error) {
    console.error("Errore invio email prenotazione:", error);
    return res.status(500).json({
      ok: false,
      error: "Invio email non riuscito"
    });
  }
}
