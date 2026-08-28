import nodemailer from "npm:nodemailer";

type Payload = {
  booking?: {
    id?: string;
    codice?: string;
    nome?: string;
    cognome?: string;
    telefono?: string;
    email?: string;
    posti?: number;
    posti_selezionati?: string;
    totale?: number;
  };
  trip?: {
    id?: string;
    titolo?: string;
    destinazione?: string;
    data_partenza?: string;
    ora_partenza?: string;
    luogo_partenza?: string;
  };
  pdfBase64?: string;
  pdfFilename?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function base64ToUint8Array(value: string): Uint8Array {
  const base64 = value
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function formatDate(value?: string) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(email: unknown): email is string {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(
      { success: false, error: "Metodo non consentito. Usa POST." },
      405,
    );
  }

  try {
    const body = (await req.json()) as Payload;
    const booking = body.booking;
    const trip = body.trip;

    if (!booking) {
      return json(
        { success: false, error: "Dati della prenotazione mancanti." },
        400,
      );
    }

    if (!isValidEmail(booking.email)) {
      return json(
        { success: false, error: "Email cliente mancante o non valida." },
        400,
      );
    }

    if (!body.pdfBase64) {
      return json(
        { success: false, error: "PDF della ricevuta mancante." },
        400,
      );
    }

    const host = Deno.env.get("SMTP_HOST");
    const port = Number(Deno.env.get("SMTP_PORT") || "465");
    const secure =
      (Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
    const username = Deno.env.get("SMTP_USERNAME");
    const password = Deno.env.get("SMTP_PASSWORD");
    const fromEmail =
      Deno.env.get("SMTP_FROM_EMAIL") ||
      "prenotazioni@delgrossoviaggi.it";
    const fromName =
      Deno.env.get("SMTP_FROM_NAME") ||
      "PRENOTAZIONI DELGROSSO VIAGGI";
    const replyTo =
      Deno.env.get("SMTP_REPLY_TO") || fromEmail;

    if (!host || !username || !password) {
      console.error("Configurazione SMTP incompleta.");
      return json(
        {
          success: false,
          error:
            "Configurazione SMTP della Edge Function incompleta. Controlla i Secrets SMTP_*.",
        },
        500,
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: username,
        pass: password,
      },
    });

    const nome =
      `${booking.nome || ""} ${booking.cognome || ""}`.trim() || "Cliente";

    const numero = booking.codice || booking.id || "—";
    const destinazione =
      trip?.destinazione || trip?.titolo || "—";
    const data = formatDate(trip?.data_partenza);
    const posti = booking.posti ?? "—";

    const text = [
      `Buongiorno ${nome},`,
      "",
      "la tua prenotazione è stata registrata correttamente.",
      "",
      "In allegato trovi il riepilogo della prenotazione con il QR Code da presentare al check-in.",
      "",
      `Numero prenotazione: ${numero}`,
      `Viaggio: ${destinazione}`,
      `Data: ${data}`,
      `Posti: ${posti}`,
      "",
      "Grazie,",
      "Del Grosso Viaggi & Limousine Bus",
    ].join("\n");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#24324a;max-width:680px;margin:0 auto">
        <h2 style="color:#008f78;margin-bottom:8px">
          Del Grosso Viaggi &amp; Limousine Bus
        </h2>

        <p>Buongiorno <strong>${escapeHtml(nome)}</strong>,</p>

        <p>
          la tua prenotazione è stata registrata correttamente.
        </p>

        <p>
          In allegato trovi il riepilogo della prenotazione con il
          <strong>QR Code</strong> da presentare al check-in.
        </p>

        <table cellpadding="7" cellspacing="0"
          style="border-collapse:collapse;width:100%;max-width:620px">
          <tr>
            <td><strong>Numero prenotazione</strong></td>
            <td>${escapeHtml(numero)}</td>
          </tr>
          <tr>
            <td><strong>Viaggio</strong></td>
            <td>${escapeHtml(destinazione)}</td>
          </tr>
          <tr>
            <td><strong>Data</strong></td>
            <td>${escapeHtml(data)}</td>
          </tr>
          <tr>
            <td><strong>Posti</strong></td>
            <td>${escapeHtml(posti)}</td>
          </tr>
        </table>

        <p style="margin-top:24px">
          Grazie,<br>
          <strong>Del Grosso Viaggi &amp; Limousine Bus</strong>
        </p>
      </div>
    `;

    const filename =
      body.pdfFilename ||
      `Ricevuta_Prenotazione_${booking.codice || booking.id || "prenotazione"}.pdf`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: booking.email.trim(),
      replyTo,
      subject: "Conferma prenotazione – Del Grosso Viaggi",
      text,
      html,
      attachments: [
        {
          filename,
          content: base64ToUint8Array(body.pdfBase64),
          contentType: "application/pdf",
        },
      ],
    });

    console.log(
      `Email prenotazione inviata: ${booking.email} / ${numero}`,
    );

    return json({
      success: true,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Errore send-booking-confirmation:", error);

    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
