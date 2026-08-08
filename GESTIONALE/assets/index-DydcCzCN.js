import{o as e,t}from"./settingsService-DcDvsbsg.js";import{t as n}from"./appRoutes-DomIvTj9.js";import{a as r}from"./localAuthService-PJKQL-am.js";function i(){let e=document.getElementById(`app`);e&&(e.innerHTML=`
    <div style="min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#0f4c81;">
      <div style="text-align:center;">
        <h1>Del Grosso Gestionale</h1>
        <p>Caricamento in corso…</p>
      </div>
    </div>
  `)}function a(e){return new URL(String(e||``).replace(/^\//,``),`${window.location.origin}./`).toString()}async function o(){i();try{let i=await e();i.success!==!1&&t(i.data,{applyThemePreference:!0});let o=r()?n.dashboard:n.login;window.location.replace(a(o))}catch(e){console.error(`Entry routing error`,e),window.location.replace(a(n.login))}}o();