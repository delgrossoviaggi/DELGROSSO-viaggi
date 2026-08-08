import{i as e,t}from"./appRoutes-DomIvTj9.js";var n=`dg-back-button`,r=`dg-page-header`,i=`dg-page-header-style`;function a(){return t.dashboard}function o(){let t=window.location.pathname;return e(`dashboard`,t)?null:e(`viaggi`,t)?{title:`Viaggi`,breadcrumb:[`Dashboard`,`Viaggi`]}:e(`clienti`,t)?{title:`Clienti`,breadcrumb:[`Dashboard`,`Clienti`]}:e(`prenotazioni`,t)||e(`prenotazione`,t)?{title:`Prenotazioni`,breadcrumb:[`Dashboard`,`Prenotazioni`]}:e(`flotta`,t)?{title:`Flotta`,breadcrumb:[`Dashboard`,`Flotta`]}:e(`pagamenti`,t)?{title:`Pagamenti`,breadcrumb:[`Dashboard`,`Pagamenti`]}:e(`preventivi`,t)||e(`nuovoPreventivo`,t)?{title:`Preventivi`,breadcrumb:[`Dashboard`,`Preventivi`]}:e(`notifiche`,t)?{title:`Notifiche`,breadcrumb:[`Dashboard`,`Notifiche`]}:e(`checkin`,t)?{title:`Check-In`,breadcrumb:[`Dashboard`,`Check-In`]}:e(`centroOperativo`,t)?{title:`Centro Operativo`,breadcrumb:[`Dashboard`,`Centro Operativo`]}:e(`statistiche`,t)?{title:`Statistiche`,breadcrumb:[`Dashboard`,`Statistiche`]}:e(`impostazioni`,t)?{title:`Impostazioni`,breadcrumb:[`Dashboard`,`Impostazioni`]}:e(`login`,t)?{title:`Login`,breadcrumb:[`Accesso`]}:{title:document.title.split(` - `)[0]||`Del Grosso Gestionale`,breadcrumb:[`Dashboard`]}}function s(e){let t=(document.title||``).split(` - `)[0].trim();if(t&&t.toLowerCase()!==`del grosso gestionale`)return t;let n=document.querySelector(`h1`);return n&&n.textContent.trim()?n.textContent.trim():e?.title||`Del Grosso Gestionale`}function c(){if(document.getElementById(i))return;let e=document.createElement(`style`);e.id=i,e.textContent=`
    .dg-page-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin: 0 0 16px;
      padding: 16px 18px;
      border: 1px solid #e3e8ef;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(15, 76, 129, 0.06);
    }
    .dg-page-header__back {
      flex-shrink: 0;
      padding: 10px 14px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #0F4C81, #F57C00);
      color: #fff;
      font-size: 0.95rem;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(15, 76, 129, 0.16);
    }
    .dg-page-header__back:focus-visible {
      outline: 3px solid #F57C00;
      outline-offset: 2px;
      box-shadow: 0 0 0 3px rgba(245, 124, 0, 0.25);
    }
    .dg-page-header__content {
      flex: 1;
      min-width: 0;
    }
    .dg-page-breadcrumb {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 6px;
      font-size: 0.85rem;
      color: #5b6b7a;
    }
    .dg-page-breadcrumb a {
      color: #0F4C81;
      text-decoration: none;
    }
    .dg-page-breadcrumb span {
      color: #5b6b7a;
    }
    .dg-page-header__content h1 {
      margin: 0;
      font-size: 1.25rem;
      color: #0F4C81;
    }
  `,document.head.appendChild(e)}function l(){if(document.getElementById(r))return;let e=o();if(!e)return;let t=document.querySelector(`h1`),i=document.createElement(`div`);i.id=r,i.className=`dg-page-header`;let c=document.createElement(`button`);c.id=n,c.type=`button`,c.className=`dg-page-header__back`,c.setAttribute(`aria-label`,`Torna alla dashboard`),c.textContent=`← Indietro`,c.onclick=()=>{window.location.href=a()};let l=document.createElement(`div`);l.className=`dg-page-header__content`;let u=document.createElement(`nav`);u.className=`dg-page-breadcrumb`,u.setAttribute(`aria-label`,`Breadcrumb`),Array.isArray(e.breadcrumb)&&e.breadcrumb.forEach((e,t)=>{if(t>0){let e=document.createElement(`span`);e.textContent=` / `,u.appendChild(e)}if(e===`Dashboard`){let t=document.createElement(`a`);t.href=a(),t.textContent=e,u.appendChild(t)}else{let t=document.createElement(`span`);t.textContent=e,u.appendChild(t)}});let d=document.createElement(`div`);d.className=`dg-page-header__title`;let f=null;if(t&&!t.closest(`.dg-page-header`)&&(f=t,f.remove()),f)d.appendChild(f);else{let t=document.createElement(`h1`);t.textContent=s(e),d.appendChild(t)}l.appendChild(u),l.appendChild(d),i.appendChild(c),i.appendChild(l),document.body.insertBefore(i,document.body.firstChild)}function u(){document.body.dataset.pageHeaderLoaded!==`true`&&(document.body.dataset.pageHeaderLoaded=`true`,c(),l())}document.readyState===`loading`?window.addEventListener(`DOMContentLoaded`,u):u();