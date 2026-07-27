let clienti=[];

async function caricaClienti(){

const {data,error}=await supabaseClient
.from('clienti')
.select('*')
.order('created_at',{ascending:false});

clienti=data||[];
mostraClienti(clienti);

}

function mostraClienti(lista){

document.getElementById('lista').innerHTML =
lista.map(c=>`
<div class="card">
<h3>👤 ${c.nome}</h3>
<p>📞 ${c.telefono||''}</p>
<p>✉️ ${c.email||''}</p>
<a href="cliente-dettaglio.html?id=${c.id}">Apri scheda</a>
</div>
`).join('');

}

function cercaClienti(){

const q=document.getElementById('cerca').value.toLowerCase();

mostraClienti(clienti.filter(c=>
(c.nome||'').toLowerCase().includes(q) ||
(c.telefono||'').includes(q)
));

}

caricaClienti();
