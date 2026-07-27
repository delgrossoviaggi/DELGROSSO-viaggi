async function caricaDashboard(){

const v = await supabaseClient
.from('viaggi')
.select('*',{count:'exact',head:true});

const p = await supabaseClient
.from('prenotazioni')
.select('*',{count:'exact',head:true})
.eq('stato','confermata');

const n = await supabaseClient
.from('prenotazioni')
.select('*',{count:'exact',head:true})
.eq('stato','in attesa');


document.getElementById('viaggi').innerText = v.count || 0;
document.getElementById('posti').innerText = p.count || 0;
document.getElementById('prenotazioni').innerText = n.count || 0;


const {data}=await supabaseClient
.from('viaggi')
.select('*')
.order('data_partenza')
.limit(5);


(data||[]).forEach(x=>{
document.getElementById('prossime').innerHTML +=
`🚍 ${x.titolo || ''} - 📅 ${x.data_partenza || ''}<br>`;
});

}


async function logout(){
await supabaseClient.auth.signOut();
location.href="https://www.delgrossoviaggi.it";
}

caricaDashboard();
