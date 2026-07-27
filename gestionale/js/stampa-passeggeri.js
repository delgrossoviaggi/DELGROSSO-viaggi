const id = new URLSearchParams(location.search).get('id');

async function stampa(){

const {data}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('viaggio_id',id)
.eq('stato','confermata')
.order('posto');

const box=document.getElementById('tabella');

(data||[]).forEach(p=>{

box.innerHTML += `
<tr>
<td>${p.nome_cliente || ''}</td>
<td>${p.telefono || ''}</td>
<td>${p.posto || ''}</td>
<td>${p.note || ''}</td>
</tr>
`;

});

}

stampa();
