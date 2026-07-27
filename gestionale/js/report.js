async function caricaReport(){

const {data: viaggi,error}=await supabaseClient
.from('viaggi')
.select('*');

if(error){
console.error(error);
return;
}

const box=document.getElementById('report');
box.innerHTML='';

viaggi.forEach(async v=>{

const {count}=await supabaseClient
.from('prenotazioni')
.select('*',{count:'exact',head:true})
.eq('viaggio_id',v.id)
.eq('stato','confermata');

const passeggeri=count || 0;

const incasso = passeggeri * (v.prezzo || 0);

box.innerHTML += `
<div class="card">

<h2>🚍 ${v.titolo}</h2>

<p>📍 ${v.destinazione || ''}</p>
<p>📅 ${v.data_partenza || ''}</p>
<p>🚌 ${v.autobus || ''}</p>

<p>💺 Passeggeri confermati: ${passeggeri}</p>

<p>💶 Incasso previsto: € ${incasso}</p>

<p>Posti disponibili:
${(v.posti_totali || 0)-passeggeri}</p>

</div>
`;

});

}

caricaReport();
