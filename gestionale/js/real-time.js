supabaseClient
.channel('prenotazioni-live')
.on(
'postgres_changes',
{
event:'INSERT',
schema:'public',
table:'prenotazioni'
},
payload=>{
console.log('Nuova prenotazione:',payload.new);
}
)
.subscribe();
