async function salvaBus(){

const autobus={
nome:document.getElementById('nome').value,
tipo:document.getElementById('tipo').value,
posti_totali:document.getElementById('posti').value
};

const {error}=await supabaseClient
.from('autobus')
.insert([autobus]);

if(error){
alert('Errore salvataggio');
console.error(error);
return;
}

alert('Autobus inserito');
}


async function caricaFlotta(){

const {data}=await supabaseClient
.from('autobus')
.select('*');

const box=document.getElementById('listaFlotta');

box.innerHTML='';

(data||[]).forEach(bus=>{
box.innerHTML += `
<div>
🚌 ${bus.nome}<br>
Tipo: ${bus.tipo}<br>
Posti: ${bus.posti_totali}
</div><hr>`;
});

}

caricaFlotta();
