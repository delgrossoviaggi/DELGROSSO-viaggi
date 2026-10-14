(async()=>{
  const g=document.querySelector('#limousineGallery');
  if(!g) return;
  const textOf=x=>[x?.title,x?.category,x?.tipo,x?.description].filter(Boolean).join(' ').toLowerCase();
  const photos=x=>[...new Set([x?.cover_url,...media(x?.gallery_urls)].filter(Boolean))];
  const isLimousine=x=>{
    const t=textOf(x);
    return /limousine|party|evento privato|festa privata|private/.test(t);
  };
  try{
    const {data,error}=await sb.from('site_fleet').select('*').eq('published',true).order('sort_order').order('created_at');
    if(error) throw error;
    const items=publicFleetItems(data||[]);
    let rows=items.filter(isLimousine);
    if(!rows.length && items.length){
      rows=items.filter(x=>String(x.seats||'').trim()==='30');
    }
    const images=rows.flatMap(x=>photos(x).map((url,i)=>({url,title:x.title||'Limousine Bus',featured:i===0})));
    const unique=[];
    const seen=new Set();
    images.forEach(img=>{if(img.url && !seen.has(img.url)){seen.add(img.url); unique.push(img);}});
    if(!unique.length){
      g.innerHTML='<div class="empty"><h3>Foto in aggiornamento</h3><p>Le fotografie del Limousine Bus non sono ancora disponibili. Puoi comunque contattarci per ricevere tutte le informazioni.</p></div>';
      return;
    }
    g.innerHTML=unique.map((img,i)=>`<button type="button" class="fleet-gallery-item ${i===0?'featured':''}" data-lightbox="${encodeURIComponent(img.url)}" aria-label="${esc(img.title)} · apri foto ${i+1}"><img src="${esc(img.url)}" loading="${i<3?'eager':'lazy'}" alt="${esc(img.title)} · foto ${i+1}"><span>↗</span></button>`).join('');
    if(typeof setupLightbox==='function') setupLightbox();
  }catch(e){
    console.error('Galleria Limousine:',e);
    g.innerHTML='<div class="empty"><h3>Foto non disponibili al momento</h3><p>Riprova più tardi oppure contattaci direttamente per ricevere i dettagli del servizio.</p></div>';
  }
})();
