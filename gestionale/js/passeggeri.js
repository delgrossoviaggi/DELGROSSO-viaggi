const params = new URLSearchParams(location.search);
const viaggioId = params.get('id');

async function caricaPasseggeri(){

const {data,error}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('viaggio_id',viaggioId)
.order('created_at');

const box=document.getElementById('lista');

if(error){
box.innerHTML='Errore caricamento';
return;
}

let html='<table border="1"><tr><th>Passeggero</th><th>Telefono</th><th>Posti</th><th>Stato</th></tr>';

data.forEach(p=>{
html += `<tr>
<td>${p.nome_cliente}</td>
<td>${p.telefono || ''}</td>
<td>${p.posti || ''}</td>
<td>${p.stato}</td>
</tr>`;
});

html+='</table>';

box.innerHTML=html;

}

caricaPasseggeri();
