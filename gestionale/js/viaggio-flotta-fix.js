async function caricaFlotta(){

const {data,error}=await supabaseClient
.from('flotta')
.select('*')
.eq('stato','Disponibile')
.order('nome');

const select=document.getElementById('autobus');

if(error){
select.innerHTML='<option>Errore caricamento mezzi</option>';
return;
}

select.innerHTML='<option value="">Seleziona mezzo</option>';

(data||[]).forEach(bus=>{
select.innerHTML += `
<option value="${bus.id}" data-posti="${bus.posti}" data-nome="${bus.nome}">
${bus.nome} (${bus.posti} posti)
</option>`;
});

}

document.addEventListener('DOMContentLoaded',caricaFlotta);
