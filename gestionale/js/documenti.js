const id=new URLSearchParams(location.search).get('id');

async function caricaDocumento(){

const {data:v}=await supabaseClient
.from('viaggi')
.select('*')
.eq('id',id)
.single();

document.getElementById('documento').innerHTML=`
<h2>🚍 DEL GROSSO VIAGGI</h2>
<h3>${v?.titolo || ''}</h3>
<p>📍 ${v?.destinazione || ''}</p>
<p>📅 ${v?.data_partenza || ''}</p>
<p>🚌 ${v?.autobus_id || ''}</p>
`;

}

caricaDocumento();
