/**
 * DELGROSSO 4.0 — read-only public health smoke test.
 * Node.js 18+; no credentials, no customer data, no writes/booking.
 * Run: node tests/dg4-live-readonly-health.mjs
 * Offline verification: DG4_MOCK=1 node tests/dg4-live-readonly-health.mjs
 */
const bridge = process.env.DG4_BRIDGE_URL ||
  "https://bhsanrbadsqcpbtxupmr.supabase.co/functions/v1/gestionale-bridge";
const mock = process.env.DG4_MOCK === "1";
const timeoutMs = 12000;
const realFetch = globalThis.fetch;
if (mock) {
  globalThis.fetch = async (url, options={}) => {
    const body = options.body && JSON.parse(options.body);
    const data = body?.action === "trips"
      ? [{ id:"test", data_partenza:"2026-12-20" }]
      : { ok:true, bridge:"online", gestionale:"reachable", trip_read:true };
    return new Response(JSON.stringify(data), { status:200, headers:{"content-type":"application/json"} });
  };
}
async function check(url, options) {
  const reply = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  if (!reply.ok) throw new Error("HTTP " + reply.status);
  if (!reply.headers.get("content-type")?.includes("application/json")) throw new Error("Not JSON");
  return reply.json();
}
try {
  const url = new URL(bridge);
  if (url.protocol !== "https:") throw new Error("HTTPS required");
  if (!mock && url.hostname !== "bhsanrbadsqcpbtxupmr.supabase.co") throw new Error("Unexpected hostname");
  const healthURL = new URL(url.href);
  healthURL.searchParams.set("health","1");
  const health = await check(healthURL.href);
  if (health?.ok !== true || health.trip_read !== true || health.gestionale !== "reachable") {
    throw new Error("Backend database read not confirmed");
  }
  const trips = await check(bridge, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({action:"trips"}) });
  if (!Array.isArray(trips) || trips.length < 1) throw new Error("No verified public trip catalog returned");
  console.log("HEALTH OK; public trip groups:",trips.length);
  console.log("NOTICE: booking, login and seat availability were NOT tested.");
} catch (error) {
  console.error("HEALTH FAIL:", String(error?.message||error));
  process.exitCode=1;
} finally { if (mock) globalThis.fetch=realFetch; }
