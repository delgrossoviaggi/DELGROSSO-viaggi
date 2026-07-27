async function caricaClienti(){

const {data}=await supabaseClient
.from('clienti')
.select('*')
.order('created_at',{ascending:false});

clienti.innerHTML='';

(data||[]).forEach(c=>{
clienti.innerHTML += `
<div class="card">
👤 ${c.nome}<br>
📞 ${c.telefono || ''}
</div>`;
});

}

caricaClienti();
