import{a as e,o as t,t as n}from"./settingsService-R4BF20Fj.js";import{t as r}from"./tripService-C_-8YB24.js";import{t as i}from"./bookingService-B2VQvIfK.js";import{t as a}from"./fleetService-BgjCUYcX.js";import{t as o}from"./notificationService-BCWXmRP6.js";import{t as s}from"./quoteService-DAspUklR.js";import{t as c}from"./appRoutes-BbuDm13X.js";/* empty css                      */import"./backButton-BaCuvMXq.js";import"./messageSystem-Bi7IlOng.js";import{c as l,t as u}from"./notificationCenterService-qxtnsWsA.js";import"./brandShell-CIWNUkWr.js";var d={filter:`all`,search:``,model:null,persistedNotifications:[],unsubscribe:null,unsubscribePayments:null};function f(e=``){return String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function p(e){return String(e||``).trim().toLowerCase()}function m(e){return new Intl.NumberFormat(`it-IT`).format(Number(e||0))}function h(e){if(!e)return`-`;let t=new Date(e);return Number.isNaN(t.getTime())?`-`:t.toLocaleString(`it-IT`,{day:`2-digit`,month:`2-digit`,year:`numeric`,hour:`2-digit`,minute:`2-digit`})}function g(e,t){if(!e||e.success===!1)throw e?.error instanceof Error?e.error:Error(`Errore caricamento ${t}`);return Array.isArray(e.data)?e.data:[]}function _(e){if(!e)return[];if(e.success===!1){let t=String(e.error?.message||e.error||``).toLowerCase();if(t.includes(`modulo pagamenti non disponibile`)||t.includes(`public.pagamenti`))return[];throw e.error instanceof Error?e.error:Error(`Errore caricamento pagamenti`)}return Array.isArray(e.data)?e.data:[]}function v(e,t){return p(e).includes(p(t))}function y(e){let t=p(e?.tipo);return t===`error`?`error`:t===`warning`?`warning`:t===`success`?`success`:`info`}function b(e,t){if(e===`all`)return!0;let n=y(t);return e===`errors`?n===`error`:e!==`messages`||n!==`error`}function x(){return d.model?d.model.timeline.filter(e=>{let t=d.filter===`all`||e.categoryId===d.filter,n=`${e.categoryLabel||``} ${e.title||``} ${e.text||``} ${e.meta||``}`,r=!d.search||v(n,d.search);return t&&r}):[]}function S(){return d.persistedNotifications.filter(e=>{let t=b(d.filter,e),n=`${e.titolo||``} ${e.messaggio||``} ${e.tipo||``}`,r=!d.search||v(n,d.search);return t&&r})}function C(){let e=document.getElementById(`notificationCategoryGrid`),t=document.getElementById(`notificationTotalBadge`),n=document.getElementById(`notificationPageSummary`);!e||!t||!n||!d.model||(t.textContent=m(d.model.totalAlerts),n.textContent=d.model.totalAlerts?`Aggiornato alle ${h(d.model.updatedAt)} · ${m(d.model.totalAlerts)} alert attivi distribuiti su 7 categorie.`:`Aggiornato alle ${h(d.model.updatedAt)} · nessun alert attivo.`,e.innerHTML=d.model.categories.map(e=>`
    <article class="category-card ${f(e.tone)} ${d.filter===e.id?`is-active`:``}" data-category="${f(e.id)}">
      <header>
        <strong>${f(e.label)}</strong>
        <span class="category-count">${m(e.count)}</span>
      </header>
      <p>${f(e.summary)}</p>
    </article>
  `).join(``),e.querySelectorAll(`[data-category]`).forEach(e=>{e.addEventListener(`click`,()=>{d.filter=e.dataset.category||`all`,D()})}))}function w(){let e=document.getElementById(`notificationFilterBar`);!e||!d.model||(e.innerHTML=[{id:`all`,label:`Tutte`,count:d.model.totalAlerts},...d.model.categories.map(e=>({id:e.id,label:e.label,count:e.count}))].map(e=>`
    <button type="button" class="filter-pill ${d.filter===e.id?`is-active`:``}" data-filter="${f(e.id)}">
      ${f(e.label)} · ${m(e.count)}
    </button>
  `).join(``),e.querySelectorAll(`[data-filter]`).forEach(e=>{e.addEventListener(`click`,()=>{d.filter=e.dataset.filter||`all`,D()})}))}function T(){let e=document.getElementById(`notificationTimeline`);if(!e)return;let t=x();if(!t.length){e.innerHTML=`<div class="empty-state">Nessun alert corrisponde ai filtri selezionati.</div>`;return}e.innerHTML=t.map(e=>`
    <article class="timeline-item ${f(e.tone||`info`)}">
      <div class="timeline-item__header">
        <div>
          <strong>${f(e.title)}</strong>
          <p>${f(e.text)}</p>
        </div>
        <a class="icon-button" href="${f(e.href||c.dashboard)}">Apri modulo</a>
      </div>
      <div class="timeline-item__meta">
        <span class="meta-chip">${f(e.categoryLabel||`Notifica`)}</span>
        <span class="meta-chip">${f(e.meta||`-`)}</span>
      </div>
    </article>
  `).join(``)}function E(){let e=document.getElementById(`persistedNotificationsList`),t=document.getElementById(`savedNotificationsMeta`);if(!e||!t)return;let n=d.persistedNotifications.filter(e=>!e.letto).length;t.textContent=d.persistedNotifications.length?`${m(n)} non lette · ${m(d.persistedNotifications.length)} salvate`:`Nessuna notifica salvata`;let r=S();if(!r.length){e.innerHTML=`<div class="empty-state">Nessuna notifica persistente corrisponde ai filtri selezionati.</div>`;return}e.innerHTML=r.map(e=>`
    <article class="saved-item ${f(y(e))}">
      <div class="saved-item__header">
        <div>
          <strong>${f(e.titolo||`Notifica`)}</strong>
          <p>${f(e.messaggio||``)}</p>
        </div>
        <div class="saved-item__actions">
          ${e.letto?``:`<button type="button" class="icon-button" data-read-id="${f(e.id)}">Segna letta</button>`}
          <button type="button" class="icon-button danger" data-delete-id="${f(e.id)}">Elimina</button>
        </div>
      </div>
      <div class="saved-item__meta">
        <span class="meta-chip">${f(e.tipo||`INFO`)}</span>
        <span class="meta-chip">${f(h(e.created_at))}</span>
      </div>
    </article>
  `).join(``),e.querySelectorAll(`[data-read-id]`).forEach(e=>{e.addEventListener(`click`,async()=>{await o.markRead(e.dataset.readId),await O()})}),e.querySelectorAll(`[data-delete-id]`).forEach(e=>{e.addEventListener(`click`,async()=>{await o.remove(e.dataset.deleteId),await O()})})}function D(){C(),w(),T(),E()}async function O(){let[t,n,c,f,p,m]=await Promise.all([r.getAll(),i.getAll(),l.getAll(),a.getAll(),o.all(),s.all({tolerateMissingTable:!0})]);d.persistedNotifications=g(p,`notifiche`),d.model=u({trips:g(t,`viaggi`),bookings:g(n,`prenotazioni`),payments:_(c),fleet:g(f,`flotta`),notifications:d.persistedNotifications,quotes:g(m,`preventivi`),settings:e()}),D()}function k(){document.getElementById(`notificationSearch`)?.addEventListener(`input`,e=>{d.search=e.target.value||``,T(),E()}),document.getElementById(`refreshNotificationsBtn`)?.addEventListener(`click`,async()=>{await O()}),document.getElementById(`markSavedNotificationsRead`)?.addEventListener(`click`,async()=>{await o.markAllRead(),await O()}),document.getElementById(`clearSavedNotifications`)?.addEventListener(`click`,async()=>{await o.clear(),await O()})}async function A(){let e=await t();e.success!==!1&&n(e.data),k(),await O(),d.unsubscribe=o.subscribe(()=>{O().catch(e=>console.error(`Errore sync Notification Center`,e))}),d.unsubscribePayments=l.subscribe(()=>{O().catch(e=>console.error(`Errore sync pagamenti Notification Center`,e))})}window.addEventListener(`beforeunload`,()=>{d.unsubscribe?.(),d.unsubscribePayments?.()}),A().catch(e=>{console.error(e);let t=document.getElementById(`notificationTimeline`);t&&(t.innerHTML=`<div class="empty-state">${f(e.message||`Errore caricamento Notification Center`)}</div>`)}),window.addEventListener(`beforeunload`,()=>{typeof d.unsubscribe==`function`&&(d.unsubscribe(),d.unsubscribe=null)});