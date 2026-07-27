async function caricaViaggi(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.order('data_partenza',{ascending:true});

const box=document.getElementById('lista');

if(error){
box.innerHTML='Errore caricamento viaggi';
return;
}

(data||[]).forEach(v=>{

box.innerHTML += `
<div class="card">
<h2>🚍 ${v.titolo || ''}</h2>
<p>📍 ${v.destinazione || ''}</p>
<p>📅 ${v.data_partenza || ''} ${v.ora_partenza || ''}</p>
<p>🚌 Mezzo ID: ${v.autobus_id || 'Non assegnato'}</p>
<p>💺 Posti: ${v.posti_totali || '-'}</p>
<p>💶 Prezzo: € ${v.prezzo || '0'}</p>

<a class="btn" href="dettaglio-viaggio.html?id=${v.id}">
Apri dettaglio
</a>

</div>
`;

});

}

caricaViaggi();
