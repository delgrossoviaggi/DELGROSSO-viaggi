import nodemailer from "npm:nodemailer";
import { createClient } from "npm:@supabase/supabase-js@2";

type AnyRecord = Record<string, any>;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: corsHeaders });
const text = (v: unknown, fallback = "") => String(v ?? fallback).trim();
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, serviceRole);

function bytesFromBase64(value: string) {
  const base64 = value.replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function customerName(b: AnyRecord) { return text(b?.cliente_nome || b?.cliente || `${b?.nome || ""} ${b?.cognome || ""}`, "Cliente"); }
function bookingNumber(b: AnyRecord) { return text(b?.codice || b?.id, "prenotazione"); }
function confirmationNumber(b: AnyRecord) {
  return text(b?.confirmation_number, `DG-CONF-${String(b?.created_at || new Date().toISOString()).slice(0, 4)}-${String(b?.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`);
}
function formatDate(v: unknown) {
  const s = text(v); if (!s) return "—";
  const d = new Date(s); if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}
async function smtp() {
  const r = await supabase.from("impostazioni").select("smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password,smtp_from_name,smtp_from_email,smtp_reply_to").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (r.error) throw r.error;
  const s = r.data || {};
  return {
    host: text(s.smtp_host, "smtps.aruba.it"), port: Number(s.smtp_port || 465), secure: s.smtp_secure !== false,
    user: text(s.smtp_username, "prenotazioni@delgrossoviaggi.it"), pass: text(s.smtp_password),
    from: text(s.smtp_from_email, text(s.smtp_username, "prenotazioni@delgrossoviaggi.it")),
    fromName: text(s.smtp_from_name, "Del Grosso Viaggi"),
    replyTo: text(s.smtp_reply_to, text(s.smtp_from_email, text(s.smtp_username, "prenotazioni@delgrossoviaggi.it"))),
  };
}
async function signed(path: string) {
  const r = await supabase.storage.from("ricevute-prenotazioni").createSignedUrl(path, 60 * 60 * 24 * 30);
  if (r.error) throw r.error;
  return r.data?.signedUrl || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Metodo non consentito. Usa POST." }, 405);
  try {
    const body = await req.json() as AnyRecord;
    const action = text(body?.action, "issue");

    if (action === "context") {
      const bookingId = text(body?.bookingId); if (!bookingId) return json({ success: false, error: "ID prenotazione mancante." }, 400);
      const br = await supabase.from("prenotazioni").select("*").eq("id", bookingId).maybeSingle();
      if (br.error) throw br.error; if (!br.data) return json({ success: false, error: "Prenotazione non trovata." }, 404);
      let trip = null;
      if (br.data.viaggio_id) { const tr = await supabase.from("viaggi").select("*").eq("id", br.data.viaggio_id).maybeSingle(); if (tr.error) throw tr.error; trip = tr.data; }
      return json({ success: true, booking: br.data, trip });
    }

    if (action === "signed_url") {
      const path = text(body?.path); if (!path) return json({ success: false, error: "Percorso conferma mancante." }, 400);
      return json({ success: true, signedUrl: await signed(path) });
    }

    if (action === "resend_email") {
      const b = body?.booking || {}; const trip = body?.trip || {};
      if (!b.id) return json({ success: false, error: "ID prenotazione mancante." }, 400);
      const path = text(b.confirmation_storage_path); if (!path) return json({ success: false, error: "Conferma PDF non archiviata." }, 400);
      const to = text(b.email); if (!to) return json({ success: false, error: "Email partecipante mancante." }, 400);
      const file = await supabase.storage.from("ricevute-prenotazioni").download(path); if (file.error) throw file.error;
      const cfg = await smtp(); if (!cfg.pass) return json({ success: false, error: "Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione." }, 400);
      const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
      const name = customerName(b), numero = bookingNumber(b), destination = text(trip?.destinazione || trip?.titolo, "Viaggio Del Grosso");
      const info = await transporter.sendMail({ from: { name: cfg.fromName, address: cfg.from }, to, replyTo: cfg.replyTo, subject: `Conferma prenotazione ${numero} - Del Grosso Viaggi`, text: `Gentile ${name},\n\nin allegato trovi nuovamente la conferma della prenotazione ${numero} per ${destination}.\n\nDel Grosso Viaggi`, attachments: [{ filename: `Conferma_Prenotazione_${numero}.pdf`, content: new Uint8Array(await file.data.arrayBuffer()), contentType: "application/pdf" }] });
      const now = new Date().toISOString();
      await supabase.from("prenotazioni").update({ confirmation_email_sent: true, confirmation_email_sent_at: now, confirmation_email_error: null }).eq("id", b.id);
      return json({ success: true, emailSent: true, recipient: to, messageId: info.messageId });
    }

    const b = body?.booking || {}; const trip = body?.trip || {}; const pdf = text(body?.pdfBase64);
    if (!b.id) return json({ success: false, error: "ID prenotazione mancante." }, 400);
    if (!pdf) return json({ success: false, error: "PDF della conferma mancante." }, 400);
    const number = confirmationNumber(b), path = `conferme/${number}.pdf`, bytes = bytesFromBase64(pdf), now = new Date().toISOString();
    const up = await supabase.storage.from("ricevute-prenotazioni").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error && !String(up.error.message || "").toLowerCase().includes("already exists")) throw up.error;
    const stored = await supabase.from("prenotazioni").update({ confirmation_number: number, confirmation_storage_path: path, confirmation_generated_at: now, confirmation_email_sent: false, confirmation_email_error: null }).eq("id", b.id);
    if (stored.error) throw stored.error;

    const cfg = await smtp();
    const to = text(b.email); const name = customerName(b); const numero = bookingNumber(b); const destination = text(trip?.destinazione || trip?.titolo, "Viaggio Del Grosso");
    let emailSent = false, emailError = "", internalSent = false, internalError = "";
    if (cfg.pass) {
      const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
      if (to) {
        try {
          await transporter.sendMail({ from: { name: cfg.fromName, address: cfg.from }, to, replyTo: cfg.replyTo, subject: `Conferma prenotazione ${numero} - Del Grosso Viaggi`, text: `Gentile ${name},\n\nla tua prenotazione è stata registrata correttamente. In allegato trovi la conferma della prenotazione con QR Code.\n\nNumero prenotazione: ${numero}\nViaggio: ${destination}\nData: ${formatDate(trip?.data_partenza)}\nPosti: ${text(b.posti, "—")}\n\nDel Grosso Viaggi`, html: `<p>Gentile <strong>${name}</strong>,</p><p>la tua prenotazione è stata registrata correttamente.</p><p>In allegato trovi la <strong>conferma della prenotazione con QR Code</strong>.</p><p><strong>Numero:</strong> ${numero}<br><strong>Viaggio:</strong> ${destination}<br><strong>Data:</strong> ${formatDate(trip?.data_partenza)}<br><strong>Posti:</strong> ${text(b.posti, "—")}</p><p>Del Grosso Viaggi</p>`, attachments: [{ filename: `Conferma_Prenotazione_${numero}.pdf`, content: bytes, contentType: "application/pdf" }] });
          emailSent = true;
        } catch (e) { emailError = e instanceof Error ? e.message : String(e); }
      } else emailError = "Email partecipante mancante.";
      try {
        await transporter.sendMail({ from: { name: cfg.fromName, address: cfg.from }, to: ["info@delgrossoviaggi.it", "prenotazioni@delgrossoviaggi.it"], replyTo: cfg.replyTo, subject: `🔔 NUOVA PRENOTAZIONE ${numero} - Del Grosso Viaggi`, text: `Nuova prenotazione registrata nel Gestionale.\n\nCliente: ${name}\nTelefono: ${text(b.telefono, "—")}\nEmail: ${text(b.email, "—")}\nViaggio: ${destination}\nData viaggio: ${formatDate(trip?.data_partenza)}\nPosti: ${text(b.posti, "—")}\nTotale: € ${Number(b.totale || 0).toFixed(2)}\nAcconto: € ${Number(b.acconto || 0).toFixed(2)}\nNumero prenotazione: ${numero}\n\nLa conferma PDF è stata archiviata nel Gestionale.`, attachments: [{ filename: `Conferma_Prenotazione_${numero}.pdf`, content: bytes, contentType: "application/pdf" }] });
        internalSent = true;
      } catch (e) { internalError = e instanceof Error ? e.message : String(e); }
    } else {
      emailError = "Password SMTP non configurata in Gestionale > Impostazioni > Comunicazione.";
      internalError = emailError;
    }
    const finalError = [emailError, internalError && `Avviso interno: ${internalError}`].filter(Boolean).join(" ") || null;
    await supabase.from("prenotazioni").update({ confirmation_email_sent: emailSent, confirmation_email_sent_at: emailSent ? now : null, confirmation_email_error: finalError }).eq("id", b.id);
    return json({ success: true, storedPath: path, confirmationNumber: number, emailSent, internalSent, emailError: emailError || null, internalError: internalError || null, signedUrl: await signed(path) });
  } catch (error) {
    console.error("Errore send-booking-confirmation:", error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
