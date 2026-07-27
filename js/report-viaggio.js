const id = new URLSearchParams(location.search).get('id');

async function caricaReport(){

const {data:v}=await supabaseClient
.from('viaggi')
.select('*')
.eq('id',id)
.single();

const {data:p}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('viaggio_id',id)
.eq('stato','confermata');

const totale = (p || []).reduce((s,x)=>s + Number(x.posti || 1),0);
const incasso = (p || []).reduce((s,x)=>s + Number(x.importo || 0),0);

document.getElementById('report').innerHTML = `

<div class="card">
<h2>🚍 ${v?.titolo || ''}</h2>
<p>📍 Destinazione: ${v?.destinazione || ''}</p>
<p>📅 Data: ${v?.data_partenza || ''}</p>
<p>🚌 Mezzo: ${v?.autobus_id || ''}</p>
<p>💺 Passeggeri: ${totale}</p>
<p>💶 Incasso: € ${incasso.toFixed(2)}</p>
</div>

<h3>Lista Passeggeri</h3>

<table>
<tr>
<th>Nome</th>
<th>Telefono</th>
<th>Posto</th>
</tr>

${(p || []).map(x=>`
<tr>
<td>${x.nome_cliente || ''}</td>
<td>${x.telefono || ''}</td>
<td>${x.posto || ''}</td>
</tr>`).join('')}

</table>

`;

}

caricaReport();
