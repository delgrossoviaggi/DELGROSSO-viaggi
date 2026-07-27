const id=new URLSearchParams(location.search).get('id');

async function carica(){

const {data:c}=await supabaseClient
.from('clienti')
.select('*')
.eq('id',id)
.single();

const {data:p}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('cliente_id',id);

document.getElementById('scheda').innerHTML=`

<div class="card">
<h1>👤 ${c.nome}</h1>
<p>📞 ${c.telefono||''}</p>
<p>✉️ ${c.email||''}</p>

<h3>🎫 Storico prenotazioni</h3>

${(p||[]).map(x=>`
<div>
🚍 ${x.viaggio_id || ''}
- Posti: ${x.posti || 1}
</div>`).join('')}

</div>`;

}

carica();
