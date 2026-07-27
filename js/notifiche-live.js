async function carica(){

const {data,error}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('stato','in attesa')
.order('created_at',{ascending:false});

if(error) return;

document.getElementById('numero').innerText=(data||[]).length;

const box=document.getElementById('lista');
box.innerHTML='';

(data||[]).forEach(p=>{
box.innerHTML += `
<div class="card">
<h3>🎫 ${p.nome_cliente || ''}</h3>
<p>📞 ${p.telefono || ''}</p>
<p>💺 Posti: ${p.posti || 1}</p>
<button onclick="conferma('${p.id}')">✅ Conferma</button>
</div>`;
});

}


async function conferma(id){

await supabaseClient
.from('prenotazioni')
.update({stato:'confermata'})
.eq('id',id);

carica();

}


supabaseClient
.channel('prenotazioni-live')
.on('postgres_changes',
{
event:'INSERT',
schema:'public',
table:'prenotazioni'
},
payload=>{
carica();
})
.subscribe();


carica();
