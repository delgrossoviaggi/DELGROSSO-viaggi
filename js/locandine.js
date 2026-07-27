const bucket='locandine';

document.getElementById('file').addEventListener('change',e=>{
const file=e.target.files[0];
if(file){
document.getElementById('preview').src=URL.createObjectURL(file);
}
});


async function caricaLocandina(){

const file=document.getElementById('file').files[0];

if(!file){
alert('Seleziona una immagine');
return;
}

const nome=Date.now()+'-'+file.name;


const {error:uploadError}=await supabaseClient
.storage
.from(bucket)
.upload(nome,file);


if(uploadError){
console.error(uploadError);
alert('Errore caricamento immagine');
return;
}


const {data}=supabaseClient
.storage
.from(bucket)
.getPublicUrl(nome);


const {error}=await supabaseClient
.from('locandine')
.insert([{
titolo:document.getElementById('titolo').value,
url:data.publicUrl
}]);


if(error){
console.error(error);
alert('Errore salvataggio');
return;
}

alert('Locandina pubblicata 🚍');

}
