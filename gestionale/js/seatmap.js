let postiSelezionati=[];

function creaSeatMap(numero=63){

const box=document.getElementById('seatMap');

for(let i=1;i<=numero;i++){

let b=document.createElement('button');
b.innerHTML=i;
b.className='posto';

b.onclick=()=>{
b.classList.toggle('selezionato');

if(postiSelezionati.includes(i))
postiSelezionati=postiSelezionati.filter(x=>x!==i);
else
postiSelezionati.push(i);
};

box.appendChild(b);
}

}
