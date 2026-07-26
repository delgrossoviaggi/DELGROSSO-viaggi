async function salvaPrenotazione(dati){

    const disponibili = await controllaPosti(
        dati.viaggio_id,
        dati.posti
    );

    if(!disponibili){
        alert('Alcuni posti sono già occupati');
        return;
    }

    const {data,error}=await supabaseClient
    .from('prenotazioni')
    .insert([{
        viaggio_id:dati.viaggio_id,
        nome_cliente:dati.nome_cliente,
        telefono:dati.telefono,
        email:dati.email,
        posti:dati.posti.join(','),
        stato:'in attesa'
    }])
    .select()
    .single();

    if(error){
        alert('Errore prenotazione');
        console.error(error);
        return;
    }

    const postiInsert=dati.posti.map(p=>({
        viaggio_id:dati.viaggio_id,
        prenotazione_id:data.id,
        posto:p
    }));

    await supabaseClient
    .from('posti_occupati')
    .insert(postiInsert);

    alert('Prenotazione inviata');
}
