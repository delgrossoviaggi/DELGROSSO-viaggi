
async function caricaMezziMobile(){

const select=document.getElementById('autobus');
const posti=document.getElementById('posti');

if(!select) return;

select.innerHTML='<option>Caricamento mezzi...</option>';

const {data,error}=await supabaseClient
.from('flotta')
.select('id,nome,tipo,posti,stato')
.eq('stato','Disponibile')
.order('nome');

if(error){
select.innerHTML='<option>Errore caricamento</option>';
return;
}

if(!data || data.length===0){
select.innerHTML='<option>Nessun mezzo disponibile</option>';
return;
}

select.innerHTML='<option value="">🚌 Seleziona autobus</option>';

data.forEach(bus=>{
select.innerHTML += `
<option value="${bus.id}" data-posti="${bus.posti}">
🚌 ${bus.nome} (${bus.posti} posti)
</option>`;
});

select.onchange=function(){
const opt=this.options[this.selectedIndex];
if(opt.dataset.posti){
posti.value=opt.dataset.posti+' posti';
}
};

}

function ricaricaMezzi(){
caricaMezziMobile();
}

document.addEventListener('DOMContentLoaded',caricaMezziMobile);
