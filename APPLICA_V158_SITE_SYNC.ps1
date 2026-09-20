$ErrorActionPreference='Stop'
$Repo = (Get-Location).Path
if(-not (Test-Path (Join-Path $Repo '.git'))){ throw 'Esegui questo script dalla cartella locale del repository DELGROSSO-viaggi.' }
$stamp=Get-Date -Format 'yyyyMMdd_HHmmss'
$backup=Join-Path $Repo "_BACKUP_V158_SITE_SYNC_$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
foreach($p in @('js/gestionale.js','prenota.html','viaggi.html')){
  $src=Join-Path $Repo $p
  if(-not (Test-Path $src)){ throw "File mancante: $p" }
  $dst=Join-Path $backup $p
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  Copy-Item $src $dst -Force
}
Write-Host "Backup creato: $backup"
Write-Host 'Applicare i tre aggiornamenti V158? [S/N]'
if((Read-Host) -ne 'S'){ Write-Host 'Annullato.'; exit 0 }

# js/gestionale.js: robust fetch/retry + requestId.
$p=Join-Path $Repo 'js/gestionale.js'; $s=Get-Content $p -Raw
$pattern='async function gestBridge\(action, payload=\{\}\)\{.*?\n\}'
$replacement=@'
async function gestBridge(action, payload={}){
  const attempts=action==='booking'?2:1;
  let lastError=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    try{
      const res=await fetch(GESTIONALE_BRIDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:controller.signal,cache:'no-store'});
      const text=await res.text(); let data=null; try{data=text?JSON.parse(text):null}catch{data=null}
      if(!res.ok)throw new Error(data?.error||`Servizio non disponibile (${res.status})`);
      if(data&&data.error)throw new Error(data.error);
      return data;
    }catch(error){
      lastError=error?.name==='AbortError'?new Error('Il collegamento al Gestionale sta impiegando troppo tempo. Riprovo automaticamente…'):(error instanceof Error?error:new Error('Servizio prenotazioni non disponibile.'));
      if(attempt<attempts)await new Promise(r=>setTimeout(r,500));
    }finally{clearTimeout(timer)}
  }
  throw lastError||new Error('Servizio prenotazioni non disponibile.');
}
'@
$s2=[regex]::Replace($s,$pattern,$replacement,1)
if($s2 -eq $s){ throw 'gestBridge non trovato: nessuna modifica eseguita.' }
$old="async function createGestionaleBooking({viaggioId,nome,cognome,telefono,email,note,posti}){`n  return await gestBridge('booking',{viaggioId,nome,cognome,telefono,email:(email||null),note,posti:posti.map(String)});`n}"
$new="async function createGestionaleBooking({viaggioId,nome,cognome,telefono,email,note,posti,requestId}){`n  const stableRequestId=requestId||((crypto?.randomUUID)?crypto.randomUUID():`dg-${Date.now()}-${Math.random().toString(36).slice(2)}`);`n  const result=await gestBridge('booking',{viaggioId,nome,cognome,telefono,email:(email||null),note,posti:posti.map(String),requestId:stableRequestId});`n  if(result?.success)window.dispatchEvent(new CustomEvent('dg:booking-created',{detail:result}));`n  return result;`n}"
if(-not $s2.Contains($old)){ throw 'createGestionaleBooking non trovato: nessuna modifica eseguita.' }
$s2=$s2.Replace($old,$new); Set-Content $p $s2 -Encoding UTF8

# prenota.html
$p=Join-Path $Repo 'prenota.html'; $s=Get-Content $p -Raw
$old='const result=await createGestionaleBooking({viaggioId:current.id,nome:document.querySelector(''#nome'').value.trim(),cognome:document.querySelector(''#cognome'').value.trim(),telefono:document.querySelector(''#telefono'').value.trim(),email:(document.querySelector(''#email'').value.trim()||null),note:document.querySelector(''#note'').value.trim(),posti:selected});'
$new='const requestId=(window.__dgBookingRequestId&&window.__dgBookingRequestId.viaggioId===String(current.id)&&window.__dgBookingRequestId.seats===selected.join('','')?window.__dgBookingRequestId.id:(window.crypto?.randomUUID?window.crypto.randomUUID():`dg-${Date.now()}-${Math.random().toString(36).slice(2)}`));window.__dgBookingRequestId={id:requestId,viaggioId:String(current.id),seats:selected.join('','')};const result=await createGestionaleBooking({viaggioId:current.id,nome:document.querySelector(''#nome'').value.trim(),cognome:document.querySelector(''#cognome'').value.trim(),telefono:document.querySelector(''#telefono'').value.trim(),email:(document.querySelector(''#email'').value.trim()||null),note:document.querySelector(''#note'').value.trim(),posti:selected,requestId});'
if(-not $s.Contains($old)){ throw 'Call booking non trovata in prenota.html.' }
$s=$s.Replace($old,$new)
$old2='selected=[];form.querySelectorAll(''input,textarea'').forEach(x=>x.value='''');await load()'
$new2='selected=[];window.__dgBookingRequestId=null;form.querySelectorAll(''input,textarea'').forEach(x=>x.value='''');await load()'
if(-not $s.Contains($old2)){ throw 'Success reset non trovato in prenota.html.' }
$s=$s.Replace($old2,$new2); Set-Content $p $s -Encoding UTF8

# viaggi.html
$p=Join-Path $Repo 'viaggi.html'; $s=Get-Content $p -Raw
$old='<script src="js/site.js"></script><script src="js/gestionale.js"></script>'
$new='<script src="js/site.js"></script><script src="js/gestionale.js"></script><script>window.addEventListener(''dg:booking-created'',()=>{try{if(typeof getGestionaleTrips===''function''){getGestionaleTrips().then(trips=>{window.__dgTrips=trips;if(typeof window.__dgTripRender===''function'')window.__dgTripRender(trips);});}}catch(e){console.warn(''Aggiornamento disponibilità dopo prenotazione:'',e)}});</script>'
if(-not $s.Contains($old)){ throw 'Marker script non trovato in viaggi.html.' }
$s=$s.Replace($old,$new); Set-Content $p $s -Encoding UTF8

Write-Host ''
Write-Host 'V158 SITE SYNC APPLICATO.' -ForegroundColor Green
Write-Host 'Controlla ora: git diff -- js/gestionale.js prenota.html viaggi.html'
Write-Host 'Se il diff è corretto: git add -A; git commit -m "V158: harden site bookings bridge"; git push origin main'
