async function caricaViaggiPubblici(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.eq('stato','pubblicato')
.order('data_partenza');

if(error) return;

const box=document.getElementById('viaggi');

box.innerHTML='';

data.forEach(v=>{

box.innerHTML += `
<div class="viaggio">
<img src="${v.locandina || ''}">
<h2>${v.titolo}</h2>
<p>${v.destinazione}</p>
<p>${v.data_partenza}</p>
<p>€ ${v.prezzo}</p>
<a href="prenota.html?id=${v.id}">
PRENOTA ORA
</a>
</div>
`;

});

}

caricaViaggiPubblici();
