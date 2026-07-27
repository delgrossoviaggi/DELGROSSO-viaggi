async function caricaFlotta(){

const {data,error}=await supabaseClient
.from('flotta')
.select('*')
.order('nome');

const box=document.getElementById('listaFlotta');

if(error){
box.innerHTML='Errore caricamento flotta';
return;
}

(data || []).forEach(bus=>{

box.innerHTML += `
<div class="card">

<h2>🚌 ${bus.nome || ''}</h2>

<p>Tipo: ${bus.tipo || ''}</p>
<p>Posti: ${bus.posti || ''}</p>
<p>Stato: ${bus.stato || 'Disponibile'}</p>

</div>
`;

});

}

caricaFlotta();
