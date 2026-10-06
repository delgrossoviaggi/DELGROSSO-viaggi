/* Migliorie condivise solo per le pagine interne V31. Non caricato su Home/Viaggi. */
(()=>{
 const cfg=window.DG_CONFIG||{};
 const extra=cfg.contactsExtra||{};
 function footerContacts(){
  const footer=document.querySelector('footer .footer-grid');if(!footer)return;
  const cols=[...footer.children];const target=cols[2]||footer;
  target.innerHTML='<div class="footer-title">Contatti diretti</div>';
  const box=document.createElement('div');box.className='v31-footer-contact';
  (extra.phones||[]).forEach(p=>{const a=document.createElement('a');a.href='tel:'+String(p.number).replace(/\s/g,'');a.textContent=`${p.name}: ${p.number}`;box.appendChild(a)});
  if(cfg.contacts?.email){const a=document.createElement('a');a.href='mailto:'+cfg.contacts.email;a.textContent=cfg.contacts.email;box.appendChild(a)}
  const socials=document.createElement('div');socials.className='v31-footer-socials';
  (extra.social||[]).forEach(s=>{if(!s.url)return;const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener';a.textContent=(s.network==='Instagram'?'IG':'FB')+' · '+(s.label.includes('LIMOUSINE')&&s.label!=='DELGROSSO VIAGGI & LIMOUSINE BUS'?'Limousine':'DELGROSSO');socials.appendChild(a)});
  target.append(box,socials);
 }
 function phoneQuickbar(){
  const bar=document.querySelector('.mobile-quickbar');if(!bar)return;
  const nicola=(extra.phones||[]).find(p=>/nicola/i.test(p.name));
  if(nicola&&!bar.querySelector('[data-v31-call]')){const a=document.createElement('a');a.dataset.v31Call='1';a.href='tel:'+nicola.number.replace(/\s/g,'');a.textContent='☎ Chiama';bar.appendChild(a)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{footerContacts();phoneQuickbar()},{once:true});else{footerContacts();phoneQuickbar()}
})();
