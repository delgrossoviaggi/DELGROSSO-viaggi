const id = new URLSearchParams(location.search).get('id');

async function caricaPasseggeri(){

const {data}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('viaggio_id',id)
.order('created_at');

const box=document.getElementById('lista');

(data||[]).forEach(p=>{

box.innerHTML += `
<div class="card">

<h3>${p.nome_cliente || ''}</h3>

<p>📞 ${p.telefono || ''}</p>

<label>Posto:</label>

<input type="number"
value="${p.posto || ''}"
onchange="salvaPosto('${p.id}',this.value)">

</div>
`;

});

}

async function salvaPosto(id,posto){

await supabaseClient
.from('prenotazioni')
.update({posto:posto})
.eq('id',id);

}

function stampaLista(){

window.open(
'lista-passeggeri-stampa.html?id='+id,
'_blank'
);

}

caricaPasseggeri();
