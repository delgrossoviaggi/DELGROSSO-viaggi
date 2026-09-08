import {getFleet,escapeHtml,publicUrl} from './site-api.js';
const el=document.querySelector('#fleetGrid');
const r=await getFleet();
if(!r.ok||!r.data.length){el.innerHTML='<article class="color-card"><span>FLOTTA</span><h3>La flotta si sta preparando.</h3><p>Presto troverai qui tutti i nostri mezzi, con foto, posti e caratteristiche.</p></article>'}
else{el.innerHTML=r.data.map(x=>{const gallery=Array.isArray(x.gallery_urls)?x.gallery_urls:[];const cover=publicUrl(x.cover_url)||publicUrl(gallery[0]);return `<article class="fleet-card">${cover?`<img src="${escapeHtml(cover)}" alt="${escapeHtml(x.title)}">`:''}<div class="fleet-body"><span>${escapeHtml(x.seats?`${x.seats} posti`:'Gran Turismo')}</span><h2>${escapeHtml(x.title)}</h2><p>${escapeHtml(x.description||'Comfort, sicurezza e qualità DELGROSSO.')}</p>${gallery.length>1?`<div class="fleet-thumbs">${gallery.slice(0,4).map(u=>`<img src="${escapeHtml(publicUrl(u))}" alt="">`).join('')}</div>`:''}</div></article>`}).join('')}
