const params = new URLSearchParams(location.search);
const viaggioId = params.get('id');

async function caricaViaggio(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.eq('id',viaggioId)
.single();

if(error){
console.error(error);
return;
}

document.getElementById('viaggio').innerHTML=`
<h2>${data.titolo}</h2>
<p>📍 ${data.destinazione}</p>
<p>📅 ${data.data_partenza}</p>
<p>🚌 ${data.autobus}</p>
<p>💺 Posti totali: ${data.posti_totali}</p>
`;

}

caricaViaggio();
