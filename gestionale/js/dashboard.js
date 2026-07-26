async function caricaDashboard(){

const viaggi = await supabaseClient
.from('viaggi')
.select('id', {count:'exact', head:true});

document.getElementById('totViaggi').innerText =
viaggi.count || 0;


const pren = await supabaseClient
.from('prenotazioni')
.select('id', {count:'exact', head:true});

document.getElementById('totPrenotazioni').innerText =
pren.count || 0;


const posti = await supabaseClient
.from('posti_occupati')
.select('posto');

document.getElementById('totPosti').innerText =
posti.data ? posti.data.length : 0;

}

caricaDashboard();
