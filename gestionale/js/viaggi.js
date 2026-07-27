async function caricaViaggi(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.order('data_partenza',{ascending:true});

const tabella=document.getElementById('listaViaggi');

if(error){
tabella.innerHTML='<tr><td>Errore caricamento</td></tr>';
return;
}

(data||[]).forEach(v=>{
tabella.innerHTML += `
<tr>
<td>${v.titolo || ''}</td>
<td>${v.destinazione || ''}</td>
<td>${v.data_partenza || ''}</td>
<td>${v.prezzo || ''} €</td>
<td>✏️ Modifica</td>
</tr>`;
});

}

caricaViaggi();
