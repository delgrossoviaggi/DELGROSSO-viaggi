async function caricaContabilita(){

const id=document.getElementById('viaggio_id').value;

const {data:pagamenti}=await supabaseClient
.from('pagamenti')
.select('*')
.eq('viaggio_id',id);

const {data:prenotazioni}=await supabaseClient
.from('prenotazioni')
.select('*')
.eq('viaggio_id',id);

let incasso=(pagamenti||[])
.reduce((tot,p)=>tot+Number(p.importo||0),0);

let persone=(prenotazioni||[])
.reduce((tot,p)=>tot+Number(p.posti||1),0);

document.getElementById('risultato').innerHTML=`

<div class="card">
<h2>📋 Riepilogo Viaggio</h2>

<p>👥 Passeggeri prenotati: ${persone}</p>

<p>💶 Incassi ricevuti:
€ ${incasso.toFixed(2)}</p>

<p>🟡 Acconti:
€ ${(pagamenti||[]).filter(x=>x.tipo==='acconto')
.reduce((a,b)=>a+Number(b.importo||0),0).toFixed(2)}</p>

<p>🟢 Saldi:
€ ${(pagamenti||[]).filter(x=>x.tipo==='saldo')
.reduce((a,b)=>a+Number(b.importo||0),0).toFixed(2)}</p>

</div>`;
}
