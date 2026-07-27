const params = new URLSearchParams(location.search);
const viaggioId = params.get('id');

async function caricaPosti(){

const {data: viaggio}=await supabaseClient
.from('viaggi')
.select('*')
.eq('id',viaggioId)
.single();

if(!viaggio) return;

document.getElementById('busInfo').innerHTML =
`🚍 ${viaggio.titolo || ''}<br>🚌 ${viaggio.autobus_id || ''}`;

const totale = viaggio.posti_totali || 63;

const {data: occupati}=await supabaseClient
.from('prenotazioni')
.select('posto')
.eq('viaggio_id',viaggioId)
.eq('stato','confermata');

const presi=(occupati||[]).map(p=>p.posto);

let html='';

for(let i=1;i<=totale;i++){

const occupato=presi.includes(i);

html += `
<div class="posto ${occupato?'occupato':''}">
${i}
</div>
`;

}

document.getElementById('posti').innerHTML=html;

}

caricaPosti();
