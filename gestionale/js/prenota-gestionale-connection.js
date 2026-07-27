
async function inviaPrenotazione(){

const dati = {
    viaggio_id: window.viaggioId || null,
    nome_cliente: document.getElementById('nome').value,
    telefono: document.getElementById('telefono').value,
    email: document.getElementById('email').value,
    posti: window.postiSelezionati || []
};

if(!dati.nome_cliente || !dati.telefono){
    alert('Inserire nome e telefono');
    return;
}

// cerca cliente CRM
let {data:cliente}=await supabaseClient
.from('clienti')
.select('id')
.eq('telefono',dati.telefono)
.maybeSingle();

let cliente_id;

if(cliente){
    cliente_id=cliente.id;
}else{

const {data:nuovo}=await supabaseClient
.from('clienti')
.insert({
    nome:dati.nome_cliente,
    telefono:dati.telefono,
    email:dati.email
})
.select()
.single();

cliente_id=nuovo.id;

}

// salva prenotazione
const {error}=await supabaseClient
.from('prenotazioni')
.insert({
    cliente_id:cliente_id,
    viaggio_id:dati.viaggio_id,
    nome_cliente:dati.nome_cliente,
    telefono:dati.telefono,
    email:dati.email,
    posti:dati.posti.length,
    stato:'Nuova richiesta'
});

if(error){
alert(error.message);
return;
}

alert('✅ Richiesta inviata correttamente');
}
