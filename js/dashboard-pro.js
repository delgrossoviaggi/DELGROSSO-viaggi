async function caricaDashboard(){

const viaggi = await supabaseClient
.from('viaggi')
.select('*',{count:'exact',head:true});

const pren = await supabaseClient
.from('prenotazioni')
.select('*',{count:'exact',head:true});

document.getElementById('totViaggi').innerText = viaggi.count || 0;
document.getElementById('totPrenotazioni').innerText = pren.count || 0;


const {data}=await supabaseClient
.from('viaggi')
.select('*')
.order('data_partenza',{ascending:true})
.limit(5);

const box=document.getElementById('prossime');

(data || []).forEach(v=>{
box.innerHTML += `
<div>
🚍 ${v.titolo || ''} - 📅 ${v.data_partenza || ''}
</div>`;
});

}


async function logout(){
await supabaseClient.auth.signOut();
window.location.href="/gestionale/login.html";
}


caricaDashboard();
