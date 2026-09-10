var e={GT53:{name:`GT53 Standard`,totalSeats:53,frontLabel:`FRONTE BUS GT53`,driverLabel:`AUTISTA`,seatLayoutKey:`GT53`,rows:[[1,2,`aisle`,3,4],[5,6,`aisle`,7,8],[9,10,`aisle`,11,12],[13,14,`aisle`,15,16],[17,18,`aisle`,19,20],[21,22,`aisle`,23,24],[25,26,`aisle`,27,28],[29,30,`empty`,`empty`,`door`],[31,32,`empty`,`empty`,`empty`],[33,34,`aisle`,35,36],[37,38,`aisle`,39,40],[41,42,`aisle`,43,44],[45,46,`aisle`,47,48],[49,50,51,52,53]]},GT63:{name:`GT63 Premium`,totalSeats:63,frontLabel:`FRONTE BUS GT63`,driverLabel:`AUTISTA`,seatLayoutKey:`GT63`,rows:[[1,2,`aisle`,3,4],[5,6,`aisle`,7,8],[9,10,`aisle`,11,12],[13,14,`aisle`,15,16],[17,18,`aisle`,19,20],[21,22,`aisle`,23,24],[25,26,`aisle`,27,28],[29,30,`empty`,`empty`,`door`],[31,32,`aisle`,33,34],[35,36,`aisle`,37,38],[39,40,`aisle`,41,42],[43,44,`aisle`,45,46],[47,48,`aisle`,49,50],[51,52,`aisle`,53,54],[55,56,`aisle`,57,58],[59,60,61,62,63]]},GT63B:{name:`GT63B Business`,totalSeats:63,frontLabel:`FRONTE BUS GT63`,driverLabel:`AUTISTA`,seatLayoutKey:`GT63`,rows:[[1,2,`aisle`,3,4],[5,6,`aisle`,7,8],[9,10,`aisle`,11,12],[13,14,`aisle`,15,16],[17,18,`aisle`,19,20],[21,22,`aisle`,23,24],[25,26,`aisle`,27,28],[29,30,`empty`,`empty`,`door`],[31,32,`aisle`,33,34],[35,36,`aisle`,37,38],[39,40,`aisle`,41,42],[43,44,`aisle`,45,46],[47,48,`aisle`,49,50],[51,52,`aisle`,53,54],[55,56,`aisle`,57,58],[59,60,61,62,63]]}};function t(e){return String(e??``).trim()}function n(e){let t=Number(e);return Number.isFinite(t)?String(t).padStart(2,`0`):String(e??``)}function r(e){let t=String(e??``).trim().toUpperCase();return t?t.includes(`FW125XE`)||t.includes(`GS028BB`)?`GT63`:t.includes(`FA013AN`)?`GT53`:t.includes(`IRIZAR SCANIA PB A`)||t.includes(`IRIZAR SCANIA PB B`)?`GT63`:t.includes(`IRIZAR SCANIA CENTURY`)?`GT53`:t.includes(`PB A`)||t.includes(`PB B`)?`GT63`:t.includes(`CENTURY`)?`GT53`:t.includes(`GT63B`)||t.includes(`GT63`)?`GT63`:(t.includes(`GT53`),`GT53`):`GT53`}function i(t){if(typeof t==`string`){let e=t.trim();if(e.startsWith(`{`)&&e.endsWith(`}`)||e.startsWith(`[`)&&e.endsWith(`]`))try{let t=JSON.parse(e);if(Array.isArray(t)||t&&typeof t==`object`&&Array.isArray(t.rows))return i(t)}catch{}}if(Array.isArray(t)||t&&typeof t==`object`){let n=t||{};return Array.isArray(n.rows)?{key:r(n.seat_layout||n.seatLayout||n.seatLayoutKey||n.layout||n.model||n.key||n.targa||n.modello||n.marca),template:t}:{key:r(n.seat_layout||n.seatLayout||n.seatLayoutKey||n.layout||n.model||n.key||n.targa||n.modello||n.marca),template:e[r(n.seat_layout||n.seatLayout||n.seatLayoutKey||n.layout||n.model||n.key||n.targa||n.modello||n.marca)]||e.GT53}}let n=r(t);return{key:n,template:e[n]||e.GT53}}function a(e,r){return e.map(e=>{if(e===`aisle`||e===`door`||e===`empty`)return{type:e,value:e,label:e===`door`?`Porta`:``,status:e};let i=t(e),a=r.has(i)?`occupied`:`available`;return{type:`seat`,id:i,number:Number(i),label:n(i),status:a}})}function o(e,t){return e.map((e,n)=>{let r=Array.isArray(e)?e:Array.isArray(e?.cells)?e.cells:[];return{rowNumber:n+1,label:e?.label||`Fila ${n+1}`,cells:a(r,t)}})}function s(n=`GT53`,r=[]){let{key:a,template:s}=i(n),c=new Set((r||[]).map(t).filter(Boolean)),l=Array.isArray(s.rows)?o(s.rows,c):[],u=l.flatMap(e=>e.cells).filter(e=>e.type===`seat`),d=u.filter(e=>e.status===`occupied`).length,f=u.length-d;return{model:a,config:{key:a,name:s.name||e[a]?.name||a,totalSeats:s.totalSeats||u.length,rows:l.length,seatLayoutKey:s.seatLayoutKey||a,frontLabel:s.frontLabel||`FRONTE BUS ${a}`,driverLabel:s.driverLabel||`AUTISTA`},layout:l,totalSeats:s.totalSeats||u.length,occupiedCount:d,availableCount:f}}function c(e,n,r=[]){let{template:a,key:o}=i(e),s=new Set((n||[]).map(t).filter(Boolean)),c=new Set((r||[]).map(t).filter(Boolean)),l=new Set((Array.isArray(a.rows)?a.rows:[]).flat().filter(e=>typeof e==`number`||/^\d+$/.test(String(e))).map(t)),u=[];if(s.size===0)return u.push(`Seleziona almeno un posto`),{valid:!1,errors:u};for(let e of s)l.has(e)||u.push(`Posto ${e} non valido per il modello ${o}`),c.has(e)&&u.push(`Posto ${e} non disponibile`);return{valid:u.length===0,errors:u,selectedCount:s.size,availableCount:Math.max(l.size-c.size,0)}}function l(e){return e===`occupied`?`occupied`:`available`}function u(e){return e.type===`seat`?`
      <button
        type="button"
        class="seat ${l(e.status)}"
        data-seat="${e.id}"
        data-label="${e.label}"
        ${e.status===`occupied`?`disabled`:``}
        aria-label="Posto ${e.label}"
        title="Posto ${e.label}"
      >
        <span class="seat__number">${e.label}</span>
      </button>
    `:e.type===`door`?`
      <span class="seat-void seat-void--door" aria-hidden="true">
        <span class="seat-void__icon">🚪</span>
      </span>
    `:e.type===`aisle`?`<span class="seat-void seat-void--aisle" aria-hidden="true"></span>`:`<span class="seat-void seat-void--empty" aria-hidden="true"></span>`}function d(e){let t=e?.config||{},n=Array.isArray(e?.layout)?e.layout:[],r=t.frontLabel||`FRONTE BUS ${t.key||`GT53`}`,i=`
    <div class="seat-map-container seat-map-container--real-layout">
      <div class="seat-map-header">
        <div class="seat-map-front" aria-label="${r}">
          <div class="seat-map-front__title">${r}</div>
          <div class="seat-map-front__driver">${t.driverLabel||`AUTISTA`}</div>
        </div>
        <p class="seat-map-stats">
          Disponibili: <strong>${e.availableCount}</strong> /
          Occupati: <strong>${e.occupiedCount}</strong>
        </p>
      </div>

      <div class="seat-map-grid">
        <div class="seat-map-legend">
          <div class="legend-item">
            <span class="seat available available-sample"></span>
            <span>Disponibile</span>
          </div>
          <div class="legend-item">
            <span class="seat occupied occupied-sample"></span>
            <span>Occupato</span>
          </div>
          <div class="legend-item">
            <span class="seat selected selected-sample"></span>
            <span>Selezionato</span>
          </div>
          <div class="legend-item">
            <span class="seat-void seat-void--door"></span>
            <span>Porta</span>
          </div>
        </div>

        <div class="seat-map-rows">
  `;for(let e of n){i+=`
      <div class="seat-map-row" data-row="${e.rowNumber}">
        <span class="row-label">${e.label}</span>
        <div class="seat-map-row__cells">
    `;for(let t of e.cells)i+=u(t);i+=`
        </div>
      </div>
    `}return i+=`
        </div>
      </div>
    </div>
  `,i}function f(e){return i(e).key}function p(t=`GT53`){let{key:n,template:r}=i(t);return{key:n,name:r.name||e[n]?.name||n,totalSeats:r.totalSeats||0,frontLabel:r.frontLabel||`FRONTE BUS ${n}`,driverLabel:r.driverLabel||`AUTISTA`,rows:Array.isArray(r.rows)?r.rows:[]}}Object.freeze(Object.fromEntries(Object.entries(e).map(([e,t])=>[e,{name:t.name,totalSeats:t.totalSeats,frontLabel:t.frontLabel,driverLabel:t.driverLabel,seatLayoutKey:t.seatLayoutKey}])));function m(e,t=`—`){return String(e??``).trim()||t}function h(e){return String(e??``).trim()||`N/A`}function g(e={}){let t=String(e.nome??``).trim(),n=String(e.cognome??``).trim();if(t||n)return{name:t||`—`,surname:n||`—`};let r=String(e.cliente??e.cliente_nome??``).trim();if(!r)return{name:`—`,surname:`—`};let i=r.split(/\s+/).filter(Boolean);return i.length===1?{name:i[0],surname:`—`}:{name:i[0],surname:i.slice(1).join(` `)}}function _(e){if(!e)return`—`;let t=new Date(e);return Number.isNaN(t.getTime())?m(e):t.toLocaleDateString(`it-IT`,{year:`numeric`,month:`2-digit`,day:`2-digit`})}function v(e){let t=String(e??``).trim();if(!t)return`—`;if(/^\d{2}:\d{2}/.test(t))return t.slice(0,5);let n=new Date(t);return Number.isNaN(n.getTime())?t:n.toLocaleTimeString(`it-IT`,{hour:`2-digit`,minute:`2-digit`})}function y(e){if(Array.isArray(e)){let t=e.map(e=>String(e??``).trim()).filter(Boolean).map(e=>e.padStart(2,`0`));return t.length?t.join(`, `):`—`}let t=String(e??``).trim();if(!t)return`—`;if(!t.includes(`,`))return t.padStart(2,`0`);let n=t.split(`,`).map(e=>e.trim()).filter(Boolean).map(e=>e.padStart(2,`0`));return n.length?n.join(`, `):`—`}function b(e={},t={},n={}){let r=h(e.id||e.codice),i=g(e),a=m(t?.luogo_partenza||t?.partenza),o=m(t?.destinazione||t?.titolo),s=_(t?.data_partenza||t?.data_servizio),c=v(t?.ora_partenza),l=y(e.posti_selezionati||e.posti);return[`Prefix: ${m(n.qrPrefix||`DG-BOOKING`)}`,`Prenotazione: ${r}`,`Nome: ${i.name}`,`Cognome: ${i.surname}`,`Telefono: ${m(e.telefono||e.cliente_telefono)}`,`Email: ${m(e.email||e.cliente_email)}`,`Destinazione: ${o}`,`Data: ${s}`,`Ora: ${c}`,`Partenza: ${a}`,`Posto: ${l}`].join(`
`)}function x(e=``){let t=String(e||``).trim(),n=t.split(/\r?\n/).map(e=>e.trim()).filter(Boolean),r={};return n.forEach(e=>{let t=e.indexOf(`:`);if(t<=0)return;let n=e.slice(0,t).trim().toLowerCase(),i=e.slice(t+1).trim();r[n]=i}),{raw:t,prefix:r.prefix||``,bookingId:r.prenotazione||r.booking||``,name:r.nome||``,surname:r.cognome||``,phone:r.telefono||``,email:r.email||``,destination:r.destinazione||``,departureDate:r.data||``,departureTime:r.ora||``,departurePlace:r.partenza||``,seat:r.posto||``,isValid:!!(r.prenotazione||r.telefono||r.email)}}export{f as a,p as i,x as n,d as o,s as r,c as s,b as t};