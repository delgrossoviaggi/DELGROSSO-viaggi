// Controllo disponibilità posti con Supabase

async function controllaPosti(viaggioId, posti){

    const {data,error}=await supabaseClient
    .from('posti_occupati')
    .select('posto')
    .eq('viaggio_id', viaggioId)
    .in('posto', posti);

    if(error){
        console.error(error);
        return false;
    }

    return data.length === 0;
}
