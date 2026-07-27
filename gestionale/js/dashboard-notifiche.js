async function aggiornaBadge(){

const {count}=await supabaseClient
.from('prenotazioni')
.select('*',{count:'exact',head:true})
.eq('stato','in attesa');


const badge=document.getElementById('badgePrenotazioni');

if(badge){
badge.innerText=count || 0;
}

}

aggiornaBadge();
