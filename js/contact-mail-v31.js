/* Contatti V31: compone una e-mail diretta alla casella ufficiale senza salvare dati sul sito. */
(()=>{
  const form=document.querySelector('#contactMailForm');
  if(!form)return;
  const status=form.querySelector('[role="status"]');
  const target='info@delgrossoviaggi.it';
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const data=new FormData(form);
    if(data.get('website'))return;
    const val=k=>String(data.get(k)||'').trim();
    const subject=`Richiesta dal sito DELGROSSO VIAGGI - ${val('name')||'Nuovo contatto'}`;
    const body=[
      'RICHIESTA DAL SITO DELGROSSO VIAGGI & LIMOUSINE BUS',
      '',
      `Nome e cognome: ${val('name')}`,
      `Telefono: ${val('phone')||'Non indicato'}`,
      `E-mail del cliente: ${val('email')}`,
      `Tipo richiesta: ${val('service')||'Informazioni generali'}`,
      '',
      'Messaggio:',
      val('message'),
      '',
      '---',
      'Richiesta preparata dal modulo Contatti di delgrossoviaggi.it'
    ].join('\n');
    const url=`mailto:${target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent='Apro la tua applicazione e-mail con il messaggio già compilato. Per completare la richiesta premi “Invia” nella tua e-mail.';
    window.location.href=url;
  });
})();
