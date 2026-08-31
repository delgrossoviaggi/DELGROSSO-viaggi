var e=`shared-message-root`,t=`shared-message-styles`;function n(){if(document.getElementById(t))return;let n=document.createElement(`style`);n.id=t,n.textContent=`
    #${e} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-start;
      padding: 16px;
    }
    .shared-toast {
      pointer-events: auto;
      width: min(360px, calc(100vw - 32px));
      margin-bottom: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
      display: flex;
      gap: 10px;
      align-items: flex-start;
      transform: translateX(24px);
      opacity: 0;
      transition: transform 180ms ease, opacity 180ms ease;
      color: #fff;
    }
    .shared-toast.is-visible {
      transform: translateX(0);
      opacity: 1;
    }
    .shared-toast--success { background: linear-gradient(135deg, #2e7d32, #388e3c); }
    .shared-toast--error { background: linear-gradient(135deg, #c62828, #d32f2f); }
    .shared-toast--warning { background: linear-gradient(135deg, #ef6c00, #f57c00); }
    .shared-toast--info { background: linear-gradient(135deg, #1565c0, #1976d2); }
    .shared-toast__icon {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.2);
      font-weight: 700;
      font-size: 0.95rem;
    }
    .shared-toast__content strong { display: block; margin-bottom: 2px; font-size: 0.95rem; }
    .shared-toast__content span { display: block; font-size: 0.9rem; line-height: 1.35; }
    .shared-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .shared-modal {
      width: min(420px, 100%);
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.24);
      padding: 20px;
      color: #1f2937;
    }
    .shared-modal__title {
      margin: 0 0 8px;
      font-size: 1.05rem;
      font-weight: 700;
    }
    .shared-modal__message {
      margin: 0 0 16px;
      line-height: 1.5;
      color: #4b5563;
      white-space: pre-line;
    }
    .shared-modal__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .shared-modal__actions button {
      border: 0;
      border-radius: 8px;
      padding: 9px 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .shared-modal__actions .shared-modal__cancel {
      background: #e5e7eb;
      color: #374151;
    }
    .shared-modal__actions .shared-modal__confirm {
      background: #0f4c81;
      color: #fff;
    }
  `,document.head.appendChild(n)}function r(){let t=document.getElementById(e);return t||(t=document.createElement(`div`),t.id=e,document.body.appendChild(t),t)}function i(e,t=`info`){return typeof e==`string`?{type:t,message:e}:{type:t,title:`Info`,message:``,duration:3200,...e}}function a(e,t=`info`){n();let a=i(e,t),o=r(),s=document.createElement(`div`);s.className=`shared-toast shared-toast--${a.type||`info`}`,s.innerHTML=`
    <div class="shared-toast__icon">${{success:`✓`,error:`✕`,warning:`⚠`,info:`i`}[a.type]||`i`}</div>
    <div class="shared-toast__content">
      <strong>${a.title||`Info`}</strong>
      <span>${a.message||``}</span>
    </div>
  `,o.appendChild(s),requestAnimationFrame(()=>s.classList.add(`is-visible`)),s._timeout=window.setTimeout(()=>{s.classList.remove(`is-visible`),window.setTimeout(()=>s.remove(),220)},a.duration||3200)}function o(e){n();let t={title:`Conferma`,message:``,confirmText:`Conferma`,cancelText:`Annulla`,...e};return new Promise(e=>{let n=document.createElement(`div`);n.className=`shared-modal-backdrop`,n.innerHTML=`
      <div class="shared-modal">
        <h3 class="shared-modal__title">${t.title}</h3>
        <p class="shared-modal__message">${t.message}</p>
        <div class="shared-modal__actions">
          <button class="shared-modal__cancel" type="button">${t.cancelText}</button>
          <button class="shared-modal__confirm" type="button">${t.confirmText}</button>
        </div>
      </div>
    `;let r=n.querySelector(`.shared-modal`),i=n.querySelector(`.shared-modal__cancel`),a=n.querySelector(`.shared-modal__confirm`),o=t=>{n.remove(),e(t)};i.addEventListener(`click`,()=>o(!1)),a.addEventListener(`click`,()=>o(!0)),n.addEventListener(`click`,e=>{e.target===n&&o(!1)}),document.body.appendChild(n),r.querySelector(`.shared-modal__confirm`).focus()})}export{a as n,o as t};