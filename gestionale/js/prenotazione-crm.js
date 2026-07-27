
async function trovaOCreaCliente(nome, telefono, email){

    let {data: cliente} = await supabaseClient
    .from('clienti')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle();

    if(cliente){
        return cliente.id;
    }

    const {data: nuovo, error} = await supabaseClient
    .from('clienti')
    .insert({
        nome:nome,
        telefono:telefono,
        email:email
    })
    .select()
    .single();

    if(error){
        console.error(error);
        return null;
    }

    return nuovo.id;
}


async function salvaPrenotazioneCRM(dati){

    const cliente_id = await trovaOCreaCliente(
        dati.nome,
        dati.telefono,
        dati.email
    );

    const {error} = await supabaseClient
    .from('prenotazioni')
    .insert({
        viaggio_id:dati.viaggio_id,
        cliente_id:cliente_id,
        nome_cliente:dati.nome,
        telefono:dati.telefono,
        email:dati.email,
        posti:dati.posti,
        stato:'in attesa'
    });

    if(error){
        alert(error.message);
        return false;
    }

    return true;
}
