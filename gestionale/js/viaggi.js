document
.getElementById("formViaggio")
.addEventListener("submit", async function(e){

e.preventDefault();

const viaggio = {

titolo: document.getElementById("titolo").value,

destinazione: document.getElementById("destinazione").value,

data_partenza: document.getElementById("data").value,

ora_partenza: document.getElementById("ora").value,

prezzo: document.getElementById("prezzo").value,

autobus: document.getElementById("autobus").value,

posti_totali: document.getElementById("posti").value,

descrizione: document.getElementById("descrizione").value,

locandina: document.getElementById("locandina").value,

stato: document.getElementById("stato").value

};


const {data,error}= await supabaseClient
.from("viaggi")
.insert([viaggio]);


if(error){

console.error(error);
alert("Errore salvataggio viaggio");

return;

}


alert("Viaggio creato correttamente 🚍");

window.location.href="dashboard.html";

});
