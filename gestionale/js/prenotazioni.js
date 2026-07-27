async function caricaPrenotazioni(){

const {data,error}=await supabaseClient
.from('prenotazioni')
.select('*')
.order('created_at',{ascending:false});

const box=document.getElementById('listaPrenotazioni');

if(error){
box.innerHTML='<tr><td>Errore caricamento</td></tr>';
return;
}

(data||[]).forEach(p=>{

box.innerHTML += `
<tr>
<td>${p.nome_cliente || ''}</td>
<td>${p.telefono || ''}</td>
<td>${p.viaggio_id || ''}</td>
<td>${p.posti || 1}</td>
<td>${p.stato || 'in attesa'}</td>
<td>
<button onclick="conferma('${p.id}')">✅</button>
</td>
</tr>
`;

});

}

async function conferma(id){

await supabaseClient
.from('prenotazioni')
.update({stato:'confermata'})
.eq('id',id);

location.reload();

}

caricaPrenotazioni();
