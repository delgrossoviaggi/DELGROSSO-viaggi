async function caricaNotifiche(){

const {data,error}=await supabaseClient
.from('prenotazioni')
.select('*')
.order('created_at',{ascending:false});


if(error){
console.error(error);
return;
}

const nuove=data.filter(
p=>p.stato==='in attesa'
);


document.getElementById('contatore').innerHTML=
`🔔 Nuove richieste: ${nuove.length}`;


const box=document.getElementById('lista');

box.innerHTML='';


nuove.forEach(p=>{

box.innerHTML += `
<div class="card">

<h2>🎫 ${p.nome_cliente}</h2>

<p>📞 ${p.telefono || ''}</p>
<p>✉️ ${p.email || ''}</p>
<p>💺 Posti: ${p.posti || ''}</p>

<button onclick="aggiorna('${p.id}','confermata')">
✅ Conferma
</button>

<button onclick="aggiorna('${p.id}','annullata')">
❌ Annulla
</button>

<button onclick="whatsapp('${p.telefono}')">
📲 WhatsApp
</button>

</div>
`;

});

}


async function aggiorna(id,stato){

await supabaseClient
.from('prenotazioni')
.update({stato:stato})
.eq('id',id);

caricaNotifiche();

}


function whatsapp(numero){

if(!numero) return;

window.open(
'https://wa.me/'+numero,
'_blank'
);

}


caricaNotifiche();
