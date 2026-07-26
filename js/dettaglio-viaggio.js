const id=new URLSearchParams(location.search).get('id');

async function carica(){

const {data:v}=await supabaseClient
.from('viaggi')
.select('*')
.eq('id',id)
.single();

const {data:p}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('viaggio_id',id);

document.getElementById('dettaglio').innerHTML=`

<div class="card">
<h2>🚍 ${v.titolo || ''}</h2>
<p>📅 ${v.data_partenza || ''}</p>
<p>🚌 Bus: ${v.autobus_id || ''}</p>
<p>💺 Prenotati: ${(p||[]).length}</p>
</div>

`;

}

carica();
