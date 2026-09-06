export function initNav(){const b=document.querySelector('.menu');if(!b)return;const n=document.querySelector('.navlinks');b.onclick=()=>n.classList.toggle('open');}
export function setActive(){const p=location.pathname.split('/').pop()||'index.html';document.querySelectorAll('.navlinks a').forEach(a=>{if(a.getAttribute('href')===p)a.classList.add('active')})}
export function year(){document.querySelectorAll('[data-year]').forEach(x=>x.textContent=new Date().getFullYear())}
