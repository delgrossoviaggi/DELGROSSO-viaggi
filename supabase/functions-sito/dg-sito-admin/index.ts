// Gestione dei contenuti del sito (progetto "delgrosso-sito") dal gestionale DELGROSSO.
// Accesso: la stessa sessione del gestionale (progetto "gestionale"). Il token viene verificato
// sul gestionale e serve un operatore attivo (is_gestionale_admin). Nessuna password separata.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const GEST_URL = "https://chkuayhbmitdmzmmvona.supabase.co";
const GEST_KEY = "sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je";
const SITE_URL = Deno.env.get("SUPABASE_URL") || "";
function secret() { try { const x = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); if (x.default) return x.default } catch { } return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "" }
const sb = createClient(SITE_URL, secret(), { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "site-media";
const PUBLIC_PREFIX = SITE_URL + "/storage/v1/object/public/" + BUCKET + "/";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const T = (x: unknown, max = 5000) => String(x ?? "").trim().slice(0, max);
const FOLDERS = ["carousel", "fleet", "posts", "party"];

async function operator(req: Request) {
  const token = T(req.headers.get("authorization"), 4000).replace(/^Bearer\s+/i, "");
  if (!token || token.startsWith("sb_")) return null;
  const h = { apikey: GEST_KEY, Authorization: "Bearer " + token };
  const u = await fetch(GEST_URL + "/auth/v1/user", { headers: h });
  if (!u.ok) return null;
  const user = await u.json();
  const a = await fetch(GEST_URL + "/rest/v1/rpc/is_gestionale_admin", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: "{}" });
  if (!a.ok || (await a.json()) !== true) return null;
  return { id: user.id as string, email: user.email as string };
}
const urlList = (x: unknown) => (Array.isArray(x) ? x : []).map(u => T(u, 800)).filter(u => /^https:\/\//.test(u)).slice(0, 200);
const pathOf = (u: string) => u.startsWith(PUBLIC_PREFIX) ? decodeURIComponent(u.slice(PUBLIC_PREFIX.length)) : "";
const now = () => new Date().toISOString();
async function one(q: any) { const r = await q; if (r.error) throw r.error; return r.data }

async function state() {
  const [carousel, fleet, posts, party] = await Promise.all([
    one(sb.from("carousel_home").select("*").order("sort_order").order("created_at").limit(1)),
    one(sb.from("site_fleet").select("*").order("sort_order").order("created_at")),
    one(sb.from("site_posts").select("*").order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })),
    one(sb.from("site_party_events").select("*").order("event_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })),
  ]);
  return { success: true, carousel: carousel[0] || null, fleet, posts, party };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return J({ success: false, error: "Metodo non consentito" }, 405);
  try {
    const op = await operator(req);
    if (!op) return J({ success: false, error: "Accesso non autorizzato: entra nel gestionale." }, 401);
    const p = await req.json().catch(() => ({}));
    const action = T(p.action, 40), id = T(p.id, 60);
    switch (action) {
      case "state": return J(await state());
      case "upload_url": {
        const folder = FOLDERS.includes(T(p.folder, 20)) ? T(p.folder, 20) : "carousel";
        const ext = (T(p.ext, 6).toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg");
        if (!["jpg", "jpeg", "png", "webp", "mp4", "mov"].includes(ext)) return J({ success: false, error: "Formato file non ammesso" }, 400);
        const path = folder + "/" + Date.now() + "-" + crypto.randomUUID() + "." + ext;
        const r = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
        if (r.error) throw r.error;
        return J({ success: true, path, signedUrl: r.data.signedUrl, publicUrl: PUBLIC_PREFIX + path });
      }
      case "carousel_save": {
        const urls = urlList(p.urls);
        const cur = (await one(sb.from("carousel_home").select("id").order("sort_order").order("created_at").limit(1)))[0];
        if (cur) await one(sb.from("carousel_home").update({ foto_urls: urls, pubblicato: true }).eq("id", cur.id));
        else await one(sb.from("carousel_home").insert({ foto_urls: urls, pubblicato: true, sort_order: 0 }));
        return J(await state());
      }
      case "fleet_save": {
        const g = urlList(p.gallery_urls);
        const row = { title: T(p.title, 120), description: T(p.description, 4000), seats: Number(p.seats) > 0 ? Math.floor(Number(p.seats)) : null, gallery_urls: g, cover_url: g[0] || null, published: p.published !== false, updated_at: now() };
        if (!row.title) return J({ success: false, error: "Scrivi il nome del mezzo" }, 400);
        if (id) await one(sb.from("site_fleet").update(row).eq("id", id)); else await one(sb.from("site_fleet").insert(row));
        return J(await state());
      }
      case "post_save": {
        const row: Record<string, unknown> = { title: T(p.title, 200), category: T(p.category, 60) || null, excerpt: T(p.excerpt, 600) || null, body: T(p.body, 20000) || null, cover_url: urlList([p.cover_url])[0] || null, published: p.published !== false, updated_at: now() };
        if (!row.title) return J({ success: false, error: "Scrivi il titolo della news" }, 400);
        if (id) await one(sb.from("site_posts").update(row).eq("id", id)); else { row.published_at = now(); await one(sb.from("site_posts").insert(row)) }
        return J(await state());
      }
      case "party_save": {
        const g = urlList(p.gallery_urls);
        const d = T(p.event_date, 10);
        const row = { title: T(p.title, 200), event_date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null, description: T(p.description, 4000) || null, gallery_urls: g, cover_url: g[0] || null, published: p.published !== false, updated_at: now() };
        if (!row.title) return J({ success: false, error: "Scrivi il titolo dell'evento" }, 400);
        if (id) await one(sb.from("site_party_events").update(row).eq("id", id)); else await one(sb.from("site_party_events").insert(row));
        return J(await state());
      }
      case "delete": {
        const table = ({ fleet: "site_fleet", post: "site_posts", party: "site_party_events" } as Record<string, string>)[T(p.kind, 10)];
        if (!table || !id) return J({ success: false, error: "Elemento non valido" }, 400);
        await one(sb.from(table).delete().eq("id", id));
        return J(await state());
      }
      case "remove_files": {
        // Cancella dallo storage solo file del sito che non sono piu usati in nessuna pagina.
        const s = await state();
        const used = new Set<string>([...(s.carousel?.foto_urls || []), ...s.fleet.flatMap((x: any) => [x.cover_url, ...(x.gallery_urls || [])]), ...s.posts.map((x: any) => x.cover_url), ...s.party.flatMap((x: any) => [x.cover_url, ...(x.gallery_urls || [])])].filter(Boolean));
        const paths = urlList(p.urls).filter(u => !used.has(u)).map(pathOf).filter(x => x && FOLDERS.concat(["carousel-home", "carousel-viaggi", "flotta"]).includes(x.split("/")[0]));
        if (paths.length) { const r = await sb.storage.from(BUCKET).remove(paths); if (r.error) throw r.error }
        return J({ success: true, removed: paths.length });
      }
    }
    return J({ success: false, error: "Azione non supportata" }, 400);
  } catch (e) {
    console.error("dg-sito-admin", e);
    return J({ success: false, error: e instanceof Error ? e.message : String((e as any)?.message || e) }, 500);
  }
});
