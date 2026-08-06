import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL="https://chkuayhbmitdmzmmvona.supabase.co";
const SUPABASE_KEY="sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je";

let client;
const db=()=>client||(client=createClient(SUPABASE_URL,SUPABASE_KEY));

const wrap=async(q)=>{const {data,error}=await q;return {success:!error,data,error};};

export const getViaggiPubblicati=()=>wrap(db().from("viaggi").select("*").eq("pubblicato","SI").order("data_partenza"));
export const getViaggio=(id)=>wrap(db().from("viaggi").select("*").eq("id",id).single());
export const creaPrenotazione=(payload)=>wrap(db().from("prenotazioni").insert(payload).select().single());

export async function aggiornaDisponibilita(id,posti){
 const {data:v,error}=await db().from("viaggi").select("posti_occupati,posti_liberi").eq("id",id).single();
 if(error) return {success:false,error};
 return wrap(db().from("viaggi").update({
   posti_occupati:(v.posti_occupati||0)+posti,
   posti_liberi:Math.max((v.posti_liberi||0)-posti,0)
 }).eq("id",id).select().single());
}

export const getFlotta=()=>wrap(db().from("flotta").select("*"));
export const getImpostazioni=()=>wrap(db().from("impostazioni").select("*"));
