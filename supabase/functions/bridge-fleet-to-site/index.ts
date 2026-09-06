import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_SUPABASE_URL");
const SITE_SERVICE_ROLE_KEY = Deno.env.get("SITE_SUPABASE_SERVICE_ROLE_KEY");
const BRIDGE_SECRET = Deno.env.get("BRIDGE_SECRET");

const site = createClient(SITE_URL ?? "", SITE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-bridge-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function gallery(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.map(clean).filter(Boolean))];
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return [...new Set(parsed.map(clean).filter(Boolean))];
    } catch (_) {}
    return [...new Set(value.split(",").map(clean).filter(Boolean))];
  }
  return [];
}

/*
  SITE-ONLY BRIDGE

  NON legge il Supabase del Gestionale.
  NON modifica il Supabase del Gestionale.
  Riceve dal Gestionale un JSON già preparato e scrive esclusivamente
  nel Supabase del SITO, tabella flotta_page.
*/

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);

  const secret = req.headers.get("x-bridge-secret") ?? "";
  if (!BRIDGE_SECRET || secret !== BRIDGE_SECRET) {
    return json({ ok: false, error: "Bridge non autorizzato" }, 401);
  }

  try {
    const body = await req.json();
    const action = clean(body?.action || "publish").toLowerCase();
    const vehicle = body?.vehicle ?? {};

    const titolo = clean(vehicle.titolo || `${vehicle.marca ?? ""} ${vehicle.modello ?? ""}`);
    if (!titolo) return json({ ok: false, error: "Titolo mezzo mancante" }, 400);

    if (action === "unpublish") {
      const { error } = await site
        .from("flotta_page")
        .update({ attivo: false })
        .eq("titolo", titolo.toUpperCase());

      if (error) throw error;
      return json({ ok: true, action: "unpublish", titolo });
    }

    const images = gallery(vehicle.foto_gallery ?? vehicle.foto_urls);
    const primary = clean(vehicle.immagine_url || vehicle.immagine || images[0]);

    const data = {
      titolo: titolo.toUpperCase(),
      descrizione: clean(vehicle.descrizione),
      immagine_url: primary || null,
      foto_urls: images,
      foto_gallery: images,
      attivo: vehicle.attivo !== false
    };

    const { data: existing, error: findError } = await site
      .from("flotta_page")
      .select("id")
      .eq("titolo", titolo.toUpperCase())
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    if (existing?.id) {
      const { data: updated, error } = await site
        .from("flotta_page")
        .update(data)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return json({
        ok: true,
        action: "update",
        site_id: updated.id,
        gestionale_id: vehicle.id ?? null
      });
    }

    const { data: inserted, error } = await site
      .from("flotta_page")
      .insert([data])
      .select()
      .single();

    if (error) throw error;

    return json({
      ok: true,
      action: "insert",
      site_id: inserted.id,
      gestionale_id: vehicle.id ?? null
    });
  } catch (error) {
    console.error("Bridge error:", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
