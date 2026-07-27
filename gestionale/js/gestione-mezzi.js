async function caricaMezzi(){

const {data}=await supabaseClient.from('flotta').select('*').order('nome');

lista.innerHTML='';

(data||[]).forEach(m=>{
lista.innerHTML += `<div class="card">🚌 ${m.nome} - ${m.posti} posti</div>`;
});

}

async function salvaMezzo(){

const {error}=await supabaseClient.from('flotta').insert({
nome:nome.value,
tipo:tipo.value,
posti:Number(posti.value),
foto_url:foto.value,
stato:stato.value
});

if(error) alert(error.message);
else {
alert('Mezzo inserito');
caricaMezzi();
}

}

caricaMezzi();
