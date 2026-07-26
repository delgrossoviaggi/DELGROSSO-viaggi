// Funzioni per il pannello admin

async function caricaPostiOccupati(viaggioId){

const {data,error}=await supabaseClient
.from('posti_occupati')
.select('*')
.eq('viaggio_id',viaggioId);

return data || [];

}

async function liberaPosto(id){

await supabaseClient
.from('posti_occupati')
.delete()
.eq('id',id);

}
