async function caricaPrenotazioni(){

const {data,error}=await supabaseClient
.from('prenotazioni')
.select('*')
.order('created_at',{ascending:false});

const box=document.getElementById('listaPrenotazioni');

if(error){
 box.innerHTML='Errore caricamento';
 console.error(error);
 return;
}

box.innerHTML='';

data.forEach(p=>{

box.innerHTML += `
<div class="card">
<h3>${p.nome_cliente}</h3>
<p>📞 ${p.telefono || ''}</p>
<p>✉️ ${p.email || ''}</p>
<p>💺 Posti: ${p.posti || ''}</p>
<p>Stato: <b>${p.stato}</b></p>

<button onclick="aggiornaStato('${p.id}','confermata')">
✅ Conferma
</button>

<button onclick="aggiornaStato('${p.id}','annullata')">
❌ Annulla
</button>

</div>
`;

});

}


async function aggiornaStato(id, stato){

await supabaseClient
.from('prenotazioni')
.update({stato:stato})
.eq('id',id);

caricaPrenotazioni();

}


caricaPrenotazioni();
