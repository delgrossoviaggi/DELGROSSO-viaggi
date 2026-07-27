async function caricaViaggi(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.order('data_partenza');

const box=document.getElementById('lista');

if(error){
console.error(error);
return;
}

box.innerHTML='';

data.forEach(v=>{

box.innerHTML += `
<div class="card">

<h2>${v.titolo}</h2>
<p>📍 ${v.destinazione || ''}</p>
<p>📅 ${v.data_partenza || ''}</p>
<p>💶 € ${v.prezzo || 0}</p>
<p>Stato: ${v.stato || ''}</p>

<button onclick="cambiaStato('${v.id}','pubblicato')">
🌐 Pubblica
</button>

<button onclick="cambiaStato('${v.id}','soldout')">
🔴 Sold Out
</button>

<button onclick="eliminaViaggio('${v.id}')">
🗑️ Elimina
</button>

</div>
`;

});

}


async function cambiaStato(id,stato){

await supabaseClient
.from('viaggi')
.update({stato:stato})
.eq('id',id);

caricaViaggi();

}


async function eliminaViaggio(id){

if(!confirm('Eliminare questo viaggio?')) return;

await supabaseClient
.from('viaggi')
.delete()
.eq('id',id);

caricaViaggi();

}


caricaViaggi();
