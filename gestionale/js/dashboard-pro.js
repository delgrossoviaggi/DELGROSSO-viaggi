async function caricaStatistiche(){

const v = await supabaseClient
.from('viaggi')
.select('id',{count:'exact',head:true});

const p = await supabaseClient
.from('prenotazioni')
.select('id',{count:'exact',head:true});

const s = await supabaseClient
.from('posti_occupati')
.select('id',{count:'exact',head:true});

document.getElementById('viaggi').innerText=v.count || 0;
document.getElementById('prenotazioni').innerText=p.count || 0;
document.getElementById('posti').innerText=s.count || 0;

}

caricaStatistiche();
