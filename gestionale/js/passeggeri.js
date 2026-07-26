async function caricaPasseggeri(){

const {data}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('stato','confermata');

const box=document.getElementById('listaPasseggeri');

(data||[]).forEach(p=>{

box.innerHTML += `
<div class="card">
<h3>${p.nome_cliente || ''}</h3>
<p>📞 ${p.telefono || ''}</p>
<p>💺 Posti: ${p.posti || 1}</p>
</div>
`;

});

}

caricaPasseggeri();
