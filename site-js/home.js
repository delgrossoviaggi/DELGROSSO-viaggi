import {getHomeCarousel,getPosts,escapeHtml,publicUrl,formatDate} from './site-api.js';
const $=s=>document.querySelector(s);
async function loadCarousel(){
 const el=$('#homeCarousel'); if(!el)return; const r=await getHomeCarousel();
 if(!r.ok||!r.data.length){el.innerHTML='<div class="hero-slide hero-fallback"><div><span>DELGROSSO VIAGGI</span><h1>Il tuo prossimo viaggio<br><em>inizia qui.</em></h1><p>Partenze, esperienze e servizi su strada.</p></div></div>';return;}
 el.innerHTML=r.data.map((x,i)=>{const url=escapeHtml(publicUrl(x.public_url));return `<div class="hero-slide ${i===0?'active':''}" data-index="${i}"><div class="hero-slide-bg" style="background-image:url('${url}')"></div><img class="hero-slide-image" src="${url}" alt="DELGROSSO Viaggi" loading="${i===0?'eager':'lazy'}" decoding="async"><div class="hero-overlay"></div><div class="hero-slide-content"><span>${escapeHtml(x.description||'DELGROSSO VIAGGI')}</span><h1>${escapeHtml(x.description||'Il tuo prossimo viaggio')}<br><em>inizia qui.</em></h1></div></div>`}).join('');
 if(r.data.length>1){let i=0;setInterval(()=>{const slides=[...el.querySelectorAll('.hero-slide')];slides[i]?.classList.remove('active');i=(i+1)%slides.length;slides[i]?.classList.add('active');},5000);}
}
async function loadPosts(){
 const el=$('#postGrid');if(!el)return;const r=await getPosts();
 if(!r.ok||!r.data.length){el.innerHTML='<article class="color-card"><span>NEWS</span><h3>Presto nuove storie.</h3><p>Qui pubblicheremo novità, idee di viaggio e appuntamenti DELGROSSO.</p></article>';return;}
 el.innerHTML=r.data.slice(0,6).map(x=>`<article class="post-card">${x.cover_url?`<img src="${escapeHtml(publicUrl(x.cover_url))}" alt="${escapeHtml(x.title)}">`:''}<div class="post-body"><small>${escapeHtml(x.category||'News')} · ${escapeHtml(formatDate(x.published_at||x.created_at))}</small><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.excerpt||x.body||'')}</p></div></article>`).join('');
}
await Promise.all([loadCarousel(),loadPosts()]);
