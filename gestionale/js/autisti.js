async function salvaAutista(){
await supabaseClient.from('autisti').insert({
nome:document.getElementById('nome').value,
telefono:document.getElementById('telefono').value,
patente:document.getElementById('patente').value
});
alert('Autista salvato');
}
