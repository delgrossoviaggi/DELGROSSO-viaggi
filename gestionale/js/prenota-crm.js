
// Collegamento prenotazione -> cliente CRM -> viaggio
async function inviaPrenotazione(){

const cliente = {
nome: document.getElementById('nome').value,
telefono: document.getElementById('telefono').value,
email: document.getElementById('email').value
};

const {data:esistente}=await supabaseClient
.from('clienti')
.select('id')
.eq('telefono',cliente.telefono)
.maybeSingle();

let cliente_id=esistente?.id;

if(!cliente_id){
const {data:nuovo}=await supabaseClient
.from('clienti')
.insert(cliente)
.select()
.single();

cliente_id=nuovo.id;
}

// il salvataggio viaggio_id/posti viene completato con i dati del viaggio selezionato
}
